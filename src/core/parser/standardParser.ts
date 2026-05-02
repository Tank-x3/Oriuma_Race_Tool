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
            const regex = /^(.*?)[\s\u3000🎲]+(?:(\d+)([+＋\-]))?\s*(-)?\s*dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((-?\d+)\))?$/iu;
            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fixRaw, fixOperator, negativeSign, diceStr, rollRaw, parensRaw] = match;
            const fixValue = fixRaw ? parseInt(fixRaw, 10) : 0;
            // Fix演算子 '-' または dice前の '-' のどちらかが付いていたら減算扱い
            const isSubtractive = fixOperator === '-' || Boolean(negativeSign);
            let diceResult = 0;

            if (parensRaw) {
                diceResult = parseInt(parensRaw, 10);
            } else {
                // スペース区切りの複数ダイス出目に対応
                const diceValues = rollRaw.trim().split(/\s+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                if (diceValues.length > 0) {
                    diceResult = diceValues.reduce((acc, cur) => acc + cur, 0);
                } else {
                    // Fallback
                }
            }

            if (isSubtractive) {
                diceResult = -Math.abs(diceResult);
            }

            const total = fixValue + diceResult;
            const cleanedName = nameRaw.replace(/^[①-⑳0-9.]+\s*/u, '').trim();

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
            // 3. Negative dice (Great Escape) "62+-dice1d27=...", "-dice...", "58-dice..."

            // Regex Analysis:
            // ^(.*?)          -> Group 1: Name
            // [\s\u3000🎲]+   -> Separator
            // (?:(\d+)([+＋\-]))? -> Group 2: Fix value, Group 3: Fix operator ('+' or '-')
            // \s*(-)?         -> Group 4: Negative sign before 'dice' (Fixなし大逃げ用)
            // dice(\d*d\d+?)  -> Group 5: DiceStr
            // \s*=\s*         -> Equals
            // (.*?)           -> Group 6: Roll Result
            // (?:\s*\((-?\d+)\))?$ -> Group 7: Parens Value (Sum of dice, absolute)

            const regex = /^(.*?)[\s\u3000🎲]+(?:(\d+)([+＋\-]))?\s*(-)?\s*dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((-?\d+)\))?$/iu;

            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fixRaw, fixOperator, negativeSign, diceStr, rollRaw, parensRaw] = match;

            const fixValue = fixRaw ? parseInt(fixRaw, 10) : 0;
            // Fix演算子 '-' または dice前の '-' のどちらかが付いていたら減算扱い
            const isSubtractive = fixOperator === '-' || Boolean(negativeSign);
            let diceResult = 0;
            let total = 0;

            if (parensRaw) {
                // Checksum Validation Logic
                // (N) はダイス出目の総和を表す（fix + diceResult ではない）
                const checkVal = parseInt(parensRaw, 10);

                // diceStr から X (個数) と Y (面数) を抽出
                const diceMatch = diceStr.match(/(\d*)d(\d+)/i);
                const diceCount = diceMatch && diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
                const diceFaces = diceMatch ? parseInt(diceMatch[2], 10) : 0;

                // Primary Source of Truth is rollRaw
                // スペース区切りの複数ダイス出目に対応 (例: "3 1 4" → 8)
                const diceValues = rollRaw.trim().split(/\s+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                if (diceValues.length === 0) {
                    errors.push(`ダイス値を読み取れませんでした: "${rollRaw}"`);
                    continue;
                }

                // 検証1: 出目の数がダイス個数(X)と一致するか
                if (diceValues.length !== diceCount) {
                    errors.push(`ダイスの個数が一致しません (期待: ${diceCount}個, 検出: ${diceValues.length}個)`);
                }

                // 検証2: 各出目がダイス面数(Y)を超えていないか
                const invalidDice = diceValues.filter(v => v < 1 || v > diceFaces);
                if (invalidDice.length > 0) {
                    errors.push(`不正なダイス値があります (1~${diceFaces}の範囲外: ${invalidDice.join(', ')})`);
                }

                let val = diceValues.reduce((acc, cur) => acc + cur, 0);

                // 検証3: ダイス出目の総和と(N)の値が一致するか
                // 負のダイスの場合、(N)は絶対値で表記される
                const absVal = Math.abs(val);
                const absCheckVal = Math.abs(checkVal);
                if (absVal !== absCheckVal) {
                    errors.push(`ダイス合計値が不正です (計算値: ${val}, 記載値: ${checkVal})`);
                }

                if (isSubtractive) {
                    val = -Math.abs(val);
                }

                diceResult = val;
                total = fixValue + diceResult;


            } else {
                // CR-4b: (N) 必須化（あにまん仕様、parser-system.md §A L93-94, L142）
                // 欠落時は errors 追加 + 当該行 skip。results.push に到達させない。
                errors.push(`合計値(N)が記載されていません: "${cleanLine}"`);
                continue;
            }

            // Clean name: Remove "①", "②" etc.
            const cleanedName = nameRaw.replace(/^[①-⑳0-9.]+\s*/u, '').trim();

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
