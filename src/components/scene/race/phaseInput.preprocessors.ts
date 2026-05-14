// CR-SA-11-Sub-B-E1 / 2026-05-11: PhaseInput.tsx 解析前処理層（preprocessor）。
// 仕様根拠: work_logs/issues/CR-SA-11/timeline.md §SA21（案 2 = 抽象化レイヤー導入 採択）。
//
// 本ファイルは React UI（PhaseInput.tsx）と解析前処理を分離するための層。
// 既存純粋関数（stripStrategyAnnotations / getExpectedUniqueDiceStr）は存置し、
// preprocessor 層から呼び出す形で再構成する（重複定義なし）。
//
// CR-SA-13-E1 / 2026-05-12: ダイス振り分けロジック（規則 R-1 / R-2 / R-3）を追加。
// SSoT = scene3-race.md §2「結果取り込み時のダイス振り分け」（SA22 新設）+
//        houserule-features.md §1「ダイス式衝突時の動作」（SA22 新設）+
//        houserule-features.md §2 [v] 拡張固有タイプ（固有期待 fixValue / diceStr SSoT）。
// 旧 isUniqueDice（ヒューリスティック完全一致判定）は export 維持で残置するが、
// 新規 classifyDiceResultsForParticipant では呼び出さない（R-3 で fixValue + diceStr の
// 組合せ完全一致を直接判定するため重複利用を避ける）。
import type { UniqueSkillType, DiceResult, UniqueDiceConfig } from '../../../types';
import type { ParsedLine } from '../../../core/parser/interface';
import { stripStrategyAnnotations } from './specialStrategy.helpers';
// CR-SA-15-E2 / 2026-05-15: R-3 判定の固有期待値入力源（houseRules.uniqueDiceConfig）の
// フォールバック値（scene3-race.md §2 規則 R-3 改訂分）。
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    getExpectedUniqueDiceStr,
    getExpectedUniqueFixValue,
} from './phaseOutput.helpers';

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
 *
 * CR-SA-13-E1 / 2026-05-12: 本関数は diceStr 単独完全一致のヒューリスティックで、
 * ハウスルール脚質ダイス × 固有期待ダイス衝突時に誤判定するため、
 * PhaseInput.tsx:handleParse 内では呼び出さなくなった（既存テスト互換性のため export 維持）。
 * 新規振り分けロジックは {@link classifyDiceResultsForParticipant} を参照のこと。
 *
 * CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（houserule-features.md §5.4）。
 * `uniqueDiceConfig` を末尾オプショナル引数で受け取り `getExpectedUniqueDiceStr` へ伝播する。
 * 省略時は `DEFAULT_UNIQUE_DICE_CONFIG` フォールバック。
 */
export const isUniqueDice = (
    uniqueSkillType: UniqueSkillType | undefined,
    diceStr: string,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG
): boolean => {
    if (uniqueSkillType === undefined) return false;
    const expectedUniqueDiceStr = getExpectedUniqueDiceStr(uniqueSkillType, uniqueDiceConfig);
    return expectedUniqueDiceStr !== '' && diceStr === expectedUniqueDiceStr;
};

/**
 * CR-SA-13-E1 / 2026-05-12: 現フェーズが当該参加者の固有スキル発動フェーズに含まれるかを
 * 判定する純粋関数。`uniqueSkill.phases` には通常フェーズ ID（'Start' / 'Mid1' / 'End' 等）が
 * 保存されるが、日本語ラベル（'序盤' / '中盤' / '終盤' / 'Mid' 集約形）が混在する可能性も
 * RaceScene.tsx の `hasMismatch` チェックと同等に防御的に許容する。
 *
 * 判定仕様（SSoT = scene3-race.md §2 規則 R-1〜R-3 の現フェーズ照合部分）:
 * - phases に `currentPhaseId` が含まれる場合 → true
 * - currentPhaseId === 'Start' かつ phases に '序盤' が含まれる場合 → true
 * - currentPhaseId が 'Mid' で始まり、phases に 'Mid' or '中盤' が含まれる場合 → true
 * - currentPhaseId === 'End' かつ phases に '終盤' が含まれる場合 → true
 */
export const isCurrentPhaseInUniquePhases = (
    phases: readonly string[],
    currentPhaseId: string,
): boolean => {
    if (phases.includes(currentPhaseId)) return true;
    if (currentPhaseId === 'Start' && phases.includes('序盤')) return true;
    if (currentPhaseId.startsWith('Mid') && (phases.includes('Mid') || phases.includes('中盤'))) return true;
    if (currentPhaseId === 'End' && phases.includes('終盤')) return true;
    return false;
};

