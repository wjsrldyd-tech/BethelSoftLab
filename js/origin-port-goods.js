// =============== origin-port-goods.js ===============
// 대항해시대 오리진 — 항구별 교역품 (고정 데이터)
// 필드:
//   name, category, specialty(명산품), lock(거래 불가)
//   lock: 'monopoly' = 현재 상회 독점(숨김) / 'vassal' = 권역 예속(표시 — 이민·권역에 따라 달라짐)
//   peak?: 성수기(▲) 태그 — 지역별 용어 그대로 (봄/여름/가을/겨울 및/또는 건기/우기)
//   off?:  비수기(▼) 태그 — 마찬가지
//   ※ 품목마다 없을 수 있음. peak/off 없으면 시즌 변동 없음(표시 생략)
//   ※ 항구·권역마다 계절형만(사계절) 또는 건기/우기만 사용 — 해역 축에 맞는 태그만 매칭
//   ※ 사계절 해역: 봄·여름·가을·겨울만 / 건·우기 해역: 건기·우기만
//   ※ 게임 월: 사용자가 설정한 월 유지, 매일 KST 09:00에 +1 (advanceOriginBarterMonthIfNeeded)
// 항구를 늘릴 때는 ORIGIN_PORT_GOODS[항구명] 에 배열만 추가

