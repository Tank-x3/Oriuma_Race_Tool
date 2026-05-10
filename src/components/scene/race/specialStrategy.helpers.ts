import type { Umamusume, Strategy } from '../../../types';
import { Calculator } from '../../../core/calculator';

// Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法（捲り/溜め）の純粋関数群。
// houserule-features.md §3 Status Effect Logic / Future Queue / scene3-race.md §2 §5 準拠。
// データ構造を増やさず再計算で導出する設計（participants[*].history[phaseId].specialStrategy のみ参照）。

/**
 * 終盤フェーズへの到達済か判定する。
 * - currentPhaseId === 'End' または history に 'End' エントリが存在 → 到達済
 * - 終盤反動の自動解決と Future Queue 解決の境界判定に使用する
 */
export const hasReachedEndPhase = (
    currentPhaseId: string,
    history: Umamusume['history']
): boolean => {
    return currentPhaseId === 'End' || history['End'] !== undefined;
};

/**
 * 当該参加者がレース全体を通じて捲り/溜めを発動したフェーズと値を返す。
 * - 1 レース 1 回制限を満たす設計（specialStrategy != null は最大 1 フェーズのみ存在する想定）
 * - 複数フェーズに残存している場合は最初に見つかったものを返す（防御的、通常は単一）
 * - 該当なし → null
 */
export const findActivatedSpecialStrategy = (
    p: Umamusume
): { phaseId: string; value: 'Makuri' | 'Tame' } | null => {
    for (const [phaseId, entry] of Object.entries(p.history)) {
        if (entry?.specialStrategy === 'Makuri' || entry?.specialStrategy === 'Tame') {
            return { phaseId, value: entry.specialStrategy };
        }
    }
    return null;
};

/**
 * 当該参加者・指定フェーズで「投稿用ダイス出力」のダイス行末に併記する文字列を返す。
 * - 該当なし → 空文字列
 * - 発動フェーズ（序盤・中盤）で捲り → ` 【捲り】+N`
 * - 発動フェーズ（序盤・中盤）で溜め → ` 【溜め】-N`
 * - 終盤フェーズで過去捲り発動済 → ` 【捲り】-N`（自動反動）
 * - 終盤フェーズで過去溜め発動済 → ` 【溜め】+N`（自動解放）
 *
 * 仕様根拠: scene3-race.md §2 「特殊戦法併記」/ houserule-features.md §3 Resolve
 */
export const getSpecialStrategyAnnotation = (
    p: Umamusume,
    phaseId: string,
    effectValue: number
): string => {
    if (phaseId === 'End') {
        const activated = findActivatedSpecialStrategy(p);
        if (activated === null) return '';
        if (activated.phaseId === 'End') return '';
        if (activated.value === 'Makuri') return ` 【捲り】-${effectValue}`;
        if (activated.value === 'Tame') return ` 【溜め】+${effectValue}`;
        return '';
    }

    const entry = p.history[phaseId];
    if (!entry?.specialStrategy) return '';
    if (entry.specialStrategy === 'Makuri') return ` 【捲り】+${effectValue}`;
    if (entry.specialStrategy === 'Tame') return ` 【溜め】-${effectValue}`;
    return '';
};

/**
 * 当該参加者の score に加算すべき特殊戦法の補正合計を返す。
 * - 発動フェーズ（!== 'End'）の Makuri → +N / Tame → -N
 * - 終盤反動（過去 Makuri && history.End にエントリあり）→ -N
 * - 終盤解放（過去 Tame && history.End にエントリあり）→ +N
 *
 * **判定基準を `history['End']` の有無に絞る理由:**
 * 戻る操作（`revertPhaseHistory('End', ...)` で history.End 削除）後の中間状態で
 * `currentPhaseId === 'End'` のままであるケースでも、終盤反動が score から
 * 正しく除外されるようにするため。ダイス出力併記（`getSpecialStrategyAnnotation`）は
 * 別軸で `currentPhaseId === 'End'` を境界として併記する。
 *
 * `Calculator.calculateTotalScore` は specialStrategy を見ないため、
 * ストア action 内で本関数の戻り値を score に上乗せする運用とする
 * （calculator.ts は不変厳守エリアのため改修不可）。
 */
