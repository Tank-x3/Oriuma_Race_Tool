// Bundle-8-T5 / CR-SA-4 / 2026-05-10: 絆スキル Parser 拡張用の独立型定義
// （scene3-race.md §2「絆スキル出力セクション」+ houserule-features.md §2 [v] 絆スキル §データ仕様）。
//
// `interface.ts`（ParsedLine / ParseResult / ParserStrategy）は不変厳守エリア。
// 本ファイルは新規追加 helper 型として独立配置し、ParseResult を共変的に拡張する。
//
// ParserStrategy.parse() のシグネチャは ParseResult を返す形のまま、StandardParser / EmojiParser 内部で
// ParseResultWithBond を返すことで TypeScript の構造的サブタイプ整合を保ち、PhaseInput 側で
// bondResults プロパティを参照可能にする。
import type { ParseResult } from './interface';
import type { Umamusume } from '../../types';

export type BondSkillType = 'BondGamble' | 'BondStable';

/**
 * 【絆スキル】セクションから抽出した 1 行分のダイス結果。
 * 通常 / 固有ダイス用の `ParsedLine` とは責務が独立した構造。
 *
 * - `diceStr` は `1d15`（絆ギャンブル）または `1d5`（絆安定）
 * - `sum` は `history.End.bondDice.sum` に格納する値（fix value 込みの total）
 *   - 絆ギャンブル `dice1d15=12` → `sum = 12`
 *   - 絆安定 `5+dice1d5=8` → `sum = 8`（fix 5 + 出目 3 の例）
 * - スコア最終加算ロジックは Bundle-8-T6 で実装（本 T5 では格納のみ）。
 */
export interface BondParsedLine {
    originalText: string;
    participantId: string;
    name: string;
    type: BondSkillType;
    diceStr: string;
    diceResult: number;
    sum: number;
}

/**
 * StandardParser / EmojiParser の戻り値拡張。
 * `ParseResult` のサブタイプとして、ParserStrategy interface 互換を保ったまま
 * 絆スキル抽出結果を呼び出し側へ渡す経路を提供する。
 */
export interface ParseResultWithBond extends ParseResult {
    bondResults?: BondParsedLine[];
}

/**
 * 【絆スキル】セクションヘッダー文字列（Parser 認識対象、scene3-race.md §2 SSoT 固定文字列）。
 */
export const BOND_SKILL_SECTION_HEADER = '【絆スキル】';

/**
 * 種別ラベル → BondSkillType の対応表（scene3-race.md §2 SSoT、4 種固定）。
 * `bondSkill.helpers.ts#getBondSkillTypeLabel` の逆引き。
 */
export const BOND_SKILL_LABEL_TO_TYPE: Record<string, BondSkillType> = {
    '絆ギャンブル': 'BondGamble',
    '絆安定': 'BondStable',
};

/**
 * 【絆スキル】セクション内の 1 行を解析して `BondParsedLine` を返す純粋関数。
 *
 * StandardParser / EmojiParser 双方から呼び出される共通 helper。
 *
 * 認識対象フォーマット:
 *   `[枠番] [名前]　[種別ラベル]　[fix]+dice[X]d[Y]= [出目] ([総和])`
 *   例: `① ウマ娘A　絆ギャンブル　dice1d15=12 (12)` / `③ ウマ娘C　絆安定　5+dice1d5=3 (3)`
 *
 * 戻り値:
 *  - `{ line: BondParsedLine }`  → 正常抽出
 *  - `{ error: string }`         → 解析エラー（呼び出し側 errors 配列へ追加）
 *  - `{}`                        → ダイス式未含有行（無視、エラー扱いしない）
 *
 * 呼び出し側責務: `currentPhaseId === 'End'` かどうかの phase 抑制は本関数では扱わない（PhaseInput 側で実施）。
 */
