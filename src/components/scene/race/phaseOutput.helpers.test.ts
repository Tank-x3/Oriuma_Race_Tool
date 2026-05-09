import { describe, it, expect } from 'vitest';
import { getUniqueDiceFormula, getExpectedUniqueDiceStr } from './phaseOutput.helpers';

describe('phaseOutput.helpers - Bundle-2 / D-1, D-14 / 2026-05-09', () => {
    describe('getUniqueDiceFormula', () => {
        it('returns "5+dice1d10=" for Stability', () => {
            expect(getUniqueDiceFormula('Stability')).toBe('5+dice1d10=');
        });

        it('returns "dice1d20=" for Gamble', () => {
            expect(getUniqueDiceFormula('Gamble')).toBe('dice1d20=');
        });

        it('returns "dice1d10=" for Persistent', () => {
            expect(getUniqueDiceFormula('Persistent')).toBe('dice1d10=');
        });

        // Bundle-2 必須テスト (iii): 超ギャンブル選択者の固有ダイス行に -10+dice1d35= が含まれる
        it('returns "-10+dice1d35=" for SuperGamble (Bundle-2)', () => {
            expect(getUniqueDiceFormula('SuperGamble')).toBe('-10+dice1d35=');
        });

        // Bundle-2 必須テスト (iv): 超安定選択者の固有ダイス行に 8+dice1d3= が含まれる
        it('returns "8+dice1d3=" for SuperStability (Bundle-2)', () => {
            expect(getUniqueDiceFormula('SuperStability')).toBe('8+dice1d3=');
        });
    });

    describe('getExpectedUniqueDiceStr', () => {
        it('returns "1d10" for Stability', () => {
            expect(getExpectedUniqueDiceStr('Stability')).toBe('1d10');
        });

        it('returns "1d20" for Gamble', () => {
            expect(getExpectedUniqueDiceStr('Gamble')).toBe('1d20');
        });

        it('returns "1d10" for Persistent', () => {
            expect(getExpectedUniqueDiceStr('Persistent')).toBe('1d10');
        });

        it('returns "1d35" for SuperGamble (Bundle-2)', () => {
            expect(getExpectedUniqueDiceStr('SuperGamble')).toBe('1d35');
        });

        it('returns "1d3" for SuperStability (Bundle-2)', () => {
            expect(getExpectedUniqueDiceStr('SuperStability')).toBe('1d3');
        });
    });
});
