// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル UI 用純粋関数群のテスト
// (modal-houserule.md §4 + houserule-features.md §5 SSoT 準拠)
import { describe, it, expect } from 'vitest';
import type { UniqueDiceConfig } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    UNIQUE_SKILL_TYPE_LABELS,
    getVisibleUniqueSkillTypes,
    createEditFormState,
    createDefaultResetFormState,
    formStateToEntry,
    validateUniqueDiceFixValue,
    buildUpdatedUniqueDiceConfig,
    getUniqueDicePreview,
} from './uniqueSkillEditor.helpers';

describe('uniqueSkillEditor.helpers - UNIQUE_SKILL_TYPE_LABELS', () => {
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加で 5 → 7 タイプ
    it('固有スキル 7 タイプすべてのキーを持ち、表示名が modal-houserule.md §4 ワイヤーフレーム準拠', () => {
        expect(Object.keys(UNIQUE_SKILL_TYPE_LABELS).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
        );
        expect(UNIQUE_SKILL_TYPE_LABELS.Stability).toBe('安定型');
        expect(UNIQUE_SKILL_TYPE_LABELS.Gamble).toBe('ギャンブル型');
        expect(UNIQUE_SKILL_TYPE_LABELS.Persistent).toBe('持続型');
        expect(UNIQUE_SKILL_TYPE_LABELS.SuperGamble).toBe('超ギャンブル');
        expect(UNIQUE_SKILL_TYPE_LABELS.SuperStability).toBe('超安定');
        expect(UNIQUE_SKILL_TYPE_LABELS.GambleII).toBe('ギャンブル型Ⅱ');
        expect(UNIQUE_SKILL_TYPE_LABELS.StabilityII).toBe('安定型Ⅱ');
    });
});

describe('uniqueSkillEditor.helpers - getVisibleUniqueSkillTypes (Round 2: 2 引数化)', () => {
    // Round 2 修正（2026-05-15 ユーザーフィードバック）: 持続型は enableCompositeUnique 連動。
    // entryForm.helpers.ts getUniqueSkillTypeOptions の挙動と整合させる。
    it('enableExtendedUnique OFF + enableCompositeUnique OFF → 安定型 / ギャンブル型のみ（2 種、持続型・拡張固有タイプを含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(false, false);
        expect(visible).toEqual(['Stability', 'Gamble']);
    });

    it('enableExtendedUnique OFF + enableCompositeUnique ON → 安定型 / ギャンブル型 / 持続型（3 種、拡張固有タイプを含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(false, true);
        expect(visible).toEqual(['Stability', 'Gamble', 'Persistent']);
        expect(visible).not.toContain('SuperGamble');
    });

    // CR-SA-19 / 2026-06-06: 拡張固有タイプ 4 種（超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ）
    it('enableExtendedUnique ON + enableCompositeUnique OFF → 安定型 / ギャンブル型 / 拡張 4 種（6 種、持続型を含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(true, false);
        expect(visible).toEqual(['Stability', 'Gamble', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII']);
        expect(visible).not.toContain('Persistent');
    });

    it('両 ON → 7 種すべて（表示順: 安定型 → ギャンブル型 → 持続型 → 超ギャンブル → 超安定 → ギャンブル型Ⅱ → 安定型Ⅱ）', () => {
        expect(getVisibleUniqueSkillTypes(true, true)).toEqual([
            'Stability',
            'Gamble',
            'Persistent',
            'SuperGamble',
            'SuperStability',
            'GambleII',
            'StabilityII',
        ]);
    });
});

describe('uniqueSkillEditor.helpers - createEditFormState', () => {
    it('UniqueDiceEntry の各フィールドを文字列化して初期化する（正の固定値 / 負の固定値）', () => {
        const stability = createEditFormState(DEFAULT_UNIQUE_DICE_CONFIG.Stability);
        expect(stability).toEqual({ fixValue: '5', diceStr: '1d10' });
        const superGamble = createEditFormState(DEFAULT_UNIQUE_DICE_CONFIG.SuperGamble);
        expect(superGamble).toEqual({ fixValue: '-10', diceStr: '1d35' });
    });
});

