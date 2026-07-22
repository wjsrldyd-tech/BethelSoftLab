// =============== origin-barter-sales.js ===============
// 물물교환 품목 판매 기록 (교환목록 결과품 + 맵 항구 + 시세 → 100% 단가)
// 품목별 최고가(단가+항구) 요약 + 품목 클릭 시 최근 기록 필터

(function () {
    'use strict';

    const LIST_LIMIT = 200;
    const RECENT_LIMIT = 50;

    let inited = false;
    let listCache = [];
    let filterGoodName = '';

    function els() {
        return {
            openBtn: document.getElementById('barter-sales-open'),
            overlay: document.getElementById('ot-sales-overlay'),
            closeBtn: document.getElementById('ot-sales-close'),
            portEl: document.getElementById('ot-sales-port'),
            goodEl: document.getElementById('ot-sales-good'),
            marketInput: document.getElementById('ot-sales-market'),
            saleInput: document.getElementById('ot-sales-price'),
            unitEl: document.getElementById('ot-sales-unit'),
            saveBtn: document.getElementById('ot-sales-save'),
            statusEl: document.getElementById('ot-sales-status'),
            listEl: document.getElementById('ot-sales-list'),
            bestListEl: document.getElementById('ot-sales-best-list'),
            recentTitleEl: document.getElementById('ot-sales-recent-title'),
            filterClearBtn: document.getElementById('ot-sales-filter-clear'),
        };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatNum(n) {
        const v = Number(n);
        if (!Number.isFinite(v)) return '—';
        return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mm}/${dd} ${hh}:${mi}`;
    }

    function selectedPort() {
        return (typeof window.getOriginSelectedPort === 'function')
            ? (window.getOriginSelectedPort() || '')
            : '';
    }

    function selectedGoodName() {
        if (typeof window.getOriginBarterResultName === 'function') {
            return window.getOriginBarterResultName() || '';
        }
        return '';
    }

    function calcUnit() {
        const { marketInput, saleInput, unitEl } = els();
        if (!unitEl) return 0;
        const market = Number(marketInput && marketInput.value);
        const sale = Number(saleInput && saleInput.value);
        const fn = window.originDb && window.originDb.calcBarterUnitPrice;
        const unit = fn
            ? fn(sale, market)
            : ((Number.isFinite(sale) && sale > 0 && Number.isFinite(market) && market > 0)
                ? Math.round((sale * 100) / market)
                : 0);
        unitEl.textContent = unit > 0 ? formatNum(unit) : '—';
        return unit;
    }

    function setStatus(msg, isError) {
        const { statusEl } = els();
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-error', !!isError);
    }

    function setReadonlyField(el, value, emptyMsg) {
        if (!el) return;
        if (value) {
            el.textContent = value;
            el.classList.remove('is-empty');
        } else {
            el.textContent = emptyMsg;
            el.classList.add('is-empty');
        }
    }

    function refreshPort() {
        const { portEl } = els();
        setReadonlyField(portEl, selectedPort(), '맵에서 항구를 선택하세요');
    }

    function refreshGood() {
        const { goodEl } = els();
        setReadonlyField(goodEl, selectedGoodName(), '교환목록을 선택하세요');
    }

    /** 품목별 최고 단가(+항구). 동점이면 더 최근 soldAt 우선 */
    function buildBestByGood(sales) {
        const map = new Map();
        for (const s of sales) {
            const name = (s.goodName || '').trim();
            if (!name) continue;
            const unit = Number(s.unitPrice);
            if (!Number.isFinite(unit) || unit <= 0) continue;
            const prev = map.get(name);
            if (!prev) {
                map.set(name, s);
                continue;
            }
            const prevUnit = Number(prev.unitPrice);
            if (unit > prevUnit) {
                map.set(name, s);
            } else if (unit === prevUnit) {
                const a = new Date(s.soldAt).getTime();
                const b = new Date(prev.soldAt).getTime();
                if (a > b) map.set(name, s);
            }
        }
        return Array.from(map.values()).sort((a, b) => {
            const du = Number(b.unitPrice) - Number(a.unitPrice);
            if (du !== 0) return du;
            return String(a.goodName).localeCompare(String(b.goodName), 'ko');
        });
    }

    function updateRecentTitle() {
        const { recentTitleEl, filterClearBtn } = els();
        if (recentTitleEl) {
            recentTitleEl.textContent = filterGoodName
                ? `최근 기록 · ${filterGoodName}`
                : '최근 기록';
        }
        if (filterClearBtn) {
            filterClearBtn.hidden = !filterGoodName;
        }
    }

    function renderBestList() {
        const { bestListEl } = els();
        if (!bestListEl) return;
        const bests = buildBestByGood(listCache);
        if (!bests.length) {
            bestListEl.innerHTML = '<div class="ot-sales-empty">저장된 기록이 없습니다</div>';
            return;
        }
        bestListEl.innerHTML = bests.map(s => {
            const active = filterGoodName === s.goodName ? ' is-active' : '';
            return `
          <button type="button" class="ot-sales-best-item${active}" data-good="${escapeHtml(s.goodName)}">
            <span class="ot-sales-best-good">${escapeHtml(s.goodName)}</span>
            <span class="ot-sales-best-unit">${formatNum(s.unitPrice)}</span>
            <span class="ot-sales-best-port">${escapeHtml(s.portName)}</span>
          </button>`;
        }).join('');
    }

    function renderList() {
        const { listEl } = els();
        if (!listEl) return;
        updateRecentTitle();

        let rows = listCache;
        if (filterGoodName) {
            rows = listCache.filter(s => s.goodName === filterGoodName);
        } else {
            rows = listCache.slice(0, RECENT_LIMIT);
        }

        if (!rows.length) {
            listEl.innerHTML = filterGoodName
                ? '<div class="ot-sales-empty">이 품목의 기록이 없습니다</div>'
                : '<div class="ot-sales-empty">저장된 기록이 없습니다</div>';
            return;
        }
        listEl.innerHTML = rows.map(s => `
          <div class="ot-sales-item" data-id="${escapeHtml(s.id)}">
            <div class="ot-sales-item-good">${escapeHtml(s.goodName)}</div>
            <div class="ot-sales-item-port">${escapeHtml(s.portName)}</div>
            <div class="ot-sales-item-market">${formatNum(s.marketPct)}%</div>
            <div class="ot-sales-item-price">${formatNum(s.salePrice)}</div>
            <div class="ot-sales-item-unit">${formatNum(s.unitPrice)}</div>
            <div class="ot-sales-item-time">${escapeHtml(formatDate(s.soldAt))}</div>
            <button type="button" class="ot-sales-del" data-id="${escapeHtml(s.id)}" aria-label="삭제">×</button>
          </div>
        `).join('');
    }

    function renderAll() {
        renderBestList();
        renderList();
    }

    function setFilterGood(goodName) {
        const next = (goodName || '').trim();
        filterGoodName = (filterGoodName && filterGoodName === next) ? '' : next;
        renderAll();
    }

    function clearFilter() {
        filterGoodName = '';
        renderAll();
    }

    async function loadList() {
        if (!window.originDb || typeof window.originDb.listBarterSales !== 'function') {
            listCache = [];
            renderAll();
            return;
        }
        try {
            listCache = await window.originDb.listBarterSales({ limit: LIST_LIMIT });
            if (filterGoodName && !listCache.some(s => s.goodName === filterGoodName)) {
                filterGoodName = '';
            }
            renderAll();
        } catch (err) {
            console.error('[BarterSales] list', err);
            setStatus('목록 불러오기 실패: ' + (err.message || err), true);
        }
    }

    function openModal() {
        const { overlay, marketInput, saleInput } = els();
        if (!overlay) return;
        refreshGood();
        refreshPort();
        if (marketInput) marketInput.value = '';
        if (saleInput) saleInput.value = '';
        calcUnit();
        setStatus('');
        overlay.hidden = false;
        loadList();
        if (marketInput) marketInput.focus();
    }

    function closeModal() {
        const { overlay } = els();
        if (overlay) overlay.hidden = true;
    }

    async function saveSale() {
        const { marketInput, saleInput, saveBtn } = els();
        const goodName = selectedGoodName();
        const portName = selectedPort();
        if (!goodName) {
            setStatus('물물교환에서 교환목록을 먼저 선택하세요.', true);
            return;
        }
        if (!portName) {
            setStatus('맵에서 판매처 항구를 먼저 선택하세요.', true);
            return;
        }
        const marketPct = Number(marketInput && marketInput.value);
        const salePrice = Number(saleInput && saleInput.value);
        if (!window.originDb || typeof window.originDb.saveBarterSale !== 'function') {
            setStatus('DB가 준비되지 않았습니다.', true);
            return;
        }

        if (saveBtn) saveBtn.disabled = true;
        try {
            const saved = await window.originDb.saveBarterSale({
                goodName,
                portName,
                marketPct,
                salePrice,
            });
            setStatus(`「${saved.goodName}」단가 ${formatNum(saved.unitPrice)} 저장`);
            if (saleInput) saleInput.value = '';
            calcUnit();
            await loadList();
        } catch (err) {
            console.error('[BarterSales] save', err);
            setStatus('저장 실패: ' + (err.message || err), true);
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async function deleteSale(id) {
        if (!id || !window.originDb) return;
        if (!confirm('이 판매 기록을 삭제할까요?')) return;
        try {
            await window.originDb.deleteBarterSale(id);
            setStatus('삭제했습니다.');
            await loadList();
        } catch (err) {
            console.error('[BarterSales] delete', err);
            setStatus('삭제 실패: ' + (err.message || err), true);
        }
    }

    function init() {
        const {
            openBtn, overlay, closeBtn, marketInput, saleInput, saveBtn,
            listEl, bestListEl, filterClearBtn,
        } = els();
        if (!openBtn || !overlay || inited) return;
        inited = true;

        openBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        let overlayPointerDownOnBackdrop = false;
        overlay.addEventListener('pointerdown', (e) => {
            overlayPointerDownOnBackdrop = e.target === overlay;
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && overlayPointerDownOnBackdrop) closeModal();
            overlayPointerDownOnBackdrop = false;
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.hidden) closeModal();
        });

        if (marketInput) marketInput.addEventListener('input', calcUnit);
        if (saleInput) saleInput.addEventListener('input', calcUnit);
        if (saveBtn) saveBtn.addEventListener('click', saveSale);
        if (filterClearBtn) filterClearBtn.addEventListener('click', clearFilter);

        if (bestListEl) {
            bestListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.ot-sales-best-item');
                if (!btn) return;
                setFilterGood(btn.dataset.good || '');
            });
        }

        if (listEl) {
            listEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.ot-sales-del');
                if (!btn) return;
                deleteSale(btn.dataset.id);
            });
        }

        window.addEventListener('origin-port-selected', () => {
            if (!overlay.hidden) refreshPort();
        });
        window.addEventListener('origin-barter-exchange-changed', () => {
            if (!overlay.hidden) refreshGood();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
