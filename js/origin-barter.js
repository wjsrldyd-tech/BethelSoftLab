// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const BARTER_RECIPES = [
        {
            id: 'mastic',
            name: '매스틱',
            village: '튀르크족의 마을',
            ingredients: [
                { name: '은 식기', defaultRatio: 194 },
                { name: '커피', defaultRatio: 174 },
                { name: '포도주', defaultRatio: 174 },
            ],
        },
    ];

    let selectedRecipeId = null;
    let currentRatios = {};
    let selectedMonth = 1;
    let inited = false;

    function els() {
        return {
            monthSelect: document.getElementById('barter-month'),
            capacityInput: document.getElementById('barter-capacity'),
            recipeSelect: document.getElementById('barter-recipe'),
            ingredientsDiv: document.getElementById('barter-ingredients'),
            resultsDiv: document.getElementById('barter-results'),
            filterBtn: document.getElementById('barter-filter-map'),
        };
    }

    function init() {
        const { monthSelect, capacityInput, recipeSelect, filterBtn } = els();
        if (!capacityInput || !recipeSelect || inited) return;
        inited = true;

        const savedMonth = localStorage.getItem('originBarterMonth');
        if (savedMonth) {
            selectedMonth = parseInt(savedMonth, 10);
            if (monthSelect) monthSelect.value = String(selectedMonth);
        }

        BARTER_RECIPES.forEach(recipe => {
            const opt = document.createElement('option');
            opt.value = recipe.id;
            opt.textContent = `${recipe.name} (${recipe.village})`;
            recipeSelect.appendChild(opt);
        });

        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                selectedMonth = parseInt(e.target.value, 10);
                localStorage.setItem('originBarterMonth', String(selectedMonth));
                calculate();
            });
        }

        recipeSelect.addEventListener('change', onRecipeChange);
        capacityInput.addEventListener('input', calculate);
        if (filterBtn) {
            filterBtn.addEventListener('click', filterMapByIngredients);
        }

        initSideToolTabs();

        if (BARTER_RECIPES.length > 0) {
            selectedRecipeId = BARTER_RECIPES[0].id;
            recipeSelect.value = selectedRecipeId;
            onRecipeChange();
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

    function onRecipeChange() {
        const { recipeSelect, ingredientsDiv } = els();
        selectedRecipeId = recipeSelect.value;
        const recipe = BARTER_RECIPES.find(r => r.id === selectedRecipeId);
        if (!recipe || !ingredientsDiv) return;

        currentRatios = {};
        ingredientsDiv.innerHTML = '';

        recipe.ingredients.forEach(ing => {
            currentRatios[ing.name] = ing.defaultRatio;

            const row = document.createElement('div');
            row.className = 'ot-barter-ingredient-row';

            const label = document.createElement('label');
            label.textContent = ing.name;
            label.className = 'ot-barter-ingredient-label';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.value = String(ing.defaultRatio);
            input.className = 'ot-barter-ingredient-input';
            input.dataset.ingredientName = ing.name;
            input.addEventListener('input', (e) => {
                currentRatios[ing.name] = parseInt(e.target.value, 10) || 1;
                calculate();
            });

            row.appendChild(label);
            row.appendChild(input);
            ingredientsDiv.appendChild(row);
        });

        calculate();
    }

    function calculate() {
        const { capacityInput, resultsDiv } = els();
        if (!resultsDiv) return;

        const capacity = parseInt(capacityInput && capacityInput.value, 10) || 0;
        if (capacity <= 0 || !selectedRecipeId) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">적재량을 입력하세요</div>';
            return;
        }

        const recipe = BARTER_RECIPES.find(r => r.id === selectedRecipeId);
        if (!recipe) return;

        const totalRatio = Object.values(currentRatios).reduce((a, b) => a + b, 0);
        if (totalRatio === 0) {
            resultsDiv.innerHTML = '<div class="ot-barter-empty">비율을 입력하세요</div>';
            return;
        }

        const results = recipe.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round((capacity * ratio) / totalRatio);
            const seasonInfo = getIngredientSeasonInfo(ing.name);
            return { name: ing.name, amount, ratio, seasonInfo };
        });

        const totalAmount = results.reduce((a, b) => a + b.amount, 0);
        const diff = capacity - totalAmount;
        if (diff !== 0) {
            const maxItem = results.reduce((a, b) => (a.amount > b.amount ? a : b));
            maxItem.amount += diff;
        }

        resultsDiv.innerHTML = results.map(r => {
            const ports = getIngredientPorts(r.name);
            let portsHtml = '';
            if (ports && ports.length > 0) {
                portsHtml = `
                    <div class="ot-barter-ports-list">
                        ${ports.map(p => {
                            let cssClass = 'ot-barter-port-tag';
                            let icon = '';
                            if (p.isSpecialty) {
                                cssClass += ' is-specialty';
                            }
                            if (p.status === 'peak') {
                                cssClass += ' is-peak';
                                icon = '▲ ';
                            } else if (p.status === 'off') {
                                cssClass += ' is-off';
                                icon = '▼ ';
                            }
                            const specialtyIcon = p.isSpecialty ? '★ ' : '';
                            return `<span class="${cssClass}">${specialtyIcon}${icon}${p.portName}</span>`;
                        }).join('')}
                    </div>
                `;
            }
            return `
                <div class="ot-barter-result-row">
                    <div class="ot-barter-result-header">
                        <span class="ot-barter-result-name">${r.name}</span>
                        <span class="ot-barter-result-amount">${r.amount.toLocaleString()}</span>
                    </div>
                    ${portsHtml}
                </div>
            `;
        }).join('');
    }

    function getIngredientPorts(goodName) {
        if (!window.ORIGIN_PORT_GOODS || !window.getOriginGoodSeasonQtyMult) return [];

        const ports = [];
        for (const portName in window.ORIGIN_PORT_GOODS) {
            const goods = window.ORIGIN_PORT_GOODS[portName];
            const good = goods.find(g => g.name === goodName);
            if (good) {
                let status = 'plain';
                let mult = 1;
                if (window.originGoodHasSeason && window.originGoodHasSeason(good)) {
                    mult = window.getOriginGoodSeasonQtyMult(good, selectedMonth);
                    if (mult > 1) status = 'peak';
                    else if (mult < 1) status = 'off';
                }
                ports.push({ portName, status, multiplier: mult, isSpecialty: good.specialty });
            }
        }
        ports.sort((a, b) => {
            if (a.status === 'peak' && b.status !== 'peak') return -1;
            if (a.status !== 'peak' && b.status === 'peak') return 1;
            if (a.isSpecialty && !b.isSpecialty) return -1;
            if (!a.isSpecialty && b.isSpecialty) return 1;
            return a.portName.localeCompare(b.portName, 'ko');
        });
        return ports;
    }

    function getIngredientSeasonInfo(goodName) {
        const ports = getIngredientPorts(goodName);
        return ports.length > 0 ? ports[0] : null;
    }

    function filterMapByIngredients() {
        const recipe = BARTER_RECIPES.find(r => r.id === selectedRecipeId);
        if (!recipe) return;

        const ingredientNames = recipe.ingredients.map(ing => ing.name);
        if (typeof window.filterMapByGoodNames === 'function') {
            window.filterMapByGoodNames(ingredientNames);
        }
    }

    window.originBarterInit = init;
    window.ORIGIN_BARTER_RECIPES = BARTER_RECIPES;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
