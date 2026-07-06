import { describe, it, expect } from 'vitest';
import type { Umamusume } from '../types';
import {
    Validator,
    validatePersistentSkillPhases,
    validateBondSkillType,
    validateSpecialStrategyPhase,
    validateSpecialStrategyTypeAndPhase,
    validateStrategyName,
    validateDiceFormat,
    validatePhaseConfigStructure,
    validateFormationPacePosition,
    validateNoUniqueSkillPresence,
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

// CR-SA-17-Followup-reset-houserules-phaseconfig-error / 2026-07-06:
// 禁止フェーズ構成のデータブロック検証（enablePhaseConfig OFF 透過付き）。
// SSoT: scene1-setup.md §Error Handling L302-304 + houserule-features.md §7.8
// + modal-houserule.md §5 L289-290 準拠。ENG69 R1 User Feedback #1（♻️ 初期化後や
// OFF 切替後に config.pacePosition 残存値でエラー誤検出）の再発防止。
describe('validatePhaseConfigStructure - CR-SA-17-Followup', () => {
    const L302_MESSAGE =
        '・フェーズ構成が不正です（ペースの位置または序盤・終盤の回数が許可範囲外です）。設定を見直してください';

    // ---- OFF 透過（本 Followup の主眼、♻️ 初期化 + OFF 切替の残存値ケース）----
    it('enablePhaseConfig=OFF + 残存 pacePosition="Mid2" + midPhaseCount=1（禁止構成的な残存値）→ エラーなし', () => {
        expect(
            validatePhaseConfigStructure(false, false, 1, 1, 1, 'Mid2'),
        ).toEqual([]);
    });

    it('enablePhaseConfig=OFF + 残存 startPhaseCount=3（値域内だが ON 時の残存値）→ エラーなし', () => {
        expect(
            validatePhaseConfigStructure(false, false, 3, 1, 1, 'Start'),
        ).toEqual([]);
    });

    it('enablePhaseConfig=OFF + 隊列 ON + 残存禁止構成 → エラーなし（OFF 透過を隊列 ON でも維持）', () => {
        expect(
            validatePhaseConfigStructure(false, true, 1, 0, 1, 'End'),
        ).toEqual([]);
    });

    // ---- ON 時継続ブロック（回帰なし）----
    it('enablePhaseConfig=ON + pacePosition="End"（end 後禁止）→ L302 文言のエラー 1 件', () => {
        expect(
            validatePhaseConfigStructure(true, false, 1, 1, 1, 'End'),
        ).toEqual([L302_MESSAGE]);
    });

    it('enablePhaseConfig=ON + pacePosition="Mid2" × midPhaseCount=1（存在しないアンカー）→ L302 文言のエラー 1 件', () => {
        expect(
            validatePhaseConfigStructure(true, false, 1, 1, 1, 'Mid2'),
        ).toEqual([L302_MESSAGE]);
    });

    it('enablePhaseConfig=ON + startPhaseCount=5（値域外 > 4）→ L302 文言のエラー 1 件', () => {
        expect(
            validatePhaseConfigStructure(true, false, 5, 1, 1, 'Start'),
        ).toEqual([L302_MESSAGE]);
    });

    it('enablePhaseConfig=ON + 有効構成（序盤2/中盤1/終盤2/pace=Mid）→ エラーなし', () => {
        expect(
            validatePhaseConfigStructure(true, false, 2, 1, 2, 'Mid'),
        ).toEqual([]);
    });

    it('enablePhaseConfig=ON + pacePosition=null（ペースなし、隊列 OFF）→ エラーなし', () => {
        expect(
            validatePhaseConfigStructure(true, false, 1, 1, 1, null),
        ).toEqual([]);
    });

    // ---- 隊列 ON × フェーズ構成変更 ON 時のペース位置制約（§7.6、既存 CR-SA-20-E3 挙動継続）----
    it('enablePhaseConfig=ON + 隊列 ON + pacePosition="Mid1"（隊列スロット以降 = Mid1 が隊列直後）→ L302 文言のエラー 1 件', () => {
        // 中盤 2 回構成では隊列スロット = Mid1 直後（§6.4）。ペースが Mid1 だと隊列より後になり禁止。
        expect(
            validatePhaseConfigStructure(true, true, 1, 2, 1, 'Mid2'),
        ).toEqual([L302_MESSAGE]);
    });
});

// Bundle-10-T3 / CR-SA-12 / 2026-05-11: 脚質エディタ Validation 統合
// modal-houserule.md §Critical Errors + houserule-features.md §1 Validation SSoT 準拠
// CR-SA-20-E3 / 2026-06-11: 隊列 ON × ペースなし のエントリー確定ブロック
// （houserule-features.md §7.6 + scene1-setup.md Error Handling L297-301）
describe('validateFormationPacePosition - CR-SA-20-E3', () => {
    const L301_MESSAGE =
        '・隊列(バ群)ダイスを使用する場合はペースが必要です。ペース位置を「なし」以外にするか、隊列ダイスをオフにしてください';

    it('隊列 ON × フェーズ構成変更 ON × ペースなし（null）→ L301 文言のエラー 1 件', () => {
        expect(validateFormationPacePosition(true, true, null)).toEqual([L301_MESSAGE]);
    });

    it('隊列 ON × フェーズ構成変更 ON × ペースあり → 通過', () => {
        expect(validateFormationPacePosition(true, true, 'Start')).toEqual([]);
        expect(validateFormationPacePosition(true, true, 'Mid1')).toEqual([]);
    });

    it('隊列 OFF × ペースなし → 通過（既存挙動 = ペースなし構成自体は有効）', () => {
        expect(validateFormationPacePosition(false, true, null)).toEqual([]);
    });

    it('フェーズ構成変更 OFF はペース序盤直後固定で矛盾が発生しないため通過（L297 条件 / OFF 透過）', () => {
        expect(validateFormationPacePosition(true, false, null)).toEqual([]);
    });

    it('両ハウスルール OFF → 通過', () => {
        expect(validateFormationPacePosition(false, false, null)).toEqual([]);
        expect(validateFormationPacePosition(false, false, 'Start')).toEqual([]);
    });
});

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

// CR-SA-22 / CR-SA-21+22-E2 / 2026-07-06:
// validateNoUniqueSkillPresence の SSoT テスト（scene1-setup.md §Error Handling L312-315 SSoT）
describe('validateNoUniqueSkillPresence (CR-SA-22 / CR-SA-21+22-E2)', () => {
    const makeP = (name: string, type: Umamusume['uniqueSkill']['type']): Umamusume => ({
        id: `id-${name}`,
        entryIndex: 1,
        name,
        strategy: '逃げ',
        uniqueSkill: { type, phases: [] },
        gate: null,
        score: 0,
        history: {},
    });

    it('enableNoUniqueSkill=true → 常に空配列（許可されているため）', () => {
        const parts = [makeP('A', 'None' as const)];
        expect(validateNoUniqueSkillPresence(true, parts)).toEqual([]);
    });

    it('enableNoUniqueSkill=false + 「なし」出走者なし → 空配列', () => {
        const parts = [makeP('A', 'Stability' as const), makeP('B', 'Gamble' as const)];
        expect(validateNoUniqueSkillPresence(false, parts)).toEqual([]);
    });

    it('enableNoUniqueSkill=false + 「なし」出走者あり → L315 文言完全一致（例示名は最初の該当出走者）', () => {
        const parts = [makeP('ウマ娘A', 'Stability' as const), makeP('モブ1', 'None' as const)];
        expect(validateNoUniqueSkillPresence(false, parts)).toEqual([
            '・固有スキルなしが許可されていない設定で「なし」の出走者がいます（例: モブ1）。ハウスルールを見直すか、固有タイプを設定してください',
        ]);
    });

    it('participants が空配列 → 空配列', () => {
        expect(validateNoUniqueSkillPresence(false, [])).toEqual([]);
    });

    it('無名（name=""）の「なし」出走者 → 例示名フォールバック（無名の出走者）', () => {
        const parts = [makeP('', 'None' as const)];
        expect(validateNoUniqueSkillPresence(false, parts)).toEqual([
            '・固有スキルなしが許可されていない設定で「なし」の出走者がいます（例: 無名の出走者）。ハウスルールを見直すか、固有タイプを設定してください',
        ]);
    });
});
