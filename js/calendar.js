(function () {
  'use strict';

  // ===== 공휴일 데이터 (벧엘CM 참고) =====

  // 매년 반복 고정 공휴일 (MM-DD)
  var FIXED_HOLIDAYS = [
    { date: '01-01', name: '신정' },
    { date: '03-01', name: '삼일절' },
    { date: '05-05', name: '어린이날' },
    { date: '06-06', name: '현충일' },
    { date: '08-15', name: '광복절' },
    { date: '10-03', name: '개천절' },
    { date: '10-09', name: '한글날' },
    { date: '12-25', name: '성탄절' },
  ];

  // 연도별 공휴일 (음력 기반 + 대체공휴일, YYYY-MM-DD)
  var CUSTOM_HOLIDAYS = {
    2024: [
      { date: '2024-02-09', name: '설날 연휴' },
      { date: '2024-02-10', name: '설날' },
      { date: '2024-02-11', name: '설날 연휴' },
      { date: '2024-02-12', name: '대체공휴일' },
      { date: '2024-05-06', name: '대체공휴일' },
      { date: '2024-05-15', name: '부처님오신날' },
      { date: '2024-09-16', name: '추석 연휴' },
      { date: '2024-09-17', name: '추석' },
      { date: '2024-09-18', name: '추석 연휴' },
    ],
    2025: [
      { date: '2025-01-28', name: '설날 연휴' },
      { date: '2025-01-29', name: '설날' },
      { date: '2025-01-30', name: '설날 연휴' },
      { date: '2025-03-03', name: '대체공휴일' },
      { date: '2025-05-05', name: '부처님오신날·어린이날' },
      { date: '2025-05-06', name: '대체공휴일' },
      { date: '2025-10-05', name: '추석 연휴' },
      { date: '2025-10-06', name: '추석' },
      { date: '2025-10-07', name: '추석 연휴' },
      { date: '2025-10-08', name: '대체공휴일' },
    ],
    2026: [
      { date: '2026-01-28', name: '설날 연휴' },
      { date: '2026-01-29', name: '설날' },
      { date: '2026-01-30', name: '설날 연휴' },
      { date: '2026-03-02', name: '삼일절 대체공휴일' },
      { date: '2026-05-24', name: '부처님오신날' },
      { date: '2026-09-24', name: '추석 연휴' },
      { date: '2026-09-25', name: '추석' },
      { date: '2026-09-26', name: '추석 연휴' },
    ],
    2027: [
      { date: '2027-02-16', name: '설날 연휴' },
      { date: '2027-02-17', name: '설날' },
      { date: '2027-02-18', name: '설날 연휴' },
      { date: '2027-05-13', name: '부처님오신날' },
      { date: '2027-09-14', name: '추석 연휴' },
      { date: '2027-09-15', name: '추석' },
      { date: '2027-09-16', name: '추석 연휴' },
    ],
  };

  var DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

  var curYear, curMonth;

  // ===== 공휴일 조회 =====
  function getHolidayName(year, month, day) {
    var mm = String(month).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    var mmdd = mm + '-' + dd;
    var full  = year + '-' + mmdd;

    var customs = CUSTOM_HOLIDAYS[year] || [];
    for (var i = 0; i < customs.length; i++) {
      if (customs[i].date === full) return customs[i].name;
    }
    for (var j = 0; j < FIXED_HOLIDAYS.length; j++) {
      if (FIXED_HOLIDAYS[j].date === mmdd) return FIXED_HOLIDAYS[j].name;
    }
    return null;
  }

  // ===== 렌더링 =====
  function render() {
    // 네비 레이블
    document.getElementById('cal-nav-label').textContent =
      curYear + '년 ' + curMonth + '월';

    // 월 제목
    document.getElementById('cal-month-title').textContent = curMonth + '월';

    // 요일 헤더 (최초 1회만 렌더)
    var headers = document.getElementById('cal-day-headers');
    if (headers.children.length === 0) {
      DAY_KR.forEach(function (name, i) {
        var el = document.createElement('div');
        el.className = 'cal-day-header' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
        el.textContent = name;
        headers.appendChild(el);
      });
    }

    // 날짜 계산
    var datesEl  = document.getElementById('cal-dates');
    datesEl.innerHTML = '';

    var firstDow = new Date(curYear, curMonth - 1, 1).getDay(); // 0=일
    var lastDate = new Date(curYear, curMonth, 0).getDate();
    var prevLast = new Date(curYear, curMonth - 1, 0).getDate();

    var cells = [];

    // 이전 달 꼬리
    for (var p = firstDow - 1; p >= 0; p--) {
      cells.push({ day: prevLast - p, other: true });
    }
    // 이번 달
    for (var d = 1; d <= lastDate; d++) {
      cells.push({ day: d, other: false });
    }
    // 다음 달 머리 (5행 or 6행 채우기)
    var rows  = cells.length <= 35 ? 5 : 6;
    var total = rows * 7;
    var nd = 1;
    while (cells.length < total) {
      cells.push({ day: nd++, other: true });
    }

    // 셀 렌더
    cells.forEach(function (c, idx) {
      var col = idx % 7; // 0=일, 6=토
      var el  = document.createElement('div');
      el.className = 'cal-cell';

      if (c.other) {
        el.classList.add('other');
        el.textContent = c.day;
      } else {
        var hName = getHolidayName(curYear, curMonth, c.day);
        if (hName) {
          el.classList.add('holiday');
          el.innerHTML =
            c.day +
            '<span class="h-name">' + hName + '</span>';
        } else if (col === 0) {
          el.classList.add('sun');
          el.textContent = c.day;
        } else if (col === 6) {
          el.classList.add('sat');
          el.textContent = c.day;
        } else {
          el.textContent = c.day;
        }
      }

      datesEl.appendChild(el);
    });
  }

  // ===== 초기화 =====
  function init() {
    var now = new Date();
    curYear  = now.getFullYear();
    curMonth = now.getMonth() + 1;

    document.getElementById('btn-prev').addEventListener('click', function () {
      curMonth--;
      if (curMonth < 1) { curMonth = 12; curYear--; }
      render();
    });

    document.getElementById('btn-next').addEventListener('click', function () {
      curMonth++;
      if (curMonth > 12) { curMonth = 1; curYear++; }
      render();
    });

    document.getElementById('btn-print').addEventListener('click', function () {
      window.print();
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
