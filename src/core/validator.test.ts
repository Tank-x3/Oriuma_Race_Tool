import { describe, it, expect } from 'vitest';
import {
    Validator,
    validatePersistentSkillPhases,
    validateBondSkillType,
    validateSpecialStrategyPhase,
    validateSpecialStrategyTypeAndPhase,
} from './validator';

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

// Bundle-8-T2 / CR-SA-4 / 2026-05-10: 絆スキル種別バリデーション
// scene1-setup.md §2 + houserule-features.md §2 [v] 絆スキル SSoT 準拠
describe('validateBondSkillType - Bundle-8-T2', () => {
    it('returns no error for "BondGamble"', () => {
        expect(validateBondSkillType('BondGamble')).toEqual([]);
    });

    it('returns no error for "BondStable"', () => {
        expect(validateBondSkillType('BondStable')).toEqual([]);
    });

    it('returns no error for null (未獲得)', () => {
        expect(validateBondSkillType(null)).toEqual([]);
    });

    it('returns no error for undefined (フィールド未設定)', () => {
        expect(validateBondSkillType(undefined)).toEqual([]);
    });

    it('returns error for invalid string value', () => {
        // @ts-expect-error 不正値テスト
        expect(validateBondSkillType('InvalidValue')).toEqual(['絆スキル種別の値が不正です']);
    });
});

// Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法発動位置バリデーション
// scene1-setup.md §2 + houserule-features.md §3 §捲り 前 cross-reference SSoT 準拠（'End' 除外）
describe('validateSpecialStrategyPhase - Bundle-8-T2', () => {
    const phaseError = '特殊戦法の発動位置が不正です（終盤・現在の中盤回数外は選択不可）';

    it('returns no error for "Start" (midPhaseCount = 2)', () => {
        expect(validateSpecialStrategyPhase('Start', 2)).toEqual([]);
    });

    it('returns no error for "Mid1" (midPhaseCount = 2)', () => {
        expect(validateSpecialStrategyPhase('Mid1', 2)).toEqual([]);
    });

    it('returns no error for "Mid2" (midPhaseCount = 2)', () => {
        expect(validateSpecialStrategyPhase('Mid2', 2)).toEqual([]);
    });

    it('returns error for "Mid3" (midPhaseCount = 2、範囲外)', () => {
        expect(validateSpecialStrategyPhase('Mid3', 2)).toEqual([phaseError]);
    });

    it('returns error for "End" (除外、終盤発動禁止)', () => {
        expect(validateSpecialStrategyPhase('End', 2)).toEqual([phaseError]);
    });

    it('returns no error for null (未設定)', () => {
        expect(validateSpecialStrategyPhase(null, 2)).toEqual([]);
    });

    it('returns no error for "Mid" when midPhaseCount = 1 (単一中盤)', () => {
        expect(validateSpecialStrategyPhase('Mid', 1)).toEqual([]);
    });

    it('returns error for "Mid1" when midPhaseCount = 1 (Mid1 は不在)', () => {
        expect(validateSpecialStrategyPhase('Mid1', 1)).toEqual([phaseError]);
    });

    it('returns no error for "Mid4" when midPhaseCount = 4 (上限値)', () => {
        expect(validateSpecialStrategyPhase('Mid4', 4)).toEqual([]);
    });

    it('returns error for "Mid5" when midPhaseCount = 4 (上限超)', () => {
        expect(validateSpecialStrategyPhase('Mid5', 4)).toEqual([phaseError]);
    });
});

// Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 種別 + 発動位置セット必須性
// scene1-setup.md §2「種別と発動位置はセット入力が必須」SSoT
describe('validateSpecialStrategyTypeAndPhase - Bundle-8-T2', () => {
    const typeMissingError = '発動位置を選択した場合、特殊戦法種別の指定が必須です';
    const phaseMissingError = '特殊戦法を選択した場合、発動位置の指定が必須です';

    it('returns no error when both null (両方未設定)', () => {
        expect(validateSpecialStrategyTypeAndPhase(null, null)).toEqual([]);
    });

    it('returns no error when both undefined', () => {
        expect(validateSpecialStrategyTypeAndPhase(undefined, undefined)).toEqual([]);
    });

    it('returns no error for type=Makuri + phase=Mid1', () => {
        expect(validateSpecialStrategyTypeAndPhase('Makuri', 'Mid1')).toEqual([]);
    });

    it('returns no error for type=Tame + phase=Start', () => {
        expect(validateSpecialStrategyTypeAndPhase('Tame', 'Start')).toEqual([]);
    });

    it('returns error for type=Makuri + phase=null (発動位置未設定)', () => {
        expect(validateSpecialStrategyTypeAndPhase('Makuri', null)).toEqual([phaseMissingError]);
    });

    it('returns error for type=null + phase=Mid1 (種別未設定)', () => {
        expect(validateSpecialStrategyTypeAndPhase(null, 'Mid1')).toEqual([typeMissingError]);
    });
});
