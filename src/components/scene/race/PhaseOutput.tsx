import React, { useState } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Copy, Check, Dices } from 'lucide-react';
import { clsx } from 'clsx';
import {
    getUniqueDiceFormula,
    getExpectedUniqueDiceStr,
    // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
    // ダイス式の「dice 前プレフィックス」生成。序盤2回目以降は `N+Z`（数値2つ）、
    // それ以外は従来の単一基礎値（効果値反映前のスコア）を返す。
    getDiceFormulaPrefix,
} from './phaseOutput.helpers';
// Bundle-4 / P4-1, P4-5 / 2026-05-10: 通常ダイス行末への特殊戦法併記
import { getSpecialStrategyAnnotation } from './specialStrategy.helpers';
// Bundle-8-T4 / CR-SA-4 / 2026-05-10: 終盤【絆スキル】セクション自動生成（scene3-race.md §2）
import { getBondSkillSection } from './bondSkill.helpers';
// CR-SA-17-E4 / 2026-06-08: 可変序盤・終盤対応のフェーズ別ダイス式 + 最後の終盤フェーズ ID 導出
import { getStrategyDice } from '../../../core/strategies';
import { getLastEndPhaseId } from '../../../core/calculator';
// CR-SA-20-E4 / 2026-06-11: 隊列フェーズの投稿用ダイス出力（E2 完成品の配線、houserule-features.md §6.6）。
// getFormationTemplateLines = 確定済みペース出目に対応する影響値テンプレート行群、
// getFormationModifier / getFormationLabel = 解析後の形態・脚質別補正値の画面表示に使用。
import { getFormationTemplateLines, getFormationModifier } from '../../../core/formation';

