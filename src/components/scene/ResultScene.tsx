import { useRef, useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { useRaceStore } from '../../store/useRaceStore';
import { RankingCalculator } from '../../core/logic/RankingCalculator';
import { clsx } from 'clsx';
import { Check, Copy } from 'lucide-react';

export const ResultScene = () => {
  const { participants, resetRace, moveToJudgment } = useRaceStore();
  const tableRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculate official results
  const results = useMemo(() => {
    return RankingCalculator.calculateFinalRanking(participants);
  }, [participants]);

  const handleCopy = () => {
    const text = results.map(r => {
      return `${r.rank}着 ${r.participant.name} (${r.finalScore}) ${r.marginText}`;
    }).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleBack = () => {
    // Check if we skipped Judgment Scene (No judgment needed)
    // If so, go back to Race Scene directly to avoid loop.
    const needsJudgment = RankingCalculator.detectJudgmentNeeds(participants).length > 0;

    if (needsJudgment) {
      moveToJudgment();
    } else {
      // Go to Race Scene (End Phase)
      useRaceStore.getState().setCurrentPhase('End'); // Ensure phase is correct
      useRaceStore.setState(s => ({ uiState: { ...s.uiState, scene: 'race' } }));
    }
  };

  const handleReset = () => {
    if (confirm("現在のレース結果を破棄して、新しいレースを始めますか？")) {
      resetRace();
    }
  };

  const handleSaveImage = async () => {
    if (!printRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 1,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        windowWidth: 800,
      });

      const link = document.createElement('a');
      link.download = `race_result_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) {
      console.error(e);
      alert("画像保存に失敗しました。テキストコピー機能を利用してください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={handleBack} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          &lt; 戻る(確認)
        </button>
        <div className="flex gap-4">
          <button onClick={handleReset} className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-2 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-bold">
            🔄 最初から新しいレースを始める
          </button>
        </div>
      </div>

      <div className="text-center py-4">
        <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">🏆 最終結果 (Official Result)</h2>
      </div>

      {/* Main Result Table (Screen View) */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden relative result-table-container border border-slate-200 dark:border-slate-700" ref={tableRef}>
        <div className="p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 dark:border-slate-300 text-lg text-slate-800 dark:text-slate-100">
                <th className="p-2 w-16 text-center">着順</th>
                <th className="p-2">名前</th>
                <th className="p-2 text-right w-24">合計</th>
                <th className="p-2 text-center w-24 text-slate-400 dark:text-slate-500 text-sm">[判定]</th>
                <th className="p-2 text-right w-32">着差</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={r.participant.id}
                  className={clsx(
                    "border-b border-slate-200 dark:border-slate-700/50",
                    i < 3 && "bg-yellow-50/30 dark:bg-yellow-900/15"
                  )}
                >
                  <td className="p-3 text-center text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{r.rank}</td>
                  <td className="p-3 font-bold text-lg text-slate-800 dark:text-slate-100">{r.participant.name}</td>
                  <td className="p-3 text-right font-mono text-lg text-slate-800 dark:text-slate-200">{r.finalScore}</td>
                  <td className="p-3 text-center font-mono text-slate-400 dark:text-slate-500">
                    {r.participant.judgment?.photo ? `(${r.participant.judgment.photo})` : '--'}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">{r.marginText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Footer for Image */}
        <div className="p-4 text-right text-slate-400 dark:text-slate-500 text-xs font-mono border-t border-slate-200 dark:border-slate-700/50">
          Generated by Ori-Uma Race Tool
        </div>
      </div>

      {/* Hidden Export View (Off-screen) - 画像生成用にライトモード固定 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: '800px',
          background: 'white', // Ensure background
          zIndex: -1000
        }}
      >
        <div ref={printRef} className="bg-white rounded-lg overflow-hidden relative" style={{ width: '800px' }}>
          <div className="p-8">
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">🏆 レース結果</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800 text-lg">
                  <th className="p-2 w-16 text-center">着順</th>
                  <th className="p-2">名前</th>
                  <th className="p-2 text-right w-32">着差</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.participant.id} className={clsx("border-b border-gray-200", i < 3 && "bg-yellow-50/30")}>
                    <td className="p-3 text-center text-xl font-bold font-mono">{r.rank}</td>
                    <td className="p-3 font-bold text-lg">{r.participant.name}</td>
                    <td className="p-3 text-right font-bold text-gray-700">{r.marginText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-right text-gray-400 text-xs font-mono border-t">
            Generated by Ori-Uma Race Tool
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-6 pt-4">
        <button
          onClick={handleCopy}
          className={clsx(
            "flex items-center gap-2 text-white px-8 py-4 rounded-lg shadow transition lg:text-lg font-bold",
            copied
              ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          )}
        >
          {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
          {copied ? "コピーしました" : "確定リスト(Text)をコピー"}
        </button>
        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white px-8 py-4 rounded-lg shadow transition lg:text-lg font-bold disabled:opacity-50"
        >
          {saving ? "生成中..." : "🖼️ 画像として保存(.png)"}
        </button>
      </div>

      <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
        ※画像保存は800px幅で行われます。
      </div>
    </div>
  );
};
