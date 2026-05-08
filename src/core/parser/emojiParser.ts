import { StandardParser } from './standardParser';
import type { ParserStrategy, ParseResult, ParsedLine } from './interface';
import type { Umamusume } from '../../types';

export class EmojiParser implements ParserStrategy {
    parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE'): ParseResult {
        // Delegate PACE parsing to StandardParser (Global search)
        if (context === 'PACE') {
            return StandardParser.parse(text, participants, context);
        }

        const results: ParsedLine[] = [];
        const errors: string[] = [];
        const lines = text.split(/\r?\n/);

        let currentBlock: Partial<ParsedLine> | null = null;

        // 未完了ブロック（合計行未到達）をエラーとして報告するヘルパー。
        // 新ヘッダー検出時 / ファイル末尾の両方で使用する（仕様: parser-system.md §B Step 3）。
        const reportIncompleteBlock = (block: Partial<ParsedLine>) => {
            if (block.total === undefined && block.diceResult === undefined) {
                errors.push(`データの解析に失敗しました（合計行が見つかりません）: "${block.name}"`);
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

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
                const fixMatch = preMatch.match(/^(.*?)(\d+)([+-])\s*$/);

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
                (currentBlock as any)._isSubtractive = !isFixPlus;

                // If inline result was present, it's a single line entry (Standard-ish mixed in)
                if (inlineResult !== undefined) {
                    // Check if (Total) exists in same line?
                    // Test case: "15+🎲 dice3d6=18 (33)"
                    const totalMatch = trimmed.match(/\((\d+)\)$/);
                    if (totalMatch) {
                        currentBlock.total = parseInt(totalMatch[1], 10);
                        currentBlock.validChecksum = (currentBlock.fixValue! + currentBlock.diceResult!) === currentBlock.total;
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
                // Look for "合計: N" (This is usually the DICE SUM, not the Final Score)
                // Modified: Support negative total (e.g. "合計: -20")
                // CR-17: 行頭アンカー `^` を追加し、文中の「合計: N」誤マッチを除去する。
                //        `trimmed` は line.trim() 後のため `^` は実質的に「行頭が『合計』」を要求する。
                const totalMatch = trimmed.match(/^合計[:：]\s*(-?\d+)/);
                if (totalMatch) {
                    const diceSum = parseInt(totalMatch[1], 10);
                    // 減算フラグに応じてdiceResultの符号を決定
                    const isSubtractive = (currentBlock as any)._isSubtractive;
                    currentBlock.diceResult = isSubtractive ? -Math.abs(diceSum) : diceSum;

                    // Calculate Total Score (Fix +/- Dice)
                    currentBlock.total = (currentBlock.fixValue || 0) + currentBlock.diceResult;

                    // Checksum: We trust the bot's sum for now. 
                    // (To be stricter, we could sum the individual lines, but that's complex)
                    currentBlock.validChecksum = true;

                    results.push(currentBlock as ParsedLine);
                    currentBlock = null; // Completed
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

        return { results, errors };
    }
}
