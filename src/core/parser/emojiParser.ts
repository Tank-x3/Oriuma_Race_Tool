import { StandardParser } from './standardParser';
import type { ParserStrategy, ParsedLine } from './interface';
import type { Umamusume } from '../../types';
// Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクション認識（scene3-race.md §2 + parser-system.md §B）
import {
    BOND_SKILL_SECTION_HEADER,
    parseBondSkillLineFromText,
    type BondParsedLine,
    type ParseResultWithBond,
} from './bondTypes';

// Multi-line Case B の合計行処理時にヘッダー由来情報（減算フラグ + 個数 X / 面数 Y）を
// currentBlock 経由で参照するためのローカル拡張型（CR-SA-10-Followup-F1 / 2026-05-09）。
// CR-SA-10-Followup-F4-E1 / 2026-05-11: 個別出目検算 (`Σ === Math.abs(diceSum)` + `length === _diceCount`)
// のため、個別出目行で抽出した数値列を `_individualDice` に保持する。
type ParserBlock = Partial<ParsedLine> & {
    _isSubtractive?: boolean;
    _diceCount?: number;
    _diceFaces?: number;
    _individualDice?: number[];
};

// CR-SA-10-Followup-F4-E1 / 2026-05-11: 個別出目行検出パターン（半角・全角コロン両対応、
// 先頭空白許容、`N回目: M` 形式の `M` を抽出。SA21 SSoT parser-system.md §B Step 2 Case B 準拠）
const INDIVIDUAL_DICE_PATTERN = /^\s*\d+\s*回目\s*[:：]\s*(-?\d+)\s*$/;

export class EmojiParser implements ParserStrategy {
    parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE'): ParseResultWithBond {
        // Delegate PACE parsing to StandardParser (Global search)
        if (context === 'PACE') {
            return StandardParser.parse(text, participants, context);
        }

        const results: ParsedLine[] = [];
        const bondResults: BondParsedLine[] = [];
        const errors: string[] = [];
        const lines = text.split(/\r?\n/);

        let currentBlock: ParserBlock | null = null;
        // Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクション認識フラグ
        // セクション中は既存 currentBlock state machine をスキップし、helper 経由で bondResults に格納する。
        let inBondSection = false;

