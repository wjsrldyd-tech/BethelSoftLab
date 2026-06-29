(function () {
  'use strict';

  var LS_LAST_INST = 'tj_last_instrument_id';

  var db = null;
  var instruments = [];
  var currentInstrumentId = null;
  var journalBase = null;
  var journalEntries = [];
  var currentSide = 'buy';
  var editMode = null;
  var editingEntryId = null;

  var elSelInst       = document.getElementById('sel-instrument');
  var elToolbar       = document.getElementById('tj-toolbar');
  var elBtnSettings   = document.getElementById('btn-settings');
  var elSettingsBar   = document.getElementById('settings-bar');
  var elTicker        = document.getElementById('inp-ticker');
  var elName          = document.getElementById('inp-name');
  var elBtnAddInst    = document.getElementById('btn-add-inst');
  var elBaseQty       = document.getElementById('inp-base-qty');
  var elBaseAvg       = document.getElementById('inp-base-avg');
  var elBtnSaveBase   = document.getElementById('btn-save-base');
  var elBaseMsg       = document.getElementById('base-msg');
  var elEntryBar      = document.getElementById('entry-bar');
  var elPrice         = document.getElementById('inp-price');
  var elQty           = document.getElementById('inp-qty');
  var elTradedAt      = document.getElementById('inp-traded-at');
  var elBtnAddEntry   = document.getElementById('btn-add-entry');
  var elBtnCancelEntry = document.getElementById('btn-cancel-entry');
  var elEntryMsg      = document.getElementById('entry-msg');
  var elSummary       = document.getElementById('tj-summary');
  var elSumQty        = document.getElementById('sum-qty');
  var elSumAvg        = document.getElementById('sum-avg');
  var elSumAddQty     = document.getElementById('sum-add-qty');
  var elSumAddAvg     = document.getElementById('sum-add-avg');
  var elSumRealized   = document.getElementById('sum-realized');
  var elTableArea     = document.getElementById('tj-table-area');
  var sideBtns        = document.querySelectorAll('.tj-side-btn');

  var KIWOOM = {
    commissionRate: 0.00015,
    minCommission: 1000,
    sellTaxRate: 0.0018,
  };

  function calcCommission(amount) {
    return Math.max(Math.round(amount * KIWOOM.commissionRate), KIWOOM.minCommission);
  }

  function calcSellTax(sellAmount) {
    return Math.round(sellAmount * KIWOOM.sellTaxRate);
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('ko-KR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function fmtQty(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('ko-KR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function parseNum(input) {
    var n = parseFloat(String(input.value).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function getTickSize(price) {
    var p = Number(price);
    if (!p || p <= 0 || isNaN(p)) p = 50000;
    if (p < 1000)    return 1;
    if (p < 5000)    return 5;
    if (p < 10000)   return 10;
    if (p < 50000)   return 50;
    if (p < 100000)  return 100;
    if (p < 500000)  return 500;
    return 1000;
  }

  function adjustPriceByTick(input, direction) {
    var current = parseNum(input);
    if (current <= 0) {
      current = direction > 0 ? getTickSize(50000) : 0;
    }
    var tick = getTickSize(current);
    var next = current + direction * tick;
    if (next < tick) next = 0;
    input.value = next > 0 ? String(Math.round(next)) : '';
  }

  function onPriceKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!elBtnAddEntry.disabled) saveEntry();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustPriceByTick(e.target, 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustPriceByTick(e.target, -1);
    }
  }

  function setMsg(el, text, ok) {
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtPnl(n) {
    if (n == null || isNaN(n)) return '—';
    var prefix = n > 0 ? '+' : '';
    return prefix + fmt(n);
  }

  function pnlClass(n) {
    if (n == null || isNaN(n) || n === 0) return 'zero';
    return n > 0 ? 'plus' : 'minus';
  }

  function setSummaryPnl(el, n) {
    el.textContent = (n != null && !isNaN(n)) ? fmtPnl(n) + '원' : '—';
    el.classList.remove('pnl-plus', 'pnl-minus');
    if (n > 0) el.classList.add('pnl-plus');
    else if (n < 0) el.classList.add('pnl-minus');
  }

  function computeJournal(base, entries) {
    var qty = base.baseQty;
    var avg = base.baseAvg;
    var addQty = 0;
    var addAvg = 0;
    var totalRealized = 0;

    var rows = [{
      kind: 'base',
      label: '시작',
      side: null,
      price: null,
      qty: null,
      tradedAt: null,
      qtyAfter: qty,
      avgAfter: avg,
      addQtyAfter: 0,
      addAvgAfter: null,
      realizedPnl: null,
      entryId: null,
    }];

    entries.forEach(function (entry) {
      var realizedPnl = null;

      if (entry.side === 'buy') {
        var newQty = qty + entry.qty;
        avg = newQty > 0 ? (qty * avg + entry.qty * entry.price) / newQty : avg;
        qty = newQty;

        var buyAmount = entry.price * entry.qty;
        var buyComm = calcCommission(buyAmount);
        var costTotal = buyAmount + buyComm;
        var newAddQty = addQty + entry.qty;
        addAvg = newAddQty > 0
          ? (addQty * addAvg + costTotal) / newAddQty
          : 0;
        addQty = newAddQty;
      } else {
        qty = qty - entry.qty;

        var sellAmount = entry.price * entry.qty;
        var fromAdd = Math.min(entry.qty, addQty);
        if (fromAdd > 0 && addAvg > 0) {
          var gross = fromAdd * (entry.price - addAvg);
          var sellComm = calcCommission(sellAmount);
          var sellTax = calcSellTax(sellAmount);
          realizedPnl = Math.round(gross - sellComm - sellTax);
          totalRealized += realizedPnl;
        }
        addQty = Math.max(0, addQty - entry.qty);
        if (addQty === 0) addAvg = 0;
      }

      rows.push({
        kind: 'entry',
        label: entry.side === 'buy' ? '매수' : '매도',
        side: entry.side,
        price: entry.price,
        qty: entry.qty,
        tradedAt: entry.tradedAt,
        qtyAfter: qty,
        avgAfter: avg,
        addQtyAfter: addQty,
        addAvgAfter: addQty > 0 ? addAvg : null,
        realizedPnl: realizedPnl,
        entryId: entry.id,
      });
    });

    return { rows: rows, totalRealized: totalRealized };
  }

  function validateJournal(base, entries) {
    var result = computeJournal(base, entries);
    for (var i = 0; i < result.rows.length; i++) {
      if (result.rows[i].qtyAfter < 0) {
        var label = result.rows[i].kind === 'base' ? '시작' : ('기록 #' + i);
        return { ok: false, message: label + ' 이후 보유 수량이 부족합니다.' };
      }
    }
    return { ok: true };
  }

  function setSide(side) {
    currentSide = side;
    sideBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-side') === side);
    });
  }

  function clearEntryForm() {
    elPrice.value = '';
    elQty.value = '';
    elTradedAt.value = todayStr();
    setSide('buy');
  }

  function updateEditUI() {
    var editingBase = editMode === 'base';
    var editingEntry = editMode === 'entry';

    elBtnSaveBase.textContent = editingBase ? '수정 저장' : '시작 저장';
    elBtnAddEntry.textContent = editingEntry ? '수정 저장' : '기록 추가';
    elBtnCancelEntry.hidden = !editingEntry;
    elEntryBar.classList.toggle('editing', editingEntry);
    elSettingsBar.classList.toggle('editing', editingBase);
  }

  function isSettingsOpen() {
    return elToolbar.classList.contains('settings-open');
  }

  function openSettings() {
    elToolbar.classList.add('settings-open');
    elBtnSettings.classList.add('active');
    elBtnSettings.textContent = '✕ 닫기';
  }

  function closeSettings() {
    elToolbar.classList.remove('settings-open');
    elBtnSettings.classList.remove('active');
    elBtnSettings.textContent = '⚙ 설정';
    if (editMode === 'base') {
      editMode = null;
      updateEditUI();
      renderJournal();
    }
  }

  function toggleSettings() {
    if (isSettingsOpen()) closeSettings();
    else openSettings();
  }

  function syncBaseFields() {
    if (journalBase) {
      elBaseQty.value = journalBase.baseQty > 0 ? String(journalBase.baseQty) : '';
      elBaseAvg.value = journalBase.baseAvg > 0 ? String(journalBase.baseAvg) : '';
    } else {
      elBaseQty.value = '';
      elBaseAvg.value = '';
    }
  }

  function clearEditMode() {
    editMode = null;
    editingEntryId = null;
    updateEditUI();
    syncBaseFields();
    clearEntryForm();
    setMsg(elBaseMsg, '');
    setMsg(elEntryMsg, '');
    renderJournal();
  }

  function startEditBase() {
    if (!journalBase) {
      openSettings();
      if (currentInstrumentId) elBaseQty.focus();
      return;
    }
    editMode = 'base';
    editingEntryId = null;
    syncBaseFields();
    clearEntryForm();
    setMsg(elBaseMsg, '');
    setMsg(elEntryMsg, '');
    updateEditUI();
    openSettings();
    renderJournal();
    elBaseQty.focus();
  }

  function startEditEntry(id) {
    var entry = journalEntries.filter(function (e) { return e.id === id; })[0];
    if (!entry) return;
    editMode = 'entry';
    editingEntryId = id;
    setSide(entry.side);
    elPrice.value = String(entry.price);
    elQty.value = String(entry.qty);
    elTradedAt.value = entry.tradedAt || todayStr();
    setMsg(elBaseMsg, '');
    setMsg(elEntryMsg, '');
    updateEditUI();
    renderJournal();
    elEntryBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    elPrice.focus();
  }

  function updateFormState() {
    var hasInst = !!currentInstrumentId;
    var hasBase = !!journalBase;

    elBaseQty.disabled = !hasInst;
    elBaseAvg.disabled = !hasInst;
    elBtnSaveBase.disabled = !hasInst;

    var entryEnabled = hasInst && hasBase;
    [elPrice, elQty, elTradedAt, elBtnAddEntry].forEach(function (el) {
      el.disabled = !entryEnabled;
    });
    elEntryBar.classList.toggle('disabled', !entryEnabled);
  }

  function renderInstrumentSelect() {
    var prev = elSelInst.value;
    elSelInst.innerHTML = '<option value="">— 종목을 선택하세요 —</option>';
    instruments.forEach(function (inst) {
      var opt = document.createElement('option');
      opt.value = inst.id;
      var label = inst.ticker;
      if (inst.name) label += ' ' + inst.name;
      opt.textContent = label;
      elSelInst.appendChild(opt);
    });
    if (prev && instruments.some(function (i) { return i.id === prev; })) {
      elSelInst.value = prev;
    }
  }

  function renderJournal() {
    updateFormState();

    if (!currentInstrumentId) {
      elSummary.hidden = true;
      elTableArea.innerHTML = '<div class="tj-empty">종목을 선택하면 일지가 표시됩니다.</div>';
      return;
    }

    if (!journalBase) {
      elSummary.hidden = true;
      elTableArea.innerHTML = '<div class="tj-empty">⚙ 설정을 열어 보유·평단(시작 상황)을 저장하면 일지가 시작됩니다.</div>';
      return;
    }

    var result = computeJournal(journalBase, journalEntries);
    var allRows = result.rows;
    var baseRow = allRows[0];
    var entryRows = allRows.slice(1);
    var displayRows = entryRows.slice().reverse().concat([baseRow]);
    var entryCount = entryRows.length;
    var last = allRows[allRows.length - 1];

    elSummary.hidden = false;
    elSumQty.textContent = fmtQty(last.qtyAfter) + '주';
    elSumAvg.textContent = fmt(last.avgAfter) + '원';
    elSumAddQty.textContent = last.addQtyAfter > 0
      ? fmtQty(last.addQtyAfter) + '주'
      : '—';
    elSumAddAvg.textContent = last.addAvgAfter != null
      ? fmt(last.addAvgAfter) + '원'
      : '—';
    setSummaryPnl(elSumRealized, result.totalRealized);

    var html = '<div class="tj-table-wrap"><table class="tj-table"><thead><tr>'
      + '<th>#</th><th>구분</th><th class="num">가격</th><th class="num">수량</th>'
      + '<th>날짜</th>'
      + '<th class="num">보유</th><th class="num">전체평단</th>'
      + '<th class="num">추가보유</th><th class="num">추가평단</th><th class="num">실현손익</th><th></th>'
      + '</tr></thead><tbody>';

    displayRows.forEach(function (row, idx) {
      var isBase = row.kind === 'base';
      var isEditing = (isBase && editMode === 'base')
        || (!isBase && editMode === 'entry' && row.entryId === editingEntryId);
      var rowNum = isBase ? '—' : String(entryCount - idx);
      html += '<tr class="' + (isBase ? 'row-base' : '')
        + (isEditing ? ' row-editing' : '') + '">';
      html += '<td>' + rowNum + '</td>';
      html += '<td><span class="tj-badge ' + (isBase ? 'base' : row.side) + '">'
        + escapeHtml(row.label) + '</span></td>';
      html += '<td class="num">' + (row.price != null ? fmt(row.price) : '—') + '</td>';
      html += '<td class="num">' + (row.qty != null ? fmtQty(row.qty) : '—') + '</td>';
      html += '<td>' + (row.tradedAt ? escapeHtml(row.tradedAt) : '—') + '</td>';
      html += '<td class="num">' + fmtQty(row.qtyAfter) + '</td>';
      html += '<td class="num">' + fmt(row.avgAfter) + '</td>';
      html += '<td class="num">' + (row.addQtyAfter > 0 ? fmtQty(row.addQtyAfter) : '—') + '</td>';
      html += '<td class="num">' + (row.addAvgAfter != null ? fmt(row.addAvgAfter) : '—') + '</td>';
      html += '<td class="num">';
      if (row.realizedPnl != null) {
        html += '<span class="tj-pnl ' + pnlClass(row.realizedPnl) + '">'
          + fmtPnl(row.realizedPnl) + '</span>';
      } else {
        html += '—';
      }
      html += '</td>';
      html += '<td><div class="tj-row-actions">';
      if (isBase) {
        html += '<button type="button" class="tj-edit-btn" data-kind="base" aria-label="시작 수정">✎</button>';
      } else if (row.entryId) {
        html += '<button type="button" class="tj-edit-btn" data-id="' + escapeAttr(row.entryId)
          + '" aria-label="수정">✎</button>';
        html += '<button type="button" class="tj-del-btn" data-id="' + escapeAttr(row.entryId)
          + '" aria-label="삭제">✕</button>';
      }
      html += '</div></td></tr>';
    });

    html += '</tbody></table></div>';
    elTableArea.innerHTML = html;

    elTableArea.querySelectorAll('.tj-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteEntry(btn.getAttribute('data-id'));
      });
    });

    elTableArea.querySelectorAll('.tj-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-kind') === 'base') {
          startEditBase();
        } else {
          startEditEntry(btn.getAttribute('data-id'));
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function saveLastInstrument(id) {
    if (id) localStorage.setItem(LS_LAST_INST, id);
  }

  async function loadInstruments() {
    instruments = await db.listInstruments();
    renderInstrumentSelect();
  }

  async function restoreLastInstrument() {
    var lastId = localStorage.getItem(LS_LAST_INST);
    if (lastId && instruments.some(function (i) { return i.id === lastId; })) {
      elSelInst.value = lastId;
      await onInstrumentChange();
    }
  }

  async function loadJournal(instrumentId) {
    journalBase = await db.getJournalBase(instrumentId);
    journalEntries = journalBase
      ? await db.listJournalEntries(instrumentId)
      : [];

    syncBaseFields();
    editMode = null;
    editingEntryId = null;
    updateEditUI();
    clearEntryForm();
    renderJournal();
  }

  async function onInstrumentChange() {
    currentInstrumentId = elSelInst.value || null;
    editMode = null;
    editingEntryId = null;
    updateEditUI();
    setMsg(elBaseMsg, '');
    setMsg(elEntryMsg, '');

    if (!currentInstrumentId) {
      journalBase = null;
      journalEntries = [];
      elSummary.hidden = true;
      elTableArea.innerHTML = '<div class="tj-empty">종목을 선택하면 일지가 표시됩니다.</div>';
      updateFormState();
      return;
    }

    saveLastInstrument(currentInstrumentId);
    await loadJournal(currentInstrumentId);
  }

  async function addInstrument() {
    var ticker = elTicker.value.trim();
    var name   = elName.value.trim();
    if (!ticker) {
      alert('종목 코드를 입력해 주세요.');
      elTicker.focus();
      return;
    }

    try {
      var id = await db.saveInstrument({ ticker: ticker, name: name });
      elTicker.value = '';
      elName.value = '';
      await loadInstruments();
      elSelInst.value = id;
      saveLastInstrument(id);
      await onInstrumentChange();
    } catch (e) {
      alert('종목 저장 실패: ' + (e.message || e));
    }
  }

  async function saveBase() {
    if (!currentInstrumentId) return;

    var baseQty = parseNum(elBaseQty);
    var baseAvg = parseNum(elBaseAvg);

    if (baseQty <= 0) {
      setMsg(elBaseMsg, '보유 수량을 입력해 주세요.');
      elBaseQty.focus();
      return;
    }
    if (baseAvg <= 0) {
      setMsg(elBaseMsg, '평단가를 입력해 주세요.');
      elBaseAvg.focus();
      return;
    }

    var simBase = { baseQty: baseQty, baseAvg: baseAvg, note: '' };
    var check = validateJournal(simBase, journalEntries);
    if (!check.ok) {
      setMsg(elBaseMsg, check.message);
      return;
    }

    try {
      await db.saveJournalBase({
        instrumentId: currentInstrumentId,
        baseQty: baseQty,
        baseAvg: baseAvg,
        note: '',
      });
      var wasEdit = editMode === 'base';
      editMode = null;
      updateEditUI();
      setMsg(elBaseMsg, wasEdit ? '수정되었습니다.' : '저장되었습니다.', true);
      await loadJournal(currentInstrumentId);
      if (!wasEdit) closeSettings();
    } catch (e) {
      setMsg(elBaseMsg, '저장 실패: ' + (e.message || e));
    }
  }

  async function saveEntry() {
    if (!currentInstrumentId) return;

    if (!journalBase) {
      setMsg(elEntryMsg, '⚙ 설정에서 시작 상황을 먼저 저장해 주세요.');
      return;
    }

    var price = parseNum(elPrice);
    var qty   = parseNum(elQty);
    var tradedAt = elTradedAt.value || todayStr();
    var isEdit = editMode === 'entry' && editingEntryId;

    if (price <= 0) {
      setMsg(elEntryMsg, '가격을 입력해 주세요.');
      elPrice.focus();
      return;
    }
    if (qty <= 0) {
      setMsg(elEntryMsg, '수량을 입력해 주세요.');
      elQty.focus();
      return;
    }

    var newEntry = {
      id: isEdit ? editingEntryId : null,
      side: currentSide,
      price: price,
      qty: qty,
      tradedAt: tradedAt,
    };

    var simEntries = journalEntries.map(function (e) {
      if (isEdit && e.id === editingEntryId) {
        return Object.assign({}, e, newEntry);
      }
      return e;
    });
    if (!isEdit) {
      simEntries = simEntries.concat([newEntry]);
    }

    var check = validateJournal(journalBase, simEntries);
    if (!check.ok) {
      setMsg(elEntryMsg, check.message);
      return;
    }

    try {
      var payload = {
        instrumentId: currentInstrumentId,
        side: currentSide,
        price: price,
        qty: qty,
        tradedAt: tradedAt,
        note: '',
      };
      if (isEdit) {
        var orig = journalEntries.filter(function (e) { return e.id === editingEntryId; })[0];
        payload.id = editingEntryId;
        payload.sortOrder = orig ? orig.sortOrder : undefined;
      }
      await db.saveJournalEntry(payload);
      clearEntryForm();
      editMode = null;
      editingEntryId = null;
      updateEditUI();
      setMsg(elEntryMsg, isEdit ? '수정되었습니다.' : '기록이 추가되었습니다.', true);
      await loadJournal(currentInstrumentId);
    } catch (e) {
      setMsg(elEntryMsg, '저장 실패: ' + (e.message || e));
    }
  }

  async function deleteEntry(id) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    try {
      if (editingEntryId === id) {
        editMode = null;
        editingEntryId = null;
        clearEntryForm();
        updateEditUI();
      }
      await db.deleteJournalEntry(id);
      await loadJournal(currentInstrumentId);
    } catch (e) {
      alert('삭제 실패: ' + (e.message || e));
    }
  }

  function initSideToggle() {
    sideBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSide(btn.getAttribute('data-side'));
      });
    });
  }

  function init() {
    db = window.stocksDb;
    if (!db) {
      elTableArea.innerHTML = '<div class="tj-empty">DB를 불러올 수 없습니다.</div>';
      return;
    }

    elTradedAt.value = todayStr();
    initSideToggle();
    updateEditUI();

    elSelInst.addEventListener('change', onInstrumentChange);
    elBtnSettings.addEventListener('click', toggleSettings);
    elBtnAddInst.addEventListener('click', addInstrument);
    elBtnSaveBase.addEventListener('click', saveBase);
    elBtnAddEntry.addEventListener('click', saveEntry);
    elBtnCancelEntry.addEventListener('click', clearEditMode);

    [elBaseAvg, elPrice].forEach(function (el) {
      el.addEventListener('keydown', onPriceKeydown);
    });
    elQty.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!elBtnAddEntry.disabled) saveEntry();
      }
    });

    loadInstruments()
      .then(restoreLastInstrument)
      .catch(function (e) {
        console.warn('[Journal] 종목 로드 실패:', e.message || e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
