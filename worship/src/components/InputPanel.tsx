import { useWorshipStore } from '../stores/worshipStore';
import Page1Input from './inputs/Page1Input';
import Page3Input from './inputs/Page3Input';
import Page5Input from './inputs/Page5Input';
import Page6Input from './inputs/Page6Input';
import Page7Input from './inputs/Page7Input';
import { saveToJSON, loadFromJSON, openFileDialog } from '../utils/fileUtils';

export default function InputPanel() {
  const { currentPage, setCurrentPage, resetData, loadData, ...data } = useWorshipStore();

  const handleSave = async () => {
    try {
      // 필수 필드 검증
      if (!data.date || !data.title || !data.sermonTitle) {
        alert('필수 필드를 입력해주세요.\n(날짜, 제목, 설교제목)');
        return;
      }

      await saveToJSON(data as any);
      alert('저장되었습니다.');
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
      console.error(error);
    }
  };

  const handleLoad = async () => {
    try {
      const file = await openFileDialog();
      if (!file) return;

      const loadedData = await loadFromJSON(file);
      loadData(loadedData);
      alert('불러오기가 완료되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '불러오기 중 오류가 발생했습니다.');
      console.error(error);
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
      <div className="border-t border-primary-border p-4 bg-white flex gap-2">
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
          불러오기
        </button>
        <button
          onClick={resetData}
          className="px-4 py-2 bg-gray-200 text-primary-text rounded hover:bg-gray-300 transition-colors"
        >
          초기화
        </button>
      </div>
    </div>
  );
}

