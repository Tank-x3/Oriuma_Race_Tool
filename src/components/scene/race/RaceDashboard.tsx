import React, { useState, useEffect } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Trophy, Check, TrendingUp, Edit3 } from 'lucide-react';
import { clsx } from 'clsx';
// Bundle-4 / P4-1, P4-5 / 2026-05-10: 戦法ボタンの 1 レース 1 回制限判定に使用
import { findActivatedSpecialStrategy } from './specialStrategy.helpers';
// Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正モーダル + ボタン併記フォーマット
import { ModifierModal } from './ModifierModal';
import { formatModifierAnnotation } from './modifier.helpers';
import type { Umamusume } from '../../../types';

// Bundle-4 / P4-1, P4-5 / 2026-05-10: 未選択 → 捲り → 溜め → 未選択 の 3 状態循環
const nextStrategyValue = (
    current: 'Makuri' | 'Tame' | null | undefined
): 'Makuri' | 'Tame' | null => {
    if (current === 'Makuri') return 'Tame';
    if (current === 'Tame') return null;
    return 'Makuri';
};

const strategyButtonLabel = (current: 'Makuri' | 'Tame' | null | undefined): string => {
    if (current === 'Makuri') return '戦法: 捲り';
    if (current === 'Tame') return '戦法: 溜め';
    return '戦法: ---';
};

export const RaceDashboard: React.FC = () => {
    const {
        participants,
        currentPhaseId,
        config,
        setSpecialStrategy,
    } = useRaceStore();
    const { getPhaseLabel } = useRaceEngine();
    const [copied, setCopied] = useState(false);

    // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 補正モーダル開閉状態
    const [modifierModalState, setModifierModalState] = useState<{
        isOpen: boolean;
        participant: Umamusume | null;
    }>({ isOpen: false, participant: null });

    // Bundle-4 / P4-1, P4-5 / 2026-05-10: 戦法ボタン表示条件
    // - houseRules.enableSpecialStrategy === true
    // - 現在フェーズが終盤以外（houserule-features.md §3 Phase Restriction）
    // - 進行中レースフェーズ（Start / Mid / Mid1..N）に限定（Pace / setup / gate_lottery 等は除外）
    const isRaceMainPhase =
        currentPhaseId === 'Start' ||
        currentPhaseId === 'Mid' ||
        currentPhaseId.startsWith('Mid');
    const showSpecialStrategy =
        config.houseRules.enableSpecialStrategy && isRaceMainPhase;

    // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 補正ボタン表示条件
    // - houseRules.enableModifier === true
    // - 進行中レースフェーズ（Start / Mid / Mid1..N / End）= 戦法と異なり End 含む
    const isModifierEligiblePhase =
        currentPhaseId === 'Start' ||
        currentPhaseId === 'Mid' ||
        currentPhaseId.startsWith('Mid') ||
        currentPhaseId === 'End';
    const showModifier =
        config.houseRules.enableModifier && isModifierEligiblePhase;

    // Bundle-8-T4 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 戦法ボタン初期値 Scene 1 事前申告連動
    // （scene3-race.md §5 + scene1-setup.md §2）
    // 当該フェーズ到達時、Scene 1 で specialStrategyType + specialStrategyPhase を申告した
    // participant の history[currentPhase].specialStrategy が未操作（undefined）であれば
    // setSpecialStrategy で自動 ON 化する。null（GM 取消後）/ 値あり（GM 操作済）はいずれも skip し
    // 既存 Bundle-4 の手動操作経路を温存する。Bundle-6 戻る操作後も history が保持されるため、
    // 戻り先で再度自動 ON 化されることはない。
    useEffect(() => {
        if (!config.houseRules.enableSpecialStrategy) return;
        if (!isRaceMainPhase) return;

        participants.forEach((p) => {
            const strategyType = p.specialStrategyType;
            const strategyPhase = p.specialStrategyPhase;
            if (!strategyType || !strategyPhase) return;
            if (strategyPhase !== currentPhaseId) return;

            const existing = p.history[currentPhaseId]?.specialStrategy;
            if (existing !== undefined) return;

            setSpecialStrategy(p.id, currentPhaseId, strategyType);
        });
    }, [
        currentPhaseId,
        participants,
        config.houseRules.enableSpecialStrategy,
        isRaceMainPhase,
        setSpecialStrategy,
    ]);

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

                                        {/* Bundle-4 / P4-1, P4-5 / 2026-05-10: 戦法ボタン（特殊戦法 ON + 中盤までのみ） */}
                                        {showSpecialStrategy && (() => {
                                            const currentValue = p.history[currentPhaseId]?.specialStrategy ?? null;
                                            const activated = findActivatedSpecialStrategy(p);
                                            // 1 レース 1 回制限: 他フェーズに発動済の場合は disabled
                                            // 同フェーズ内なら未選択/捲り/溜めを切替可能
                                            const lockedByOther =
                                                activated !== null && activated.phaseId !== currentPhaseId;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSpecialStrategy(
                                                            p.id,
                                                            currentPhaseId,
                                                            nextStrategyValue(currentValue),
                                                        )
                                                    }
                                                    disabled={lockedByOther}
                                                    aria-pressed={currentValue !== null}
                                                    title={
                                                        lockedByOther
                                                            ? `他フェーズ (${activated?.phaseId}) で発動済のため変更できません`
                                                            : '戦法: 未選択 → 捲り → 溜め → 未選択 を切り替え'
                                                    }
                                                    className={clsx(
                                                        'px-2 py-1 rounded-md text-xs font-bold transition-all border',
                                                        currentValue === 'Makuri' &&
                                                            'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
                                                        currentValue === 'Tame' &&
                                                            'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
                                                        currentValue === null &&
                                                            'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
                                                        lockedByOther && 'opacity-40 cursor-not-allowed',
                                                    )}
                                                >
                                                    {strategyButtonLabel(currentValue)}
                                                </button>
                                            );
                                        })()}

                                        {/* Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 補正ボタン（汎用補正 ON + 進行中フェーズで表示） */}
                                        {showModifier && (() => {
                                            const modifier = p.history[currentPhaseId]?.manualModifier;
                                            const annotation = formatModifierAnnotation(modifier);
                                            const hasModifier = modifier !== undefined;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setModifierModalState({
                                                            isOpen: true,
                                                            participant: p,
                                                        })
                                                    }
                                                    aria-label={hasModifier ? `補正: ${annotation}（編集）` : '補正を入力'}
                                                    title={hasModifier ? `補正: ${annotation}（クリックで編集）` : '補正を入力'}
                                                    className={clsx(
                                                        'px-2 py-1 rounded-md text-xs font-bold transition-all border flex items-center gap-1',
                                                        hasModifier
                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
                                                    )}
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    {hasModifier ? annotation : '補正'}
                                                </button>
                                            );
                                        })()}
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

            {/* Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 補正入力モーダル
                key にモーダル開閉/対象参加者の組合せを与えて再マウント駆動とし、
                ModifierModal 側の useState 初期値で既存補正値を毎回読み直させる。 */}
            <ModifierModal
                key={
                    modifierModalState.isOpen && modifierModalState.participant
                        ? `${modifierModalState.participant.id}-${currentPhaseId}`
                        : 'closed'
                }
                isOpen={modifierModalState.isOpen}
                participant={modifierModalState.participant}
                phaseId={currentPhaseId}
                onClose={() =>
                    setModifierModalState({ isOpen: false, participant: null })
                }
            />
        </div>
    );
};
