// =============== origin-ports-coords.js ===============
// 해역(맵 뷰)별 항구 상대 좌표
// - image 있는 뷰: 이미지 기준 x/y% (0~100), fit 미적용
// - image 없는 뷰: 근사 좌표 + fitPorts 스케일

(function () {
    'use strict';

    /**
     * @typedef {{ x: number, y: number }} Pt
     * @typedef {{
     *   id: string,
     *   label: string,
     *   anchor: string,
     *   regions: string[],
     *   ports: Record<string, Pt>,
     *   image?: string,
     *   imageAspect?: number
     * }} MapView
     */

    /** @type {MapView[]} */
    const VIEWS = [
        {
            id: 'eastmed',
            label: '동지중해·흑해',
            anchor: '이스탄불',
            image: 'images/origin/eastmed.png',
            imageAspect: 1024 / 640,
            imageVersion: '20260714c',
            regions: ['동지중해', '흑해 인근', '이탈리아반도', '지중해', '남인도양'],
            ports: {
                오데사: { x: 70, y: 8 },
                타간로크: { x: 88, y: 7 },
                케르치: { x: 80, y: 14 },
                바르나: { x: 60, y: 20 },
                트라브존: { x: 86, y: 30 },
                이스탄불: { x: 66, y: 32 },
                테살로니키: { x: 52, y: 36 },
                아테네: { x: 52, y: 46 },
                칸디아: { x: 56, y: 56 },
                안탈리아: { x: 72, y: 48 },
                니코시아: { x: 70, y: 54 },
                베이루트: { x: 80, y: 58 },
                야파: { x: 78, y: 66 },
                알렉산드리아: { x: 64, y: 72 },
                포트사이드: { x: 72, y: 70 },
                카이로: { x: 68, y: 78 },
                수에즈: { x: 74, y: 76 },
                베네치아: { x: 28, y: 18 },
                제노바: { x: 16, y: 24 },
                나폴리: { x: 30, y: 42 },
                시라쿠사: { x: 36, y: 55 },
                튀니스: { x: 26, y: 58 },
                트리폴리: { x: 38, y: 68 },
                라구사: { x: 42, y: 28 },
                안코나: { x: 34, y: 30 },
                자다르: { x: 38, y: 26 },
                트리에스테: { x: 32, y: 16 },
                벵가지: { x: 48, y: 62 },
                피사: { x: 22, y: 32 },
                칼리아리: { x: 24, y: 48 },
                사사리: { x: 22, y: 42 },
                칼비: { x: 26, y: 36 },
                마르세유: { x: 12, y: 28 },
                몽펠리에: { x: 10, y: 32 },
            },
        },
        {
            id: 'gibraltar',
            label: '지브롤터·이베리아',
            anchor: '리스본',
            image: 'images/origin/gibraltar-16x9.png',
            imageAspect: 1024 / 576,
            imageVersion: '20260714-2302',
            regions: ['지브롤터 근처', '서아프리카', '잉글랜드 서쪽'],
            ports: {
                리스본: { x: 38, y: 42 },
                포르투: { x: 36, y: 32 },
                파루: { x: 40, y: 52 },
                세비야: { x: 48, y: 50 },
                말라가: { x: 54, y: 54 },
                발렌시아: { x: 62, y: 42 },
                바르셀로나: { x: 70, y: 34 },
                팔마: { x: 68, y: 44 },
                세우타: { x: 46, y: 56 },
                알제: { x: 72, y: 58 },
                카사블랑카: { x: 42, y: 62 },
                히혼: { x: 48, y: 22 },
                아조레스: { x: 12, y: 48 },
                마데이라: { x: 22, y: 62 },
                산타섬: { x: 18, y: 40 },
                라스팔마스: { x: 28, y: 78 },
            },
        },
        {
            id: 'northsea',
            label: '북해·스칸디나비아',
            anchor: '암스테르담',
            regions: ['북해', '스칸디나비아반도', '잉글랜드 서쪽', '북극해'],
            ports: {
                런던: { x: 32, y: 58 },
                도버: { x: 38, y: 60 },
                칼레: { x: 42, y: 62 },
                앤트워프: { x: 48, y: 56 },
                암스테르담: { x: 50, y: 48 },
                덴헬데르: { x: 48, y: 42 },
                그로닝겐: { x: 56, y: 42 },
                브레멘: { x: 60, y: 46 },
                함부르크: { x: 64, y: 44 },
                뤼베크: { x: 68, y: 42 },
                에든버러: { x: 28, y: 38 },
                브리스틀: { x: 22, y: 56 },
                플리머스: { x: 18, y: 62 },
                더블린: { x: 14, y: 48 },
                낭트: { x: 28, y: 72 },
                보르도: { x: 32, y: 80 },
                코펜하겐: { x: 66, y: 36 },
                그단스크: { x: 78, y: 40 },
                리가: { x: 86, y: 32 },
                상트페테르부르크: { x: 92, y: 24 },
                스톡홀름: { x: 76, y: 28 },
                비스뷔: { x: 72, y: 34 },
                오슬로: { x: 60, y: 28 },
                베르겐: { x: 52, y: 22 },
                코콜라: { x: 82, y: 18 },
                레이캬비크: { x: 8, y: 18 },
                나르비크: { x: 68, y: 8 },
                바르도: { x: 84, y: 6 },
                아르한겔스크: { x: 96, y: 16 },
            },
        },
        {
            id: 'wafrica',
            label: '서아프리카',
            anchor: '엘미나',
            regions: ['서아프리카', '남아프리카'],
            ports: {
                아르긴: { x: 28, y: 18 },
                배서스트: { x: 26, y: 28 },
                비사우: { x: 28, y: 34 },
                시에라리온: { x: 32, y: 42 },
                프라이아: { x: 12, y: 40 },
                아비장: { x: 42, y: 52 },
                엘미나: { x: 50, y: 54 },
                베냉: { x: 58, y: 54 },
                두알라: { x: 68, y: 58 },
                상투메: { x: 60, y: 64 },
                팀북투: { x: 48, y: 28 },
                루안다: { x: 62, y: 82 },
                라스팔마스: { x: 22, y: 8 },
            },
        },
        {
            id: 'eafrica',
            label: '동·남아프리카',
            anchor: '몸바사',
            regions: ['동아프리카', '남아프리카'],
            ports: {
                모가디슈: { x: 58, y: 12 },
                말린디: { x: 52, y: 28 },
                몸바사: { x: 50, y: 34 },
                잔지바르: { x: 48, y: 42 },
                킬와: { x: 46, y: 50 },
                모잠비크: { x: 44, y: 58 },
                켈리마느: { x: 40, y: 66 },
                소팔라: { x: 36, y: 72 },
                나탈: { x: 32, y: 84 },
                타마타브: { x: 72, y: 62 },
                루안다: { x: 12, y: 48 },
                벵겔라: { x: 14, y: 60 },
                카리비브: { x: 18, y: 72 },
                케이프타운: { x: 28, y: 42 },
            },
        },
        {
            id: 'indian',
            label: '인도양·중동',
            anchor: '무스카트',
            regions: ['남인도양', '동인도양'],
            ports: {
                제다: { x: 18, y: 42 },
                미사와: { x: 12, y: 48 },
                아덴: { x: 22, y: 62 },
                도파르: { x: 38, y: 58 },
                무스카트: { x: 48, y: 42 },
                호르무즈: { x: 42, y: 32 },
                도하: { x: 40, y: 36 },
                바스라: { x: 36, y: 22 },
                바그다드: { x: 32, y: 14 },
                시라즈: { x: 48, y: 28 },
                하디보: { x: 28, y: 72 },
                수에즈: { x: 14, y: 28 },
                디우: { x: 62, y: 38 },
                고아: { x: 68, y: 48 },
                캘리컷: { x: 72, y: 56 },
                코친: { x: 74, y: 62 },
                실론: { x: 78, y: 68 },
                말레: { x: 68, y: 80 },
                폰디셰리: { x: 82, y: 58 },
                마실리파트남: { x: 84, y: 48 },
                캘커타: { x: 90, y: 38 },
                페구: { x: 96, y: 42 },
            },
        },
        {
            id: 'seasia',
            label: '동남아',
            anchor: '말라카',
            regions: ['서남아시아', '동남아시아', '호주'],
            ports: {
                하노이: { x: 48, y: 8 },
                프레이노크르: { x: 42, y: 22 },
                롭부리: { x: 36, y: 18 },
                페구: { x: 28, y: 14 },
                아체: { x: 22, y: 42 },
                파사이: { x: 26, y: 40 },
                말라카: { x: 38, y: 48 },
                팔렘방: { x: 42, y: 58 },
                팡칼피낭: { x: 48, y: 54 },
                자카르타: { x: 52, y: 68 },
                수라바야: { x: 62, y: 70 },
                쿠칭: { x: 58, y: 48 },
                브루네이: { x: 64, y: 42 },
                반자르마신: { x: 66, y: 56 },
                마카사르: { x: 72, y: 62 },
                마닐라: { x: 78, y: 28 },
                다바오: { x: 86, y: 36 },
                홀로: { x: 82, y: 40 },
                암본: { x: 84, y: 58 },
                반다: { x: 88, y: 62 },
                테르나테: { x: 86, y: 52 },
                딜리: { x: 78, y: 72 },
                단수이: { x: 58, y: 12 },
                타이난: { x: 68, y: 8 },
                사마라이: { x: 96, y: 58 },
                가리: { x: 92, y: 82 },
                카카투와: { x: 84, y: 78 },
            },
        },
        {
            id: 'eastasia',
            label: '동아시아',
            anchor: '한양',
            regions: ['동아시아', '극동서아시아', '극동남아시아', '북극해B'],
            ports: {
                북경: { x: 42, y: 18 },
                서안: { x: 22, y: 32 },
                중경: { x: 28, y: 42 },
                항주: { x: 50, y: 38 },
                천주: { x: 54, y: 50 },
                마카오: { x: 46, y: 78 },
                연운: { x: 48, y: 28 },
                한양: { x: 68, y: 30 },
                동래: { x: 74, y: 38 },
                영일: { x: 76, y: 32 },
                덕원: { x: 72, y: 24 },
                제주: { x: 70, y: 46 },
                에도: { x: 96, y: 34 },
                사카이: { x: 90, y: 40 },
                나가사키: { x: 84, y: 48 },
                // 류큐: 대만(타이난) 동쪽, 규슈(나가사키) 남쪽
                타이난: { x: 64, y: 70 },
                나하: { x: 80, y: 72 },
                에조: { x: 94, y: 14 },
                하노이: { x: 36, y: 86 },
                오호츠크: { x: 92, y: 6 },
                체르스키: { x: 82, y: 4 },
                코르프: { x: 98, y: 10 },
            },
        },
        {
            id: 'caribbean',
            label: '카리브·중미',
            anchor: '하바나',
            regions: ['중미', '동북미', '북미'],
            ports: {
                베라크루스: { x: 28, y: 48 },
                메리다: { x: 38, y: 42 },
                아카풀코: { x: 18, y: 58 },
                과테말라: { x: 32, y: 62 },
                트루히요: { x: 40, y: 68 },
                파나마: { x: 48, y: 72 },
                포르토벨로: { x: 52, y: 68 },
                하바나: { x: 48, y: 38 },
                나사우: { x: 58, y: 28 },
                산티아고: { x: 62, y: 48 },
                산토도밍고: { x: 70, y: 50 },
                산후안: { x: 82, y: 52 },
                포트로열: { x: 64, y: 56 },
                사우스사이드: { x: 66, y: 58 },
                윌렘스타트: { x: 72, y: 68 },
                포를라마르: { x: 76, y: 66 },
                마라카이보: { x: 60, y: 74 },
                카르타헤나: { x: 54, y: 76 },
                카라카스: { x: 70, y: 78 },
                카옌: { x: 88, y: 82 },
                누탁: { x: 42, y: 18 },
                아비앗: { x: 36, y: 22 },
                코하셋: { x: 72, y: 12 },
            },
        },
        {
            id: 'southamerica',
            label: '남미',
            anchor: '리우데자네이루',
            regions: ['남미', '남대서양'],
            ports: {
                툼베스: { x: 18, y: 18 },
                리마: { x: 20, y: 32 },
                코피아포: { x: 22, y: 52 },
                발파라이소: { x: 24, y: 62 },
                페르남부쿠: { x: 78, y: 22 },
                바이아: { x: 78, y: 36 },
                리우데자네이루: { x: 72, y: 48 },
                부에노스아이레스: { x: 58, y: 68 },
                우수아이아: { x: 52, y: 92 },
                소다섬: { x: 42, y: 40 },
            },
        },
        {
            id: 'australia',
            label: '호주·태평양',
            anchor: '가리',
            regions: ['호주', '태평양'],
            ports: {
                사마라이: { x: 68, y: 22 },
                괌: { x: 78, y: 18 },
                // 태평양 고립 섬 (필리핀·뉴기니 동북쪽)
                율도: { x: 90, y: 12 },
                수바: { x: 92, y: 48 },
                하와이: { x: 12, y: 28 },
                마히나: { x: 96, y: 58 },
                아투오나: { x: 8, y: 68 },
                어널래스카: { x: 18, y: 8 },
                카카투와: { x: 52, y: 38 },
                가리: { x: 72, y: 48 },
                포트피리: { x: 54, y: 62 },
                핀자라: { x: 30, y: 64 },
                호바트: { x: 64, y: 80 },
                왕거누이: { x: 88, y: 74 },
            },
        },
        {
            id: 'northamerica',
            label: '북미',
            anchor: '터코마',
            regions: ['북미', '동북미', '북극해B'],
            ports: {
                터코마: { x: 22, y: 42 },
                오론: { x: 18, y: 58 },
                코하셋: { x: 82, y: 38 },
                누탁: { x: 28, y: 18 },
                배로우: { x: 48, y: 8 },
                아비앗: { x: 72, y: 28 },
            },
        },
    ];

    // 해역 그래프: 상하좌우 인접 (실제 지리 감각 근사)
    const NEIGHBORS = {
        eastmed:       { up: 'northsea',    down: 'eafrica',      left: 'gibraltar',  right: 'indian' },
        gibraltar:     { up: 'northsea',    down: 'wafrica',      left: 'caribbean',  right: 'eastmed' },
        northsea:      { up: null,          down: 'gibraltar',    left: 'northamerica', right: 'eastasia' },
        wafrica:       { up: 'gibraltar',   down: 'eafrica',      left: 'southamerica', right: 'eafrica' },
        eafrica:       { up: 'eastmed',     down: 'australia',    left: 'wafrica',    right: 'indian' },
        indian:        { up: 'eastasia',    down: 'australia',    left: 'eastmed',    right: 'seasia' },
        seasia:        { up: 'eastasia',    down: 'australia',    left: 'indian',     right: null },
        eastasia:      { up: null,          down: 'seasia',       left: 'northsea',   right: null },
        caribbean:     { up: 'northamerica', down: 'southamerica', left: null,        right: 'gibraltar' },
        southamerica:  { up: 'caribbean',   down: null,           left: null,         right: 'wafrica' },
        australia:     { up: 'seasia',      down: null,           left: 'eafrica',    right: null },
        northamerica:  { up: null,          down: 'caribbean',    left: null,         right: 'northsea' },
    };

    // 화면 여백 (%): 핀 라벨이 위로/아래로 나가도 잘리지 않게
    const FIT = {
        left: 6,
        right: 94,
        top: 16,    // 가장 북쪽 항구 위 여백
        bottom: 88, // 아래까지 펼쳐 빈 공간 줄임
    };

    function regionByName() {
        const map = Object.create(null);
        for (const p of window.ORIGIN_PORTS || []) {
            map[p.name] = p.region;
        }
        return map;
    }

    /** 해역 좌표를 맵 영역에 맞게 균등 스케일 (상단 치우침·하단 공백 완화) */
    function fitPorts(ports) {
        const names = Object.keys(ports);
        if (names.length === 0) return {};

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const name of names) {
            const p = ports[name];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const spanX = Math.max(maxX - minX, 8);
        const spanY = Math.max(maxY - minY, 8);
        const outW = FIT.right - FIT.left;
        const outH = FIT.bottom - FIT.top;

        const fitted = {};
        for (const name of names) {
            const p = ports[name];
            fitted[name] = {
                x: FIT.left + ((p.x - minX) / spanX) * outW,
                y: FIT.top + ((p.y - minY) / spanY) * outH,
            };
        }
        return fitted;
    }

    function pinsForView(view) {
        const regions = regionByName();
        // 실제 맵 이미지가 있으면 이미지 % 좌표 그대로 사용 (드래그 보정용)
        const pts = view.image ? view.ports : fitPorts(view.ports);
        return Object.keys(pts).map(name => ({
            name,
            region: regions[name] || '',
            x: pts[name].x,
            y: pts[name].y,
            mapId: view.id,
        }));
    }

    function getView(id) {
        return VIEWS.find(v => v.id === id) || VIEWS[0];
    }

    function getNeighbors(viewId) {
        return NEIGHBORS[viewId] || { up: null, down: null, left: null, right: null };
    }

    window.ORIGIN_MAP_VIEWS = VIEWS;
    window.getOriginMapView = getView;
    window.getOriginMapPins = function (viewId) {
        return pinsForView(getView(viewId));
    };
    window.getOriginMapNeighbors = getNeighbors;

    // 하위 호환: 기존 동지중해 상수
    window.ORIGIN_EASTMED_PORTS = pinsForView(getView('eastmed'));
})();
