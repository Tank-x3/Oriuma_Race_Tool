import React, { useState } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Trophy, Check, TrendingUp, Edit3 } from 'lucide-react';
import { clsx } from 'clsx';

export const RaceDashboard: React.FC = () => {
    const { participants, currentPhaseId } = useRaceStore();
    const { getPhaseLabel } = useRaceEngine();
    const [copied, setCopied] = useState(false);

    // Sort by Score Descending
    const sorted = [...participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-breaker: Gate Number? Or Entry Index?
        // Usually Gate Number (Ascending) favored if tie?
        // Requirements say: "Scene 2: Tie -> Entry Order".
        // Scene 3 Ranking: "Score Descending". Tie breaker not explicitly defined but usually stable sort.
        // Let's use Gate Number (Asc) as secondary sort for stability.
        if (a.gate !== null && b.gate !== null) return a.gate - b.gate;
        return 0;
    });

    // Score Difference Helper
    const getDiffDisplay = (score: number, prevScore: number) => {
        const diff = prevScore - score; // Positive
        if (diff <= 1) return '並ぶ';

        // Convert to lengths (1pt = 1/4 length)
        const lengths = diff / 4;
        const whole = Math.floor(lengths);
        const fraction = lengths - whole;

        let fractionText = '';
        if (fraction === 0.25) fractionText = '1/4';
        else if (fraction === 0.5) fractionText = '1/2';
        else if (fraction === 0.75) fractionText = '3/4';

        if (whole === 0) return fractionText || '0'; // Should not happen given diff>=2
        if (whole > 0 && fractionText) return `${whole} ${fractionText}`;
        return `${whole}`;
    };

    // Generate Copy Text
    // Format: "①Name (Score)"
    const generateCopyText = () => {
        return sorted.map((p) => {
            // Gate symbol
            const gate = p.gate ?? 0;
            const sym = (gate >= 1 && gate <= 20) ? '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[gate - 1] : `(${gate})`;
            return `${sym} ${p.name} (${p.score})`;
        }).join('\n');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateCopyText()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold">
                        <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                        <h3>[3] 現在の順位 / 実況補助</h3>
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">({getPhaseLabel(currentPhaseId)}時点)</span>
                    </div>
                </div>

                {/* List Container */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {sorted.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">参加者がいません</div>
                    ) : (
                        sorted.map((p, idx) => {
                            const prevScore = idx > 0 ? sorted[idx - 1].score : p.score;
                            const diffDisplay = idx === 0 ? '---' : getDiffDisplay(p.score, prevScore);
                            const gateSym = (p.gate && p.gate >= 1 && p.gate <= 20) ? '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[p.gate - 1] : `(${p.gate})`;

                            return (
                                <div key={p.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        {/* Rank Badge */}
                                        <div className={clsx(
                                            "w-8 h-8 flex items-center justify-center rounded-full font-bold font-mono text-sm",
                                            idx === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500" :
                                                idx === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" :
                                                    idx === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-500" :
                                                        "text-gray-400"
                                        )}>
                                            {idx + 1}
                                        </div>

                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <span className="text-gray-400 font-normal">{gateSym}</span>
                                                {p.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{p.strategy}</span>
                                                {/* Status icons or Strategy (Unique) info */}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Score & Diff */}
                                    <div className="flex items-center gap-6">
                                        {/* Commentary Aid (Diff) */}
                                        <div className="hidden sm:block text-right">
                                            <div className="text-xs text-gray-400">vs 前走者</div>
                                            <div className={clsx(
                                                "text-sm font-medium",
                                                diffDisplay === '並ぶ' ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-600 dark:text-gray-300"
                                            )}>
                                                {diffDisplay} {diffDisplay !== '---' && diffDisplay !== '並ぶ' && <span className="text-xs text-gray-400">バ身</span>}
                                            </div>
                                        </div>

                                        <div className="text-right min-w-[60px]">
                                            <div className="text-xl font-display font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                {p.score}
                                            </div>
                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total</div>
                                        </div>

                                        {/* Edit/Modifier Button (Placeholder for House Rule) */}
                                        <button className="p-1.5 text-gray-300 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Copy Action Area */}
            <div className="flex justify-end">
                <button
                    onClick={handleCopy}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm border transition-all transform active:scale-95",
                        copied
                            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                    )}
                >
                    {copied ? <Check className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {copied ? '中間順位をコピーしました' : '現在の中間順位をコピー'}
                </button>
            </div>

            <p className="text-right text-xs text-gray-400 mt-2">
                ※実況補助（バ身差）はコピーに含まれません。
            </p>
        </div>
    );
};
