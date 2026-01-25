import type { Umamusume } from '../../types';
import type { ParseResult, ParsedLine, ParserStrategy } from './interface';

export class StandardParser implements ParserStrategy {
    // Implement as static for direct usage, but also satisfy interface logic if instantiated
    static parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE' = 'RACE'): ParseResult {
        if (context === 'PACE') {
            return this.parsePace(text);
        }
        return this.parseRace(text, participants);
    }

    // Adapt to interface method signature (instance method)
    parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE'): ParseResult {
        return StandardParser.parse(text, participants, context);
    }

    private static parsePace(text: string): ParseResult {
        const results: ParsedLine[] = [];
        const errors: string[] = [];

        // Global search for dice1d9=N
        // Regex: (?:🎲)?\s*dice1d9\s*=\s*(\d+)
        // Allow optional emoji, spaces, and ensure we capture the value
        const regex = /(?:🎲)?\s*dice1d9\s*=\s*(\d+)/g;
        const matches = [...text.matchAll(regex)];

        if (matches.length === 0) {
            errors.push('・ペースダイス(dice1d9)が見つかりません。コピー漏れがないか確認してください');
        } else if (matches.length > 1) {
            errors.push('・複数のペースダイスが検出されました。内容を確認してください');
        } else {
            const match = matches[0];
            const val = parseInt(match[1], 10);

            // For Pace, we create a dummy ParsedLine or special structure?
            // The interface ParsedLine expects participantId etc.
            // But Pace result is global.
            // Requirement says "ペースダイスは...GMが...1回のみ振る".
            // So logic needs to extract just the value.
            // But `ParseResult` is `results: ParsedLine[]`.
            // Maybe we return a dummy line with empty name?
            results.push({
                originalText: match[0],
                participantId: 'GM', // Special ID
                name: 'GM',
                diceStr: '1d9',
                diceResult: val,
                total: val,
                fixValue: 0,
                validChecksum: true
            });
        }

        return { results, errors };
    }

    static parseJudgment(text: string): { results: ParsedLine[], errors: string[] } {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const results: ParsedLine[] = [];
        const errors: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const cleanLine = trimmed.replace(/<[^>]*>?/gm, '');
            if (!cleanLine) continue;

            // Regex Updated (same as parseRace): supports Half/Full width Plus and Negative dice
            const regex = /^(.*?)[\s\u3000🎲]+(?:(\d+)[\+\＋])?(\-)?dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((\-?\d+)\))?$/i;
            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fixRaw, negativeSign, diceStr, rollRaw, parensRaw] = match;
            const fixValue = fixRaw ? parseInt(fixRaw, 10) : 0;
            let diceResult = 0;

            if (parensRaw) {
                diceResult = parseInt(parensRaw, 10);
            } else {
                const val = parseInt(rollRaw.trim(), 10);
                if (!isNaN(val)) {
                    diceResult = val;
                } else {
                    // Fallback
                }
            }

            if (negativeSign) {
                diceResult = -Math.abs(diceResult);
            }

            const total = fixValue + diceResult;
            const cleanedName = nameRaw.replace(/^[①-⑳0-9\.]+\s*/, '').trim();

            results.push({
                originalText: cleanLine,
                participantId: 'JUDGMENT_TARGET',
                name: cleanedName,
                diceStr,
                diceResult,
                total,
                fixValue,
                validChecksum: true
            });
        }
        return { results, errors };
    }

    private static parseRace(text: string, participants: Umamusume[]): ParseResult {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const results: ParsedLine[] = [];
        const errors: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Ignore HTML tags if simple (though <p> usually implies new lines)
            // Pre-processing: Remove distinct HTML tags if any?
            // Requirement check: "Pre-processing: <p> tags... HTML tags removed"
            // Simple replace first
            const cleanLine = trimmed.replace(/<[^>]*>?/gm, '');
            if (!cleanLine) continue;

            // Regex Updated to handle:
            // 1. Full-width Plus "＋"
            // 2. Loose dice results "5 3 5 (13)"
            // 3. Negative dice (Great Escape) "62＋-dice1d27=..." or "-dice..."

            // Regex Analysis:
            // ^(.*?)          -> Group 1: Name
            // [\s\u3000🎲]+   -> Separator
            // (?:(\d+)[\+\＋])? -> Group 2: Fix (optional)
            // (\-)?           -> Group 3: Negative sign (optional) before dice
            // dice(\d*d\d+?)  -> Group 4: DiceStr
            // \s*=\s*         -> Equals
            // (.*?)           -> Group 5: Roll Result
            // (?:\s*\((\-?\d+)\))?$ -> Group 6: Parens Value (Total/Sum)

            const regex = /^(.*?)[\s\u3000🎲]+(?:(\d+)[\+\＋])?(\-)?dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((\-?\d+)\))?$/i;

            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fixRaw, negativeSign, diceStr, rollRaw, parensRaw] = match;

            const fixValue = fixRaw ? parseInt(fixRaw, 10) : 0;
            let diceResult = 0;
            let total = 0;

            if (parensRaw) {
                // Checksum Validation Logic
                const checkVal = parseInt(parensRaw, 10);

                // Primary Source of Truth is rollRaw
                let val = parseInt(rollRaw.trim(), 10);
                if (isNaN(val)) {
                    errors.push(`ダイス値を読み取れませんでした: "${rollRaw}"`);
                    continue;
                }

                if (negativeSign) {
                    val = -Math.abs(val);
                }

                diceResult = val;
                const calculatedTotal = fixValue + diceResult;

                // Checksum logic: Exact match OR (if negative dice) Absolute match
                // Oonige: -15 vs (15) -> Allow
                if (calculatedTotal !== checkVal) {
                    if (negativeSign && Math.abs(calculatedTotal) === checkVal) {
                        // Allowed: Absolute value notation for negative result
                    } else {
                        errors.push(`ダイス合計値が不正です (計算値: ${calculatedTotal}, 記載値: ${checkVal})`);
                        // Still use calculated value? Or fail?
                        // Requirement says "Error".
                    }
                }
                total = calculatedTotal;

            } else {
                const val = parseInt(rollRaw.trim(), 10);
                if (!isNaN(val)) {
                    diceResult = val;
                } else {
                    errors.push(`ダイス値を読み取れませんでした: "${rollRaw}"`);
                    continue;
                }

                if (negativeSign) {
                    diceResult = -Math.abs(diceResult);
                }
                total = fixValue + diceResult;
            }

            // Clean name: Remove "①", "②" etc.
            const cleanedName = nameRaw.replace(/^[①-⑳0-9\.]+\s*/, '').trim();

            // Find participant
            const participant = participants.find(p => p.name === cleanedName);

            if (!participant) {
                errors.push(`・登録名と一致しないデータが含まれています: "${cleanedName}"`);
                continue;
            }

            results.push({
                originalText: cleanLine,
                participantId: participant.id,
                name: cleanedName,
                diceStr,
                diceResult,
                total,
                fixValue,
                validChecksum: true // We already pushed error if checksum failed
            });

        }

        return { results, errors };
    }
}
