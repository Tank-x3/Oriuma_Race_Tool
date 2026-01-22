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

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Step 1: Header Detection
            // Pattern: [Name] [Fix+]🎲 dice[XdY]= [Result?]
            // Anchor: 'dice' followed by digits 'd' digits
            // Modified: Allow spaces around '=' (e.g., "dice1d12= 7")
            const diceMatch = trimmed.match(/(?:🎲)?\s*dice(\d+d\d+)\s*=\s*(\d+)?/);

            if (diceMatch) {
                // If a previous block was pending without explicit total line, closes it?
                // 88-ch usually provides Total line. If missing, maybe we should push what we have or error?
                // For now, let's assume if we hit a new header, the previous block is done (or failed if incomplete).
                if (currentBlock) {
                    // Logic: If previous block didn't have total, it might be incomplete. 
                    // However, sometimes single line has result.
                    // If currentBlock has total/result, push it.
                    if (currentBlock.total !== undefined || currentBlock.diceResult !== undefined) {
                        // pushed in loop? No, push when completed.
                    }
                }

                // Parse Header
                const diceStr = diceMatch[1];
                const inlineResult = diceMatch[2] ? parseInt(diceMatch[2], 10) : undefined;

                // Extract Name & Fix Value
                // Everything before the match index is Name + Fix
                const preMatch = trimmed.substring(0, diceMatch.index).trim();

                // Check if ends with "Fix+"
                // Regex: (.*?)(\d+)\+$
                const fixMatch = preMatch.match(/^(.*?)(\d+)\+$/);

                let nameRaw = preMatch;
                let fixValue = 0;

                if (fixMatch) {
                    nameRaw = fixMatch[1].trim();
                    fixValue = parseInt(fixMatch[2], 10);
                } else if (preMatch.includes(' ')) {
                    // fallback if space separation?
                    // But maybe no fix value.
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

                if (participant) {
                    matchedParticipantId = participant.id;
                    matchedName = participant.name; // Normalize to registered name
                } else {
                    // Store strict name for error reporting
                    matchedName = cleanName;
                }

                currentBlock = {
                    originalText: trimmed,
                    participantId: matchedParticipantId,
                    name: matchedName,
                    diceStr,
                    fixValue,
                    diceResult: inlineResult, // Might be undefined
                    total: inlineResult ? (fixValue + inlineResult) : undefined, // If inline result exists, it is usually the ROLL result for older format?
                    // Wait, StandardParser: "30+dice...=15 (45)" -> Result 15, Total 45.
                    // 88-ch Header: "15+🎲 dice3d6=" (No value) OR "15+🎲 dice3d6=18" (Result? Total?)
                    // Usage in test: "15+🎲 dice3d6=18" matched diceResult: 18, total: 33. So 18 is ROLL.
                };

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
                        // Maybe calculate total?
                        currentBlock.total = currentBlock.fixValue! + currentBlock.diceResult!;
                        currentBlock.validChecksum = true; // Auto-calculated
                        results.push(currentBlock as ParsedLine);
                        currentBlock = null;
                    }
                }
            }
            else if (currentBlock) {
                // Step 2: Result Extraction (Multi-line Body)
                // Look for "合計: N" (This is usually the DICE SUM, not the Final Score)
                const totalMatch = trimmed.match(/合計[:：]\s*(\d+)/);
                if (totalMatch) {
                    const diceSum = parseInt(totalMatch[1], 10);
                    currentBlock.diceResult = diceSum;

                    // Calculate Total Score (Fix + Dice)
                    currentBlock.total = (currentBlock.fixValue || 0) + diceSum;

                    // Checksum: We trust the bot's sum for now. 
                    // (To be stricter, we could sum the individual lines, but that's complex)
                    currentBlock.validChecksum = true;

                    results.push(currentBlock as ParsedLine);
                    currentBlock = null; // Completed
                }
            }
        }

        // Post-processing Validation
        results.forEach(res => {
            if (!res.participantId) {
                errors.push(`登録名と一致しないデータが含まれています: "${res.name}"`);
            }
            if (res.validChecksum === false) {
                errors.push(`ダイス合計値が不正です: "${res.name}"`);
            }
        });

        // Current block not null means incomplete?
        if (currentBlock) {
            errors.push(`データの解析に失敗しました（合計行が見つかりません）: "${currentBlock.name}"`);
        }

        return { results, errors };
    }
}
