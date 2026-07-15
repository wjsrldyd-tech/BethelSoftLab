// =============== origin-port-goods.js ===============
// 대항해시대 오리진 — 항구별 교역품 (고정 데이터)
// 필드: name, category, specialty(명산품), lock(거래 불가)
//   lock: 'monopoly' = 현재 상회 독점 / 'vassal' = 권역 예속 상태
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
     * @typedef {'monopoly'|'vassal'} OriginGoodLock
     * @typedef {{ name: string, category: string, specialty?: boolean, lock?: OriginGoodLock }} OriginGood
     * @type {Record<string, OriginGood[]>}
     */
    window.ORIGIN_PORT_GOODS = {
        이스탄불: [
            { name: '다마스크', category: '직물', specialty: false },
            { name: '융단', category: '직물', specialty: false },
            { name: '허브식초', category: '조미료', specialty: false },
            { name: '로쿰', category: '기호품', specialty: true },
            { name: '잼', category: '조미료', specialty: false },
            { name: '살구씨', category: '의약품', specialty: false },
            { name: '밀', category: '식료품', specialty: false },
            { name: '올리브기름', category: '조미료', specialty: false },
        ],
        바르나: [
            { name: '캐비아', category: '기호품', specialty: true },
            { name: '보리', category: '식료품', specialty: false },
            { name: '쇠고기', category: '식료품', specialty: false },
            { name: '콜키쿰', category: '의약품', specialty: true },
            { name: '박격포', category: '총포류', specialty: true, lock: 'vassal' },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        오데사: [
            { name: '캐비아', category: '기호품', specialty: true },
            { name: '보리', category: '식료품', specialty: false },
            { name: '맥아식초', category: '조미료', specialty: false },
            { name: '아니스', category: '의약품', specialty: false },
            { name: '콜키쿰', category: '의약품', specialty: true },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        케르치: [
            { name: '소형 방패', category: '무기류', specialty: false },
            { name: '캐비아', category: '기호품', specialty: true },
            { name: '당근', category: '식료품', specialty: false },
            { name: '깨꽃', category: '의약품', specialty: false },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        타간로크: [
            { name: '소형 방패', category: '무기류', specialty: false },
            { name: '버섯', category: '식료품', specialty: false },
            { name: '아니스', category: '의약품', specialty: false },
            { name: '자두', category: '기호품', specialty: false },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        트라브존: [
            { name: '다마스크', category: '직물', specialty: false },
            { name: '융단', category: '직물', specialty: false },
            { name: '석류', category: '식료품', specialty: false },
            { name: '건포도', category: '기호품', specialty: false },
            { name: '작약', category: '의약품', specialty: false },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly' },
        ],
        테살로니키: [
            { name: '월계수', category: '향신료', specialty: true },
            { name: '오크모스', category: '향료', specialty: true },
            { name: '무화과', category: '기호품', specialty: false },
            { name: '오레가노', category: '향신료', specialty: false },
            { name: '세피아', category: '염료', specialty: false },
            { name: '페타 치즈', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        아테네: [
            { name: '오크모스', category: '향료', specialty: true },
            { name: '양피지', category: '공업품', specialty: true },
            { name: '월계수', category: '향신료', specialty: true },
            { name: '대리석', category: '공업품', specialty: true },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '로즈메리', category: '향신료', specialty: false },
            { name: '세피아', category: '염료', specialty: false },
            { name: '창', category: '무기류', specialty: false },
        ],
        칸디아: [
            { name: '대리석', category: '공업품', specialty: true },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '올리브', category: '식료품', specialty: false },
            { name: '올리브기름', category: '조미료', specialty: false },
            { name: '깨꽃', category: '의약품', specialty: false },
            { name: '살구씨', category: '의약품', specialty: false },
            { name: '페타 치즈', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        안탈리아: [
            { name: '라벤더', category: '향료', specialty: false },
            { name: '사탕무', category: '식료품', specialty: false },
            { name: '양고기', category: '식료품', specialty: false },
            { name: '마늘', category: '향신료', specialty: false },
            { name: '장미', category: '향료', specialty: false },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly' },
        ],
        니코시아: [
            { name: '라벤더', category: '향료', specialty: false },
            { name: '깨꽃', category: '의약품', specialty: false },
            { name: '디기탈리스', category: '의약품', specialty: false },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly' },
        ],
        베이루트: [
            { name: '수선화', category: '향료', specialty: true },
            { name: '시벳', category: '향료', specialty: false },
            { name: '다마스쿠스 강철', category: '공업품', specialty: true },
            { name: '누에콩', category: '식료품', specialty: false },
            { name: '허브소금', category: '조미료', specialty: false },
            { name: '잇꽃', category: '염료', specialty: true },
            { name: '종이', category: '잡화', specialty: false },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly' },
        ],
        야파: [
            { name: '티리언 퍼플', category: '염료', specialty: true },
            { name: '수선화', category: '향료', specialty: true },
            { name: '무화과', category: '기호품', specialty: false },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly' },
        ],
        포트사이드: [
            { name: '티리언 퍼플', category: '염료', specialty: true },
            { name: '향수', category: '향료', specialty: false },
            { name: '우유', category: '식료품', specialty: false },
            { name: '치즈', category: '식료품', specialty: false },
            { name: '낙타', category: '가축', specialty: true, lock: 'vassal' },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        카이로: [
            { name: '파피루스', category: '잡화', specialty: true },
            { name: '설화 석고', category: '공업품', specialty: false },
            { name: '양파', category: '식료품', specialty: false },
            { name: '향수', category: '향료', specialty: false },
            { name: '잇꽃', category: '염료', specialty: true },
            { name: '누에콩', category: '식료품', specialty: false },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        알렉산드리아: [
            { name: '몰약', category: '의약품', specialty: true },
            { name: '파피루스', category: '잡화', specialty: true },
            { name: '시벳', category: '향료', specialty: false },
            { name: '후추', category: '향신료', specialty: true },
            { name: '참깨', category: '조미료', specialty: false },
            { name: '마늘', category: '향신료', specialty: false },
            { name: '향수', category: '향료', specialty: false },
            { name: '누에콩', category: '식료품', specialty: false },
        ],
        벵가지: [
            { name: '무명', category: '직물', specialty: false },
            { name: '잇꽃', category: '염료', specialty: true },
            { name: '메귀리', category: '식료품', specialty: false },
            { name: '참깨', category: '조미료', specialty: false },
            { name: '몰약', category: '의약품', specialty: true },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        라구사: [
            { name: '오레가노', category: '향신료', specialty: false },
            { name: '개암', category: '식료품', specialty: false },
            { name: '문어', category: '식료품', specialty: false },
            { name: '순무', category: '식료품', specialty: false },
            { name: '올리브', category: '식료품', specialty: false },
            { name: '올리브기름', category: '조미료', specialty: false },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        자다르: [
            { name: '베르가모트', category: '향신료', specialty: false },
            { name: '닭', category: '가축', specialty: false },
            { name: '레몬', category: '식료품', specialty: false },
            { name: '허브식초', category: '조미료', specialty: false },
            { name: '민들레', category: '의약품', specialty: false },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        트리에스테: [
            { name: '거울', category: '미술품', specialty: true },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '달걀', category: '식료품', specialty: false },
            { name: '모차렐라', category: '식료품', specialty: false },
            { name: '자두', category: '기호품', specialty: false },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        베네치아: [
            { name: '거울', category: '미술품', specialty: true },
            { name: '벨벳', category: '직물', specialty: true },
            { name: '후추', category: '향신료', specialty: true },
            { name: '레이스', category: '직물', specialty: false },
            { name: '유리그릇', category: '공예품', specialty: false },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '파슬리', category: '향신료', specialty: false },
            { name: '닭고기', category: '식료품', specialty: false },
            { name: '고급 의복', category: '직물', specialty: true, lock: 'vassal' },
        ],
        안코나: [
            { name: '베르가모트', category: '향신료', specialty: false },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '거울', category: '미술품', specialty: true },
            { name: '버섯', category: '식료품', specialty: false },
            { name: '고급 의복', category: '직물', specialty: true, lock: 'vassal' },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        시라쿠사: [
            { name: '조젯', category: '직물', specialty: false },
            { name: '레몬기름', category: '향료', specialty: false },
            { name: '모차렐라', category: '식료품', specialty: false },
            { name: '파스타', category: '식료품', specialty: true },
            { name: '셀러리 씨앗', category: '향신료', specialty: false },
            { name: '리큐르', category: '주류', specialty: true },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        나폴리: [
            { name: '벨벳', category: '직물', specialty: true },
            { name: '은 식기', category: '공예품', specialty: false },
            { name: '파스타', category: '식료품', specialty: true },
            { name: '청동상', category: '미술품', specialty: false },
            { name: '도자기', category: '공예품', specialty: false },
            { name: '유화', category: '미술품', specialty: false },
            { name: '리큐르', category: '주류', specialty: true },
            { name: '개암', category: '식료품', specialty: false },
            { name: '대형 방패', category: '무기류', specialty: true, lock: 'vassal' },
        ],
        피사: [
            { name: '벨벳', category: '직물', specialty: true },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '개암', category: '식료품', specialty: false },
            { name: '피클', category: '기호품', specialty: false },
            { name: '도자기', category: '공예품', specialty: false },
            { name: '장미', category: '향료', specialty: false },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly' },
        ],
        제노바: [
            { name: '벨벳', category: '직물', specialty: true },
            { name: '은 식기', category: '공예품', specialty: false },
            { name: '문어', category: '식료품', specialty: false },
            { name: '밀', category: '식료품', specialty: false },
            { name: '레이스', category: '직물', specialty: false },
            { name: '니트', category: '직물', specialty: false },
            { name: '동판화', category: '미술품', specialty: false },
            { name: '유화', category: '미술품', specialty: false },
        ],
        칼비: [
            { name: '도자기', category: '공예품', specialty: false },
            { name: '딜', category: '향신료', specialty: false },
            { name: '타라곤', category: '향신료', specialty: false },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        사사리: [
            { name: '석류석', category: '보석', specialty: true },
            { name: '디기탈리스', category: '의약품', specialty: false },
            { name: '작약', category: '의약품', specialty: false },
            { name: '황마', category: '섬유', specialty: false },
            { name: '조젯', category: '직물', specialty: false },
            { name: '타라곤', category: '향신료', specialty: false },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        칼리아리: [
            { name: '레몬', category: '식료품', specialty: false },
            { name: '조젯', category: '직물', specialty: false },
            { name: '스테인드글라스', category: '미술품', specialty: true },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        튀니스: [
            { name: '유화', category: '미술품', specialty: false },
            { name: '누에콩', category: '식료품', specialty: false },
            { name: '메귀리', category: '식료품', specialty: false },
            { name: '벨라도나', category: '의약품', specialty: false },
            { name: '팥', category: '식료품', specialty: false },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        마르세유: [
            { name: '코듀로이', category: '직물', specialty: false },
            { name: '석류석', category: '보석', specialty: true },
            { name: '서양 대포', category: '총포류', specialty: false },
            { name: '종이', category: '잡화', specialty: false },
            { name: '스테인드글라스', category: '미술품', specialty: true },
            { name: '오리', category: '가축', specialty: false },
            { name: '오리고기', category: '식료품', specialty: false },
            { name: '조젯', category: '직물', specialty: false },
        ],
        몽펠리에: [
            { name: '코듀로이', category: '직물', specialty: false },
            { name: '굴', category: '식료품', specialty: false },
            { name: '석류석', category: '보석', specialty: true },
            { name: '당근', category: '식료품', specialty: false },
            { name: '부케가르니', category: '조미료', specialty: false },
            { name: '작약', category: '의약품', specialty: false },
            { name: '타라곤', category: '향신료', specialty: false },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly' },
        ],
        트리폴리: [
            { name: '메귀리', category: '식료품', specialty: false },
            { name: '순무', category: '식료품', specialty: false },
            { name: '피클', category: '기호품', specialty: false },
            { name: '양초', category: '잡화', specialty: false },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
    };

    function isLockedGood(g) {
        return !!(g && g.lock);
    }

    /**
     * @param {string} portName
     * @param {string} [category]
     * @param {{ includeLocked?: boolean }} [opts]
     */
    window.getOriginPortGoods = function (portName, category, opts) {
        const includeLocked = !!(opts && opts.includeLocked);
        let list = window.ORIGIN_PORT_GOODS[portName] || [];
        if (!includeLocked) list = list.filter(g => !isLockedGood(g));
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
