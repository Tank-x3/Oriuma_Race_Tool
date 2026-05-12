import type { RaceState, Strategy, Umamusume, UniqueSkillType } from '../../../types';
import { isPhaseResultLoaded } from './specialStrategy.helpers';

// Bundle-2 / D-1, D-14 / 2026-05-09: PhaseOutput 内で使用する固有スキル関連の純粋関数を分離。
// 純粋関数化により単体テストを容易にする（既存挙動は維持、houserule-features.md §2 [v] 拡張固有タイプ反映）。
// Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
// ダイス式 [基礎値] 算出 `getDiceFormulaBaseValue` を本ファイルに追加。
// 効果値反映前のスコア（当該 phase が発動 phase かつ結果取り込み済の場合のみ差し引く）を返す。

type HouseRulesForBaseValue = Pick<
    RaceState['config']['houseRules'],
    'effectValue' | 'enableSpecialStrategy'
>;

/**
 * Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
 * 当該フェーズの「投稿用ダイス出力」に表示するダイス式 [基礎値] を算出する純粋関数。
 *
 * 仕様根拠: scene3-race.md §2 特殊戦法併記 + houserule-features.md §3 Application Timing
 *
 * 算出ルール:
 *  - Start phase: `strategy.fixValue`（既存挙動と同等）
 *  - その他 phase で「当該 phase が発動 phase かつ結果取り込み済」の場合のみ
 *    `p.score - effectValue` (Makuri) / `p.score + effectValue` (Tame) を返す
 *    （score に既に反映されている当該 phase の specialStrategy 効果値を取り除く）
 *  - それ以外（事前操作 + 取り込み前 / 別 phase 発動 / End フェーズで反動先取り回避）
 *    = `p.score` をそのまま返す
 *
 * 重要: 終盤反動 / 解放は「End ダイス取り込み実行時」に score へ反映する設計（SA21 案 A）。
 * 本ヘルパーで「中盤発動済 + 終盤未取り込み」状態の End [基礎値] を `score - +N` のように
 * 算出すると終盤反動を先取り表示してしまうため、End フェーズで `history.End.specialStrategy` が
 * 未設定なら差し引きしない設計とする（仕様根拠: houserule-features.md §3 Resolve 2026-05-11 改訂分）。
 *
 * `strategies` 引数は Start phase の fixValue 参照用。
 */
export const getDiceFormulaBaseValue = (
    p: Umamusume,
    currentPhaseId: string,
    houseRules: HouseRulesForBaseValue,
    strategies: Strategy[]
): number => {
    if (currentPhaseId === 'Start') {
        const strategy = strategies.find((s) => s.name === p.strategy);
        return strategy?.fixValue ?? 0;
    }
    if (!houseRules.enableSpecialStrategy) return p.score;

    const entry = p.history[currentPhaseId];
    if (!entry) return p.score;

    const sp = entry.specialStrategy;
    if (sp !== 'Makuri' && sp !== 'Tame') return p.score;
    if (!isPhaseResultLoaded(p, currentPhaseId)) return p.score;

    // 当該 phase が「発動 phase かつ結果取り込み済」のとき
    // score に既に効果値が反映されているため、ダイス式 [基礎値] では差し引いて返す
    return sp === 'Makuri'
        ? p.score - houseRules.effectValue
        : p.score + houseRules.effectValue;
};

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

// CR-SA-13-E1 / 2026-05-12: 固有スキルタイプから期待 fix 値を返す純粋関数。
// `getExpectedUniqueDiceStr` と対称。ParsedLine.fixValue との完全一致判定（規則 R-3）に使用。
// SSoT: houserule-features.md §2 [v] 拡張固有タイプ 出力フォーマット
//  - Stability: `5+dice1d10=` → 5
//  - Gamble: `dice1d20=` → 0
//  - Persistent: `dice1d10=` → 0
//  - SuperGamble: `-10+dice1d35=` → -10
//  - SuperStability: `8+dice1d3=` → 8
export const getExpectedUniqueFixValue = (type: UniqueSkillType): number => {
    if (type === 'Stability') return 5;
    if (type === 'Gamble') return 0;
    if (type === 'Persistent') return 0;
    if (type === 'SuperGamble') return -10;
    if (type === 'SuperStability') return 8;
    return 0;
};
