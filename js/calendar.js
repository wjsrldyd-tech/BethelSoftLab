(function () {
  'use strict';

  // ===== 국가 공휴일 =====

  // 매년 반복 (MM-DD)
  var FIXED_HOLIDAYS = [
    { date: '01-01', name: '신정' },
    { date: '03-01', name: '삼일절' },
    { date: '05-01', name: '노동절', fromYear: 2026 },
    { date: '05-05', name: '어린이날' },
    { date: '06-06', name: '현충일' },
    { date: '07-17', name: '제헌절', fromYear: 2026 },
    { date: '08-15', name: '광복절' },
    { date: '10-03', name: '개천절' },
    { date: '10-09', name: '한글날' },
    { date: '12-25', name: '성탄절' },
  ];

  // 음력 기반 + 대체공휴일 (YYYY-MM-DD)
  var LUNAR_HOLIDAYS = {
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

  // ===== 사용자 추가 휴일 (localStorage) =====
  var USER_KEY = 'CALENDAR_USER_HOLIDAYS';
  var userHolidays = [];

  function loadUserHolidays() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      userHolidays = raw ? JSON.parse(raw) : [];
    } catch (e) {
      userHolidays = [];
    }
  }

  function saveUserHolidays() {
    localStorage.setItem(USER_KEY, JSON.stringify(userHolidays));
  }

  // ===== 공휴일 조회 =====
  // 반환: null | { name: string, isUser: boolean }
  // 우선순위: 사용자 추가 > 음력 공휴일 > 고정 공휴일
  function getHolidayInfo(year, month, day) {
    var mm = String(month).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    var full = year + '-' + mm + '-' + dd;
    var mmdd = mm + '-' + dd;

    for (var u = 0; u < userHolidays.length; u++) {
      if (userHolidays[u].date === full) {
        return { name: userHolidays[u].name, isUser: true };
      }
    }
    var lunars = LUNAR_HOLIDAYS[year] || [];
    for (var i = 0; i < lunars.length; i++) {
      if (lunars[i].date === full) return { name: lunars[i].name, isUser: false };
    }
    for (var j = 0; j < FIXED_HOLIDAYS.length; j++) {
      var fixed = FIXED_HOLIDAYS[j];
      if (fixed.date === mmdd && (!fixed.fromYear || year >= fixed.fromYear)) {
        return { name: fixed.name, isUser: false };
      }
    }
    return null;
  }

  var DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];
  var curYear, curMonth;

  // ===== 달력 렌더링 =====
  function render() {
    document.getElementById('cal-nav-label').textContent =
      curYear + '년 ' + curMonth + '월';
    document.getElementById('cal-month-title').textContent = curMonth + '월';

    var headers = document.getElementById('cal-day-headers');
    if (headers.children.length === 0) {
      DAY_KR.forEach(function (name, i) {
        var el = document.createElement('div');
        el.className = 'cal-day-header' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
        el.textContent = name;
        headers.appendChild(el);
      });
    }

    var datesEl = document.getElementById('cal-dates');
    datesEl.innerHTML = '';

    var firstDow = new Date(curYear, curMonth - 1, 1).getDay();
    var lastDate = new Date(curYear, curMonth, 0).getDate();
    var prevLast = new Date(curYear, curMonth - 1, 0).getDate();

    var cells = [];
    for (var p = firstDow - 1; p >= 0; p--) {
      cells.push({ day: prevLast - p, other: true });
    }
    for (var d = 1; d <= lastDate; d++) {
      cells.push({ day: d, other: false });
    }
    var rows = cells.length <= 35 ? 5 : 6;
    var nd = 1;
    while (cells.length < rows * 7) {
      cells.push({ day: nd++, other: true });
    }

    cells.forEach(function (c, idx) {
      var col = idx % 7;
      var el = document.createElement('div');
      el.className = 'cal-cell';

      if (c.other) {
        el.classList.add('other');
        el.textContent = c.day;
      } else {
        var info = getHolidayInfo(curYear, curMonth, c.day);
        if (info) {
          el.classList.add(info.isUser ? 'holiday-user' : 'holiday');
          el.innerHTML = c.day +
            '<span class="h-name' + (info.isUser ? ' user' : '') + '">' +
            escapeHtml(info.name) + '</span>';
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

  // ===== 휴일 패널 =====
  function openPanel() {
    document.getElementById('holiday-panel').classList.add('open');
    document.getElementById('holiday-overlay').classList.add('open');
    renderUserList();
    document.getElementById('hp-date').focus();
  }

  function closePanel() {
    document.getElementById('holiday-panel').classList.remove('open');
    document.getElementById('holiday-overlay').classList.remove('open');
  }

  function renderUserList() {
    var list = document.getElementById('hp-list');
    if (userHolidays.length === 0) {
      list.innerHTML = '<div class="hp-empty">등록된 추가 휴일이 없습니다.</div>';
      return;
    }
    var sorted = userHolidays.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
    list.innerHTML = sorted.map(function (h) {
      var origIdx = userHolidays.indexOf(
        userHolidays.filter(function (x) { return x.date === h.date; })[0]
      );
      return '<div class="hp-item">'
        + '<div class="hp-item-info">'
        + '<span class="hp-item-date">' + escapeHtml(h.date) + '</span>'
        + '<span class="hp-item-name">' + escapeHtml(h.name) + '</span>'
        + '</div>'
        + '<button class="hp-delete-btn" data-idx="' + origIdx + '" aria-label="삭제">✕</button>'
        + '</div>';
    }).join('');

    list.querySelectorAll('.hp-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        userHolidays.splice(idx, 1);
        saveUserHolidays();
        renderUserList();
        render();
      });
    });
  }

  function addUserHoliday() {
    var dateInput = document.getElementById('hp-date');
    var nameInput = document.getElementById('hp-name');
    var dateStr   = dateInput.value.trim();
    var name      = nameInput.value.trim();

    if (!dateStr || !name) {
      showMsg('날짜와 이름을 모두 입력해 주세요.');
      return;
    }
    if (userHolidays.some(function (h) { return h.date === dateStr; })) {
      showMsg('이미 등록된 날짜입니다.');
      return;
    }

    userHolidays.push({ date: dateStr, name: name });
    saveUserHolidays();
    renderUserList();
    render();

    dateInput.value = '';
    nameInput.value = '';
    showMsg('');
    dateInput.focus();
  }

  function showMsg(text) {
    var el = document.getElementById('hp-msg');
    if (!el) return;
    el.textContent = text;
    clearTimeout(el._t);
    if (text) el._t = setTimeout(function () { el.textContent = ''; }, 2500);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ===== 초기화 =====
  function init() {
    loadUserHolidays();

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

    document.getElementById('btn-holiday').addEventListener('click', openPanel);
    document.getElementById('btn-holiday-close').addEventListener('click', closePanel);
    document.getElementById('holiday-overlay').addEventListener('click', closePanel);

    document.getElementById('btn-hp-add').addEventListener('click', addUserHoliday);
    document.getElementById('hp-name').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') addUserHoliday();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
