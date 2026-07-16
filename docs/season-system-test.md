# 계절 시스템 테스트 케이스

## 기본 테스트

### 북반구 사계절 (낭트)
```javascript
// 11월 = 가을
getOriginSeasonForMonth(11, '낭트')
// { month: 11, seasonType: 'north-4seasons', activeTag: '가을' }

// 3월 = 봄
getOriginSeasonForMonth(3, '낭트')
// { month: 3, seasonType: 'north-4seasons', activeTag: '봄' }
```

### 남반구 사계절 (리마)
```javascript
// 11월 = 봄 (북반구와 반대)
getOriginSeasonForMonth(11, '리마')
// { month: 11, seasonType: 'south-4seasons', activeTag: '봄' }

// 3월 = 가을
getOriginSeasonForMonth(3, '리마')
// { month: 3, seasonType: 'south-4seasons', activeTag: '가을' }
```

### 건기-우기-건기 (시에라리온)
```javascript
// 11월 = 건기
getOriginSeasonForMonth(11, '시에라리온')
// { month: 11, seasonType: 'dry-rainy-dry', activeTag: '건기' }

// 8월 = 우기
getOriginSeasonForMonth(8, '시에라리온')
// { month: 8, seasonType: 'dry-rainy-dry', activeTag: '우기' }
```

### 건기+1-우기-건기 (하바나)
```javascript
// 11월 = 우기
getOriginSeasonForMonth(11, '하바나')
// { month: 11, seasonType: 'dry+1-rainy-dry', activeTag: '우기' }

// 6월 = 건기
getOriginSeasonForMonth(6, '하바나')
// { month: 6, seasonType: 'dry+1-rainy-dry', activeTag: '건기' }
```

### 열대 (다바오)
```javascript
// 모든 월 = 빈 문자열
getOriginSeasonForMonth(11, '다바오')
// { month: 11, seasonType: 'tropical', activeTag: '' }

// 성수기 없음
getOriginGoodSeasonStatus(good, 11, '다바오')
// 'plain'
```

### 한대 (레이캬비크)
```javascript
// 모든 월 = 빈 문자열
getOriginSeasonForMonth(11, '레이캬비크')
// { month: 11, seasonType: 'arctic', activeTag: '' }

// 성수기 없음
getOriginGoodSeasonStatus(good, 11, '레이캬비크')
// 'plain'
```

## 특수 케이스

### 밀 예외 처리
```javascript
const wheat = { name: '밀', category: '식료품' };

// 어느 항구, 어느 월이든 항상 평수기
getOriginGoodSeasonStatus(wheat, 11, '낭트')
// 'plain'

getOriginGoodSeasonStatus(wheat, 3, '리마')
// 'plain'
```

## 호환성 테스트

### 기존 품목별 peak/off 태그
```javascript
const good = {
  name: '라일락',
  category: '향료',
  peak: ['가을'],
  off: ['봄']
};

// 낭트, 11월(가을) → 성수기
getOriginGoodSeasonStatus(good, 11, '낭트')
// 'peak'

// 낭트, 3월(봄) → 비수기
getOriginGoodSeasonStatus(good, 3, '낭트')
// 'off'
```

## 항구명 정규화 테스트

```javascript
// ORIGIN_PORT_RENAMES 기준
getOriginPortSeasonType('리스보아')  // → '리스본'
getOriginPortSeasonType('아바나')    // → '하바나'
getOriginPortSeasonType('믈라카')    // → '말라카'
```

## 월 계산 배수

```javascript
const plainQty = 100;
const month = 11;

// 낭트, 성수기 교역품 (가을 = peak)
const peakGood = { peak: ['가을'], category: '기호품' };
getOriginGoodSeasonQty(peakGood, plainQty, month, '낭트')
// 150 (100 × 1.5)

// 낭트, 비수기 교역품 (가을 = off)
const offGood = { off: ['가을'], category: '식료품' };
getOriginGoodSeasonQty(offGood, plainQty, month, '낭트')
// 50 (100 × 0.5)

// 낭트, 평수기 교역품
const plainGood = { category: '염료' };
getOriginGoodSeasonQty(plainGood, plainQty, month, '낭트')
// 100 (100 × 1.0)
```

## 검증 포인트

### 1. 항구 매핑 완료 확인
- [x] 북반구-사계절: 93개
- [x] 남반구-사계절: 15개
- [x] 건기-우기-건기: 14개
- [x] 건기+1-우기-건기: 18개
- [x] 열대: 22개
- [x] 한대: 3개
- **총 165개** (우기-건기-우기 제외)

### 2. 달력 정확도
- [x] 북반구 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울
- [x] 남반구 반대 계절
- [x] 건기-우기-건기 11~5월 건기, 6~10월 우기
- [x] 건기+1-우기-건기 12~6월 건기, 7~11월 우기

### 3. 예외 처리
- [x] 열대/한대 항상 평수기
- [x] 밀 항상 평수기
- [x] 기존 품목별 peak/off 호환

### 4. 향후 작업
- [ ] CATEGORY_SEASON_RULES 완성 (통합표 기준)
- [ ] 우기-건기-우기 도시 추가
- [ ] 기존 DB 데이터 재입력
