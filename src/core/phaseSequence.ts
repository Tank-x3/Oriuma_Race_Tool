// CR-SA-17-E2 / 2026-06-07: 非ペースフェーズ列生成の統一ヘルパー
// （houserule-features.md §7.3 フェーズ ID 命名規則 + §7.4 ダイス適用 + §7.7 既存ロジックの一般化対象）。
//
// 従来、序盤 1・終盤 1 固定前提の同一ロジックが 3 か所に重複していた
// （calculator.ts getActivePhaseIds / validator.ts getAvailablePhaseIds /
//  EntryForm.tsx availablePhases）。本モジュールがその SSoT となり 3 重複を集約する
// （Bundle-3-Followup-getAvailablePhaseIds-dedup 解消）。
//
// 「非ペース列」= ペースフェーズを含まない、score 合算・固有発動位置選択・
// 持続型連続性検証の対象となるフェーズ列。ペース挿入は E4、§7.5 アンカー解決は E3。

/** 非ペースフェーズ 1 件の記述子（ID + 表示ラベル）。 */
export interface PhaseDescriptor {
    id: string;
    label: string;
}

/**
 * 1 つのフェーズ種別ブロック（序盤 / 中盤 / 終盤）を §7.3 命名規則で生成する。
 *
 * - count <= 0: 空（中盤 0 回のケース。序盤・終盤は値域 1〜4 のため通常 0 にならない）
 * - count === 1: 単一 ID（接尾辞なし、例: `Start` / ラベル '序盤'）
 * - count >= 2: 連番 ID（例: `Start1` / `Start2` / ラベル '序盤1' / '序盤2'）
 */
const buildPhaseBlock = (
    count: number,
    singleId: string,
    label: string,
): PhaseDescriptor[] => {
    if (count <= 0) return [];
    if (count === 1) return [{ id: singleId, label }];
    const out: PhaseDescriptor[] = [];
    for (let i = 1; i <= count; i++) {
        out.push({ id: `${singleId}${i}`, label: `${label}${i}` });
    }
    return out;
};

/**
 * 序盤・中盤・終盤回数から非ペースフェーズ列（ラベル付き）を §7.3 命名規則で生成する。
 *
 * 例:
 * - (1, 0, 1) → [序盤, 終盤]
 * - (1, 1, 1) → [序盤, 中盤, 終盤]（= 現行 OFF 時の固定構成）
 * - (1, 2, 1) → [序盤, 中盤1, 中盤2, 終盤]
 * - (2, 1, 1) → [序盤1, 序盤2, 中盤, 終盤]
 * - (1, 2, 2) → [序盤, 中盤1, 中盤2, 終盤1, 終盤2]
 *
 * 序盤 = 終盤 = 1（OFF 時の固定値）のとき、現行の `getActivePhaseIds` /
 * `getAvailablePhaseIds` / `availablePhases` と完全に同一の列を返す（OFF 透過の核心）。
 */
export const getNonPacePhaseSequence = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): PhaseDescriptor[] => [
    ...buildPhaseBlock(startPhaseCount, 'Start', '序盤'),
    ...buildPhaseBlock(midPhaseCount, 'Mid', '中盤'),
    ...buildPhaseBlock(endPhaseCount, 'End', '終盤'),
];

/**
 * `getNonPacePhaseSequence` から ID のみを抽出した列を返す。
 * id のみ必要な呼び出し側（score 合算 / 連続性検証）のための薄い導出ヘルパー。
 */
export const getNonPacePhaseIds = (
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
): string[] =>
    getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount).map(p => p.id);
