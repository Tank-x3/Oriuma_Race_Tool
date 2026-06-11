import React, { useState } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { ParserFactory } from '../../../core/parser/parserFactory';
import {
    getUndetectedDiceDetails,
    formatUndetectedDiceDetail,
} from '../../../core/parser/parserUtils';
import { Calculator, getActivePhaseIdsForConfig } from '../../../core/calculator';
import { getPaceLabel } from '../../../core/strategies';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Play, RotateCw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
// CR-SA-11-Sub-B-E1 / 2026-05-11: PhaseInput 解析前処理層への分離。
// Bundle-2 ENG25 由来の拡張固有タイプ判定（isUniqueDice）と
// Bundle-4 ENG28 由来の戦法注釈除去（sanitizeInputForParser）を preprocessor 層に集約。
// 既存純粋関数（stripStrategyAnnotations / getExpectedUniqueDiceStr）は存置し、
// preprocessor 層から呼び出す形に再構成（重複定義なし）。
//
// CR-SA-13-E1 / 2026-05-12: ハウスルール脚質ダイス × 固有期待ダイス衝突対応。
// 旧 isUniqueDice 単独判定（diceStr 完全一致ヒューリスティック）から、
// classifyDiceResultsForParticipant（規則 R-1/R-2/R-3 三段判定）へ置換。
// 参加者単位グループ化により 1 回の Parser 呼び出しで同一参加者宛に複数結果が
// 到達するパターンも一貫した振り分けで処理する。
// CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11: フェーズ依存プレフィックス数チェック
// （中盤以降で N+M+dice の改変投稿を検知・ブロック）を解析フローに接続する。
// CR-SA-20-E4 / 2026-06-11: 隊列専用解析（dice1d9 全文抽出、ペース解析と同型・parser 本体不変）。
import {
    sanitizeInputForParser,
    classifyDiceResultsForParticipant,
    detectPhasePrefixViolations,
    parseFormationDiceText,
} from './phaseInput.preprocessors';
// CR-SA-20-E4 / 2026-06-11: 隊列形態名（超縦長〜超団子）の導出（E2 完成品の配線）。
import { getFormationLabel } from '../../../core/formation';
// Bundle-8-T5 / CR-SA-4 / 2026-05-10 [ESCALATION 案 V Provisional 適用]:
// 終盤【絆スキル】セクション解析後の bondDice 格納分岐用拡張型
// （scene3-race.md §2、houserule-features.md §2 [v] §データ仕様 L141）。
import type { ParseResultWithBond } from '../../../core/parser/bondTypes';
import type { ParsedLine } from '../../../core/parser/interface';

interface PhaseInputProps {
    onErrors?: (errors: string[]) => void;
}

