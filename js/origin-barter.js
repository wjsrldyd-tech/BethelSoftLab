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
     * ingredients: 게임 교환 화면의 재료 비율 (defaultRatio)
     */
    const BARTER_VILLAGES = [
        {
            id: 'turk',
            name: '튀르크족의 마을',
            exchanges: [
                {
                    id: 'mastic',
                    name: '매스틱',
                    ingredients: [
                        { name: '은 식기', defaultRatio: 194 },
                        { name: '커피', defaultRatio: 174 },
                        { name: '포도주', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'chaidanruk',
                    name: '차이단륵',
                    ingredients: [
                        { name: '사금', defaultRatio: 174 },
                        { name: '주석 광석', defaultRatio: 174 },
                        { name: '아주라이트', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'damascus_steel',
                    name: '다마스쿠스 강철',
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
    let currentRatios = {};
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
        const store = readRatioStore();
        store[key] = { ...currentRatios };
        if (selectedExchangeId === 'mastic') {
            store.mastic = { ...currentRatios };
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

        const savedMonth = parseInt(localStorage.getItem('originBarterMonth') || '1', 10);
        selectedMonth = (savedMonth >= 1 && savedMonth <= 12) ? savedMonth : 1;

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
        if (!exchange || !exchange.ingredients) return;
        const saved = loadSavedRatios();
        exchange.ingredients.forEach(ing => {
            const ratio = (Number.isFinite(Number(saved[ing.name])) && Number(saved[ing.name]) > 0)
                ? parseInt(saved[ing.name], 10)
                : ing.defaultRatio;
            currentRatios[ing.name] = ratio;
        });
        saveCurrentRatios();
    }

    function onMatrixInput(e) {
        const input = e.target.closest('.ot-barter-cell-input');
        if (!input) return;
        const role = input.dataset.role;
        const name = input.dataset.good;
        if (!role || !name) return;

        if (role === 'ratio') {
            currentRatios[name] = parseInt(input.value, 10) || 1;
            saveCurrentRatios();
            refreshMatrix({ keepFocus: input });
            return;
        }

        if (role === 'have') {
            const n = parseInt(input.value, 10);
            if (Number.isFinite(n) && n > 0) currentHave[name] = n;
            else delete currentHave[name];
            saveCurrentHave();
            refreshMatrix({ keepFocus: input });
        }
    }

    function computeGoals() {
        const { capacityInput } = els();
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return null;

        const capacity = parseInt(capacityInput && capacityInput.value, 10) || 0;
        if (capacity <= 0) return null;

        const totalRatio = Object.values(currentRatios).reduce((a, b) => a + b, 0);
        if (totalRatio === 0) return null;

        const results = exchange.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round((capacity * ratio) / totalRatio);
            return { name: ing.name, amount, ratio };
        });

        const totalAmount = results.reduce((a, b) => a + b.amount, 0);
        const diff = capacity - totalAmount;
        if (diff !== 0) {
            const maxItem = results.reduce((a, b) => (a.amount > b.amount ? a : b));
            maxItem.amount += diff;
        }
        return results;
    }

    function showMatrixEmpty(message) {
        const { matrixDiv } = els();
        if (matrixDiv) matrixDiv.innerHTML = `<div class="ot-barter-empty">${escapeHtml(message)}</div>`;
    }

    function refreshMatrix(opts) {
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

        const goals = computeGoals();
        lastGoals = goals ? goals.map(g => ({ name: g.name, amount: g.amount })) : [];

        const names = exchange.ingredients.map(ing => ing.name);
        const goalByName = {};
        (goals || []).forEach(g => { goalByName[g.name] = g.amount; });

        const head = names.map(n => `<th scope="col">${escapeHtml(n)}</th>`).join('');

        const ratioCells = names.map(n => {
            const v = currentRatios[n] || '';
            return `<td><input type="number" class="ot-barter-cell-input" min="1"
              data-role="ratio" data-good="${escapeHtml(n)}" value="${escapeHtml(String(v))}"
              aria-label="${escapeHtml(n)} 비율"></td>`;
        }).join('');

        const goalCells = names.map(n => {
            const amount = goalByName[n];
            if (amount == null) {
                return '<td><span class="ot-barter-cell-value ot-barter-goal">—</span></td>';
            }
            return `<td><span class="ot-barter-cell-value ot-barter-goal">${amount.toLocaleString()}</span></td>`;
        }).join('');

        const haveCells = names.map(n => {
            const have = Number(currentHave[n]) || 0;
            const val = have > 0 ? String(have) : '';
            return `<td><input type="number" class="ot-barter-cell-input" min="0"
              data-role="have" data-good="${escapeHtml(n)}" value="${escapeHtml(val)}"
              placeholder="0" aria-label="${escapeHtml(n)} 현황"></td>`;
        }).join('');

        const deltaCells = names.map(n => {
            const goal = goalByName[n];
            if (goal == null) {
                return '<td><span class="ot-barter-cell-value ot-barter-delta">—</span></td>';
            }
            const have = Number(currentHave[n]) || 0;
            const delta = have - goal; // 현황 − 목표
            if (delta >= 0) {
                const text = delta === 0 ? '0' : '+' + delta.toLocaleString();
                return `<td><span class="ot-barter-cell-value ot-barter-delta is-ok">${text}</span></td>`;
            }
            return `<td><span class="ot-barter-cell-value ot-barter-delta is-short">${delta.toLocaleString()}</span></td>`;
        }).join('');

        const focusRole = opts && opts.keepFocus && opts.keepFocus.dataset.role;
        const focusGood = opts && opts.keepFocus && opts.keepFocus.dataset.good;

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

        if (focusRole && focusGood) {
            const el = Array.from(matrixDiv.querySelectorAll('.ot-barter-cell-input')).find(
                i => i.dataset.role === focusRole && i.dataset.good === focusGood
            );
            if (el) {
                el.focus();
                try {
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                } catch { /* ignore */ }
            }
        }
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
