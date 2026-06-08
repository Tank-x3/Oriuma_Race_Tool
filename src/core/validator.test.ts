import { describe, it, expect } from 'vitest';
import {
    Validator,
    validatePersistentSkillPhases,
    validateBondSkillType,
    validateSpecialStrategyPhase,
    validateSpecialStrategyTypeAndPhase,
    validateStrategyName,
    validateDiceFormat,
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

    // CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数連動の連続性判定（houserule-features.md §7.7）。
    it('序盤2 連動で [Start1, Start2] は連続 = エラーなし', () => {
        // 非ペース列 = [Start1, Start2, Mid, End]、Start1↔Start2 は隣接
        expect(validatePersistentSkillPhases(['Start1', 'Start2'], 1, 2, 1)).toEqual([]);
    });

    it('序盤2 連動で [Start2, Mid] は連続 = エラーなし', () => {
        expect(validatePersistentSkillPhases(['Start2', 'Mid'], 1, 2, 1)).toEqual([]);
    });

    it('序盤2 連動で [Start1, Mid] は非連続 = エラー（間に Start2）', () => {
        expect(validatePersistentSkillPhases(['Start1', 'Mid'], 1, 2, 1)).toEqual([expectedError]);
    });

    it('終盤2 連動で [End1, End2] は連続 = エラーなし', () => {
        expect(validatePersistentSkillPhases(['End1', 'End2'], 1, 1, 2)).toEqual([]);
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

    // CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数連動の一般化（houserule-features.md §7.7）。
    it('序盤2 連動で "Start1" / "Start2" は有効', () => {
        expect(validateSpecialStrategyPhase('Start1', 1, 2, 1)).toEqual([]);
        expect(validateSpecialStrategyPhase('Start2', 1, 2, 1)).toEqual([]);
    });

    it('序盤2 のとき単一 "Start" は無効（命名規則 §7.3）', () => {
        expect(validateSpecialStrategyPhase('Start', 1, 2, 1)).toEqual([phaseError]);
    });

    it('終盤回数を増やしても終盤（End1〜）は無効（終盤発動禁止維持）', () => {
        expect(validateSpecialStrategyPhase('End1', 1, 1, 2)).toEqual([phaseError]);
        expect(validateSpecialStrategyPhase('End2', 1, 1, 2)).toEqual([phaseError]);
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

// Bundle-10-T3 / CR-SA-12 / 2026-05-11: 脚質エディタ Validation 統合
// modal-houserule.md §Critical Errors + houserule-features.md §1 Validation SSoT 準拠
describe('validateStrategyName - Bundle-10-T3', () => {
    const existing = ['大逃げ', '逃げ', '先行', '差し', '追込'];

    // (1) 重複なし + 新規名前 → []
    it('returns no error for new unique name (新規追加モード)', () => {
        expect(validateStrategyName('カスタム脚質X', existing)).toEqual([]);
    });

    // (2) 重複あり + 新規追加モード → エラー
    it('returns error for duplicate name (新規追加モード)', () => {
        expect(validateStrategyName('逃げ', existing)).toEqual([
            "脚質名 '逃げ' は既に使用されています。別の名前を指定してください。",
        ]);
    });

    // (3) 重複あり + 編集モード + editingName === name (自分自身) → []
    it('returns no error when editing self (editingName === name)', () => {
        expect(validateStrategyName('逃げ', existing, '逃げ')).toEqual([]);
    });

    // (4) 重複あり + 編集モード + editingName !== name (別名重複) → エラー
    it('returns error when editing changes to existing other name', () => {
        expect(validateStrategyName('逃げ', existing, 'カスタム脚質Y')).toEqual([
            "脚質名 '逃げ' は既に使用されています。別の名前を指定してください。",
        ]);
    });

    // (5) 空文字 → エラー
    it('returns error for empty string', () => {
        expect(validateStrategyName('', existing)).toEqual(['脚質名を入力してください。']);
    });

    // (6) 空白のみ (trim 後空) → エラー
    it('returns error for whitespace-only input', () => {
        expect(validateStrategyName('   ', existing)).toEqual(['脚質名を入力してください。']);
    });

    // (7) エラー文言 = 仕様 SSoT 通り (重複時)
    it('matches spec SSoT error message verbatim (重複時)', () => {
        expect(validateStrategyName('差し', existing)).toEqual([
            "脚質名 '差し' は既に使用されています。別の名前を指定してください。",
        ]);
    });
});

describe('validateDiceFormat - Bundle-10-T3', () => {
    // (8) '3d6' 形式 → []
    it('returns no error for standard XdY (3d6)', () => {
        expect(validateDiceFormat('3d6')).toEqual([]);
    });

    // (9) '-1d27' 形式 (DEFAULT 大逃げ既存値) → [] (推奨形 (b) 負号許容)
    it('returns no error for negative XdY (-1d27、DEFAULT 大逃げ既存値整合)', () => {
        expect(validateDiceFormat('-1d27')).toEqual([]);
    });

    // (10) '3+6' (加算式) → エラー
    it('returns error for additive expression (3+6)', () => {
        expect(validateDiceFormat('3+6')).toEqual([
            "ダイス式は '3d6' の形式で入力してください",
        ]);
    });

    // (11) 'dice3d6' (接頭辞付き) → エラー
    it('returns error for prefixed format (dice3d6)', () => {
        expect(validateDiceFormat('dice3d6')).toEqual([
            "ダイス式は '3d6' の形式で入力してください",
        ]);
    });

    // (12) 空文字 → エラー
    it('returns error for empty string', () => {
        expect(validateDiceFormat('')).toEqual([
            "ダイス式は '3d6' の形式で入力してください",
        ]);
    });

    // (13) 'abc' → エラー
    it('returns error for non-dice string (abc)', () => {
        expect(validateDiceFormat('abc')).toEqual([
            "ダイス式は '3d6' の形式で入力してください",
        ]);
    });

    // (14) エラー文言 = 仕様 SSoT 通り
    it('matches spec SSoT error message verbatim (不正なダイス形式)', () => {
        expect(validateDiceFormat('3d6+1')).toEqual([
            "ダイス式は '3d6' の形式で入力してください",
        ]);
    });
});
