import { useState } from 'react';
import { useWorshipStore } from '../stores/worshipStore';
import PagePreview from './preview/PagePreview';
import { generateAllPagesPDF } from '../utils/pdfUtils';
import { format } from 'date-fns';
import { PageNumber } from '../types';

export default function PreviewPanel() {
  const { currentPage, setCurrentPage, date } = useWorshipStore();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const pages = [
    { num: 1, label: '표지' },
    { num: 2, label: '사도신경' },
    { num: 3, label: '경배와 찬양' },
    { num: 4, label: '말씀' },
    { num: 5, label: '나눔' },
    { num: 6, label: '결단' },
    { num: 7, label: '주기도문' },
  ];

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);

      // 파일명 생성: YYYYMMDD_가정예배.pdf
      const formattedDate = date ? format(new Date(date), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
      const filename = `${formattedDate}_가정예배.pdf`;

      // 모든 페이지 요소 ID 목록
      const pageElements = pages.map(page => ({
        pageNumber: page.num as any,
        elementId: `pdf-page-${page.num}`
      }));

      await generateAllPagesPDF(pageElements, filename);

      alert('PDF 다운로드가 완료되었습니다.');
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* 페이지 탭 */}
      <div className="bg-white border-b border-primary-border">
        <div className="flex overflow-x-auto px-4">
          {pages.map((page) => (
            <button
              key={page.num}
              onClick={() => setCurrentPage(page.num)}
              className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
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

      {/* 미리보기 영역 */}
      <div className="flex-1 overflow-y-auto p-4 flex justify-center">
        <div className="bg-white shadow-lg" style={{ width: '210mm', height: '297mm' }}>
          <PagePreview pageNumber={currentPage as PageNumber} />
        </div>
      </div>

      {/* PDF 생성용 숨겨진 페이지들 */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {pages.map(page => (
          <div
            key={page.num}
            id={`pdf-page-${page.num}`}
            style={{ width: '210mm', height: '297mm', backgroundColor: 'white' }}
          >
            <PagePreview pageNumber={page.num as any} />
          </div>
        ))}
      </div>

      {/* 하단 버튼 */}
      <div className="bg-white border-t border-primary-border p-4 flex gap-2">
        <button
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className={`px-4 py-2 bg-primary-focus text-white rounded hover:bg-blue-600 transition-colors ${
            isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isGeneratingPDF ? 'PDF 생성 중...' : 'PDF 다운로드'}
        </button>
        <button
          onClick={() => {
            window.print();
          }}
          className="px-4 py-2 bg-gray-200 text-primary-text rounded hover:bg-gray-300 transition-colors"
        >
          인쇄
        </button>
      </div>
    </div>
  );
}