/**
 * CR-SA-13-E1 / 2026-05-12: 1 参加者宛の Parser 結果を「フェーズダイス枠（baseDice）」と
 * 「固有ダイス枠（uniqueDice）」へ振り分ける純粋関数。
 *
 * SSoT: scene3-race.md §2「結果取り込み時のダイス振り分け」+
 *       houserule-features.md §1「ダイス式衝突時の動作」（cross-reference）。
 *
 * 三段判定（順次 parsedLines 走査時に各 line ごとに適用）:
 * - **R-1「発動フェーズ非該当者の不可侵性」**: `isCurrentPhaseInUniquePhases` が false の場合、
 *   当該 line は常に `baseDice` 枠に格納する（複数 line 到達時は最後の line で上書き）。
 *   `uniqueDice` 枠は当該フェーズで更新されない。
 * - **R-2「発動フェーズ該当者の base 優先原則」**: 発動フェーズ該当 + `baseDice` 未設定状態で
 *   1 件目の line が到達した場合、ダイス式が固有期待と一致しても `baseDice` 枠に格納する
 *   （フェーズダイス未取得状態での固有先取りを抑止）。
 * - **R-3「同一ブロック貼付時の振り分け」**: `baseDice` 既存状態で追加 line が到達した場合、
 *   `(fixValue, diceStr)` の組が固有期待 `(uniqueFixValue, uniqueDiceStr)` と完全一致なら
 *   `uniqueDice` 枠に振り分け、それ以外は `baseDice` 枠に上書きする。`uniqueDice` が既に
 *   設定済の場合は防御的に `baseDice` 枠へフォールバック。
 *
 * CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（scene3-race.md §2 規則 R-3 改訂分）。
 * 規則 R-3 の `(fixValue, diceStr)` 完全一致判定の入力源を `uniqueDiceConfig` に切り替え。
 * 三段判定ロジック自体は不変、固有期待値の入力源のみ差し替え。`uniqueDiceConfig` 省略時は
 * `DEFAULT_UNIQUE_DICE_CONFIG` フォールバック。
 *
 * @param uniqueSkillType 当該参加者の固有スキルタイプ（undefined のとき R-3 は常に baseDice 振り分け）
 * @param uniqueSkillPhases 当該参加者の固有スキル発動フェーズ配列
 * @param parsedLines 当該参加者宛にグループ化された Parser 結果（順序を保持）
 * @param currentPhaseId 現在のフェーズ ID
 * @param existingBaseDice 当該フェーズに既に格納されている baseDice（未設定なら undefined）
 * @param uniqueDiceConfig 固有スキル設定（R-3 の固有期待値入力源、省略時はデフォルト）
 * @returns 振り分け後の baseDice / uniqueDice（undefined は当該枠を更新しないことを表す）
 */
export interface DiceClassificationResult {
    baseDice?: DiceResult;
    uniqueDice?: DiceResult;
}

export const classifyDiceResultsForParticipant = (
    uniqueSkillType: UniqueSkillType | undefined,
    uniqueSkillPhases: readonly string[],
    parsedLines: ReadonlyArray<Pick<ParsedLine, 'diceStr' | 'diceResult' | 'fixValue'>>,
    currentPhaseId: string,
    existingBaseDice: DiceResult | undefined,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG,
): DiceClassificationResult => {
    const result: DiceClassificationResult = {};
    if (parsedLines.length === 0) return result;

    const phaseMatches = isCurrentPhaseInUniquePhases(uniqueSkillPhases, currentPhaseId);
    const expectedDiceStr =
        uniqueSkillType !== undefined ? getExpectedUniqueDiceStr(uniqueSkillType, uniqueDiceConfig) : '';
    const expectedFixValue =
        uniqueSkillType !== undefined ? getExpectedUniqueFixValue(uniqueSkillType, uniqueDiceConfig) : 0;

    const toDiceResult = (
        line: Pick<ParsedLine, 'diceStr' | 'diceResult'>,
    ): DiceResult => ({
        diceStr: line.diceStr,
        values: [],
        sum: line.diceResult,
    });

    let baseDice: DiceResult | undefined = existingBaseDice;
    let uniqueDice: DiceResult | undefined = undefined;

    for (const line of parsedLines) {
        if (!phaseMatches) {
            // R-1: 発動フェーズ非該当 → 常に baseDice 枠（uniqueDice 不可侵）
            baseDice = toDiceResult(line);
            result.baseDice = baseDice;
            continue;
        }

        if (baseDice === undefined) {
            // R-2: 発動フェーズ該当 + baseDice 未設定 → base 優先（先取り抑止）
            baseDice = toDiceResult(line);
            result.baseDice = baseDice;
            continue;
        }

        // R-3: baseDice 既存 → (fixValue, diceStr) 完全一致で振り分け
        const isUniqueMatch =
            uniqueSkillType !== undefined &&
            expectedDiceStr !== '' &&
            line.diceStr === expectedDiceStr &&
            line.fixValue === expectedFixValue;

        if (isUniqueMatch && uniqueDice === undefined) {
            uniqueDice = toDiceResult(line);
            result.uniqueDice = uniqueDice;
        } else {
            // 不一致 or uniqueDice 既設定 → baseDice 上書き
            baseDice = toDiceResult(line);
            result.baseDice = baseDice;
        }
    }

    return result;
};
