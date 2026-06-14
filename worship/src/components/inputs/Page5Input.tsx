import { useWorshipStore } from '../../stores/worshipStore';

export default function Page5Input() {
  const {
    prayerContent,
    sermonContentTitle,
    sermonContent,
    sermonImage,
    sermonLineHeight,
    updateData,
  } = useWorshipStore();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateData({ sermonImage: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    updateData({ sermonImage: null });
  };

  return (
    <div className="space-y-1 max-w-4xl">
      {/* 헤더 - 다크 프로페셔널 */}
      <div className="bg-slate-800 border-l-4 border-blue-600 p-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wide">예배기도 및 말씀</h2>
        <p className="text-sm text-slate-300 mt-1">5페이지에 표시될 기도와 말씀을 입력하세요</p>
      </div>

      {/* 예배기도 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            예배기도
          </label>
        </div>
        <div className="p-4">
          <textarea
            value={prayerContent}
            onChange={(e) => updateData({ prayerContent: e.target.value })}
            placeholder="기도 내용을 입력하세요"
            rows={5}
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400 resize-none"
          />
        </div>
      </div>

      {/* 말씀 제목 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            말씀 제목(본문)
          </label>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={sermonContentTitle}
            onChange={(e) => updateData({ sermonContentTitle: e.target.value })}
            placeholder="예: 순종으로 경험하는 기적 (마태복음 8:5-13)"
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 말씀 내용 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            말씀 내용
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 font-medium">줄간격:</label>
            <input
              type="number"
              min="1"
              max="10"
              step="0.5"
              value={sermonLineHeight || '4'}
              onChange={(e) => updateData({ sermonLineHeight: e.target.value })}
              className="w-16 px-2 py-1 text-sm border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
          </div>
        </div>
        <div className="p-4">
          <textarea
            value={sermonContent}
            onChange={(e) => updateData({ sermonContent: e.target.value })}
            placeholder="말씀 내용을 입력하세요"
            rows={10}
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400 resize-none"
          />
        </div>
      </div>

      {/* 말씀 이미지 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            말씀 이미지 <span className="text-xs text-slate-500 ml-2 normal-case">(16:9 비율)</span>
          </label>
        </div>
        <div className="p-4">
          {!sermonImage ? (
            <label className="block w-full border-2 border-dashed border-slate-300 hover:border-blue-500 cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50">
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="w-12 h-12 mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-base text-slate-700 font-semibold mb-1">이미지 업로드</p>
                <p className="text-sm text-slate-500">클릭하거나 파일을 드래그하세요</p>
                <p className="text-xs text-slate-400 mt-2">JPG, PNG (최대 10MB)</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative border-2 border-slate-200">
              <img
                src={sermonImage}
                alt="말씀 이미지 미리보기"
                className="w-full h-80 object-contain bg-slate-50"
              />
              <button
                onClick={removeImage}
                className="absolute top-0 right-0 bg-red-600 text-white px-4 py-2 text-sm font-bold hover:bg-red-700 transition-colors uppercase tracking-wide"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

