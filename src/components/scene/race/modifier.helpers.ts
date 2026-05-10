// Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の純粋関数群。
// houserule-features.md §2 [v] 汎用補正 / scene3-race.md §2 §3 (B) GM Dashboard 準拠。
// Bundle-2/3/4/9 で確立された helpers 抽出パターンを継承（React Testing Library 未導入下のテストカバレッジ確保）。

export const MODIFIER_VALUE_INTEGER_ERROR = '補正値は整数で入力してください';
export const MODIFIER_VALUE_EMPTY_ERROR = '補正値を入力してください';
export const MODIFIER_REASON_EMPTY_ERROR = '補正の理由を入力してください';

export interface ModifierValidationResult {
    isValid: boolean;
    sanitized: { value: number; reason: string } | null;
    errorMessage: string | null;
}

/**
 * 補正入力モーダルの値検証。
 * - 数値: `Number.isInteger(value)` 必須（小数 / NaN / Infinity は拒否）
 * - 数値範囲: 上限・下限なし（houserule-features.md §2 [v]「入力範囲の制限は設けない」準拠）
 * - 理由ラベル: string 必須、`trim()` 後非空（CR-22 統合）
 *
 * 値検証はモーダル側のリアルタイム判定とストア action 呼び出し前の防御の双方で使用する。
 */
export const validateModifierInput = (
    value: unknown,
    reason: unknown
): ModifierValidationResult => {
    // 数値判定
    if (value === '' || value === null || value === undefined) {
        return {
            isValid: false,
            sanitized: null,
            errorMessage: MODIFIER_VALUE_EMPTY_ERROR,
        };
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return {
            isValid: false,
            sanitized: null,
            errorMessage: MODIFIER_VALUE_INTEGER_ERROR,
        };
    }

    // 理由ラベル判定
    if (typeof reason !== 'string' || reason.trim() === '') {
        return {
            isValid: false,
            sanitized: null,
            errorMessage: MODIFIER_REASON_EMPTY_ERROR,
        };
    }

    return {
        isValid: true,
        sanitized: { value, reason: reason.trim() },
        errorMessage: null,
    };
};

/**
 * ダッシュボードボタン併記用フォーマット。
 * - `{ value: 5, reason: '妨害' }` → `'+5: 妨害'`
 * - `{ value: -3, reason: 'ファンブル' }` → `'-3: ファンブル'`
 * - `undefined` → `''`（未設定時はボタン側で `[✎ 補正]` を表示）
 */
export const formatModifierAnnotation = (
    modifier: { value: number; reason: string } | undefined
): string => {
    if (!modifier) return '';
    const sign = modifier.value >= 0 ? '+' : '';
    return `${sign}${modifier.value}: ${modifier.reason}`;
};
