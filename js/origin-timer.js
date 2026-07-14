// =============== origin-timer.js ===============
// 대항해시대 오리진 교역소 재고 타이머 UI
// 절대 시각(anchor_at) 기준 30분 주기 · 해역별 맵 핀

(function () {
    'use strict';

    const INTERVAL_MIN = 30;
    const INTERVAL_MS  = INTERVAL_MIN * 60 * 1000;
    const DEFAULT_PORT = '오데사';
    const DEFAULT_VIEW = 'eastmed';
    const MAP_VIEWS = window.ORIGIN_MAP_VIEWS || [];

    const $ = (sel) => document.querySelector(sel);
    const mapEl      = $('#ot-map');
    const panelEl    = $('#ot-panel');
    const regListEl  = $('#ot-reg-list');
    const statusEl   = $('#ot-status');
    const viewTabsEl = $('#ot-view-tabs');
    const mapPaneEl  = document.querySelector('.ot-map-pane');

    let ports = [];
    let selectedName = null;
    let selectedViewId = DEFAULT_VIEW;
    let tickTimer = null;

    function currentMapPins() {
        if (typeof window.getOriginMapPins === 'function') {
            return window.getOriginMapPins(selectedViewId);
        }
        return window.ORIGIN_EASTMED_PORTS || [];
    }

    function currentView() {
        if (typeof window.getOriginMapView === 'function') {
            return window.getOriginMapView(selectedViewId);
        }
        return MAP_VIEWS[0] || { id: DEFAULT_VIEW, label: '동지중해·흑해', anchor: DEFAULT_PORT };
    }

    // ─── 시간 계산 ───────────────────────────────────────────────────

    function parseAnchorMs(anchorAt) {
        const t = new Date(anchorAt).getTime();
        return Number.isFinite(t) ? t : Date.now();
    }

    function getNextResetMs(anchorAt, now = Date.now()) {
        const anchor = parseAnchorMs(anchorAt);
        const elapsed = Math.max(0, now - anchor);
        const cycles = Math.floor(elapsed / INTERVAL_MS);
        return anchor + (cycles + 1) * INTERVAL_MS;
    }

    function getRemainingMs(anchorAt, now = Date.now()) {
        return getNextResetMs(anchorAt, now) - now;
    }

    function formatCountdown(ms) {
        if (ms <= 0) return '00:00';
        const totalSec = Math.ceil(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatClock(ms) {
        const d = new Date(ms);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return hh + ':' + mm + ':' + ss;
    }

    function remainingToAnchor(remainingMs, now = Date.now()) {
        const nextReset = now + remainingMs;
        return new Date(nextReset - INTERVAL_MS).toISOString();
    }

    function parseRemainingInput(value) {
        if (!value || !String(value).trim()) return null;
        const v = String(value).trim();
        if (/^\d+$/.test(v)) {
            const mins = parseInt(v, 10);
            if (mins < 0 || mins > INTERVAL_MIN) return null;
            return mins * 60 * 1000;
        }
        const m = v.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const mins = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        if (secs >= 60 || mins < 0 || mins > INTERVAL_MIN) return null;
        if (mins === INTERVAL_MIN && secs > 0) return null;
        return (mins * 60 + secs) * 1000;
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-error', !!isError);
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

    function findPortByName(name) {
        return ports.find(p => p.portName === name) || null;
    }

    // ─── 해역 선택 ───────────────────────────────────────────────────

    function renderViewTabs() {
        if (!viewTabsEl || MAP_VIEWS.length === 0) return;
        viewTabsEl.innerHTML = MAP_VIEWS.map(v => `
          <button type="button" class="ot-view-tab${v.id === selectedViewId ? ' is-active' : ''}"
            data-view-id="${escapeAttr(v.id)}">${escapeHtml(v.label)}</button>
        `).join('');
    }

    function updateNavButtons() {
        const n = typeof window.getOriginMapNeighbors === 'function'
            ? window.getOriginMapNeighbors(selectedViewId)
            : {};
        if (!mapPaneEl) return;
        mapPaneEl.querySelectorAll('.ot-nav').forEach(btn => {
            const dir = btn.dataset.nav;
            const target = n[dir] || null;
            btn.disabled = !target;
            btn.dataset.target = target || '';
            if (target) {
                const view = MAP_VIEWS.find(v => v.id === target);
                btn.title = view ? view.label : dir;
            } else {
                btn.title = '';
            }
        });
    }

    function selectView(viewId) {
        if (!viewId) return;
        selectedViewId = viewId;
        renderViewTabs();
        updateNavButtons();
        renderMap();
        const view = currentView();
        setStatus(`${view.label} · 기준 ${view.anchor || '—'}`);
    }

    function updateRegCount() {
        // no-op (등록 목록은 왼쪽 패널에 상시 표시)
    }

    // ─── 맵 ─────────────────────────────────────────────────────────

    function renderMap() {
        if (!mapEl) return;
        const now = Date.now();
        const view = currentView();
        const labelHtml = `<span class="ot-map-label">${escapeHtml(view.label)}${view.anchor ? ' · 기준 ' + escapeHtml(view.anchor) : ''}</span>`;

        const pins = currentMapPins().map(loc => {
            const tracked = findPortByName(loc.name);
            const rem = tracked ? getRemainingMs(tracked.anchorAt, now) : null;
            const ready = tracked && rem <= 1000;
            const active = selectedName === loc.name;
            const classes = [
                'ot-pin',
                tracked ? 'is-tracked' : '',
                ready ? 'is-ready' : '',
                active ? 'is-active' : '',
            ].filter(Boolean).join(' ');

            const timeHtml = tracked
                ? `<span class="ot-pin-time" data-pin-time="${escapeAttr(loc.name)}">${formatCountdown(rem)}</span>`
                : '';

            return `
              <button type="button" class="${classes}"
                style="left:${loc.x}%; top:${loc.y}%;"
                data-port-name="${escapeAttr(loc.name)}"
                aria-label="${escapeAttr(loc.name)}">
                <span class="ot-pin-marker" aria-hidden="true"></span>
                <span class="ot-pin-name">${escapeHtml(loc.name)}</span>
                ${timeHtml}
              </button>`;
        }).join('');

        mapEl.innerHTML = labelHtml + pins;
    }

    function tickMapPins() {
        const now = Date.now();
        mapEl.querySelectorAll('.ot-pin').forEach(pin => {
            const name = pin.dataset.portName;
            const tracked = findPortByName(name);
            pin.classList.toggle('is-tracked', !!tracked);
            pin.classList.toggle('is-active', selectedName === name);

            let timeEl = pin.querySelector('[data-pin-time]');
            if (!tracked) {
                pin.classList.remove('is-ready');
                if (timeEl) timeEl.remove();
                return;
            }

            const rem = getRemainingMs(tracked.anchorAt, now);
            const ready = rem <= 1000;
            pin.classList.toggle('is-ready', ready);

            if (!timeEl) {
                timeEl = document.createElement('span');
                timeEl.className = 'ot-pin-time';
                timeEl.dataset.pinTime = name;
                pin.appendChild(timeEl);
            }
            timeEl.textContent = formatCountdown(rem);
        });
    }

    // ─── 등록 목록 ───────────────────────────────────────────────────

    function renderRegList() {
        if (!regListEl) return;
        const now = Date.now();
        updateRegCount();

        if (ports.length === 0) {
            regListEl.innerHTML = '<li style="color:var(--text);font-size:0.85rem;padding:0.25rem;">없음</li>';
            return;
        }

        const sorted = ports.slice().sort((a, b) =>
            getRemainingMs(a.anchorAt, now) - getRemainingMs(b.anchorAt, now)
        );

        regListEl.innerHTML = sorted.map(port => {
            const rem = getRemainingMs(port.anchorAt, now);
            const ready = rem <= 1000;
            const active = selectedName === port.portName;
            return `
              <li>
                <button type="button"
                  class="ot-reg-item${ready ? ' is-ready' : ''}${active ? ' is-active' : ''}"
                  data-port-name="${escapeAttr(port.portName)}">
                  <span>${escapeHtml(port.portName)}</span>
                  <span class="ot-reg-time" data-reg-time="${escapeAttr(port.id)}">${formatCountdown(rem)}</span>
                </button>
              </li>`;
        }).join('');
    }

    function tickRegList() {
        const now = Date.now();
        regListEl.querySelectorAll('.ot-reg-item').forEach(btn => {
            const port = findPortByName(btn.dataset.portName);
            if (!port) return;
            const rem = getRemainingMs(port.anchorAt, now);
            const ready = rem <= 1000;
            btn.classList.toggle('is-ready', ready);
            btn.classList.toggle('is-active', selectedName === port.portName);
            const t = btn.querySelector('[data-reg-time]');
            if (t) t.textContent = formatCountdown(rem);
        });
    }

    // ─── 패널 ────────────────────────────────────────────────────────

    function renderPanel() {
        if (!panelEl) return;

        if (!selectedName) {
            panelEl.classList.remove('is-ready');
            panelEl.innerHTML = '<p class="ot-panel-empty">맵에서 항구를 선택하세요.</p>';
            return;
        }

        const tracked = findPortByName(selectedName);
        const now = Date.now();

        // 미등록 — 지금 입장
        if (!tracked) {
            panelEl.classList.remove('is-ready');
            panelEl.innerHTML = `
              <div class="ot-card-head">
                <h2 class="ot-port-name">${escapeHtml(selectedName)}</h2>
                <span class="ot-badge">미등록</span>
              </div>
              <p class="ot-field-hint" style="margin:0;">이 항구 교역소에 처음 입장한 시각을 기록합니다.</p>
              <div class="ot-actions">
                <button type="button" class="ot-btn ot-btn-primary" data-action="enter">지금 입장</button>
              </div>`;
            return;
        }

        const rem = getRemainingMs(tracked.anchorAt, now);
        const next = getNextResetMs(tracked.anchorAt, now);
        const ready = rem <= 1000;
        const remVal = formatCountdown(rem);

        panelEl.classList.toggle('is-ready', ready);
        panelEl.innerHTML = `
          <div class="ot-card-head">
            <h2 class="ot-port-name">${escapeHtml(tracked.portName)}</h2>
            <span class="ot-badge" data-role="badge">${ready ? '재고 리셋됨' : '대기중'}</span>
          </div>

          <div class="ot-countdown-row">
            <div class="ot-countdown" data-role="countdown">${remVal}</div>
            <div class="ot-meta">
              <div>다음 리셋 <strong data-role="next">${formatClock(next)}</strong></div>
              <div class="ot-hint" data-role="hint">${ready ? '구매 가능' : '후 재고 초기화'}</div>
            </div>
          </div>

          <div class="ot-field">
            <label class="ot-label" for="ot-remain-input">남은 시간 (게임 기준)</label>
            <div class="ot-field-row">
              <input type="text" id="ot-remain-input"
                class="ot-input ot-input-remaining"
                data-role="remaining"
                inputmode="numeric"
                placeholder="28:13"
                value="${escapeAttr(remVal)}"
                maxlength="5"
                autocomplete="off" />
              <button type="button" class="ot-btn ot-btn-ghost" data-action="sync">현재</button>
              <button type="button" class="ot-btn ot-btn-primary" data-action="apply">적용</button>
            </div>
            <span class="ot-field-hint">MM:SS · 0:00 = 방금 리셋, 30:00 = 방금 입장</span>
          </div>

          <div class="ot-actions">
            <button type="button" class="ot-btn ot-btn-accent" data-action="gem-reset">재화 초기화</button>
            <button type="button" class="ot-btn ot-btn-danger" data-action="delete">삭제</button>
          </div>`;
        panelEl.dataset.portId = tracked.id;
    }

    function tickPanel() {
        if (!selectedName || !panelEl) return;
        const tracked = findPortByName(selectedName);
        if (!tracked) return;

        const now = Date.now();
        const rem = getRemainingMs(tracked.anchorAt, now);
        const next = getNextResetMs(tracked.anchorAt, now);
        const ready = rem <= 1000;

        panelEl.classList.toggle('is-ready', ready);
        const cd = panelEl.querySelector('[data-role="countdown"]');
        const nx = panelEl.querySelector('[data-role="next"]');
        const badge = panelEl.querySelector('[data-role="badge"]');
        const hint = panelEl.querySelector('[data-role="hint"]');
        const remInput = panelEl.querySelector('[data-role="remaining"]');

        if (cd) cd.textContent = formatCountdown(rem);
        if (nx) nx.textContent = formatClock(next);
        if (badge) badge.textContent = ready ? '재고 리셋됨' : '대기중';
        if (hint) hint.textContent = ready ? '구매 가능' : '후 재고 초기화';

        // 입력 중이면 덮어쓰지 않음
        if (remInput && document.activeElement !== remInput) {
            remInput.value = formatCountdown(rem);
        }
    }

    function selectPort(name) {
        selectedName = name;
        renderMap();
        renderRegList();
        renderPanel();
    }

    function refreshAll() {
        renderMap();
        renderRegList();
        renderPanel();
    }

    function tickAll() {
        tickMapPins();
        tickRegList();
        tickPanel();
    }

    // ─── 데이터 ──────────────────────────────────────────────────────

    async function ensureOdessa(list) {
        const has = list.some(p => p.portName === DEFAULT_PORT);
        if (has) return list;

        await window.originDb.savePort({
            portName: DEFAULT_PORT,
            anchorAt: new Date().toISOString(),
            intervalMin: INTERVAL_MIN,
        });
        setStatus(`「${DEFAULT_PORT}」항구를 추가했습니다.`);
        return window.originDb.listPorts();
    }

    async function reload(keepSelection) {
        const prev = keepSelection ? selectedName : null;
        try {
            let list = await window.originDb.listPorts();
            list = await ensureOdessa(list);
            ports = list;
            if (prev) selectedName = prev;
            else if (!selectedName && findPortByName(DEFAULT_PORT)) selectedName = DEFAULT_PORT;
            refreshAll();
            if (window.originDb.isLocal) {
                setStatus('로컬 저장 모드 (Supabase 미연결 또는 테이블 미생성)', false);
            }
        } catch (err) {
            console.error('[OriginTimer] 로드 실패', err);
            setStatus('불러오기 실패: ' + (err.message || err) + ' — SQL 마이그레이션을 확인하세요.', true);
            ports = [];
            refreshAll();
        }
    }

    async function saveAnchor(id, iso) {
        const port = ports.find(p => p.id === id);
        if (!port) return;
        await window.originDb.savePort({
            ...port,
            anchorAt: iso,
            intervalMin: INTERVAL_MIN,
        });
        await reload(true);
        setStatus(`「${port.portName}」남은 시간을 반영했습니다.`);
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────

    if (viewTabsEl) {
        viewTabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view-id]');
            if (!btn) return;
            selectView(btn.dataset.viewId);
        });
    }

    if (mapPaneEl) {
        mapPaneEl.addEventListener('click', (e) => {
            const nav = e.target.closest('.ot-nav');
            if (!nav || nav.disabled) return;
            const target = nav.dataset.target;
            if (target) selectView(target);
        });
    }

    if (mapEl) {
        mapEl.addEventListener('click', (e) => {
            const pin = e.target.closest('.ot-pin');
            if (!pin) return;
            selectPort(pin.dataset.portName);
        });
    }

    if (regListEl) {
        regListEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-port-name]');
            if (!btn) return;
            selectPort(btn.dataset.portName);
        });
    }

    if (panelEl) {
        panelEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            try {
                if (action === 'enter') {
                    if (!selectedName) return;
                    btn.disabled = true;
                    await window.originDb.savePort({
                        portName: selectedName,
                        anchorAt: new Date().toISOString(),
                        intervalMin: INTERVAL_MIN,
                    });
                    await reload(true);
                    setStatus(`「${selectedName}」지금 입장으로 등록했습니다.`);
                    return;
                }

                const tracked = findPortByName(selectedName);
                if (!tracked) return;

                if (action === 'sync') {
                    const input = panelEl.querySelector('[data-role="remaining"]');
                    if (input) input.value = formatCountdown(getRemainingMs(tracked.anchorAt));
                    return;
                }

                if (action === 'apply') {
                    const input = panelEl.querySelector('[data-role="remaining"]');
                    const remainingMs = parseRemainingInput(input && input.value);
                    if (remainingMs == null) {
                        setStatus('남은 시간을 MM:SS 형식으로 입력하세요. (예: 10:30, 최대 30:00)', true);
                        return;
                    }
                    btn.disabled = true;
                    await saveAnchor(tracked.id, remainingToAnchor(remainingMs));
                    return;
                }

                if (action === 'gem-reset') {
                    if (!confirm(`「${tracked.portName}」재화로 재고를 초기화했습니까?\n30분 주기가 지금부터 다시 시작됩니다.`)) {
                        return;
                    }
                    btn.disabled = true;
                    await saveAnchor(tracked.id, new Date().toISOString());
                    setStatus(`「${tracked.portName}」재화 초기화 — 30분 주기를 지금부터 다시 시작합니다.`);
                    return;
                }

                if (action === 'delete') {
                    if (!confirm(`「${tracked.portName}」교역소 타이머를 삭제할까요?`)) return;
                    btn.disabled = true;
                    await window.originDb.deletePort(tracked.id);
                    selectedName = tracked.portName; // 맵에는 남기고 미등록 상태로
                    await reload(true);
                    setStatus(`「${tracked.portName}」타이머를 삭제했습니다.`);
                }
            } catch (err) {
                console.error(err);
                setStatus('저장 실패: ' + (err.message || err), true);
            } finally {
                btn.disabled = false;
            }
        });

        panelEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const input = e.target.closest('[data-role="remaining"]');
            if (!input) return;
            e.preventDefault();
            const applyBtn = panelEl.querySelector('[data-action="apply"]');
            if (applyBtn) applyBtn.click();
        });
    }

    // ─── 시작 ────────────────────────────────────────────────────────

    async function init() {
        if (!window.originDb) {
            setStatus('originDb가 없습니다. 스크립트 로드 순서를 확인하세요.', true);
            return;
        }
        renderViewTabs();
        selectView(selectedViewId);
        await reload(false);
        tickTimer = setInterval(tickAll, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
