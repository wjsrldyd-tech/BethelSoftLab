// =============== origin-ports-data.js ===============
// 대항해시대 오리진 항구 목록 (이름 + 해역)
// 언어·시설·종교·좌표는 추후 확장

(function () {
    'use strict';

    /** @type {{ name: string, region: string }[]} */
    window.ORIGIN_PORTS = [
        // 동아프리카
        { name: '모삼비크', region: '동아프리카' },
        { name: '소팔라', region: '동아프리카' },
        { name: '잔지바르', region: '동아프리카' },
        { name: '나탈', region: '동아프리카' },
        { name: '만바사', region: '동아프리카' },
        { name: '말린디', region: '동아프리카' },
        { name: '무크디쇼', region: '동아프리카' },
        { name: '칼리마니', region: '동아프리카' },
        { name: '킬와', region: '동아프리카' },
        { name: '토아마시나', region: '동아프리카' },

        // 지브롤터 근처
        { name: '리스보아', region: '지브롤터 근처' },
        { name: '산타섬', region: '지브롤터 근처' },
        { name: '세비야', region: '지브롤터 근처' },
        { name: '말라가', region: '지브롤터 근처' },
        { name: '바르셀로나', region: '지브롤터 근처' },
        { name: '발렌시아', region: '지브롤터 근처' },
        { name: '세우타', region: '지브롤터 근처' },
        { name: '알제', region: '지브롤터 근처' },
        { name: '카사블랑카', region: '지브롤터 근처' },
        { name: '파루', region: '지브롤터 근처' },
        { name: '팔마', region: '지브롤터 근처' },
        { name: '폰타델가다', region: '지브롤터 근처' },
        { name: '푼샬', region: '지브롤터 근처' },

        // 잉글랜드 서쪽
        { name: '낭트', region: '잉글랜드 서쪽' },
        { name: '두블린', region: '잉글랜드 서쪽' },
        { name: '보르도', region: '잉글랜드 서쪽' },
        { name: '브리스틀', region: '잉글랜드 서쪽' },
        { name: '포르투', region: '잉글랜드 서쪽' },
        { name: '플리머스', region: '잉글랜드 서쪽' },
        { name: '히혼', region: '잉글랜드 서쪽' },

        // 북해
        { name: '런던', region: '북해' },
        { name: '암스테르담', region: '북해' },
        { name: '함부르크', region: '북해' },
        { name: '브레멘', region: '북해' },
        { name: '안트베르펜', region: '북해' },
        { name: '에든버러', region: '북해' },
        { name: '칼레', region: '북해' },
        { name: '덴헬데르', region: '북해' },
        { name: '도버', region: '북해' },
        { name: '흐로닝언', region: '북해' },

        // 스칸디나비아반도
        { name: '상트페테르부르크', region: '스칸디나비아반도' },
        { name: '쾨벤하운', region: '스칸디나비아반도' },
        { name: '뤼베크', region: '스칸디나비아반도' },
        { name: '스톡홀름', region: '스칸디나비아반도' },
        { name: '오슬로', region: '스칸디나비아반도' },
        { name: '그단스크', region: '스칸디나비아반도' },
        { name: '리가', region: '스칸디나비아반도' },
        { name: '베르겐', region: '스칸디나비아반도' },
        { name: '비스뷔', region: '스칸디나비아반도' },
        { name: '코콜라', region: '스칸디나비아반도' },

        // 지중해
        { name: '나폴리', region: '지중해' },
        { name: '마르세유', region: '지중해' },
        { name: '제노바', region: '지중해' },
        { name: '투니스', region: '지중해' },
        { name: '피사', region: '지중해' },
        { name: '몽펠리에', region: '지중해' },
        { name: '사사리', region: '지중해' },
        { name: '칼리아리', region: '지중해' },
        { name: '칼비', region: '지중해' },

        // 이탈리아반도
        { name: '베네치아', region: '이탈리아반도' },
        { name: '라구사', region: '이탈리아반도' },
        { name: '시라쿠자', region: '이탈리아반도' },
        { name: '벵가지', region: '이탈리아반도' },
        { name: '안코나', region: '이탈리아반도' },
        { name: '자라', region: '이탈리아반도' },
        { name: '타라불루스', region: '이탈리아반도' },
        { name: '트리에스테', region: '이탈리아반도' },

        // 동지중해
        { name: '알이스칸다리야', region: '동지중해' },
        { name: '베이루트', region: '동지중해' },
        { name: '알카히라', region: '동지중해' },
        { name: '칸디아', region: '동지중해' },
        { name: '레프코샤', region: '동지중해' },
        { name: '보르사이드', region: '동지중해' },
        { name: '안탈리아', region: '동지중해' },
        { name: '야파', region: '동지중해' },

        // 흑해 인근
        { name: '아티나', region: '흑해 인근' },
        { name: '코스탄티니예', region: '흑해 인근' },
        { name: '바르나', region: '흑해 인근' },
        { name: '오데사', region: '흑해 인근' },
        { name: '케르치', region: '흑해 인근' },
        { name: '타간로크', region: '흑해 인근' },
        { name: '테살로니키', region: '흑해 인근' },
        { name: '트라브존', region: '흑해 인근' },

        // 서아프리카
        { name: '팀북투', region: '서아프리카' },
        { name: '아비장', region: '서아프리카' },
        { name: '엘미나', region: '서아프리카' },
        { name: '두알라', region: '서아프리카' },
        { name: '라스팔마스', region: '서아프리카' },
        { name: '배서스트', region: '서아프리카' },
        { name: '베냉', region: '서아프리카' },
        { name: '비사우', region: '서아프리카' },
        { name: '상토메', region: '서아프리카' },
        { name: '시에라리온', region: '서아프리카' },
        { name: '아르김', region: '서아프리카' },
        { name: '프라이아', region: '서아프리카' },

        // 동북미
        { name: '베라크루스', region: '동북미' },
        { name: '트루히요', region: '동북미' },
        { name: '포르토벨로', region: '동북미' },
        { name: '나사우', region: '동북미' },
        { name: '누탁', region: '동북미' },
        { name: '메리다', region: '동북미' },
        { name: '아비앗', region: '동북미' },
        { name: '코하셋', region: '동북미' },

        // 중미
        { name: '산토도밍고', region: '중미' },
        { name: '포트로열', region: '중미' },
        { name: '마라카이보', region: '중미' },
        { name: '빌렘스타트', region: '중미' },
        { name: '사우스사이드', region: '중미' },
        { name: '산티아고', region: '중미' },
        { name: '산후안', region: '중미' },
        { name: '아바나', region: '중미' },
        { name: '카라카스', region: '중미' },
        { name: '카르타헤나', region: '중미' },
        { name: '카옌', region: '중미' },
        { name: '포를라마르', region: '중미' },

        // 남미
        { name: '리마', region: '남미' },
        { name: '리우데자네이루', region: '남미' },
        { name: '바이아', region: '남미' },
        { name: '발파라이소', region: '남미' },
        { name: '부에노스아이레스', region: '남미' },
        { name: '우수아이아', region: '남미' },
        { name: '코피아포', region: '남미' },
        { name: '툼베스', region: '남미' },
        { name: '페르남부쿠', region: '남미' },

        // 남대서양
        { name: '소다섬', region: '남대서양' },

        // 남아프리카
        { name: '루안다', region: '남아프리카' },
        { name: '이카파', region: '남아프리카' },
        { name: '벵겔라', region: '남아프리카' },
        { name: '카리비브', region: '남아프리카' },

        // 남인도양
        { name: '마스카트', region: '남인도양' },
        { name: '바그다드', region: '남인도양' },
        { name: '아딘', region: '남인도양' },
        { name: '알바스라', region: '남인도양' },
        { name: '앗수웨이스', region: '남인도양' },
        { name: '지다', region: '남인도양' },
        { name: '하라무즈', region: '남인도양' },
        { name: '도파르', region: '남인도양' },
        { name: '마사와', region: '남인도양' },
        { name: '시라즈', region: '남인도양' },
        { name: '알비다', region: '남인도양' },
        { name: '하디보', region: '남인도양' },

        // 동인도양
        { name: '코지코드', region: '동인도양' },
        { name: '고아', region: '동인도양' },
        { name: '고치', region: '동인도양' },
        { name: '디우', region: '동인도양' },
        { name: '마실리파트남', region: '동인도양' },
        { name: '코테', region: '동인도양' },
        { name: '콜카타', region: '동인도양' },
        { name: '판디체리', region: '동인도양' },
        { name: '페구', region: '동인도양' },

        // 북극해
        { name: '나르비크', region: '북극해' },
        { name: '레이캬비크', region: '북극해' },
        { name: '바르도', region: '북극해' },

        // 서남아시아
        { name: '믈라카', region: '서남아시아' },
        { name: '자야카르타', region: '서남아시아' },
        { name: '롭부리', region: '서남아시아' },
        { name: '수라바야', region: '서남아시아' },
        { name: '아체', region: '서남아시아' },
        { name: '파사이', region: '서남아시아' },
        { name: '팔렘방', region: '서남아시아' },
        { name: '팡칼피낭', region: '서남아시아' },
        { name: '프레이노코르', region: '서남아시아' },
        { name: '하노이', region: '서남아시아' },

        // 북미
        { name: '과테말라', region: '북미' },
        { name: '아카풀코', region: '북미' },
        { name: '오흘론', region: '북미' },
        { name: '터코마', region: '북미' },
        { name: '파나마', region: '북미' },

        // 동남아시아
        { name: '호베', region: '동남아시아' },
        { name: '다바오', region: '동남아시아' },
        { name: '딜리', region: '동남아시아' },
        { name: '마닐라', region: '동남아시아' },
        { name: '마카사르', region: '동남아시아' },
        { name: '반다', region: '동남아시아' },
        { name: '반자르마신', region: '동남아시아' },
        { name: '브루네이', region: '동남아시아' },
        { name: '암본', region: '동남아시아' },
        { name: '쿠칭', region: '동남아시아' },
        { name: '타이난', region: '동남아시아' },
        { name: '테르나테', region: '동남아시아' },
        { name: '홀로', region: '동남아시아' },

        // 동아시아
        { name: '북경', region: '동아시아' },
        { name: '서안', region: '동아시아' },
        { name: '중경', region: '동아시아' },
        { name: '항주', region: '동아시아' },
        { name: '마카오', region: '동아시아' },
        { name: '천주', region: '동아시아' },
        { name: '연운', region: '동아시아' },

        // 극동서아시아
        { name: '한양', region: '극동서아시아' },
        { name: '동래', region: '극동서아시아' },
        { name: '덕원', region: '극동서아시아' },
        { name: '영일', region: '극동서아시아' },
        { name: '제주', region: '극동서아시아' },

        // 극동남아시아
        { name: '에도', region: '극동남아시아' },
        { name: '나가사키', region: '극동남아시아' },
        { name: '사카이', region: '극동남아시아' },
        { name: '수이', region: '극동남아시아' },
        { name: '에조', region: '극동남아시아' },

        // 태평양
        { name: '마히나', region: '태평양' },
        { name: '사마라이', region: '태평양' },
        { name: '수바', region: '태평양' },
        { name: '아투오나', region: '태평양' },
        { name: '어널래스카', region: '태평양' },
        { name: '율도', region: '태평양' },
        { name: '하갓냐', region: '태평양' },
        { name: '호놀룰루', region: '태평양' },

        // 호주
        { name: '가리', region: '호주' },
        { name: '왕거누이', region: '호주' },
        { name: '카카투와', region: '호주' },
        { name: '포트피리', region: '호주' },
        { name: '핀자라', region: '호주' },
        { name: '호바톤', region: '호주' },

        // 미분류였던 항구 — 해역 보정
        { name: '배로우', region: '북미' },
        { name: '아르한겔스크', region: '북극해' },
        { name: '오호츠크', region: '극동남아시아' },
        { name: '체르스키', region: '극동남아시아' },
        { name: '코르프', region: '극동남아시아' },
    ];

    window.ORIGIN_PORT_REGIONS = Array.from(
        new Set(window.ORIGIN_PORTS.map(p => p.region))
    ).sort((a, b) => a.localeCompare(b, 'ko'));

    window.getOriginPortsByRegion = function (region) {
        return window.ORIGIN_PORTS.filter(p => p.region === region);
    };
})();
