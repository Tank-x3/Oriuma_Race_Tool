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
 * CR-SA-20-E3 / 2026-06-11: 隊列スロット（隊列フェーズの挿入位置）のアンカーフェーズ ID。
 * houserule-features.md §6.4（GM 指定不可、中盤回数から自動決定）:
 *
 * - 中盤 0 / 1 回: 序盤ブロックの直後（= 最後の序盤フェーズの後。§6.4 の「序盤 → ペース → 隊列」）
 * - 中盤 2 回以上: 中盤1 の直後（§6.4 の「中盤1 → 隊列 → 中盤2」。中盤 3・4 回も同規則）
 *
 * 序盤 2 回以上の構成は「序盤ブロック = 最後の序盤まで」の素直な拡張で解釈する
 * （TASK_INSTRUCTION 必須編集 B 指定）。隊列フェーズの実挿入は E4 スコープで、
 * 本関数は E3 ではペース位置候補の制限（§7.6「ペースは隊列より前」）にのみ使う。
 */
export const getFormationSlotAnchorId = (
    startPhaseCount: number,
    midPhaseCount: number,
): string =>
    midPhaseCount >= 2 ? 'Mid1' : getDefaultPacePosition(startPhaseCount);

/**
 * 有効アンカー候補（PhaseDescriptor[]）を返す。
 * 有効アンカー = 最後の終盤を除く全フェーズの直後（§7.5）。
 *
 * - end 後禁止: 非ペース列の末尾（= 最後の終盤）を除外する。
 * - start 前禁止: アンカーは「フェーズの直後」を表すため、構造上「最初の序盤より前」は表現されない。
 *
 * CR-SA-20-E3 / 2026-06-11: `enableFormationDice = true` のとき、隊列スロット（§6.4）より
 * 後ろのアンカーを除外する（§7.6「ペースは隊列より前」の UI 禁止側）。隊列スロットと同一
 * アンカーは許可する（§6.4 で「序盤 → ペース → 隊列」とペース・隊列が同一スロット帯に
 * ペース先行で共存するため、除外対象は「隊列より後ろになる位置」のみ）。
 * 省略時 false = 従来と完全同一（後方互換）。
 *
 * 非ペース列は常に序盤 ≥1 + 終盤 ≥1 で長さ ≥2 のため、最低 1 アンカーは必ず返る
 * （隊列 ON でも先頭は必ず序盤アンカーで、隊列スロットは序盤ブロック直後以降にあるため維持される）。
 */
export const getValidPaceAnchors = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    enableFormationDice = false,
): PhaseDescriptor[] => {
    const seq = getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount);
    const anchors = seq.slice(0, -1);
    if (!enableFormationDice) return anchors;
    const slotId = getFormationSlotAnchorId(startPhaseCount, midPhaseCount);
    const slotIdx = anchors.findIndex(a => a.id === slotId);
    // 隊列スロットがアンカー列に見つからない構成は理論上ない（序盤・中盤から導出するため）が、
    // 万一の場合は制限なし（後段の確定時バリデーションで捕捉）にフォールバックする。
    if (slotIdx === -1) return anchors;
    return anchors.slice(0, slotIdx + 1);
};

/**
 * ペース位置プルダウンの選択肢配列（有効アンカー + 「なし」）。
 * 並び: 各アンカー（時間順、ラベル「○○の後」）→ 末尾に「なし」。
 *
 * CR-SA-20-E3 / 2026-06-11: `enableFormationDice = true` で隊列スロット以降のアンカーを除外。
 * 「なし」は位置を持たないため隊列 ON でも候補に残す（scene1-setup.md L222 の除外対象は
 * 「隊列スロット以降の位置」。隊列 ON × なし の矛盾はエントリー確定ブロック L301 で捕捉する）。
 */
