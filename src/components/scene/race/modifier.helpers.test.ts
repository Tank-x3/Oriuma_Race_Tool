// Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正純粋関数群の単体テスト。
import { describe, it, expect } from 'vitest';
import {
    validateModifierInput,
    formatModifierAnnotation,
    MODIFIER_VALUE_INTEGER_ERROR,
    MODIFIER_VALUE_EMPTY_ERROR,
    MODIFIER_REASON_EMPTY_ERROR,
} from './modifier.helpers';

describe('validateModifierInput', () => {
    it('正常: 正の整数 + 理由ラベル → isValid true / sanitized 返却', () => {
        const result = validateModifierInput(5, '妨害');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toEqual({ value: 5, reason: '妨害' });
        expect(result.errorMessage).toBeNull();
    });

    it('正常: 負の整数 + 理由ラベル → isValid true', () => {
        const result = validateModifierInput(-3, 'ファンブル');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toEqual({ value: -3, reason: 'ファンブル' });
    });

    it('正常: 0 + 理由ラベル → isValid true（値域制限なし、houserule-features.md §2 [v] 準拠）', () => {
        const result = validateModifierInput(0, '無効化');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toEqual({ value: 0, reason: '無効化' });
    });

    it('正常: 理由ラベル前後の空白は trim される', () => {
        const result = validateModifierInput(5, '  妨害  ');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toEqual({ value: 5, reason: '妨害' });
    });

    it('異常: 数値が小数 → isValid false / 整数エラー', () => {
        const result = validateModifierInput(5.5, '妨害');
        expect(result.isValid).toBe(false);
        expect(result.sanitized).toBeNull();
        expect(result.errorMessage).toBe(MODIFIER_VALUE_INTEGER_ERROR);
    });

    it('異常: 数値が NaN → isValid false / 整数エラー', () => {
        const result = validateModifierInput(NaN, '妨害');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_VALUE_INTEGER_ERROR);
    });

    it('異常: 数値が Infinity → isValid false / 整数エラー', () => {
        const result = validateModifierInput(Infinity, '妨害');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_VALUE_INTEGER_ERROR);
    });

    it('異常: 数値が空文字 → isValid false / 空欄エラー', () => {
        const result = validateModifierInput('', '妨害');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_VALUE_EMPTY_ERROR);
    });

    it('異常: 数値が null → isValid false / 空欄エラー', () => {
        const result = validateModifierInput(null, '妨害');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_VALUE_EMPTY_ERROR);
    });

    it('異常: 理由ラベルが空欄 → isValid false / 理由空欄エラー（CR-22 統合）', () => {
        const result = validateModifierInput(5, '');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_REASON_EMPTY_ERROR);
    });

    it('異常: 理由ラベルが空白文字のみ → isValid false / 理由空欄エラー', () => {
        const result = validateModifierInput(5, '   ');
        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(MODIFIER_REASON_EMPTY_ERROR);
    });
});

describe('formatModifierAnnotation', () => {
    it('正値: { value: 5, reason: "妨害" } → "+5: 妨害"', () => {
        expect(formatModifierAnnotation({ value: 5, reason: '妨害' })).toBe(
            '+5: 妨害'
        );
    });

    it('負値: { value: -3, reason: "ファンブル" } → "-3: ファンブル"', () => {
        expect(formatModifierAnnotation({ value: -3, reason: 'ファンブル' })).toBe(
            '-3: ファンブル'
        );
    });

    it('ゼロ: { value: 0, reason: "無効化" } → "+0: 無効化"', () => {
        expect(formatModifierAnnotation({ value: 0, reason: '無効化' })).toBe(
            '+0: 無効化'
        );
    });

    it('undefined → 空文字列（未設定時のボタン併記用）', () => {
        expect(formatModifierAnnotation(undefined)).toBe('');
    });
});
