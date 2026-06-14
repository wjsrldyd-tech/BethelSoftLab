import { create } from 'zustand';
import { WorshipData } from '../types';

interface WorshipStore extends WorshipData {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  updateData: (data: Partial<WorshipData>) => void;
  resetData: () => void;
  loadData: (data: Partial<WorshipData>) => void;
}

const initialData: WorshipData = {
  date: new Date().toISOString().split('T')[0], // 오늘 날짜
  title: '',
  sermonTitle: '',
  coverImage: null,
  hymn1Image: null,
  prayerContent: '',
  sermonContentTitle: '',
  sermonContent: '',
  sermonImage: null,
  sermonLineHeight: '4',
  sharing1: '',
  sharing2: '',
  closingPrayer: '',
  commitmentImage: null,
};

export const useWorshipStore = create<WorshipStore>((set) => ({
  ...initialData,
  currentPage: 1,
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  updateData: (data) => set((state) => ({ ...state, ...data })),
  
  resetData: () => set({ ...initialData, currentPage: 1 }),
  
  loadData: (data) => set({ ...data, currentPage: 1 }),
}));

