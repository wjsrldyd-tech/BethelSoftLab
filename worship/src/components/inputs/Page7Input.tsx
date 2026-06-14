import { useWorshipStore } from '../../stores/worshipStore';

export default function Page7Input() {
  const { commitmentImage, updateData } = useWorshipStore();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateData({ commitmentImage: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    updateData({ commitmentImage: null });
  };

  return (
    <div className="space-y-1 max-w-4xl">
      {/* 헤더 - 다크 프로페셔널 */}
      <div className="bg-slate-800 border-l-4 border-blue-600 p-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wide">결단</h2>
        <p className="text-sm text-slate-300 mt-1">7페이지 악보 이미지를 업로드하세요</p>
      </div>

      {/* 악보 이미지 업로드 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            악보 이미지 <span className="text-xs text-slate-500 ml-2 normal-case">(A4 비율)</span>
          </label>
        </div>
        <div className="p-4">
          {!commitmentImage ? (
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
                src={commitmentImage}
                alt="악보 미리보기"
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
