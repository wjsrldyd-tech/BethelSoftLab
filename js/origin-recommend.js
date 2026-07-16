// =============== origin-recommend.js ===============
// 교역 루트별 추천 필터 (시세표 순위 기반, 루트 추가 가능)

(function () {
    'use strict';

    const TIER_SIZE = 10;
    const TIER_COUNT = 5;

    /**
     * 루트별 추천 목록
     * ranked: 매각 기준차익 순위 (1위부터), 10개씩 추천1~5
     */
    const RECOMMEND_ROUTES = [
        {
            id: 'ea-blacksea-taganrog',
            title: '동아시아→흑해 : 타간로크',
            mapView: 'eastasia',
            ranked: [
                // 1~10
                '금목서', '치자나무', '진달래', '해당화', '동양 대포',
                '중국화', '니시진오리', '자수정', '호안석', '가지',
                // 11~20
                '중국차', '일본화', '화창', '고려청자', '인삼',
                '명주', '촉금', '당금', '칠기', '나전 칠기',
                // 21~30
                '복분자', '차', '슈리오리', '빈가타', '모시',
                '마상총', '청화 백자', '순백자', '철화 백자', '유자',
                // 31~40
                '전승정종', '청주', '막걸리', '된장', '두반장',
                '흑식초', '뇌록', '석웅황', '자근', '오배자',
                // 41~50
                '감송', '팔각', '산초', '조선 활', '일본도',
                '삼절곤', '호필', '서화', '초롱', '와시',
            ],
        },
        // 예: { id: 'caribbean-ea', title: '카리브 → 동아시아', mapView: 'eastasia', ranked: [...] },
        // 예: { id: 'ea-caribbean', title: '동아시아 → 카리브', mapView: 'caribbean', ranked: [...] },
    ];

    /** @type {Set<string>} "routeId:tier" */
    const selected = new Set();

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function selKey(routeId, tier) {
        return routeId + ':' + tier;
    }

    function parseKey(key) {
        const i = key.indexOf(':');
        if (i < 0) return null;
        const tier = parseInt(key.slice(i + 1), 10);
        if (!(tier >= 1 && tier <= TIER_COUNT)) return null;
        return { routeId: key.slice(0, i), tier };
    }

    function findRoute(routeId) {
        return RECOMMEND_ROUTES.find(r => r.id === routeId) || null;
    }

    function tierGoods(route, tier) {
        const start = (tier - 1) * TIER_SIZE;
        return (route.ranked || []).slice(start, start + TIER_SIZE);
    }

    function selectedGoodNames() {
        const names = [];
        const seen = new Set();
        for (const key of selected) {
            const parsed = parseKey(key);
            if (!parsed) continue;
            const route = findRoute(parsed.routeId);
            if (!route) continue;
            for (const name of tierGoods(route, parsed.tier)) {
                if (seen.has(name)) continue;
                seen.add(name);
                names.push(name);
            }
        }
        return names;
    }

    /** 선택된 키 중 첫 루트의 맵/상태 문구 */
    function primaryRouteMeta() {
        for (const route of RECOMMEND_ROUTES) {
            for (let t = 1; t <= TIER_COUNT; t++) {
                if (selected.has(selKey(route.id, t))) {
                    return route;
                }
            }
        }
        return null;
    }

    function els() {
        return {
            routes: document.getElementById('ot-recommend-routes'),
            clearBtn: document.getElementById('ot-recommend-clear'),
        };
    }

    function routeBlockHtml(route) {
        const rankedLen = (route.ranked || []).length;
        const buttons = Array.from({ length: TIER_COUNT }, (_, i) => {
            const tier = i + 1;
            const start = (tier - 1) * TIER_SIZE + 1;
            if (start > rankedLen) return '';
            const end = Math.min(tier * TIER_SIZE, rankedLen);
            const on = selected.has(selKey(route.id, tier));
            return `<button type="button" class="ot-cat-btn${on ? ' is-active' : ''}"
              data-recommend-route="${escapeHtml(route.id)}"
              data-recommend-tier="${tier}"
              aria-pressed="${on ? 'true' : 'false'}"
              title="${start}~${end}위">${escapeHtml('추천' + tier)}</button>`;
        }).join('');

        return `<div class="ot-recommend-route" data-route-id="${escapeHtml(route.id)}">
          <p class="ot-recommend-route-title">${escapeHtml(route.title)}</p>
          <div class="ot-goods-cat-row ot-recommend-row">${buttons}</div>
        </div>`;
    }

    function render() {
        const { routes, clearBtn } = els();
        if (!routes) return;

        routes.innerHTML = RECOMMEND_ROUTES.map(routeBlockHtml).join('');

        const has = selected.size > 0;
        if (clearBtn) {
            clearBtn.disabled = !has;
            clearBtn.classList.toggle('is-dim', !has);
        }
    }

    async function applyFilter() {
        render();
        const names = selectedGoodNames();

        if (!names.length) {
            if (typeof window.clearOriginGoodsFilter === 'function') {
                window.clearOriginGoodsFilter();
            }
            return;
        }

        const route = primaryRouteMeta();
        if (route && route.mapView && typeof window.selectOriginMapView === 'function') {
            window.selectOriginMapView(route.mapView);
        }

        if (typeof window.filterMapByGoodNames === 'function') {
            await window.filterMapByGoodNames(names, route ? route.title : '');
        }
    }

    function toggle(routeId, tier) {
        const key = selKey(routeId, tier);
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        applyFilter();
    }

    function clearAll() {
        if (!selected.size) return;
        selected.clear();
        render();
        if (typeof window.clearOriginGoodsFilter === 'function') {
            window.clearOriginGoodsFilter();
        }
    }

    function init() {
        const { routes, clearBtn } = els();
        if (!routes) return;

        render();

        routes.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-recommend-route][data-recommend-tier]');
            if (!btn) return;
            const routeId = btn.dataset.recommendRoute;
            const tier = parseInt(btn.dataset.recommendTier, 10);
            if (!routeId || !(tier >= 1 && tier <= TIER_COUNT)) return;
            toggle(routeId, tier);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', clearAll);
        }
    }

    window.ORIGIN_RECOMMEND_ROUTES = RECOMMEND_ROUTES;
    window.originRecommendInit = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
