import type { Umamusume } from '../../types';
import type { ParseResult, ParsedLine, ParserStrategy } from './interface';
// Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクション認識（scene3-race.md §2）
import {
    BOND_SKILL_SECTION_HEADER,
    parseBondSkillLineFromText,
    type BondParsedLine,
    type ParseResultWithBond,
} from './bondTypes';

export class StandardParser implements ParserStrategy {
    // Implement as static for direct usage, but also satisfy interface logic if instantiated
    static parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE' = 'RACE'): ParseResultWithBond {
        if (context === 'PACE') {
            return this.parsePace(text);
        }
        return this.parseRace(text, participants);
    }

    // Adapt to interface method signature (instance method)
    parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE'): ParseResultWithBond {
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
            const regex = /^(.*?)[\s\u3000🎲]+(?:(-?\d+)([+＋-]))?(?:(-?\d+)([+＋-]))?\s*(-)?\s*dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((-?\d+)\))?$/iu;
            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fix1Raw, fix1Op, fix2Raw, fix2Op, negativeSign, diceStr, rollRaw, parensRaw] = match;
            // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11: 最大2プレフィックス受理。
            // fixValue には末尾(dice に近い側)= Z を格納（R-3 整合）。先頭側 N は読み飛ばす。
            const tailFixRaw = fix2Raw ?? fix1Raw;
            const tailFixOp = fix2Raw !== undefined ? fix2Op : fix1Op;
            const fixValue = tailFixRaw ? parseInt(tailFixRaw, 10) : 0;
            // Fix演算子 '-' または dice前の '-' のどちらかが付いていたら減算扱い
            const isSubtractive = tailFixOp === '-' || Boolean(negativeSign);
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

    private static parseRace(text: string, participants: Umamusume[]): ParseResultWithBond {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const results: ParsedLine[] = [];
        const bondResults: BondParsedLine[] = [];
        const errors: string[] = [];

        // Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクション認識（scene3-race.md §2）
        // 行を順次読み、`【絆スキル】` でセクション ON、別の `【XXX】` でセクション OFF。
        // セクション内のダイス行は通常解析と同じ regex で抽出するが、結果は bondResults へ格納する。
        // 終盤フェーズ抑制（仕様 §2「他フェーズでの非表示」）は呼び出し側 PhaseInput が currentPhaseId === 'End'
        // のときのみ history.End.bondDice に格納することで実現する（Parser は phase 情報を持たない）。
        let inBondSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Bundle-8-T5 / CR-SA-4 / 2026-05-10: セクションヘッダー検出（前処理として最優先）
            if (trimmed === BOND_SKILL_SECTION_HEADER) {
                inBondSection = true;
                continue;
            }
            // 別の `【...】` セクションヘッダー（例: `【序盤 ダイス】` `【固有スキル】`）でセクション終了
            if (/^【[^】]+】$/u.test(trimmed)) {
                inBondSection = false;
                continue;
            }

            // Ignore HTML tags if simple (though <p> usually implies new lines)
            // Pre-processing: Remove distinct HTML tags if any?
            // Requirement check: "Pre-processing: <p> tags... HTML tags removed"
            // Simple replace first
            const cleanLine = trimmed.replace(/<[^>]*>?/gm, '');
            if (!cleanLine) continue;

            // Bundle-8-T5 / CR-SA-4 / 2026-05-10: 【絆スキル】セクション内の行は共通 helper で処理し
            // bondResults へ格納する（通常解析パスは経由しない）。種別ラベル抽出 + 検算は helper 内で完結。
            if (inBondSection) {
                const parsed = parseBondSkillLineFromText(cleanLine, participants);
                if (parsed.error) {
                    errors.push(parsed.error);
                } else if (parsed.line) {
                    bondResults.push(parsed.line);
                }
                continue;
            }

            // Regex Updated to handle:
            // 1. Full-width Plus "＋"
            // 2. Loose dice results "5 3 5 (13)"
            // 3. Negative dice (Great Escape) "62+-dice1d27=...", "-dice...", "58-dice..."
            // 4. Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional]:
            //    拡張固有タイプ「超ギャンブル -10+dice1d35=」等の負の Fix value を
            //    捕捉できるよう (\d+) → (-?\d+) に拡張。既存挙動は完全互換。
            // 5. CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
            //    序盤2回目以降 `N+Z+dice`（数値2つ）を受理するため、先頭プレフィックスグループを
            //    2 つに拡張（最大2個まで）。3個以上は非マッチ → Invalid dice format
            //    （parser-system.md §A 複数プレフィックス受理の拡張）。

            // Regex Analysis（CR-SA-17-Followup で Group 4/5 を追加、以降を繰り下げ）:
            // ^(.*?)          -> Group 1: Name
            // [\s\u3000🎲]+   -> Separator
            // (?:(-?\d+)([+＋-]))? -> Group 2: 先頭プレフィックス値 N, Group 3: その演算子
            // (?:(-?\d+)([+＋-]))? -> Group 4: 末尾プレフィックス値 Z, Group 5: その演算子
            //                         （0/1 個時は Group 2/3 のみ、Group 4/5 = undefined）
            // \s*(-)?         -> Group 6: Negative sign before 'dice' (Fixなし大逃げ用)
            // dice(\d*d\d+?)  -> Group 7: DiceStr
            // \s*=\s*         -> Equals
            // (.*?)           -> Group 8: Roll Result
            // (?:\s*\((-?\d+)\))?$ -> Group 9: Parens Value (Sum of dice, absolute)
            // fixValue = 末尾プレフィックス(Z) = Group 4 ?? Group 2（R-3 振り分け整合）

            const regex = /^(.*?)[\s\u3000🎲]+(?:(-?\d+)([+＋-]))?(?:(-?\d+)([+＋-]))?\s*(-)?\s*dice(\d*d\d+?)\s*=\s*(.*?)(?:\s*\((-?\d+)\))?$/iu;

            const match = cleanLine.match(regex);

            if (!match) {
                if (/dice\d*d\d+/i.test(cleanLine)) {
                    errors.push(`Invalid dice format: "${cleanLine}"`);
                }
                continue;
            }

            const [, nameRaw, fix1Raw, fix1Op, fix2Raw, fix2Op, negativeSign, diceStr, rollRaw, parensRaw] = match;

            // CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11: 最大2プレフィックス受理。
            // fixValue には末尾(dice に近い側)= Z を格納（R-3 整合）。先頭側 N（中間値）は読み飛ばす。
            const tailFixRaw = fix2Raw ?? fix1Raw;
            const tailFixOp = fix2Raw !== undefined ? fix2Op : fix1Op;
            const fixValue = tailFixRaw ? parseInt(tailFixRaw, 10) : 0;
            // Fix演算子 '-' または dice前の '-' のどちらかが付いていたら減算扱い
            const isSubtractive = tailFixOp === '-' || Boolean(negativeSign);
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

        return { results, errors, bondResults };
    }
}
