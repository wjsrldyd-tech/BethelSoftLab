(function () {
  'use strict';

  var elHigh    = document.getElementById('inp-high');
  var elLow     = document.getElementById('inp-low');
  var elClose   = document.getElementById('inp-close');
  var elCurrent = document.getElementById('inp-current');
  var elBtn     = document.getElementById('btn-calc');
  var elList    = document.getElementById('pp-result-list');

  var lastValues = null;

  var LEVEL_ORDER = [
    { key: 'r5', label: 'R5', type: 'resistance' },
    { key: 'r4', label: 'R4', type: 'resistance' },
    { key: 'r3', label: 'R3', type: 'resistance' },
    { key: 'r2', label: 'R2', type: 'resistance' },
    { key: 'r1', label: 'R1', type: 'resistance' },
    { key: 'pp', label: 'PP', type: 'pivot' },
    { key: 's1', label: 'S1', type: 'support' },
    { key: 's2', label: 'S2', type: 'support' },
    { key: 's3', label: 'S3', type: 'support' },
    { key: 's4', label: 'S4', type: 'support' },
    { key: 's5', label: 'S5', type: 'support' },
  ];

  function fmt(n) {
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function calcValues(H, L, C) {
    var range = H - L;
    var PP = (H + L + C) / 3;
    var R1 = 2 * PP - L;
    var S1 = 2 * PP - H;
    var R2 = PP + range;
    var S2 = PP - range;
    var R3 = H + 2 * (PP - L);
    var S3 = L - 2 * (H - PP);
    var R4 = R3 + range;
    var S4 = S3 - range;
    var R5 = R4 + range;
    var S5 = S4 - range;
    return {
      pp: PP, r1: R1, r2: R2, r3: R3, r4: R4, r5: R5,
      s1: S1, s2: S2, s3: S3, s4: S4, s5: S5,
    };
  }

  function getCurrentPrice() {
    var n = parseFloat(elCurrent.value);
    return !isNaN(n) && n > 0 ? n : null;
  }

  /* 현재가가 속한 구간 라벨 (예: R1 ~ PP) */
  function findZoneLabel(current, values, sortedItems) {
    var idx = -1;
    for (var i = 0; i < sortedItems.length; i++) {
      if (sortedItems[i].kind === 'current') { idx = i; break; }
    }
    if (idx < 0) return '';

    var above = idx > 0 ? sortedItems[idx - 1].label : null;
    var below = idx < sortedItems.length - 1 ? sortedItems[idx + 1].label : null;

    if (!above && below) return below + ' 이상';
    if (above && !below) return above + ' 이하';
    if (above && below) return above + ' ~ ' + below;
    return '';
  }

  function createLevelRow(level, price, empty) {
    var row = document.createElement('div');
    row.className = 'pp-result-row ' + level.type + (empty ? ' empty' : '');
    row.innerHTML =
      '<span class="pp-result-name">' + level.label + '</span>' +
      '<span class="pp-result-value">' + (empty ? '—' : fmt(price)) + '</span>';
    return row;
  }

  function createCurrentRow(price, zone) {
    var row = document.createElement('div');
    row.className = 'pp-result-row current-price';
    var nameHtml = '현재가';
    if (zone) nameHtml += '<span class="pp-result-zone">' + zone + '</span>';
    row.innerHTML =
      '<span class="pp-result-name">' + nameHtml + '</span>' +
      '<span class="pp-result-value">' + fmt(price) + '</span>';
    return row;
  }

  function renderResults(values, currentPrice) {
    elList.innerHTML = '';
    lastValues = values;

    var items = LEVEL_ORDER.map(function (level) {
      return {
        kind: 'level',
        label: level.label,
        type: level.type,
        price: values[level.key],
        level: level,
      };
    });

    if (currentPrice != null) {
      items.push({ kind: 'current', label: '현재가', price: currentPrice });
    }

    items.sort(function (a, b) {
      if (b.price !== a.price) return b.price - a.price;
      /* 같은 가격이면 피봇 레벨 → 현재가 순 (구간 라벨 정확도) */
      if (a.kind === 'level' && b.kind === 'current') return -1;
      if (a.kind === 'current' && b.kind === 'level') return 1;
      return 0;
    });

    var zone = currentPrice != null ? findZoneLabel(currentPrice, values, items) : '';

    items.forEach(function (item) {
      if (item.kind === 'current') {
        elList.appendChild(createCurrentRow(item.price, zone));
      } else {
        elList.appendChild(createLevelRow(item.level, item.price, false));
      }
    });
  }

  function renderEmpty() {
    elList.innerHTML = '';
    lastValues = null;
    LEVEL_ORDER.forEach(function (level) {
      elList.appendChild(createLevelRow(level, 0, true));
    });
  }

  function refreshCurrentPrice() {
    if (!lastValues) return;
    renderResults(lastValues, getCurrentPrice());
  }

  function calculate() {
    var H = parseFloat(elHigh.value);
    var L = parseFloat(elLow.value);
    var C = parseFloat(elClose.value);

    if (isNaN(H) || isNaN(L) || isNaN(C) || H <= 0 || L <= 0 || C <= 0) {
      alert('고가 · 저가 · 종가를 모두 입력해 주세요.');
      return;
    }
    if (L > H) {
      alert('저가가 고가보다 클 수 없습니다.');
      return;
    }

    var values = calcValues(H, L, C);
    renderResults(values, getCurrentPrice());

    var db = window.stocksDb;
    if (db) {
      var today = new Date().toISOString().slice(0, 10);
      db.savePpEntry({
        targetDate: today,
        high: H, low: L, close: C,
        pp: values.pp,
        r1: values.r1, r2: values.r2, r3: values.r3, r4: values.r4, r5: values.r5,
        s1: values.s1, s2: values.s2, s3: values.s3, s4: values.s4, s5: values.s5,
      }).then(function (id) {
        console.log('[PP] 저장 완료 — id:', id);
      }).catch(function (e) {
        console.warn('[PP] 저장 실패:', e.message || e);
      });
    }
  }

  function restoreLast(entry) {
    if (!entry) { renderEmpty(); return; }
    elHigh.value  = entry.high;
    elLow.value   = entry.low;
    elClose.value = entry.close;

    var values;
    if (entry.pp != null) {
      values = {
        pp: entry.pp, r1: entry.r1, r2: entry.r2, r3: entry.r3,
        r4: entry.r4, r5: entry.r5, s1: entry.s1, s2: entry.s2,
        s3: entry.s3, s4: entry.s4, s5: entry.s5,
      };
    } else {
      var H = Number(entry.high), L = Number(entry.low), C = Number(entry.close);
      if (H > 0 && L > 0 && C > 0 && L <= H) {
        values = calcValues(H, L, C);
      }
    }

    if (values) {
      renderResults(values, getCurrentPrice());
    } else {
      renderEmpty();
    }
  }

  function init() {
    renderEmpty();

    elBtn.addEventListener('click', calculate);

    [elHigh, elLow, elClose, elCurrent].forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') calculate();
      });
    });

    elCurrent.addEventListener('input', refreshCurrentPrice);

    var db = window.stocksDb;
    if (db && typeof db.loadLastPpEntry === 'function') {
      db.loadLastPpEntry(null).then(restoreLast).catch(function (e) {
        console.warn('[PP] 복원 실패:', e.message || e);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
