import type { Umamusume, Strategy } from '../types';
import { getPaceModifier, getStrategy } from './strategies';

/**
 * 現在の中盤回数設定からアクティブなフェーズ ID 集合を導出する。
 * Scene 1 の #1-3a-9（Soft Delete）で、history 上には残っていても
 * 「現在設定されているフェーズ」のみを合算対象とするために使用する。
 * Start / End は常にアクティブ。Pace は history に入らないためここでは扱わない。
 */
export const getActivePhaseIds = (midPhaseCount: number): string[] => {
    const ids: string[] = ['Start'];
    if (midPhaseCount === 1) {
        ids.push('Mid');
    } else if (midPhaseCount > 1) {
        for (let i = 1; i <= midPhaseCount; i++) {
            ids.push(`Mid${i}`);
        }
    }
    ids.push('End');
    return ids;
};

export class Calculator {
    /**
     * Calculates the total score for a participant based on their history and current race state.
     * activePhaseIds を渡すと、history 上に残っているが現在のフェーズ設定外となっている
     * データ（Soft Delete 対象）を合算対象から除外する。未指定なら従来どおり全走査。
     */
    static calculateTotalScore(
        participant: Umamusume,
        strategies: Strategy[],
        paceRoll: number | null,
        activePhaseIds?: readonly string[]
    ): number {
        const activeSet = activePhaseIds ? new Set(activePhaseIds) : null;
        let total = 0;
        const strategy = getStrategy(participant.strategy, strategies);

        if (!strategy) {
            // Should handle error or return 0? For now 0 if strategy invalid.
            return 0;
        }

        // Sort phases by order logic if needed, but usually we iterate over known keys or race config.
        // However, the participant history is a Record.
        // We should strictly follow the standard phase order: Start -> Pace -> Mid... -> End.
        // But Pace is not in history as a scoring phase for participant. It's global.
        // Start Phase
        const startData = participant.history['Start'];
        if (startData) {
            // Base (Fix) + Dice + Modifier
            // For Start phase, "Base Value" in Requirement is "Strategy Fix Value".
            // But in the "dice output" formula it says "30+dice3d8=".
            // So score += FixValue + DiceSum + ManualModifier.
            total += strategy.fixValue;

            if (startData.baseDice) {
                total += startData.baseDice.sum;
            }
            if (startData.manualModifier) {
                total += startData.manualModifier;
            }
            // Unique skill in Start? Allowed if configured.
            if (startData.uniqueDice && participant.uniqueSkill.phases.includes('Start')) {
                const skillType = participant.uniqueSkill.type;
                if (skillType === 'Stability') total += 5;
                total += startData.uniqueDice.sum;
            }
        }

        // Mid Phases
        // We need to know which phases are "Valid" (Active).
        // Assuming the caller only passes valid history or we filter.
        // Mid/End phases benefit from Pace Modifier if Pace has happened.
        // Pace happens after Start. So Mid and End get it.

        // Iterate other keys
        Object.keys(participant.history).forEach(phaseId => {
            if (phaseId === 'Start') return; // Already handled

            // Soft Delete（#1-3a-9）: 現在のフェーズ設定外となっているフェーズは合算除外。
            if (activeSet && !activeSet.has(phaseId)) return;

            const data = participant.history[phaseId];

            // Add Dice
            if (data.baseDice) {
                total += data.baseDice.sum;
            }
            // Add Unique (フェーズ制限チェック)
            if (data.uniqueDice && participant.uniqueSkill.phases.includes(phaseId)) {
                const skillType = participant.uniqueSkill.type;
                if (skillType === 'Stability') total += 5;
                total += data.uniqueDice.sum;
            }
            // Add Manual Modifier
            if (data.manualModifier) {
                total += data.manualModifier;
            }

            // Add Pace Modifier calculation
            // Requirement: "Applied to cumulative score... before dice output text generation".
            // Requirement: "Fixed value added to score... in phases after Pace".
            // So checking if this phase is after Pace.
            // Start is before Pace. Mid/End are after.
            // So if phaseId is NOT Start, we add Pace Modifier ONCE per phase?
            // Wait, "Apply to cumulative score... immediately add".
            // "Mid Dice Output: Base Value + ..." where Base Value includes Pace Modifier.
            // Does Pace Modifier apply *every turn*?
            // Requirement: "Pace Modifier... added to score... fixed value".
            // Table says "Modifier".
            // Usually, Pace Modifier is a one-time adjustment or per-turn adjustment?
            // "Pace Phase ... immediately add to cumulative score".
            // "Next phase... use this calculated value as base".
            // It seems it is a ONE-TIME addition when Pace Phase is resolved.
            // But we don't have a "Pace Phase" entry in participant history.
            // So we should add it ONCE to the total score if Pace has occurred.
            // OR, does it apply to every Mid/End phase check?
            // "Pace Modifier... added to score... (Mid onwards)".
            // "This correction value is merged into cumulative score".
            // Suggests it's added ONCE.

            // IMPORTANT: The Requirement says "Immediately add... to cumulative score".
            // And "Result... uses this calculated value as base".
            // So it's a one-time change to the score.
            // Where to include it?
            // If we calculate total from scratch, we should add Pace Modifier once if `paceRoll` is present.
            // But when?
            // If we are in Start phase, we don't add it.
            // If we are past Pace phase, we add it.
            // Since `calculateTotalScore` calculates the CURRENT score,
            // if `paceRoll` is not null, it means Pace phase has finished (or we are in it).
            // If strictly following phase order:
            // If we have any history entry that is NOT 'Start', it implies we are at least in Mid or End?
            // No, we could be in Pace phase.
            // Use `currentPhaseId` to determine?
            // The function `calculateTotalScore` builds from history.
            // If `paceRoll` is provided, we assume we should add it.
            // BUT, we should only add it if the race has progressed past Pace.
            // Since Pace handles the add, it effectively becomes part of the score permanently.
            // So `total += paceModifier` if `paceRoll` exists.
            // Let's assume `paceRoll` is passed ONLY if it has been determined.

        });

        // Add Pace Modifier if it exists.
        // It should be added only ONCE to the total score.
        // And only if we are past the point where it applies?
        // Actually, if paceRoll is set, it affects the score.
        // "Start" phase score is not affected.
        // "Mid" phase base is (Start + PaceMod).
        // So if we have entered Mid phase, PaceMod is in.
        // If we are just at Pace phase, PaceMod is calculated but maybe not yet in "Total" until transition?
        // Requirement 1-382: "Apply... at the moment of transition... to Next Phase".
        // So if we are IN Pace Phase, score is `Start`.
        // If we are IN Mid Phase, score involves `PaceMod`.
        // But `calculateTotalScore` is usually used to display "Current Score".
        // If we are in Mid Phase, we want Total = Start + PaceMod + MidDice...
        // The `paceRoll` argument should probably be the *applied* pace roll.
        // If the caller passes `paceRoll`, we add the modifier.
        // We need to calculate the modifier value from strategy.

        if (paceRoll !== null) {
            const mod = getPaceModifier(participant.strategy, paceRoll);
            total += mod;
        }

        return total;
    }
}
