// 가정예배서 데이터 타입 정의
export interface WorshipData {
  // 1페이지: 표지
  date: string; // YYYY-MM-DD
  title: string;
  sermonTitle: string;
  coverImage: string | null; // 이미지 경로

  // 2페이지: 사도신경 (고정), 3페이지: 경배와 찬양
  hymn1Image: string | null;

  // 5페이지: 예배기도 및 말씀
  prayerContent: string;
  sermonContentTitle: string;
  sermonContent: string;
  sermonImage: string | null;
  sermonLineHeight: string; // 말씀 내용 줄간격

  // 6페이지: 나눔 및 마침기도
  sharing1: string;
  sharing2: string;
  closingPrayer: string;

  // 7페이지: 결단
  commitmentImage: string | null;
}

export type PageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