describe('uniqueSkillEditor.helpers - createDefaultResetFormState', () => {
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加で 5 → 7 タイプ
    it('DEFAULT_UNIQUE_DICE_CONFIG の値でフォームを生成する（7 タイプ）', () => {
        expect(createDefaultResetFormState('Stability')).toEqual({ fixValue: '5', diceStr: '1d10' });
        expect(createDefaultResetFormState('Gamble')).toEqual({ fixValue: '0', diceStr: '1d20' });
        expect(createDefaultResetFormState('Persistent')).toEqual({ fixValue: '0', diceStr: '1d10' });
        expect(createDefaultResetFormState('SuperGamble')).toEqual({ fixValue: '-10', diceStr: '1d35' });
        expect(createDefaultResetFormState('SuperStability')).toEqual({ fixValue: '8', diceStr: '1d3' });
        expect(createDefaultResetFormState('GambleII')).toEqual({ fixValue: '-20', diceStr: '1d45' });
        expect(createDefaultResetFormState('StabilityII')).toEqual({ fixValue: '0', diceStr: '2d7' });
    });
});

describe('uniqueSkillEditor.helpers - formStateToEntry', () => {
    it('正常系: 整数文字列（正・負）を数値に変換し、diceStr を trim する', () => {
        expect(formStateToEntry({ fixValue: '7', diceStr: '  1d11  ' })).toEqual({
            fixValue: 7,
            diceStr: '1d11',
        });
        expect(formStateToEntry({ fixValue: '-3', diceStr: '1d35' }).fixValue).toBe(-3);
    });

    it('fixValue が空欄 / 非数値の場合は 0 にフォールバック', () => {
        expect(formStateToEntry({ fixValue: '', diceStr: '1d10' }).fixValue).toBe(0);
        expect(formStateToEntry({ fixValue: 'abc', diceStr: '1d10' }).fixValue).toBe(0);
    });
});

describe('uniqueSkillEditor.helpers - validateUniqueDiceFixValue', () => {
    it('整数（正・負・ゼロ）→ エラーなし', () => {
        expect(validateUniqueDiceFixValue('5')).toEqual([]);
        expect(validateUniqueDiceFixValue('-10')).toEqual([]);
        expect(validateUniqueDiceFixValue('0')).toEqual([]);
    });

    it('空欄 / 空白のみ → エラー', () => {
        expect(validateUniqueDiceFixValue('')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('   ')).toHaveLength(1);
    });

    it('整数以外（小数 / 非数値 / 符号のみ）→ エラー', () => {
        expect(validateUniqueDiceFixValue('1.5')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('abc')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('-')).toHaveLength(1);
    });
});

describe('uniqueSkillEditor.helpers - buildUpdatedUniqueDiceConfig', () => {
    it('指定タイプのエントリのみを更新し、指定外のタイプは不変', () => {
        const next = buildUpdatedUniqueDiceConfig(DEFAULT_UNIQUE_DICE_CONFIG, 'Stability', {
            fixValue: 7,
            diceStr: '1d11',
        });
        expect(next.Stability).toEqual({ fixValue: 7, diceStr: '1d11' });
        expect(next.Gamble).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.Gamble);
        expect(next.SuperGamble).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.SuperGamble);
    });

    it('新しいオブジェクトを返し（参照比較トリガー対応）、引数の current を破壊しない（mutate しない）', () => {
        const current: UniqueDiceConfig = { ...DEFAULT_UNIQUE_DICE_CONFIG };
        const next = buildUpdatedUniqueDiceConfig(current, 'Persistent', {
            fixValue: 99,
            diceStr: '1d99',
        });
        expect(next).not.toBe(current);
        expect(current.Persistent).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.Persistent);
    });
});

describe('uniqueSkillEditor.helpers - getUniqueDicePreview', () => {
    it('fixValue > 0 → `[fixValue]+dice[diceStr]=`（houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('Stability', { fixValue: 5, diceStr: '1d10' })).toBe(
            '5+dice1d10=',
        );
        expect(getUniqueDicePreview('Stability', { fixValue: 7, diceStr: '1d11' })).toBe(
            '7+dice1d11=',
        );
    });

    it('fixValue < 0 → `[fixValue]+dice[diceStr]=`（負号込み、houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('SuperGamble', { fixValue: -10, diceStr: '1d35' })).toBe(
            '-10+dice1d35=',
        );
    });

    it('fixValue === 0 → `dice[diceStr]=`（houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('Gamble', { fixValue: 0, diceStr: '1d20' })).toBe('dice1d20=');
    });
});