(function () {
    'use strict';

    /** @type {string[]} 특수 필터 — 단독 선택 (명산품 등) */
    window.ORIGIN_SPECIAL_CATEGORIES = [
        '명산품',
    ];

    /**
     * 일반 교역품 분류 — 대유행 묶음(중복 없이 이웃 배치, 5×4)
     * @type {{ label: string, categories: string[] }[]}
     */
    window.ORIGIN_GOOD_CATEGORY_GROUPS = [
        { label: '축제·홍수', categories: ['기호품', '식료품', '조미료', '직물', '공업품'] },
        { label: '개발·전염', categories: ['광석', '주류', '잡화', '의약품', '섬유'] },
        { label: '후원·사치', categories: ['향신료', '공예품', '염료', '향료', '미술품'] },
        { label: '호황·전쟁', categories: ['귀금속', '보석', '총포류', '무기류', '가축'] },
    ];

    /** @type {string[]} 일반 교역품 분류 — 복수 선택(OR), 그룹 전개 */
    window.ORIGIN_GOOD_CATEGORIES = window.ORIGIN_GOOD_CATEGORY_GROUPS
        .reduce((acc, g) => acc.concat(g.categories), []);

    /**
     * 분류 → 한 글자 뱃지 (충돌 방지: 공예품=예, 향신료=신)
     * 시즌(성수/비수) 색과 무관한 중립 표기용
     * @type {Record<string, string>}
     */
    window.ORIGIN_CATEGORY_BADGES = {
        '기호품': '기',
        '식료품': '식',
        '조미료': '조',
        '직물': '직',
        '공업품': '공',
        '광석': '광',
        '주류': '주',
        '잡화': '잡',
        '의약품': '약',
        '섬유': '섬',
        '향신료': '신',
        '공예품': '예',
        '염료': '염',
        '향료': '향',
        '미술품': '미',
        '귀금속': '귀',
        '보석': '보',
        '총포류': '총',
        '무기류': '무',
        '가축': '가',
    };

    /**
     * @param {string} category
     * @returns {{ letter: string, label: string } | null}
     */
    window.getOriginCategoryBadge = function (category) {
        if (!category) return null;
        const map = window.ORIGIN_CATEGORY_BADGES || {};
        const letter = map[category] || String(category).charAt(0);
        if (!letter) return null;
        return { letter: letter, label: category };
    };

    /**
     * 공통 HTML 스니펫 (중립 뱃지). 시즌 색 미사용.
     * @param {string} category
     * @param {{ escapeHtml?: (s: string) => string }} [opts]
     * @returns {string}
     */
    window.originCategoryBadgeHtml = function (category, opts) {
        const badge = window.getOriginCategoryBadge(category);
        if (!badge) return '';
        const esc = (opts && typeof opts.escapeHtml === 'function')
            ? opts.escapeHtml
            : function (s) {
                return String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            };
        return `<span class="ot-cat-badge" title="${esc(badge.label)}" aria-label="${esc(badge.label)}">${esc(badge.letter)}</span>`;
    };

    /**
     * 게임 달력 — 월(1~12)별 사계절 / 건기·우기
     * @deprecated 7종 계절 타입 시스템으로 대체됨. SEASON_TYPE_CALENDARS 사용
     * @type {{ month: number, season: string, climate: string }[]}
     */
    window.ORIGIN_SEASON_CALENDAR = [
        { month: 1, season: '겨울', climate: '건기' },
        { month: 2, season: '겨울', climate: '건기' },
        { month: 3, season: '봄', climate: '건기' },
        { month: 4, season: '봄', climate: '건기' },
        { month: 5, season: '봄', climate: '건기' },
        { month: 6, season: '여름', climate: '우기' },
        { month: 7, season: '여름', climate: '우기' },
        { month: 8, season: '여름', climate: '우기' },
        { month: 9, season: '가을', climate: '우기' },
        { month: 10, season: '가을', climate: '우기' },
        { month: 11, season: '가을', climate: '건기' },
        { month: 12, season: '겨울', climate: '건기' },
    ];

    /**
     * 계절 타입별 월 매핑 (7종)
     * ※ 게임 월: 저장값 유지, 매일 KST 09:00에 +1 (현실 달력 월과 무관)
     * @type {Record<string, string[]>} [월1~12]
     */
    window.SEASON_TYPE_CALENDARS = {
        // 북반구 사계절: 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울
        'north-4seasons': [
            '겨울', '겨울', '봄', '봄', '봄', '여름',
            '여름', '여름', '가을', '가을', '가을', '겨울'
        ],
        // 남반구 사계절: 9~11 봄, 12~2 여름, 3~5 가을, 6~8 겨울
        'south-4seasons': [
            '여름', '여름', '가을', '가을', '가을', '겨울',
            '겨울', '겨울', '봄', '봄', '봄', '여름'
        ],
        // 건기-우기-건기: 11~5 건기, 6~10 우기
        'dry-rainy-dry': [
            '건기', '건기', '건기', '건기', '건기', '우기',
            '우기', '우기', '우기', '우기', '건기', '건기'
        ],
        // 건기-1-우기-건기: 11~4 건기, 5~10 우기
        'dry-1-rainy-dry': [
            '건기', '건기', '건기', '건기', '우기', '우기',
            '우기', '우기', '우기', '우기', '건기', '건기'
        ],
        // 건기+1-우기-건기: 12~6 건기, 7~11 우기
        'dry+1-rainy-dry': [
            '건기', '건기', '건기', '건기', '건기', '건기',
            '우기', '우기', '우기', '우기', '우기', '건기'
        ],
        // 우기-건기-우기: 12~5 우기, 6~11 건기
        'rainy-dry-rainy': [
            '우기', '우기', '우기', '우기', '우기', '건기',
            '건기', '건기', '건기', '건기', '건기', '우기'
        ],
        // 열대: 연중 「열대」 표시 (성수기/비수기 없음 → getOriginGoodSeasonStatus에서 plain)
        'tropical': [
            '열대', '열대', '열대', '열대', '열대', '열대',
            '열대', '열대', '열대', '열대', '열대', '열대'
        ],
        // 한대: 연중 「한대」 표시 (성수기/비수기 없음 → getOriginGoodSeasonStatus에서 plain)
        'arctic': [
            '한대', '한대', '한대', '한대', '한대', '한대',
            '한대', '한대', '한대', '한대', '한대', '한대'
        ]
    };

    const SEASON_TAGS = { 봄: 1, 여름: 1, 가을: 1, 겨울: 1 };
    const CLIMATE_TAGS = { 건기: 1, 우기: 1 };

    /** 게임 일일 리셋 (한국 시간 아침 9시) */
    const GAME_DAY_RESET_HOUR_KST = 9;

    /**
     * @typedef {'monopoly'|'vassal'} OriginGoodLock
     * @typedef {{
     *   name: string,
     *   category: string,
     *   specialty?: boolean,
     *   lock?: OriginGoodLock,
     *   peak?: string[],
     *   off?: string[],
     * }} OriginGood
     * @type {Record<string, OriginGood[]>}
     */
    window.ORIGIN_PORT_GOODS = {
        이스탄불: [
            { name: '다마스크', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '융단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '허브식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '로쿰', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '잼', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '살구씨', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '밀', category: '식료품', specialty: false },
            { name: '올리브기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
        ],
        바르나: [
            { name: '캐비아', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '보리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '쇠고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '콜키쿰', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '박격포', category: '총포류', specialty: true, lock: 'vassal' },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        오데사: [
            { name: '캐비아', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '보리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '맥아식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '아니스', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '콜키쿰', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        케르치: [
            { name: '소형 방패', category: '무기류', specialty: false },
            { name: '캐비아', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '당근', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '깨꽃', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        타간로크: [
            { name: '소형 방패', category: '무기류', specialty: false },
            { name: '버섯', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '아니스', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '자두', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '모헤어', category: '섬유', specialty: true, lock: 'monopoly' },
        ],
        트라브존: [
            { name: '다마스크', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '융단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '석류', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '건포도', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '작약', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        테살로니키: [
            { name: '월계수', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '오크모스', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '무화과', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '오레가노', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '세피아', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '페타 치즈', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        아테네: [
            { name: '오크모스', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '양피지', category: '공업품', specialty: true },
            { name: '월계수', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '대리석', category: '공업품', specialty: true },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '로즈메리', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '세피아', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '창', category: '무기류', specialty: false },
            { name: '라임', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
        ],
        칸디아: [
            { name: '대리석', category: '공업품', specialty: true },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '올리브', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '올리브기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '깨꽃', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '살구씨', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '페타 치즈', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        안탈리아: [
            { name: '라벤더', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '사탕무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '양고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '마늘', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '장미', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        니코시아: [
            { name: '라벤더', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '깨꽃', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '디기탈리스', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        베이루트: [
            { name: '수선화', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '시벳', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '다마스쿠스 강철', category: '공업품', specialty: true },
            { name: '누에콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '허브소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '잇꽃', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '종이', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        야파: [
            { name: '티리언 퍼플', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '수선화', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '무화과', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '쿠트누', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        포트사이드: [
            { name: '티리언 퍼플', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '향수', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '우유', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '치즈', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '병아리콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '낙타', category: '가축', specialty: true, lock: 'vassal', peak: ['겨울', '건기'], off: ['여름'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        카이로: [
            { name: '파피루스', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '설화 석고', category: '공업품', specialty: false },
            { name: '양파', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '향수', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '잇꽃', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '누에콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        알렉산드리아: [
            { name: '몰약', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '파피루스', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '시벳', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '후추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '참깨', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '마늘', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '향수', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '누에콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
        ],
        벵가지: [
            { name: '무명', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '잇꽃', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '메귀리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '참깨', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '몰약', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        라구사: [
            { name: '오레가노', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '개암', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '문어', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '순무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '올리브', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '올리브기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        자다르: [
            { name: '베르가모트', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '닭', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '레몬', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '허브식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '민들레', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        트리에스테: [
            { name: '거울', category: '미술품', specialty: true },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '달걀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '모차렐라', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '자두', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        베네치아: [
            { name: '거울', category: '미술품', specialty: true },
            { name: '벨벳', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '후추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레이스', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '유리그릇', category: '공예품', specialty: false },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '파슬리', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '닭고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '고급 의복', category: '직물', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        안코나: [
            { name: '베르가모트', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '거울', category: '미술품', specialty: true },
            { name: '버섯', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '고급 의복', category: '직물', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        시라쿠사: [
            { name: '조젯', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레몬기름', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '모차렐라', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '파스타', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '셀러리 씨앗', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '리큐르', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        나폴리: [
            { name: '벨벳', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '은 식기', category: '공예품', specialty: false },
            { name: '파스타', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '청동상', category: '미술품', specialty: false },
            { name: '도자기', category: '공예품', specialty: false },
            { name: '유화', category: '미술품', specialty: false },
            { name: '리큐르', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '개암', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '대형 방패', category: '무기류', specialty: true, lock: 'vassal' },
        ],
        피사: [
            { name: '벨벳', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '대리석상', category: '미술품', specialty: false },
            { name: '개암', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '피클', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '도자기', category: '공예품', specialty: false },
            { name: '장미', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '테라 베르데', category: '염료', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        제노바: [
            { name: '벨벳', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '은 식기', category: '공예품', specialty: false },
            { name: '문어', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '밀', category: '식료품', specialty: false },
            { name: '레이스', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '니트', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '동판화', category: '미술품', specialty: false },
            { name: '유화', category: '미술품', specialty: false },
        ],
        칼비: [
            { name: '도자기', category: '공예품', specialty: false },
            { name: '딜', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '타라곤', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        사사리: [
            { name: '석류석', category: '보석', specialty: true },
            { name: '디기탈리스', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '작약', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '황마', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '조젯', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '타라곤', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        칼리아리: [
            { name: '레몬', category: '식료품', specialty: false },
            { name: '조젯', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '스테인드글라스', category: '미술품', specialty: true },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        튀니스: [
            { name: '유화', category: '미술품', specialty: false },
            { name: '누에콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '메귀리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '벨라도나', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '팥', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        마르세유: [
            { name: '코듀로이', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '석류석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '서양 대포', category: '총포류', specialty: false },
            { name: '종이', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '스테인드글라스', category: '미술품', specialty: true },
            { name: '오리', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '오리고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '조젯', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        몽펠리에: [
            { name: '코듀로이', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '굴', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '석류석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '당근', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '부케가르니', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '작약', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '타라곤', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '송로버섯', category: '식료품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄'] },
        ],
        트리폴리: [
            { name: '메귀리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '순무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '피클', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '양초', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        바르셀로나: [
            { name: '철재', category: '공업품', specialty: false },
            { name: '화승총', category: '총포류', specialty: false },
            { name: '포도주식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '납 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '납', category: '공업품', specialty: false },
            { name: '놋쇠', category: '공업품', specialty: false },
            { name: '황철 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        발렌시아: [
            { name: '진사', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '허브기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '오리', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '오리고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '로즈메리', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아몬드', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        팔마: [
            { name: '허브소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '아몬드', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '안초비', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '셀러리 씨앗', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '타임', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        알제: [
            { name: '양마', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레몬기름', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '팥', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '진사', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '파슬리', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        말라가: [
            { name: '사프란', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '셰리', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '소', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '포도주식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '진사', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아몬드', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '마늘', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        세우타: [
            { name: '황마', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '세이지', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '밀', category: '식료품', specialty: false },
            { name: '레몬밤', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '바질', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '박하', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        세비야: [
            { name: '화승총', category: '총포류', specialty: false },
            { name: '세이지', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '서양 대포', category: '총포류', specialty: false },
            { name: '수은', category: '공업품', specialty: false },
            { name: '수은제', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '무명', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '화약', category: '총포류', specialty: false },
            { name: '목판화', category: '미술품', specialty: false },
            { name: '탄환', category: '총포류', specialty: false },
        ],
        카사블랑카: [
            { name: '용연향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '레몬밤', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '펜넬', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '네롤리', category: '향료', specialty: true, lock: 'vassal', peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        파루: [
            { name: '포탄', category: '총포류', specialty: false },
            { name: '셰리', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '달걀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '닭고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '돼지', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '파슬리', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        리스본: [
            { name: '포탄', category: '총포류', specialty: false },
            { name: '핸드 캐논', category: '총포류', specialty: true },
            { name: '아줄레주', category: '공예품', specialty: true },
            { name: '햄', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '돌소금', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '아몬드', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '아몬드기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '인쇄물', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '밀', category: '식료품', specialty: false },
        ],
        포르투: [
            { name: '핸드 캐논', category: '총포류', specialty: true },
            { name: '아줄레주', category: '공예품', specialty: true },
            { name: '포탄', category: '총포류', specialty: false },
            { name: '소시지', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '돼지기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '돼지고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '밀가루', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        히혼: [
            { name: '탄환', category: '총포류', specialty: false },
            { name: '돼지', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '돼지고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '오리', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '산딸기', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '뚜론', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        보르도: [
            { name: '고블랭', category: '직물', specialty: true, peak: ['봄'], off: ['가을'] },
            { name: '브랜디', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '아주라이트', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '콩소메', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '포도주', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '건포도', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '포도', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '헝가리 워터', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        낭트: [
            { name: '라일락', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '브랜디', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '베이컨', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '양파', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '버터', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '포도주', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '펜넬', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '헝가리 워터', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        아조레스: [
            { name: '마데이라 와인', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '설탕', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '단검', category: '무기류', specialty: false },
            { name: '사탕수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '통나무', category: '공업품', specialty: false },
            { name: '타임', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '시어 버터', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        산타섬: [
            { name: '설탕봉', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '양초', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '박하', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '조젯', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '치즈', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '염소', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
        ],
        마데이라: [
            { name: '마데이라 와인', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '설탕', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '단검', category: '무기류', specialty: false },
            { name: '사탕수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '건포도', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '목상', category: '미술품', specialty: false },
            { name: '시어 버터', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        산후안: [
            { name: '로그우드', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '단호박', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '럼', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '카카오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        산토도밍고: [
            { name: '은', category: '귀금속', specialty: false },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '담배', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '단호박', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '산호세공', category: '공예품', specialty: false },
            { name: '감자', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '드림캐쳐', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        산티아고: [
            { name: '바닐라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '땅콩', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '카카오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '파인애플', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        포트로열: [
            { name: '사금', category: '귀금속', specialty: false },
            { name: '테킬라', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '담배', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '올스파이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '감자', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '땅콩', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        사우스사이드: [
            { name: '오팔', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '테킬라', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '파인애플', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '땅콩', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '소', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '드림캐쳐', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        하바나: [
            { name: '마노', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '은세공', category: '공예품', specialty: false },
            { name: '테킬라', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '럼', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '담배', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '카카오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        나사우: [
            { name: '마노', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '바닐라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '단호박', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '아나토', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '콩크 진주', category: '보석', specialty: true, lock: 'monopoly', peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        메리다: [
            { name: '치클', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '흑요석 곤봉', category: '무기류', specialty: false },
            { name: '감자', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '선인장', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '옥수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        베라크루스: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '은세공', category: '공예품', specialty: false },
            { name: '치클', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '감자', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '선인장', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '옥수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '흑요석 곤봉', category: '무기류', specialty: false },
            { name: '은 광석', category: '광석', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        트루히요: [
            { name: '은세공', category: '공예품', specialty: false },
            { name: '흑요석 곤봉', category: '무기류', specialty: false },
            { name: '감자', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '올스파이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '생강', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '고구마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        포르토벨로: [
            { name: '은', category: '귀금속', specialty: false },
            { name: '옥수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '고구마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '아나토', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '흑요석 곤봉', category: '무기류', specialty: false },
            { name: '닭', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        카르타헤나: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '크롬 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '마떼', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        마라카이보: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '피망', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사이잘삼', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '크롬 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        빌렘스타트: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '올스파이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '로그우드', category: '염료', specialty: true },
            { name: '고구마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '사이잘삼', category: '섬유', specialty: false },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly' },
        ],
        카라카스: [
            { name: '오팔', category: '보석', specialty: true },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '사이잘삼', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        포를라마르: [
            { name: '오팔', category: '보석', specialty: true },
            { name: '로그우드', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '고구마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '마떼', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        아카풀코: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '부채선인장', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '토마토', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '아연 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '고추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아니카', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        과테말라: [
            { name: '고무', category: '공업품', specialty: true },
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '부채선인장', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '토마토', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '옥수수기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '캐슈너트', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        파나마: [
            { name: '금', category: '귀금속', specialty: false },
            { name: '고무', category: '공업품', specialty: true },
            { name: '옥수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '토마토', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '캐슈너트', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '고추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '비쿠냐털', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        코콜라: [
            { name: '깃털', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '링곤베리', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '호밀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '놋쇠', category: '공업품', specialty: false },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        스톡홀름: [
            { name: '아콰비트', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '양손검', category: '무기류', specialty: true },
            { name: '호밀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에리카', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '향쑥', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '아마', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '구리', category: '공업품', specialty: true, lock: 'vassal' },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        상트페테르부르크: [
            { name: '보드카', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '펠트', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금록석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사탕무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '유황', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '토끼', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '토끼털', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '전기석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        비스뷔: [
            { name: '양손검', category: '무기류', specialty: true },
            { name: '전기석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '향쑥', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '아콰비트', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        리가: [
            { name: '보드카', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '오리고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에리카', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '깃털', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        그단스크: [
            { name: '호박', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사탕무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '목재', category: '공업품', specialty: true },
            { name: '공단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        코펜하겐: [
            { name: '아콰비트', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '호박', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '쇠고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '보리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '맥아식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '공단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금록석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '셀러리 씨앗', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        뤼베크: [
            { name: '호박', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '금록석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '밀가루', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '납', category: '공업품', specialty: false },
            { name: '석재', category: '공업품', specialty: false },
            { name: '캐러웨이 열매', category: '조미료', specialty: true, lock: 'monopoly', peak: ['여름', '건기'], off: ['겨울'] },
        ],
        오슬로: [
            { name: '수정', category: '보석', specialty: false },
            { name: '아마', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '순무', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '목재', category: '공업품', specialty: true },
            { name: '석재', category: '공업품', specialty: false },
            { name: '납 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        베르겐: [
            { name: '아마', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '오리고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '호밀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '석재', category: '공업품', specialty: false },
            { name: '수정', category: '보석', specialty: false },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        함부르크: [
            { name: '은방울꽃', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '동판', category: '공업품', specialty: false },
            { name: '민들레', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '맥주', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '납 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '납', category: '공업품', specialty: false },
            { name: '주석', category: '공업품', specialty: false },
            { name: '양마', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
        ],
        브레멘: [
            { name: '은방울꽃', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '깃펜', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '밀가루', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '맥주', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '레이스', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '니트', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '목각화', category: '미술품', specialty: true, lock: 'vassal' },
            { name: '캐러웨이 열매', category: '조미료', specialty: true, lock: 'monopoly', peak: ['여름', '건기'], off: ['겨울'] },
        ],
        그로닝겐: [
            { name: '진', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '유리구슬', category: '공예품', specialty: true },
            { name: '트위드', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '활', category: '무기류', specialty: false },
            { name: '꿀', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '황금 잔', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        덴헬데르: [
            { name: '태피스트리', category: '미술품', specialty: true },
            { name: '유리구슬', category: '공예품', specialty: true },
            { name: '달걀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '닭고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '거위', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '나무신발', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '황금 잔', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        암스테르담: [
            { name: '진', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '트위드', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '유리구슬', category: '공예품', specialty: true },
            { name: '밀', category: '식료품', specialty: false },
            { name: '햄', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '인쇄물', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '청어 절임', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '카모마일', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '철재', category: '공업품', specialty: false },
        ],
        쾰른: [
            { name: '유리세공', category: '공예품', specialty: false },
            { name: '맥주', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '강철', category: '공업품', specialty: true },
            { name: '양손검', category: '무기류', specialty: true },
            { name: '은세공', category: '공예품', specialty: false },
        ],
        앤트워프: [
            { name: '태피스트리', category: '미술품', specialty: true },
            { name: '우유', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '치즈', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '버터', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '레이스', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '카모마일', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '나무신발', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '황금 잔', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        에든버러: [
            { name: '위스키', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '서양 갑옷', category: '무기류', specialty: true },
            { name: '쇠고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '석탄', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '양', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '양모', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '장궁', category: '무기류', specialty: true, lock: 'monopoly' },
        ],
        더블린: [
            { name: '위스키', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '철재', category: '공업품', specialty: false },
            { name: '흑연', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '베이컨', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '소시지', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '돼지기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '투창', category: '무기류', specialty: false },
            { name: '벌꿀주', category: '주류', specialty: true, lock: 'vassal', peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '장궁', category: '무기류', specialty: true, lock: 'monopoly' },
        ],
        런던: [
            { name: '위스키', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '강철', category: '공업품', specialty: true },
            { name: '플란넬', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '밀', category: '식료품', specialty: false },
            { name: '오리', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '놋쇠', category: '공업품', specialty: false },
            { name: '소가죽', category: '공업품', specialty: false },
            { name: '청동', category: '공업품', specialty: false },
            { name: '버터', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
        ],
        도버: [
            { name: '강철', category: '공업품', specialty: true },
            { name: '플란넬', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '동판', category: '공업품', specialty: false },
            { name: '양마', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '화약', category: '총포류', specialty: false },
            { name: '장궁', category: '무기류', specialty: true, lock: 'monopoly' },
        ],
        칼레: [
            { name: '고블랭', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '장미', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '아주라이트', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '굴', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '사과식초', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '활', category: '무기류', specialty: false },
            { name: '헝가리 워터', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        브리스틀: [
            { name: '서양 갑옷', category: '무기류', specialty: true },
            { name: '플란넬', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '탄환', category: '총포류', specialty: false },
            { name: '콩소메', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '토끼', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '토끼털', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '장궁', category: '무기류', specialty: true, lock: 'monopoly' },
        ],
        플리머스: [
            { name: '강철', category: '공업품', specialty: true },
            { name: '납', category: '공업품', specialty: false },
            { name: '납 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주석', category: '공업품', specialty: false },
            { name: '청동', category: '공업품', specialty: false },
            { name: '흑연', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '서양 갑옷', category: '무기류', specialty: true },
            { name: '장궁', category: '무기류', specialty: true, lock: 'monopoly' },
        ],
        에조: [
            { name: '붓꽃', category: '의약품', specialty: true },
            { name: '오배자', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '당귀', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '찹쌀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '간장', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '감초', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '와시', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '코케시', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        에도: [
            { name: '칠기', category: '공예품', specialty: true },
            { name: '일본화', category: '미술품', specialty: true },
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '와시', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '가지', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '고추냉이', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '유자', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '조총', category: '총포류', specialty: false },
            { name: '사탕 공예품', category: '공예품', specialty: true },
            { name: '마상총', category: '총포류', specialty: true },
            { name: '전승정종', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        사카이: [
            { name: '니시진오리', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '일본도', category: '무기류', specialty: false },
            { name: '순백자', category: '공예품', specialty: true },
            { name: '간장', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '옻', category: '공업품', specialty: false },
            { name: '모시', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '죽도', category: '무기류', specialty: false },
            { name: '당귀', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '사탕 공예품', category: '공예품', specialty: true },
            { name: '일본 장창', category: '무기류', specialty: true, lock: 'vassal' },
            { name: '요세기세공', category: '공예품', specialty: true },
            { name: '코케시', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        나가사키: [
            { name: '은', category: '귀금속', specialty: false },
            { name: '자수정', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '순백자', category: '공예품', specialty: true },
            { name: '다시마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '소바', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '슈리오리', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '청주', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '고추냉이', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '일본화', category: '미술품', specialty: true },
            { name: '코케시', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        덕원: [
            { name: '나전 칠기', category: '미술품', specialty: true },
            { name: '된장', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '마황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '우황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '옻', category: '공업품', specialty: false },
            { name: '꼭두서니', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '뇌록', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '향나무', category: '공업품', specialty: true, lock: 'vassal' },
            { name: '황동 향로', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        한양: [
            { name: '고려청자', category: '공예품', specialty: true },
            { name: '인삼', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '동양 대포', category: '총포류', specialty: false },
            { name: '참기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '동충하초', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '초롱', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '복분자', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '진달래', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '조선 활', category: '무기류', specialty: false },
        ],
        영일: [
            { name: '인삼', category: '의약품', specialty: true },
            { name: '부채', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '명주', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '밤', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '복분자', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '산초', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '뇌록', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '황동 향로', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        동래: [
            { name: '한지', category: '잡화', specialty: true },
            { name: '철화 백자', category: '공예품', specialty: true },
            { name: '막걸리', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '다시마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '산초', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '부채', category: '잡화', specialty: true, peak: ['우기'] },
            { name: '석웅황', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '황동 향로', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        제주: [
            { name: '자근', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '호안석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '귤피', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '다시마', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '수단', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '맥반석', category: '광석', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '황동 향로', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        나하: [
            { name: '치자나무', category: '향료', specialty: true },
            { name: '빈가타', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '죽도', category: '무기류', specialty: false },
            { name: '참기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '골풀', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '모시', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '개오지', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '코케시', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        단수이: [
            { name: '등', category: '공업품', specialty: true },
            { name: '각세공', category: '공예품', specialty: true },
            { name: '마직물', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '찹쌀', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '등세공', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '미주', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '감송', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '해당화', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        타이난: [
            { name: '각세공', category: '공예품', specialty: true },
            { name: '미주', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '마직물', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '설탕봉', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '대황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '등세공', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '등', category: '공업품', specialty: true },
            { name: '골풀', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '난초', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        북경: [
            { name: '화창', category: '총포류', specialty: true },
            { name: '호필', category: '공예품', specialty: true },
            { name: '두반장', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '중국화', category: '미술품', specialty: true },
            { name: '흑식초', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '녹용', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '봉', category: '무기류', specialty: false },
            { name: '컴퍼스', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '마황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
        ],
        서안: [
            { name: '금목서', category: '향료', specialty: true },
            { name: '삼절곤', category: '무기류', specialty: true },
            { name: '삼', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '파초', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '서화', category: '미술품', specialty: false },
            { name: '황토', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '봉', category: '무기류', specialty: false },
            { name: '수레', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '촉금', category: '직물', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        중경: [
            { name: '중국화', category: '미술품', specialty: true },
            { name: '두반장', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '당나귀', category: '가축', specialty: true, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '대황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '대나무', category: '공업품', specialty: true },
            { name: '파초', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '팔각', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '감송', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        항주: [
            { name: '용골', category: '의약품', specialty: true },
            { name: '청화 백자', category: '공예품', specialty: false },
            { name: '금목서', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '흑식초', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '헛개나무 열매', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '사오싱주', category: '주류', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '호두', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '차', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        연운: [
            { name: '중국차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '당금', category: '공예품', specialty: true },
            { name: '우황', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '지리바꽃', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '호두', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '호필', category: '공예품', specialty: true },
            { name: '서화', category: '미술품', specialty: false },
            { name: '종이 우산', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        천주: [
            { name: '당나귀', category: '가축', specialty: true },
            { name: '중국차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '용골', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '헛개나무 열매', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '대나무', category: '공업품', specialty: true },
            { name: '소가죽', category: '공업품', specialty: false },
            { name: '황토', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '리치', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '종이 우산', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        마카오: [
            { name: '당금', category: '공예품', specialty: true },
            { name: '중국차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '솔먹', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '차', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '호두', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '삼', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '산초씨', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '종이 우산', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        하노이: [
            { name: '일랑일랑', category: '향료', specialty: true },
            { name: '벼', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '느억맘', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '옥 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        케이프타운: [
            { name: '다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '제라늄', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주석', category: '공업품', specialty: false },
            { name: '황단', category: '공업품', specialty: true },
            { name: '알 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        나탈: [
            { name: '백금', category: '귀금속', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '금세공', category: '공예품', specialty: false },
            { name: '루이보스차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '초석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '알 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        소팔라: [
            { name: '백금', category: '귀금속', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '루벨라이트', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '코코넛식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '맘벨레', category: '무기류', specialty: true },
            { name: '루이보스차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '알 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        켈리마느: [
            { name: '백금', category: '귀금속', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '맘벨레', category: '무기류', specialty: true },
            { name: '오렌지기름', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '모피', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '오렌지', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '초석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '알 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        모잠비크: [
            { name: '백금', category: '귀금속', specialty: true, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '에메랄드', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '세공 장식품', category: '공예품', specialty: false },
            { name: '보리', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '코코넛식초', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '서각', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '석탄', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        타마타브: [
            { name: '에메랄드', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '모피', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '월하향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '골풀', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '발라폰', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        카리비브: [
            { name: '다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '제라늄', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '아연 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '오렌지', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '오렌지기름', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '발라폰', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '알 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        벵겔라: [
            { name: '다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '금세공', category: '공예품', specialty: false },
            { name: '황단', category: '공업품', specialty: true },
            { name: '밀', category: '식료품', specialty: false },
            { name: '구리 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '야자섬유', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        루안다: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '황단', category: '공업품', specialty: true },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '제라늄', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        모가디슈: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '타마린드', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '월하향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        말린디: [
            { name: '타마린드', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '서각', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '세공 장식품', category: '공예품', specialty: false },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        몸바사: [
            { name: '에메랄드', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '타마린드', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '아연 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        잔지바르: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '공작석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '월하향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '납 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '납', category: '공업품', specialty: false },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        킬와: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '타마린드', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '아연 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '세공 장식품', category: '공예품', specialty: false },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        반다: [
            { name: '육두구', category: '향신료', specialty: true },
            { name: '다목', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '망고', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '야자술', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        암본: [
            { name: '깃털 공예품', category: '공예품', specialty: true },
            { name: '메이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '흑단', category: '공업품', specialty: true },
            { name: '두리안', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '자단', category: '공업품', specialty: false },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        딜리: [
            { name: '육두구', category: '향신료', specialty: true },
            { name: '토란', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        테르나테: [
            { name: '노니', category: '의약품', specialty: true },
            { name: '다목', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '메이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '육두구', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        다바오: [
            { name: '청동', category: '공업품', specialty: false },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '마닐라삼', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '수은', category: '공업품', specialty: false },
            { name: '흑연', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '바나나', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '람부탄', category: '기호품', specialty: true, lock: 'vassal', peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        홀로: [
            { name: '마닐라삼', category: '섬유', specialty: true },
            { name: '정향', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '두리안', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '야자술', category: '주류', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '락충', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '람부탄', category: '기호품', specialty: true, lock: 'vassal', peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        브루나이: [
            { name: '흑단', category: '공업품', specialty: true },
            { name: '꿀', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '구리 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '망고', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '정향', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        쿠칭: [
            { name: '철재', category: '공업품', specialty: false },
            { name: '정향', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '노니', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '석탄', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        반자르마신: [
            { name: '침향', category: '향료', specialty: false },
            { name: '닭', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '두리안', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        수라바야: [
            { name: '크리스', category: '무기류', specialty: true },
            { name: '일랑일랑', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '토란', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '큐베브', category: '향신료', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        자카르타: [
            { name: '크리스', category: '무기류', specialty: true },
            { name: '흑단', category: '공업품', specialty: true },
            { name: '노니', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '구리 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '락충', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '큐베브', category: '향신료', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        팡칼피낭: [
            { name: '육두구', category: '향신료', specialty: true },
            { name: '장뇌', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '토란', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        팔렘방: [
            { name: '진주', category: '보석', specialty: false },
            { name: '금 식기', category: '공예품', specialty: false },
            { name: '장뇌', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        말라카: [
            { name: '망고스틴', category: '염료', specialty: true },
            { name: '판야', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '안식향', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '닭', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '고수', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레몬그라스', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '주석', category: '공업품', specialty: false },
            { name: '토란', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
        ],
        아체: [
            { name: '금 식기', category: '공예품', specialty: false },
            { name: '망고스틴', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '닭고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '장뇌', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        롭부리: [
            { name: '일랑일랑', category: '향료', specialty: true },
            { name: '판야', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레몬그라스', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '옥 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        페구: [
            { name: '대모갑', category: '잡화', specialty: true },
            { name: '비취', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '비단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '월장석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '옥 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        프레이노코르: [
            { name: '판야', category: '섬유', specialty: true },
            { name: '안식향', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '돼지', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '생사', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '느억맘', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '옥 공예품', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        파사이: [
            { name: '침향', category: '향료', specialty: false },
            { name: '안식향', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '자단', category: '공업품', specialty: false },
            { name: '락충', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        마카사르: [
            { name: '깃털 공예품', category: '공예품', specialty: true },
            { name: '메이스', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '노니', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        마닐라: [
            { name: '마닐라삼', category: '섬유', specialty: true },
            { name: '설탕봉', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '다목', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '구리 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '바나나', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '트날락', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        디우: [
            { name: '사금석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '홍차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '겨자', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '목화', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        고아: [
            { name: '캐시미어', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '루비', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '후추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '산양모', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '마살라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '재스민', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '카다멈', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '철퇴', category: '무기류', specialty: false },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        캘리컷: [
            { name: '후추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사파이어', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '보석세공', category: '공예품', specialty: false },
            { name: '인디고', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '홍차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '생강', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '커민', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        코친: [
            { name: '인디고', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '후추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '말린 망고', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '겨자', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '목화', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        실론: [
            { name: '계피', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '홍차', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '루비', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '월장석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '카다멈', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        말레: [
            { name: '루비', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사파이어', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '가다랑어', category: '식료품', specialty: false },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        퐁디셰리: [
            { name: '사파이어', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '계피', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '재스민', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '강황', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        마실리파트남: [
            { name: '면직물', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '사파이어', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '강황', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '생사', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '마살라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '인도 편사', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '헤나', category: '염료', specialty: true, lock: 'vassal', peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        캘커타: [
            { name: '루비', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '면직물', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '비단', category: '직물', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '생사', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '마살라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '카다멈', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '인도 편사', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '헤나', category: '염료', specialty: true, lock: 'vassal', peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '물소', category: '가축', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름'] },
        ],
        수에즈: [
            { name: '황철 광석', category: '광석', specialty: false },
            { name: '석유', category: '공업품', specialty: false },
            { name: '낙타털', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '누에콩', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '팥', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '시벳', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        제다: [
            { name: '석유', category: '공업품', specialty: false },
            { name: '양고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '이슬람의 경전', category: '잡화', specialty: false },
            { name: '곡도', category: '무기류', specialty: true },
            { name: '양', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        마사와: [
            { name: '청금석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '팥', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '커민', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '숨마끄', category: '향신료', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금 광석', category: '광석', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        아덴: [
            { name: '유향', category: '향료', specialty: true },
            { name: '석유', category: '공업품', specialty: false },
            { name: '용연향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '이슬람의 경전', category: '잡화', specialty: false },
            { name: '피스타치오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '석재', category: '공업품', specialty: false },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        도파르: [
            { name: '유향', category: '향료', specialty: true },
            { name: '피스타치오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '황철 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '꿀', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        소코트라: [
            { name: '자철 광석', category: '광석', specialty: false },
            { name: '용혈', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '대추야자', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '석류', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '용연향', category: '향료', specialty: false, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        무스카트: [
            { name: '보석세공', category: '공예품', specialty: false },
            { name: '유향', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '참깨', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '낙타털', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '공작석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '아연 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        호르무즈: [
            { name: '청금석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '터키석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '모슬린', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '양고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '올리브기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '바질', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '생강', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아위', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        도하: [
            { name: '대추야자', category: '식료품', specialty: true },
            { name: '유황', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '피스타치오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '곡도', category: '무기류', specialty: true },
            { name: '말', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '아라크', category: '주류', specialty: true, lock: 'monopoly', peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        시라즈: [
            { name: '호박단', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '요구르트', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '센나', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '낙타털', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '곡도', category: '무기류', specialty: true },
            { name: '노새', category: '가축', specialty: true, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '말', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '아위', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        바스라: [
            { name: '모슬린', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '요구르트', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '센나', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '유황', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '박하', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '노새', category: '가축', specialty: true, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '숨마끄', category: '향신료', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아위', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        바그다드: [
            { name: '청금석', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '호박단', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '보석세공', category: '공예품', specialty: false },
            { name: '잼', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '벨라도나', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '요구르트', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '아위', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        우수아이아: [
            { name: '구아노', category: '광석', specialty: false },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '창', category: '무기류', specialty: false },
            { name: '고산족 의복', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        부에노스아이레스: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '양파', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        리우데자네이루: [
            { name: '금', category: '귀금속', specialty: false },
            { name: '토파즈', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '푸스틱', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        소다섬: [
            { name: '다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '루벨라이트', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '토파즈', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '공작석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '마노', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
        ],
        바이아: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '카사바', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '크롬 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        페르남부쿠: [
            { name: '크롬 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '카카오', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        코피아포: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '아과요', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '계관석', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '퀴노아', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '카민', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '구아노', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '알파카', category: '가축', specialty: true, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '알파카 털실', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '비쿠냐털', category: '섬유', specialty: true, lock: 'vassal', peak: ['겨울', '우기'], off: ['여름'] },
            { name: '고산족 의복', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        발파라이소: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '계관석', category: '염료', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '카민', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '자철 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '고산족 의복', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        리마: [
            { name: '아과요', category: '직물', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아보카도', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '퀴노아', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '마카', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '알파카', category: '가축', specialty: true, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '알파카 털실', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '툼바가', category: '공예품', specialty: false },
            { name: '구와이아우드', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '비쿠냐털', category: '섬유', specialty: true, peak: ['겨울', '우기'], off: ['여름'] },
        ],
        툼베스: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '퀴노아', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '툼바가', category: '공예품', specialty: false },
            { name: '청동', category: '공업품', specialty: false },
            { name: '구와이아우드', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '비쿠냐털', category: '섬유', specialty: true, lock: 'vassal', peak: ['겨울', '우기'], off: ['여름'] },
            { name: '고산족 의복', category: '직물', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        카옌: [
            { name: '토파즈', category: '보석', specialty: true },
            { name: '산호세공', category: '공예품', specialty: false },
            { name: '카사바', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '푸스틱', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '무이라푸아마', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        코하셋: [
            { name: '마노', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '크랜베리', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '칠면조', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '은 광석', category: '광석', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        누탁: [
            { name: '칠면조', category: '가축', specialty: false },
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        아비앗: [
            { name: '칠면조', category: '가축', specialty: false },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '벼', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        터코마: [
            { name: '잉카로즈', category: '보석', specialty: true },
            { name: '메이플시럽', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '시더우드', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '고무', category: '공업품', specialty: true },
            { name: '구리 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        오론: [
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '푸에블로 도자기', category: '공예품', specialty: true },
            { name: '메이플시럽', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '블루베리', category: '기호품', specialty: true, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '고추', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '아니카', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        // 서아프리카
        아르긴: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '비도', category: '무기류', specialty: false },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        카보베르데: [
            { name: '진주 공예품', category: '공예품', specialty: false },
            { name: '설탕', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '사탕수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        배서스트: [
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '홍두', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '벼', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '주석 광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        비사우: [
            { name: '아프리카 쇠뇌', category: '무기류', specialty: true },
            { name: '홍두', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        시에라리온: [
            { name: '루벨라이트', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '아프리카 쇠뇌', category: '무기류', specialty: true },
            { name: '홍두', category: '향신료', specialty: true, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '비도', category: '무기류', specialty: false },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        아비장: [
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '루벨라이트', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '모시풀', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        엘미나: [
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '아프리카 쇠뇌', category: '무기류', specialty: true },
            { name: '진주조', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '백단향', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '야자섬유', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '석유', category: '공업품', specialty: false },
            { name: '테라코타', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        베냉: [
            { name: '황동상', category: '미술품', specialty: true },
            { name: '루벨라이트', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '벼', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '백단향', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '모시풀', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '테라코타', category: '공예품', specialty: true, lock: 'vassal' },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        팀북투: [
            { name: '다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '금세공', category: '공예품', specialty: false },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
        ],
        두알라: [
            { name: '진주 공예품', category: '공예품', specialty: false },
            { name: '커피', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '황단', category: '공업품', specialty: true },
            { name: '진주조', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '석탄', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        상투메: [
            { name: '진주 공예품', category: '공예품', specialty: false },
            { name: '비도', category: '무기류', specialty: false },
            { name: '야자섬유', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '전통 가면', category: '잡화', specialty: true, lock: 'monopoly', peak: ['우기'] },
        ],
        라스팔마스: [
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '설탕', category: '조미료', specialty: true, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '사탕수수', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '통나무', category: '공업품', specialty: false },
            { name: '염소', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '다르부카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        // 호주·태평양
        핀자라: [
            { name: '핑크 다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '유칼립투스', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '악어고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '소금', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '철광석', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '디저리두', category: '공예품', specialty: true },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        포트피리: [
            { name: '핑크 다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '부메랑', category: '무기류', specialty: false },
            { name: '디저리두', category: '공예품', specialty: true },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        가리: [
            { name: '핑크 다이아몬드', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '유칼립투스', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '캥거루고기', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '마누카', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '석탄', category: '광석', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '레몬머틀', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '마카다미아', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '무카이트', category: '보석', specialty: true, lock: 'vassal', peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        카카투와: [
            { name: '유칼립투스', category: '향료', specialty: true, peak: ['가을', '우기'], off: ['봄', '건기'] },
            { name: '캥거루고기', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '악어고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '마카다미아', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '감람석', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '부메랑', category: '무기류', specialty: false },
            { name: '무카이트', category: '보석', specialty: true, lock: 'vassal', peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        사마라이: [
            { name: '금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주조개', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        율도: [
            { name: '꼭두서니', category: '염료', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '조선 활', category: '무기류', specialty: false },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '황동 향로', category: '미술품', specialty: true, lock: 'monopoly' },
        ],
        수바: [
            { name: '흑진주', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '개오지', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '티아레 꽃', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        괌: [
            { name: '흑진주', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        아투오나: [
            { name: '흑진주', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '사금', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '석상', category: '미술품', specialty: false },
            { name: '바닐라', category: '향신료', specialty: false, peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '티아레 꽃', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        마히나: [
            { name: '흑진주', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '티아레 꽃', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        하와이: [
            { name: '흑진주', category: '보석', specialty: true, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '파파야', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '코코넛', category: '기호품', specialty: false, peak: ['가을', '건기'], off: ['봄', '우기'] },
            { name: '야자기름', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '티아레 꽃', category: '향료', specialty: true, lock: 'monopoly', peak: ['가을', '우기'], off: ['봄', '건기'] },
        ],
        호바트: [
            { name: '은', category: '귀금속', specialty: false, peak: ['겨울', '건기'], off: ['여름', '우기'] },
            { name: '캥거루고기', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '꿀', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '마누카', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        왕거누이: [
            { name: '산호', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주', category: '보석', specialty: false, peak: ['여름', '우기'], off: ['겨울', '건기'] },
            { name: '진주조개', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '꿀', category: '조미료', specialty: false, peak: ['여름', '건기'], off: ['겨울'] },
            { name: '녹용', category: '의약품', specialty: false, peak: ['봄', '우기'], off: ['가을'] },
            { name: '밀랍', category: '공업품', specialty: false },
            { name: '피투리', category: '기호품', specialty: true, lock: 'monopoly', peak: ['가을', '건기'], off: ['봄', '우기'] },
        ],
        어널래스카: [
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '투창', category: '무기류', specialty: false },
            { name: '밀', category: '식료품', specialty: false },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        // 북극해 A/B/C
        배로우: [
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '거위', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '레드우드', category: '공업품', specialty: true, lock: 'monopoly' },
        ],
        '캠브리지 베이': [
            { name: '페미컨', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        카나크: [
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '에키네시아', category: '의약품', specialty: true, lock: 'monopoly', peak: ['봄', '우기'], off: ['가을'] },
        ],
        레이캬비크: [
            { name: '양모', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '양고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        나르비크: [
            { name: '링곤베리', category: '의약품', specialty: true, peak: ['봄', '우기'], off: ['가을'] },
            { name: '염장 대구', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '양고기', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
        아르한겔스크: [
            { name: '염장 대구', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '순록', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '거위', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        딕슨: [
            { name: '순록', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '염장 대구', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '투창', category: '무기류', specialty: false },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        카탄가: [
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '깃펜', category: '잡화', specialty: false, peak: ['우기'] },
            { name: '양모', category: '섬유', specialty: false, peak: ['겨울', '우기'], off: ['여름'] },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        체르스키: [
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        코르프: [
            { name: '토끼', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '창', category: '무기류', specialty: false },
            { name: '고급 모자', category: '직물', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        오호츠크: [
            { name: '게', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '어육', category: '식료품', specialty: false, peak: ['가을', '건기'], off: ['봄'] },
            { name: '고급 모자', category: '직물', specialty: true, lock: 'vassal', peak: ['봄', '건기'], off: ['가을', '우기'] },
            { name: '쉬카뚤카', category: '공예품', specialty: true, lock: 'monopoly' },
        ],
        바르도: [
            { name: '염장 대구', category: '식료품', specialty: true, peak: ['가을', '건기'], off: ['봄'] },
            { name: '활', category: '무기류', specialty: false },
            { name: '순록', category: '가축', specialty: false, peak: ['겨울', '건기'], off: ['여름'] },
            { name: '주니퍼 베리', category: '향신료', specialty: true, lock: 'monopoly', peak: ['봄', '건기'], off: ['가을', '우기'] },
        ],
    };

    /** 상회 독점만 숨김. 권역 예속(vassal)은 이민에 따라 바뀌므로 표시 */
    function isLockedGood(g) {
        return !!(g && g.lock === 'monopoly');
    }

    /** 성수기/비수기 정보가 있는 품목인지 (없으면 시즌 변동 없음) */
    window.originGoodHasSeason = function (g) {
        return !!(g && ((g.peak && g.peak.length) || (g.off && g.off.length)));
    };

    /**
     * 게임 기준 "오늘" 날짜 (KST, 매일 09:00에 날짜 갱신)
     * 09:00 이전이면 전일로 취급 — 월 +1 판정에만 사용 (현실 달력 월 ≠ 게임 월)
     * @param {Date|number} [now]
     * @returns {{ year: number, month: number, day: number }}
     */
    window.getOriginGameDateParts = function (now) {
        const d = now instanceof Date ? now : new Date(now || Date.now());
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            hourCycle: 'h23',
        });
        const parts = {};
        for (const p of fmt.formatToParts(d)) {
            if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
        }
        let year = parts.year;
        let month = parts.month;
        let day = parts.day;
        const hour = parts.hour;
        if (hour < GAME_DAY_RESET_HOUR_KST) {
            const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
            const prev = new Date(noonUtc - 24 * 60 * 60 * 1000);
            year = prev.getUTCFullYear();
            month = prev.getUTCMonth() + 1;
            day = prev.getUTCDate();
        }
        return { year, month, day };
    };

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    /** @returns {string} YYYY-MM-DD (게임일) */
    window.getOriginGameDayKey = function (now) {
        const { year, month, day } = window.getOriginGameDateParts(now);
        return year + '-' + pad2(month) + '-' + pad2(day);
    };

    const LS_BARTER_MONTH = 'originBarterMonth';
    const LS_BARTER_MONTH_DAY = 'originBarterMonthGameDay';

    /**
     * 저장된 게임 월 (1~12). 없으면 null.
     * 현실 달력과 무관 — 사용자가 맞춘 값.
     */
    window.getOriginStoredMonth = function () {
        const m = parseInt(localStorage.getItem(LS_BARTER_MONTH) || '', 10);
        return (m >= 1 && m <= 12) ? m : null;
    };

    /**
     * 현재 헬퍼 게임 월 (1~12). 미설정 시 1.
     */
    window.getOriginGameMonth = function () {
        return window.getOriginStoredMonth() || 1;
    };

    /**
     * 게임일이 바뀌었으면(KST 09:00) 저장 월을 경과일만큼 +1.
     * @returns {number|null} 변경된 월, 변경 없으면 null
     */
    window.advanceOriginBarterMonthIfNeeded = function (now) {
        const todayKey = window.getOriginGameDayKey(now);
        const lastKey = localStorage.getItem(LS_BARTER_MONTH_DAY);

        if (!lastKey) {
            localStorage.setItem(LS_BARTER_MONTH_DAY, todayKey);
            return null;
        }
        if (lastKey === todayKey) return null;

        const lastMs = Date.parse(lastKey + 'T12:00:00Z');
        const todayMs = Date.parse(todayKey + 'T12:00:00Z');
        if (!Number.isFinite(lastMs) || !Number.isFinite(todayMs)) {
            localStorage.setItem(LS_BARTER_MONTH_DAY, todayKey);
            return null;
        }

        const days = Math.round((todayMs - lastMs) / (24 * 60 * 60 * 1000));
        localStorage.setItem(LS_BARTER_MONTH_DAY, todayKey);
        if (!(days > 0)) return null;

        let month = window.getOriginGameMonth();
        month = ((month - 1 + days) % 12) + 1;
        localStorage.setItem(LS_BARTER_MONTH, String(month));
        return month;
    };

    /**
     * @param {'season'|'climate'|string|null|undefined} axisOrPort
     * @returns {'season'|'climate'}
     * @deprecated 7종 계절 타입 시스템으로 대체됨
     */
    function resolveSeasonAxis(axisOrPort) {
        if (axisOrPort === 'climate' || axisOrPort === 'season') return axisOrPort;
        if (typeof axisOrPort === 'string' && axisOrPort
            && typeof window.getOriginPortSeasonAxis === 'function') {
            return window.getOriginPortSeasonAxis(axisOrPort);
        }
        return 'season';
    }

    /**
     * @deprecated 7종 계절 타입 시스템으로 대체됨
     */
    function tagBelongsToAxis(tag, axis) {
        if (axis === 'climate') return !!CLIMATE_TAGS[tag];
        return !!SEASON_TAGS[tag];
    }

    /**
     * 항구 또는 계절 타입 → 계절 타입 결정
     * @param {string|null|undefined} portOrType
     * @returns {string} 'north-4seasons' 등
     */
    function resolveSeasonType(portOrType) {
        if (!portOrType) return 'north-4seasons';
        const types = ['north-4seasons', 'south-4seasons', 'dry-rainy-dry',
                      'dry-1-rainy-dry', 'dry+1-rainy-dry', 'rainy-dry-rainy', 'tropical', 'arctic'];
        if (types.indexOf(portOrType) !== -1) return portOrType;
        // 항구명으로 간주
        if (typeof window.getOriginPortSeasonType === 'function') {
            return window.getOriginPortSeasonType(portOrType);
        }
        return 'north-4seasons';
    }

    /**
     * @param {number} [month] 1~12, 생략 시 게임 월
     * @param {string} [portOrType] 항구명 또는 계절 타입 ('north-4seasons' 등)
     * @returns {{ month: number, seasonType: string, activeTag: string, tags: string[] }}
     */
    window.getOriginSeasonForMonth = function (month, portOrType) {
        let m = Number(month);
        if (!(m >= 1 && m <= 12)) m = window.getOriginGameMonth();
        
        const seasonType = resolveSeasonType(portOrType);
        const calendars = window.SEASON_TYPE_CALENDARS || {};
        const calendar = calendars[seasonType] || calendars['north-4seasons'] || [];
        const activeTag = calendar[m - 1] || ''; // 배열 인덱스는 0부터
        
        return {
            month: m,
            seasonType,
            activeTag,
            tags: activeTag ? [activeTag] : []
        };
    };

    /**
     * 계절 타입별 분류 성수기/비수기 규칙
     * ※ 통합표 기준으로 추후 완성 예정
     * @type {Record<string, Record<string, { peak?: string[], off?: string[] }>>}
     */
    window.CATEGORY_SEASON_RULES = {
        'north-4seasons': {
            // 예시: '식료품': { peak: ['봄'], off: ['가을'] },
            // 통합표 기준으로 추후 추가
        },
        'south-4seasons': {
            // 남반구는 북반구와 반대 계절
        },
        'dry-rainy-dry': {
            // 건기-우기 규칙
        },
        'dry-1-rainy-dry': {
            // 건기-1-우기 규칙
        },
        'dry+1-rainy-dry': {
            // 건기+1-우기 규칙
        },
        'rainy-dry-rainy': {
            // 우기-건기 규칙
        },
        'tropical': {
            // 열대는 모든 분류 평수기 (빈 객체)
        },
        'arctic': {
            // 한대는 모든 분류 평수기 (빈 객체)
        }
    };

    /**
     * 항상 평수기인 특수 교역품 (예외 처리)
     */
    window.ALWAYS_PLAIN_GOODS = ['밀'];

    /**
     * 구매 한도 배수 (평시=1 기준)
     * 성수기 1.5 / 비수기 0.5 / 시즌없음·중성 1.0
     */
    window.ORIGIN_SEASON_QTY_MULT = {
        peak: 1.5,
        off: 0.5,
        plain: 1,
    };

    /**
     * 품목의 성수기/비수기 상태 판정 (7종 계절 타입 기반)
     * 우선순위:
     * 1. 열대/한대 → 항상 plain
     * 2. 특수 교역품(밀 등) → 항상 plain
     * 3. 분류별 규칙 → peak/off 판정 (CATEGORY_SEASON_RULES)
     * 4. 품목별 태그 → peak/off 판정 (호환성, 기존 데이터)
     * @param {{ name?: string, category?: string, peak?: string[], off?: string[] }} g
     * @param {number} [month]
     * @param {string} [portOrType] 항구명 또는 계절 타입
     * @returns {'peak'|'off'|'plain'}
     */
    window.getOriginGoodSeasonStatus = function (g, month, portOrType) {
        if (!g) return 'plain';
        
        const { seasonType, activeTag } = window.getOriginSeasonForMonth(month, portOrType);
        
        // 1. 열대/한대는 항상 평수기
        if (seasonType === 'tropical' || seasonType === 'arctic') return 'plain';
        
        // 2. 특수 교역품 (밀 등)
        const alwaysPlain = window.ALWAYS_PLAIN_GOODS || [];
        if (g.name && alwaysPlain.indexOf(g.name) !== -1) return 'plain';
        
        // 3. activeTag가 없으면 평수기
        if (!activeTag) return 'plain';
        
        // 4. 분류별 규칙 조회
        const categoryRules = window.CATEGORY_SEASON_RULES || {};
        const typeRules = categoryRules[seasonType] || {};
        const categoryRule = g.category ? typeRules[g.category] : null;
        
        if (categoryRule) {
            // 분류별 규칙이 있으면 사용
            const hit = (arr) => Array.isArray(arr) && arr.indexOf(activeTag) !== -1;
            if (hit(categoryRule.peak)) return 'peak';
            if (hit(categoryRule.off)) return 'off';
            return 'plain';
        }
        
        // 5. 품목별 peak/off 태그로 폴백 (기존 데이터 호환)
        if (!window.originGoodHasSeason(g)) return 'plain';
        const hit = (arr) => Array.isArray(arr) && arr.indexOf(activeTag) !== -1;
        if (hit(g.peak)) return 'peak';
        if (hit(g.off)) return 'off';
        return 'plain';
    };

    /**
     * 평시 수량 기준 시즌 배수
     * @param {{ peak?: string[], off?: string[] }} g
     * @param {number} [month]
     * @param {'season'|'climate'|string} [axisOrPort]
     * @returns {number} peak 1.5 / off 0.5 / plain 1
     */
    window.getOriginGoodSeasonQtyMult = function (g, month, axisOrPort) {
        const status = window.getOriginGoodSeasonStatus(g, month, axisOrPort);
        const table = window.ORIGIN_SEASON_QTY_MULT || { peak: 1.5, off: 0.5, plain: 1 };
        return table[status] != null ? table[status] : 1;
    };

    /**
     * 평시 수량 → 해당 월 예상 구매 한도
     * @param {{ peak?: string[], off?: string[] }} g
     * @param {number} plainQty
     * @param {number} [month]
     * @param {'season'|'climate'|string} [axisOrPort]
     * @returns {number}
     */
    window.getOriginGoodSeasonQty = function (g, plainQty, month, axisOrPort) {
        const base = Number(plainQty) || 0;
        // 시즌 배수(1.5/0.5) 계산 시 소수점은 반올림
        return Math.round(base * window.getOriginGoodSeasonQtyMult(g, month, axisOrPort));
    };

    /**
     * @param {string} portName
     * @param {string|string[]} [category] - 분류명 또는 교역품 이름 배열
     * @param {{ includeLocked?: boolean, byName?: boolean }} [opts]
     */
    window.getOriginPortGoods = function (portName, category, opts) {
        const includeLocked = !!(opts && opts.includeLocked);
        const byName = !!(opts && opts.byName);
        let list = window.ORIGIN_PORT_GOODS[portName] || [];
        if (!includeLocked) list = list.filter(g => !isLockedGood(g));
        if (!category) return list.slice();

        const cats = Array.isArray(category) ? category.filter(Boolean) : [category];
        if (!cats.length) return list.slice();

        // byName 옵션: 교역품 이름으로 필터링
        if (byName) {
            return list.filter(g => cats.includes(g.name));
        }

        if (cats.length === 1) {
            const c = cats[0];
            if (c === '명산품') return list.filter(g => !!g.specialty);
            return list.filter(g => g.category === c);
        }

        // 복수 분류: OR 합집합 (이름+분류 기준 중복 제거)
        const seen = new Set();
        const out = [];
        for (const c of cats) {
            const matched = c === '명산품'
                ? list.filter(g => !!g.specialty)
                : list.filter(g => g.category === c);
            for (const g of matched) {
                const key = g.name + '\0' + g.category;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(g);
            }
        }
        return out;
    };

    /**
     * 현재 맵 핀 항구 중 해당 분류 교역품이 있는 항구만
     * @param {{ name: string }[]} pins
     * @param {string|string[]} category
     * @returns {{ portName: string, goods: OriginGood[] }[]}
     */
    window.getOriginMapGoodsByCategory = function (pins, category) {
        if (!category || !Array.isArray(pins)) return [];
        const cats = Array.isArray(category) ? category.filter(Boolean) : [category];
        if (!cats.length) return [];
        const out = [];
        for (const pin of pins) {
            const goods = window.getOriginPortGoods(pin.name, cats);
            if (goods.length) out.push({ portName: pin.name, goods });
        }
        out.sort((a, b) => a.portName.localeCompare(b.portName, 'ko'));
        return out;
    };
})();
