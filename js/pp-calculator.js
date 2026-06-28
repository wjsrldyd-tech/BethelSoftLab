(function () {
  'use strict';

  var elHigh  = document.getElementById('inp-high');
  var elLow   = document.getElementById('inp-low');
  var elClose = document.getElementById('inp-close');
  var elBtn   = document.getElementById('btn-calc');

  var valEls = {
    pp: document.getElementById('val-pp'),
    r1: document.getElementById('val-r1'),
    r2: document.getElementById('val-r2'),
    r3: document.getElementById('val-r3'),
    r4: document.getElementById('val-r4'),
    r5: document.getElementById('val-r5'),
    s1: document.getElementById('val-s1'),
    s2: document.getElementById('val-s2'),
    s3: document.getElementById('val-s3'),
    s4: document.getElementById('val-s4'),
    s5: document.getElementById('val-s5'),
  };

  var rowEls = {
    pp: document.getElementById('row-pp'),
    r1: document.getElementById('row-r1'),
    r2: document.getElementById('row-r2'),
    r3: document.getElementById('row-r3'),
    r4: document.getElementById('row-r4'),
    r5: document.getElementById('row-r5'),
    s1: document.getElementById('row-s1'),
    s2: document.getElementById('row-s2'),
    s3: document.getElementById('row-s3'),
    s4: document.getElementById('row-s4'),
    s5: document.getElementById('row-s5'),
  };

  function fmt(n) {
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    var range = H - L;
    var PP  = (H + L + C) / 3;
    var R1  = 2 * PP - L;
    var S1  = 2 * PP - H;
    var R2  = PP + range;
    var S2  = PP - range;
    var R3  = H + 2 * (PP - L);
    var S3  = L - 2 * (H - PP);
    var R4  = R3 + range;
    var S4  = S3 - range;
    var R5  = R4 + range;
    var S5  = S4 - range;

    var values = { pp: PP, r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5 };

    Object.keys(valEls).forEach(function (key) {
      valEls[key].textContent = fmt(values[key]);
      rowEls[key].classList.remove('empty');
    });
  }

  elBtn.addEventListener('click', calculate);

  [elHigh, elLow, elClose].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') calculate();
    });
  });
}());
