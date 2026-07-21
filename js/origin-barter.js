// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const LS_CAPACITY = 'originBarterCapacity';
    const LS_VILLAGE = 'originBarterVillage';
    const LS_EXCHANGE = 'originBarterExchange';
    const LS_RATIOS = 'originBarterRatios';
    const LS_HAVE = 'originBarterHave';
    const LS_BATCHES = 'originBarterBatches';
    const LS_RECIPE_LEGACY = 'originBarterRecipe';
    const MAX_BATCHES = 8;

    /**
     * 마을 → 교환목록
     * ingredients / result defaultRatio = 교환 1회분 재료·결과
     * 계획: 선택한 배수 N → 목표 = N × 1회 비율
     */
    const BARTER_VILLAGES = [
        {
            id: 'turk',
            name: '튀르크',
            exchanges: [
                {
                    id: 'mastic',
                    name: '매스틱',
                    category: '기호품',
                    result: { name: '매스틱', defaultRatio: 680 },
                    ingredients: [
                        { name: '은 식기', defaultRatio: 194 },
                        { name: '커피', defaultRatio: 174 },
                        { name: '포도주', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'chaidanruk',
                    name: '차이단륵',
                    category: '미술품',
                    result: { name: '차이단륵', defaultRatio: 626 },
                    ingredients: [
                        { name: '사금', defaultRatio: 174 },
                        { name: '주석 광석', defaultRatio: 174 },
                        { name: '아주라이트', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'damascus_steel',
                    name: '다마스쿠스 강철',
                    category: '공업품',
                    result: { name: '다마스쿠스 강철', defaultRatio: 626 },
                    ingredients: [
                        { name: '철광석', defaultRatio: 174 },
                        { name: '석탄', defaultRatio: 174 },
                        { name: '목재', defaultRatio: 174 },
                    ],
                },
            ],
        },
        {
            id: 'apache',
            name: '아파치',
            exchanges: [
                {
                    id: 'camas',
                    name: '카마스',
                    category: '식료품',
                    result: { name: '카마스', defaultRatio: 756 },
                    ingredients: [
                        { name: '아보카도', defaultRatio: 134 },
                        { name: '카사바', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'pulque',
                    name: '풀케',
                    category: '주류',
                    result: { name: '풀케', defaultRatio: 816 },
                    ingredients: [
                        { name: '산호', defaultRatio: 154 },
                        { name: '은', defaultRatio: 134 },
                    ],
                },
                {
                    id: 'wampum',
                    name: '왐품',
                    category: '공예품',
                    result: { name: '왐품', defaultRatio: 504 },
                    ingredients: [
                        { name: '백금', defaultRatio: 134 },
                        { name: '월하향', defaultRatio: 134 },
                    ],
                },
            ],
        },
        {
            id: 'svear',
            name: '스비아인',
            exchanges: [
                {
                    id: 'birch',
                    name: '자작나무',
                    category: '공업품',
                    result: { name: '자작나무', defaultRatio: 551 },
                    ingredients: [
                        { name: '철재', defaultRatio: 108 },
                        { name: '화승총', defaultRatio: 54 },
                        { name: '양초', defaultRatio: 94 },
                    ],
                },
                {
                    id: 'naverslojd',
                    name: '네베르스로이드',
                    category: '공예품',
                    result: { name: '네베르스로이드', defaultRatio: 1019 },
                    ingredients: [
                        { name: '자작나무', defaultRatio: 308 },
                        { name: '철재', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'juniper_berry',
                    name: '주니퍼 베리',
                    category: '향신료',
                    result: { name: '주니퍼 베리', defaultRatio: 787 },
                    ingredients: [
                        { name: '링곤베리', defaultRatio: 77 },
                        { name: '보드카', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'meteorite',
                    name: '운철',
                    category: '공업품',
                    result: { name: '운철', defaultRatio: 945 },
                    ingredients: [
                        { name: '컴퍼스', defaultRatio: 134 },
                        { name: '초롱', defaultRatio: 134 },
                        { name: '올리브기름', defaultRatio: 134 },
                    ],
                },
            ],
        },
    ];

    let selectedVillageId = null;
    let selectedExchangeId = null;
    /** 맵 재료 항구용 결과물(교환) 복수 선택 — 계획표와 독립 */
    /** @type {string[]} */
    let mapFilterExchangeIds = [];
    /** 교환 횟수 배수 (1~8) — 목표 = 비율 × N */
    let selectedBatches = 1;
    /** 재료 비율만 (결과물 비율 제외) */
    let currentRatios = {};
    /** 결과물 비율 */
    let currentResultRatio = 0;
    /** @type {Record<string, number>} */
    let currentHave = {};
    /** @type {{ name: string, amount: number }[]} */
    let lastGoals = [];
    let selectedMonth = 1;
    let inited = false;

    function els() {
        return {
            capacityInput: document.getElementById('barter-capacity'),
            villageSelect: document.getElementById('barter-village'),
            exchangeSelect: document.getElementById('barter-exchange'),
            exchangeBadge: document.getElementById('barter-exchange-badge'),
            matrixDiv: document.getElementById('barter-matrix'),
            multBtns: document.getElementById('barter-mult-btns'),
            progressClearBtn: document.getElementById('barter-progress-clear'),
            filterBtn: document.getElementById('barter-filter-map'),
            resultBtns: document.getElementById('barter-result-btns'),
        };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getVillage(villageId) {
        return BARTER_VILLAGES.find(v => v.id === villageId) || null;
    }

    function getExchange(villageId, exchangeId) {
        const village = getVillage(villageId);
        if (!village || !village.exchanges) return null;
        return village.exchanges.find(e => e.id === exchangeId) || null;
    }

    function findExchangeAnywhere(exchangeId) {
        if (!exchangeId) return null;
        for (const village of BARTER_VILLAGES) {
            const ex = (village.exchanges || []).find(e => e.id === exchangeId);
            if (ex) return { village, exchange: ex };
        }
        return null;
    }

    function currentVillage() {
        return getVillage(selectedVillageId);
    }

    function currentExchange() {
        return getExchange(selectedVillageId, selectedExchangeId);
    }

    function renderExchangeBadge() {
        const { exchangeBadge } = els();
        if (!exchangeBadge) return;
        const exchange = currentExchange();
        const badge = exchange && typeof window.getOriginCategoryBadge === 'function'
            ? window.getOriginCategoryBadge(exchange.category)
            : null;
        exchangeBadge.hidden = !badge;
        exchangeBadge.textContent = badge ? badge.letter : '';
        exchangeBadge.title = badge ? badge.label : '';
        exchangeBadge.setAttribute('aria-label', badge ? badge.label : '');
    }

    /** 저장키: 마을ID:교환ID (구버전 교환ID만 있던 키도 읽기) */
    function ratioKey() {
        if (!selectedVillageId || !selectedExchangeId) return null;
        return selectedVillageId + ':' + selectedExchangeId;
    }

    function pickStoreEntry(store, villageId, exchangeId) {
        if (!store || !exchangeId) return null;
        if (villageId) {
            const compound = villageId + ':' + exchangeId;
            if (store[compound] && typeof store[compound] === 'object') return store[compound];
        }
        if (store[exchangeId] && typeof store[exchangeId] === 'object') return store[exchangeId];
        const legacyColon = Object.keys(store).find(k => k.endsWith(':' + exchangeId));
        if (legacyColon && store[legacyColon] && typeof store[legacyColon] === 'object') {
            return store[legacyColon];
        }
        return null;
    }

    function readRatioStore() {
        try {
            const raw = localStorage.getItem(LS_RATIOS);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeRatioStore(store) {
        localStorage.setItem(LS_RATIOS, JSON.stringify(store || {}));
    }

    function saveCapacity() {
        const { capacityInput } = els();
        if (!capacityInput) return;
        const n = parseInt(capacityInput.value, 10);
        if (Number.isFinite(n) && n > 0) {
            localStorage.setItem(LS_CAPACITY, String(n));
        }
    }

    function clampBatches(n) {
        const v = parseInt(n, 10);
        if (!Number.isFinite(v) || v < 1) return 1;
        if (v > MAX_BATCHES) return MAX_BATCHES;
        return v;
    }

    function saveBatches() {
        localStorage.setItem(LS_BATCHES, String(selectedBatches));
    }

    function syncMultButtons() {
        const { multBtns } = els();
        if (!multBtns) return;
        multBtns.querySelectorAll('[data-mult]').forEach(btn => {
            const n = clampBatches(btn.dataset.mult);
            const on = n === selectedBatches;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function setBatches(n) {
        selectedBatches = clampBatches(n);
        saveBatches();
        syncMultButtons();
        refreshMatrix();
    }

    function saveSelection() {
        if (selectedVillageId) localStorage.setItem(LS_VILLAGE, selectedVillageId);
        if (selectedExchangeId) localStorage.setItem(LS_EXCHANGE, selectedExchangeId);
    }

    function saveCurrentRatios() {
        const key = ratioKey();
        if (!key) return;
        const exchange = currentExchange();
        const store = readRatioStore();
        const payload = { ...currentRatios };
        if (exchange && exchange.result) {
            payload[exchange.result.name] = currentResultRatio;
        }
        store[key] = payload;
        writeRatioStore(store);
    }

    function loadSavedRatios() {
        return pickStoreEntry(readRatioStore(), selectedVillageId, selectedExchangeId) || {};
    }

    function loadSavedHave() {
        try {
            const raw = localStorage.getItem(LS_HAVE);
            const store = raw ? JSON.parse(raw) : {};
            const entry = pickStoreEntry(store, selectedVillageId, selectedExchangeId);
            if (entry) return { ...entry };
        } catch { /* ignore */ }
        return {};
    }

    function saveCurrentHave() {
        const key = ratioKey();
        if (!key) return;
        let store = {};
        try {
            const raw = localStorage.getItem(LS_HAVE);
            store = raw ? JSON.parse(raw) : {};
            if (!store || typeof store !== 'object') store = {};
        } catch {
            store = {};
        }
        store[key] = { ...currentHave };
        localStorage.setItem(LS_HAVE, JSON.stringify(store));
    }

    function fillVillageOptions() {
        const { villageSelect } = els();
        if (!villageSelect) return;
        villageSelect.innerHTML = '<option value="">선택하세요</option>';
        BARTER_VILLAGES.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            villageSelect.appendChild(opt);
        });
    }

    function fillExchangeOptions(villageId) {
        const { exchangeSelect } = els();
        if (!exchangeSelect) return;
        exchangeSelect.innerHTML = '<option value="">선택하세요</option>';
        const village = getVillage(villageId);
        if (!village || !village.exchanges) return;
        village.exchanges.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            exchangeSelect.appendChild(opt);
        });
    }

    function init() {
        const { capacityInput, villageSelect, exchangeSelect, filterBtn, matrixDiv, progressClearBtn, multBtns } = els();
        if (!capacityInput || !villageSelect || !exchangeSelect || inited) return;
        inited = true;

        const savedMonth = parseInt(localStorage.getItem('originBarterMonth') || '', 10);
        selectedMonth = (savedMonth >= 1 && savedMonth <= 12) ? savedMonth : 1;
        localStorage.setItem('originBarterMonth', String(selectedMonth));
        if (typeof window.advanceOriginBarterMonthIfNeeded === 'function') {
            const advanced = window.advanceOriginBarterMonthIfNeeded();
            if (advanced != null) selectedMonth = advanced;
            else selectedMonth = parseInt(localStorage.getItem('originBarterMonth') || String(selectedMonth), 10) || selectedMonth;
        }

        const savedCapacity = parseInt(localStorage.getItem(LS_CAPACITY) || '', 10);
        if (Number.isFinite(savedCapacity) && savedCapacity > 0) {
            capacityInput.value = String(savedCapacity);
        }

        selectedBatches = clampBatches(localStorage.getItem(LS_BATCHES) || '1');
        syncMultButtons();

        fillVillageOptions();

        window.originBarterOnMonthChange = function (month) {
            selectedMonth = parseInt(month, 10);
            if (!(selectedMonth >= 1 && selectedMonth <= 12)) selectedMonth = 1;
            refreshMatrix();
        };

        villageSelect.addEventListener('change', onVillageChange);
        exchangeSelect.addEventListener('change', onExchangeChange);
        capacityInput.addEventListener('input', () => {
            saveCapacity();
            refreshMatrix();
        });
        if (multBtns) {
            multBtns.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-mult]');
                if (!btn || !multBtns.contains(btn)) return;
                setBatches(btn.dataset.mult);
            });
        }
        if (filterBtn) {
            filterBtn.addEventListener('click', filterMapByIngredients);
        }
        const { resultBtns } = els();
        if (resultBtns) {
            resultBtns.addEventListener('click', onResultBtnClick);
        }
        window.addEventListener('origin-goods-filter-changed', () => {
            syncIngredientFilterBtn();
            syncResultButtons();
        });
        if (matrixDiv) {
            matrixDiv.addEventListener('input', onMatrixInput);
        }
        if (progressClearBtn) {
            progressClearBtn.addEventListener('click', () => {
                currentHave = {};
                saveCurrentHave();
                refreshMatrix();
            });
        }

        initSideToolTabs();

        let savedVillage = localStorage.getItem(LS_VILLAGE);
        let savedExchange = localStorage.getItem(LS_EXCHANGE);
        const legacyRecipe = localStorage.getItem(LS_RECIPE_LEGACY);

        if (!savedExchange && legacyRecipe) {
            const found = findExchangeAnywhere(legacyRecipe);
            if (found) {
                savedExchange = legacyRecipe;
                if (!savedVillage) savedVillage = found.village.id;
            }
        }

        // 교환만 저장된 구버전: 해당 교환이 있는 마을로 복원
        if (savedExchange && !getVillage(savedVillage)) {
            const found = findExchangeAnywhere(savedExchange);
            if (found) savedVillage = found.village.id;
        }

        const preferVillage = (savedVillage && getVillage(savedVillage))
            ? savedVillage
            : (BARTER_VILLAGES[0] && BARTER_VILLAGES[0].id);

        if (preferVillage) {
            selectedVillageId = preferVillage;
            villageSelect.value = preferVillage;
            fillExchangeOptions(preferVillage);

            const village = getVillage(preferVillage);
            const preferExchange = (savedExchange && getExchange(preferVillage, savedExchange))
                ? savedExchange
                : (village && village.exchanges[0] && village.exchanges[0].id);

            if (preferExchange) {
                selectedExchangeId = preferExchange;
                exchangeSelect.value = preferExchange;
                onExchangeChange();
            } else {
                selectedExchangeId = null;
                renderExchangeBadge();
                showMatrixEmpty('교환목록을 선택하세요');
            }
        } else {
            showMatrixEmpty('마을을 선택하세요');
        }
        syncIngredientFilterBtn();
        renderResultButtons();
    }

    function initSideToolTabs() {
        const tabs = document.querySelectorAll('.ot-side-tool-tab');
        if (!tabs.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tool = tab.dataset.tool;
                if (!tool) return;

                tabs.forEach(t => {
                    const on = t === tab;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });

                document.querySelectorAll('[data-tool-pane]').forEach(pane => {
                    pane.hidden = pane.dataset.toolPane !== tool;
                });
            });
        });
    }

    function onVillageChange() {
        const { villageSelect, exchangeSelect } = els();
        selectedVillageId = villageSelect.value || null;
        selectedExchangeId = null;
        clearMapFilterSelection(true);
        fillExchangeOptions(selectedVillageId);
        renderExchangeBadge();
        saveSelection();

        const village = currentVillage();
        if (village && village.exchanges && village.exchanges.length) {
            selectedExchangeId = village.exchanges[0].id;
            exchangeSelect.value = selectedExchangeId;
            onExchangeChange();
        } else {
            showMatrixEmpty(selectedVillageId ? '교환목록을 선택하세요' : '마을을 선택하세요');
            renderResultButtons();
            syncIngredientFilterBtn();
        }
    }

    function onExchangeChange() {
        const { exchangeSelect } = els();
        selectedExchangeId = exchangeSelect.value || null;
        renderExchangeBadge();
        saveSelection();
        loadRatiosIntoState();
        currentHave = loadSavedHave();
        refreshMatrix();
        syncIngredientFilterBtn();
        renderResultButtons();
        try {
            window.dispatchEvent(new CustomEvent('origin-barter-exchange-changed', {
                detail: { resultName: (currentExchange() && currentExchange().result && currentExchange().result.name) || '' },
            }));
        } catch (_) { /* ignore */ }
    }

    function loadRatiosIntoState() {
        const exchange = currentExchange();
        currentRatios = {};
        currentResultRatio = 0;
        if (!exchange || !exchange.ingredients) return;
        const saved = loadSavedRatios();
        exchange.ingredients.forEach(ing => {
            const ratio = (Number.isFinite(Number(saved[ing.name])) && Number(saved[ing.name]) > 0)
                ? parseInt(saved[ing.name], 10)
                : ing.defaultRatio;
            currentRatios[ing.name] = ratio;
        });
        if (exchange.result) {
            const rName = exchange.result.name;
            const savedR = Number(saved[rName]);
            currentResultRatio = (Number.isFinite(savedR) && savedR > 0)
                ? parseInt(saved[rName], 10)
                : exchange.result.defaultRatio;
        }
        saveCurrentRatios();
    }

    function onMatrixInput(e) {
        const input = e.target.closest('.ot-barter-cell-input');
        if (!input) return;
        const role = input.dataset.role;
        const name = input.dataset.good;
        if (!role || !name) return;

        if (role === 'ratio') {
            const exchange = currentExchange();
            const raw = input.value.trim();
            const n = parseInt(raw, 10);
            const val = (Number.isFinite(n) && n > 0) ? n : 0;
            if (exchange && exchange.result && name === exchange.result.name) {
                currentResultRatio = val;
            } else {
                currentRatios[name] = val;
            }
            saveCurrentRatios();
            updateComputedRows();
            return;
        }

        if (role === 'have') {
            const raw = input.value.trim();
            const n = parseInt(raw, 10);
            if (raw !== '' && Number.isFinite(n) && n >= 0) currentHave[name] = n;
            else delete currentHave[name];
            saveCurrentHave();
            updateComputedRows();
        }
    }

    function getCapacity() {
        const { capacityInput } = els();
        return parseInt(capacityInput && capacityInput.value, 10) || 0;
    }

    /**
     * 목표: 선택한 교환 횟수 N × 1회 비율
     * 결과 적재: 실제 실은 재료 중 가장 부족한 비율(병목) 기준으로 교환 예상량
     * 결과 초과: 결과 적재 − 함대 적재량
     * 재료 사용: 병목 묶음 × 비율, 잔량: 입력 − 사용
     */
    function computePlan() {
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return null;
        if (!exchange.result) return null;

        const resultRatio = currentResultRatio || exchange.result.defaultRatio || 0;
        if (resultRatio <= 0) return null;

        const hasMaterialRatio = exchange.ingredients.some(ing => (currentRatios[ing.name] || 0) > 0);
        if (!hasMaterialRatio) return null;

        const goalBatches = selectedBatches;
        const resultGoal = Math.round(goalBatches * resultRatio);
        const capacity = getCapacity();

        // 실제 적재 재료로 가능한 묶음 = min(적재_i / 비율_i)
        let haveBatches = null;
        for (const ing of exchange.ingredients) {
            const ratio = currentRatios[ing.name] || 0;
            if (ratio <= 0) continue;
            const have = Number(currentHave[ing.name]) || 0;
            const b = have / ratio;
            if (haveBatches == null || b < haveBatches) haveBatches = b;
        }
        if (haveBatches == null) haveBatches = 0;
        const resultHave = Math.round(haveBatches * resultRatio);

        const materials = exchange.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round(goalBatches * ratio);
            const have = Number(currentHave[ing.name]) || 0;
            const used = ratio > 0 ? Math.round(haveBatches * ratio) : 0;
            const leftover = have - used;
            return { name: ing.name, amount, ratio, have, used, leftover };
        });

        const result = {
            name: exchange.result.name,
            ratio: resultRatio,
            amount: resultGoal,
            have: resultHave,
            // 결과 적재 − 함대 적재량 (+면 적재 초과)
            delta: capacity > 0 ? resultHave - capacity : null,
            capacity,
        };

        return { materials, result, capacity, batches: goalBatches };
    }

    function computeGoals() {
        const plan = computePlan();
        return plan ? plan.materials : null;
    }

    function goalCellHtml(amount) {
        if (amount == null) {
            return '<span class="ot-barter-cell-value ot-barter-goal">—</span>';
        }
        return `<span class="ot-barter-cell-value ot-barter-goal">${amount.toLocaleString()}</span>`;
    }

    function haveCellHtml(amount) {
        if (amount == null) {
            return '<span class="ot-barter-cell-value ot-barter-have">—</span>';
        }
        return `<span class="ot-barter-cell-value ot-barter-have">${amount.toLocaleString()}</span>`;
    }

    function materialHaveMetaHtml(used, leftover) {
        const usedText = used != null ? used.toLocaleString() : '—';
        const leftoverText = leftover != null ? leftover.toLocaleString() : '—';
        return `<div class="ot-barter-have-meta">
          <div class="ot-barter-have-line">사용 ${usedText}</div>
          <div class="ot-barter-have-line">잔량 ${leftoverText}</div>
        </div>`;
    }

    function deltaFromValues(have, goal) {
        if (goal == null) {
            return '<span class="ot-barter-cell-value ot-barter-delta">—</span>';
        }
        const delta = have - goal;
        let percentHtml = '';
        if (goal > 0) {
            const percent = Math.round((have / goal) * 100);
            percentHtml = `<div class="ot-barter-delta-percent">${percent}%</div>`;
        }
        if (delta >= 0) {
            const text = delta === 0 ? '0' : '+' + delta.toLocaleString();
            return `<span class="ot-barter-cell-value ot-barter-delta is-ok">${text}</span>${percentHtml}`;
        }
        return `<span class="ot-barter-cell-value ot-barter-delta is-short">${delta.toLocaleString()}</span>${percentHtml}`;
    }

    function deltaCellHtml(goal, have) {
        return deltaFromValues(have, goal);
    }

    /** 입력란은 유지하고 목표·사용·잔량·초과만 갱신 */
    function updateComputedRows() {
        const { matrixDiv } = els();
        const table = matrixDiv && matrixDiv.querySelector('.ot-barter-table');
        if (!table || !table.tBodies[0]) {
            refreshMatrix();
            return;
        }

        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients) return;

        const plan = computePlan();
        lastGoals = plan ? plan.materials.map(g => ({ name: g.name, amount: g.amount })) : [];
        const matByName = {};
        (plan ? plan.materials : []).forEach(g => { matByName[g.name] = g; });

        const rows = table.tBodies[0].rows;
        const goalRow = rows[1];
        const haveRow = rows[2];
        const deltaRow = rows[3];
        if (!goalRow || !haveRow || !deltaRow) {
            refreshMatrix();
            return;
        }

        exchange.ingredients.forEach((ing, i) => {
            const mat = matByName[ing.name];
            const goal = mat ? mat.amount : null;
            const have = Number(currentHave[ing.name]) || 0;
            const used = mat ? mat.used : 0;
            const leftover = mat ? mat.leftover : have;
            const goalTd = goalRow.cells[i + 1];
            const haveTd = haveRow.cells[i + 1];
            const deltaTd = deltaRow.cells[i + 1];
            if (goalTd) goalTd.innerHTML = goalCellHtml(goal);
            if (deltaTd) deltaTd.innerHTML = deltaCellHtml(goal, have);

            if (haveTd) {
                let meta = haveTd.querySelector('.ot-barter-have-meta');
                const html = materialHaveMetaHtml(used, leftover);
                if (meta) {
                    meta.outerHTML = html;
                } else {
                    haveTd.insertAdjacentHTML('beforeend', html);
                }
            }
        });

        if (exchange.result) {
            const col = exchange.ingredients.length + 1;
            const r = plan && plan.result ? plan.result : null;
            if (goalRow.cells[col]) goalRow.cells[col].innerHTML = goalCellHtml(r ? r.amount : null);
            if (haveRow.cells[col]) haveRow.cells[col].innerHTML = haveCellHtml(r ? r.have : null);
            if (deltaRow.cells[col]) {
                // 결과 초과: 결과 적재 − 함대 적재량
                const cap = r && r.capacity > 0 ? r.capacity : (plan && plan.capacity > 0 ? plan.capacity : null);
                deltaRow.cells[col].innerHTML = (r && cap != null)
                    ? deltaFromValues(r.have, cap)
                    : deltaCellHtml(null, 0);
            }
        }
    }

    function showMatrixEmpty(message) {
        const { matrixDiv } = els();
        if (matrixDiv) matrixDiv.innerHTML = `<div class="ot-barter-empty">${escapeHtml(message)}</div>`;
    }

    function refreshMatrix() {
        const { matrixDiv } = els();
        if (!matrixDiv) return;

        const exchange = currentExchange();
        if (!exchange) {
            lastGoals = [];
            showMatrixEmpty(selectedVillageId ? '교환목록을 선택하세요' : '마을을 선택하세요');
            return;
        }
        if (!exchange.ingredients || !exchange.ingredients.length) {
            lastGoals = [];
            showMatrixEmpty('재료 비율 미등록');
            return;
        }

        const plan = computePlan();
        lastGoals = plan ? plan.materials.map(g => ({ name: g.name, amount: g.amount })) : [];

        const names = exchange.ingredients.map(ing => ing.name);
        const matByName = {};
        (plan ? plan.materials : []).forEach(g => { matByName[g.name] = g; });
        const result = plan && plan.result ? plan.result : null;

        const head = names.map(n => `<th scope="col">${escapeHtml(n)}</th>`).join('')
            + (exchange.result
                ? `<th scope="col" class="ot-barter-result-col">${escapeHtml(exchange.result.name)}</th>`
                : '');

        const ratioCells = names.map(n => {
            const v = currentRatios[n] || '';
            return `<td><input type="number" class="ot-barter-cell-input" min="1"
              data-role="ratio" data-good="${escapeHtml(n)}" value="${escapeHtml(String(v))}"
              aria-label="${escapeHtml(n)} 비율"></td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col"><input type="number" class="ot-barter-cell-input" min="1"
              data-role="ratio" data-good="${escapeHtml(exchange.result.name)}"
              value="${escapeHtml(String(currentResultRatio || exchange.result.defaultRatio || ''))}"
              aria-label="${escapeHtml(exchange.result.name)} 비율"></td>`
                : '');

        const goalCells = names.map(n => {
            const mat = matByName[n];
            return `<td>${goalCellHtml(mat ? mat.amount : null)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${goalCellHtml(result ? result.amount : null)}</td>`
                : '');

        const haveCells = names.map(n => {
            const mat = matByName[n];
            const have = Number(currentHave[n]) || 0;
            const val = have > 0 ? String(have) : '';
            const used = mat ? mat.used : 0;
            const leftover = mat ? mat.leftover : have;
            return `<td class="ot-barter-have-cell"><input type="number" class="ot-barter-cell-input" min="0"
              data-role="have" data-good="${escapeHtml(n)}" value="${escapeHtml(val)}"
              placeholder="0" aria-label="${escapeHtml(n)} 적재">${materialHaveMetaHtml(used, leftover)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${haveCellHtml(result ? result.have : null)}</td>`
                : '');

        const deltaCells = names.map(n => {
            const mat = matByName[n];
            const goal = mat ? mat.amount : null;
            const have = Number(currentHave[n]) || 0;
            return `<td>${deltaCellHtml(goal, have)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${result && result.capacity > 0
                    ? deltaFromValues(result.have, result.capacity)
                    : deltaCellHtml(null, 0)}</td>`
                : '');

        matrixDiv.innerHTML = `
          <table class="ot-barter-table">
            <thead>
              <tr>
                <th scope="col">물품</th>
                ${head}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">비율</th>
                ${ratioCells}
              </tr>
              <tr>
                <th scope="row">목표</th>
                ${goalCells}
              </tr>
              <tr>
                <th scope="row">적재</th>
                ${haveCells}
              </tr>
              <tr>
                <th scope="row">초과</th>
                ${deltaCells}
              </tr>
            </tbody>
          </table>`;
    }

    function sameNameList(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        const sa = a.slice().sort().join('\0');
        const sb = b.slice().sort().join('\0');
        return sa === sb;
    }

    function ingredientNamesForExchange(exchange) {
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return [];
        return exchange.ingredients.map(ing => ing.name);
    }

    function currentIngredientNames() {
        return ingredientNamesForExchange(currentExchange());
    }

    /** 맵용으로 선택된 결과물들의 재료 합집합. 선택 없으면 현재 교환목록 재료. */
    function ingredientNamesForMapFilter() {
        if (mapFilterExchangeIds.length) {
            const seen = Object.create(null);
            const out = [];
            mapFilterExchangeIds.forEach((id) => {
                const names = ingredientNamesForExchange(getExchange(selectedVillageId, id));
                names.forEach((name) => {
                    if (seen[name]) return;
                    seen[name] = true;
                    out.push(name);
                });
            });
            return out;
        }
        return currentIngredientNames();
    }

    function clearMapFilterSelection(alsoClearMap) {
        mapFilterExchangeIds = [];
        if (alsoClearMap && typeof window.clearOriginGoodsFilter === 'function') {
            const current = (typeof window.getOriginGoodsNameFilter === 'function')
                ? window.getOriginGoodsNameFilter()
                : null;
            if (current && current.length) window.clearOriginGoodsFilter();
        }
    }

    function applyMapIngredientFilter(names) {
        if (!names || !names.length) {
            if (typeof window.clearOriginGoodsFilter === 'function') {
                window.clearOriginGoodsFilter();
            }
            return;
        }
        if (typeof window.filterMapByGoodNames === 'function') {
            window.filterMapByGoodNames(names);
        }
    }

    function isIngredientMapFilterOn() {
        const names = ingredientNamesForMapFilter();
        if (!names.length) return false;
        const current = (typeof window.getOriginGoodsNameFilter === 'function')
            ? window.getOriginGoodsNameFilter()
            : null;
        return !!(current && sameNameList(current, names));
    }

    function syncIngredientFilterBtn() {
        const { filterBtn } = els();
        if (!filterBtn) return;
        const on = isIngredientMapFilterOn();
        filterBtn.classList.toggle('is-active', on);
        filterBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        filterBtn.textContent = on ? '재료 항구 표시 해제' : '맵에 재료 항구 표시';
        syncResultButtons();
    }

    function renderResultButtons() {
        const { resultBtns } = els();
        if (!resultBtns) return;
        const village = currentVillage();
        const exchanges = (village && village.exchanges) || [];
        if (!exchanges.length) {
            resultBtns.innerHTML = '';
            return;
        }
        const selected = Object.create(null);
        mapFilterExchangeIds.forEach((id) => { selected[id] = true; });
        resultBtns.innerHTML = exchanges.map((ex) => {
            const label = (ex.result && ex.result.name) || ex.name;
            const on = !!selected[ex.id];
            return `<button type="button" class="ot-barter-result-btn${on ? ' is-active' : ''}" data-exchange-id="${escapeHtml(ex.id)}" aria-pressed="${on ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
        }).join('');
    }

    function syncResultButtons() {
        const { resultBtns } = els();
        if (!resultBtns || !resultBtns.children.length) {
            renderResultButtons();
            return;
        }
        const selected = Object.create(null);
        mapFilterExchangeIds.forEach((id) => { selected[id] = true; });
        resultBtns.querySelectorAll('[data-exchange-id]').forEach((btn) => {
            const on = !!selected[btn.dataset.exchangeId];
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function onResultBtnClick(e) {
        const btn = e.target.closest('[data-exchange-id]');
        if (!btn) return;
        const exchangeId = btn.dataset.exchangeId;
        if (!getExchange(selectedVillageId, exchangeId)) return;

        const idx = mapFilterExchangeIds.indexOf(exchangeId);
        if (idx >= 0) mapFilterExchangeIds.splice(idx, 1);
        else mapFilterExchangeIds.push(exchangeId);

        applyMapIngredientFilter(ingredientNamesForMapFilter());
        syncIngredientFilterBtn();
        renderResultButtons();
    }

    function filterMapByIngredients() {
        const names = ingredientNamesForMapFilter();
        if (!names.length) return;

        if (isIngredientMapFilterOn()) {
            if (mapFilterExchangeIds.length) {
                clearMapFilterSelection(true);
            } else if (typeof window.clearOriginGoodsFilter === 'function') {
                window.clearOriginGoodsFilter();
            }
            syncIngredientFilterBtn();
            renderResultButtons();
            return;
        }

        applyMapIngredientFilter(names);
        syncIngredientFilterBtn();
    }

    window.originBarterInit = init;

    window.getOriginBarterResultName = function () {
        const exchange = currentExchange();
        return (exchange && exchange.result && exchange.result.name) || '';
    };
    window.ORIGIN_BARTER_VILLAGES = BARTER_VILLAGES;
    window.ORIGIN_BARTER_EXCHANGES = BARTER_VILLAGES.flatMap(v => v.exchanges || []);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
