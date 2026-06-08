// CR-SA-17-E3 / 2026-06-07: ペース挿入位置（アンカー方式）の純粋関数群。
// houserule-features.md §7.5「ペース挿入位置の指定とバリデーション」の SSoT 実装。
//
// E1 で導入した config.pacePosition（PacePosition = string | null）を、実際の
// 有効アンカー候補（= ペースをどのフェーズの直後に挟めるか）に接続する。
// - 有効アンカー = 最後の終盤を除く全フェーズの直後（end 後禁止 / start 前は構造上発生しない）。
// - null = 「なし（ペース 0 回）」。
// - デフォルト = 序盤ブロックの直後（最後の序盤フェーズ ID）。
//
// ペースのフェーズ列への実挿入・スコア反映は E4 スコープ。本モジュールは
// 「設定 UI の選択肢生成」「回数変更時の追従」「禁止構成のデータブロック」に責務を限定する。

import { getNonPacePhaseSequence, type PhaseDescriptor } from './phaseSequence';
import type { PacePosition } from '../types';

/** ペース位置プルダウンの 1 選択肢。value=null は「なし（ペース 0 回）」。 */
export interface PaceAnchorOption {
    value: PacePosition; // null = なし / フェーズ ID = そのフェーズ直後にペース
    label: string;       // 「なし」「序盤の後」「中盤1の後」等
}

/** 「なし（ペース 0 回）」選択肢のラベル。 */
export const PACE_NONE_LABEL = 'なし';

const PHASE_COUNT_MIN = 1;
const PHASE_COUNT_MAX = 4;

/**
 * 有効アンカー候補（PhaseDescriptor[]）を返す。
 * 有効アンカー = 最後の終盤を除く全フェーズの直後（§7.5）。
 *
 * - end 後禁止: 非ペース列の末尾（= 最後の終盤）を除外する。
 * - start 前禁止: アンカーは「フェーズの直後」を表すため、構造上「最初の序盤より前」は表現されない。
 *
 * 非ペース列は常に序盤 ≥1 + 終盤 ≥1 で長さ ≥2 のため、最低 1 アンカーは必ず返る。
 */
export const getValidPaceAnchors = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): PhaseDescriptor[] => {
    const seq = getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount);
    return seq.slice(0, -1);
};

/**
 * ペース位置プルダウンの選択肢配列（有効アンカー + 「なし」）。
 * 並び: 各アンカー（時間順、ラベル「○○の後」）→ 末尾に「なし」。
 */
export const getPaceAnchorOptions = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): PaceAnchorOption[] => {
    const anchors = getValidPaceAnchors(startPhaseCount, midPhaseCount, endPhaseCount);
    const options: PaceAnchorOption[] = anchors.map(a => ({
        value: a.id,
        label: `${a.label}の後`,
    }));
    options.push({ value: null, label: PACE_NONE_LABEL });
    return options;
};

/**
 * デフォルトのペース位置 = 序盤ブロックの直後（最後の序盤フェーズ ID）。
 * 序盤 1 回 → 'Start' / 序盤 ≥2 → `Start{n}`（§7.5 デフォルト位置）。
 * 現行の「序盤直後にペース」を踏襲する。
 */
export const getDefaultPacePosition = (startPhaseCount: number): string =>
    startPhaseCount <= 1 ? 'Start' : `Start${startPhaseCount}`;

/**
 * ペース位置が現在のフェーズ構成で有効か。
 * null（なし）は常に有効。文字列は有効アンカー集合に含まれること。
 */
export const isPacePositionValid = (
    pacePosition: PacePosition,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): boolean => {
    if (pacePosition === null) return true;
    const anchorIds = new Set(
        getValidPaceAnchors(startPhaseCount, midPhaseCount, endPhaseCount).map(a => a.id),
    );
    return anchorIds.has(pacePosition);
};

/**
 * 回数変更後のペース位置を解決する（§7.5「無効になった場合デフォルト位置へ強制リセット」）。
 * 現在位置が有効ならそのまま保持、無効ならデフォルト（序盤ブロック直後）へ。
 * null（なし）は常に有効なので保持される。
 */
export const resolvePacePosition = (
    currentPacePosition: PacePosition,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): PacePosition => {
    if (isPacePositionValid(currentPacePosition, startPhaseCount, midPhaseCount, endPhaseCount)) {
        return currentPacePosition;
    }
    return getDefaultPacePosition(startPhaseCount);
};

/**
 * フェーズ構成全体の妥当性検証（禁止構成データブロック、§7.5 / scene1-setup Error Handling L299-301）。
 * UI を経由しない経路（JSON プリセット取り込み・state 復元等）で禁止構成が混入した場合の防御。
 *
 * - 序盤・終盤回数が 1〜4 / 中盤回数が 0〜4 の整数
 * - ペース位置が有効（null = なし、または有効アンカー = start 前 / end 後でない）
 */
export const isPhaseConfigValid = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
): boolean => {
    if (!Number.isInteger(startPhaseCount) || startPhaseCount < PHASE_COUNT_MIN || startPhaseCount > PHASE_COUNT_MAX) return false;
    if (!Number.isInteger(endPhaseCount) || endPhaseCount < PHASE_COUNT_MIN || endPhaseCount > PHASE_COUNT_MAX) return false;
    if (!Number.isInteger(midPhaseCount) || midPhaseCount < 0 || midPhaseCount > PHASE_COUNT_MAX) return false;
    if (!isPacePositionValid(pacePosition, startPhaseCount, midPhaseCount, endPhaseCount)) return false;
    return true;
};

/**
 * 「現在の構成」表示用に、ペースを挿入したフェーズラベル列を返す。
 * 例: 序盤 1 / 中盤 1 / 終盤 1 / pace='Start' → ['序盤', 'ペース', '中盤', '終盤']。
 * pacePosition=null（なし）の場合はペースを挿入しない。
 */
export const getPhaseConfigDisplayLabels = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
): string[] => {
    const seq = getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount);
    const labels: string[] = [];
    for (const phase of seq) {
        labels.push(phase.label);
        if (pacePosition !== null && phase.id === pacePosition) {
            labels.push('ペース');
        }
    }
    return labels;
};
