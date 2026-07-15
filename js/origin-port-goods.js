// =============== origin-port-goods.js ===============
// 대항해시대 오리진 — 항구별 교역품 (고정 데이터)
// 필드: name, category, specialty(명산품)
// 항구를 늘릴 때는 ORIGIN_PORT_GOODS[항구명] 에 배열만 추가

(function () {
    'use strict';

    /** @type {string[]} */
    window.ORIGIN_GOOD_CATEGORIES = [
        '명산품',
        '식료품',
        '조미료',
        '가축',
        '의약품',
        '잡화',
        '주류',
        '염료',
        '광석',
        '공업품',
        '기호품',
        '섬유',
        '직물',
        '공예품',
        '미술품',
        '향신료',
        '귀금속',
        '향료',
        '보석',
        '무기류',
        '총포류',
    ];

    /**
     * @typedef {{ name: string, category: string, specialty?: boolean }} OriginGood
     * @type {Record<string, OriginGood[]>}
     */
    window.ORIGIN_PORT_GOODS = {
        이스탄불: [
            { name: '다마스크', category: '직물', specialty: false },
            { name: '융단', category: '직물', specialty: false },
            { name: '인쇄물', category: '잡화', specialty: false },
            { name: '로쿰', category: '기호품', specialty: true },
            { name: '밀', category: '식료품', specialty: false },
            { name: '살구씨', category: '의약품', specialty: false },
            { name: '잼', category: '조미료', specialty: false },
            { name: '버터', category: '조미료', specialty: false },
            { name: '허브식초', category: '조미료', specialty: false },
            { name: '올리브기름', category: '조미료', specialty: false },
        ],
        바르나: [
            { name: '철재', category: '공업품', specialty: false },
            { name: '캐비아', category: '기호품', specialty: true },
            { name: '콜키쿰', category: '의약품', specialty: true },
            { name: '소', category: '가축', specialty: false },
            { name: '향쑥', category: '의약품', specialty: false },
            { name: '쇠고기', category: '식료품', specialty: false },
            { name: '보리', category: '식료품', specialty: false },
            { name: '박격포', category: '총포류', specialty: false },
            { name: '모헤어', category: '섬유', specialty: true },
        ],
    };

    /** @param {string} portName @param {string} [category] */
    window.getOriginPortGoods = function (portName, category) {
        const list = window.ORIGIN_PORT_GOODS[portName] || [];
        if (!category) return list.slice();
        if (category === '명산품') return list.filter(g => !!g.specialty);
        return list.filter(g => g.category === category);
    };

    /**
     * 현재 맵 핀 항구 중 해당 분류 교역품이 있는 항구만
     * @param {{ name: string }[]} pins
     * @param {string} category
     * @returns {{ portName: string, goods: OriginGood[] }[]}
     */
    window.getOriginMapGoodsByCategory = function (pins, category) {
        if (!category || !Array.isArray(pins)) return [];
        const out = [];
        for (const pin of pins) {
            const goods = window.getOriginPortGoods(pin.name, category);
            if (goods.length) out.push({ portName: pin.name, goods });
        }
        out.sort((a, b) => a.portName.localeCompare(b.portName, 'ko'));
        return out;
    };
})();