/**
 * 解析未実行の history エントリ（specialStrategy のみで baseDice/uniqueDice/manualModifier
 * いずれも未投入）を取り除いた `Umamusume` を返す。
 *
 * **目的:** `Calculator.calculateTotalScore` は `history[phaseId]` の存在のみで `strategy.fixValue`
 * を加算する仕様（calculator.ts L48 `if (startData) total += strategy.fixValue`）。
 * 戦法ボタンを解析実行前に押すと history.Start が `{ specialStrategy: 'Makuri', computedScore: 0 }` で
 * 作成され、Calculator が「Start ダイス未投入」状態で fixValue を加算 = score = fixValue + delta となり、
 * ユーザーから見て「効果値以外の値が一緒に動いた」現象が発生する。
 *
 * 本ヘルパーで Calculator に渡す前にフィルタリングし、解析未実行 phase は加算対象から除外する。
 */
const filterAnalyzedHistory = (p: Umamusume): Umamusume => {
    const filteredHistory: Umamusume['history'] = {};
    for (const [phaseId, entry] of Object.entries(p.history)) {
        if (
            entry.baseDice ||
            entry.uniqueDice ||
            entry.manualModifier !== undefined
        ) {
            filteredHistory[phaseId] = entry;
        }
    }
    return { ...p, history: filteredHistory };
};

/**
 * 特殊戦法 delta を含めた完全 score を返す。
 * - Calculator は解析実行済 phase（baseDice/uniqueDice/manualModifier いずれかあり）のみで計算
 * - その上に `computeSpecialStrategyTotalDelta` の戻り値を加算
 *
 * 4 箇所のストア action（setSpecialStrategy / updateHouseRules / updateParticipant /
 * revertPhaseHistory）すべてで本関数を呼ぶことで、score 計算ロジックを一元化する。
 */
export const calculateScoreWithSpecialStrategy = (
    p: Umamusume,
    strategies: Strategy[],
    paceFace: number | null,
    activePhaseIds: readonly string[],
    effectValue: number,
    enableSpecialStrategy: boolean
): number => {
    const filtered = filterAnalyzedHistory(p);
    const baseScore = Calculator.calculateTotalScore(
        filtered,
        strategies,
        paceFace,
        activePhaseIds
    );
    const delta = computeSpecialStrategyTotalDelta(p, effectValue, enableSpecialStrategy);
    return baseScore + delta;
};

/**
 * 解析対象テキストから戦法併記（` 【捲り】±N` / ` 【溜め】±N`）を除去する。
 * Bundle-4 / 2026-05-10 [ESCALATION 案 V Provisional]: 実 GM 運用で「掲示板投稿前に戦法宣言」が
 * 必須となるため、PhaseOutput が出力した併記入りテキストが解析側にも入ってくる。
 * Parser が不変厳守エリアであり改修できないため、解析前処理として除去する。
 *
 * 想定する併記パターン:
 *  - ` 【捲り】+15` / ` 【捲り】-15` (発動 / 終盤反動)
 *  - ` 【溜め】+15` / ` 【溜め】-15` (発動 / 終盤解放)
 *  - 全角符号 ＋ / － にも追従（観察安全側）
 *  - 数値前の符号は省略可能なケースも防御的に許容
 */
export const stripStrategyAnnotations = (input: string): string => {
    return input.replace(/\s*【(?:捲り|溜め)】[+\-－＋]?\d+/g, '');
};

export const computeSpecialStrategyTotalDelta = (
    p: Umamusume,
    effectValue: number,
    enableSpecialStrategy: boolean
): number => {
    // ハウスルールフラグ OFF なら delta = 0（過去データが残っていても無効化）
    if (!enableSpecialStrategy) return 0;

    const activated = findActivatedSpecialStrategy(p);
    if (activated === null) return 0;
    if (activated.phaseId === 'End') return 0;

    let delta = activated.value === 'Makuri' ? effectValue : -effectValue;

    // 終盤の baseDice 解析実行済（history.End あり）なら反動/解放も加算
    if (p.history['End'] !== undefined) {
        delta += activated.value === 'Makuri' ? -effectValue : effectValue;
    }
    return delta;
};
