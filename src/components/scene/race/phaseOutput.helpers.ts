import type { UniqueSkillType } from '../../../types';

// Bundle-2 / D-1, D-14 / 2026-05-09: PhaseOutput 内で使用する固有スキル関連の純粋関数を分離。
// 純粋関数化により単体テストを容易にする（既存挙動は維持、houserule-features.md §2 [v] 拡張固有タイプ反映）。

/**
 * 固有スキルタイプから「投稿用ダイス出力」用のダイス文字列を返す。
 * 該当タイプがなければ空文字を返す。
 *
 * - Stability: `5+dice1d10=`
 * - Gamble: `dice1d20=`
 * - Persistent: `dice1d10=`
 * - SuperGamble: `-10+dice1d35=` (Bundle-2 / D-1, D-14)
 * - SuperStability: `8+dice1d3=` (Bundle-2 / D-1, D-14)
 */
export const getUniqueDiceFormula = (type: UniqueSkillType): string => {
    if (type === 'Stability') return '5+dice1d10=';
    if (type === 'Gamble') return 'dice1d20=';
    if (type === 'Persistent') return 'dice1d10=';
    if (type === 'SuperGamble') return '-10+dice1d35=';
    if (type === 'SuperStability') return '8+dice1d3=';
    return '';
};

/**
 * 固有スキルタイプから期待ダイス式（`getCorrectionStatus` 比較用）を返す。
 * 該当タイプがなければ空文字を返す。
 */
export const getExpectedUniqueDiceStr = (type: UniqueSkillType): string => {
    if (type === 'Stability') return '1d10';
    if (type === 'Gamble') return '1d20';
    if (type === 'Persistent') return '1d10';
    if (type === 'SuperGamble') return '1d35';
    if (type === 'SuperStability') return '1d3';
    return '';
};