export const getPaceAnchorOptions = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    enableFormationDice = false,
): PaceAnchorOption[] => {
    const anchors = getValidPaceAnchors(startPhaseCount, midPhaseCount, endPhaseCount, enableFormationDice);
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
 *
 * CR-SA-20-E3 / 2026-06-11: `enableFormationDice = true` で隊列スロット以降のアンカーも
 * 無効扱いにする（§7.6 データブロック側）。省略時 false = 従来と完全同一。
 */
export const isPacePositionValid = (
    pacePosition: PacePosition,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    enableFormationDice = false,
): boolean => {
    if (pacePosition === null) return true;
    const anchorIds = new Set(
        getValidPaceAnchors(startPhaseCount, midPhaseCount, endPhaseCount, enableFormationDice).map(a => a.id),
    );
    return anchorIds.has(pacePosition);
};

/**
 * 回数変更後のペース位置を解決する（§7.5「無効になった場合デフォルト位置へ強制リセット」）。
 * 現在位置が有効ならそのまま保持、無効ならデフォルト（序盤ブロック直後）へ。
 * null（なし）は常に有効なので保持される。
 *
 * CR-SA-20-E3 / 2026-06-11: `enableFormationDice = true` を渡すと隊列スロット以降の位置も
 * 無効としてデフォルトへリセットする（隊列 ON 切替時の強制リセット。デフォルト位置 =
 * 序盤ブロック直後は構造上常に隊列スロット以前のため、リセット先は常に有効）。
 */
export const resolvePacePosition = (
    currentPacePosition: PacePosition,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    enableFormationDice = false,
): PacePosition => {
    if (isPacePositionValid(currentPacePosition, startPhaseCount, midPhaseCount, endPhaseCount, enableFormationDice)) {
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
 *
 * CR-SA-20-E3 / 2026-06-11: `enableFormationDice = true` でペース位置が隊列スロット以降の
 * 構成も不正と判定する（§7.6「ペースは隊列より前」のデータブロック側。隊列 ON × ペースなしは
 * 本関数の対象外で、専用エラー `validateFormationPacePosition`〔validator.ts〕が L301 文言で捕捉する）。
 */
export const isPhaseConfigValid = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
    enableFormationDice = false,
): boolean => {
    if (!Number.isInteger(startPhaseCount) || startPhaseCount < PHASE_COUNT_MIN || startPhaseCount > PHASE_COUNT_MAX) return false;
    if (!Number.isInteger(endPhaseCount) || endPhaseCount < PHASE_COUNT_MIN || endPhaseCount > PHASE_COUNT_MAX) return false;
    if (!Number.isInteger(midPhaseCount) || midPhaseCount < 0 || midPhaseCount > PHASE_COUNT_MAX) return false;
    if (!isPacePositionValid(pacePosition, startPhaseCount, midPhaseCount, endPhaseCount, enableFormationDice)) return false;
    return true;
};

/**
 * 「現在の構成」表示用に、ペースを挿入したフェーズラベル列を返す。
 * 例: 序盤 1 / 中盤 1 / 終盤 1 / pace='Start' → ['序盤', 'ペース', '中盤', '終盤']。
 * pacePosition=null（なし）の場合はペースを挿入しない。
 *
 * CR-SA-20-Followup / 2026-06-12: `enableFormationDice = true` のとき、隊列スロット
 * （§6.4、`getFormationSlotAnchorId`）の直後に `隊列` を挿入する。挿入規則は実走行の
 * フェーズ列生成 `buildPhaseSequence`（useRaceEngine.ts、E4）と同一: ループ内でペース
 * 判定 → 隊列判定の順に評価し、同一アンカー時はペース → 隊列順を構造的に保証する。
 * 省略時 false = 従来と完全同一（後方互換）。
 * pacePosition=null × 隊列 ON は禁止構成（E3 確定ブロック対象）だが、本関数は
 * buildPhaseSequence と同じく隊列のみ挿入して返す（表示と実走行の一致を最優先）。
 */
export const getPhaseConfigDisplayLabels = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
    enableFormationDice = false,
): string[] => {
    const formationSlot = enableFormationDice
        ? getFormationSlotAnchorId(startPhaseCount, midPhaseCount)
        : null;
    const seq = getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount);
    const labels: string[] = [];
    for (const phase of seq) {
        labels.push(phase.label);
        if (pacePosition !== null && phase.id === pacePosition) {
            labels.push('ペース');
        }
        if (formationSlot !== null && phase.id === formationSlot) {
            labels.push('隊列');
        }
    }
    return labels;
};
