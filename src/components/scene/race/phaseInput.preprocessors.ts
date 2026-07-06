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
import type { UniqueSkillType, DiceResult, UniqueDiceConfig, CustomUniqueSkill } from '../../../types';
import type { ParsedLine } from '../../../core/parser/interface';
import { stripStrategyAnnotations } from './specialStrategy.helpers';
// CR-SA-15-E2 / 2026-05-15: R-3 判定の固有期待値入力源（houseRules.uniqueDiceConfig）の
// フォールバック値（scene3-race.md §2 規則 R-3 改訂分）。
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    getExpectedUniqueDiceStr,
    getExpectedUniqueFixValue,
    // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
    // 序盤2回目以降（Start2〜）判定。フェーズ依存プレフィックス数チェックの許容数決定に使用。
    isSecondaryStartPhase,
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
    // CR-SA-21+22-E3 / 2026-07-06: カスタム固有スキル対応（scene3-race.md §2 規則 R-3 L218）。
    // 'Custom' 選択者の期待 (fixValue, diceStr) は customUniqueSkills 経由で取得する。
    // 'None' 選択者は helpers 側で expectedDiceStr = '' 返却 = R-3 isUniqueMatch が false に収束し
    // 既存 R-1/R-2 の baseDice 振り分けに自然委譲する（三段判定ロジック自体は不変）。
    customUniqueSkillId?: string,
    customUniqueSkills?: readonly CustomUniqueSkill[],
): DiceClassificationResult => {
    const result: DiceClassificationResult = {};
    if (parsedLines.length === 0) return result;

    const phaseMatches = isCurrentPhaseInUniquePhases(uniqueSkillPhases, currentPhaseId);
    const expectedDiceStr =
        uniqueSkillType !== undefined
            ? getExpectedUniqueDiceStr(uniqueSkillType, uniqueDiceConfig, customUniqueSkillId, customUniqueSkills)
            : '';
    const expectedFixValue =
        uniqueSkillType !== undefined
            ? getExpectedUniqueFixValue(uniqueSkillType, uniqueDiceConfig, customUniqueSkillId, customUniqueSkills)
            : 0;

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

/**
 * CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
 * 1 行の「dice」直前に連続する「数値+符号」プレフィックスの個数を数える純粋関数。
 *
 * SSoT: `scene3-race.md §2`「結果取り込み時の余分なプレフィックス検知」+
 *       `parser-system.md §A` 複数プレフィックス受理の拡張（フェーズ依存チェックは Parser 外）。
 *
 * Parser（不変厳守エリア）の文法に合わせ、`名前(区切り)(数値+符号)*(独立マイナス)?dice` の
 * `(数値+符号)*` 部分を greedy に切り出して個数を数える。名前部の数字や、大逃げ Fix なしの
 * dice 直前独立マイナス（`-dice`）はプレフィックスに含めない。
 *
 * - dice 行でない（`dice\d*d\d+` 非含有）→ `null`（チェック対象外）。
 * - プレフィックス領域を特定できない（区切りなし等）→ `0`。
 * - 固有ダイス行・絆スキル行は常に 0〜1 個のため、フェーズ許容数（最小 1）を超えず
 *   本チェックで誤検知しない（別系統として明示除外する必要はない）。
 */
export const countDicePrefixes = (line: string): number | null => {
    if (!/dice\d*d\d+/iu.test(line)) return null;
    // 区切り（半角/全角空白・🎲）の直後から dice までのプレフィックス列を greedy に捕捉。
    // 末尾の独立マイナス（-dice）は (?:-?\d+[+＋-]\s*)* の後段 -? で吸収しプレフィックスに数えない。
    const m = line.match(/[\s🎲]((?:-?\d+[+＋-]\s*)*)-?\s*dice\d*d\d+/iu);
    if (!m) return 0;
    const tokens = m[1].match(/-?\d+[+＋-]/gu);
    return tokens ? tokens.length : 0;
};

/**
 * CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
 * 現フェーズが要求するプレフィックス数を超える行（改変の疑い）を検出し、エラー文言を返す。
 *
 * SSoT: `scene3-race.md §2`「結果取り込み時の余分なプレフィックス検知」+ §「Error Handling」L349-352。
 *
 * フェーズ別許容プレフィックス数:
 *  - 先頭序盤（`Start` / `Start1`）・中盤（`Mid`〜）・終盤（`End`〜）= 1 個まで
 *  - 序盤2回目以降（`Start2`〜）= 2 個まで（`N+Z+dice`）
 *
 * ペース・隊列フェーズは `dice1d9` 全文検索の専用解析（プレフィックス概念なし）のため
 * 呼び出し側（RACE コンテキストのみ呼ぶ）で対象外とする。
 */
export const detectPhasePrefixViolations = (
    inputText: string,
    currentPhaseId: string,
): string[] => {
    const allowed = isSecondaryStartPhase(currentPhaseId) ? 2 : 1;
    const errors: string[] = [];
    const lines = inputText.split(/\r?\n/);
    for (const rawLine of lines) {
        // Parser と同じ前処理（trim + 単純 HTML タグ除去）で体裁を揃える。
        const line = rawLine.trim().replace(/<[^>]*>?/gm, '');
        if (!line) continue;
        const count = countDicePrefixes(line);
        if (count !== null && count > allowed) {
            errors.push(
                `・このフェーズで使用しないダイス形式です: "${line}"（中間値の前に余分な数値が付いていないか、レスを改変せず確認してください）`,
            );
        }
    }
    return errors;
};
// CR-SA-20-E4 / 2026-06-11: 隊列〔バ群〕ダイスの専用解析（houserule-features.md §6.6 +
// scene3-race.md §1 L117「隊列専用解析」）。
//
// ペース専用解析（StandardParser.parsePace）と同型: 「ダイスの行数チェック」「名前の照合」は
// 行わず、テキスト全体から `dice1d9` の結果のみを抽出する。正規表現はペース解析と同一
// （絵文字 🎲 プレフィックス許容）。parser 本体（standardParser / emojiParser）は不変厳守エリアの
// ため改修せず、解析前処理層（本ファイル）に隊列用の同型抽出を新設して配線する。
// ペースとは別フェーズで振る・解析するため衝突しない（§6.6「ペースダイスとの区別」）。
/** 隊列専用解析の結果。face = 確定した隊列出目（エラー時 null）。 */
export interface FormationDiceParseResult {
    face: number | null;
    errors: string[];
}
/**
 * テキスト全体から隊列ダイス `dice1d9` の結果を 1 件だけ抽出する。
 *
 * - 0 件: 欠落エラー（scene3-race.md Error Handling L361 文言固定）
 * - 2 件以上: 重複エラー（同 L364 文言固定）
 * - 1 件: face に出目を返す（範囲チェックはペース解析と同方針で行わない。範囲外出目は
 *   getFormationLabel = '不明' / getFormationModifier = 0 のフォールバックで安全側に倒れる）
 *
 * 解析時点では合計スコアへの加減算を行わない（呼び出し側も setFormationResult のみで
 * score 再計算を行わない。反映は隊列直後フェーズへの遷移時、§6.5）。
 */
export const parseFormationDiceText = (text: string): FormationDiceParseResult => {
    const regex = /(?:🎲)?\s*dice1d9\s*=\s*(\d+)/g;
    const matches = [...text.matchAll(regex)];
    if (matches.length === 0) {
        return {
            face: null,
            errors: ['・隊列ダイス(dice1d9)が見つかりません。コピー漏れがないか確認してください'],
        };
    }
    if (matches.length > 1) {
        return {
            face: null,
            errors: ['・複数の隊列ダイスが検出されました。内容を確認してください'],
        };
    }
    return { face: parseInt(matches[0][1], 10), errors: [] };
};
