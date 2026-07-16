// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const LS_CAPACITY = 'originBarterCapacity';
    const LS_VILLAGE = 'originBarterVillage';
    const LS_EXCHANGE = 'originBarterExchange';
    const LS_RATIOS = 'originBarterRatios';
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
    let selectedMonth = 1;
    let inited = false;

    function els() {
        return {
            capacityInput: document.getElementById('barter-capacity'),
            villageSelect: document.getElementById('barter-village'),
            exchangeSelect: document.getElementById('barter-exchange'),
            ingredientsDiv: document.getElementById('barter-ingredients'),
            resultsDiv: document.getElementById('barter-results'),
            filterBtn: document.getElementById('barter-filter-map'),
        };
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
        // 레거시 키도 유지 (매스틱)
        if (selectedExchangeId === 'mastic') {
            store.mastic = { ...currentRatios };
        }
        writeRatioStore(store);
    }

    function loadSavedRatios() {
        const store = readRatioStore();
        const key = ratioKey();
        if (key && store[key] && typeof store[key] === 'object') return store[key];
        // 레거시: exchange id만 쓰던 저장
        if (selectedExchangeId && store[selectedExchangeId] && typeof store[selectedExchangeId] === 'object') {
            return store[selectedExchangeId];
        }
        return {};
    }

    function init() {
        const { capacityInput, villageSelect, exchangeSelect, filterBtn } = els();
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
            calculate();
        };

        villageSelect.addEventListener('change', onVillageChange);
        exchangeSelect.addEventListener('change', onExchangeChange);
        capacityInput.addEventListener('input', () => {
            saveCapacity();
            calculate();
        });
        if (filterBtn) {
            filterBtn.addEventListener('click', filterMapByIngredients);
        }

        initSideToolTabs();

        // 복원
        let savedVillage = localStorage.getItem(LS_VILLAGE);
        let savedExchange = localStorage.getItem(LS_EXCHANGE);
        // 레거시 recipe id → 마을/교환
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
            renderIngredients();
            calculate();
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
        renderIngredients();
        calculate();
    }

    function renderIngredients() {
        const { ingredientsDiv } = els();
        if (!ingredientsDiv) return;

        const exchange = currentExchange();
        currentRatios = {};
        ingredientsDiv.innerHTML = '';

        if (!exchange) {
            ingredientsDiv.innerHTML = '<div class="ot-barter-empty">교환목록을 선택하세요</div>';
            return;
        }

        if (!exchange.ingredients || !exchange.ingredients.length) {
            ingredientsDiv.innerHTML = '<div class="ot-barter-empty">재료 비율 미등록 — 게임 화면 비율을 알려주시면 추가합니다</div>';
            return;
        }

        const saved = loadSavedRatios();

        exchange.ingredients.forEach(ing => {
            const ratio = (Number.isFinite(Number(saved[ing.name])) && Number(saved[ing.name]) > 0)
                ? parseInt(saved[ing.name], 10)
                : ing.defaultRatio;
            currentRatios[ing.name] = ratio;

            const row = document.createElement('div');
            row.className = 'ot-barter-ingredient-row';

            const label = document.createElement('label');
            label.textContent = ing.name;
            label.className = 'ot-barter-ingredient-label';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.value = String(ratio);
            input.className = 'ot-barter-ingredient-input';
            input.dataset.ingredientName = ing.name;
            input.addEventListener('input', (e) => {
                currentRatios[ing.name] = parseInt(e.target.value, 10) || 1;
                saveCurrentRatios();
                calculate();
            });

            row.appendChild(label);
            row.appendChild(input);
            ingredientsDiv.appendChild(row);
        });

        saveCurrentRatios();
    }

    function calculate() {
        const { capacityInput, resultsDiv } = els();
        if (!resultsDiv) return;

        const capacity = parseInt(capacityInput && capacityInput.value, 10) || 0;
        const exchange = currentExchange();

        if (!exchange) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">교환목록을 선택하세요</div>';
            return;
        }

        if (!exchange.ingredients || !exchange.ingredients.length) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">재료 비율 미등록</div>';
            return;
        }

        if (capacity <= 0) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">적재량을 입력하세요</div>';
            return;
        }

        const totalRatio = Object.values(currentRatios).reduce((a, b) => a + b, 0);
        if (totalRatio === 0) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">비율을 입력하세요</div>';
            return;
        }

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

        resultsDiv.innerHTML = results.map(r => `
            <div class="ot-barter-result-row">
                <span class="ot-barter-result-name">${r.name}</span>
                <span class="ot-barter-result-amount">${r.amount.toLocaleString()}</span>
            </div>
        `).join('');
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
