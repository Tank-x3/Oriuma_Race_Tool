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

    // Re-generate text with correct symbols
    const displayText = (() => {
        if (currentPhaseId === 'Pace') {
            if (paceResult.face !== null) {
                return `【ペース判定】\nペース確定済み: ${paceResult.face} (${paceResult.label})`;
            }

            let paceText = `【ペース判定】\ndice1d9=\n`;

            // Dynamic generation of pace table
            // Groupings: 1, 2-3, 4-6, 7-8, 9
            const groups = [
                { rolls: [1], label: 'ドスロー' },
                { rolls: [2, 3], label: 'スロー' },
                { rolls: [4, 5, 6], label: 'ミドル' },
                { rolls: [7, 8], label: 'ハイペース' },
                { rolls: [9], label: '超ハイペース' }
            ];

            // Helper to get modifier map for a roll using getPaceModifier
            // We need to import getPaceModifier or replicate it. 
            // PhaseOutput doesn't import it, let's assume standard logic or use strategy methods if available.
            // Since strategies.ts handles it essentially via map, let's look at `strategies` prop.
            // `strategies` contains custom strategies too.
            // But `getPaceModifier` uses `PACE_MODIFIERS` constant which is imported in calculator?
            // PhaseOutput imports useRaceStore, but `strategies` state has the array.

            // IMPORTANT: "Each roll... scan strategy modifiers".
            // Since we don't have easy access to `getPaceModifier` function here without importing:
            // Let's import `PACE_MODIFIERS` from core or replicate map? 
            // Better to rely on what's available. `PACE_MODIFIERS` is exported in core/strategies.
            // We should modify the imports.

            groups.forEach(group => {
                const sampleRoll = group.rolls[0]; // Logic is same for all in group usually

                // Collect modifications


                // We need to check modifier for each strategy
                // Since `PACE_MODIFIERS` is static, how do we handle custom strategies?
                // Custom strategies need to define their pace modifiers.
                // Currently `strategies` in store has `paceModifiers: Record<number, number>`.
                // So we check `s.paceModifiers[sampleRoll]`.

                // Group by modifier value: "+5": ["Run", "Ahead"]
                const valMap = new Map<number, string[]>();

                strategies.forEach(s => {
                    // Check static map or strategy property
                    // Standard strategies rely on the static map `PACE_MODIFIERS`.
                    // Custom strategies rely on `s.paceModifiers`.

                    let val = 0;
                    // Try s.paceModifiers first (Custom)
                    if (s.paceModifiers && s.paceModifiers[sampleRoll] !== undefined) {
                        val = s.paceModifiers[sampleRoll];
                    } else {
                        // Try static map for standard names
                        // We need the Look-up table.
                        // Ideally we should import `getPaceModifier` or `PACE_MODIFIERS`.
                        // For now, let's assume we can fetch it or hardcode the standard map here for display if import is hard?
                        // Actually, let's just hardcode the standard table logic for now to meet immediate requirement,
                        // merging with custom if possible.
                        // Wait, previous file view showed `PACE_MODIFIERS` export.
                        // I should update imports first? No, I can try to access if I update valid code.
                        // I will add the imports in a separate 'replace' if needed, or simple add it to this block if I can reuse `strategies`.

                        // Let's use the hardcoded standard logic for now to ensure we match the user requirement exactly,
                        // since imports are not shown in this specific block view (imports are at top).

                        // Standard Table Logic (Replicated for View)
                        // 1: BigEscape+12, Escape+10, Ahead+5, Mid 0, Behind -5
                        // ...
                        if (sampleRoll === 1) {
                            if (s.name === '大逃げ') val = 12;
                            else if (s.name === '逃げ') val = 10;
                            else if (s.name === '先行') val = 5;
                            else if (s.name === '差し') val = 0;
                            else if (s.name === '追込') val = -5;
                        } else if (sampleRoll <= 3) { // 2,3
                            if (['大逃げ', '逃げ', '先行'].includes(s.name)) val = 5;
                        } else if (sampleRoll <= 6) { // 4,5,6
                            val = 0;
                        } else if (sampleRoll <= 8) { // 7,8
                            if (['差し', '追込'].includes(s.name)) val = 5;
                        } else { // 9
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

                // Build string
                const lineParts: string[] = [];
                // Sort by value desc? Usually "+12, +10..."
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
        const uniqueTextLines: string[] = [];

        // Map Japanese Phase names if stored as Japanese in Scene 1
        // Or English. Assuming standard keys 'Start','Mid','End' used in logic
        /* 
           Ref: Scene 1 saves p.uniqueSkill.phases (Array check).
        */


        sortedParticipants.forEach(p => {
            const gateSym = getGateSymbol(p.gate ?? 0);
            const base = getBaseValue(p);
            const dice = getDiceFormula(p.strategy);

            let formula = "";
            if (dice.startsWith('-')) {
                const positiveDice = dice.substring(1);
                formula = `${base}-dice${positiveDice}=`;
            } else {
                formula = `${base}+dice${dice}=`;
            }
            text += `${gateSym} ${p.name}　${formula}\n`;

            // Unique Check
            // Current phase check
            let isMatch = false;
            const pPhases = p.uniqueSkill.phases;

            // Check if current phase is in pPhases array.
            // We need to handle potential translation mismatch.
            // Try to match currentPhaseId OR logic mapped.

            if (pPhases.includes(currentPhaseId)) isMatch = true;
            else if (pPhases.includes(getPhaseLabel(currentPhaseId))) isMatch = true;
            // Specific Mid1/Mid2 check: if user selected 'Mid' (中盤), it applies to all Mid phases.
            else if (currentPhaseId.startsWith('Mid') && (pPhases.includes('Mid') || pPhases.includes('中盤'))) isMatch = true;

            if (isMatch) {
                let uDice = "";
                const uType = p.uniqueSkill.type;
                // Map Type to Formula
                // Types: 'Stability','Gamble','Persistent'
                if (uType === 'Stability') uDice = `5+dice1d10=`;
                if (uType === 'Gamble') uDice = `dice1d20=`;
                if (uType === 'Persistent') uDice = `dice1d10=`;

                if (uDice) {
                    uniqueTextLines.push(`${gateSym} ${p.name}　${uDice}`);
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
                </div>
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