export const PhaseOutput: React.FC = () => {
    const {
        participants,
        strategies,
        currentPhaseId,
        paceResult,
        // CR-SA-20-E4 / 2026-06-11: 隊列フェーズの確定済み表示に使用
        formationResult,
        // Bundle-4 / P4-1, P4-5 / 2026-05-10: 効果値を併記文字列の生成に使用
        config,
    } = useRaceStore();
    const { getPhaseLabel } = useRaceEngine();
    const [copied, setCopied] = useState(false);

    // CR-SA-17-E4 / 2026-06-08: 現在構成の「最後の終盤フェーズ ID」（OFF / 終盤 1 = 'End'、終盤 ≥2 = 'End{n}'）。
    // 終盤反動の自動併記・絆スキルセクションの出力位置判定に使用する。
    const lastEndPhaseId = getLastEndPhaseId(config);

    // Sort participants by Gate Number (Scene 2 verified)
    // If gate is null, fallback to index (should be set in Scene 2)
    const sortedParticipants = [...participants].sort((a, b) => {
        if (a.gate !== null && b.gate !== null) return a.gate - b.gate;
        return 0; // Should not happen in Scene 3
    });

    // Helper: Get Dice Formula Prefix for Phase
    // Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
    // ダイス式 [基礎値] は specialStrategy 効果値反映前のスコアを使用する
    // （houserule-features.md §3 Application Timing 改訂分、scene3-race.md §2 特殊戦法併記）。
    // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
    //   序盤2回目以降（Start2〜）は `[中間値 N]+[脚質固定値 Z]`（数値2つ）、それ以外は従来どおり
    //   単一の基礎値を返す。算出ロジックは phaseOutput.helpers#getDiceFormulaPrefix に集約。
    const getPrefix = (p: typeof participants[0]) =>
        getDiceFormulaPrefix(p, currentPhaseId, config.houseRules, strategies);

    // Helper: Get Dice Formula
    const getDiceFormula = (strategyName: string) => {
        const strategy = strategies.find(s => s.name === strategyName);
        if (!strategy) return 'dice0d0'; // Error case

        // CR-SA-17-E4 / 2026-06-08: 可変序盤・終盤（Start1/End1…）対応。getStrategyDice へ委譲し
        // 複数序盤=序盤ダイス共通 / 複数終盤=終盤ダイス共通（大逃げ '-1d27' を含む）を一元化する。
        return getStrategyDice(strategy, currentPhaseId);
    };

    // Replacement for Gate Numbers
    // 1 -> ① ... 20 -> ⑳. >20 -> (21)
    const getGateSymbol = (gate: number) => {
        const symbols = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
        if (gate >= 1 && gate <= 20) return symbols[gate - 1];
        return `(${gate})`;
    };

    // History/Validation Logic
    const getCorrectionStatus = (p: typeof participants[0]) => {
        const history = p.history[currentPhaseId];

        // If missing completely, everything needs output
        if (!history) return { base: true, unique: true, missing: true };

        let needsBase = false;
        let needsUnique = false;

        // Base Dice Check
        const expectedBaseStr = getDiceFormula(p.strategy);
        const actualBaseStr = history.baseDice?.diceStr;

        // Normalize: remove leading '-' (Oonige fix)
        const expectedClean = expectedBaseStr.startsWith('-') ? expectedBaseStr.substring(1) : expectedBaseStr;

        if (actualBaseStr !== expectedClean) {
            needsBase = true;
        }

        // Check Unique Dice
        const pPhases = p.uniqueSkill.phases;
        let shouldHaveUnique = false;
        if (pPhases.includes(currentPhaseId)) shouldHaveUnique = true;
        else if (pPhases.includes(getPhaseLabel(currentPhaseId))) shouldHaveUnique = true;
        else if (currentPhaseId.startsWith('Mid') && (pPhases.includes('Mid') || pPhases.includes('中盤'))) shouldHaveUnique = true;

        const hasUnique = !!history.uniqueDice;

        if (shouldHaveUnique !== hasUnique) {
            needsUnique = true;
        } else if (shouldHaveUnique && hasUnique) {
            // Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ含む 5 種の期待ダイス式を helpers から取得
            // CR-SA-15-E2 / 2026-05-15: 固有期待ダイス式を houseRules.uniqueDiceConfig 参照化
            const expectedUnique = getExpectedUniqueDiceStr(p.uniqueSkill.type, config.houseRules.uniqueDiceConfig);

            if (history.uniqueDice?.diceStr !== expectedUnique) {
                needsUnique = true;
            }
        }

        return { base: needsBase, unique: needsUnique, missing: false };
    };

    const needsCorrection = (p: typeof participants[0]) => {
        const status = getCorrectionStatus(p);
        return status.base || status.unique;
    };

    // Calculate count of items needing output/correction
    // If everyone needs it (start of phase), count is max.
    // We visually highlight this only if some are done but some need correction.
    const correctionCount = sortedParticipants.filter(needsCorrection).length;

    // Auto-toggle logic could be in useEffect, but simple default state is safer. just loading.
    // User manual control is better.
    const [filterCorrection, setFilterCorrection] = useState(false);

    // Re-generate text with correct symbols
    const displayText = (() => {
        // CR-SA-20-E4 / 2026-06-11: 隊列フェーズの投稿用ダイス出力（houserule-features.md §6.6 +
        // scene3-race.md §2「隊列ダイス出力セクション」）。ペースフェーズと同形式の専用出力で
        // early return するため、他フェーズの出力に隊列セクションが混入することはない（L205）。
        if (currentPhaseId === 'Formation') {
            // 解析済み: 確定した隊列形態 + 脚質別補正値を画面表示する（§6.6「解析と表示」）。
            // この時点で score は不変（補正反映は次フェーズ遷移時、§6.5）。
            if (formationResult.face !== null) {
                const paceFace = paceResult.face ?? 0;
                const entries = strategies
                    .map(s => ({ name: s.name, value: getFormationModifier(formationResult.face!, paceFace, s.name) }))
                    .filter(e => e.value !== 0);
                const modText = entries.length === 0
                    ? '増減なし'
                    : entries.map(e => `${e.name}に${e.value > 0 ? '+' : ''}${e.value}`).join('、');
                return `【隊列判定】\n隊列確定済み: ${formationResult.face} (${formationResult.label})\n脚質別補正: ${modText}`;
            }

            // 未解析: dice1d9= + 確定済みペースに対応する影響値テンプレート（E2 書式、1 パターンのみ）。
            // ペース未確定（禁止構成のすり抜け）は RaceScene.handleNext の最終防衛線で隊列フェーズ
            // 到達前にブロックされる。万一到達した場合は paceFace=0 → テンプレートは空（安全側）。
            const templateLines = getFormationTemplateLines(paceResult.face ?? 0);
            return `【隊列判定】\ndice1d9=\n${templateLines.join('\n')}\n`;
        }

        if (currentPhaseId === 'Pace') {
            // ... (Pace logic unchanged for now, usually single shot)
            if (paceResult.face !== null) {
                return `【ペース判定】\nペース確定済み: ${paceResult.face} (${paceResult.label})`;
            }

            let paceText = `【ペース判定】\ndice1d9=\n`;

            // Re-use logic from original file for groups generation
            const groups = [
                { rolls: [1], label: 'ドスロー' },
                { rolls: [2, 3], label: 'スロー' },
                { rolls: [4, 5, 6], label: 'ミドル' },
                { rolls: [7, 8], label: 'ハイペース' },
                { rolls: [9], label: '超ハイペース' }
            ];

            // (Standard Logic Reuse)
            groups.forEach(group => {
                const sampleRoll = group.rolls[0];
                const valMap = new Map<number, string[]>();
                strategies.forEach(s => {
                    let val = 0;
                    if (s.paceModifiers && s.paceModifiers[sampleRoll] !== undefined) {
                        val = s.paceModifiers[sampleRoll];
                    } else {
                        if (sampleRoll === 1) {
                            if (s.name === '大逃げ') val = 12;
                            else if (s.name === '逃げ') val = 10;
                            else if (s.name === '先行') val = 5;
                            else if (s.name === '差し') val = 0;
                            else if (s.name === '追込') val = -5;
                        } else if (sampleRoll <= 3) {
                            if (['大逃げ', '逃げ', '先行'].includes(s.name)) val = 5;
                        } else if (sampleRoll <= 6) {
                            val = 0;
                        } else if (sampleRoll <= 8) {
                            if (['差し', '追込'].includes(s.name)) val = 5;
                        } else {
                            if (s.name === '大逃げ') val = -7;
                            else if (s.name === '逃げ') val = -5;
                            else if (s.name === '先行') val = 0;
                            else if (s.name === '差し') val = 5;
                            else if (s.name === '追込') val = 10;
                        }
                    }
                    if (val !== 0) {
                        const list = valMap.get(val) || [];
                        list.push(s.name);
                        valMap.set(val, list);
                    }
                });

                const lineParts: string[] = [];
                const sortedVals = Array.from(valMap.keys()).sort((a, b) => b - a);
                sortedVals.forEach(val => {
                    const names = valMap.get(val)?.join('・');
                    const sign = val > 0 ? '+' : '';
                    lineParts.push(`${names}に${sign}${val}`);
                });

                const rollStr = group.rolls.join(',');
                if (lineParts.length === 0) {
                    paceText += `${rollStr},${group.label}\n増減なし\n`;
                } else {
                    paceText += `${rollStr},${group.label}\n${lineParts.join('、')}\n`;
                }
            });
            return paceText;
        }

        let text = `【${getPhaseLabel(currentPhaseId)}ダイス】\n`;
        if (filterCorrection) {
            text += `※変更・修正が必要な対象のみ出力\n`;
        }

        const uniqueTextLines: string[] = [];

        sortedParticipants.forEach(p => {
            const status = getCorrectionStatus(p);

            // FILTER logic
            // If filtering is ON, and this participant doesn't need correction, skip completely.
            if (filterCorrection && !status.base && !status.unique) return;

            const gateSym = getGateSymbol(p.gate ?? 0);
            const prefix = getPrefix(p);
            const dice = getDiceFormula(p.strategy);

            // Output Base Dice ONLY if:
            // 1. Not filtering (Show All)
            // 2. OR Filtering AND Base needs cleaning (Missing or Mismatch)
            // Note: If "Missing" (new entry), status.missing is true, causing status.base=true usually.
            if (!filterCorrection || status.base) {
                let formula = "";
                if (dice.startsWith('-')) {
                    const positiveDice = dice.substring(1);
                    formula = `${prefix}-dice${positiveDice}=`;
                } else {
                    formula = `${prefix}+dice${dice}=`;
                }
                // Bundle-4 / P4-1, P4-5 / 2026-05-10: 通常ダイス行末に特殊戦法併記
                // （該当なしは空文字列、scene3-race.md §2 「特殊戦法併記」準拠）
                const annotation = getSpecialStrategyAnnotation(
                    p,
                    currentPhaseId,
                    config.houseRules.effectValue,
                    lastEndPhaseId,
                );
                text += `${gateSym} ${p.name}　${formula}${annotation}\n`;
            }

            // Output Unique Dice logic
            // Check if Unique Logic applies (regardless of validation)
            const pPhases = p.uniqueSkill.phases;
            let isMatch = false;
            if (pPhases.includes(currentPhaseId)) isMatch = true;
            else if (pPhases.includes(getPhaseLabel(currentPhaseId))) isMatch = true;
            else if (currentPhaseId.startsWith('Mid') && (pPhases.includes('Mid') || pPhases.includes('中盤'))) isMatch = true;

            if (isMatch) {
                // If filter is ON, only show if unique needs correction
                if (!filterCorrection || status.unique) {
                    // Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ含む 5 種のダイス文字列を helpers から取得
                    // CR-SA-15-E2 / 2026-05-15: 固有ダイス式を houseRules.uniqueDiceConfig 参照化
                    // CR-SA-21+22-E3 / 2026-07-06: カスタム固有スキル選択者は customUniqueSkills から
                    // §5.3 生成ルール適用（houserule-features.md §8.5）。'None' 選択者は空文字返却 =
                    // 固有ダイスセクションから自然除外（下段の if (uDice) ガードで行スキップ）。
                    const uDice = getUniqueDiceFormula(
                        p.uniqueSkill.type,
                        config.houseRules.uniqueDiceConfig,
                        p.uniqueSkill.customUniqueSkillId,
                        config.houseRules.customUniqueSkills,
                    );

                    if (uDice) {
                        uniqueTextLines.push(`${gateSym} ${p.name}　${uDice}`);
                    }
                }
            }
        });

        if (uniqueTextLines.length > 0) {
            text += `\n【${getPhaseLabel(currentPhaseId)}固有ダイス】\n`;
            text += uniqueTextLines.join('\n');
        }

        // Bundle-8-T4 / CR-SA-4 / 2026-05-10: 終盤【絆スキル】セクション自動生成（scene3-race.md §2）
        const bondSection = getBondSkillSection(
            sortedParticipants,
            currentPhaseId,
            config.houseRules,
            lastEndPhaseId,
        );
        if (bondSection) {
            // 通常ダイス末尾には改行が残り、固有ダイスありの場合は join で末尾改行なし。
            // 仕様 §2 + ワイヤフレーム整合: 既存セクションとの間に空行 1 行を挟む。
            const separator = uniqueTextLines.length > 0 ? '\n\n' : '\n';
            text += `${separator}${bondSection}`;
        }

        return text;
    })();

    const handleCopy = () => {
        navigator.clipboard.writeText(displayText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold">
                    <Dices className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3>[1] 投稿用ダイス出力</h3>
                    {correctionCount > 0 && correctionCount < participants.length && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                            未完了/要修正: {correctionCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Correction Mode */}
                    <button
                        onClick={() => setFilterCorrection(!filterCorrection)}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            filterCorrection
                                ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                        )}
                        title="未実施または設定変更により修正が必要なダイスのみを表示します"
                    >
                        {filterCorrection ? '修正分のみ表示中' : '修正分のみ表示'}
                    </button>

                    <button
                        onClick={handleCopy}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            copied
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                        )}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'コピー完了' : 'クリップボードにコピー'}
                    </button>
                </div>
            </div>

            <div className="p-0">
                <textarea
                    readOnly
                    value={displayText}
                    className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-900 text-sm font-mono text-gray-800 dark:text-gray-200 resize-none focus:outline-none"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
            </div>

            <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 text-xs text-yellow-700 dark:text-yellow-400 border-t border-yellow-100 dark:border-yellow-900/30">
                Next: 枠順通りにソートされています。これを掲示板に投稿してください。
            </div>
        </div>
    );
};
