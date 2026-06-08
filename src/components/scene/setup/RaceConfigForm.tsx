import React from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { Settings } from 'lucide-react';
// CR-SA-17-E3 / 2026-06-07: フェーズ構成変更 UI（houserule-features.md §7 / scene1-setup.md §2）。
import { getPaceAnchorOptions, getPhaseConfigDisplayLabels } from '../../../core/paceAnchor';
import type { PacePosition } from '../../../types';

// CR-SA-17-E3 / 2026-06-07: ペース位置プルダウンの「なし」を表す select 用センチネル値
//（pacePosition の実値は null。select の value 属性は文字列のみのため変換する）。
const PACE_NONE_SENTINEL = '__none__';

export const RaceConfigForm: React.FC = () => {
    const {
        config,
        participants,
        setMidPhaseCount,
        // CR-SA-17-E3 / 2026-06-07: フェーズ構成変更アクション（ON 時のみ使用）。
        setStartPhaseCount,
        setEndPhaseCount,
        setPacePosition,
        setFullGateSize,
        generateParticipants,
    } = useRaceStore();

    // CR-SA-17-E3 / 2026-06-07: フェーズ構成変更ハウスルールの ON/OFF。OFF（デフォルト）時は現行 UI のまま。
    const enablePhaseConfig = config.houseRules.enablePhaseConfig;

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

    // CR-SA-17-E3 / 2026-06-07: ペース位置の有効アンカー候補（+「なし」）と現在の構成表示ラベルを
    // 現在の回数から都度算出する（§7.5 動的連動）。OFF 時は描画しないため算出のみ。
    const paceAnchorOptions = getPaceAnchorOptions(
        config.startPhaseCount,
        config.midPhaseCount,
        config.endPhaseCount,
    );
    const displayLabels = getPhaseConfigDisplayLabels(
        config.startPhaseCount,
        config.midPhaseCount,
        config.endPhaseCount,
        config.pacePosition,
    );

    // CR-SA-17-E3 / 2026-06-07: ペース位置 UI = スライダー（序盤・中盤・終盤の回数スライダーと統一）。
    // プルダウン案とスライダー案をコミュニティアンケートで比較し、スライダー案を採用（2026-06-08 決定）。
    // スライダー候補を時間順に並べる:「なし」→ 序盤の後 → ... → 最後から2番目の後（末尾の終盤の後は §7.5 禁止で不在）。
    // getPaceAnchorOptions は [各アンカー(の後), なし] の順で返すため、末尾の「なし」を先頭へ移動して構成する。
    const paceSliderItems: { value: PacePosition; label: string }[] = [
        paceAnchorOptions[paceAnchorOptions.length - 1], // なし
        ...paceAnchorOptions.slice(0, -1),               // 各アンカー（時間順）
    ];
    const paceCurrentIndex = Math.max(
        0,
        paceSliderItems.findIndex(it => it.value === config.pacePosition),
    );

    const handlePaceSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const idx = parseInt(e.target.value);
        const item = paceSliderItems[idx];
        if (item) setPacePosition(item.value);
    };

    return (
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-xl space-y-6 transition-colors">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-4">
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">0. レース設定 (Race Config)</h2>
            </div>

            {enablePhaseConfig ? (
                // CR-SA-17-E3: フェーズ構成変更 ON。序盤→中盤→終盤→ペース位置 を時間順に配置（ユーザー必須要件）。
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Start Phase Count (1〜4) */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                                序盤ダイスの回数 (1〜4回)
                            </label>
                            <div className="relative pt-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="4"
                                    step="1"
                                    value={config.startPhaseCount}
                                    onChange={(e) => setStartPhaseCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                                    <span>1回</span>
                                    <span>2回</span>
                                    <span>3回</span>
                                    <span>4回</span>
                                </div>
                            </div>
                        </div>

                        {/* Mid Phase Count (0〜4) */}
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

                        {/* End Phase Count (1〜4) */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                                終盤ダイスの回数 (1〜4回)
                            </label>
                            <div className="relative pt-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="4"
                                    step="1"
                                    value={config.endPhaseCount}
                                    onChange={(e) => setEndPhaseCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                                    <span>1回</span>
                                    <span>2回</span>
                                    <span>3回</span>
                                    <span>4回</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Pace Position: スライダー（回数選択と統一、コミュニティ決定で採用） */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                                ペース位置 <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">(挟む位置 /「なし」)</span>
                            </label>
                            <div className="relative pt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max={paceSliderItems.length - 1}
                                    step="1"
                                    value={paceCurrentIndex}
                                    onChange={handlePaceSliderChange}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono gap-1">
                                    {paceSliderItems.map((it, idx) => (
                                        <span
                                            key={it.value === null ? PACE_NONE_SENTINEL : it.value}
                                            className={`text-center whitespace-nowrap ${idx === paceCurrentIndex ? 'text-primary-600 dark:text-primary-400 font-bold' : ''}`}
                                        >
                                            {it.label}
                                        </span>
                                    ))}
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
                                    className="flex-1 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:shadow-none"
                                >
                                    入力欄生成 (Update)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 現在の構成（可変対応） */}
                    <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50 flex items-center justify-between text-sm transition-colors">
                        <span className="text-slate-500 dark:text-slate-400">現在の構成:</span>
                        <span className="text-primary-600 dark:text-primary-400 font-bold font-mono">
                            {displayLabels.join(' → ')}
                        </span>
                    </div>
                </>
            ) : (
                // OFF（デフォルト）: 現行 UI と完全同一（中盤回数 + フルゲート人数 + 固定構成表示）。
                <>
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
                                    className="flex-1 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:shadow-none"
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
                </>
            )}
        </div>
    );
};
