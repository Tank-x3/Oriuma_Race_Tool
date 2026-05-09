// Bundle-9 / 2026-05-10: houseRulesForm.helpers の単体テスト
import { describe, it, expect } from 'vitest';
import {
    getHouseRuleCheckboxes,
    validateEffectValue,
    EFFECT_VALUE_MIN,
    EFFECT_VALUE_MAX,
} from './houseRulesForm.helpers';

describe('Bundle-9 / 2026-05-10 getHouseRuleCheckboxes', () => {
    it('4 件の項目を仕様書 §1 記載順で返す', () => {
        const items = getHouseRuleCheckboxes();
        expect(items).toHaveLength(4);
        expect(items.map((i) => i.key)).toEqual([
            'enableModifier',
            'enableSpecialStrategy',
            'enableCompositeUnique',
            'enableExtendedUnique',
        ]);
        expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4]);
    });

    it('ラベル文言が modal-houserule.md §1 と完全一致（変更不可）', () => {
        const items = getHouseRuleCheckboxes();
        const labels = Object.fromEntries(items.map((i) => [i.key, i.label]));
        expect(labels.enableModifier).toBe('汎用補正(Modifier)ボタンを表示');
        expect(labels.enableSpecialStrategy).toBe('特殊戦法(ステータス変化: 捲り/溜め)を使用');
        expect(labels.enableCompositeUnique).toBe('複合固有スキル(発動位置複数選択)を許可');
        expect(labels.enableExtendedUnique).toBe('拡張固有タイプ(超ギャンブル/超安定)を使用');
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
