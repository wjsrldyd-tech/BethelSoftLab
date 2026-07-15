// =============== origin-timer.js ===============
// 대항해시대 오리진 교역소 재고 타이머 UI
// 절대 시각(anchor_at) 기준 30분 주기 · 해역별 맵 핀

(function () {
    'use strict';

    const INTERVAL_MIN = 30;
    const INTERVAL_MS  = INTERVAL_MIN * 60 * 1000;
    const DEFAULT_PORT = '이스탄불';
    const DEFAULT_VIEW = 'eastmed';
    const MAP_VIEWS = window.ORIGIN_MAP_VIEWS || [];
    const DRAG_THRESHOLD = 4;
    const SWIPE_THRESHOLD = 48;

    const $ = (sel) => document.querySelector(sel);
    const mapEl      = $('#ot-map');
    const panelEl    = $('#ot-panel');
    const goodsCatsEl = $('#ot-goods-cats');
    const statusEl   = $('#ot-status');
    const viewTabsEl = $('#ot-view-tabs');
    const mapPaneEl  = document.querySelector('.ot-map-pane');
    const editToggleBtn = $('#ot-edit-toggle');
    const editSaveBtn   = $('#ot-edit-save');
    const editCancelBtn = $('#ot-edit-cancel');

    let ports = [];
    let selectedName = null;
    let selectedViewId = DEFAULT_VIEW;
    /** @type {string|null} */
    let selectedGoodCategory = null;
    let tickTimer = null;

    /** @type {Record<string, Record<string, {x:number,y:number}>>} */
    let pinOverrides = {};
    let editMode = false;
    /** 수정 중 작업 복사본 (저장 전) */
    let editDraft = null;
    let dragState = null;
    let swipeState = null;
    let suppressPinClick = false;
    let pinSaveInFlight = false;

    function cloneOverrides(src) {
        return JSON.parse(JSON.stringify(src || {}));
    }

    function activeOverrides() {
        return editMode && editDraft ? editDraft : pinOverrides;
    }

    function currentMapPins() {
        if (typeof window.getOriginMapPins === 'function') {
            return window.getOriginMapPins(selectedViewId);
        }
        return window.ORIGIN_EASTMED_PORTS || [];
    }

    /** 기본 좌표 + (저장된/편집 중) 오버라이드 */
    function displayPins() {
        const base = currentMapPins();
        const ov = activeOverrides()[selectedViewId] || {};
        return base.map(loc => {
            const o = ov[loc.name];
            if (!o) return loc;
            return { ...loc, x: o.x, y: o.y };
        });
    }

    function setPinOverride(viewId, name, x, y) {
        const target = editMode ? editDraft : pinOverrides;
        if (!target[viewId]) target[viewId] = {};
        target[viewId][name] = {
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
        };
    }

    function currentView() {
        if (typeof window.getOriginMapView === 'function') {
            return window.getOriginMapView(selectedViewId);
        }
        return MAP_VIEWS[0] || { id: DEFAULT_VIEW, label: '지중해,흑해', anchor: DEFAULT_PORT };
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

    function formatSyncedAt(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (!Number.isFinite(d.getTime())) return '';
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
            + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    /** 이전 맞춤 → 지금 맞춤 간격(분) + 새 syncedAt */
    function buildSyncStamp(prevSyncedAt, now = Date.now()) {
        const syncedAt = new Date(now).toISOString();
        let syncedElapsedMin = null;
        if (prevSyncedAt) {
            const prev = new Date(prevSyncedAt).getTime();
            if (Number.isFinite(prev) && now >= prev) {
                syncedElapsedMin = Math.floor((now - prev) / 60000);
            }
        }
        return { syncedAt, syncedElapsedMin };
    }

    function formatSyncLine(syncedAt, syncedElapsedMin) {
        const when = formatSyncedAt(syncedAt);
        if (!when) return '맞춤 시각 없음';
        const elapsed = (syncedElapsedMin != null && Number.isFinite(syncedElapsedMin))
            ? `${syncedElapsedMin}분`
            : '—';
        return `${when} | 경과 ${elapsed}`;
    }

    function remainingToAnchor(remainingMs, now = Date.now()) {
        const nextReset = now + remainingMs;
        return new Date(nextReset - INTERVAL_MS).toISOString();
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

    /** 방문(매진) 표시가 유지되는 시각 — 다음 30분 리셋 시각 */
    function soldOutUntilMs(port) {
        if (!port || !port.soldOut) return 0;
        const markedAt = port.soldOutAt ? parseAnchorMs(port.soldOutAt) : Date.now();
        let until = getNextResetMs(port.anchorAt, markedAt);
        // 리셋 직전·직후 방문이면 다음 주기까지 매진 유지
        if (until - markedAt <= 2000) until += INTERVAL_MS;
        return until;
    }

    function isSoldOut(port, now = Date.now()) {
        if (!port || !port.soldOut) return false;
        return now < soldOutUntilMs(port);
    }

    let soldOutFlushInFlight = false;

    /** 리셋 시각이 지난 매진 표시를 DB에서 해제 */
    async function flushExpiredSoldOut() {
        if (soldOutFlushInFlight) return;
        const now = Date.now();
        const expired = ports.filter(p => p.soldOut && !isSoldOut(p, now));
        if (!expired.length) return;

        soldOutFlushInFlight = true;
        try {
            for (const port of expired) {
                await window.originDb.savePort({
                    ...port,
                    soldOut: false,
                    soldOutAt: null,
                    intervalMin: INTERVAL_MIN,
                });
                port.soldOut = false;
                port.soldOutAt = null;
            }
            refreshAll();
        } catch (err) {
            console.error('[OriginTimer] 매진 해제 실패', err);
        } finally {
            soldOutFlushInFlight = false;
        }
    }

    // ─── 해역 선택 ───────────────────────────────────────────────────

    function renderViewTabs() {
        if (!viewTabsEl || MAP_VIEWS.length === 0) return;
        viewTabsEl.innerHTML = MAP_VIEWS.map(v => `
          <button type="button" class="ot-view-tab${v.id === selectedViewId ? ' is-active' : ''}"
            data-view-id="${escapeAttr(v.id)}">${escapeHtml(v.label)}</button>
        `).join('');
    }

    function selectView(viewId) {
        if (!viewId) return;
        selectedViewId = viewId;
        renderViewTabs();
        renderMap();
        const view = currentView();
        setStatus(selectedGoodCategory
            ? `「${selectedGoodCategory}」 — ${view.label || ''}`
            : (view.label || ''));
    }

    function neighborFor(dir) {
        const n = typeof window.getOriginMapNeighbors === 'function'
            ? window.getOriginMapNeighbors(selectedViewId)
            : {};
        return n[dir] || null;
    }

    /** 손가락 방향 → 이동할 해역 (왼쪽 스와이프 = 동쪽 등) */
    function dirFromSwipe(dx, dy) {
        if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return null;
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx < 0 ? 'right' : 'left';
        }
        return dy < 0 ? 'down' : 'up';
    }

    function navigateBySwipe(dx, dy) {
        const dir = dirFromSwipe(dx, dy);
        if (!dir) return false;
        const target = neighborFor(dir);
        if (!target) return false;
        selectView(target);
        return true;
    }

    // ─── 맵 ─────────────────────────────────────────────────────────

    function mapCanvasEl() {
        return (mapEl && mapEl.querySelector('.ot-map-canvas')) || mapEl;
    }

    function renderMap() {
        if (!mapEl) return;
        const now = Date.now();
        const view = currentView();
        const hasImage = !!(view.image);
        const filterOn = !!(selectedGoodCategory && !editMode);

        const pins = displayPins().map(loc => {
            const goods = filterOn && typeof window.getOriginPortGoods === 'function'
                ? window.getOriginPortGoods(loc.name, selectedGoodCategory)
                : [];
            const hasGoods = goods.length > 0;

            // 분류 필터 ON → 해당 품목 있는 항구만 표시
            if (filterOn && !hasGoods) return '';

            const tracked = findPortByName(loc.name);
            const rem = tracked ? getRemainingMs(tracked.anchorAt, now) : null;
            const ready = tracked && rem <= 1000;
            const sold = tracked && isSoldOut(tracked, now);
            const active = selectedName === loc.name;
            const classes = [
                'ot-pin',
                tracked ? 'is-tracked' : '',
                sold ? 'is-sold-out' : '',
                ready && !sold ? 'is-ready' : '',
                active ? 'is-active' : '',
                filterOn ? 'is-goods-focus' : '',
                hasGoods ? 'has-goods' : '',
            ].filter(Boolean).join(' ');

            // 필터 OFF: 이름 + 타이머 / 필터 ON: 이름|타이머 + 아래 품목
            const timeHtml = tracked
                ? `<span class="ot-pin-time" data-pin-time="${escapeAttr(loc.name)}">${formatCountdown(rem)}</span>`
                : '';

            const goodsHtml = hasGoods
                ? `<span class="ot-pin-goods">${goods.map(g => `
                    <span class="ot-pin-good${g.specialty ? ' is-specialty' : ''}">${escapeHtml(g.name)}</span>
                  `).join('')}</span>`
                : '';

            const labelHtml = filterOn
                ? `<span class="ot-pin-head">
                    <span class="ot-pin-name">${escapeHtml(loc.name)}</span>
                    ${timeHtml}
                  </span>${goodsHtml}`
                : `<span class="ot-pin-name">${escapeHtml(loc.name)}</span>${timeHtml}`;

            return `
              <button type="button" class="${classes}"
                style="left:${loc.x}%; top:${loc.y}%;"
                data-port-name="${escapeAttr(loc.name)}"
                aria-label="${escapeAttr(loc.name)}">
                <span class="ot-pin-marker" aria-hidden="true"></span>
                ${labelHtml}
              </button>`;
        }).join('');

        const canvasStyle = [];
        if (hasImage) {
            const ar = view.imageAspect || (16 / 9);
            canvasStyle.push(`--map-ar:${ar}`);
            canvasStyle.push(`background-image:url('${escapeAttr(view.image)}?v=${escapeAttr(String(view.imageVersion || '1'))}')`);
        }

        mapEl.classList.toggle('has-image', hasImage);
        mapEl.classList.toggle('is-edit-mode', editMode);
        mapEl.classList.toggle('is-goods-filter', filterOn);
        mapEl.innerHTML = `
          <div class="ot-map-canvas" style="${canvasStyle.join(';')}">${pins}</div>
        `;
        if (mapPaneEl) mapPaneEl.classList.toggle('is-edit-mode', editMode);
    }

    function updateEditChrome() {
        if (editToggleBtn) {
            editToggleBtn.classList.toggle('is-active', editMode);
            editToggleBtn.setAttribute('aria-pressed', editMode ? 'true' : 'false');
            editToggleBtn.hidden = editMode;
        }
        if (editSaveBtn) editSaveBtn.hidden = !editMode;
        if (editCancelBtn) editCancelBtn.hidden = !editMode;
        if (mapEl) mapEl.classList.toggle('is-edit-mode', editMode);
        if (mapPaneEl) mapPaneEl.classList.toggle('is-edit-mode', editMode);
    }

    function enterEditMode() {
        if (editMode) return;
        editMode = true;
        swipeState = null;
        editDraft = cloneOverrides(pinOverrides);
        updateEditChrome();
        renderMap();
        setStatus('위치 수정 모드 — 핀을 드래그한 뒤 저장하세요.');
    }

    async function exitEditMode(save) {
        if (!editMode) return;
        if (save) {
            if (pinSaveInFlight) return;
            pinSaveInFlight = true;
            if (editSaveBtn) editSaveBtn.disabled = true;
            try {
                pinOverrides = cloneOverrides(editDraft);
                await window.originDb.savePinOverrides(pinOverrides);
                setStatus(window.originDb.isLocal
                    ? '핀 위치를 로컬에 저장했습니다.'
                    : '핀 위치를 DB에 저장했습니다.');
            } catch (err) {
                console.error('[OriginTimer] 핀 저장 실패', err);
                setStatus('핀 저장 실패: ' + (err.message || err) + ' — SQL 마이그레이션을 확인하세요.', true);
                if (editSaveBtn) editSaveBtn.disabled = false;
                pinSaveInFlight = false;
                return;
            }
            pinSaveInFlight = false;
            if (editSaveBtn) editSaveBtn.disabled = false;
        } else {
            setStatus('위치 수정을 취소했습니다.');
        }
        editMode = false;
        editDraft = null;
        dragState = null;
        updateEditChrome();
        renderMap();
        tickMapPins();
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
                pin.classList.remove('is-ready', 'is-sold-out');
                if (timeEl) timeEl.remove();
                return;
            }

            const rem = getRemainingMs(tracked.anchorAt, now);
            const sold = isSoldOut(tracked, now);
            const ready = rem <= 1000;
            pin.classList.toggle('is-sold-out', sold);
            pin.classList.toggle('is-ready', ready && !sold);

            if (!timeEl) {
                timeEl = document.createElement('span');
                timeEl.className = 'ot-pin-time';
                timeEl.dataset.pinTime = name;
                const head = pin.querySelector('.ot-pin-head');
                if (head) head.appendChild(timeEl);
                else pin.appendChild(timeEl);
            }
            timeEl.textContent = formatCountdown(rem);
        });
    }

    // ─── 패널 ────────────────────────────────────────────────────────

    function renderPanel() {
        if (!panelEl) return;

        if (!selectedName) {
            panelEl.classList.remove('is-ready', 'is-sold-out');
            panelEl.innerHTML = '<p class="ot-panel-empty">맵에서 항구를 선택하세요.</p>';
            return;
        }

        const tracked = findPortByName(selectedName);
        const now = Date.now();

        // 미등록 — 지금 입장
        if (!tracked) {
            panelEl.classList.remove('is-ready', 'is-sold-out');
            panelEl.innerHTML = `
              <div class="ot-card-head">
                <h2 class="ot-port-name">${escapeHtml(selectedName)}</h2>
                <span class="ot-badge">미등록</span>
              </div>
              <div class="ot-actions">
                <button type="button" class="ot-btn ot-btn-primary" data-action="enter">지금 입장</button>
              </div>`;
            return;
        }

        const rem = getRemainingMs(tracked.anchorAt, now);
        const sold = isSoldOut(tracked, now);
        const ready = rem <= 1000;
        const remVal = formatCountdown(rem);
        const syncLine = formatSyncLine(tracked.syncedAt, tracked.syncedElapsedMin);
        const totalSec = Math.max(0, Math.ceil(rem / 1000));
        const curMin = Math.min(INTERVAL_MIN, Math.floor(totalSec / 60));
        const minOptions = Array.from({ length: INTERVAL_MIN + 1 }, (_, m) =>
            `<option value="${m}"${m === curMin ? ' selected' : ''}>${m}</option>`
        ).join('');
        const secButtons = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(s =>
            `<button type="button" class="ot-sec-btn" data-action="set-sec" data-sec="${s}">${String(s).padStart(2, '0')}</button>`
        ).join('');

        panelEl.classList.toggle('is-ready', ready && !sold);
        panelEl.classList.toggle('is-sold-out', sold);
        panelEl.innerHTML = `
          <div class="ot-card-head">
            <h2 class="ot-port-name">${escapeHtml(tracked.portName)}</h2>
            <div class="ot-head-actions">
              <button type="button" class="ot-btn ot-btn-accent" data-action="gem-reset">초기화</button>
              <button type="button" class="ot-btn ot-btn-danger" data-action="delete">삭제</button>
            </div>
          </div>

          <div class="ot-countdown-row">
            <div class="ot-countdown" data-role="countdown">${remVal}</div>
            <label class="ot-min-row">
              <span class="ot-label">분</span>
              <select class="ot-select ot-min-select" data-role="remain-min" aria-label="남은 분">${minOptions}</select>
            </label>
          </div>
          <p class="ot-synced-at" data-role="synced-at">${escapeHtml(syncLine)}</p>

          <div class="ot-remain-edit">
            <div class="ot-sec-grid" role="group" aria-label="남은 초">${secButtons}</div>
          </div>

          <div class="ot-actions">
            <button type="button" class="ot-btn ot-btn-visit${sold ? ' is-on' : ''}"
              data-action="visit"
              aria-pressed="${sold ? 'true' : 'false'}">${sold ? '상점 구매 취소' : '상점 구매'}</button>
          </div>`;
        panelEl.dataset.portId = tracked.id;
    }

    function renderGoodsCategories() {
        if (!goodsCatsEl) return;
        const cats = window.ORIGIN_GOOD_CATEGORIES || [];
        goodsCatsEl.innerHTML = cats.map(cat => `
          <button type="button" class="ot-cat-btn${cat === selectedGoodCategory ? ' is-active' : ''}"
            data-category="${escapeAttr(cat)}" aria-pressed="${cat === selectedGoodCategory ? 'true' : 'false'}">${escapeHtml(cat)}</button>
        `).join('');
    }

    function selectGoodCategory(category) {
        selectedGoodCategory = selectedGoodCategory === category ? null : category;
        renderGoodsCategories();
        renderMap();
        setStatus(selectedGoodCategory
            ? `「${selectedGoodCategory}」 — 맵에서 해당 항구를 확인하세요.`
            : (currentView().label || ''));
    }

    function tickPanel() {
        if (!selectedName || !panelEl) return;
        const tracked = findPortByName(selectedName);
        if (!tracked) return;

        const now = Date.now();
        const rem = getRemainingMs(tracked.anchorAt, now);
        const sold = isSoldOut(tracked, now);
        const ready = rem <= 1000;

        panelEl.classList.toggle('is-ready', ready && !sold);
        panelEl.classList.toggle('is-sold-out', sold);
        const cd = panelEl.querySelector('[data-role="countdown"]');
        const minSel = panelEl.querySelector('[data-role="remain-min"]');
        const visitBtn = panelEl.querySelector('[data-action="visit"]');

        if (cd) cd.textContent = formatCountdown(rem);
        if (visitBtn) {
            visitBtn.classList.toggle('is-on', sold);
            visitBtn.setAttribute('aria-pressed', sold ? 'true' : 'false');
            visitBtn.textContent = sold ? '상점 구매 취소' : '상점 구매';
        }

        // 분 선택 중이면 덮어쓰지 않음
        if (minSel && document.activeElement !== minSel) {
            const totalSec = Math.max(0, Math.ceil(rem / 1000));
            minSel.value = String(Math.min(INTERVAL_MIN, Math.floor(totalSec / 60)));
        }
    }

    function selectPort(name) {
        selectedName = name;
        renderMap();
        renderPanel();
    }

    function refreshAll() {
        renderMap();
        renderPanel();
    }

    function tickAll() {
        flushExpiredSoldOut();
        tickMapPins();
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
            ...buildSyncStamp(null),
            soldOut: false,
            soldOutAt: null,
        });
        setStatus(`「${DEFAULT_PORT}」항구를 추가했습니다.`);
        return window.originDb.listPorts();
    }

    /** DB에 남은 구버전 항구명 → 현행 지명 */
    async function migratePortNames(list) {
        const rename = window.renameOriginPort || (n => n);
        let changed = false;
        for (const port of list) {
            const neu = rename(port.portName);
            if (neu === port.portName) continue;
            const clash = list.find(p => p.portName === neu && p.id !== port.id);
            if (clash) {
                // 신이름이 이미 있으면 구 레코드만 삭제
                await window.originDb.deletePort(port.id);
            } else {
                await window.originDb.savePort({
                    ...port,
                    portName: neu,
                    intervalMin: INTERVAL_MIN,
                });
            }
            changed = true;
        }
        if (!changed) return list;
        return window.originDb.listPorts();
    }

    async function reload(keepSelection) {
        const prev = keepSelection ? selectedName : null;
        try {
            let list = await window.originDb.listPorts();
            list = await migratePortNames(list);
            list = await ensureOdessa(list);
            ports = list.map(p => ({
                ...p,
                soldOut: !!p.soldOut,
                soldOutAt: p.soldOutAt || null,
                syncedAt: p.syncedAt || null,
                syncedElapsedMin: p.syncedElapsedMin != null ? p.syncedElapsedMin : null,
            }));
            const rename = window.renameOriginPort || (n => n);
            if (prev) selectedName = rename(prev);
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

    async function saveAnchor(id, iso, opts) {
        const port = ports.find(p => p.id === id);
        if (!port) return;
        const clearSold = opts && opts.clearSoldOut;
        const sync = buildSyncStamp(port.syncedAt);
        await window.originDb.savePort({
            ...port,
            anchorAt: iso,
            intervalMin: INTERVAL_MIN,
            syncedAt: sync.syncedAt,
            syncedElapsedMin: sync.syncedElapsedMin,
            soldOut: clearSold ? false : !!port.soldOut,
            soldOutAt: clearSold ? null : (port.soldOutAt || null),
        });
        await reload(true);
        setStatus(`「${port.portName}」남은 시간을 반영했습니다.`);
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────

    if (goodsCatsEl) {
        goodsCatsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-category]');
            if (!btn) return;
            selectGoodCategory(btn.dataset.category);
        });
    }

    if (viewTabsEl) {
        viewTabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view-id]');
            if (!btn) return;
            selectView(btn.dataset.viewId);
        });
    }

    if (mapEl) {
        mapEl.addEventListener('click', (e) => {
            if (suppressPinClick) {
                suppressPinClick = false;
                e.preventDefault();
                return;
            }
            const pin = e.target.closest('.ot-pin');
            if (!pin) return;
            selectPort(pin.dataset.portName);
        });

        mapEl.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;

            if (editMode) {
                const pin = e.target.closest('.ot-pin');
                if (!pin) return;
                e.preventDefault();
                const canvas = mapCanvasEl();
                const rect = canvas.getBoundingClientRect();
                dragState = {
                    pin,
                    pointerId: e.pointerId,
                    name: pin.dataset.portName,
                    startX: e.clientX,
                    startY: e.clientY,
                    moved: false,
                    mapW: rect.width,
                    mapH: rect.height,
                    mapLeft: rect.left,
                    mapTop: rect.top,
                };
                try { pin.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                return;
            }

            // 일반 모드: 맵 스와이프로 해역 이동 (캡처는 임계치 이후만 — 핀 클릭 유지)
            const pin = e.target.closest('.ot-pin');
            swipeState = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
                pinName: pin ? pin.dataset.portName : null,
            };
        });

        mapEl.addEventListener('pointermove', (e) => {
            if (editMode) {
                if (!dragState || e.pointerId !== dragState.pointerId) return;
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
                dragState.moved = true;
                dragState.pin.classList.add('is-dragging');

                const x = ((e.clientX - dragState.mapLeft) / dragState.mapW) * 100;
                const y = ((e.clientY - dragState.mapTop) / dragState.mapH) * 100;
                const clampedX = Math.min(98, Math.max(2, x));
                const clampedY = Math.min(98, Math.max(2, y));
                dragState.pin.style.left = clampedX + '%';
                dragState.pin.style.top = clampedY + '%';
                setPinOverride(selectedViewId, dragState.name, clampedX, clampedY);
                return;
            }

            if (!swipeState || e.pointerId !== swipeState.pointerId) return;
            const dx = e.clientX - swipeState.startX;
            const dy = e.clientY - swipeState.startY;
            if (!swipeState.moved && Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
                swipeState.moved = true;
                try { mapEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            }
        });

        function endDrag(e) {
            if (editMode) {
                if (!dragState || e.pointerId !== dragState.pointerId) return;
                const { pin, moved, name } = dragState;
                pin.classList.remove('is-dragging');
                try { pin.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                dragState = null;
                if (moved) {
                    suppressPinClick = true;
                    selectPort(name);
                    setStatus(`「${name}」위치 이동 — 저장을 누르면 반영됩니다.`);
                }
                return;
            }

            if (!swipeState || e.pointerId !== swipeState.pointerId) return;
            const dx = e.clientX - swipeState.startX;
            const dy = e.clientY - swipeState.startY;
            const moved = swipeState.moved;
            const pinName = swipeState.pinName;
            if (moved) {
                try { mapEl.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            }
            swipeState = null;

            if (moved) {
                if (navigateBySwipe(dx, dy)) suppressPinClick = true;
                return;
            }

            // 탭: capture를 쓰지 않았어도 클릭이 씹히는 경우가 있어 pointerup에서 선택
            if (pinName) {
                selectPort(pinName);
                suppressPinClick = true;
            }
        }

        mapEl.addEventListener('pointerup', endDrag);
        mapEl.addEventListener('pointercancel', endDrag);
    }

    if (editToggleBtn) {
        editToggleBtn.addEventListener('click', () => enterEditMode());
    }
    if (editSaveBtn) {
        editSaveBtn.addEventListener('click', () => { exitEditMode(true); });
    }
    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', () => { exitEditMode(false); });
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
                        ...buildSyncStamp(null),
                        soldOut: false,
                        soldOutAt: null,
                    });
                    await reload(true);
                    setStatus(`「${selectedName}」지금 입장으로 등록했습니다.`);
                    return;
                }

                const tracked = findPortByName(selectedName);
                if (!tracked) return;

                if (action === 'set-sec') {
                    const minSel = panelEl.querySelector('[data-role="remain-min"]');
                    let mins = parseInt(minSel && minSel.value, 10);
                    let secs = parseInt(btn.dataset.sec, 10);
                    if (!Number.isFinite(mins) || mins < 0) mins = 0;
                    if (!Number.isFinite(secs) || secs < 0) secs = 0;
                    if (mins > INTERVAL_MIN) mins = INTERVAL_MIN;
                    if (mins === INTERVAL_MIN && secs > 0) {
                        mins = INTERVAL_MIN;
                        secs = 0;
                    }
                    const remainingMs = (mins * 60 + secs) * 1000;
                    btn.disabled = true;
                    await saveAnchor(tracked.id, remainingToAnchor(remainingMs));
                    return;
                }

                if (action === 'visit') {
                    btn.disabled = true;
                    const turnOn = !isSoldOut(tracked);
                    await window.originDb.savePort({
                        ...tracked,
                        intervalMin: INTERVAL_MIN,
                        soldOut: turnOn,
                        soldOutAt: turnOn ? new Date().toISOString() : null,
                    });
                    await reload(true);
                    setStatus(turnOn
                        ? `「${tracked.portName}」상점 구매를 표시했습니다.`
                        : `「${tracked.portName}」상점 구매를 취소했습니다.`);
                    return;
                }

                if (action === 'gem-reset') {
                    if (!confirm(`「${tracked.portName}」재화로 재고를 초기화했습니까?\n30분 주기가 지금부터 다시 시작됩니다.`)) {
                        return;
                    }
                    btn.disabled = true;
                    await saveAnchor(tracked.id, new Date().toISOString(), { clearSoldOut: true });
                    setStatus(`「${tracked.portName}」재화 초기화 — 30분 주기를 지금부터 다시 시작합니다.`);
                    return;
                }

                if (action === 'delete') {
                    if (!confirm(`「${tracked.portName}」항구 타이머를 삭제할까요?`)) return;
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

    }

    // ─── 시작 ────────────────────────────────────────────────────────

    async function loadPinsFromDb() {
        try {
            pinOverrides = await window.originDb.loadPinOverrides();
            if (!editMode) renderMap();
        } catch (err) {
            console.error('[OriginTimer] 핀 좌표 로드 실패', err);
            pinOverrides = {};
            setStatus('핀 좌표 불러오기 실패: ' + (err.message || err) + ' — SQL 마이그레이션을 확인하세요.', true);
        }
    }

    async function init() {
        if (!window.originDb) {
            setStatus('originDb가 없습니다. 스크립트 로드 순서를 확인하세요.', true);
            return;
        }
        renderViewTabs();
        renderGoodsCategories();
        selectView(selectedViewId);
        await Promise.all([reload(false), loadPinsFromDb()]);
        tickTimer = setInterval(tickAll, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