        // 未完了ブロック（合計行未到達）をエラーとして報告するヘルパー。
        // 新ヘッダー検出時 / ファイル末尾の両方で使用する（仕様: parser-system.md §B Step 3）。
        const reportIncompleteBlock = (block: ParserBlock) => {
            if (block.total === undefined && block.diceResult === undefined) {
                errors.push(`データの解析に失敗しました（合計行が見つかりません）: "${block.name}"`);
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクションヘッダー検出（前処理として最優先）
            // セクション境界に到達したら、未完了の currentBlock を errors へ報告してリセットする。
            if (trimmed === BOND_SKILL_SECTION_HEADER) {
                if (currentBlock) {
                    reportIncompleteBlock(currentBlock);
                    currentBlock = null;
                }
                inBondSection = true;
                continue;
            }
            if (/^【[^】]+】$/u.test(trimmed)) {
                if (currentBlock) {
                    reportIncompleteBlock(currentBlock);
                    currentBlock = null;
                }
                inBondSection = false;
                continue;
            }

            // Bundle-8-T5 / CR-SA-4 / 2026-05-10: セクション中は既存 state machine 全体をスキップして helper 経由で抽出
            if (inBondSection) {
                const parsed = parseBondSkillLineFromText(trimmed, participants);
                if (parsed.error) {
                    errors.push(parsed.error);
                } else if (parsed.line) {
                    bondResults.push(parsed.line);
                }
                continue;
            }

            // Step 1: Header Detection
            // Pattern: [Name] [Fix+]🎲 [-]dice[XdY]= [Result?]
            // Anchor: 'dice' followed by digits 'd' digits
            // Modified: Allow spaces around '=' (e.g., "dice1d12= 7")
            // Modified: Allow optional negative sign before dice (e.g., "-dice")
            // CR-SA-10 / 2026-05-08 SA 改訂（事項 #3-2-E 反映）:
            //   個数 X / 面数 Y を別キャプチャ化し、Step 2 Case A の範囲チェック (X ≤ N ≤ X×Y) で利用する。
            const diceMatch = trimmed.match(/(?:🎲)?\s*(-)?dice(\d+)d(\d+)\s*=\s*(\d+)?/);

            if (diceMatch) {
                // 直前ブロックが合計行未到達のまま新ヘッダーに到達したケースを Critical 化（#3-2-C）
                if (currentBlock) {
                    reportIncompleteBlock(currentBlock);
                }

                // Parse Header
                const negativeSign = diceMatch[1];                     // Group 1: (-) 減算マーカー
                const diceCount = parseInt(diceMatch[2], 10);          // Group 2: ダイス個数 X
                const diceFaces = parseInt(diceMatch[3], 10);          // Group 3: ダイス面数 Y
                const diceStr = `${diceCount}d${diceFaces}`;           // 再構築（CR-SA-10 / 2026-05-08 SA 改訂）
                const rawInlineResult = diceMatch[4] ? parseInt(diceMatch[4], 10) : undefined;

                let inlineResult = rawInlineResult;
                if (inlineResult !== undefined && negativeSign) {
                    inlineResult = -Math.abs(inlineResult);
                }

                // Extract Name & Fix Value
                // Everything before the match index is Name + Fix
                const preMatch = trimmed.substring(0, diceMatch.index).trim();

                // Check if ends with "Fix+" or "Fix-"
                // Modified: Capture operator (+ or -)
                // Regex: (.*?)(\d+)([+-])\s*$
                // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION REQUIRED 案 V Provisional 適用]:
                // 拡張固有タイプ「超ギャンブル (-10+dice1d35=)」等の負の Fix value を捕捉できるよう
                // (\d+) → (-?\d+) に拡張。既存の正の Fix value 挙動は完全互換（-? は optional）。
                // 仕様 SSoT (parser-system.md §B Step 1) は本 Bundle スコープ外、PM46/SA 判断委ね。
                const fixMatch = preMatch.match(/^(.*?)(-?\d+)([+-])\s*$/);

                let nameRaw = preMatch;
                let fixValue = 0;
                let isFixPlus = true; // Default to plus

                if (fixMatch) {
                    nameRaw = fixMatch[1].trim();
                    fixValue = parseInt(fixMatch[2], 10);
                    const operator = fixMatch[3];
                    if (operator === '-') {
                        isFixPlus = false;
                    }
                } else if (preMatch.includes(' ')) {
                    // fallback if space separation?
                    // But maybe no fix value.
                }

                // 演算子がマイナスの場合、インライン結果を負数に変換
                // 複数行の場合は currentBlock._isSubtractive で合計行処理時に適用
                if (inlineResult !== undefined && !isFixPlus) {
                    inlineResult = -Math.abs(inlineResult);
                }


                // Clean name (remove ② circle numbers etc if requirement say so? 
                // Requirement: "Input text contains '🎲' -> 88-ch". 
                // "Extract Name... anchor left".
                // We should match against participants.

                // Find participant
                // Simple exact match first, then fuzzy? StandardParser does fuzzy?
                // Let's rely on finding matching name from participants list.
                let matchedParticipantId = '';
                let matchedName = nameRaw;

                // Strip leading numbers/symbols common in 88-ch (e.g. "202: " or "② ")
                // But "②" might be part of the post, NOT the name.
                // Requirement says "①Silence Suzuka" -> Name is "Silence Suzuka".
                const cleanName = nameRaw.replace(/^[\d+①-⑳:：.]+\s*/, '');

                const participant = participants.find(p => p.name === cleanName || nameRaw.includes(p.name));

                if (!participant) {
                    // 名前不一致は即座にエラーとし、ブロックは作成しない（#1-2-6 / StandardParser:233-238 と挙動を対称化）
                    errors.push(`・登録名と一致しないデータが含まれています: "${cleanName}"`);
                    currentBlock = null;
                    continue;
                }

                matchedParticipantId = participant.id;
                matchedName = participant.name; // Normalize to registered name

                currentBlock = {
                    originalText: trimmed,
                    participantId: matchedParticipantId,
                    name: matchedName,
                    diceStr,
                    fixValue,
                    diceResult: inlineResult, // Might be undefined
                    total: inlineResult ? (fixValue + inlineResult) : undefined,
                };
                // 複数行フォーマットで減算フラグを保持（合計行処理時に参照）
                currentBlock._isSubtractive = !isFixPlus;
                // CR-SA-10-Followup-F1 / 2026-05-09: Multi-line Case B の範囲チェック用に
                // Step 1 で取得した個数 X / 面数 Y を currentBlock に保持する（合計行処理時に参照）。
                currentBlock._diceCount = diceCount;
                currentBlock._diceFaces = diceFaces;
                // CR-SA-10-Followup-F4-E1 / 2026-05-11: 個別出目行（N回目: M）を順次格納するための配列を初期化。
                // 合計行処理時に Σ === Math.abs(diceSum) + length === _diceCount で検算する。
                currentBlock._individualDice = [];

                // If inline result was present, it's a single line entry (Standard-ish mixed in)
                if (inlineResult !== undefined) {
                    // Check if (Total) exists in same line?
                    // Test case: "15+🎲 dice3d6=18 (33)"
                    const totalMatch = trimmed.match(/\((\d+)\)$/);
                    if (totalMatch) {
                        currentBlock.total = parseInt(totalMatch[1], 10);
                        // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional / CR-SA-10-Followup-F2-E1 先取り実装]:
                        // (N) はダイス出目の総和を表す（StandardParser §A / parser-system.md §B 改訂版 SA12 確定）。
                        // 旧ロジック (fixValue + diceResult === total) は Stability/Gamble の偶然成立で動作していたが、
                        // 拡張固有タイプ (-10+dice1d35=28 (28)) 等で破綻するため、StandardParser と検算式を統一する。
                        // 減算ケース (N) は絶対値で比較（StandardParser:200-204 と同方針）。
                        const absDiceResult = Math.abs(currentBlock.diceResult!);
                        const absTotal = Math.abs(currentBlock.total);
                        currentBlock.validChecksum = absDiceResult === absTotal;
                        results.push(currentBlock as ParsedLine);
                        currentBlock = null; // Reset
                    } else {
                        // CR-SA-10 / 2026-05-08 SA 改訂（事項 #3-2-D 反映）:
                        //   (N) なし時は X ≤ |diceResult| ≤ X×Y の範囲チェックを行う。
                        //   範囲外の場合は validChecksum=false + errors に範囲外文言を追加し、
                        //   results には push しない（下流のスコア計算へ異常値を流さないため）。
                        //   減算ケース（diceResult が負数化済）は絶対値で範囲を判定する。
                        const diceResultValue = currentBlock.diceResult!;
                        const lowerBound = diceCount;
                        const upperBound = diceCount * diceFaces;
                        const valueForRangeCheck = Math.abs(diceResultValue);
                        if (valueForRangeCheck < lowerBound || valueForRangeCheck > upperBound) {
                            currentBlock.validChecksum = false;
                            errors.push(
                                `ダイス合計値が範囲外です: "${currentBlock.name}" (${diceStr}: 合計 ${diceResultValue} は ${lowerBound}〜${upperBound} の範囲外。コピー範囲を確認してください)`
                            );
                            currentBlock = null;
                        } else {
                            // 範囲内: 現行通り total 自動算出 + validChecksum=true で push
                            currentBlock.total = currentBlock.fixValue! + currentBlock.diceResult!;
                            currentBlock.validChecksum = true;
                            results.push(currentBlock as ParsedLine);
                            currentBlock = null;
                        }
                    }
                }
            }
            else if (currentBlock) {
                // Step 2: Result Extraction (Multi-line Body)

                // CR-SA-10-Followup-F4-E1 / 2026-05-11: 個別出目行（N回目: M）の検出と収集。
                // SA21 SSoT parser-system.md §B Step 2 Case B 「個別出目行の収集」準拠。
                // 個別出目自体は常に正値で記載されるため、減算ブロックでも正値のまま push する
                // （合算結果のみ合計行処理時に Math.abs(diceSum) で絶対値ベース比較）。
                const individualMatch = trimmed.match(INDIVIDUAL_DICE_PATTERN);
                if (individualMatch) {
                    currentBlock._individualDice!.push(parseInt(individualMatch[1], 10));
                    continue;
                }

                // Look for "合計: N" (This is usually the DICE SUM, not the Final Score)
                // Modified: Support negative total (e.g. "合計: -20")
                // CR-17: 行頭アンカー `^` を追加し、文中の「合計: N」誤マッチを除去する。
                //        `trimmed` は line.trim() 後のため `^` は実質的に「行頭が『合計』」を要求する。
                const totalMatch = trimmed.match(/^合計[:：]\s*(-?\d+)/);
                if (totalMatch) {
                    const diceSum = parseInt(totalMatch[1], 10);
                    // 減算フラグに応じてdiceResultの符号を決定
                    const isSubtractive = currentBlock._isSubtractive;
                    const diceResultValue = isSubtractive ? -Math.abs(diceSum) : diceSum;

                    // CR-SA-10-Followup-F1 / 2026-05-09:
                    //   Multi-line Case B にも Single Line Case A と同等の範囲チェックを適用する。
                    //   X ≤ |diceResult| ≤ X×Y を検証し、範囲外の場合は validChecksum=false +
                    //   errors に範囲外文言を追加し、results には push しない。
                    //   減算ケース（diceResult が負数化済）は絶対値で範囲を判定する（Case A と同方針）。
                    const diceCount = currentBlock._diceCount!;
                    const diceFaces = currentBlock._diceFaces!;

                    // CR-SA-10-Followup-F4-E1 / 2026-05-11: 個別出目と合計の整合性検証
                    // （SA21 SSoT parser-system.md §B Step 2 Case B「個別出目と合計の整合性検証」準拠）。
                    // 検証順序 = 個別出目検算 → 範囲チェック（個別出目検算で不整合 → currentBlock リセット + continue
                    // で後続ステップに進まない）。個別出目 0 件時は検算スキップして既存範囲チェックに進む
                    // （フォーマット変動 / 個別出目記載なしケースの後方互換性確保）。
                    const individualDice = currentBlock._individualDice!;
                    if (individualDice.length > 0) {
                        const individualSum = individualDice.reduce((acc, v) => acc + v, 0);
                        const expectedAbs = Math.abs(diceSum);
                        const sumMismatch = individualSum !== expectedAbs;
                        const countMismatch = individualDice.length !== diceCount;
                        if (sumMismatch || countMismatch) {
                            currentBlock.validChecksum = false;
                            errors.push(
                                `ダイス内訳と合計値が不整合です: "${currentBlock.name}" (${currentBlock.diceStr}: 内訳合計 ${individualSum}, 合計表記 ${diceSum}。レスを改変せず、内訳と合計まで含めて貼り付けてください)`
                            );
                            currentBlock = null;
                            continue;
                        }
                    }
                    const lowerBound = diceCount;
                    const upperBound = diceCount * diceFaces;
                    const valueForRangeCheck = Math.abs(diceResultValue);
                    if (valueForRangeCheck < lowerBound || valueForRangeCheck > upperBound) {
                        currentBlock.validChecksum = false;
                        errors.push(
                            `ダイス合計値が範囲外です: "${currentBlock.name}" (${currentBlock.diceStr}: 合計 ${diceResultValue} は ${lowerBound}〜${upperBound} の範囲外。コピー範囲を確認してください)`
                        );
                        currentBlock = null;
                    } else {
                        currentBlock.diceResult = diceResultValue;

                        // Calculate Total Score (Fix +/- Dice)
                        currentBlock.total = (currentBlock.fixValue || 0) + currentBlock.diceResult;

                        // Checksum: 範囲チェックを通過した bot 出力の `合計:` を信頼
                        currentBlock.validChecksum = true;

                        results.push(currentBlock as ParsedLine);
                        currentBlock = null; // Completed
                    }
                }
            }
        }

        // Post-processing Validation
        // 名前不一致はヘッダー検出時に results 不追加 + errors 追加で完結するため、ここでは participantId 空チェックは不要。
        results.forEach(res => {
            if (res.validChecksum === false) {
                errors.push(`ダイス合計値が不正です: "${res.name}"`);
            }
        });

        // ファイル末尾で残った未完了ブロックを検出（#3-2-C と同じヘルパーを再利用）
        if (currentBlock) {
            reportIncompleteBlock(currentBlock);
        }

        return { results, errors, bondResults };
    }
}
