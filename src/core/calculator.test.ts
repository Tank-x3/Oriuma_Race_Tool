import { describe, it, expect } from 'vitest';
import { Calculator } from './calculator';
import { DEFAULT_STRATEGIES } from './strategies';
import type { Umamusume } from '../types';

describe('Calculator', () => {
    const mockUma: Umamusume = {
        id: '1',
        entryIndex: 1,
        name: 'Teio',
        strategy: '先行',
        uniqueSkill: { type: 'Stability', phases: ['Start'] },
        gate: 1,
        score: 0,
        history: {}
    };

    it('calculates Start phase score correctly', () => {
        // Strategy: 先行 (Fix 10)
        // Rolling 3d5 -> Assume dice sum is 10
        const startDice = { diceStr: '3d5', values: [3, 4, 3], sum: 10, isNegative: false };

        // Create a deep copy to modify
        const uma = {
            ...mockUma, history: {
                'Start': { baseDice: startDice, computedScore: 0 }
            }
        };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
        // 10 (Fix) + 10 (Dice) = 20
        expect(score).toBe(20);
    });

    it('applies Pace modifier correctly for Mid phase', () => {
        // Strategy: 先行 (Fix 10)
        // Pace 1 (Do-Slow) -> 先行 gets +5
        const startDice = { diceStr: '3d5', values: [3, 4, 3], sum: 10 }; // Fix 10 + 10 = 20
        const midDice = { diceStr: '3d5', values: [2, 2, 2], sum: 6 };

        const uma = {
            ...mockUma, history: {
                'Start': { baseDice: startDice, computedScore: 20 },
                'Mid': { baseDice: midDice, computedScore: 0 }
            }
        };

        // Calculate score with Pace roll 1
        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, 1);
        // Start: 20
        // Pace Mod: +5
        // Mid: +6
        // Total: 31
        expect(score).toBe(31);
    });

    it('handles negative dice logic (Oonige End)', () => {
        // Strategy: 大逃げ (Fix 30)
        // Pace: 5 (Middle) -> +0

        // Mock Oonige
        const oonige: Umamusume = {
            ...mockUma,
            strategy: '大逃げ',
            name: 'Suzuka'
        };

        const startDice = { diceStr: '3d8', values: [1, 1, 1], sum: 3 }; // Fix 30 + 3 = 33
        // End dice: -1d27. If result is 15, logic says negative value.
        // Dice.roll('-1d27') would return sum -15, isNegative true.
        const endDice = { diceStr: '-1d27', values: [15], sum: -15, isNegative: true };

        const history = {
            'Start': { baseDice: startDice, computedScore: 33 },
            'End': { baseDice: endDice, computedScore: 0 }
        };
        const uma = { ...oonige, history };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, 5);
        // Start: 33
        // Pace: +0
        // End: -15
        // Total: 18
        expect(score).toBe(18);
    });

    it('adds Unique Skill bonus if activated', () => {
        // 先行 (Fix 10)
        // Unique: Stability (5 + 1d10)
        // Activated in Start

        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 }; // 8 rolled
        // Logic: Stability gets +5 fix + dice sum.

        const uma: Umamusume = {
            ...mockUma,
            history: {
                'Start': {
                    baseDice: startDice,
                    uniqueDice: uniqueDice,
                    computedScore: 0
                }
            }
        };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
        // Fix 10 + Dice 9 = 19
        // Unique: 5 (Stab Fix) + 8 (Dice) = 13
        // Total: 32
        expect(score).toBe(32);
    });
});
