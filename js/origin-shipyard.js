// =============== origin-shipyard.js ===============
// 조선소 선박재료(티어) · 구매 항구 · 맵 필터

(function () {
    'use strict';

    /**
     * 티어별 조선 재료와 구매 가능 항구
     * @type {{ id: string, tier: string, material: string, ports: string[] }[]}
     */
    const SHIPYARD_TIERS = [
        {
            id: 't5-6',
            tier: '5-6',
            material: '적송',
            ports: [
                '리스본', '산타섬', '세비야', '세우타', '카사블랑카', '런던', '루안다',
                '브레멘', '산토도밍고', '아비장', '암스테르담', '에든버러', '이스탄불',
                '칸디아', '포트로열',
            ],
        },
        {
            id: 't7-8',
            tier: '7-8',
            material: '오리나무',
            ports: [
                '팀북투', '리우데자네이루', '마사와', '모잠비크', '바그다드', '베르겐',
                '부에노스아이레스', '시라쿠사', '캘리컷',
            ],
        },
        {
            id: 't9-10',
            tier: '9-10',
            material: '너도밤나무',
            ports: [
                '리마', '말라카', '발파라이소', '베이루트', '수에즈', '자카르타',
                '케이프타운', '코펜하겐',
            ],
        },
        {
            id: 't11-12',
            tier: '11-12',
            material: '자작나무',
            ports: [
                '나사우', '마닐라', '메리다', '베네치아', '캘커타', '코피아포',
                '툼베스', '파사이', '팔렘방', '포를라마르',
            ],
        },
        {
            id: 't13',
            tier: '13',
            material: '티크',
            ports: [
                '나탈', '뤼베크', '마르세유', '반자르마신', '우수아이아', '코하셋',
                '트루히요', '팡칼피낭', '퐁디셰리',
            ],
        },
        {
            id: 't14',
            tier: '14',
            material: '호두나무',
            ports: [
                '낭트', '나하', '베라크루스', '세우타', '제다', '카리비브', '코콜라',
                '팀북투', '파나마', '하노이',
            ],
        },
        {
            id: 't15',
            tier: '15',
            material: '흑단나무',
            ports: ['단수이', '바그다드', '사우스사이드', '오론', '핀자라'],
        },
        {
            id: 't16',
            tier: '16',
            material: '바르도',
            ports: ['제노바', '코르프', '타마타브', '터코마'],
        },
        {
            id: 't17',
            tier: '17',
            material: '강화 가문비나무',
            ports: ['가리', '디우', '산토도밍고', '어널래스카', '타이난'],
        },
        {
            id: 't18',
            tier: '18',
            material: '강화 적송',
            ports: ['괌', '레이캬비크', '벵겔라', '아덴', '포르토벨로'],
        },
        {
            id: 't19',
            tier: '19',
            material: '강화 오리나무',
            ports: ['나르비크', '모잠비크', '베네치아', '아투오나', '포트로열'],
        },
        {
            id: 't20',
            tier: '20',
            material: '강화 너도밤나무',
            ports: ['에든버러', '왕거누이', '체르스키', '페르남부쿠', '하와이'],
        },
        {
            id: 't21',
            tier: '21',
            material: '강화 자단',
            ports: ['과테말라', '누탁', '아르한겔스크', '테르나테', '호르무즈'],
        },
        {
            id: 't22',
            tier: '22',
            material: '강화 티크',
            ports: ['사마라이', '상투메', '실론', '야파', '오호츠크'],
        },
        {
            id: 't23',
            tier: '23',
            material: '강화 호두나무',
            ports: ['마카오', '마히나', '몽펠리에', '카나크', '카라카스'],
        },
    ];

    /** @type {string|null} */
    let selectedTierId = null;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getTier(id) {
        return SHIPYARD_TIERS.find(t => t.id === id) || null;
    }

    function els() {
        return {
            list: document.getElementById('ot-shipyard-tiers'),
            clearBtn: document.getElementById('ot-shipyard-clear'),
            resetMeta: document.getElementById('ot-shipyard-reset-meta'),
        };
    }

    function nextMondayResetLabel() {
        if (typeof window.getOriginShipyardResetLabel === 'function') {
            return window.getOriginShipyardResetLabel();
        }
        return '매주 월요일 00:00 (KST) 리셋';
    }

    function render() {
        const { list, clearBtn, resetMeta } = els();
        if (!list) return;

        list.innerHTML = SHIPYARD_TIERS.map(t => {
            const on = selectedTierId === t.id;
            return `<button type="button" class="ot-cat-btn ot-shipyard-tier-btn${on ? ' is-active' : ''}"
              data-shipyard-tier="${escapeHtml(t.id)}"
              aria-pressed="${on ? 'true' : 'false'}"
              title="${escapeHtml(t.material)} · ${t.ports.length}항구">
              <span class="ot-shipyard-tier-num">${escapeHtml(t.tier)}</span>
              <span class="ot-shipyard-tier-mat">${escapeHtml(t.material)}</span>
            </button>`;
        }).join('');

        const has = !!selectedTierId;
        if (clearBtn) {
            clearBtn.disabled = !has;
            clearBtn.classList.toggle('is-dim', !has);
        }
        if (resetMeta) {
            resetMeta.textContent = nextMondayResetLabel();
        }
    }

    async function applyFilter() {
        render();
        const tier = getTier(selectedTierId);
        if (!tier) {
            if (typeof window.clearOriginPortNameFilter === 'function') {
                window.clearOriginPortNameFilter();
            }
            return;
        }
        if (typeof window.filterMapByPortNames === 'function') {
            await window.filterMapByPortNames(
                tier.ports,
                `조선 티어 ${tier.tier} · ${tier.material}`,
                `${tier.tier} · ${tier.material}`
            );
        }
    }

    function toggle(tierId) {
        selectedTierId = (selectedTierId === tierId) ? null : tierId;
        applyFilter();
    }

    function clearAll() {
        if (!selectedTierId) return;
        selectedTierId = null;
        render();
        if (typeof window.clearOriginPortNameFilter === 'function') {
            window.clearOriginPortNameFilter();
        }
    }

    function onGoodsFilterChanged() {
        // 교역품/추천 필터가 켜지면 조선 티어 선택 UI만 해제 (맵은 그쪽이 담당)
        if (!selectedTierId) return;
        const portFilter = (typeof window.getOriginPortNameFilter === 'function')
            ? window.getOriginPortNameFilter()
            : null;
        if (portFilter && portFilter.length) return;
        selectedTierId = null;
        render();
    }

    function init() {
        const { list, clearBtn } = els();
        if (!list) return;

        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-shipyard-tier]');
            if (!btn || !list.contains(btn)) return;
            toggle(btn.dataset.shipyardTier);
        });
        if (clearBtn) {
            clearBtn.addEventListener('click', clearAll);
        }
        window.addEventListener('origin-goods-filter-changed', onGoodsFilterChanged);
        window.addEventListener('origin-port-filter-changed', render);
        render();
    }

    window.ORIGIN_SHIPYARD_TIERS = SHIPYARD_TIERS;
    window.originShipyardInit = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