export const parseBondSkillLineFromText = (
    cleanLine: string,
    participants: Umamusume[],
): { line?: BondParsedLine; error?: string } => {
    // 88-ch 形式 `② D　絆安定　5+🎲 dice1d5= 1` のように fix の後に `🎲` + 空白が
    // 入る実用パターンに対応するため、fix の後 / 負号の前後に `[\s🎲]*` を許容する。
    const regex = /^(.*?)[\s🎲]+(?:(-?\d+)([+＋-]))?[\s🎲]*(-)?[\s🎲]*dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((-?\d+)\))?$/iu;
    const match = cleanLine.match(regex);

    if (!match) {
        if (/dice\d*d\d+/i.test(cleanLine)) {
            return { error: `Invalid dice format: "${cleanLine}"` };
        }
        return {};
    }

    const [, nameRaw, fixRaw, fixOperator, negativeSign, diceStr, rollRaw, parensRaw] = match;
    const fixValue = fixRaw ? parseInt(fixRaw, 10) : 0;
    const isSubtractive = fixOperator === '-' || Boolean(negativeSign);
    let diceResult = 0;

    // 絆スキル行の (N) 末尾検算は仕様 §2 SSoT で必須化されていないため、(N) ありなら検算、
    // (N) なしなら範囲チェック（X ≤ |合計| ≤ X×Y、CR-SA-10 Multi-line Case B 同方針）で通過させる。
    // 88-ch bot 出力例: `② D　絆安定　5+🎲 dice1d5= 1` のように (N) 省略が実用上発生する。
    const diceMatch = diceStr.match(/(\d*)d(\d+)/i);
    const diceCount = diceMatch && diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
    const diceFaces = diceMatch ? parseInt(diceMatch[2], 10) : 0;
    const diceValues = rollRaw.trim().split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
    if (diceValues.length === 0) {
        return { error: `ダイス値を読み取れませんでした: "${rollRaw}"` };
    }
    if (diceValues.length !== diceCount) {
        return { error: `ダイスの個数が一致しません (期待: ${diceCount}個, 検出: ${diceValues.length}個)` };
    }
    const invalidDice = diceValues.filter((v) => v < 1 || v > diceFaces);
    if (invalidDice.length > 0) {
        return { error: `不正なダイス値があります (1~${diceFaces}の範囲外: ${invalidDice.join(', ')})` };
    }
    let val = diceValues.reduce((acc, cur) => acc + cur, 0);

    if (parensRaw) {
        // (N) ありの場合: dice 出目総和との一致を検算
        const checkVal = parseInt(parensRaw, 10);
        if (Math.abs(val) !== Math.abs(checkVal)) {
            return { error: `ダイス合計値が不正です (計算値: ${val}, 記載値: ${checkVal})` };
        }
    } else {
        // (N) なしの場合: 範囲チェック (X ≤ |合計| ≤ X×Y)
        const lowerBound = diceCount;
        const upperBound = diceCount * diceFaces;
        if (Math.abs(val) < lowerBound || Math.abs(val) > upperBound) {
            return {
                error: `ダイス合計値が範囲外です (${diceStr}: 合計 ${val} は ${lowerBound}〜${upperBound} の範囲外)`,
            };
        }
    }

    if (isSubtractive) {
        val = -Math.abs(val);
    }
    diceResult = val;

    const total = fixValue + diceResult;
    const cleanedName = nameRaw.replace(/^[①-⑳0-9.]+\s*/u, '').trim();

    let bondType: BondSkillType | null = null;
    let nameWithoutLabel = cleanedName;
    for (const [label, type] of Object.entries(BOND_SKILL_LABEL_TO_TYPE)) {
        if (cleanedName.includes(label)) {
            bondType = type;
            // 全角スペース U+3000 / 半角スペースを端から除去（`\s` は Unicode space で U+3000 をマッチ）
            nameWithoutLabel = cleanedName.replace(label, '').replace(/^\s+|\s+$/g, '');
            break;
        }
    }
    if (!bondType) {
        return { error: `絆スキル種別ラベルが認識できません: "${cleanLine}"` };
    }
    const participant = participants.find((p) => p.name === nameWithoutLabel);
    if (!participant) {
        return { error: `・登録名と一致しないデータが含まれています: "${nameWithoutLabel}"` };
    }

    return {
        line: {
            originalText: cleanLine,
            participantId: participant.id,
            name: nameWithoutLabel,
            type: bondType,
            diceStr,
            diceResult,
            sum: total,
        },
    };
};
