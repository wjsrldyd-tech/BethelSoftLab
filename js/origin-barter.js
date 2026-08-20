// =============== origin-barter.js ===============
// 대항해시대 오리진 물물교환 계산기

(function () {
    'use strict';

    const LS_CAPACITY = 'originBarterCapacity';
    const LS_VILLAGE = 'originBarterVillage';
    const LS_EXCHANGE = 'originBarterExchange';
    const LS_RATIOS = 'originBarterRatios';
    const LS_HAVE = 'originBarterHave';
    const LS_BATCHES = 'originBarterBatches';
    const LS_SHIPMENT = 'originBarterShipment';
    const LS_RECIPE_LEGACY = 'originBarterRecipe';
    const LS_VILLAGE_PINS = 'originBarterVillagePins';
    const VILLAGE_PIN_EMOJI = '🏕️';
    const MAX_BATCHES = 8;

    /**
     * 마을 → 교환목록
     * ingredients / result defaultRatio = 교환 1회분 재료·결과
     * 계획: 선택한 배수 N → 목표 = N × 1회 비율
     */
    const BARTER_VILLAGES = [
        {
            id: 'turk',
            name: '튀르크',
            mapId: 'eastmed',
            x: 74,
            y: 40,
            exchanges: [
                {
                    id: 'mastic',
                    name: '매스틱',
                    category: '기호품',
                    result: { name: '매스틱', defaultRatio: 680 },
                    ingredients: [
                        { name: '은 식기', defaultRatio: 194 },
                        { name: '커피', defaultRatio: 174 },
                        { name: '포도주', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'chaidanruk',
                    name: '차이단륵',
                    category: '미술품',
                    result: { name: '차이단륵', defaultRatio: 626 },
                    ingredients: [
                        { name: '사금', defaultRatio: 174 },
                        { name: '주석 광석', defaultRatio: 174 },
                        { name: '아주라이트', defaultRatio: 174 },
                    ],
                },
                {
                    id: 'damascus_steel',
                    name: '다마스쿠스 강철',
                    category: '공업품',
                    result: { name: '다마스쿠스 강철', defaultRatio: 626 },
                    ingredients: [
                        { name: '철광석', defaultRatio: 174 },
                        { name: '석탄', defaultRatio: 174 },
                        { name: '목재', defaultRatio: 174 },
                    ],
                },
            ],
        },
        {
            id: 'apache',
            name: '아파치',
            mapId: 'northamerica',
            x: 30,
            y: 70,
            exchanges: [
                {
                    id: 'camas',
                    name: '카마스',
                    category: '식료품',
                    result: { name: '카마스', defaultRatio: 756 },
                    ingredients: [
                        { name: '아보카도', defaultRatio: 134 },
                        { name: '카사바', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'pulque',
                    name: '풀케',
                    category: '주류',
                    result: { name: '풀케', defaultRatio: 816 },
                    ingredients: [
                        { name: '산호', defaultRatio: 154 },
                        { name: '은', defaultRatio: 134 },
                    ],
                },
                {
                    id: 'wampum',
                    name: '왐품',
                    category: '공예품',
                    result: { name: '왐품', defaultRatio: 504 },
                    ingredients: [
                        { name: '백금', defaultRatio: 134 },
                        { name: '월하향', defaultRatio: 134 },
                    ],
                },
            ],
        },
        {
            id: 'west_island',
            name: '신대륙, 서쪽의 섬',
            mapId: 'southamerica',
            x: 10,
            y: 28,
            exchanges: [
                {
                    id: 'west_island_bombilla',
                    name: '봄빌라',
                    category: '공예품',
                    result: { name: '봄빌라', defaultRatio: 652 },
                    ingredients: [
                        { name: '은', defaultRatio: 116 },
                        { name: '금', defaultRatio: 116 },
                        { name: '석탄', defaultRatio: 101 },
                    ],
                },
                {
                    id: 'west_island_pisco',
                    name: '피스코',
                    category: '주류',
                    result: { name: '피스코', defaultRatio: 652 },
                    ingredients: [
                        { name: '포도', defaultRatio: 134 },
                        { name: '도자기', defaultRatio: 154 },
                        { name: '설탕', defaultRatio: 154 },
                    ],
                },
            ],
        },
        {
            id: 'quechua',
            name: '케추아족',
            mapId: 'southamerica',
            x: 22,
            y: 28,
            exchanges: [
                {
                    id: 'quechua_bombilla',
                    name: '봄빌라',
                    category: '공예품',
                    result: { name: '봄빌라', defaultRatio: 680 },
                    ingredients: [
                        { name: '은', defaultRatio: 116 },
                        { name: '금', defaultRatio: 116 },
                        { name: '석탄', defaultRatio: 101 },
                    ],
                },
                {
                    id: 'quechua_pisco',
                    name: '피스코',
                    category: '주류',
                    result: { name: '피스코', defaultRatio: 680 },
                    ingredients: [
                        { name: '포도', defaultRatio: 174 },
                        { name: '도자기', defaultRatio: 154 },
                        { name: '설탕', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'quechua_vicuna_fabric',
                    name: '비쿠냐 직물',
                    category: '직물',
                    result: { name: '비쿠냐 직물', defaultRatio: 340 },
                    ingredients: [
                        { name: '비쿠냐털', defaultRatio: 24 },
                        { name: '차르카', defaultRatio: 116 },
                        { name: '포우나무', defaultRatio: 70 },
                    ],
                },
            ],
        },
        {
            id: 'svear',
            name: '스비아인',
            mapId: 'northsea',
            x: 74,
            y: 24,
            exchanges: [
                {
                    id: 'birch',
                    name: '자작나무',
                    category: '공업품',
                    result: { name: '자작나무', defaultRatio: 551 },
                    ingredients: [
                        { name: '철재', defaultRatio: 108 },
                        { name: '화승총', defaultRatio: 54 },
                        { name: '양초', defaultRatio: 94 },
                    ],
                },
                {
                    id: 'naverslojd',
                    name: '네베르스로이드',
                    category: '공예품',
                    result: { name: '네베르스로이드', defaultRatio: 1019 },
                    ingredients: [
                        { name: '자작나무', defaultRatio: 308 },
                        { name: '철재', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'juniper_berry',
                    name: '주니퍼 베리',
                    category: '향신료',
                    result: { name: '주니퍼 베리', defaultRatio: 787 },
                    ingredients: [
                        { name: '링곤베리', defaultRatio: 77 },
                        { name: '보드카', defaultRatio: 154 },
                    ],
                },
                {
                    id: 'meteorite',
                    name: '운철',
                    category: '공업품',
                    result: { name: '운철', defaultRatio: 945 },
                    ingredients: [
                        { name: '컴퍼스', defaultRatio: 134 },
                        { name: '초롱', defaultRatio: 134 },
                        { name: '올리브기름', defaultRatio: 134 },
                    ],
                },
            ],
        },
        {
            id: 'berber',
            name: '베르베르인',
            mapId: 'wafrica',
            x: 32,
            y: 12,
            exchanges: [
                {
                    id: 'argan_oil',
                    name: '아르간 기름',
                    category: '조미료',
                    result: { name: '아르간 기름', defaultRatio: 616 },
                    ingredients: [
                        { name: '몰약', defaultRatio: 66 },
                        { name: '양고기', defaultRatio: 132 },
                        { name: '아몬드', defaultRatio: 132 },
                    ],
                },
                {
                    id: 'unkakka',
                    name: '은카카',
                    category: '향신료',
                    result: { name: '은카카', defaultRatio: 616 },
                    ingredients: [
                        { name: '담배', defaultRatio: 132 },
                        { name: '땅콩', defaultRatio: 66 },
                        { name: '치클', defaultRatio: 132 },
                    ],
                },
            ],
        },
        {
            id: 'yoruba',
            name: '요루바족',
            mapId: 'wafrica',
            x: 56,
            y: 50,
            exchanges: [
                {
                    id: 'yoruba_argan_oil',
                    name: '아르간 기름',
                    category: '조미료',
                    result: { name: '아르간 기름', defaultRatio: 658 },
                    ingredients: [
                        { name: '몰약', defaultRatio: 76 },
                        { name: '양고기', defaultRatio: 172 },
                        { name: '아몬드', defaultRatio: 192 },
                    ],
                },
                {
                    id: 'yoruba_unkakka',
                    name: '은카카',
                    category: '향신료',
                    result: { name: '은카카', defaultRatio: 658 },
                    ingredients: [
                        { name: '담배', defaultRatio: 192 },
                        { name: '땅콩', defaultRatio: 96 },
                        { name: '치클', defaultRatio: 192 },
                    ],
                },
                {
                    id: 'yoruba_diamond',
                    name: '다이아몬드',
                    category: '보석',
                    result: { name: '다이아몬드', defaultRatio: 284 },
                    ingredients: [
                        { name: '비단', defaultRatio: 35 },
                        { name: '레이스', defaultRatio: 35 },
                        { name: '동판', defaultRatio: 69 },
                    ],
                },
            ],
        },
        {
            id: 'malay',
            name: '말레이족',
            mapId: 'seasia',
            x: 36,
            y: 46,
            exchanges: [
                {
                    id: 'malay_nutmeg_box',
                    name: '육두구 상자',
                    category: '향신료',
                    result: { name: '육두구 상자', defaultRatio: 227 },
                    ingredients: [
                        { name: '흑단', defaultRatio: 47 },
                        { name: '산호', defaultRatio: 70 },
                        { name: '다카 모슬린', defaultRatio: 54 },
                    ],
                },
                {
                    id: 'malay_gamboge',
                    name: '자황',
                    category: '염료',
                    result: { name: '자황', defaultRatio: 560 },
                    ingredients: [
                        { name: '비도', defaultRatio: 132 },
                        { name: '용연향', defaultRatio: 76 },
                        { name: '진주 공예품', defaultRatio: 76 },
                    ],
                },
                {
                    id: 'malay_carambola',
                    name: '카람볼라',
                    category: '기호품',
                    result: { name: '카람볼라', defaultRatio: 560 },
                    ingredients: [
                        { name: '토마토', defaultRatio: 152 },
                        { name: '옥수수기름', defaultRatio: 66 },
                        { name: '은', defaultRatio: 66 },
                    ],
                },
                {
                    id: 'malay_tenun',
                    name: '테눈',
                    category: '직물',
                    result: { name: '테눈', defaultRatio: 650 },
                    ingredients: [
                        { name: '마닐라삼', defaultRatio: 132 },
                        { name: '망고스틴', defaultRatio: 66 },
                        { name: '다목', defaultRatio: 66 },
                        { name: '자근', defaultRatio: 66 },
                    ],
                },
            ],
        },
        {
            id: 'melanesian',
            name: '멜라네시아인',
            mapId: 'australia',
            x: 72,
            y: 18,
            exchanges: [
                {
                    id: 'melanesian_nutmeg_box',
                    name: '육두구 상자',
                    category: '향신료',
                    result: { name: '육두구 상자', defaultRatio: 572 },
                    ingredients: [
                        { name: '흑단', defaultRatio: 106 },
                        { name: '산호', defaultRatio: 183 },
                        { name: '면직물', defaultRatio: 183 },
                    ],
                },
                {
                    id: 'melanesian_sago',
                    name: '사고',
                    category: '식료품',
                    result: { name: '사고', defaultRatio: 858 },
                    ingredients: [
                        { name: '양손검', defaultRatio: 76 },
                        { name: '활', defaultRatio: 76 },
                    ],
                },
                {
                    id: 'melanesian_cassowary',
                    name: '화식조',
                    category: '가축',
                    result: { name: '화식조', defaultRatio: 572 },
                    ingredients: [
                        { name: '유리구슬', defaultRatio: 76 },
                        { name: '양초', defaultRatio: 66 },
                    ],
                },
                {
                    id: 'melanesian_pink_diamond',
                    name: '핑크 다이아몬드',
                    category: '보석',
                    result: { name: '핑크 다이아몬드', defaultRatio: 143 },
                    ingredients: [
                        { name: '금 식기', defaultRatio: 31 },
                        { name: '수은', defaultRatio: 27 },
                        { name: '진주', defaultRatio: 31 },
                    ],
                },
            ],
        },
        {
            id: 'witoto',
            name: '위토토족',
            mapId: 'southamerica',
            x: 42,
            y: 22,
            exchanges: [
                {
                    id: 'witoto_azul_maya',
                    name: '아줄 마야',
                    category: '염료',
                    result: { name: '아줄 마야', defaultRatio: 975 },
                    ingredients: [
                        { name: '인디고', defaultRatio: 152 },
                        { name: '옥수수', defaultRatio: 152 },
                        { name: '럼', defaultRatio: 76 },
                    ],
                },
                {
                    id: 'witoto_mahogany',
                    name: '마호가니',
                    category: '공업품',
                    result: { name: '마호가니', defaultRatio: 1154 },
                    ingredients: [
                        { name: '통나무', defaultRatio: 146 },
                        { name: '흑요석 곤봉', defaultRatio: 146 },
                        { name: '테킬라', defaultRatio: 84 },
                    ],
                },
                {
                    id: 'witoto_guarana',
                    name: '과라나',
                    category: '기호품',
                    result: { name: '과라나', defaultRatio: 875 },
                    ingredients: [
                        { name: '노니', defaultRatio: 152 },
                        { name: '안식향', defaultRatio: 152 },
                        { name: '망고스틴', defaultRatio: 76 },
                    ],
                },
                {
                    id: 'witoto_suma',
                    name: '수마',
                    category: '의약품',
                    result: { name: '수마', defaultRatio: 812 },
                    ingredients: [
                        { name: '인삼', defaultRatio: 76 },
                        { name: '차', defaultRatio: 198 },
                        { name: '순백자', defaultRatio: 76 },
                    ],
                },
            ],
        },
        {
            id: 'comanche',
            name: '코만치족',
            mapId: 'caribbean',
            x: 32,
            y: 32,
            exchanges: [
                {
                    id: 'comanche_nutria',
                    name: '후티아',
                    category: '가축',
                    result: { name: '후티아', defaultRatio: 839 },
                    ingredients: [
                        { name: '양마', defaultRatio: 130 },
                        { name: '석재', defaultRatio: 130 },
                        { name: '통나무', defaultRatio: 130 },
                    ],
                },
                {
                    id: 'comanche_sofrito',
                    name: '소프리토',
                    category: '조미료',
                    result: { name: '소프리토', defaultRatio: 840 },
                    ingredients: [
                        { name: '양파', defaultRatio: 98 },
                        { name: '당근', defaultRatio: 98 },
                        { name: '마늘', defaultRatio: 98 },
                        { name: '올리브기름', defaultRatio: 98 },
                    ],
                },
                {
                    id: 'comanche_xocolatl',
                    name: '쇼콜라틀',
                    category: '기호품',
                    result: { name: '쇼콜라틀', defaultRatio: 700 },
                    ingredients: [
                        { name: '카카오', defaultRatio: 65 },
                        { name: '계피', defaultRatio: 65 },
                        { name: '칠면조', defaultRatio: 65 },
                        { name: '설탕봉', defaultRatio: 65 },
                    ],
                },
            ],
        },
        {
            id: 'buan',
            name: '부안',
            mapId: 'eastasia',
            x: 64,
            y: 36,
            exchanges: [
                {
                    id: 'buan_gochujang',
                    name: '고추장',
                    category: '조미료',
                    result: { name: '고추장', defaultRatio: 858 },
                    ingredients: [
                        { name: '고추', defaultRatio: 225 },
                        { name: '된장', defaultRatio: 150 },
                        { name: '대나무', defaultRatio: 85 },
                    ],
                },
                {
                    id: 'buan_norigae',
                    name: '노리개',
                    category: '공예품',
                    result: { name: '노리개', defaultRatio: 858 },
                    ingredients: [
                        { name: '비취', defaultRatio: 113 },
                        { name: '생사', defaultRatio: 225 },
                        { name: '진주', defaultRatio: 113 },
                    ],
                },
                {
                    id: 'buan_iganggo',
                    name: '이강고',
                    category: '주류',
                    result: { name: '이강고', defaultRatio: 572 },
                    ingredients: [
                        { name: '생강', defaultRatio: 150 },
                        { name: '구리 광석', defaultRatio: 225 },
                    ],
                },
                {
                    id: 'buan_red_ginseng',
                    name: '홍삼',
                    category: '의약품',
                    result: { name: '홍삼', defaultRatio: 572 },
                    ingredients: [
                        { name: '인삼', defaultRatio: 188 },
                        { name: '은', defaultRatio: 65 },
                    ],
                },
            ],
        },
        {
            id: 'kyushu',
            name: '규슈의 마을',
            mapId: 'eastasia',
            x: 80,
            y: 52,
            exchanges: [
                {
                    id: 'kyushu_cormorant',
                    name: '가마우지',
                    category: '가축',
                    result: { name: '가마우지', defaultRatio: 544 },
                    ingredients: [
                        { name: '어육', defaultRatio: 249 },
                        { name: '금', defaultRatio: 110 },
                    ],
                },
                {
                    id: 'kyushu_red_copper',
                    name: '적동',
                    category: '공업품',
                    result: { name: '적동', defaultRatio: 484 },
                    ingredients: [
                        { name: '구리 광석', defaultRatio: 292 },
                        { name: '금', defaultRatio: 59 },
                    ],
                },
            ],
        },
        {
            id: 'ami',
            name: '아미족의 마을',
            mapId: 'eastasia',
            x: 68,
            y: 68,
            exchanges: [
                {
                    id: 'ami_dangwa',
                    name: '당과',
                    category: '기호품',
                    result: { name: '당과', defaultRatio: 530 },
                    ingredients: [
                        { name: '망고', defaultRatio: 110 },
                        { name: '오렌지', defaultRatio: 125 },
                        { name: '바나나', defaultRatio: 110 },
                        { name: '설탕봉', defaultRatio: 95 },
                    ],
                },
                {
                    id: 'ami_deer',
                    name: '네눈사슴',
                    category: '가축',
                    result: { name: '네눈사슴', defaultRatio: 634 },
                    ingredients: [
                        { name: '돼지', defaultRatio: 63 },
                        { name: '거위', defaultRatio: 126 },
                        { name: '닭', defaultRatio: 126 },
                    ],
                },
            ],
        },
        {
            id: 'tujia',
            name: '장강, 투자족의 마을',
            mapId: 'eastasia',
            x: 32,
            y: 46,
            exchanges: [
                {
                    id: 'tujia_cornus',
                    name: '산수유',
                    category: '의약품',
                    result: { name: '산수유', defaultRatio: 818 },
                    ingredients: [
                        { name: '수레', defaultRatio: 332 },
                        { name: '삼', defaultRatio: 332 },
                    ],
                },
                {
                    id: 'tujia_osmanthus',
                    name: '은목서',
                    category: '향료',
                    result: { name: '은목서', defaultRatio: 707 },
                    ingredients: [
                        { name: '꿀', defaultRatio: 117 },
                        { name: '정향', defaultRatio: 59 },
                        { name: '팔각', defaultRatio: 59 },
                        { name: '후추', defaultRatio: 59 },
                    ],
                },
            ],
        },
        {
            id: 'han',
            name: '황허, 한족의 마을',
            mapId: 'eastasia',
            x: 36,
            y: 26,
            exchanges: [
                {
                    id: 'han_cornus',
                    name: '산수유',
                    category: '의약품',
                    result: { name: '산수유', defaultRatio: 634 },
                    ingredients: [
                        { name: '수레', defaultRatio: 292 },
                        { name: '삼', defaultRatio: 252 },
                    ],
                },
                {
                    id: 'han_osmanthus',
                    name: '은목서',
                    category: '향료',
                    result: { name: '은목서', defaultRatio: 507 },
                    ingredients: [
                        { name: '꿀', defaultRatio: 101 },
                        { name: '정향', defaultRatio: 51 },
                        { name: '팔각', defaultRatio: 51 },
                        { name: '후추', defaultRatio: 51 },
                    ],
                },
                {
                    id: 'han_history_book',
                    name: '역사서',
                    category: '잡화',
                    result: { name: '역사서', defaultRatio: 471 },
                    ingredients: [
                        { name: '한지', defaultRatio: 146 },
                        { name: '솔먹', defaultRatio: 110 },
                        { name: '호필', defaultRatio: 73 },
                    ],
                },
            ],
        },
        {
            id: 'yawuru',
            name: '야우루족의 마을',
            mapId: 'australia',
            x: 30,
            y: 52,
            exchanges: [
                {
                    id: 'yawuru_kakadu_plum',
                    name: '카카두플럼',
                    category: '기호품',
                    result: { name: '카카두플럼', defaultRatio: 687 },
                    ingredients: [
                        { name: '게', defaultRatio: 83 },
                        { name: '칠면조', defaultRatio: 83 },
                        { name: '크랜베리', defaultRatio: 73 },
                    ],
                },
                {
                    id: 'yawuru_bark_painting',
                    name: '목피화',
                    category: '미술품',
                    result: { name: '목피화', defaultRatio: 508 },
                    ingredients: [
                        { name: '목재', defaultRatio: 83 },
                        { name: '크리스', defaultRatio: 83 },
                        { name: '금', defaultRatio: 73 },
                    ],
                },
                {
                    id: 'yawuru_emu',
                    name: '에뮤',
                    category: '가축',
                    result: { name: '에뮤', defaultRatio: 571 },
                    ingredients: [
                        { name: '곡도', defaultRatio: 125 },
                        { name: '말', defaultRatio: 125 },
                        { name: '화승총', defaultRatio: 125 },
                    ],
                },
            ],
        },
        {
            id: 'nauo',
            name: '나우오족의 마을',
            mapId: 'australia',
            x: 42,
            y: 63,
            exchanges: [
                {
                    id: 'nauo_kakadu_plum',
                    name: '카카두플럼',
                    category: '기호품',
                    result: { name: '카카두플럼', defaultRatio: 881 },
                    ingredients: [
                        { name: '게', defaultRatio: 73 },
                        { name: '칠면조', defaultRatio: 63 },
                        { name: '크랜베리', defaultRatio: 63 },
                    ],
                },
                {
                    id: 'nauo_bark_painting',
                    name: '목피화',
                    category: '미술품',
                    result: { name: '목피화', defaultRatio: 705 },
                    ingredients: [
                        { name: '목재', defaultRatio: 63 },
                        { name: '크리스', defaultRatio: 63 },
                        { name: '금', defaultRatio: 63 },
                    ],
                },
                {
                    id: 'nauo_emu',
                    name: '에뮤',
                    category: '가축',
                    result: { name: '에뮤', defaultRatio: 793 },
                    ingredients: [
                        { name: '곡도', defaultRatio: 95 },
                        { name: '말', defaultRatio: 95 },
                        { name: '화승총', defaultRatio: 110 },
                    ],
                },
            ],
        },
        {
            id: 'gyeongheung',
            name: '경흥의 마을',
            mapId: 'eastasia',
            x: 74,
            y: 18,
            exchanges: [
                {
                    id: 'gyeongheung_gochujang',
                    name: '고추장',
                    category: '조미료',
                    result: { name: '고추장', defaultRatio: 666 },
                    ingredients: [
                        { name: '고추', defaultRatio: 279 },
                        { name: '된장', defaultRatio: 186 },
                        { name: '대나무', defaultRatio: 93 },
                    ],
                },
                {
                    id: 'gyeongheung_norigae',
                    name: '노리개',
                    category: '공예품',
                    result: { name: '노리개', defaultRatio: 666 },
                    ingredients: [
                        { name: '비취', defaultRatio: 140 },
                        { name: '생사', defaultRatio: 279 },
                        { name: '진주', defaultRatio: 140 },
                    ],
                },
                {
                    id: 'gyeongheung_red_ginseng',
                    name: '홍삼',
                    category: '의약품',
                    result: { name: '홍삼', defaultRatio: 484 },
                    ingredients: [
                        { name: '인삼', defaultRatio: 208 },
                        { name: '은', defaultRatio: 83 },
                    ],
                },
            ],
        },
        {
            id: 'qashqai',
            name: '카슈카이족의 마을',
            mapId: 'southindian',
            x: 48,
            y: 36,
            exchanges: [
                {
                    id: 'qashqai_silver_myrtle',
                    name: '은매화',
                    category: '향료',
                    result: { name: '은매화', defaultRatio: 762 },
                    ingredients: [
                        { name: '유칼립투스', defaultRatio: 166 },
                        { name: '마누카', defaultRatio: 412 },
                    ],
                },
                {
                    id: 'qashqai_weld',
                    name: '웰드',
                    category: '염료',
                    result: { name: '웰드', defaultRatio: 636 },
                    ingredients: [
                        { name: '면직물', defaultRatio: 206 },
                        { name: '인디고', defaultRatio: 206 },
                        { name: '강황', defaultRatio: 206 },
                    ],
                },
            ],
        },
    ];

    let selectedVillageId = null;
    let selectedExchangeId = null;
    /** 맵 재료 항구용 결과물(교환) 복수 선택 — 계획표와 독립 */
    /** @type {string[]} */
    let mapFilterExchangeIds = [];
    /** 선적 합산 포함 — 현재 마을 교환 ID 목록 */
    /** @type {string[]} */
    let shipmentExchangeIds = [];
    /** 교환 횟수 배수 (1~8) — 목표 = 비율 × N */
    let selectedBatches = 1;
    /** 재료 비율만 (결과물 비율 제외) */
    let currentRatios = {};
    /** 결과물 비율 */
    let currentResultRatio = 0;
    /** @type {Record<string, number>} */
    let currentHave = {};
    /** @type {{ name: string, amount: number }[]} */
    let lastGoals = [];
    let selectedMonth = 1;
    let inited = false;

    function els() {
        return {
            villageSelect: document.getElementById('barter-village'),
            exchangeLabel: document.getElementById('barter-exchange-label'),
            exchangeBtns: document.getElementById('barter-exchange-btns'),
            matrixDiv: document.getElementById('barter-matrix'),
            multBtns: document.getElementById('barter-mult-btns'),
            progressClearBtn: document.getElementById('barter-progress-clear'),
            filterBtn: document.getElementById('barter-filter-map'),
            resultBtns: document.getElementById('barter-result-btns'),
            settingsCapacity: document.getElementById('ot-settings-capacity'),
            villagePinsBtn: document.getElementById('barter-village-pins'),
        };
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isVillagePinsVisible() {
        return localStorage.getItem(LS_VILLAGE_PINS) === '1';
    }

    function setVillagePinsVisible(on) {
        localStorage.setItem(LS_VILLAGE_PINS, on ? '1' : '0');
        syncVillagePinsBtn();
        try {
            window.dispatchEvent(new CustomEvent('origin-barter-village-pins-changed', {
                detail: { visible: !!on },
            }));
        } catch (_) { /* ignore */ }
    }

    function syncVillagePinsBtn() {
        const { villagePinsBtn } = els();
        if (!villagePinsBtn) return;
        const on = isVillagePinsVisible();
        villagePinsBtn.classList.toggle('is-active', on);
        villagePinsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        villagePinsBtn.textContent = on ? '맵 마을 표시 해제' : '맵에 마을 표시';
    }

    function villagesOnMap(mapId) {
        if (!mapId) return [];
        return BARTER_VILLAGES.filter((v) => v.mapId === mapId && Number.isFinite(v.x) && Number.isFinite(v.y));
    }

    function selectVillageById(villageId) {
        const village = getVillage(villageId);
        if (!village) return false;
        const { villageSelect } = els();
        setSideTool('barter');
        selectedVillageId = villageId;
        if (villageSelect) villageSelect.value = village.id;
        onVillageChange();

        // 맵 핀으로 들어온 경우: 해당 마을 전체 교환 재료 항구만 표시
        const ids = allVillageExchangeIds();
        if (ids.length) {
            mapFilterExchangeIds = ids.slice();
            const names = ingredientNamesForMapFilter();
            applyMapIngredientFilter(names);
            syncIngredientFilterBtn();
            renderResultButtons();
        }

        try {
            window.dispatchEvent(new CustomEvent('origin-barter-village-pins-changed', {
                detail: { visible: isVillagePinsVisible() },
            }));
        } catch (_) { /* ignore */ }
        return true;
    }

    function getVillage(villageId) {
        return BARTER_VILLAGES.find(v => v.id === villageId) || null;
    }

    function getExchange(villageId, exchangeId) {
        const village = getVillage(villageId);
        if (!village || !village.exchanges) return null;
        return village.exchanges.find(e => e.id === exchangeId) || null;
    }

    function findExchangeAnywhere(exchangeId) {
        if (!exchangeId) return null;
        for (const village of BARTER_VILLAGES) {
            const ex = (village.exchanges || []).find(e => e.id === exchangeId);
            if (ex) return { village, exchange: ex };
        }
        return null;
    }

    function currentVillage() {
        return getVillage(selectedVillageId);
    }

    function currentExchange() {
        return getExchange(selectedVillageId, selectedExchangeId);
    }

    function categoryBadgeHtml(category) {
        const badge = category && typeof window.getOriginCategoryBadge === 'function'
            ? window.getOriginCategoryBadge(category)
            : null;
        if (!badge) return '';
        return `<span class="ot-cat-badge" title="${escapeHtml(badge.label)}" aria-label="${escapeHtml(badge.label)}">${escapeHtml(badge.letter)}</span>`;
    }

    /** 저장키: 마을ID:교환ID (구버전 교환ID만 있던 키도 읽기) */
    function ratioKey() {
        if (!selectedVillageId || !selectedExchangeId) return null;
        return selectedVillageId + ':' + selectedExchangeId;
    }

    function pickStoreEntry(store, villageId, exchangeId) {
        if (!store || !exchangeId) return null;
        if (villageId) {
            const compound = villageId + ':' + exchangeId;
            if (store[compound] && typeof store[compound] === 'object') return store[compound];
        }
        if (store[exchangeId] && typeof store[exchangeId] === 'object') return store[exchangeId];
        const legacyColon = Object.keys(store).find(k => k.endsWith(':' + exchangeId));
        if (legacyColon && store[legacyColon] && typeof store[legacyColon] === 'object') {
            return store[legacyColon];
        }
        return null;
    }

    function readRatioStore() {
        try {
            const raw = localStorage.getItem(LS_RATIOS);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeRatioStore(store) {
        localStorage.setItem(LS_RATIOS, JSON.stringify(store || {}));
    }

    function saveCapacityValue(n) {
        const v = parseInt(n, 10);
        if (!(Number.isFinite(v) && v > 0)) return null;
        localStorage.setItem(LS_CAPACITY, String(v));
        return v;
    }

    function getCapacity() {
        try {
            const raw = localStorage.getItem('origin_settings_v1');
            if (raw) {
                const s = JSON.parse(raw);
                const fromSettings = parseInt(s && s.barterCapacity, 10);
                if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
            }
        } catch { /* ignore */ }
        const n = parseInt(localStorage.getItem(LS_CAPACITY) || '', 10);
        return (Number.isFinite(n) && n > 0) ? n : 5000;
    }

    function fillSettingsCapacity() {
        const { settingsCapacity } = els();
        if (!settingsCapacity) return;
        settingsCapacity.value = String(getCapacity());
    }

    function persistBarterSettings(partial) {
        if (window.originDb && typeof window.originDb.saveSettings === 'function') {
            return window.originDb.saveSettings(partial || {});
        }
        return Promise.resolve(null);
    }

    function readHaveStore() {
        try {
            const raw = localStorage.getItem(LS_HAVE);
            const store = raw ? JSON.parse(raw) : {};
            return (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
        } catch {
            return {};
        }
    }

    function writeHaveStore(store) {
        const next = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
        localStorage.setItem(LS_HAVE, JSON.stringify(next));
        return next;
    }

    function saveSettingsCapacity() {
        const { settingsCapacity } = els();
        if (!settingsCapacity) return getCapacity();
        const saved = saveCapacityValue(settingsCapacity.value);
        if (saved == null) {
            settingsCapacity.value = String(getCapacity());
            return getCapacity();
        }
        persistBarterSettings({ barterCapacity: saved });
        refreshMatrix();
        return saved;
    }

    function applySettingsFromDb(settings) {
        const src = settings || {};
        if (src.barterCapacity != null) {
            saveCapacityValue(src.barterCapacity);
        }
        if (src.barterHave != null && typeof src.barterHave === 'object') {
            writeHaveStore(src.barterHave);
        }
        fillSettingsCapacity();
        if (selectedExchangeId) {
            currentHave = loadSavedHave();
            refreshMatrix();
        }
    }

    function clampBatches(n) {
        const v = parseInt(n, 10);
        if (!Number.isFinite(v) || v < 1) return 1;
        if (v > MAX_BATCHES) return MAX_BATCHES;
        return v;
    }

    function readBatchStore() {
        try {
            const raw = localStorage.getItem(LS_BATCHES);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch { /* 구버전 단일 숫자 문자열 */ }
        const legacy = parseInt(localStorage.getItem(LS_BATCHES) || '', 10);
        if (Number.isFinite(legacy) && legacy > 0) {
            return { __legacyDefault: clampBatches(legacy) };
        }
        return {};
    }

    function writeBatchStore(store) {
        localStorage.setItem(LS_BATCHES, JSON.stringify(store || {}));
    }

    function pickBatchEntry(store, villageId, exchangeId) {
        if (!store || !exchangeId) return null;
        if (villageId) {
            const compound = villageId + ':' + exchangeId;
            if (store[compound] != null) return clampBatches(store[compound]);
        }
        if (store[exchangeId] != null) return clampBatches(store[exchangeId]);
        const legacyColon = Object.keys(store).find(k => k.endsWith(':' + exchangeId));
        if (legacyColon && store[legacyColon] != null) return clampBatches(store[legacyColon]);
        return null;
    }

    function loadSavedBatches() {
        const store = readBatchStore();
        const saved = pickBatchEntry(store, selectedVillageId, selectedExchangeId);
        if (saved != null) return saved;
        if (store.__legacyDefault != null) return clampBatches(store.__legacyDefault);
        return 1;
    }

    function saveCurrentBatches() {
        const key = ratioKey();
        if (!key) return;
        const store = readBatchStore();
        delete store.__legacyDefault;
        store[key] = selectedBatches;
        writeBatchStore(store);
    }

    function loadBatchesIntoState() {
        selectedBatches = loadSavedBatches();
        syncMultButtons();
    }

    function syncMultButtons() {
        const { multBtns } = els();
        if (!multBtns) return;
        multBtns.querySelectorAll('[data-mult]').forEach(btn => {
            const n = clampBatches(btn.dataset.mult);
            const on = n === selectedBatches;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function setBatches(n) {
        selectedBatches = clampBatches(n);
        saveCurrentBatches();
        syncMultButtons();
        refreshMatrix();
    }

    function deleteVillageStoreEntries(store, villageId) {
        if (!store || !villageId) return store;
        const village = getVillage(villageId);
        const exchanges = (village && village.exchanges) || [];
        if (!exchanges.length) return store;
        const exchangeIds = new Set(exchanges.map((ex) => ex.id));
        for (const ex of exchanges) {
            delete store[villageId + ':' + ex.id];
            delete store[ex.id];
        }
        for (const key of Object.keys(store)) {
            const colon = key.lastIndexOf(':');
            if (colon < 0) continue;
            const exId = key.slice(colon + 1);
            if (exchangeIds.has(exId) && key.startsWith(villageId + ':')) {
                delete store[key];
            }
        }
        return store;
    }

    function clearCurrentVillageProgress() {
        const villageId = selectedVillageId;
        if (!villageId) return;

        let haveStore = readHaveStore();
        deleteVillageStoreEntries(haveStore, villageId);
        writeHaveStore(haveStore);
        currentHave = {};
        persistBarterSettings({ barterHave: haveStore });

        const batchStore = readBatchStore();
        delete batchStore.__legacyDefault;
        deleteVillageStoreEntries(batchStore, villageId);
        writeBatchStore(batchStore);

        selectedBatches = 1;
        syncMultButtons();

        shipmentExchangeIds = [];
        saveShipmentForVillage();
        renderExchangePlanButtons(villageId);

        refreshMatrix();
    }

    function saveSelection() {
        if (selectedVillageId) localStorage.setItem(LS_VILLAGE, selectedVillageId);
        if (selectedExchangeId) localStorage.setItem(LS_EXCHANGE, selectedExchangeId);
    }

    function saveCurrentRatios() {
        const key = ratioKey();
        if (!key) return;
        const exchange = currentExchange();
        const store = readRatioStore();
        const payload = { ...currentRatios };
        if (exchange && exchange.result) {
            payload[exchange.result.name] = currentResultRatio;
        }
        store[key] = payload;
        writeRatioStore(store);
    }

    function loadSavedRatios() {
        return pickStoreEntry(readRatioStore(), selectedVillageId, selectedExchangeId) || {};
    }

    function loadSavedHave() {
        const entry = pickStoreEntry(readHaveStore(), selectedVillageId, selectedExchangeId);
        if (entry) return { ...entry };
        return {};
    }

    function saveCurrentHave() {
        const key = ratioKey();
        if (!key) return;
        const store = readHaveStore();
        store[key] = { ...currentHave };
        writeHaveStore(store);
        persistBarterSettings({ barterHave: store });
    }

    function loadHaveForExchange(villageId, exchangeId) {
        const entry = pickStoreEntry(readHaveStore(), villageId, exchangeId);
        if (entry) return { ...entry };
        return {};
    }

    function readShipmentStore() {
        try {
            const raw = localStorage.getItem(LS_SHIPMENT);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeShipmentStore(store) {
        localStorage.setItem(LS_SHIPMENT, JSON.stringify(store || {}));
    }

    function loadShipmentForVillage(villageId) {
        if (!villageId) {
            shipmentExchangeIds = [];
            return;
        }
        const store = readShipmentStore();
        const ids = store[villageId];
        const village = getVillage(villageId);
        const valid = new Set(((village && village.exchanges) || []).map((ex) => ex.id));
        shipmentExchangeIds = Array.isArray(ids)
            ? ids.filter((id) => valid.has(id))
            : [];
    }

    function saveShipmentForVillage() {
        if (!selectedVillageId) return;
        const store = readShipmentStore();
        store[selectedVillageId] = shipmentExchangeIds.slice();
        writeShipmentStore(store);
    }

    function setShipmentIncluded(exchangeId, included) {
        if (!exchangeId || !getExchange(selectedVillageId, exchangeId)) return;
        const idx = shipmentExchangeIds.indexOf(exchangeId);
        if (included) {
            if (idx < 0) shipmentExchangeIds.push(exchangeId);
        } else if (idx >= 0) {
            shipmentExchangeIds.splice(idx, 1);
        }
        saveShipmentForVillage();
        syncShipmentSummary();
    }

    function buildRatiosForExchange(exchange, saved) {
        const ratios = {};
        let resultRatio = 0;
        if (!exchange || !exchange.ingredients) return { ratios, resultRatio };
        exchange.ingredients.forEach((ing) => {
            const ratio = (Number.isFinite(Number(saved[ing.name])) && Number(saved[ing.name]) > 0)
                ? parseInt(saved[ing.name], 10)
                : ing.defaultRatio;
            ratios[ing.name] = ratio;
        });
        if (exchange.result) {
            const rName = exchange.result.name;
            const savedR = Number(saved[rName]);
            resultRatio = (Number.isFinite(savedR) && savedR > 0)
                ? parseInt(saved[rName], 10)
                : exchange.result.defaultRatio;
        }
        return { ratios, resultRatio };
    }

    /** 교환별 결과 적재(재료 입력 기준) */
    function computeResultHaveForExchange(villageId, exchangeId) {
        const exchange = getExchange(villageId, exchangeId);
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length || !exchange.result) {
            return 0;
        }
        const saved = pickStoreEntry(readRatioStore(), villageId, exchangeId) || {};
        const { ratios, resultRatio } = buildRatiosForExchange(exchange, saved);
        if (resultRatio <= 0) return 0;
        const haveData = loadHaveForExchange(villageId, exchangeId);

        let haveBatches = null;
        for (const ing of exchange.ingredients) {
            const ratio = ratios[ing.name] || 0;
            if (ratio <= 0) continue;
            const have = Number(haveData[ing.name]) || 0;
            const b = have / ratio;
            if (haveBatches == null || b < haveBatches) haveBatches = b;
        }
        if (haveBatches == null) haveBatches = 0;
        return Math.round(haveBatches * resultRatio);
    }

    /** 선적 포함 교환 결과 적재 합 − 함대 적재량 */
    function computeShipmentOverflow() {
        if (!selectedVillageId || !shipmentExchangeIds.length) return null;
        let sum = 0;
        shipmentExchangeIds.forEach((id) => {
            if (getExchange(selectedVillageId, id)) {
                sum += computeResultHaveForExchange(selectedVillageId, id);
            }
        });
        const capacity = getCapacity();
        if (capacity <= 0) return null;
        return sum - capacity;
    }

    function syncShipmentSummary() {
        const { exchangeLabel } = els();
        if (!exchangeLabel) return;
        const base = '교환목록';
        if (!shipmentExchangeIds.length) {
            exchangeLabel.textContent = base;
            return;
        }
        const overflow = computeShipmentOverflow();
        if (overflow == null) {
            exchangeLabel.textContent = base;
            return;
        }
        let suffix;
        if (overflow === 0) suffix = '(0)';
        else if (overflow > 0) suffix = `(+${overflow.toLocaleString()})`;
        else suffix = `(${overflow.toLocaleString()})`;
        exchangeLabel.textContent = `${base} ${suffix}`;
    }

    function fillVillageOptions() {
        const { villageSelect } = els();
        if (!villageSelect) return;
        villageSelect.innerHTML = '<option value="">선택하세요</option>';
        BARTER_VILLAGES.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            villageSelect.appendChild(opt);
        });
    }

    function fillExchangeOptions(villageId) {
        renderExchangePlanButtons(villageId);
    }

    function renderExchangePlanButtons(villageId) {
        const { exchangeBtns } = els();
        if (!exchangeBtns) return;
        const village = getVillage(villageId);
        const exchanges = (village && village.exchanges) || [];
        if (!exchanges.length) {
            exchangeBtns.innerHTML = '';
            syncShipmentSummary();
            return;
        }
        const shipmentSet = Object.create(null);
        shipmentExchangeIds.forEach((id) => { shipmentSet[id] = true; });
        exchangeBtns.innerHTML = exchanges.map((ex) => {
            const label = (ex.result && ex.result.name) || ex.name;
            const on = ex.id === selectedExchangeId;
            const ship = !!shipmentSet[ex.id];
            return `<div class="ot-barter-exchange-item">
              <input type="checkbox" class="ot-barter-shipment-cb" data-exchange-id="${escapeHtml(ex.id)}"
                ${ship ? 'checked' : ''} aria-label="${escapeHtml(label)} 선적 포함">
              <button type="button" class="ot-barter-exchange-btn${on ? ' is-active' : ''}" data-exchange-id="${escapeHtml(ex.id)}"
                role="radio" aria-checked="${on ? 'true' : 'false'}">${escapeHtml(label)}</button>
            </div>`;
        }).join('');
        syncShipmentSummary();
    }

    function onExchangePlanBtnClick(e) {
        if (e.target.closest('.ot-barter-shipment-cb')) return;
        const btn = e.target.closest('.ot-barter-exchange-btn[data-exchange-id]');
        const { exchangeBtns } = els();
        if (!btn || !exchangeBtns || !exchangeBtns.contains(btn)) return;
        const exchangeId = btn.dataset.exchangeId;
        if (!exchangeId || !getExchange(selectedVillageId, exchangeId)) return;
        if (selectedExchangeId === exchangeId) return;
        selectedExchangeId = exchangeId;
        onExchangeChange();
    }

    function onShipmentCheckboxChange(e) {
        const cb = e.target.closest('.ot-barter-shipment-cb');
        const { exchangeBtns } = els();
        if (!cb || !exchangeBtns || !exchangeBtns.contains(cb)) return;
        const exchangeId = cb.dataset.exchangeId;
        if (!exchangeId || !getExchange(selectedVillageId, exchangeId)) return;
        setShipmentIncluded(exchangeId, cb.checked);
    }

    function init() {
        const { villageSelect, exchangeBtns, filterBtn, matrixDiv, progressClearBtn, multBtns } = els();
        if (!villageSelect || !exchangeBtns || inited) return;
        inited = true;

        const savedMonth = parseInt(localStorage.getItem('originBarterMonth') || '', 10);
        selectedMonth = (savedMonth >= 1 && savedMonth <= 12) ? savedMonth : 1;
        localStorage.setItem('originBarterMonth', String(selectedMonth));
        if (typeof window.advanceOriginBarterMonthIfNeeded === 'function') {
            const advanced = window.advanceOriginBarterMonthIfNeeded();
            if (advanced != null) selectedMonth = advanced;
            else selectedMonth = parseInt(localStorage.getItem('originBarterMonth') || String(selectedMonth), 10) || selectedMonth;
        }

        fillVillageOptions();
        fillSettingsCapacity();

        window.originBarterOnMonthChange = function (month) {
            selectedMonth = parseInt(month, 10);
            if (!(selectedMonth >= 1 && selectedMonth <= 12)) selectedMonth = 1;
            refreshMatrix();
        };
        window.originBarterFillSettings = fillSettingsCapacity;
        window.originBarterSaveSettings = saveSettingsCapacity;
        window.originBarterApplySettings = applySettingsFromDb;

        const { settingsCapacity } = els();
        if (settingsCapacity) {
            settingsCapacity.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                saveSettingsCapacity();
            });
            settingsCapacity.addEventListener('blur', () => {
                saveSettingsCapacity();
            });
        }

        const { villagePinsBtn } = els();
        syncVillagePinsBtn();
        if (villagePinsBtn) {
            villagePinsBtn.addEventListener('click', () => {
                setVillagePinsVisible(!isVillagePinsVisible());
            });
        }

        villageSelect.addEventListener('change', onVillageChange);
        exchangeBtns.addEventListener('click', onExchangePlanBtnClick);
        exchangeBtns.addEventListener('change', onShipmentCheckboxChange);
        if (multBtns) {
            multBtns.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-mult]');
                if (!btn || !multBtns.contains(btn)) return;
                setBatches(btn.dataset.mult);
            });
        }
        if (filterBtn) {
            filterBtn.addEventListener('click', filterMapByIngredients);
        }
        const { resultBtns } = els();
        if (resultBtns) {
            resultBtns.addEventListener('click', onResultBtnClick);
        }
        window.addEventListener('origin-goods-filter-changed', () => {
            syncIngredientFilterBtn();
            syncResultButtons();
        });
        if (matrixDiv) {
            matrixDiv.addEventListener('input', onMatrixInput);
        }
        if (progressClearBtn) {
            progressClearBtn.addEventListener('click', () => {
                clearCurrentVillageProgress();
            });
        }

        initSideToolTabs();

        let savedVillage = localStorage.getItem(LS_VILLAGE);
        let savedExchange = localStorage.getItem(LS_EXCHANGE);
        const legacyRecipe = localStorage.getItem(LS_RECIPE_LEGACY);

        if (!savedExchange && legacyRecipe) {
            const found = findExchangeAnywhere(legacyRecipe);
            if (found) {
                savedExchange = legacyRecipe;
                if (!savedVillage) savedVillage = found.village.id;
            }
        }

        // 교환만 저장된 구버전: 해당 교환이 있는 마을로 복원
        if (savedExchange && !getVillage(savedVillage)) {
            const found = findExchangeAnywhere(savedExchange);
            if (found) savedVillage = found.village.id;
        }

        const preferVillage = (savedVillage && getVillage(savedVillage))
            ? savedVillage
            : (BARTER_VILLAGES[0] && BARTER_VILLAGES[0].id);

        if (preferVillage) {
            selectedVillageId = preferVillage;
            villageSelect.value = preferVillage;
            loadShipmentForVillage(preferVillage);

            const village = getVillage(preferVillage);
            const preferExchange = (savedExchange && getExchange(preferVillage, savedExchange))
                ? savedExchange
                : (village && village.exchanges[0] && village.exchanges[0].id);

            if (preferExchange) {
                selectedExchangeId = preferExchange;
                onExchangeChange();
            } else {
                selectedExchangeId = null;
                renderExchangePlanButtons(preferVillage);
                showMatrixEmpty('교환목록을 선택하세요');
            }
        } else {
            showMatrixEmpty('마을을 선택하세요');
        }
        syncIngredientFilterBtn();
        renderResultButtons();
    }

    function setSideTool(tool) {
        if (!tool) return;
        const tabs = document.querySelectorAll('.ot-side-tool-tab');
        if (!tabs.length) return;

        tabs.forEach(t => {
            const on = t.dataset.tool === tool;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        document.querySelectorAll('[data-tool-pane]').forEach(pane => {
            pane.hidden = pane.dataset.toolPane !== tool;
        });
    }

    function initSideToolTabs() {
        const tabs = document.querySelectorAll('.ot-side-tool-tab');
        if (!tabs.length) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                setSideTool(tab.dataset.tool);
            });
        });
    }

    function onVillageChange() {
        const { villageSelect } = els();
        selectedVillageId = villageSelect.value || null;
        selectedExchangeId = null;
        clearMapFilterSelection(true);
        loadShipmentForVillage(selectedVillageId);
        saveSelection();

        const village = currentVillage();
        if (village && village.exchanges && village.exchanges.length) {
            selectedExchangeId = village.exchanges[0].id;
            onExchangeChange();
        } else {
            renderExchangePlanButtons(selectedVillageId);
            showMatrixEmpty(selectedVillageId ? '교환목록을 선택하세요' : '마을을 선택하세요');
            renderResultButtons();
            syncIngredientFilterBtn();
            syncShipmentSummary();
        }
    }

    function onExchangeChange() {
        saveSelection();
        loadRatiosIntoState();
        loadBatchesIntoState();
        currentHave = loadSavedHave();
        refreshMatrix();
        syncIngredientFilterBtn();
        renderExchangePlanButtons(selectedVillageId);
        renderResultButtons();
        try {
            window.dispatchEvent(new CustomEvent('origin-barter-exchange-changed', {
                detail: { resultName: (currentExchange() && currentExchange().result && currentExchange().result.name) || '' },
            }));
        } catch (_) { /* ignore */ }
    }

    function loadRatiosIntoState() {
        const exchange = currentExchange();
        currentRatios = {};
        currentResultRatio = 0;
        if (!exchange || !exchange.ingredients) return;
        const saved = loadSavedRatios();
        exchange.ingredients.forEach(ing => {
            const ratio = (Number.isFinite(Number(saved[ing.name])) && Number(saved[ing.name]) > 0)
                ? parseInt(saved[ing.name], 10)
                : ing.defaultRatio;
            currentRatios[ing.name] = ratio;
        });
        if (exchange.result) {
            const rName = exchange.result.name;
            const savedR = Number(saved[rName]);
            currentResultRatio = (Number.isFinite(savedR) && savedR > 0)
                ? parseInt(saved[rName], 10)
                : exchange.result.defaultRatio;
        }
        saveCurrentRatios();
    }

    function onMatrixInput(e) {
        const input = e.target.closest('.ot-barter-cell-input');
        if (!input) return;
        const role = input.dataset.role;
        const name = input.dataset.good;
        if (!role || !name) return;

        if (role === 'ratio') {
            const exchange = currentExchange();
            const raw = input.value.trim();
            const n = parseInt(raw, 10);
            const val = (Number.isFinite(n) && n > 0) ? n : 0;
            if (exchange && exchange.result && name === exchange.result.name) {
                currentResultRatio = val;
            } else {
                currentRatios[name] = val;
            }
            saveCurrentRatios();
            updateComputedRows();
            return;
        }

        if (role === 'have') {
            const raw = input.value.trim();
            const n = parseInt(raw, 10);
            if (raw !== '' && Number.isFinite(n) && n >= 0) currentHave[name] = n;
            else delete currentHave[name];
            saveCurrentHave();
            updateComputedRows();
            syncShipmentSummary();
        }
    }

    /**
     * 목표: 선택한 교환 횟수 N × 1회 비율
     * 결과 적재: 실제 실은 재료 중 가장 부족한 비율(병목) 기준으로 교환 예상량
     * 결과 초과: 결과 적재 − 함대 적재량
     * 재료 사용: 병목 묶음 × 비율, 잔량: 입력 − 사용
     */
    function computePlan() {
        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return null;
        if (!exchange.result) return null;

        const resultRatio = currentResultRatio || exchange.result.defaultRatio || 0;
        if (resultRatio <= 0) return null;

        const hasMaterialRatio = exchange.ingredients.some(ing => (currentRatios[ing.name] || 0) > 0);
        if (!hasMaterialRatio) return null;

        const goalBatches = selectedBatches;
        const resultGoal = Math.round(goalBatches * resultRatio);
        const capacity = getCapacity();

        // 실제 적재 재료로 가능한 묶음 = min(적재_i / 비율_i)
        let haveBatches = null;
        for (const ing of exchange.ingredients) {
            const ratio = currentRatios[ing.name] || 0;
            if (ratio <= 0) continue;
            const have = Number(currentHave[ing.name]) || 0;
            const b = have / ratio;
            if (haveBatches == null || b < haveBatches) haveBatches = b;
        }
        if (haveBatches == null) haveBatches = 0;
        const resultHave = Math.round(haveBatches * resultRatio);

        const materials = exchange.ingredients.map(ing => {
            const ratio = currentRatios[ing.name] || 0;
            const amount = Math.round(goalBatches * ratio);
            const have = Number(currentHave[ing.name]) || 0;
            const used = ratio > 0 ? Math.round(haveBatches * ratio) : 0;
            const leftover = have - used;
            return { name: ing.name, amount, ratio, have, used, leftover };
        });

        const result = {
            name: exchange.result.name,
            ratio: resultRatio,
            amount: resultGoal,
            have: resultHave,
            // 결과 적재 − 함대 적재량 (+면 적재 초과)
            delta: capacity > 0 ? resultHave - capacity : null,
            capacity,
        };

        return { materials, result, capacity, batches: goalBatches };
    }

    function computeGoals() {
        const plan = computePlan();
        return plan ? plan.materials : null;
    }

    function goalCellHtml(amount) {
        if (amount == null) {
            return '<span class="ot-barter-cell-value ot-barter-goal">—</span>';
        }
        return `<span class="ot-barter-cell-value ot-barter-goal">${amount.toLocaleString()}</span>`;
    }

    function haveCellHtml(amount) {
        if (amount == null) {
            return '<span class="ot-barter-cell-value ot-barter-have">—</span>';
        }
        return `<span class="ot-barter-cell-value ot-barter-have">${amount.toLocaleString()}</span>`;
    }

    function materialHaveMetaHtml(used, leftover) {
        const usedText = used != null ? used.toLocaleString() : '—';
        const leftoverText = leftover != null ? leftover.toLocaleString() : '—';
        return `<div class="ot-barter-have-meta">
          <div class="ot-barter-have-line">사용 ${usedText}</div>
          <div class="ot-barter-have-line">잔량 ${leftoverText}</div>
        </div>`;
    }

    function deltaFromValues(have, goal) {
        if (goal == null) {
            return '<span class="ot-barter-cell-value ot-barter-delta">—</span>';
        }
        const delta = have - goal;
        let percentHtml = '';
        if (goal > 0) {
            const percent = Math.round((have / goal) * 100);
            percentHtml = `<div class="ot-barter-delta-percent">${percent}%</div>`;
        }
        if (delta >= 0) {
            const text = delta === 0 ? '0' : '+' + delta.toLocaleString();
            return `<span class="ot-barter-cell-value ot-barter-delta is-ok">${text}</span>${percentHtml}`;
        }
        return `<span class="ot-barter-cell-value ot-barter-delta is-short">${delta.toLocaleString()}</span>${percentHtml}`;
    }

    function deltaCellHtml(goal, have) {
        return deltaFromValues(have, goal);
    }

    /** 입력란은 유지하고 목표·사용·잔량·초과만 갱신 */
    function updateComputedRows() {
        const { matrixDiv } = els();
        const table = matrixDiv && matrixDiv.querySelector('.ot-barter-table');
        if (!table || !table.tBodies[0]) {
            refreshMatrix();
            return;
        }

        const exchange = currentExchange();
        if (!exchange || !exchange.ingredients) return;

        const plan = computePlan();
        lastGoals = plan ? plan.materials.map(g => ({ name: g.name, amount: g.amount })) : [];
        const matByName = {};
        (plan ? plan.materials : []).forEach(g => { matByName[g.name] = g; });

        const rows = table.tBodies[0].rows;
        const goalRow = rows[1];
        const haveRow = rows[2];
        const deltaRow = rows[3];
        if (!goalRow || !haveRow || !deltaRow) {
            refreshMatrix();
            return;
        }

        exchange.ingredients.forEach((ing, i) => {
            const mat = matByName[ing.name];
            const goal = mat ? mat.amount : null;
            const have = Number(currentHave[ing.name]) || 0;
            const used = mat ? mat.used : 0;
            const leftover = mat ? mat.leftover : have;
            const goalTd = goalRow.cells[i + 1];
            const haveTd = haveRow.cells[i + 1];
            const deltaTd = deltaRow.cells[i + 1];
            if (goalTd) goalTd.innerHTML = goalCellHtml(goal);
            if (deltaTd) deltaTd.innerHTML = deltaCellHtml(goal, have);

            if (haveTd) {
                let meta = haveTd.querySelector('.ot-barter-have-meta');
                const html = materialHaveMetaHtml(used, leftover);
                if (meta) {
                    meta.outerHTML = html;
                } else {
                    haveTd.insertAdjacentHTML('beforeend', html);
                }
            }
        });

        if (exchange.result) {
            const col = exchange.ingredients.length + 1;
            const r = plan && plan.result ? plan.result : null;
            if (goalRow.cells[col]) goalRow.cells[col].innerHTML = goalCellHtml(r ? r.amount : null);
            if (haveRow.cells[col]) haveRow.cells[col].innerHTML = haveCellHtml(r ? r.have : null);
            if (deltaRow.cells[col]) {
                // 결과 초과: 결과 적재 − 함대 적재량
                const cap = r && r.capacity > 0 ? r.capacity : (plan && plan.capacity > 0 ? plan.capacity : null);
                deltaRow.cells[col].innerHTML = (r && cap != null)
                    ? deltaFromValues(r.have, cap)
                    : deltaCellHtml(null, 0);
            }
        }
        syncShipmentSummary();
    }

    function showMatrixEmpty(message) {
        const { matrixDiv } = els();
        if (matrixDiv) matrixDiv.innerHTML = `<div class="ot-barter-empty">${escapeHtml(message)}</div>`;
    }

    function refreshMatrix() {
        const { matrixDiv } = els();
        if (!matrixDiv) return;

        const exchange = currentExchange();
        if (!exchange) {
            lastGoals = [];
            showMatrixEmpty(selectedVillageId ? '교환목록을 선택하세요' : '마을을 선택하세요');
            syncShipmentSummary();
            return;
        }
        if (!exchange.ingredients || !exchange.ingredients.length) {
            lastGoals = [];
            showMatrixEmpty('재료 비율 미등록');
            syncShipmentSummary();
            return;
        }

        const plan = computePlan();
        lastGoals = plan ? plan.materials.map(g => ({ name: g.name, amount: g.amount })) : [];

        const names = exchange.ingredients.map(ing => ing.name);
        const matByName = {};
        (plan ? plan.materials : []).forEach(g => { matByName[g.name] = g; });
        const result = plan && plan.result ? plan.result : null;

        const head = names.map(n => `<th scope="col" title="${escapeHtml(n)}">${escapeHtml(n)}</th>`).join('')
            + (exchange.result
                ? `<th scope="col" class="ot-barter-result-col" title="${escapeHtml(exchange.result.name)}">${escapeHtml(exchange.result.name)}</th>`
                : '');

        const ratioCells = names.map(n => {
            const v = currentRatios[n] || '';
            return `<td><input type="number" class="ot-barter-cell-input" min="1"
              data-role="ratio" data-good="${escapeHtml(n)}" value="${escapeHtml(String(v))}"
              aria-label="${escapeHtml(n)} 비율"></td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col"><input type="number" class="ot-barter-cell-input" min="1"
              data-role="ratio" data-good="${escapeHtml(exchange.result.name)}"
              value="${escapeHtml(String(currentResultRatio || exchange.result.defaultRatio || ''))}"
              aria-label="${escapeHtml(exchange.result.name)} 비율"></td>`
                : '');

        const goalCells = names.map(n => {
            const mat = matByName[n];
            return `<td>${goalCellHtml(mat ? mat.amount : null)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${goalCellHtml(result ? result.amount : null)}</td>`
                : '');

        const haveCells = names.map(n => {
            const mat = matByName[n];
            const have = Number(currentHave[n]) || 0;
            const val = have > 0 ? String(have) : '';
            const used = mat ? mat.used : 0;
            const leftover = mat ? mat.leftover : have;
            return `<td class="ot-barter-have-cell"><input type="number" class="ot-barter-cell-input" min="0"
              data-role="have" data-good="${escapeHtml(n)}" value="${escapeHtml(val)}"
              placeholder="0" aria-label="${escapeHtml(n)} 적재">${materialHaveMetaHtml(used, leftover)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${haveCellHtml(result ? result.have : null)}</td>`
                : '');

        const deltaCells = names.map(n => {
            const mat = matByName[n];
            const goal = mat ? mat.amount : null;
            const have = Number(currentHave[n]) || 0;
            return `<td>${deltaCellHtml(goal, have)}</td>`;
        }).join('')
            + (exchange.result
                ? `<td class="ot-barter-result-col">${result && result.capacity > 0
                    ? deltaFromValues(result.have, result.capacity)
                    : deltaCellHtml(null, 0)}</td>`
                : '');

        matrixDiv.innerHTML = `
          <table class="ot-barter-table">
            <thead>
              <tr>
                <th scope="col">물품</th>
                ${head}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">비율</th>
                ${ratioCells}
              </tr>
              <tr>
                <th scope="row">목표</th>
                ${goalCells}
              </tr>
              <tr>
                <th scope="row">적재</th>
                ${haveCells}
              </tr>
              <tr>
                <th scope="row">초과</th>
                ${deltaCells}
              </tr>
            </tbody>
          </table>`;
        syncShipmentSummary();
    }

    function ingredientNamesForExchange(exchange) {
        if (!exchange || !exchange.ingredients || !exchange.ingredients.length) return [];
        return exchange.ingredients.map(ing => ing.name);
    }

    function allVillageExchangeIds() {
        const village = currentVillage();
        return ((village && village.exchanges) || []).map((ex) => ex.id);
    }

    /** 항구 교역품 이름 집합 — 맵 필터는 이 목록에 있는 재료만 표시 */
    function getPortGoodsNameSet() {
        const ports = window.ORIGIN_PORT_GOODS;
        if (!ports || typeof ports !== 'object') return null;
        const set = new Set();
        for (const list of Object.values(ports)) {
            if (!Array.isArray(list)) continue;
            for (const g of list) {
                if (g && g.name) set.add(g.name);
            }
        }
        return set;
    }

    function isMapFilterableIngredient(name) {
        const portNames = getPortGoodsNameSet();
        if (!portNames) return true;
        return portNames.has(name);
    }

    /** 맵용으로 선택된 결과물들의 재료 합집합 (항구 교역품만, 선택 없으면 빈 배열) */
    function ingredientNamesForMapFilter() {
        if (!mapFilterExchangeIds.length) return [];
        const seen = Object.create(null);
        const out = [];
        mapFilterExchangeIds.forEach((id) => {
            const names = ingredientNamesForExchange(getExchange(selectedVillageId, id));
            names.forEach((name) => {
                if (seen[name]) return;
                if (!isMapFilterableIngredient(name)) return;
                seen[name] = true;
                out.push(name);
            });
        });
        return out;
    }

    function clearMapFilterSelection(alsoClearMap) {
        mapFilterExchangeIds = [];
        if (alsoClearMap && typeof window.clearOriginGoodsFilter === 'function') {
            const current = (typeof window.getOriginGoodsNameFilter === 'function')
                ? window.getOriginGoodsNameFilter()
                : null;
            if (current && current.length) window.clearOriginGoodsFilter();
        }
    }

    function applyMapIngredientFilter(names) {
        if (!names || !names.length) {
            if (typeof window.clearOriginGoodsFilter === 'function') {
                window.clearOriginGoodsFilter();
            }
            return;
        }
        if (typeof window.filterMapByGoodNames === 'function') {
            window.filterMapByGoodNames(names);
        }
    }

    function isBarterMapFilterOn() {
        return mapFilterExchangeIds.length > 0;
    }

    function syncIngredientFilterBtn() {
        const { filterBtn } = els();
        if (!filterBtn) return;
        const on = isBarterMapFilterOn();
        filterBtn.classList.toggle('is-active', on);
        filterBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        filterBtn.textContent = on ? '재료 항구 표시 해제' : '맵에 재료 항구 표시';
        syncResultButtons();
    }

    function renderResultButtons() {
        const { resultBtns } = els();
        if (!resultBtns) return;
        const village = currentVillage();
        const exchanges = (village && village.exchanges) || [];
        if (!exchanges.length) {
            resultBtns.innerHTML = '';
            return;
        }
        const selected = Object.create(null);
        mapFilterExchangeIds.forEach((id) => { selected[id] = true; });
        resultBtns.innerHTML = exchanges.map((ex) => {
            const label = (ex.result && ex.result.name) || ex.name;
            const on = !!selected[ex.id];
            return `<button type="button" class="ot-barter-result-btn${on ? ' is-active' : ''}" data-exchange-id="${escapeHtml(ex.id)}" aria-pressed="${on ? 'true' : 'false'}">${categoryBadgeHtml(ex.category)}${escapeHtml(label)}</button>`;
        }).join('');
    }

    function syncResultButtons() {
        const { resultBtns } = els();
        if (!resultBtns || !resultBtns.children.length) {
            renderResultButtons();
            return;
        }
        const selected = Object.create(null);
        mapFilterExchangeIds.forEach((id) => { selected[id] = true; });
        resultBtns.querySelectorAll('[data-exchange-id]').forEach((btn) => {
            const on = !!selected[btn.dataset.exchangeId];
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function onResultBtnClick(e) {
        const btn = e.target.closest('[data-exchange-id]');
        if (!btn) return;
        const exchangeId = btn.dataset.exchangeId;
        if (!getExchange(selectedVillageId, exchangeId)) return;

        const idx = mapFilterExchangeIds.indexOf(exchangeId);
        if (idx >= 0) mapFilterExchangeIds.splice(idx, 1);
        else mapFilterExchangeIds.push(exchangeId);

        applyMapIngredientFilter(ingredientNamesForMapFilter());
        syncIngredientFilterBtn();
        renderResultButtons();
    }

    function filterMapByIngredients() {
        if (isBarterMapFilterOn()) {
            clearMapFilterSelection(true);
            syncIngredientFilterBtn();
            renderResultButtons();
            return;
        }

        const ids = allVillageExchangeIds();
        if (!ids.length) return;
        mapFilterExchangeIds = ids.slice();
        const names = ingredientNamesForMapFilter();
        if (!names.length) return;
        applyMapIngredientFilter(names);
        syncIngredientFilterBtn();
        renderResultButtons();
    }

    window.originBarterInit = init;
    window.setOriginSideTool = setSideTool;
    window.selectOriginBarterVillage = selectVillageById;
    window.isOriginBarterVillagePinsVisible = isVillagePinsVisible;
    window.getOriginBarterVillagesOnMap = villagesOnMap;
    window.getOriginBarterSelectedVillageId = function () { return selectedVillageId; };
    window.ORIGIN_BARTER_VILLAGE_EMOJI = VILLAGE_PIN_EMOJI;

    window.getOriginBarterResultName = function () {
        const exchange = currentExchange();
        return (exchange && exchange.result && exchange.result.name) || '';
    };
    window.ORIGIN_BARTER_VILLAGES = BARTER_VILLAGES;
    window.ORIGIN_BARTER_EXCHANGES = BARTER_VILLAGES.flatMap(v => v.exchanges || []);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
