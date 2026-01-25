import React, { useState } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import { Copy, Check, Dices } from 'lucide-react';
import { clsx } from 'clsx';

export const PhaseOutput: React.FC = () => {
    const {
        participants,
        strategies,
        currentPhaseId,
        paceResult
    } = useRaceStore();
    const { getPhaseLabel } = useRaceEngine();
    const [copied, setCopied] = useState(false);

    // Sort participants by Gate Number (Scene 2 verified)
    // If gate is null, fallback to index (should be set in Scene 2)
    const sortedParticipants = [...participants].sort((a, b) => {
        if (a.gate !== null && b.gate !== null) return a.gate - b.gate;
        return 0; // Should not happen in Scene 3
    });

    // Helper: Get Base Value for Phase
    const getBaseValue = (p: typeof participants[0]) => {
        if (currentPhaseId === 'Start') {
            const strategy = strategies.find(s => s.name === p.strategy);
            return strategy?.fixValue ?? 0;
        }
        // Mid/End: Current Score
        // Note: Logic says "Previous Phase Result" but essentially current score before this phase dice.
        // If Pace Phase executed, score might include pace mod? 
        // Logic: "Pace Modifier ... is applied to Base Value straight away". 
        // So p.score is correct if we updated it after Pace.
        return p.score;
    };

    // Helper: Get Dice Formula
    const getDiceFormula = (strategyName: string) => {
        const strategy = strategies.find(s => s.name === strategyName);
        if (!strategy) return 'dice0d0'; // Error case

        if (currentPhaseId === 'Start') return strategy.dice.start;
        if (currentPhaseId.startsWith('Mid')) return strategy.dice.mid; // Mid1, Mid2... use same
        if (currentPhaseId === 'End') {
            // Special case for 'Big Escape' (大逃げ) or negative dice
            // Logic says: "Use negative value directly"
            // If the string starts with '-', handle it in formatting?
            // "O-Nige" End dice is "-1d27".
            return strategy.dice.end;
        }
        return 'dice0d0';
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
            let expectedUnique = "";
            if (p.uniqueSkill.type === 'Stability') expectedUnique = "1d10";
            if (p.uniqueSkill.type === 'Gamble') expectedUnique = "1d20";
            if (p.uniqueSkill.type === 'Persistent') expectedUnique = "1d10";

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
            const base = getBaseValue(p);
            const dice = getDiceFormula(p.strategy);

            // Output Base Dice ONLY if:
            // 1. Not filtering (Show All)
            // 2. OR Filtering AND Base needs cleaning (Missing or Mismatch)
            // Note: If "Missing" (new entry), status.missing is true, causing status.base=true usually.
            if (!filterCorrection || status.base) {
                let formula = "";
                if (dice.startsWith('-')) {
                    const positiveDice = dice.substring(1);
                    formula = `${base}-dice${positiveDice}=`;
                } else {
                    formula = `${base}+dice${dice}=`;
                }
                text += `${gateSym} ${p.name}　${formula}\n`;
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
                    let uDice = "";
                    const uType = p.uniqueSkill.type;
                    if (uType === 'Stability') uDice = `5+dice1d10=`;
                    if (uType === 'Gamble') uDice = `dice1d20=`;
                    if (uType === 'Persistent') uDice = `dice1d10=`;

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
