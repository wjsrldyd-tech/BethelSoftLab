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
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /* KRX 주식 호가 단위 (가격 구간별) */
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

  function parseInputPrice(input) {
    var n = parseFloat(String(input.value).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function adjustPriceByTick(input, direction) {
    var current = parseInputPrice(input);
    if (current <= 0) {
      current = direction > 0 ? getTickSize(50000) : 0;
    }
    var tick = getTickSize(current);
    var next = current + direction * tick;
    if (next < tick) next = 0;
    input.value = next > 0 ? String(Math.round(next)) : '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function onPriceKeydown(e) {
    if (e.key === 'Enter') {
      calculate();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustPriceByTick(e.target, 1);
      if (e.target === elCurrent) refreshCurrentPrice();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustPriceByTick(e.target, -1);
      if (e.target === elCurrent) refreshCurrentPrice();
    }
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
    var n = parseInputPrice(elCurrent);
    return n > 0 ? n : null;
  }

  function fmtPct(n) {
    return n.toFixed(1) + '%';
  }

  /* 현재가 ↔ 인접 피봇까지 남은 비율 (↑ 위 · ↓ 아래) */
  function calcPositionHtml(current, sortedItems) {
    var idx = -1;
    for (var i = 0; i < sortedItems.length; i++) {
      if (sortedItems[i].kind === 'current') { idx = i; break; }
    }
    if (idx < 0) return '';

    var above = idx > 0 ? sortedItems[idx - 1] : null;
    var below = idx < sortedItems.length - 1 ? sortedItems[idx + 1] : null;

    /* 구간 내: 위·아래 남은 % (합계 100%) */
    if (above && below) {
      var range = above.price - below.price;
      if (range <= 0) return '';
      var pctUp   = ((above.price - current) / range) * 100;
      var pctDown = ((current - below.price) / range) * 100;
      return (
        '<span class="pp-result-position">' +
          '<span class="pos-up">↑ ' + fmtPct(pctUp) + '</span>' +
          '<span class="pos-sep">·</span>' +
          '<span class="pos-down">↓ ' + fmtPct(pctDown) + '</span>' +
        '</span>'
      );
    }

    /* R5 이상 — 직전 구간(R5~R4) 폭 기준 초과 % */
    if (above && !below) {
      var prevIdx = idx - 2;
      if (prevIdx >= 0) {
        var refRange = above.price - sortedItems[prevIdx].price;
        if (refRange > 0) {
          var over = ((current - above.price) / refRange) * 100;
          return '<span class="pp-result-position"><span class="pos-up">↑ ' + fmtPct(over) + '</span></span>';
        }
      }
      return '';
    }

    /* S5 이하 — 직전 구간(S4~S5) 폭 기준 이탈 % */
    if (!above && below) {
      var nextIdx = idx + 2;
      if (nextIdx < sortedItems.length) {
        var refRange2 = sortedItems[nextIdx].price - below.price;
        if (refRange2 > 0) {
          var under = ((below.price - current) / refRange2) * 100;
          return '<span class="pp-result-position"><span class="pos-down">↓ ' + fmtPct(under) + '</span></span>';
        }
      }
      return '';
    }

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

  function createCurrentRow(price, positionHtml) {
    var row = document.createElement('div');
    row.className = 'pp-result-row current-price';
    var nameHtml = '현재가' + (positionHtml || '');
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

    var positionHtml = currentPrice != null
      ? calcPositionHtml(currentPrice, items)
      : '';

    items.forEach(function (item) {
      if (item.kind === 'current') {
        elList.appendChild(createCurrentRow(item.price, positionHtml));
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
    var H = parseInputPrice(elHigh);
    var L = parseInputPrice(elLow);
    var C = parseInputPrice(elClose);

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
      el.addEventListener('keydown', onPriceKeydown);
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
