import { describe, it, expect } from 'vitest';
import { Validator, validatePersistentSkillPhases } from './validator';

describe('Validator', () => {
    describe('validateLineCount', () => {
        it('returns valid true when counts match', () => {
            const text = 'line1\nline2\nline3';
            const result = Validator.validateLineCount(text, 3);
            expect(result.valid).toBe(true);
            expect(result.actual).toBe(3);
        });

        it('ignores empty lines', () => {
            const text = 'line1\n\nline2';
            const result = Validator.validateLineCount(text, 2);
            expect(result.valid).toBe(true);
        });

        it('returns valid false when counts mismatch', () => {
            const text = 'line1';
            const result = Validator.validateLineCount(text, 2);
            expect(result.valid).toBe(false);
            expect(result.actual).toBe(1);
        });
    });

    describe('validateChecksum', () => {
        it('returns true if equal', () => {
            expect(Validator.validateChecksum(10, 10)).toBe(true);
        });

        it('returns false if unequal', () => {
            expect(Validator.validateChecksum(10, 11)).toBe(false);
        });
    });

    describe('validateDiceFormat', () => {
        it('validates correct dice', () => {
            expect(Validator.validateDiceFormat('3d6')).toBe(true);
        });

        it('invalidates broken dice', () => {
            expect(Validator.validateDiceFormat('0d6')).toBe(false); // Dice count > 0 check
            expect(Validator.validateDiceFormat('3d0')).toBe(false);
            expect(Validator.validateDiceFormat('invalid')).toBe(false);
        });
    });
});

// Bundle-3 / D-4 / 2026-05-09: 持続型「連続 2 フェーズ」検証
// validation-responsibilities.md §4 D-4 SA 確定仕様準拠
describe('validatePersistentSkillPhases - Bundle-3 / D-4 / 2026-05-09', () => {
    const expectedError = '持続型の発動位置は連続する 2 フェーズを選択してください';

    // (i) midPhaseCount=2、phases ['Start', 'Mid1'] → エラーなし（連続）
    it('returns no error for [Start, Mid1] when midPhaseCount=2 (連続)', () => {
        expect(validatePersistentSkillPhases(['Start', 'Mid1'], 2)).toEqual([]);
    });

    // (ii) midPhaseCount=2、phases ['Mid1', 'Mid2'] → エラーなし（連続）
    it('returns no error for [Mid1, Mid2] when midPhaseCount=2 (連続)', () => {
        expect(validatePersistentSkillPhases(['Mid1', 'Mid2'], 2)).toEqual([]);
    });

    // (iii) midPhaseCount=2、phases ['Mid2', 'End'] → エラーなし（連続）
    it('returns no error for [Mid2, End] when midPhaseCount=2 (連続)', () => {
        expect(validatePersistentSkillPhases(['Mid2', 'End'], 2)).toEqual([]);
    });

    // (iv) midPhaseCount=2、phases ['Start', 'Mid2'] → エラー（非連続）
    it('returns error for [Start, Mid2] when midPhaseCount=2 (非連続)', () => {
        expect(validatePersistentSkillPhases(['Start', 'Mid2'], 2)).toEqual([expectedError]);
    });

    // (v) midPhaseCount=2、phases ['Start', 'End'] → エラー（非連続、間に Mid1/Mid2 がある）
    it('returns error for [Start, End] when midPhaseCount=2 (非連続)', () => {
        expect(validatePersistentSkillPhases(['Start', 'End'], 2)).toEqual([expectedError]);
    });

    // (vi) midPhaseCount=2、phases ['Start'] → エラー（選択数 1）
    it('returns error for single phase selection (選択数 1)', () => {
        expect(validatePersistentSkillPhases(['Start'], 2)).toEqual([expectedError]);
    });

    // (vii) midPhaseCount=2、phases ['Start', 'Mid1', 'Mid2'] → エラー（選択数 3）
    it('returns error for 3-phase selection (選択数 3)', () => {
        expect(validatePersistentSkillPhases(['Start', 'Mid1', 'Mid2'], 2)).toEqual([expectedError]);
    });

    // (viii, 推奨) midPhaseCount=0、phases ['Start', 'End'] → エラーなし（実例ゼロだが UI 上選択可能、Start+End 連続扱い）
    it('returns no error for [Start, End] when midPhaseCount=0 (Start+End 隣接)', () => {
        expect(validatePersistentSkillPhases(['Start', 'End'], 0)).toEqual([]);
    });

    // (ix, 推奨) midPhaseCount=1、phases ['Start', 'Mid'] → エラーなし
    it('returns no error for [Start, Mid] when midPhaseCount=1', () => {
        expect(validatePersistentSkillPhases(['Start', 'Mid'], 1)).toEqual([]);
    });

    // (x, 推奨) midPhaseCount=3、phases ['Mid2', 'Mid3'] → エラーなし
    it('returns no error for [Mid2, Mid3] when midPhaseCount=3', () => {
        expect(validatePersistentSkillPhases(['Mid2', 'Mid3'], 3)).toEqual([]);
    });

    // 追加 regression guard: phases.length === 0 は Layer 1 委譲でスキップ
    it('returns no error for empty phases (Layer 1 委譲)', () => {
        expect(validatePersistentSkillPhases([], 2)).toEqual([]);
    });

    // 追加 regression guard: midPhaseCount=1 で [Start, End] は非連続（中盤を間に挟む）
    it('returns error for [Start, End] when midPhaseCount=1 (非連続、間に Mid)', () => {
        expect(validatePersistentSkillPhases(['Start', 'End'], 1)).toEqual([expectedError]);
    });
});