export const PhaseInput: React.FC<PhaseInputProps> = ({ onErrors }) => {
    const {
        participants,
        currentPhaseId,
        strategies,
        paceResult,
        // CR-SA-20-E4 / 2026-06-11: 確定済み隊列出目（通常解析経路の score 再計算への伝播に使用）
        formationResult,
        config,
        updateParticipant,
        setPaceResult,
        setFormationResult
    } = useRaceStore();

    // We might need to know "isPacePhase" from PhaseId?
    // currentPhaseId: 'Start', 'Pace', 'Mid', 'End'
    const isPacePhase = currentPhaseId === 'Pace';
    // CR-SA-20-E4 / 2026-06-11: 隊列フェーズ（GM ダイス専用、ペースと同型の単発全体補正）。
    const isFormationPhase = currentPhaseId === 'Formation';

    const [inputText, setInputText] = useState('');
    const { addNotification } = useNotificationStore();
    const { getPhaseLabel } = useRaceEngine();
    const [isParsing, setIsParsing] = useState(false);

    const handleParse = async () => {
        if (!inputText.trim()) return;
        setIsParsing(true);
        // Clear previous errors
        onErrors?.([]);

        // CR-SA-17-E4 / 2026-06-08: enablePhaseConfig でゲートした有効フェーズ列。OFF 透過のため
        // config に可変値が残っていても OFF 時は固定列（Start / End 単一）になる。
        // 末尾 = 最後の終盤フェーズ ID（絆ダイス取り込み判定に使用）。
        const activePhaseIds = getActivePhaseIdsForConfig(config);
        const lastEndPhaseId = activePhaseIds.length > 0 ? activePhaseIds[activePhaseIds.length - 1] : 'End';

        try {
            await new Promise(resolve => setTimeout(resolve, 50)); // UI flush

            // CR-SA-20-E4 / 2026-06-11: 隊列フェーズは専用解析で完結する（houserule-features.md §6.6 +
            // scene3-race.md §1 L117）。parser（ParserFactory）を経由せず dice1d9 を全文抽出し、
            // 形態名を確定して store へ保存する。この early return により、フェーズ依存プレフィックス
            // チェック（detectPhasePrefixViolations、L226「隊列フェーズは対象外」）と通常解析は
            // 隊列フェーズで一切実行されない。
            // ★解析時点では participants の score を変更しない（解析時スコア不変、反映は §6.5 の
            // 隊列直後フェーズ遷移時 = RaceScene.handleNext）。
            if (isFormationPhase) {
                const formationParse = parseFormationDiceText(inputText);
                if (formationParse.errors.length > 0 || formationParse.face === null) {
                    onErrors?.(formationParse.errors);
                    setIsParsing(false);
                    return;
                }
                const formationLabel = getFormationLabel(formationParse.face);
                setFormationResult(formationParse.face, formationLabel);
                addNotification('success', `隊列判定: ${formationParse.face} (${formationLabel}) が確定しました。`);
                setInputText('');
                onErrors?.([]); // Clear errors on success
                setIsParsing(false);
                return;
            }

            // CR-SA-11-Sub-B-E1 / 2026-05-11: preprocessor 層経由で戦法注釈を除去。
            // 旧 Bundle-4 ENG28 由来の stripStrategyAnnotations 直接呼び出しを置換。
            const sanitizedInput = sanitizeInputForParser(inputText);

            const context = isPacePhase ? 'PACE' : 'RACE';

            // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
            // RACE コンテキストのみ、現フェーズの許容プレフィックス数を超える行（改変の疑い）を
            // 解析前にブロックする（ペースは dice1d9 専用解析でプレフィックス概念なし → 対象外）。
            // Parser（不変厳守エリア）は最大2プレフィックスを「フェーズ非依存」で受理するため、
            // 「中盤以降なのに数値2つ」の検知はここ（preprocessor 層）が担う。
            const prefixErrors = isPacePhase
                ? []
                : detectPhasePrefixViolations(sanitizedInput, currentPhaseId);
            if (prefixErrors.length > 0) {
                onErrors?.(prefixErrors);
                setIsParsing(false);
                return;
            }

            const parser = ParserFactory.getParser(sanitizedInput);
            // Bundle-8-T5 / CR-SA-4 / 2026-05-10 [ESCALATION 案 V Provisional 適用]:
            // ParserStrategy.parse() の戻り型は ParseResult（interface.ts 不変厳守）だが、StandardParser /
            // EmojiParser 双方は内部で ParseResultWithBond を返す。bondResults プロパティを参照するため
            // ここで構造的サブタイプとしてキャストする。
            const { results, errors, bondResults } = parser.parse(
                sanitizedInput,
                participants,
                context,
            ) as ParseResultWithBond;

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

                // CR-SA-13-E1 / 2026-05-12: 参加者単位グループ化。
                // 1 回の Parser 呼び出しで同一参加者宛に複数結果が到達するパターン
                // （フェーズダイス + 固有ダイス同時取り込み等）を R-1/R-2/R-3 で一貫処理するため、
                // results を participantId 単位にまとめてから振り分け関数へ委譲する。
                const resultsByParticipantId = new Map<string, ParsedLine[]>();
                results.forEach(result => {
                    const list = resultsByParticipantId.get(result.participantId) ?? [];
                    list.push(result);
                    resultsByParticipantId.set(result.participantId, list);
                });

                resultsByParticipantId.forEach((parsedLines, participantId) => {
                    // unexpected: find returns undefined if not found
                    const originalP = participants.find(p => p.id === participantId);
                    if (!originalP) return;

                    // Get the latest state from pendingUpdates or original
                    const p = pendingUpdates.get(originalP.id) || originalP;

                    // CR-SA-13-E1 / 2026-05-12: preprocessor 層の振り分け関数経由で
                    // ハウスルール脚質ダイス × 固有期待ダイス衝突を解消（規則 R-1/R-2/R-3）。
                    // 旧 isUniqueDice 単独判定（diceStr ヒューリスティック）を置換。
                    const prevHistory = p.history[currentPhaseId] || {};
                    // CR-SA-15-E2 / 2026-05-15: R-3 判定の固有期待値入力源を houseRules.uniqueDiceConfig 参照化
                    const classification = classifyDiceResultsForParticipant(
                        p.uniqueSkill.type,
                        p.uniqueSkill.phases,
                        parsedLines,
                        currentPhaseId,
                        prevHistory.baseDice,
                        config.houseRules.uniqueDiceConfig,
                    );

                    const newHistoryEntry = {
                        ...prevHistory,
                        ...(classification.baseDice ? { baseDice: classification.baseDice } : {}),
                        ...(classification.uniqueDice ? { uniqueDice: classification.uniqueDice } : {}),
                    };

                    const newTotalHistory = {
                        ...p.history,
                        [currentPhaseId]: newHistoryEntry
                    };

                    // Calc Total Score with the Accumulated History
                    // CR-SA-15-E2 / 2026-05-15: 固有固定値を houseRules.uniqueDiceConfig 参照化
                    // CR-SA-20-E4 / 2026-06-11: 隊列補正の伝播（ON かつ出目確定時のみ）。履歴全再構築の
                    // ため、隊列直後フェーズ以降のダイス取り込みで隊列補正が脱落しない（§6.5 永続性）。
                    const updatedPForCalc = { ...p, history: newTotalHistory };
                    const totalScore = Calculator.calculateTotalScore(
                        updatedPForCalc,
                        strategies,
                        paceResult.face,
                        activePhaseIds,
                        config.houseRules.uniqueDiceConfig,
                        config.houseRules.enableFormationDice ? formationResult.face : null
                    );

                    // Store updated state in map
                    pendingUpdates.set(p.id, {
                        ...p,
                        history: newTotalHistory,
                        score: totalScore
                    });
                });

                // Bundle-8-T5 / CR-SA-4 / 2026-05-10 [ESCALATION 案 V Provisional 適用]:
                // 終盤【絆スキル】セクション解析後の bondDice 格納分岐
                // （scene3-race.md §2、houserule-features.md §2 [v] §データ仕様 L141）。
                // 仕様 §2「他フェーズでの非表示」は本ガード（currentPhaseId === lastEndPhaseId）で実現する。
                // CR-SA-17-E4 / 2026-06-08: 可変終盤対応。絆ダイスは最後の終盤フェーズ（OFF / 終盤 1 = 'End'、
                // 終盤 ≥2 = 'End{n}'）で取り込む。score 再計算は不要（calculator.ts は bondDice を見ない、最終加算は Bundle-8-T6）。
                if (currentPhaseId === lastEndPhaseId && bondResults && bondResults.length > 0) {
                    bondResults.forEach((br) => {
                        const originalP = participants.find((pp) => pp.id === br.participantId);
                        if (!originalP) return;
                        const p = pendingUpdates.get(originalP.id) || originalP;
                        const prevEntry = p.history[currentPhaseId] || {};
                        const newEntry = {
                            ...prevEntry,
                            bondDice: {
                                diceStr: br.diceStr,
                                values: [],
                                sum: br.sum,
                            },
                        };
                        const newHistory = {
                            ...p.history,
                            [currentPhaseId]: newEntry,
                        };
                        pendingUpdates.set(p.id, {
                            ...p,
                            history: newHistory,
                        });
                    });
                }

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
                    {isPacePhase || isFormationPhase ? '1d9の結果を貼るだけ' : '88-chのレスをそのままペースト'}
                </div>
            </div>

            <div className="p-4 space-y-4">
                <textarea
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        // Optional: Clear errors on change? Maybe keep until next parse.
                    }}
                    placeholder={isPacePhase || isFormationPhase
                        ? "ここに 'dice1d9=...' を貼り付けてください"
                        : "ここに掲示板のレスを丸ごと貼り付けてください...\n※自動的に名前とダイスを解析します\n※行数制限などで複数レスに分割して投稿した場合も、1回にまとめて解析実行してください"}
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
