// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const LS_CAPACITY = 'originBarterCapacity';
    const LS_VILLAGE = 'originBarterVillage';
    const LS_EXCHANGE = 'originBarterExchange';
    const LS_RATIOS = 'originBarterRatios';
    const LS_HAVE = 'originBarterHave';
    const LS_RECIPE_LEGACY = 'originBarterRecipe';

    /**
     * 마을별 교환목록
     * ingredients: 재료 비율 (defaultRatio)
     * result: 결과물 비율 (defaultRatio) — 재료 나눔에 포함하지 않음
     */
    const BARTER_VILLAGES = [
        {
            id: 'turk',
            name: '튀르크족의 마을',
            exchanges: [
                {
                    id: 'mastic',
                    name: '매스틱',
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
                    result: { name: '다마스쿠스 강철', defaultRatio: 626 },
                    ingredients: [
                        { name: '철광석', defaultRatio: 174 },
                        { name: '석탄', defaultRatio: 174 },
                        { name: '목재', defaultRatio: 174 },
                    ],
                },
            ],
        },
    ];

    let selectedVillageId = null;
    let selectedExchangeId = null;
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
            matrixDiv: document.getElementById('barter-matrix'),
            progressClearBtn: document.getElementById('barter-progress-clear'),
            filterBtn: document.getElementById('barter-filter-map'),
        };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getVillage(id) {
        return BARTER_VILLAGES.find(v => v.id === id) || null;
    }

    function getExchange(villageId, exchangeId) {
        const village = getVillage(villageId);
        if (!village) return null;
        return village.exchanges.find(e => e.id === exchangeId) || null;
    }

    function currentExchange() {
        return getExchange(selectedVillageId, selectedExchangeId);
    }

    function ratioKey() {
        if (!selectedVillageId || !selectedExchangeId) return null;
        return selectedVillageId + ':' + selectedExchangeId;
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
        if (selectedExchangeId === 'mastic') {
            store.mastic = { ...payload };
        }
        writeRatioStore(store);
    }

    function loadSavedRatios() {
        const store = readRatioStore();
        const key = ratioKey();
        if (key && store[key] && typeof store[key] === 'object') return store[key];
        if (selectedExchangeId && store[selectedExchangeId] && typeof store[selectedExchangeId] === 'object') {
            return store[selectedExchangeId];
        }
        return {};
    }

    function loadSavedHave() {
        try {
            const raw = localStorage.getItem(LS_HAVE);
            const store = raw ? JSON.parse(raw) : {};
            const key = ratioKey();
            if (key && store && typeof store === 'object' && store[key] && typeof store[key] === 'object') {
                return { ...store[key] };
            }
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

    function init() {
        const { capacityInput, villageSelect, exchangeSelect, filterBtn, matrixDiv, progressClearBtn } = els();
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

        BARTER_VILLAGES.forEach(village => {
            const opt = document.createElement('option');
            opt.value = village.id;
            opt.textContent = village.name;
            villageSelect.appendChild(opt);
        });

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
        if (filterBtn) {
            filterBtn.addEventListener('click', filterMapByIngredients);
        }
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
        if ((!savedVillage || !savedExchange) && legacyRecipe) {
            for (const v of BARTER_VILLAGES) {
                if (v.exchanges.some(e => e.id === legacyRecipe)) {
                    savedVillage = v.id;
                    savedExchange = legacyRecipe;
                    break;
                }
            }
        }

        if (savedVillage && getVillage(savedVillage)) {
            selectedVillageId = savedVillage;
        } else if (BARTER_VILLAGES.length > 0) {
            selectedVillageId = BARTER_VILLAGES[0].id;
        }

        if (selectedVillageId) {
            villageSelect.value = selectedVillageId;
            fillExchangeOptions(savedExchange);
        }
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

    function fillExchangeOptions(preferExchangeId) {
        const { exchangeSelect } = els();
        const village = getVillage(selectedVillageId);
        if (!exchangeSelect || !village) return;

        exchangeSelect.innerHTML = '<option value="">선택하세요</option>';
        village.exchanges.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            exchangeSelect.appendChild(opt);
        });

        const prefer = preferExchangeId && village.exchanges.some(e => e.id === preferExchangeId)
            ? preferExchangeId
            : (village.exchanges[0] && village.exchanges[0].id);

        if (prefer) {
            selectedExchangeId = prefer;
            exchangeSelect.value = prefer;
            onExchangeChange();
        } else {
            selectedExchangeId = null;
            currentRatios = {};
            currentResultRatio = 0;
            currentHave = {};
            lastGoals = [];
            showMatrixEmpty('교환목록을 선택하세요');
        }
    }

    function onVillageChange() {
        const { villageSelect } = els();
        selectedVillageId = villageSelect.value || null;
        saveSelection();
        fillExchangeOptions(null);
    }

    function onExchangeChange() {
        const { exchangeSelect } = els();
        selectedExchangeId = exchangeSelect.value || null;
        saveSelection();
        loadRatiosIntoState();
        currentHave = loadSavedHave();
        refreshMatrix();
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
     * 재료 목표: 적재량을 재료 비율만으로 분배
     * 결과 목표: (재료목표 / 재료비율) × 결과비율  (적재량 직접 사용 안 함)
     * 결과 현황: 적재량
     * 결과 과부족: 적재량 − 결과목표
     */
    function computePlan() {
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return null;

        const capacity = getCapacity();
        if (capacity <= 0) return null;

        const totalRatio = exchange.ingredients.reduce((sum, ing) => {
            return sum + (currentRatios[ing.name] || 0);
        }, 0);
        if (totalRatio === 0) return null;

        const materials = exchange.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round((capacity * ratio) / totalRatio);
            return { name: ing.name, amount, ratio };
        });

        const totalAmount = materials.reduce((a, b) => a + b.amount, 0);
        const diff = capacity - totalAmount;
        if (diff !== 0) {
            const maxItem = materials.reduce((a, b) => (a.amount > b.amount ? a : b));
            maxItem.amount += diff;
        }

        let result = null;
        if (exchange.result) {
            const resultRatio = currentResultRatio || exchange.result.defaultRatio || 0;
            // 재료 목표에서 묶음 수 산출 (비율 있는 항목 평균 → 반올림 오차 ±1 흡수)
            let batchSum = 0;
            let batchCount = 0;
            materials.forEach(m => {
                if (m.ratio > 0) {
                    batchSum += m.amount / m.ratio;
                    batchCount += 1;
                }
            });
            const batches = batchCount > 0 ? (batchSum / batchCount) : 0;
            const amount = Math.round(batches * resultRatio);
            result = {
                name: exchange.result.name,
                ratio: resultRatio,
                amount,
                have: capacity,
                delta: capacity - amount,
            };
        }

        return { materials, result, capacity };
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

    function deltaFromValues(have, goal) {
        if (goal == null) {
            return '<span class="ot-barter-cell-value ot-barter-delta">—</span>';
        }
        const delta = have - goal;
        if (delta >= 0) {
            const text = delta === 0 ? '0' : '+' + delta.toLocaleString();
            return `<span class="ot-barter-cell-value ot-barter-delta is-ok">${text}</span>`;
        }
        return `<span class="ot-barter-cell-value ot-barter-delta is-short">${delta.toLocaleString()}</span>`;
    }

    function deltaCellHtml(goal, have) {
        return deltaFromValues(have, goal);
    }

    /** 입력란은 유지하고 목표·현황(결과)·과부족만 갱신 */
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
        const goalByName = {};
        (plan ? plan.materials : []).forEach(g => { goalByName[g.name] = g.amount; });

        const rows = table.tBodies[0].rows;
        const goalRow = rows[1];
        const haveRow = rows[2];
        const deltaRow = rows[3];
        if (!goalRow || !haveRow || !deltaRow) {
            refreshMatrix();
            return;
        }

        exchange.ingredients.forEach((ing, i) => {
            const goal = goalByName[ing.name];
            const have = Number(currentHave[ing.name]) || 0;
            const goalTd = goalRow.cells[i + 1];
            const deltaTd = deltaRow.cells[i + 1];
            if (goalTd) goalTd.innerHTML = goalCellHtml(goal);
            if (deltaTd) deltaTd.innerHTML = deltaCellHtml(goal, have);
        });

        if (exchange.result) {
            const col = exchange.ingredients.length + 1;
            const r = plan && plan.result ? plan.result : null;
            if (goalRow.cells[col]) goalRow.cells[col].innerHTML = goalCellHtml(r ? r.amount : null);
            if (haveRow.cells[col]) haveRow.cells[col].innerHTML = haveCellHtml(r ? r.have : null);
            if (deltaRow.cells[col]) {
                deltaRow.cells[col].innerHTML = r
                    ? deltaFromValues(r.have, r.amount)
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
            showMatrixEmpty('교환목록을 선택하세요');
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
        const goalByName = {};
        (plan ? plan.materials : []).forEach(g => { goalByName[g.name] = g.amount; });
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

        const goalCells = names.map(n => `<td>${goalCellHtml(goalByName[n])}</td>`).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${goalCellHtml(result ? result.amount : null)}</td>`
                : '');

        const haveCells = names.map(n => {
            const have = Number(currentHave[n]) || 0;
            const val = have > 0 ? String(have) : '';
            return `<td><input type="number" class="ot-barter-cell-input" min="0"
              data-role="have" data-good="${escapeHtml(n)}" value="${escapeHtml(val)}"
              placeholder="0" aria-label="${escapeHtml(n)} 현황"></td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${haveCellHtml(result ? result.have : null)}</td>`
                : '');

        const deltaCells = names.map(n => {
            const goal = goalByName[n];
            const have = Number(currentHave[n]) || 0;
            return `<td>${deltaCellHtml(goal, have)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${result
                    ? deltaFromValues(result.have, result.amount)
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
                <th scope="row">현황</th>
                ${haveCells}
              </tr>
              <tr>
                <th scope="row">과부족</th>
                ${deltaCells}
              </tr>
            </tbody>
          </table>`;
    }

    function filterMapByIngredients() {
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return;

        const ingredientNames = exchange.ingredients.map(ing => ing.name);
        if (typeof window.filterMapByGoodNames === 'function') {
            window.filterMapByGoodNames(ingredientNames);
        }
    }

    window.originBarterInit = init;
    window.ORIGIN_BARTER_VILLAGES = BARTER_VILLAGES;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
