// CR-SA-11-Sub-B-E1 / 2026-05-11: PhaseInput.tsx 解析前処理層（preprocessor）。
// 仕様根拠: work_logs/issues/CR-SA-11/timeline.md §SA21（案 2 = 抽象化レイヤー導入 採択）。
//
// 本ファイルは React UI（PhaseInput.tsx）と解析前処理を分離するための層。
// 既存純粋関数（stripStrategyAnnotations / getExpectedUniqueDiceStr）は存置し、
// preprocessor 層から呼び出す形で再構成する（重複定義なし）。
//
// 将来の Provisional 拡張ポイント:
// Bundle-8 以降のハウスルール拡張で新たな解析前処理が必要になった場合、
// PhaseInput.tsx 本体に直接書き込まず本ファイルに純粋関数として追加する。
import type { UniqueSkillType } from '../../../types';
import { stripStrategyAnnotations } from './specialStrategy.helpers';
import { getExpectedUniqueDiceStr } from './phaseOutput.helpers';

/**
 * Parser 入力前のサニタイズ。戦法併記（` 【捲り】±N` / ` 【溜め】±N`）を除去する。
 *
 * Bundle-4 ENG28 由来: 実 GM 運用では掲示板投稿前に戦法を宣言（PhaseOutput 併記）
 * する必要があり、解析対象テキストに戦法併記が含まれる。Parser を不変厳守エリアから
 * 外せないため、解析前処理として preprocessor 層で除去する。
 */
export const sanitizeInputForParser = (inputText: string): string => {
    return stripStrategyAnnotations(inputText);
};

/**
 * 解析結果のダイス式が参加者の拡張固有タイプの期待ダイス式と一致するかを判定する。
 *
 * Bundle-2 ENG25 由来: 既存の d10/d20 ヒューリスティックでは SuperGamble (1d35) /
 * SuperStability (1d3) を捕捉できないため、参加者の固有タイプから期待ダイス式を
 * 逆引きして完全一致で判定する。拡張固有タイプを含む 5 種網羅。
 *
 * - `uniqueSkillType === undefined` → `false`（防御的）
 * - `getExpectedUniqueDiceStr` が空文字を返す型 → `false`
 * - 完全一致 → `true`
 */
export const isUniqueDice = (
    uniqueSkillType: UniqueSkillType | undefined,
    diceStr: string
): boolean => {
    if (uniqueSkillType === undefined) return false;
    const expectedUniqueDiceStr = getExpectedUniqueDiceStr(uniqueSkillType);
    return expectedUniqueDiceStr !== '' && diceStr === expectedUniqueDiceStr;
};
