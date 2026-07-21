// =============== origin-timer.js ===============
// 대항해시대 오리진 교역소 재고 타이머 UI
// 절대 시각(anchor_at) 기준 30분 주기 · 해역별 맵 핀
// 게임 시계 드리프트(N분당 ~3초) + 전역 영점(초)은 표시 계산만 보정, DB anchor는 유지

(function () {
    'use strict';

    const INTERVAL_MIN = 30;
    const INTERVAL_MS  = INTERVAL_MIN * 60 * 1000;
    /** 게임 시계가 현실보다 빠름: N분당 약 3초. N은 DB 설정(driftOverMin), 기본 1200. */
    const DRIFT_AHEAD_MS = 3000;
    const DEFAULT_DRIFT_OVER_MIN = 1200;
    const OFFSET_SEC_MIN = -120;
    const OFFSET_SEC_MAX = 120;
    const LS_DRIFT_HISTORY = 'origin_drift_over_min_history_v1';
    const DRIFT_HISTORY_MAX = 10;
    let driftOverMin = DEFAULT_DRIFT_OVER_MIN;
    let driftEnabled = true;
    let globalOffsetSec = 0;
    let offsetEnabled = true;
    function driftRate() {
        if (!driftEnabled) return 0;
        const overMs = Math.max(60, driftOverMin) * 60 * 1000;
        return DRIFT_AHEAD_MS / overMs;
    }
    function getGlobalOffsetMs() {
        if (!offsetEnabled) return 0;
        return globalOffsetSec * 1000;
    }
    const DEFAULT_PORT = '이스탄불';
    const DEFAULT_VIEW = 'eastmed';
    const LS_MAP_VIEW = 'originMapViewId';
    const LS_MAP_PORT = 'originMapPortName';
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
    const settingsToggleBtn = $('#ot-settings-toggle');
    const settingsOverlay = $('#ot-settings-overlay');
    const settingsCloseBtn = $('#ot-settings-close');
    const settingsDriftInput = $('#ot-settings-drift-over');
    const settingsDriftSaveBtn = $('#ot-settings-drift-save');
    const settingsDriftEnabled = $('#ot-settings-drift-enabled');
    const settingsDriftRow = $('#ot-settings-drift-row');
    const settingsDriftHistory = $('#ot-settings-drift-history');
    const settingsOffsetEnabled = $('#ot-settings-offset-enabled');
    const settingsOffsetInput = $('#ot-settings-offset-sec');
    const settingsOffsetRow = $('#ot-settings-offset-row');
    const settingsOffsetBtns = $('#ot-settings-offset-btns');
    const settingsStatusEl = $('#ot-settings-status');
    /** 설정 오버레이: 패널 안 드래그 후 바깥에서 mouseup 시 닫힘 방지 */
    let settingsOverlayPointerDownOnBackdrop = false;

    let ports = [];
    let selectedName = null;
    let selectedViewId = DEFAULT_VIEW;
    /** @type {string[]} 선택된 교역품 분류 (명산품은 단독, 일반 분류는 OR 복수) */
    let selectedGoodCategories = [];
    let filterByName = false; // true이면 selectedGoodCategories가 이름 배열
    /** @type {string[]} 조선 티어 필터 — 항구명 목록 */
    let selectedPortNames = [];
    let filterByPort = false;
    /** @type {string} 단일 라벨 (티어 1개) */
    let portFilterPinLabel = '';
    /** @type {Record<string, string[]>|null} 항구별 티어 라벨 목록 */
    let portFilterPinLabels = null;
    /** @type {Record<string, Record<string, number>>} portName -> goodName -> plainQty */
    let goodQtyCache = {};
    let goodQtyCacheLoaded = false;
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

    /** 현재 해역·선택 항구 — 새로고침 복원용 (로컬만) */
    function saveMapUiState() {
        try {
            if (selectedViewId) localStorage.setItem(LS_MAP_VIEW, selectedViewId);
            if (selectedName) localStorage.setItem(LS_MAP_PORT, selectedName);
        } catch (_) { /* ignore */ }
    }

    function loadMapUiState() {
        try {
            const viewId = localStorage.getItem(LS_MAP_VIEW);
            if (viewId && MAP_VIEWS.some(v => v.id === viewId)) {
                selectedViewId = viewId;
            }
            const portName = localStorage.getItem(LS_MAP_PORT);
            if (portName) {
                const rename = window.renameOriginPort || (n => n);
                selectedName = rename(portName) || portName;
            }
        } catch (_) { /* ignore */ }
    }

    // ─── 시간 계산 ───────────────────────────────────────────────────

    function parseAnchorMs(anchorAt) {
        const t = new Date(anchorAt).getTime();
        return Number.isFinite(t) ? t : Date.now();
    }

    /** 기준 이후 현실 경과에 따른 게임 시계 앞섬(ms). anchor 저장값은 수정하지 않음. */
    function getDriftMs(elapsedMs) {
        return Math.max(0, elapsedMs) * driftRate();
    }

    /**
     * 다음 리셋 절대 시각(현실 시계).
     * 게임은 driftRate만큼 빠르므로, 같은 anchor로도 리셋이 조금 더 일찍 온다.
     */
    function getNextResetMs(anchorAt, now = Date.now()) {
        const anchor = parseAnchorMs(anchorAt);
        const elapsed = Math.max(0, now - anchor);
        const rate = driftRate();
        const gameElapsed = elapsed + getDriftMs(elapsed);
        const cycles = Math.floor(gameElapsed / INTERVAL_MS);
        const nextBoundaryGame = (cycles + 1) * INTERVAL_MS;
        // 게임 경과 → 현실 경과로 환산 (게임 = 현실 × (1 + rate))
        const realElapsedAtNext = nextBoundaryGame / (1 + rate);
        return anchor + realElapsedAtNext + getGlobalOffsetMs();
    }

    function getRemainingMs(anchorAt, now = Date.now()) {
        return Math.max(0, getNextResetMs(anchorAt, now) - now);
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
        // 수동 입력된 시간은 이미 보정된(최종) 시간이므로 anchor 저장 시 globalOffset을 빼서 저장
        return new Date(nextReset - INTERVAL_MS - getGlobalOffsetMs()).toISOString();
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

    /** 현실 한국 날짜 키 YYYY-MM-DD (KST) */
    function kstDateKey(ms = Date.now()) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(ms));
    }

    /** 도구점 구매: 현실 KST 같은 날이면 유효, 자정 지나면 해제 */
    function isToolShopBought(port, now = Date.now()) {
        if (!port || !port.toolShopBought) return false;
        const at = port.toolShopBoughtAt ? parseAnchorMs(port.toolShopBoughtAt) : NaN;
        if (!Number.isFinite(at)) return false;
        return kstDateKey(at) === kstDateKey(now);
    }

    /** 현실 KST 기준 해당 주의 월요일(YYYY-MM-DD) */
    function kstMondayWeekKey(ms) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
        }).formatToParts(new Date(ms));
        const get = (t) => {
            const p = parts.find(x => x.type === t);
            return p ? p.value : '';
        };
        const y = parseInt(get('year'), 10);
        const m = parseInt(get('month'), 10);
        const d = parseInt(get('day'), 10);
        const wd = get('weekday'); // Sun Mon Tue ...
        const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const dayIdx = wdMap[wd] != null ? wdMap[wd] : 1;
        // 월요일=0 으로 보정 (일요일이면 6일 전)
        const daysFromMon = (dayIdx + 6) % 7;
        const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
        const mon = new Date(noonUtc - daysFromMon * 24 * 60 * 60 * 1000);
        const yy = mon.getUTCFullYear();
        const mm = String(mon.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(mon.getUTCDate()).padStart(2, '0');
        return yy + '-' + mm + '-' + dd;
    }

    /** 조선소 구매: 현실 KST 같은 주(월~일)면 유효, 다음 월요일 00:00 지나면 해제 */
    function isShipyardBought(port, now = Date.now()) {
        if (!port || !port.shipyardBought) return false;
        const at = port.shipyardBoughtAt ? parseAnchorMs(port.shipyardBoughtAt) : NaN;
        if (!Number.isFinite(at)) return false;
        return kstMondayWeekKey(at) === kstMondayWeekKey(now);
    }

    /** 다음 월요일 KST 00:00까지 남은 시간 문구 */
    window.getOriginShipyardResetLabel = function (now = Date.now()) {
        const weekKey = kstMondayWeekKey(now);
        // weekKey = 이번 주 월요일. 다음 리셋 = 다음 월요일 00:00 KST
        const [y, m, d] = weekKey.split('-').map(n => parseInt(n, 10));
        // KST 월요일 00:00 = UTC 일요일 15:00 (UTC+9)
        const thisMonKstUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
        let nextReset = thisMonKstUtc + 7 * 24 * 60 * 60 * 1000;
        if (now >= nextReset) nextReset += 7 * 24 * 60 * 60 * 1000;
        // 이번 주 월요일이 이미 지났으면 nextReset이 맞고,
        // 아직 이번 주 월요일이면… wait: weekKey is THIS week's Monday.
        // Reset happens at NEXT Monday 00:00 = thisMon + 7 days.
        // If now is Tuesday, next reset is next Monday = thisMon + 7. Good.
        // If now is Sunday before week rolls... weekKey is still this week's Monday (daysFromMon handles it).
        // Actually if today is Sunday, dayIdx=0, daysFromMon=6, so Monday is 6 days ago = previous Monday. Next reset = that Monday + 7 = tomorrow Monday? 
        // Sunday: previous Monday + 7 days = this coming Monday. Correct!
        
        const rem = Math.max(0, nextReset - now);
        const totalMin = Math.floor(rem / 60000);
        const days = Math.floor(totalMin / (60 * 24));
        const hours = Math.floor((totalMin % (60 * 24)) / 60);
        const mins = totalMin % 60;
        const parts = [];
        if (days > 0) parts.push(days + '일');
        if (hours > 0 || days > 0) parts.push(hours + '시간');
        parts.push(mins + '분');
        return '다음 리셋까지 ' + parts.join(' ') + ' (월 00:00 KST)';
    };

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

    let toolShopFlushInFlight = false;

    /** KST 자정이 지난 도구점 구매 표시를 DB에서 해제 */
    async function flushExpiredToolShop() {
        if (toolShopFlushInFlight) return;
        const now = Date.now();
        const expired = ports.filter(p => p.toolShopBought && !isToolShopBought(p, now));
        if (!expired.length) return;

        toolShopFlushInFlight = true;
        try {
            for (const port of expired) {
                await window.originDb.savePort({
                    ...port,
                    toolShopBought: false,
                    toolShopBoughtAt: null,
                    intervalMin: INTERVAL_MIN,
                });
                port.toolShopBought = false;
                port.toolShopBoughtAt = null;
            }
            refreshAll();
        } catch (err) {
            console.error('[OriginTimer] 도구점 해제 실패', err);
        } finally {
            toolShopFlushInFlight = false;
        }
    }

    let shipyardFlushInFlight = false;

    /** KST 월요일 00:00이 지난 조선소 구매 표시를 DB에서 해제 */
    async function flushExpiredShipyard() {
        if (shipyardFlushInFlight) return;
        const now = Date.now();
        const expired = ports.filter(p => p.shipyardBought && !isShipyardBought(p, now));
        if (!expired.length) return;

        shipyardFlushInFlight = true;
        try {
            for (const port of expired) {
                await window.originDb.savePort({
                    ...port,
                    shipyardBought: false,
                    shipyardBoughtAt: null,
                    intervalMin: INTERVAL_MIN,
                });
                port.shipyardBought = false;
                port.shipyardBoughtAt = null;
            }
            refreshAll();
        } catch (err) {
            console.error('[OriginTimer] 조선소 해제 실패', err);
        } finally {
            shipyardFlushInFlight = false;
        }
    }

    // ─── 해역 선택 ───────────────────────────────────────────────────

    function viewHasMatchingPorts(viewId) {
        const pins = typeof window.getOriginMapPins === 'function'
            ? window.getOriginMapPins(viewId)
            : [];
        if (filterByPort && selectedPortNames.length) {
            const set = new Set(selectedPortNames);
            return pins.some(pin => set.has(pin.name));
        }
        if (!selectedGoodCategories.length || typeof window.getOriginPortGoods !== 'function') return false;
        for (const pin of pins) {
            const goods = window.getOriginPortGoods(pin.name, selectedGoodCategories, { byName: filterByName });
            if (goods.length) return true;
        }
        return false;
    }

    function renderViewTabs() {
        if (!viewTabsEl || MAP_VIEWS.length === 0) return;
        const filterOn = !!((selectedGoodCategories.length || selectedPortNames.length) && !editMode);

        viewTabsEl.innerHTML = MAP_VIEWS.map(v => {
            const hasMatch = filterOn && viewHasMatchingPorts(v.id);
            const classes = [
                'ot-view-tab',
                v.id === selectedViewId ? 'is-active' : '',
                hasMatch ? 'has-goods' : '',
                filterOn && !hasMatch ? 'is-dim' : '',
            ].filter(Boolean).join(' ');
            const ariaExtra = hasMatch ? ' · 재료 있음' : (filterOn ? ' · 재료 없음' : '');
            return `
          <button type="button" class="${classes}"
            data-view-id="${escapeAttr(v.id)}"
            aria-label="${escapeAttr(v.label + ariaExtra)}">${escapeHtml(v.label)}</button>`;
        }).join('');
    }

    function selectedCategoriesLabel() {
        if (!selectedGoodCategories.length) return '';
        return selectedGoodCategories.join(', ');
    }

    function isSpecialCategory(cat) {
        const specials = window.ORIGIN_SPECIAL_CATEGORIES || ['명산품'];
        return specials.indexOf(cat) !== -1;
    }

    function selectView(viewId) {
        if (!viewId) return;
        selectedViewId = viewId;
        saveMapUiState();
        renderViewTabs();
        renderMap();
        const view = currentView();
        const label = selectedCategoriesLabel();
        setStatus(label
            ? `「${label}」 — ${view.label || ''}`
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

    /** 조선 재료가 있는 항구명 Set */
    function getShipyardPortSet() {
        const set = new Set();
        const tiers = window.ORIGIN_SHIPYARD_TIERS || [];
        for (const t of tiers) {
            for (const p of (t.ports || [])) set.add(p);
        }
        return set;
    }

    /** 항구명 뒤 조 뱃지 — 재료 항구만. 구매 후 is-bought(주황) */
    function shipyardBadgeHtml(portName, bought) {
        if (!getShipyardPortSet().has(portName)) return '';
        const on = !!bought;
        return `<span class="ot-pin-badge ot-pin-badge-jo${on ? ' is-bought' : ''}" data-pin-jo`
            + ` title="${on ? '조선소 구매함' : '조선소 재료'}"`
            + ` aria-label="${on ? '조선소 구매함' : '조선소 재료'}">조</span>`;
    }

    function pinNameHtml(portName, shipyardBought) {
        return `<span class="ot-pin-name">${escapeHtml(portName)}${shipyardBadgeHtml(portName, shipyardBought)}</span>`;
    }

    function renderMap() {
        if (!mapEl) return;
        const now = Date.now();
        const view = currentView();
        const hasImage = !!(view.image);
        const goodsFilterOn = !!(selectedGoodCategories.length && !editMode);
        const portFilterOn = !!(filterByPort && selectedPortNames.length && !editMode);
        const filterOn = goodsFilterOn || portFilterOn;
        const portNameSet = portFilterOn ? new Set(selectedPortNames) : null;

        const pins = displayPins().map(loc => {
            const goods = goodsFilterOn && typeof window.getOriginPortGoods === 'function'
                ? window.getOriginPortGoods(loc.name, selectedGoodCategories, { byName: filterByName })
                : [];
            const hasGoods = goods.length > 0;
            const hasPortMatch = !!(portNameSet && portNameSet.has(loc.name));

            // 분류/조선 필터 ON → 해당 항구만 표시
            if (goodsFilterOn && !hasGoods) return '';
            if (portFilterOn && !hasPortMatch) return '';

            const tracked = findPortByName(loc.name);
            const rem = tracked ? getRemainingMs(tracked.anchorAt, now) : null;
            const ready = tracked && rem <= 1000;
            const sold = tracked && isSoldOut(tracked, now);
            const toolShop = tracked && isToolShopBought(tracked, now);
            const shipyard = tracked && isShipyardBought(tracked, now);
            const active = selectedName === loc.name;
            const classes = [
                'ot-pin',
                tracked ? 'is-tracked' : '',
                sold ? 'is-sold-out' : '',
                ready && !sold ? 'is-ready' : '',
                toolShop ? 'is-tool-shop' : '',
                active ? 'is-active' : '',
                filterOn ? 'is-goods-focus' : '',
                (hasGoods || hasPortMatch) ? 'has-goods' : '',
            ].filter(Boolean).join(' ');

            const timeHtml = tracked
                ? `<span class="ot-pin-time" data-pin-time="${escapeAttr(loc.name)}">${formatCountdown(rem)}</span>`
                : '';

            let extraHtml = '';
            if (hasGoods) {
                extraHtml = `<span class="ot-pin-goods">${goods.map(g => pinGoodHtml(loc.name, g)).join('')}</span>`;
            } else if (hasPortMatch) {
                const labels = (portFilterPinLabels && portFilterPinLabels[loc.name])
                    || (portFilterPinLabel ? [portFilterPinLabel] : []);
                if (labels.length) {
                    extraHtml = `<span class="ot-pin-goods">${labels.map(lb =>
                        `<span class="ot-pin-good is-shipyard-mat">${escapeHtml(lb)}</span>`
                    ).join('')}</span>`;
                }
            }

            const nameHtml = pinNameHtml(loc.name, shipyard);
            const labelHtml = filterOn
                ? `<span class="ot-pin-head">
                    ${nameHtml}
                    ${timeHtml}
                  </span>${extraHtml}`
                : `${nameHtml}${timeHtml}`;

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
                pin.classList.remove('is-ready', 'is-sold-out', 'is-tool-shop');
                const jo = pin.querySelector('[data-pin-jo]');
                if (jo) {
                    jo.classList.remove('is-bought');
                    jo.title = '조선소 재료';
                    jo.setAttribute('aria-label', '조선소 재료');
                }
                if (timeEl) timeEl.remove();
                return;
            }

            const rem = getRemainingMs(tracked.anchorAt, now);
            const sold = isSoldOut(tracked, now);
            const ready = rem <= 1000;
            const toolShop = isToolShopBought(tracked, now);
            const shipyard = isShipyardBought(tracked, now);
            pin.classList.toggle('is-sold-out', sold);
            pin.classList.toggle('is-ready', ready && !sold);
            pin.classList.toggle('is-tool-shop', toolShop);

            const jo = pin.querySelector('[data-pin-jo]');
            if (jo) {
                jo.classList.toggle('is-bought', shipyard);
                jo.title = shipyard ? '조선소 구매함' : '조선소 재료';
                jo.setAttribute('aria-label', shipyard ? '조선소 구매함' : '조선소 재료');
            }

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

    function getSelectedMonth() {
        const m = parseInt(localStorage.getItem('originBarterMonth') || '', 10);
        if (m >= 1 && m <= 12) return m;
        return 1;
    }

    /** KST 09:00 게임일이 바뀌면 저장 월 +1 (현실 달력으로 덮지 않음) */
    function syncGameMonthIfNeeded() {
        if (typeof window.advanceOriginBarterMonthIfNeeded !== 'function') return;
        const next = window.advanceOriginBarterMonthIfNeeded();
        if (next == null) return;
        if (typeof window.originBarterOnMonthChange === 'function') {
            window.originBarterOnMonthChange(next);
        }
        if (typeof window.originGoodQtyOnMonthChange === 'function') {
            window.originGoodQtyOnMonthChange();
        }
        renderPanel();
        if (selectedGoodCategories.length) renderMap();
    }

    async function loadGoodQtyCache() {
        if (!window.originDb || typeof window.originDb.listGoodPlainQtys !== 'function') {
            goodQtyCache = {};
            goodQtyCacheLoaded = true;
            return;
        }
        try {
            const rows = await window.originDb.listGoodPlainQtys();
            const next = {};
            for (const row of (rows || [])) {
                const port = row.portName;
                const good = row.goodName;
                if (!port || !good) continue;
                if (!next[port]) next[port] = {};
                next[port][good] = Number(row.plainQty) || 0;
            }
            goodQtyCache = next;
            goodQtyCacheLoaded = true;
        } catch (err) {
            console.warn('[OriginTimer] good qty cache', err);
            goodQtyCacheLoaded = true;
        }
    }

    function formatVisibleQty(plain, mult) {
        const v = (Number(plain) || 0) * (Number(mult) || 1);
        if (!v) return '';
        // 시즌 배수(1.5/0.5) 계산 시 소수점은 반올림
        const n = Math.round(v);
        return n > 0 ? String(n) : '';
    }

    function pinGoodHtml(portName, g) {
        const month = getSelectedMonth();
        const plain = (goodQtyCache[portName] && goodQtyCache[portName][g.name]) || 0;
        const mult = (typeof window.getOriginGoodSeasonQtyMult === 'function')
            ? window.getOriginGoodSeasonQtyMult(g, month, portName)
            : 1;
        const qtyText = plain > 0 ? formatVisibleQty(plain, mult) : '';
        if (!qtyText) {
            return `<span class="ot-pin-good${g.specialty ? ' is-specialty' : ''}">${escapeHtml(g.name)}</span>`;
        }
        const status = (typeof window.getOriginGoodSeasonStatus === 'function')
            ? window.getOriginGoodSeasonStatus(g, month, portName)
            : 'plain';
        let seasonClass = '';
        let seasonTitle = '';
        if (status === 'peak') {
            seasonClass = ' is-peak';
            seasonTitle = '성수기';
        } else if (status === 'off') {
            seasonClass = ' is-off';
            seasonTitle = '비수기';
        } else {
            seasonTitle = '평시';
        }
        const qtyHtml = `<span class="ot-pin-good-qty${seasonClass}" title="${escapeAttr(seasonTitle)}">${escapeHtml(qtyText)}</span>`;
        return `<span class="ot-pin-good${g.specialty ? ' is-specialty' : ''}">${escapeHtml(g.name)}${qtyHtml}</span>`;
    }

    function monthLabel(month, portName) {
        const info = (typeof window.getOriginSeasonForMonth === 'function')
            ? window.getOriginSeasonForMonth(month, portName)
            : null;
        if (!info) return `${month}월`;
        const tag = info.activeTag || info.season || '';
        return tag ? `${month}월 (${tag})` : `${month}월`;
    }

    function setSelectedMonth(month) {
        const m = parseInt(month, 10);
        if (!(m >= 1 && m <= 12)) return;
        localStorage.setItem('originBarterMonth', String(m));
        if (typeof window.originBarterOnMonthChange === 'function') {
            window.originBarterOnMonthChange(m);
        }
        if (typeof window.originGoodQtyOnMonthChange === 'function') {
            window.originGoodQtyOnMonthChange();
        }
        renderPanel();
        if (selectedGoodCategories.length) renderMap();
    }

    function portNameHeadingHtml(portName) {
        const month = getSelectedMonth();
        const info = (typeof window.getOriginSeasonForMonth === 'function')
            ? window.getOriginSeasonForMonth(month, portName)
            : null;
        const seasonText = info && info.activeTag ? info.activeTag : '';
        const options = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return `<option value="${m}"${m === month ? ' selected' : ''}>${m}월</option>`;
        }).join('');
        const seasonHtml = seasonText
            ? `<span class="ot-season">${escapeHtml(seasonText)}</span>`
            : '';
        return `<h2 class="ot-port-name">
            <label class="ot-month-wrap" title="${escapeAttr(monthLabel(month, portName))} · 클릭하여 변경 (매일 KST 09:00에 다음 월로 자동 +1)">
              <select class="ot-month-select" data-role="month" aria-label="현재 월">${options}</select>
            </label>
            <span class="ot-month-sep" aria-hidden="true">|</span>
            <span class="ot-port-title">${escapeHtml(portName)}</span>
            ${seasonHtml}
          </h2>`;
    }

    function renderPanel() {
        if (!panelEl) return;

        if (!selectedName) {
            panelEl.classList.remove('is-ready', 'is-sold-out', 'is-untracked');
            delete panelEl.dataset.portId;
            panelEl.innerHTML = '<p class="ot-panel-empty">맵에서 항구를 선택하세요.</p>';
            return;
        }

        const tracked = findPortByName(selectedName);
        const now = Date.now();
        const untracked = !tracked;

        const rem = untracked ? 0 : getRemainingMs(tracked.anchorAt, now);
        const sold = untracked ? false : isSoldOut(tracked, now);
        const toolShop = untracked ? false : isToolShopBought(tracked, now);
        const shipyard = untracked ? false : isShipyardBought(tracked, now);
        const ready = !untracked && rem <= 1000;
        const remVal = untracked ? '--:--' : formatCountdown(rem);
        const syncLine = untracked
            ? '맞춤 시각 없음'
            : formatSyncLine(tracked.syncedAt, tracked.syncedElapsedMin);
        const totalSec = untracked ? 0 : Math.max(0, Math.ceil(rem / 1000));
        const curMin = untracked ? 0 : Math.min(INTERVAL_MIN, Math.floor(totalSec / 60));
        const minOptions = Array.from({ length: INTERVAL_MIN + 1 }, (_, m) =>
            `<option value="${m}"${m === curMin ? ' selected' : ''}>${m}</option>`
        ).join('');
        const secButtons = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(s =>
            `<button type="button" class="ot-sec-btn" data-action="set-sec" data-sec="${s}"${untracked ? ' disabled' : ''}>${String(s).padStart(2, '0')}</button>`
        ).join('');

        panelEl.classList.toggle('is-ready', ready && !sold);
        panelEl.classList.toggle('is-sold-out', sold);
        panelEl.classList.toggle('is-untracked', untracked);

        const headActions = `<div class="ot-head-actions">
              <button type="button" class="ot-btn ot-btn-accent" data-action="gem-reset"${untracked ? ' disabled' : ''}>초기화</button>
              <button type="button" class="ot-btn ot-btn-danger" data-action="delete"${untracked ? ' disabled' : ''}>삭제</button>
            </div>`;

        const bottomAction = untracked
            ? `<button type="button" class="ot-btn ot-btn-primary ot-btn-enter" data-action="enter">지금 입장</button>`
            : `<div class="ot-actions-grid">
                <button type="button" class="ot-btn ot-btn-tool${toolShop ? ' is-on' : ''}"
                  data-action="tool-shop"
                  aria-pressed="${toolShop ? 'true' : 'false'}">${toolShop ? '도구점 구매 취소' : '도구점 구매'}</button>
                <button type="button" class="ot-btn ot-btn-shipyard${shipyard ? ' is-on' : ''}"
                  data-action="shipyard"
                  aria-pressed="${shipyard ? 'true' : 'false'}">${shipyard ? '조선소 구매 취소' : '조선소 구매'}</button>
                <button type="button" class="ot-btn ot-btn-visit${sold ? ' is-on' : ''}"
                  data-action="visit"
                  aria-pressed="${sold ? 'true' : 'false'}">${sold ? '상점 구매 취소' : '상점 구매'}</button>
              </div>`;

        panelEl.innerHTML = `
          <div class="ot-card-head">
            ${portNameHeadingHtml(untracked ? selectedName : tracked.portName)}
            ${headActions}
          </div>

          <div class="ot-countdown-row">
            <div class="ot-countdown" data-role="countdown">${remVal}</div>
            <p class="ot-synced-at" data-role="synced-at">${escapeHtml(syncLine)}</p>
            <label class="ot-min-row">
              <span class="ot-label">분</span>
              <select class="ot-select ot-min-select" data-role="remain-min" aria-label="남은 분"${untracked ? ' disabled' : ''}>${minOptions}</select>
            </label>
          </div>

          <div class="ot-remain-edit">
            <div class="ot-sec-grid" role="group" aria-label="남은 초">${secButtons}</div>
          </div>

          <div class="ot-actions">
            ${bottomAction}
          </div>`;

        if (tracked) panelEl.dataset.portId = tracked.id;
        else delete panelEl.dataset.portId;
    }

    function catButtonHtml(cat) {
        const active = selectedGoodCategories.indexOf(cat) !== -1;
        return `<button type="button" class="ot-cat-btn${active ? ' is-active' : ''}"
            data-category="${escapeAttr(cat)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(cat)}</button>`;
    }

    function renderGoodsCategories() {
        if (!goodsCatsEl) return;
        const specials = window.ORIGIN_SPECIAL_CATEGORIES || ['명산품'];
        const groups = window.ORIGIN_GOOD_CATEGORY_GROUPS
            || [{ label: '', categories: window.ORIGIN_GOOD_CATEGORIES || [] }];
        const hasFilter = selectedGoodCategories.length > 0;
        const rowsHtml = groups.map(g => {
            const labelText = String(g.label || '').replace(/·/g, '\n');
            const label = g.label
                ? `<span class="ot-goods-cat-label">${escapeHtml(labelText)}</span>`
                : '';
            const btns = (g.categories || []).map(catButtonHtml).join('');
            return `<div class="ot-goods-cat-row">${label}${btns}</div>`;
        }).join('');
        goodsCatsEl.innerHTML = `
          <div class="ot-goods-cats-special" role="group" aria-label="특수 분류">
            ${specials.map(catButtonHtml).join('')}
            <button type="button" class="ot-cat-btn ot-cat-clear${hasFilter ? '' : ' is-dim'}"
              data-action="clear-goods-filter"
              ${hasFilter ? '' : 'disabled'}
              aria-label="필터 해제">필터 해제</button>
          </div>
          <div class="ot-goods-cats-divider" aria-hidden="true"></div>
          <div class="ot-goods-cats-normal" role="group" aria-label="일반 분류">
            ${rowsHtml}
          </div>`;
    }

    function clearGoodCategories() {
        if (!selectedGoodCategories.length && !selectedPortNames.length) return;
        selectedGoodCategories = [];
        filterByName = false;
        selectedPortNames = [];
        filterByPort = false;
        portFilterPinLabel = '';
        portFilterPinLabels = null;
        renderGoodsCategories();
        renderViewTabs();
        renderMap();
        setStatus(currentView().label || '');
        try {
            window.dispatchEvent(new CustomEvent('origin-goods-filter-changed'));
            window.dispatchEvent(new CustomEvent('origin-port-filter-changed'));
        } catch (_) { /* ignore */ }
    }

    function clearPortNameFilterOnly() {
        if (!selectedPortNames.length) return;
        selectedPortNames = [];
        filterByPort = false;
        portFilterPinLabel = '';
        portFilterPinLabels = null;
        renderViewTabs();
        renderMap();
        setStatus(currentView().label || '');
        try {
            window.dispatchEvent(new CustomEvent('origin-port-filter-changed'));
        } catch (_) { /* ignore */ }
    }

    function selectGoodCategory(category) {
        if (!category) return;

        filterByName = false;
        selectedPortNames = [];
        filterByPort = false;
        portFilterPinLabel = '';
        portFilterPinLabels = null;

        if (isSpecialCategory(category)) {
            // 명산품 등: 단독 토글 — 켜면 일반 분류 전부
            if (selectedGoodCategories.length === 1 && selectedGoodCategories[0] === category) {
                selectedGoodCategories = [];
            } else {
                selectedGoodCategories = [category];
            }
        } else {
            // 일반 분류: OR 복수 — 명산품이 켜져 있으면 끄고 시작
            const withoutSpecial = selectedGoodCategories.filter(c => !isSpecialCategory(c));
            const idx = withoutSpecial.indexOf(category);
            if (idx >= 0) withoutSpecial.splice(idx, 1);
            else withoutSpecial.push(category);
            selectedGoodCategories = withoutSpecial;
        }

        renderGoodsCategories();
        renderViewTabs();
        renderMap();
        const label = selectedCategoriesLabel();
        setStatus(label
            ? `「${label}」 — 맵에서 해당 항구를 확인하세요.`
            : (currentView().label || ''));
        try {
            window.dispatchEvent(new CustomEvent('origin-goods-filter-changed'));
            window.dispatchEvent(new CustomEvent('origin-port-filter-changed'));
        } catch (_) { /* ignore */ }
    }

    function tickPanel() {
        if (!selectedName || !panelEl) return;
        const tracked = findPortByName(selectedName);
        if (!tracked) return;

        const now = Date.now();
        const rem = getRemainingMs(tracked.anchorAt, now);
        const sold = isSoldOut(tracked, now);
        const toolShop = isToolShopBought(tracked, now);
        const shipyard = isShipyardBought(tracked, now);
        const ready = rem <= 1000;

        panelEl.classList.toggle('is-ready', ready && !sold);
        panelEl.classList.toggle('is-sold-out', sold);
        const cd = panelEl.querySelector('[data-role="countdown"]');
        const minSel = panelEl.querySelector('[data-role="remain-min"]');
        const visitBtn = panelEl.querySelector('[data-action="visit"]');
        const toolBtn = panelEl.querySelector('[data-action="tool-shop"]');
        const shipyardBtn = panelEl.querySelector('[data-action="shipyard"]');

        if (cd) cd.textContent = formatCountdown(rem);
        if (visitBtn) {
            visitBtn.classList.toggle('is-on', sold);
            visitBtn.setAttribute('aria-pressed', sold ? 'true' : 'false');
            visitBtn.textContent = sold ? '상점 구매 취소' : '상점 구매';
        }
        if (toolBtn) {
            toolBtn.classList.toggle('is-on', toolShop);
            toolBtn.setAttribute('aria-pressed', toolShop ? 'true' : 'false');
            toolBtn.textContent = toolShop ? '도구점 구매 취소' : '도구점 구매';
        }
        if (shipyardBtn) {
            shipyardBtn.classList.toggle('is-on', shipyard);
            shipyardBtn.setAttribute('aria-pressed', shipyard ? 'true' : 'false');
            shipyardBtn.textContent = shipyard ? '조선소 구매 취소' : '조선소 구매';
        }

        // 분 선택 중이면 덮어쓰지 않음
        if (minSel && document.activeElement !== minSel) {
            const totalSec = Math.max(0, Math.ceil(rem / 1000));
            minSel.value = String(Math.min(INTERVAL_MIN, Math.floor(totalSec / 60)));
        }
    }

    function selectPort(name) {
        selectedName = name;
        saveMapUiState();
        renderMap();
        renderPanel();
        if (typeof window.refreshOriginGoodQty === 'function') {
            window.refreshOriginGoodQty(name);
        }
        try {
            window.dispatchEvent(new CustomEvent('origin-port-selected', { detail: { portName: name } }));
        } catch (_) { /* ignore */ }
    }

    function refreshAll() {
        renderMap();
        renderPanel();
        if (typeof window.refreshOriginGoodQty === 'function') {
            window.refreshOriginGoodQty(selectedName);
        }
    }

    function tickAll() {
        syncGameMonthIfNeeded();
        flushExpiredSoldOut();
        flushExpiredToolShop();
        flushExpiredShipyard();
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
            toolShopBought: false,
            toolShopBoughtAt: null,
            shipyardBought: false,
            shipyardBoughtAt: null,
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
                toolShopBought: !!p.toolShopBought,
                toolShopBoughtAt: p.toolShopBoughtAt || null,
                shipyardBought: !!p.shipyardBought,
                shipyardBoughtAt: p.shipyardBoughtAt || null,
                syncedAt: p.syncedAt || null,
                syncedElapsedMin: p.syncedElapsedMin != null ? p.syncedElapsedMin : null,
            }));
            const rename = window.renameOriginPort || (n => n);
            if (prev) selectedName = rename(prev);
            else if (selectedName) selectedName = rename(selectedName);
            else if (findPortByName(DEFAULT_PORT)) selectedName = DEFAULT_PORT;
            saveMapUiState();
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

    /** 메모리·화면에 anchor 즉시 반영 (클릭 시점 타이밍 유지) */
    function applyAnchorLocal(port, iso, opts) {
        const clearSold = opts && opts.clearSoldOut;
        const sync = buildSyncStamp(port.syncedAt);
        port.anchorAt = iso;
        port.syncedAt = sync.syncedAt;
        port.syncedElapsedMin = sync.syncedElapsedMin;
        if (clearSold) {
            port.soldOut = false;
            port.soldOutAt = null;
        }
    }

    function refreshAnchorUi(port) {
        tickPanel();
        tickMapPins();
        if (!panelEl || !port) return;
        if (findPortByName(selectedName)?.id !== port.id) return;
        const syncEl = panelEl.querySelector('[data-role="synced-at"]');
        if (syncEl) {
            syncEl.textContent = formatSyncLine(port.syncedAt, port.syncedElapsedMin);
        }
    }

    /** DB 저장 — 실패해도 로컬 반영은 유지 */
    async function persistAnchorToDb(port) {
        await window.originDb.savePort({
            ...port,
            intervalMin: INTERVAL_MIN,
            soldOut: !!port.soldOut,
            soldOutAt: port.soldOutAt || null,
            toolShopBought: !!port.toolShopBought,
            toolShopBoughtAt: port.toolShopBoughtAt || null,
        });
    }

    function saveAnchor(id, iso, opts) {
        const port = ports.find(p => p.id === id);
        if (!port) return;

        applyAnchorLocal(port, iso, opts);
        refreshAnchorUi(port);
        setStatus(`「${port.portName}」남은 시간을 반영했습니다.`);

        persistAnchorToDb(port).catch((err) => {
            console.error('[OriginTimer] anchor 저장 실패', err);
            setStatus(`「${port.portName}」DB 저장 실패 (화면은 반영됨): ${err.message || err}`, true);
        });
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────

    if (goodsCatsEl) {
        goodsCatsEl.addEventListener('click', (e) => {
            const clearBtn = e.target.closest('[data-action="clear-goods-filter"]');
            if (clearBtn) {
                clearGoodCategories();
                return;
            }
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
    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', () => openSettings());
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => closeSettings());
    }
    if (settingsOverlay) {
        settingsOverlay.addEventListener('pointerdown', (e) => {
            settingsOverlayPointerDownOnBackdrop = e.target === settingsOverlay;
        });
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay && settingsOverlayPointerDownOnBackdrop) {
                closeSettings();
            }
            settingsOverlayPointerDownOnBackdrop = false;
        });
    }
    if (settingsDriftSaveBtn) {
        settingsDriftSaveBtn.addEventListener('click', () => { saveTimerSettings(); });
    }
    if (settingsDriftEnabled) {
        settingsDriftEnabled.addEventListener('change', syncSettingsFormEnabled);
    }
    if (settingsOffsetEnabled) {
        settingsOffsetEnabled.addEventListener('change', syncSettingsFormEnabled);
    }
    if (settingsDriftHistory) {
        settingsDriftHistory.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-drift-history]');
            if (!btn || !settingsDriftInput || settingsDriftInput.disabled) return;
            const v = parseInt(btn.dataset.driftHistory, 10);
            if (!Number.isFinite(v) || v < 60) return;
            settingsDriftInput.value = String(v);
            renderDriftHistory(v);
        });
    }
    if (settingsOffsetBtns) {
        settingsOffsetBtns.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-offset-delta], [data-offset-set]');
            if (!btn || !settingsOffsetInput) return;
            let v = parseInt(settingsOffsetInput.value, 10);
            if (!Number.isFinite(v)) v = 0;
            if (btn.dataset.offsetSet != null) {
                v = parseInt(btn.dataset.offsetSet, 10) || 0;
            } else {
                v += parseInt(btn.dataset.offsetDelta, 10) || 0;
            }
            if (v < OFFSET_SEC_MIN) v = OFFSET_SEC_MIN;
            if (v > OFFSET_SEC_MAX) v = OFFSET_SEC_MAX;
            settingsOffsetInput.value = String(v);
        });
    }
    if (settingsDriftInput) {
        settingsDriftInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTimerSettings();
            }
        });
    }
    if (settingsOffsetInput) {
        settingsOffsetInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTimerSettings();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsOverlay && !settingsOverlay.hidden) {
            closeSettings();
        }
    });

    if (panelEl) {
        panelEl.addEventListener('change', (e) => {
            const monthSel = e.target.closest('[data-role="month"]');
            if (monthSel) {
                setSelectedMonth(monthSel.value);
                return;
            }
        });

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
                        toolShopBought: false,
                        toolShopBoughtAt: null,
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
                    saveAnchor(tracked.id, remainingToAnchor(remainingMs));
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

                if (action === 'tool-shop') {
                    btn.disabled = true;
                    const turnOn = !isToolShopBought(tracked);
                    await window.originDb.savePort({
                        ...tracked,
                        intervalMin: INTERVAL_MIN,
                        toolShopBought: turnOn,
                        toolShopBoughtAt: turnOn ? new Date().toISOString() : null,
                    });
                    await reload(true);
                    setStatus(turnOn
                        ? `「${tracked.portName}」도구점 구매를 표시했습니다.`
                        : `「${tracked.portName}」도구점 구매를 취소했습니다.`);
                    return;
                }

                if (action === 'shipyard') {
                    btn.disabled = true;
                    const turnOn = !isShipyardBought(tracked);
                    await window.originDb.savePort({
                        ...tracked,
                        intervalMin: INTERVAL_MIN,
                        shipyardBought: turnOn,
                        shipyardBoughtAt: turnOn ? new Date().toISOString() : null,
                    });
                    await reload(true);
                    setStatus(turnOn
                        ? `「${tracked.portName}」조선소 구매를 표시했습니다.`
                        : `「${tracked.portName}」조선소 구매를 취소했습니다.`);
                    return;
                }

                if (action === 'gem-reset') {
                    if (!confirm(`「${tracked.portName}」재화로 재고를 초기화했습니까?\n30분 주기가 지금부터 다시 시작됩니다.`)) {
                        return;
                    }
                    saveAnchor(tracked.id, new Date().toISOString(), { clearSoldOut: true });
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

    function setSettingsStatus(msg, kind) {
        if (!settingsStatusEl) return;
        settingsStatusEl.textContent = msg || '';
        settingsStatusEl.classList.toggle('is-error', kind === 'error');
        settingsStatusEl.classList.toggle('is-warn', kind === 'warn');
    }

    function readDriftHistory() {
        try {
            const raw = localStorage.getItem(LS_DRIFT_HISTORY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            const out = [];
            const seen = Object.create(null);
            for (let i = 0; i < arr.length; i++) {
                const v = parseInt(arr[i], 10);
                if (!Number.isFinite(v) || v < 60 || v > 100000) continue;
                if (seen[v]) continue;
                seen[v] = true;
                out.push(v);
                if (out.length >= DRIFT_HISTORY_MAX) break;
            }
            return out;
        } catch {
            return [];
        }
    }

    function writeDriftHistory(list) {
        try {
            localStorage.setItem(LS_DRIFT_HISTORY, JSON.stringify(list.slice(0, DRIFT_HISTORY_MAX)));
        } catch (_) { /* ignore */ }
    }

    function pushDriftHistory(n) {
        let v = parseInt(n, 10);
        if (!Number.isFinite(v) || v < 60) return readDriftHistory();
        if (v > 100000) v = 100000;
        const list = readDriftHistory().filter((x) => x !== v);
        list.unshift(v);
        writeDriftHistory(list);
        return list;
    }

    function renderDriftHistory(currentN) {
        if (!settingsDriftHistory) return;
        const cur = parseInt(currentN, 10);
        const list = readDriftHistory();
        if (!list.length) {
            settingsDriftHistory.innerHTML = '';
            settingsDriftHistory.hidden = true;
            return;
        }
        settingsDriftHistory.hidden = false;
        settingsDriftHistory.innerHTML = list.map((v) => {
            const isCur = Number.isFinite(cur) && v === cur;
            return `<button type="button" class="ot-settings-offset-btn${isCur ? ' is-current' : ''}" data-drift-history="${v}">${v}</button>`;
        }).join('');
        syncSettingsFormEnabled();
    }

    function syncSettingsFormEnabled() {
        const driftOn = !settingsDriftEnabled || settingsDriftEnabled.checked;
        const offsetOn = !settingsOffsetEnabled || settingsOffsetEnabled.checked;
        if (settingsDriftRow) settingsDriftRow.classList.toggle('is-disabled', !driftOn);
        if (settingsDriftInput) settingsDriftInput.disabled = !driftOn;
        if (settingsDriftHistory) {
            settingsDriftHistory.classList.toggle('is-disabled', !driftOn);
            settingsDriftHistory.querySelectorAll('button').forEach((b) => { b.disabled = !driftOn; });
        }
        if (settingsOffsetRow) settingsOffsetRow.classList.toggle('is-disabled', !offsetOn);
        if (settingsOffsetInput) settingsOffsetInput.disabled = !offsetOn;
        if (settingsOffsetBtns) {
            settingsOffsetBtns.classList.toggle('is-disabled', !offsetOn);
            settingsOffsetBtns.querySelectorAll('button').forEach((b) => { b.disabled = !offsetOn; });
        }
    }

    function clampOffsetSec(n) {
        let v = parseInt(n, 10);
        if (!Number.isFinite(v)) v = 0;
        if (v < OFFSET_SEC_MIN) v = OFFSET_SEC_MIN;
        if (v > OFFSET_SEC_MAX) v = OFFSET_SEC_MAX;
        return v;
    }

    function applyTimerSettings(partial) {
        const src = partial || {};
        let drift = parseInt(src.driftOverMin, 10);
        if (!Number.isFinite(drift) || drift < 60) drift = DEFAULT_DRIFT_OVER_MIN;
        if (drift > 100000) drift = 100000;
        driftOverMin = drift;
        driftEnabled = src.driftEnabled !== false && src.driftEnabled !== 0 && src.driftEnabled !== '0';
        globalOffsetSec = clampOffsetSec(src.globalOffsetSec);
        offsetEnabled = src.offsetEnabled !== false && src.offsetEnabled !== 0 && src.offsetEnabled !== '0';

        if (settingsDriftInput) settingsDriftInput.value = String(driftOverMin);
        if (settingsDriftEnabled) settingsDriftEnabled.checked = driftEnabled;
        if (settingsOffsetInput) settingsOffsetInput.value = String(globalOffsetSec);
        if (settingsOffsetEnabled) settingsOffsetEnabled.checked = offsetEnabled;
        renderDriftHistory(driftOverMin);
        syncSettingsFormEnabled();
        return {
            driftOverMin,
            driftEnabled,
            globalOffsetSec,
            offsetEnabled,
        };
    }

    function readSettingsFromForm() {
        return {
            driftOverMin: settingsDriftInput ? settingsDriftInput.value : driftOverMin,
            driftEnabled: settingsDriftEnabled ? settingsDriftEnabled.checked : driftEnabled,
            globalOffsetSec: settingsOffsetInput ? settingsOffsetInput.value : globalOffsetSec,
            offsetEnabled: settingsOffsetEnabled ? settingsOffsetEnabled.checked : offsetEnabled,
        };
    }

    function openSettings() {
        if (!settingsOverlay) return;
        applyTimerSettings({
            driftOverMin,
            driftEnabled,
            globalOffsetSec,
            offsetEnabled,
        });
        if (typeof window.originBarterFillSettings === 'function') {
            window.originBarterFillSettings();
        }
        setSettingsStatus('');
        settingsOverlay.hidden = false;
        if (settingsDriftEnabled) settingsDriftEnabled.focus();
        else if (settingsDriftInput) settingsDriftInput.focus();
    }

    function closeSettings() {
        if (settingsOverlay) settingsOverlay.hidden = true;
        settingsOverlayPointerDownOnBackdrop = false;
    }

    async function loadSettingsFromDb() {
        if (!window.originDb || typeof window.originDb.loadSettings !== 'function') {
            applyTimerSettings({
                driftOverMin: DEFAULT_DRIFT_OVER_MIN,
                driftEnabled: true,
                globalOffsetSec: 0,
                offsetEnabled: true,
            });
            return;
        }
        try {
            const s = await window.originDb.loadSettings();
            applyTimerSettings(s);
            if (!readDriftHistory().length && s && s.driftOverMin != null) {
                pushDriftHistory(s.driftOverMin);
                renderDriftHistory(driftOverMin);
            }
            if (s && s._fromLocal) {
                console.warn('[OriginTimer] 설정: DB 테이블 미반영 — 로컬값 사용');
            }
        } catch (err) {
            console.error('[OriginTimer] 설정 로드 실패', err);
            applyTimerSettings({
                driftOverMin: DEFAULT_DRIFT_OVER_MIN,
                driftEnabled: true,
                globalOffsetSec: 0,
                offsetEnabled: true,
            });
            setStatus('설정 불러오기 실패: ' + (err.message || err) + ' — origin_settings 마이그레이션을 확인하세요.', true);
        }
    }

    async function saveTimerSettings() {
        const next = applyTimerSettings(readSettingsFromForm());
        pushDriftHistory(next.driftOverMin);
        renderDriftHistory(next.driftOverMin);
        if (typeof window.originBarterSaveSettings === 'function') {
            window.originBarterSaveSettings();
        }
        if (!window.originDb || typeof window.originDb.saveSettings !== 'function') {
            refreshAll();
            setSettingsStatus('로컬에만 반영했습니다.', 'warn');
            return;
        }
        if (settingsDriftSaveBtn) settingsDriftSaveBtn.disabled = true;
        try {
            const saved = await window.originDb.saveSettings(next);
            applyTimerSettings(saved);
            pushDriftHistory(saved.driftOverMin);
            renderDriftHistory(saved.driftOverMin);
            refreshAll();
            if (saved._fromLocal) {
                setSettingsStatus('DB 테이블이 아직 API에 안 보입니다(404). 로컬에 저장했습니다. SQL 실행 후 스키마 Reload를 하세요.', 'warn');
            } else {
                setSettingsStatus('저장했습니다. 보정값이 바로 적용됩니다.');
            }
        } catch (err) {
            console.error('[OriginTimer] 설정 저장 실패', err);
            setSettingsStatus('저장 실패: ' + (err.message || err), 'error');
        } finally {
            if (settingsDriftSaveBtn) settingsDriftSaveBtn.disabled = false;
        }
    }

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
        syncGameMonthIfNeeded();
        loadMapUiState();
        renderViewTabs();
        renderGoodsCategories();
        selectView(selectedViewId);
        await Promise.all([reload(false), loadPinsFromDb(), loadGoodQtyCache(), loadSettingsFromDb()]);
        refreshAll();
        tickTimer = setInterval(tickAll, 1000);
    }

    // 월 변경 시 타이머 카드 헤더 갱신
    window.refreshOriginPanel = function () {
        renderPanel();
    };

    window.getOriginSelectedPort = function () {
        return selectedName;
    };

    // 물물교환·추천: 재료 이름으로 맵 필터링
    // statusMsg를 주면 그 문구로 상태줄 표시 (미전달 시 이름 목록)
    window.filterMapByGoodNames = async function (goodNames, statusMsg) {
        if (!goodNames || !goodNames.length) return;

        selectedPortNames = [];
        filterByPort = false;
        portFilterPinLabel = '';
        portFilterPinLabels = null;
        selectedGoodCategories = goodNames;
        filterByName = true;
        renderGoodsCategories();
        renderViewTabs();
        await loadGoodQtyCache();
        renderMap();

        const view = currentView();
        if (statusMsg != null) {
            setStatus(statusMsg);
        } else {
            const label = goodNames.join(', ');
            setStatus(`「${label}」 — ${view.label || ''}`);
        }
        try {
            window.dispatchEvent(new CustomEvent('origin-goods-filter-changed'));
            window.dispatchEvent(new CustomEvent('origin-port-filter-changed'));
        } catch (_) { /* ignore */ }
    };

    /**
     * 조선 티어 등: 항구 이름으로 맵 필터링
     * @param {string[]} portNames
     * @param {string} [statusMsg]
     * @param {string|Record<string, string|string[]>|null} [pinLabelOrMap]
     *   문자열이면 전 항구 공통 라벨,
     *   객체면 항구별 라벨(문자열 또는 배열)
     */
    window.filterMapByPortNames = async function (portNames, statusMsg, pinLabelOrMap) {
        if (!portNames || !portNames.length) return;

        selectedGoodCategories = [];
        filterByName = false;
        selectedPortNames = portNames.slice();
        filterByPort = true;

        portFilterPinLabel = '';
        portFilterPinLabels = null;
        if (pinLabelOrMap && typeof pinLabelOrMap === 'object' && !Array.isArray(pinLabelOrMap)) {
            const map = {};
            for (const key of Object.keys(pinLabelOrMap)) {
                const v = pinLabelOrMap[key];
                if (Array.isArray(v)) map[key] = v.filter(Boolean).map(String);
                else if (v != null && v !== '') map[key] = [String(v)];
            }
            portFilterPinLabels = map;
        } else if (pinLabelOrMap != null && pinLabelOrMap !== '') {
            portFilterPinLabel = String(pinLabelOrMap);
        }

        renderGoodsCategories();
        renderViewTabs();
        renderMap();

        const view = currentView();
        if (statusMsg != null) {
            setStatus(`${statusMsg} — ${view.label || ''}`);
        } else {
            setStatus(`조선 항구 ${portNames.length}곳 — ${view.label || ''}`);
        }
        try {
            window.dispatchEvent(new CustomEvent('origin-goods-filter-changed'));
            window.dispatchEvent(new CustomEvent('origin-port-filter-changed'));
        } catch (_) { /* ignore */ }
    };

    /** @returns {string[]|null} 이름 필터 중이면 품명 배열, 아니면 null */
    window.getOriginGoodsNameFilter = function () {
        if (!filterByName || !selectedGoodCategories.length) return null;
        return selectedGoodCategories.slice();
    };

    /** @returns {string[]|null} */
    window.getOriginPortNameFilter = function () {
        if (!filterByPort || !selectedPortNames.length) return null;
        return selectedPortNames.slice();
    };

    window.clearOriginGoodsFilter = function () {
        clearGoodCategories();
    };

    window.clearOriginPortNameFilter = function () {
        clearPortNameFilterOnly();
    };

    window.selectOriginMapView = function (viewId) {
        selectView(viewId);
    };

    window.invalidateOriginGoodQtyCache = async function () {
        await loadGoodQtyCache();
        if (selectedGoodCategories.length || selectedPortNames.length) renderMap();
    };


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
