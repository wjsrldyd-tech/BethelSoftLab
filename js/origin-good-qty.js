// =============== origin-good-qty.js ===============
// 항구별 교역품 구매 가능 수량 입력
// 보이는 수량 입력 → 시즌 배수로 나눠 평시(plain_qty)로 DB 저장

(function () {
    'use strict';

    let inited = false;
    let currentPort = null;
    /** @type {Record<string, number>} goodName -> plainQty */
    let plainByGood = {};
    let loadToken = 0;
    const saveTimers = {};

    function els() {
        return {
            list: document.getElementById('ot-qty-list'),
            status: document.getElementById('ot-qty-status'),
        };
    }

    function getMonth() {
        const m = parseInt(localStorage.getItem('originBarterMonth') || '1', 10);
        return (m >= 1 && m <= 12) ? m : 1;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function seasonMeta(good, month) {
        const status = (typeof window.getOriginGoodSeasonStatus === 'function')
            ? window.getOriginGoodSeasonStatus(good, month)
            : 'plain';
        const mult = (typeof window.getOriginGoodSeasonQtyMult === 'function')
            ? window.getOriginGoodSeasonQtyMult(good, month)
            : 1;
        return { status, mult };
    }

    function visibleFromPlain(plain, mult) {
        const v = (Number(plain) || 0) * (Number(mult) || 1);
        if (!v) return '';
        // 표시는 정수 위주. 0.5 배수는 소수 가능
        return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
    }

    function plainFromVisible(visible, mult) {
        const v = Number(visible);
        const m = Number(mult) || 1;
        if (!Number.isFinite(v) || v <= 0) return 0;
        if (m <= 0) return v;
        return Math.round((v / m) * 1000) / 1000;
    }

    function setStatus(msg, isError) {
        const { status } = els();
        if (!status) return;
        status.textContent = msg || '';
        status.classList.toggle('is-error', !!isError);
    }

    function renderEmpty(message) {
        const { list } = els();
        if (list) {
            list.innerHTML = `<div class="ot-qty-empty">${message || '맵에서 항구를 선택하세요.'}</div>`;
        }
    }

    async function renderForPort(portName) {
        const { list } = els();
        if (!list) return;

        currentPort = portName || null;
        plainByGood = {};
        const token = ++loadToken;

        if (!portName) {
            renderEmpty();
            return;
        }

        list.innerHTML = '<div class="ot-qty-empty">불러오는 중…</div>';

        const goods = (typeof window.getOriginPortGoods === 'function')
            ? window.getOriginPortGoods(portName, null, { includeLocked: false })
            : [];

        if (!goods.length) {
            list.innerHTML = '<div class="ot-qty-empty">이 항구의 교역품 데이터가 없습니다.</div>';
            return;
        }

        let saved = [];
        try {
            if (window.originDb && typeof window.originDb.listGoodPlainQtys === 'function') {
                saved = await window.originDb.listGoodPlainQtys(portName);
            }
        } catch (err) {
            console.error('[OriginGoodQty]', err);
            setStatus('수량 불러오기 실패: ' + (err.message || err), true);
        }
        if (token !== loadToken) return;

        for (const row of saved) {
            plainByGood[row.goodName] = row.plainQty;
        }

        const month = getMonth();
        list.innerHTML = goods.map(g => {
            const { status, mult } = seasonMeta(g, month);
            const plain = plainByGood[g.name] || 0;
            const visible = visibleFromPlain(plain, mult);
            let seasonClass = '';
            let seasonMark = '';
            if (status === 'peak') {
                seasonClass = ' is-peak';
                seasonMark = '▲';
            } else if (status === 'off') {
                seasonClass = ' is-off';
                seasonMark = '▼';
            }
            const specialty = g.specialty
                ? '<span class="ot-qty-specialty" title="명산품">★</span>'
                : '';
            const seasonBadge = seasonMark
                ? `<span class="ot-qty-season${seasonClass}" title="${status === 'peak' ? '성수기' : '비수기'}">${seasonMark}</span>`
                : '';

            return `
              <div class="ot-qty-row" data-good="${escapeHtml(g.name)}">
                <div class="ot-qty-info">
                  <span class="ot-qty-name">${specialty}${escapeHtml(g.name)}</span>
                  <span class="ot-qty-cat">${escapeHtml(g.category || '')}</span>
                  ${seasonBadge}
                </div>
                <input type="number" class="ot-qty-input" min="0" step="any"
                  inputmode="decimal" placeholder="—"
                  data-good-name="${escapeHtml(g.name)}"
                  value="${escapeHtml(visible)}"
                  aria-label="${escapeHtml(g.name)} 보이는 수량">
              </div>`;
        }).join('');
    }

    function scheduleSave(goodName, inputEl) {
        if (saveTimers[goodName]) clearTimeout(saveTimers[goodName]);
        saveTimers[goodName] = setTimeout(() => {
            saveOne(goodName, inputEl);
        }, 400);
    }

    async function saveOne(goodName, inputEl) {
        if (!currentPort || !window.originDb) return;
        const month = getMonth();
        const goods = (typeof window.getOriginPortGoods === 'function')
            ? window.getOriginPortGoods(currentPort, null, { includeLocked: false })
            : [];
        const good = goods.find(g => g.name === goodName) || { name: goodName };
        const { mult } = seasonMeta(good, month);
        const raw = (inputEl.value || '').trim();
        const plain = raw === '' ? 0 : plainFromVisible(raw, mult);

        try {
            await window.originDb.saveGoodPlainQty({
                portName: currentPort,
                goodName,
                plainQty: plain,
            });
            if (plain > 0) plainByGood[goodName] = plain;
            else delete plainByGood[goodName];

            // 입력값을 시즌 환산 표시 규격으로 맞추기 (포커스 중이 아닐 때만)
            if (document.activeElement !== inputEl) {
                inputEl.value = visibleFromPlain(plain, mult);
            }
            setStatus(plain > 0
                ? `「${goodName}」평시 ${plain} 저장`
                : `「${goodName}」삭제`);
        } catch (err) {
            console.error('[OriginGoodQty] save', err);
            setStatus('저장 실패: ' + (err.message || err), true);
        }
    }

    function onListInput(e) {
        const input = e.target.closest('.ot-qty-input');
        if (!input) return;
        const goodName = input.dataset.goodName;
        if (!goodName) return;
        scheduleSave(goodName, input);
    }

    function onListChange(e) {
        const input = e.target.closest('.ot-qty-input');
        if (!input) return;
        const goodName = input.dataset.goodName;
        if (!goodName) return;
        if (saveTimers[goodName]) clearTimeout(saveTimers[goodName]);
        saveOne(goodName, input);
    }

    function init() {
        const { list } = els();
        if (!list || inited) return;
        inited = true;

        list.addEventListener('input', onListInput);
        list.addEventListener('change', onListChange);

        window.refreshOriginGoodQty = function (portName) {
            const name = portName != null
                ? portName
                : (typeof window.getOriginSelectedPort === 'function'
                    ? window.getOriginSelectedPort()
                    : currentPort);
            return renderForPort(name);
        };

        window.originGoodQtyOnMonthChange = function () {
            return renderForPort(currentPort);
        };

        renderEmpty();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
