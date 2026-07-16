// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const LS_CAPACITY = 'originBarterCapacity';
    const LS_EXCHANGE = 'originBarterExchange';
    const LS_RATIOS = 'originBarterRatios';
    const LS_HAVE = 'originBarterHave';
    const LS_RECIPE_LEGACY = 'originBarterRecipe';
    const LS_VILLAGE_LEGACY = 'originBarterVillage';

    /**
     * 교환목록 (마을 무관 — 동일 교환은 재료 구성이 같고, 비율만 수동 입력)
     * ingredients: 재료 비율 (defaultRatio)
     * result: 결과물 비율 (defaultRatio)
     * 계획: 적재량 = 결과 목표 → 묶음수 = 적재/결과비율 → 재료 = 묶음수 × 재료비율
     */
    const BARTER_EXCHANGES = [
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
    ];

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

    function getExchange(exchangeId) {
        return BARTER_EXCHANGES.find(e => e.id === exchangeId) || null;
    }

    function currentExchange() {
        return getExchange(selectedExchangeId);
    }

    function ratioKey() {
        return selectedExchangeId || null;
    }

    /** 구버전 키(마을:교환)도 읽기 */
    function pickStoreEntry(store, exchangeId) {
        if (!store || !exchangeId) return null;
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

    function saveSelection() {
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
        return pickStoreEntry(readRatioStore(), selectedExchangeId) || {};
    }

    function loadSavedHave() {
        try {
            const raw = localStorage.getItem(LS_HAVE);
            const store = raw ? JSON.parse(raw) : {};
            const entry = pickStoreEntry(store, selectedExchangeId);
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

    function init() {
        const { capacityInput, exchangeSelect, filterBtn, matrixDiv, progressClearBtn } = els();
        if (!capacityInput || !exchangeSelect || inited) return;
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

        exchangeSelect.innerHTML = '<option value="">선택하세요</option>';
        BARTER_EXCHANGES.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            exchangeSelect.appendChild(opt);
        });

        window.originBarterOnMonthChange = function (month) {
            selectedMonth = parseInt(month, 10);
            if (!(selectedMonth >= 1 && selectedMonth <= 12)) selectedMonth = 1;
            refreshMatrix();
        };

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

        let savedExchange = localStorage.getItem(LS_EXCHANGE);
        const legacyRecipe = localStorage.getItem(LS_RECIPE_LEGACY);
        if (!savedExchange && legacyRecipe && getExchange(legacyRecipe)) {
            savedExchange = legacyRecipe;
        }

        const prefer = (savedExchange && getExchange(savedExchange))
            ? savedExchange
            : (BARTER_EXCHANGES[0] && BARTER_EXCHANGES[0].id);

        if (prefer) {
            selectedExchangeId = prefer;
            exchangeSelect.value = prefer;
            onExchangeChange();
        } else {
            showMatrixEmpty('교환목록을 선택하세요');
        }

        try { localStorage.removeItem(LS_VILLAGE_LEGACY); } catch { /* ignore */ }
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
     * 결과 목표: 적재량 (배에 채울 결과물 수량)
     * 묶음수: 적재량 / 결과비율
     * 재료 목표: 묶음수 × 각 재료비율
     * 결과 현황: 적재량 (목표와 동일 = 만재 기준)
     * 결과 과부족: 0
     */
    function computePlan() {
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return null;
        if (!exchange.result) return null;

        const capacity = getCapacity();
        if (capacity <= 0) return null;

        const resultRatio = currentResultRatio || exchange.result.defaultRatio || 0;
        if (resultRatio <= 0) return null;

        const hasMaterialRatio = exchange.ingredients.some(ing => (currentRatios[ing.name] || 0) > 0);
        if (!hasMaterialRatio) return null;

        // 적재량만큼 결과물을 얻기 위한 교환 묶음 수
        const batches = capacity / resultRatio;

        const materials = exchange.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round(batches * ratio);
            return { name: ing.name, amount, ratio };
        });

        const result = {
            name: exchange.result.name,
            ratio: resultRatio,
            amount: capacity,
            have: capacity,
            delta: 0,
        };

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

    function haveCellHtml(amount, goal) {
        if (amount == null) {
            return '<span class="ot-barter-cell-value ot-barter-have">—</span>';
        }
        let percentText = '';
        if (goal != null && goal > 0) {
            const percent = Math.round((amount / goal) * 100);
            percentText = ` <span style="font-size: 0.85em; color: rgba(148, 163, 184, 0.85);">(${percent}%)</span>`;
        }
        return `<span class="ot-barter-cell-value ot-barter-have">${amount.toLocaleString()}${percentText}</span>`;
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
            const haveTd = haveRow.cells[i + 1];
            const deltaTd = deltaRow.cells[i + 1];
            if (goalTd) goalTd.innerHTML = goalCellHtml(goal);
            if (deltaTd) deltaTd.innerHTML = deltaCellHtml(goal, have);

            // 재료 현황 셀의 퍼센트 표시 업데이트
            if (haveTd) {
                let percentDiv = haveTd.querySelector('.ot-barter-have-percent');
                if (have > 0 && goal != null && goal > 0) {
                    const percent = Math.round((have / goal) * 100);
                    if (!percentDiv) {
                        percentDiv = document.createElement('div');
                        percentDiv.className = 'ot-barter-have-percent';
                        percentDiv.style.fontSize = '0.8em';
                        percentDiv.style.color = 'rgba(148, 163, 184, 0.75)';
                        percentDiv.style.textAlign = 'center';
                        percentDiv.style.marginTop = '0.15rem';
                        haveTd.appendChild(percentDiv);
                    }
                    percentDiv.textContent = `${percent}%`;
                } else if (percentDiv) {
                    percentDiv.remove();
                }
            }
        });

        if (exchange.result) {
            const col = exchange.ingredients.length + 1;
            const r = plan && plan.result ? plan.result : null;
            if (goalRow.cells[col]) goalRow.cells[col].innerHTML = goalCellHtml(r ? r.amount : null);
            if (haveRow.cells[col]) haveRow.cells[col].innerHTML = haveCellHtml(r ? r.have : null, r ? r.amount : null);
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
            const goal = goalByName[n];
            let percentHtml = '';
            if (have > 0 && goal != null && goal > 0) {
                const percent = Math.round((have / goal) * 100);
                percentHtml = `<div class="ot-barter-have-percent" style="font-size: 0.8em; color: rgba(148, 163, 184, 0.75); text-align: center; margin-top: 0.15rem;">${percent}%</div>`;
            }
            return `<td><input type="number" class="ot-barter-cell-input" min="0"
              data-role="have" data-good="${escapeHtml(n)}" value="${escapeHtml(val)}"
              placeholder="0" aria-label="${escapeHtml(n)} 현황">${percentHtml}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${haveCellHtml(result ? result.have : null, result ? result.amount : null)}</td>`
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
    window.ORIGIN_BARTER_EXCHANGES = BARTER_EXCHANGES;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
