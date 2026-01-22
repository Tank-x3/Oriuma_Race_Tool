import React from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { Settings } from 'lucide-react';

export const RaceConfigForm: React.FC = () => {
    const { config, participants, setMidPhaseCount, setFullGateSize, generateParticipants } = useRaceStore();

    const handleGateSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
            setFullGateSize(val);
        } else {
            setFullGateSize(0); // Temporary or handle empty
        }
    };

    const handleGenerate = () => {
        if (!config.fullGateSize || config.fullGateSize <= 0 || config.fullGateSize > 100) return;

        // Destructive Check
        const currentCount = participants.length;
        const newCount = config.fullGateSize;

        if (newCount < currentCount) {
            // Check if any participant to be removed has data
            const toRemove = participants.slice(newCount);
            const hasData = toRemove.some(p => p.name.trim() !== '');

            if (hasData) {
                if (!confirm(`人数を減らすと、入力済みの末尾 ${currentCount - newCount} 名分のデータが削除されます。\nよろしいですか？`)) {
                    return;
                }
            }
        }

        generateParticipants(config.fullGateSize);
    };

    const isValidSize = config.fullGateSize !== null && config.fullGateSize > 0 && config.fullGateSize <= 100;

    return (
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-xl space-y-6 transition-colors">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-4">
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">0. レース設定 (Race Config)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Mid Phase Count */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                        中盤ダイスの回数 (0〜4回)
                    </label>
                    <div className="relative pt-1">
                        <input
                            type="range"
                            min="0"
                            max="4"
                            step="1"
                            value={config.midPhaseCount}
                            onChange={(e) => setMidPhaseCount(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                            <span>0回</span>
                            <span>1回</span>
                            <span>2回</span>
                            <span>3回</span>
                            <span>4回</span>
                        </div>
                    </div>
                </div>

                {/* Gate Size */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                        フルゲート人数 <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">(1〜100人)</span>
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.fullGateSize || ''}
                            onChange={handleGateSizeChange}
                            onWheel={(e) => e.currentTarget.blur()}
                            className={`w-24 h-10 bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 text-center font-mono text-lg focus:outline-none focus:border-primary-500 transition-colors ${!isValidSize && config.fullGateSize !== null
                                ? 'border-red-500 text-red-500'
                                : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                }`}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={!isValidSize}
                            className="flex-1 h-10 px-4 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary-500/20 disabled:shadow-none"
                        >
                            入力欄生成 (Update)
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50 flex items-center justify-between text-sm transition-colors">
                <span className="text-slate-500 dark:text-slate-400">現在の構成:</span>
                <span className="text-primary-600 dark:text-primary-400 font-bold font-mono">
                    序盤 → ペース →
                    {config.midPhaseCount === 0 ? ' (中盤なし) ' :
                        config.midPhaseCount === 1 ? ' 中盤 ' : ` 中盤 x${config.midPhaseCount} `}
                    → 終盤
                </span>
            </div>
        </div>
    );
};
