import { useWorshipStore } from '../../stores/worshipStore';

export default function Page6Input() {
  const { sharing1, sharing2, closingPrayer, updateData } = useWorshipStore();

  return (
    <div className="space-y-1 max-w-4xl">
      {/* 헤더 - 다크 프로페셔널 */}
      <div className="bg-slate-800 border-l-4 border-blue-600 p-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wide">나눔 및 마침기도</h2>
        <p className="text-sm text-slate-300 mt-1">6페이지에 표시될 나눔과 기도를 입력하세요</p>
      </div>

      {/* 나눔1 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            나눔 1
          </label>
        </div>
        <div className="p-4">
          <textarea
            value={sharing1}
            onChange={(e) => updateData({ sharing1: e.target.value })}
            placeholder="나눔1 내용을 입력하세요"
            rows={5}
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400 resize-none"
          />
        </div>
      </div>

      {/* 나눔2 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            나눔 2
          </label>
        </div>
        <div className="p-4">
          <textarea
            value={sharing2}
            onChange={(e) => updateData({ sharing2: e.target.value })}
            placeholder="나눔2 내용을 입력하세요"
            rows={5}
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400 resize-none"
          />
        </div>
      </div>

      {/* 마침기도 */}
      <div className="bg-white border-l-4 border-slate-800">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            마침기도
          </label>
        </div>
        <div className="p-4">
          <textarea
            value={closingPrayer}
            onChange={(e) => updateData({ closingPrayer: e.target.value })}
            placeholder="마침기도 내용을 입력하세요"
            rows={5}
            className="w-full px-4 py-3 text-base border-2 border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors bg-white placeholder:text-slate-400 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
