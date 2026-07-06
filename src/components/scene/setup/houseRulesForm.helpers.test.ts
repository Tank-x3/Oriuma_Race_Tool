// Bundle-9 / 2026-05-10: houseRulesForm.helpers の単体テスト
import { describe, it, expect } from 'vitest';
import {
    getHouseRuleCheckboxes,
    validateEffectValue,
    EFFECT_VALUE_MIN,
    EFFECT_VALUE_MAX,
} from './houseRulesForm.helpers';

describe('Bundle-9 / 2026-05-10 getHouseRuleCheckboxes', () => {
    // Bundle-8-T2 / CR-SA-4 / 2026-05-10: 5 つ目「絆スキル」を追加（scene1-setup.md §2 ワイヤーフレーム L28 SSoT）。
    // CR-SA-17-E3 / 2026-06-07: 「フェーズ構成変更」を追加。
    // CR-SA-20-E3 / 2026-06-11: 6 つ目「隊列〔バ群〕ダイス」を追加（フェーズ構成変更の前 =
    // scene1-setup.md ワイヤーフレーム L36 記載順。フェーズ構成変更は 7 つ目へ繰り下げ）。
    // CR-SA-22 / CR-SA-21+22-E2 / 2026-07-06: 5 番目に「固有スキルなしの出走者を許可」を追加
    // （modal-houserule.md §1 ワイヤーフレーム L38 SSoT、拡張固有直後 / 絆スキル前）。8 チェックボックス化。
    it('8 件の項目を仕様書 §1 + scene1-setup.md §2 記載順で返す', () => {
        const items = getHouseRuleCheckboxes();
        expect(items).toHaveLength(8);
        expect(items.map((i) => i.key)).toEqual([
            'enableModifier',
            'enableSpecialStrategy',
            'enableCompositeUnique',
            'enableExtendedUnique',
            'enableNoUniqueSkill',
            'enableBondSkill',
            'enableFormationDice',
            'enablePhaseConfig',
        ]);
        expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('ラベル文言が modal-houserule.md §1 + scene1-setup.md §2 と完全一致（変更不可）', () => {
        const items = getHouseRuleCheckboxes();
        const labels = Object.fromEntries(items.map((i) => [i.key, i.label]));
        expect(labels.enableModifier).toBe('汎用補正(Modifier)ボタンを表示');
        expect(labels.enableSpecialStrategy).toBe('特殊戦法(ステータス変化: 捲り/溜め)を使用');
        expect(labels.enableCompositeUnique).toBe('複合固有スキル(発動位置複数選択)を許可');
        // CR-SA-19 / 2026-06-06: ラベル括弧内に 4 タイプ明示
        expect(labels.enableExtendedUnique).toBe('拡張固有タイプ(超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ)を使用');
        // CR-SA-22 / CR-SA-21+22-E2 / 2026-07-06: 固有スキルなしトグル文言（modal-houserule.md §1 ワイヤーフレーム L38 SSoT）
        expect(labels.enableNoUniqueSkill).toBe('固有スキルなしの出走者を許可');
        expect(labels.enableBondSkill).toBe('絆スキル(連続企画用 絆ギャンブル/絆安定)を使用');
        // CR-SA-20-E3 / 2026-06-11: 隊列〔バ群〕ダイストグル文言（scene1-setup.md ワイヤーフレーム L36 SSoT）
        expect(labels.enableFormationDice).toBe('隊列(バ群)ダイスを使用');
        // CR-SA-17-E3 / 2026-06-07: フェーズ構成変更トグル文言（scene1-setup.md §2 / modal-houserule.md §1 SSoT）
        expect(labels.enablePhaseConfig).toBe('フェーズ構成(序盤・終盤の回数/ペース位置)を変更する');
    });
});

describe('Bundle-9 / 2026-05-10 validateEffectValue', () => {
    it('範囲内の整数（1, 15, 999）は isValid=true', () => {
        expect(validateEffectValue(EFFECT_VALUE_MIN)).toEqual({ isValid: true, sanitized: 1 });
        expect(validateEffectValue(15)).toEqual({ isValid: true, sanitized: 15 });
        expect(validateEffectValue(EFFECT_VALUE_MAX)).toEqual({ isValid: true, sanitized: 999 });
    });

    it('範囲外（0, -1, 1000）は isValid=false / sanitized=null', () => {
        expect(validateEffectValue(0)).toEqual({ isValid: false, sanitized: null });
        expect(validateEffectValue(-1)).toEqual({ isValid: false, sanitized: null });
        expect(validateEffectValue(1000)).toEqual({ isValid: false, sanitized: null });
    });

    it('非整数（小数 / NaN / Infinity）は isValid=false / sanitized=null', () => {
        expect(validateEffectValue(15.5)).toEqual({ isValid: false, sanitized: null });
        expect(validateEffectValue(NaN)).toEqual({ isValid: false, sanitized: null });
        expect(validateEffectValue(Infinity)).toEqual({ isValid: false, sanitized: null });
    });
});
