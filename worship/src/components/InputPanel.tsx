import { useState } from 'react';
import { useWorshipStore } from '../stores/worshipStore';
import Page1Input from './inputs/Page1Input';
import Page3Input from './inputs/Page3Input';
import Page5Input from './inputs/Page5Input';
import Page6Input from './inputs/Page6Input';
import Page7Input from './inputs/Page7Input';
import { saveToJSON, loadFromJSON, openFileDialog } from '../utils/fileUtils';
import {
  saveWorshipRecord,
  listWorshipRecords,
  loadWorshipRecord,
  deleteWorshipRecord,
  WorshipRecord,
} from '../utils/supabaseUtils';

export default function InputPanel() {
  const { currentPage, setCurrentPage, resetData, loadData, ...data } = useWorshipStore();
  const [dbStatus, setDbStatus] = useState<{ type: 'idle' | 'saving' | 'loading'; msg: string }>({ type: 'idle', msg: '' });
  const [showModal, setShowModal] = useState(false);
  const [records, setRecords] = useState<WorshipRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // ── 파일 저장 ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!data.date || !data.title || !data.sermonTitle) {
      alert('필수 필드를 입력해주세요.\n(날짜, 제목, 설교제목)');
      return;
    }
    try {
      await saveToJSON(data as any);
      alert('파일로 저장되었습니다.');
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // ── 파일 불러오기 ───────────────────────────────────────────────
  const handleLoad = async () => {
    try {
      const file = await openFileDialog();
      if (!file) return;
      const loadedData = await loadFromJSON(file);
      loadData(loadedData);
      alert('불러오기가 완료되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '불러오기 중 오류가 발생했습니다.');
    }
  };

  // ── DB 저장 ────────────────────────────────────────────────────
  const handleDbSave = async () => {
    if (!data.date || !data.title || !data.sermonTitle) {
      alert('필수 필드를 입력해주세요.\n(날짜, 제목, 설교제목)');
      return;
    }
    setDbStatus({ type: 'saving', msg: '저장 중...' });
    try {
      await saveWorshipRecord(data as any);
      setDbStatus({ type: 'idle', msg: '✓ DB 저장 완료' });
      setTimeout(() => setDbStatus({ type: 'idle', msg: '' }), 3000);
    } catch (err) {
      setDbStatus({ type: 'idle', msg: '' });
      alert(err instanceof Error ? err.message : 'DB 저장 중 오류가 발생했습니다.');
    }
  };

  // ── DB 목록 열기 ───────────────────────────────────────────────
  const handleOpenModal = async () => {
    setShowModal(true);
    setModalLoading(true);
    try {
      const list = await listWorshipRecords();
      setRecords(list);
    } catch (err) {
      alert(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.');
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  // ── DB 레코드 불러오기 ─────────────────────────────────────────
  const handleRecordLoad = async (id: string) => {
    try {
      const loaded = await loadWorshipRecord(id);
      loadData(loaded);
      setShowModal(false);
      alert('불러오기가 완료되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '불러오기 중 오류가 발생했습니다.');
    }
  };

  // ── DB 레코드 삭제 ─────────────────────────────────────────────
  const handleRecordDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteWorshipRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="border-b border-primary-border p-4 bg-white">
        <h1 className="text-2xl font-bold text-primary-text">가정예배서 작성기</h1>
      </div>

      {/* 페이지 탭 */}
      <div className="border-b border-primary-border bg-white">
        <div className="flex overflow-x-auto">
          {[
            { num: 1, label: '표지' },
            { num: 2, label: '사도신경' },
            { num: 3, label: '경배와 찬양' },
            { num: 4, label: '말씀' },
            { num: 5, label: '나눔' },
            { num: 6, label: '결단' },
          ].map((page) => (
            <button
              key={page.num}
              onClick={() => setCurrentPage(page.num)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                currentPage === page.num
                  ? 'border-primary-focus text-primary-focus font-semibold'
                  : 'border-transparent text-gray-600 hover:text-primary-text'
              }`}
            >
              {page.num}. {page.label}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 필드 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentPage === 1 && <Page1Input />}
        {currentPage === 2 && <div className="text-slate-400 py-4">사도신경은 고정 페이지입니다.</div>}
        {currentPage === 3 && <Page3Input />}
        {currentPage === 4 && <Page5Input />}
        {currentPage === 5 && <Page6Input />}
        {currentPage === 6 && <Page7Input />}
      </div>

      {/* 하단 버튼 */}
      <div className="border-t border-primary-border p-4 bg-white space-y-2">
        {/* DB 버튼 행 */}
        <div className="flex gap-2">
          <button
            onClick={handleDbSave}
            disabled={dbStatus.type === 'saving'}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {dbStatus.type === 'saving' ? '저장 중...' : '☁ DB 저장'}
          </button>
          <button
            onClick={handleOpenModal}
            className="flex-1 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors"
          >
            ☁ DB 불러오기
          </button>
        </div>

        {/* DB 상태 메시지 */}
        {dbStatus.msg && (
          <p className="text-emerald-600 text-sm font-medium">{dbStatus.msg}</p>
        )}

        {/* 파일/초기화 버튼 행 */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-focus text-white rounded hover:bg-blue-600 transition-colors"
          >
            파일로 저장
          </button>
          <button
            onClick={handleLoad}
            className="px-4 py-2 bg-gray-200 text-primary-text rounded hover:bg-gray-300 transition-colors"
          >
            파일 불러오기
          </button>
          <button
            onClick={resetData}
            className="px-4 py-2 bg-gray-200 text-primary-text rounded hover:bg-gray-300 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>

      {/* DB 목록 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-primary-text">저장된 가정예배 목록</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto p-4">
              {modalLoading ? (
                <p className="text-center text-gray-400 py-8">불러오는 중...</p>
              ) : records.length === 0 ? (
                <p className="text-center text-gray-400 py-8">저장된 예배가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {records.map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-primary-text truncate">{record.title || '(제목 없음)'}</p>
                        <p className="text-sm text-gray-500">{record.date} · {record.sermon_title}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRecordLoad(record.id)}
                          className="px-3 py-1 bg-sky-600 text-white text-sm rounded hover:bg-sky-700 transition-colors"
                        >
                          불러오기
                        </button>
                        <button
                          onClick={() => handleRecordDelete(record.id, record.title)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
