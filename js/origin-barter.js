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
    let inited = false;

    function els() {
        return {
            capacityInput: document.getElementById('barter-capacity'),
            recipeSelect: document.getElementById('barter-recipe'),
            ingredientsDiv: document.getElementById('barter-ingredients'),
            resultsDiv: document.getElementById('barter-results'),
            filterBtn: document.getElementById('barter-filter-map'),
        };
    }

    function init() {
        const { capacityInput, recipeSelect, filterBtn } = els();
        if (!capacityInput || !recipeSelect || inited) return;
        inited = true;

        BARTER_RECIPES.forEach(recipe => {
            const opt = document.createElement('option');
            opt.value = recipe.id;
            opt.textContent = `${recipe.name} (${recipe.village})`;
            recipeSelect.appendChild(opt);
        });

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
