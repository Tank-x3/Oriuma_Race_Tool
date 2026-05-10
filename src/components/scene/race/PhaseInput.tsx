import React, { useState } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { ParserFactory } from '../../../core/parser/parserFactory';
import {
    getUndetectedDiceDetails,
    formatUndetectedDiceDetail,
} from '../../../core/parser/parserUtils';
import { Calculator, getActivePhaseIds } from '../../../core/calculator';
import { getPaceLabel } from '../../../core/strategies';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Play, RotateCw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
// Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional 適用]:
// 既存 d10/d20 ヒューリスティックでは SuperGamble (1d35) / SuperStability (1d3) を捕捉できないため、
// 参加者の固有タイプから期待ダイス式を逆引きして判定する方式に拡張する（拡張固有タイプ含む 5 種網羅）。
import { getExpectedUniqueDiceStr } from './phaseOutput.helpers';
// Bundle-4 / P4-1, P4-5 / 2026-05-10 [ESCALATION 案 V Provisional 適用]:
// 戦法併記（【捲り】±N / 【溜め】±N）を解析前に除去する純粋関数。
import { stripStrategyAnnotations } from './specialStrategy.helpers';

interface PhaseInputProps {
    onErrors?: (errors: string[]) => void;
}

export const PhaseInput: React.FC<PhaseInputProps> = ({ onErrors }) => {
    const {
        participants,
        currentPhaseId,
        strategies,
        paceResult,
        config,
        updateParticipant,
        setPaceResult
    } = useRaceStore();

    // We might need to know "isPacePhase" from PhaseId?
    // currentPhaseId: 'Start', 'Pace', 'Mid', 'End'
    const isPacePhase = currentPhaseId === 'Pace';

    const [inputText, setInputText] = useState('');
    const { addNotification } = useNotificationStore();
    const { getPhaseLabel } = useRaceEngine();
    const [isParsing, setIsParsing] = useState(false);

    const handleParse = async () => {
        if (!inputText.trim()) return;
        setIsParsing(true);
        // Clear previous errors
        onErrors?.([]);

        try {
            await new Promise(resolve => setTimeout(resolve, 50)); // UI flush

            // Bundle-4 / P4-1, P4-5 / 2026-05-10 [ESCALATION 案 V Provisional 適用]:
            // 仕様 houserule-features.md §3 Application Timing は「事後適用」前提だが、
            // 実 GM 運用では掲示板投稿前に戦法を宣言（PhaseOutput 併記）する必要があり、
            // 解析対象テキストに ` 【捲り】±N` / ` 【溜め】±N` 併記が含まれる。
            // Parser を不変厳守エリアから外せないため、解析前処理として併記を除去する。
            const sanitizedInput = stripStrategyAnnotations(inputText);

            const context = isPacePhase ? 'PACE' : 'RACE';
            const parser = ParserFactory.getParser(sanitizedInput);
            const { results, errors } = parser.parse(sanitizedInput, participants, context);

            // Validation Handling
            if (errors.length > 0) {
                // Pass errors to parent for embedded display
                onErrors?.(errors);
                // Also stop parsing
                setIsParsing(false);
                return;
            }

            if (results.length === 0) {
                // No valid data found is also an error
                onErrors?.(['有効なダイス結果が見つかりませんでした。']);
                setIsParsing(false);
                return;
            }

            // Logic Execution
            if (isPacePhase) {
                const pace = results[0];
                if (pace) {
                    const label = getPaceLabel(pace.diceResult);
                    setPaceResult(pace.diceResult, label);
                    addNotification('success', `ペース判定: ${pace.diceResult} (${label}) が確定しました。`);
                    setInputText('');
                    onErrors?.([]); // Clear errors on success
                }
            } else {
                // Race Phase Update
                // Use a local map to accumulate updates within this batch
                // ensuring multiple results for the same participant (Base + Unique) 
                // don't overwrite each other due to stale closure state.
                const pendingUpdates = new Map<string, typeof participants[0]>();

                results.forEach(result => {
                    // unexpected: find returns undefined if not found
                    const originalP = participants.find(p => p.id === result.participantId);
                    if (!originalP) return;

                    // Get the latest state from pendingUpdates or original
                    const p = pendingUpdates.get(originalP.id) || originalP;

                    // Update History
                    const prevHistory = p.history[currentPhaseId] || {};
                    const diceStr = result.diceStr;

                    // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional 適用]:
                    // 参加者の固有タイプから期待ダイス式を逆引きし、解析結果と完全一致するかで判定。
                    // SuperGamble (1d35) / SuperStability (1d3) を含む 5 種すべてに対応。
                    // 既存の d10/d20 ヒューリスティックでは Stability/Gamble/Persistent (`X+dice1d10/dice1d20`)
                    // のみ正しく分類されていたが、拡張固有タイプには対応できなかった。
                    const expectedUniqueDiceStr = getExpectedUniqueDiceStr(p.uniqueSkill.type);
                    const isUnique = expectedUniqueDiceStr !== '' && diceStr === expectedUniqueDiceStr;

                    const newHistoryEntry = {
                        ...prevHistory,
                        ...(isUnique ? {
                            uniqueDice: {
                                diceStr: result.diceStr,
                                values: [],
                                sum: result.diceResult
                            }
                        } : {
                            baseDice: {
                                diceStr: result.diceStr,
                                values: [],
                                sum: result.diceResult
                            }
                        })
                    };

                    const newTotalHistory = {
                        ...p.history,
                        [currentPhaseId]: newHistoryEntry
                    };

                    // Calc Total Score with the Accumulated History
                    const updatedPForCalc = { ...p, history: newTotalHistory };
                    const totalScore = Calculator.calculateTotalScore(
                        updatedPForCalc,
                        strategies,
                        paceResult.face,
                        getActivePhaseIds(config.midPhaseCount)
                    );

                    // Store updated state in map
                    pendingUpdates.set(p.id, {
                        ...p,
                        history: newTotalHistory,
                        score: totalScore
                    });
                });

                // Commit all updates to store
                let updatedCount = 0;
                pendingUpdates.forEach((updatedP) => {
                    updateParticipant(updatedP.id, {
                        score: updatedP.score,
                        history: updatedP.history
                    });
                    updatedCount++;
                });

                if (updatedCount > 0) {
                    // CR-14 ENG21 ユーザーフィードバック反映:
                    // pendingUpdates 反映後の participants 配列で「現フェーズで必要なダイス種別」を検証する。
                    //   - パターンA: フェーズダイス / 固有ダイスのうち片方欠落も検出する
                    //   - パターンB: 既に history に登録済みの参加者は missing 扱いされない（部分追加パース対応）
                    const participantsAfterParse = participants.map(p => pendingUpdates.get(p.id) ?? p);
                    const undetectedDetails = getUndetectedDiceDetails(
                        participantsAfterParse,
                        currentPhaseId,
                        getPhaseLabel
                    );
                    if (undetectedDetails.length > 0) {
                        addNotification(
                            'info',
                            `未検出: ${undetectedDetails.map(formatUndetectedDiceDetail).join(', ')}（${undetectedDetails.length} 件のダイス入力が漏れている可能性があります）`
                        );
                    }
                    addNotification('success', `${updatedCount} 名のスコアを更新しました。`);
                    setInputText('');
                    onErrors?.([]); // Clear errors on success
                }
            }

        } catch (e) {
            console.error(e);
            onErrors?.(['解析中に予期せぬエラーが発生しました。']);
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold">
                    <RotateCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3>[2] 結果取り込み</h3>
                </div>
                <div className="text-xs text-gray-400">
                    {isPacePhase ? '1d9の結果を貼るだけ' : '88-chのレスをそのままペースト'}
                </div>
            </div>

            <div className="p-4 space-y-4">
                <textarea
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        // Optional: Clear errors on change? Maybe keep until next parse.
                    }}
                    placeholder={isPacePhase
                        ? "ここに 'dice1d9=...' を貼り付けてください"
                        : "ここに掲示板のレスを丸ごと貼り付けてください...\n※自動的に名前とダイスを解析します"}
                    className="w-full h-32 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                />

                <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>解析実行時にスコアが即座に更新されます</span>
                    </div>
                    <button
                        onClick={handleParse}
                        disabled={!inputText.trim() || isParsing}
                        className={clsx(
                            "px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                            !inputText.trim() || isParsing
                                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-indigo-500/30"
                        )}
                    >
                        {isParsing ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isParsing ? '解析中...' : '解析実行'}
                    </button>
                </div>
            </div>
        </div>
    );
};
