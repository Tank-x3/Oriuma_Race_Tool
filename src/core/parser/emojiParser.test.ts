import { describe, it, expect } from 'vitest';
import { EmojiParser } from './emojiParser';
import type { Umamusume } from '../../types';

describe('EmojiParser (88-ch Support)', () => {
    const parser = new EmojiParser();

    // Mock participants for validation
    const participants: Umamusume[] = [
        { id: '1', name: 'ウマ娘A', strategy: '逃げ', uniqueSkill: { type: 'Stability', phases: [] }, uniqueSkillPhase: '序盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
        { id: '2', name: 'ウマ娘B', strategy: '差し', uniqueSkill: { type: 'Gamble', phases: [] }, uniqueSkillPhase: '中盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
        { id: '3', name: 'テストウマ', strategy: '追込', uniqueSkill: { type: 'Stability', phases: [] }, uniqueSkillPhase: '終盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
    ];

    // 移植先: realData.test.ts CR-SA-3-E5-2 #56 (CR-SA-3-E5-2)
    it.skip('should parse single-line format correctly (Standard-like behavior)', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=18 (33)
            ウマ娘B 5+🎲 dice3d6=10 (15)
        `;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(2);

        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '3d6',
            diceResult: 18,
            total: 33,
            fixValue: 15
        });
    });

    // 移植先: realData.test.ts CR-SA-3-E5-2 #57 (CR-SA-3-E5-2)
    it.skip('should handle single-line with space after equals (User Report)', () => {
        // Report: "① フルールドシュマン　5+🎲 dice1d12= 7" -> Error "Total not found"
        // Mock "フルールドシュマン" as "ウマ娘A" for simplicity or add to logic?
        // Let's just use existing "ウマ娘A" with the failing format.
        const input = `ウマ娘A 5+🎲 dice1d12= 7`;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].diceResult).toBe(7);
        expect(result.results[0].fixValue).toBe(5);
        expect(result.results[0].total).toBe(12);
    });

    // 移植先: realData.test.ts CR-SA-3-E5-2 #58 (CR-SA-3-E5-2)
    it.skip('should parse multi-line block format (88-ch)', () => {
        const input = `
            202: 名無しさん
            ② ウマ娘A 15+🎲 dice3d6=
            1回目: 6
            2回目: 6
            3回目: 3
            合計: 15

            203: 名無しさん
            ③ ウマ娘B 5+🎲 dice3d6=
            (省略)
            合計: 10
        `;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(2);

        // ウマ娘A: Fixed 15 + Dice 15 = Total 30
        // Wait, standard parser expects (Total) at the end of line for validation usually.
        // But 88-ch format puts "合計: N" in a separate line.
        // The parser logic needs to handle extracting "Total" from the separate line
        // and reconcile it with "Fixed Value" in the header.

        // 88-ch format usually shows:
        // Header: "Name Fixed+diceXdY="
        // Body: "Sum: Result"
        // The "Total Score" for the game is Fix + Dice Result.

        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '3d6',
            diceResult: 15,
            fixValue: 15,
            total: 30
        });

        expect(result.results[1]).toMatchObject({
            name: 'ウマ娘B',
            diceStr: '3d6',
            diceResult: 10,
            fixValue: 5,
            total: 15
        });
    });

    // CR-SA-3-E5-3 保持判断: 88ch race-001〜004 全 participants（4 + 15 + 5 + 11 = 35 名）に空白入り名前不在のため EmojiParser リテラル「テスト ウマ」検証は設計駆動層に残置。なお StandardParser 側は animan race-003 の Revival Simon / Wasted XIII / Brightest Nova（半角空白入り英語名 3 名）で実データカバー済（CR-SA-3-E5-3）
    it('should handle names with spaces', () => {
        const input = `
            204: 名無しさん
            ④ テスト ウマ 0+🎲 dice3d6=
            合計: 12
        `;
        // Need to update participants mock to have "テスト ウマ" if I want to test match?
        // Ah, the mock has "テストウマ" (no space). 
        // If the 88-ch text has space but internal name doesn't, fuzzy match might be needed?
        // For now, let's assume exact match or simple normalization. 
        // Let's use a name that exists in participants but assumes the post might vary slightly or checking "Ends with dice..." logic.

        // Let's stick to strict checking first.
        const participantsWithSpace = [
            { id: '4', name: 'テスト ウマ', strategy: '追込', uniqueSkill: { type: 'Stability', phases: [] }, uniqueSkillPhase: '終盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
        ];

        const result = parser.parse(input, participantsWithSpace, 'RACE');
        expect(result.results[0].name).toBe('テスト ウマ');
        expect(result.results[0].diceResult).toBe(12);
    });

    // 移植先: realData.test.ts CR-SA-3-E5-2 #60 (CR-SA-3-E5-2)
    it.skip('should ignore non-dice posts', () => {
        const input = `
            205: 名無しさん
            普通の雑談レス
            サイコロ振ってないね

            206: 名無しさん
            ウマ娘A 15+🎲 dice3d6=
            合計: 5
        `;
        const result = parser.parse(input, participants, 'RACE');
        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('ウマ娘A');
    });

    // 保持判断 (CR-SA-3-E5-2 #61): 「複数行 negative dice」(73-🎲 dice3d6= ... 合計: -15) は実データ層 7 ファイルに不在のため移植中止。設計駆動層に残置（CR-2 Critical Fix の検証意図保護）。
    it('should parse multi-line subtraction correctly (Critical Fix)', () => {
        const input = `
            ウマ娘A 73-🎲 dice3d6=
            1回目: 5
            2回目: 5
            3回目: 5
            合計: 15
        `;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '3d6',
            diceResult: -15,
            fixValue: 73,
            total: 58
        });
    });

    // 移植先: realData.test.ts CR-SA-3-E5-2 #62 (CR-SA-3-E5-2)
    it.skip('should parse multi-line addition correctly (regression)', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=
            1回目: 6
            2回目: 6
            3回目: 6
            合計: 18
        `;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '3d6',
            diceResult: 18,
            fixValue: 15,
            total: 33
        });
    });

    // 移植先: realData.test.ts CR-SA-3-E5-2 #63 (CR-SA-3-E5-2)
    it.skip('should parse single-line subtraction correctly (regression)', () => {
        const input = `ウマ娘A 73-🎲 dice1d12=7`;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '1d12',
            diceResult: -7,
            fixValue: 73,
            total: 66
        });
    });

    it('should report correct errors for missing total line', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=
            (途中で切れてる)
        `;
        const result = parser.parse(input, participants, 'RACE');
        // Implementation detail: if total is missing, maybe it errors or skips?
        // Requirement says "Validation: ...合計が見つかるかを確認する"
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('合計');
    });

    // CR-4 Part A: #3-2-C 未完了ブロック → 新ヘッダーの Critical 化
    it('should report error when an incomplete block is followed by a new header (CR-4 #3-2-C)', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=
            ウマ娘B 5+🎲 dice3d6= 1 2 3 (6)
            合計: 6
        `;
        const result = parser.parse(input, participants, 'RACE');

        // ウマ娘A の未完了ブロックがエラー化されること
        const incompleteError = result.errors.find(e =>
            e.includes('合計行が見つかりません') && e.includes('ウマ娘A')
        );
        expect(incompleteError).toBeDefined();

        // ウマ娘A のデータは results に含まれないこと
        expect(result.results.find(r => r.name === 'ウマ娘A')).toBeUndefined();

        // ウマ娘B（単一行フォーマット）は正常に処理されること
        const okResult = result.results.find(r => r.name === 'ウマ娘B');
        expect(okResult).toBeDefined();
        expect(okResult?.fixValue).toBe(5);
    });

    // CR-4 Part B: #1-2-6 名前不一致時の results 不追加
    it('should not include unmatched-name entries in results (CR-4 #1-2-6)', () => {
        const input = `
            ダイタクヘリオス 10+🎲 dice3d6= 2 3 4 (9)
            合計: 19
            ウマ娘A 5+🎲 dice3d6= 1 2 1 (4)
            合計: 9
        `;
        const result = parser.parse(input, participants, 'RACE');

        // 名前不一致エラーが仕様文言（・接頭辞付き）で発生すること
        const nameMismatchError = result.errors.find(e =>
            e.includes('・登録名と一致しないデータが含まれています') && e.includes('ダイタクヘリオス')
        );
        expect(nameMismatchError).toBeDefined();

        // ダイタクヘリオスは results に含まれないこと
        expect(result.results.find(r => r.name === 'ダイタクヘリオス')).toBeUndefined();

        // ウマ娘A は正常に results に含まれること
        const okResult = result.results.find(r => r.name === 'ウマ娘A');
        expect(okResult).toBeDefined();
        expect(okResult?.participantId).toBe('1');
    });

    // CR-4 Part B: 名前不一致行の合計行が後続処理に干渉しないこと
    it('should silently skip body lines after a name-mismatch header (CR-4 #1-2-6)', () => {
        const input = `
            未登録ウマ 10+🎲 dice3d6=
            1回目: 1
            2回目: 2
            3回目: 3
            合計: 6
            ウマ娘B 7+🎲 dice3d6=6 (13)
        `;
        const result = parser.parse(input, participants, 'RACE');

        // 未登録ウマ がエラー化、results 不追加
        expect(result.errors.some(e => e.includes('未登録ウマ'))).toBe(true);
        expect(result.results.find(r => r.name === '未登録ウマ')).toBeUndefined();

        // ウマ娘B は正常処理（未登録ウマの 合計: 6 行が漏れて参照されないこと）
        const okResult = result.results.find(r => r.name === 'ウマ娘B');
        expect(okResult).toBeDefined();
        expect(okResult?.diceResult).toBe(6);
        expect(okResult?.total).toBe(13);
    });

    // CR-4 Part A: 既存の EOF 未完了ブロック検出（リグレッション保護）
    // 移植先: derivedData.test.ts rangeShiftTail パターン (CR-SA-3-E5-2 #68)
    it.skip('should still report incomplete block at EOF (CR-4 Part A regression)', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=
        `;
        const result = parser.parse(input, participants, 'RACE');
        const incompleteError = result.errors.find(e =>
            e.includes('合計行が見つかりません') && e.includes('ウマ娘A')
        );
        expect(incompleteError).toBeDefined();
        expect(result.results).toHaveLength(0);
    });

    // CR-17: 合計行パターンの仕様外拡張除去
    // 仕様: parser-system.md §B Step 2 Case B 「`合計[:：]\s*(-?\d+)` を検出した行で...」
    // 実装側で `^合計` の行頭アンカーを追加し、文中の「合計: N」を誤検出しないこと。
    it('should not detect 合計 in mid-line text (CR-17 strict header anchor)', () => {
        const input = `
            ウマ娘A 15+🎲 dice3d6=
            この前のレース合計: 30 と書いてあった
            1回目: 2
            2回目: 2
            3回目: 2
            合計: 6
        `;
        const result = parser.parse(input, participants, 'RACE');

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        // 「合計: 30」を誤検出すると diceResult=30 となるため、6 で正しく採用されていることを検証する。
        expect(result.results[0]).toMatchObject({
            name: 'ウマ娘A',
            diceStr: '3d6',
            diceResult: 6,
            fixValue: 15,
            total: 21,
        });
    });

    // CR-SA-10-E1: 88ch (N) なし時の範囲チェック追加
    // 仕様: parser-system.md §B Step 1 + Step 2 Case A 改訂版（CR-SA-10 / 2026-05-08 SA10）
    // 改訂内容:
    //   - Step 1: ヘッダー検出正規表現を `(?:🎲)?\s*(-)?dice(\d+)d(\d+)\s*=\s*(\d+)?` に変更し、
    //     個数 X (Group 2) / 面数 Y (Group 3) を別キャプチャ化。
    //   - Step 2 Case A: `(N)` なし時のフォールバックに `X ≤ |diceResult| ≤ X×Y` の範囲チェックを追加。
    //     範囲外の場合は validChecksum=false + errors に範囲外文言を追加し、results には push しない
    //     （下流のスコア計算へ異常値を流さないため）。
    describe('CR-SA-10-E1: range check on Single Line Case A (no (N))', () => {
        it('should accept value within range (1d100=50)', () => {
            const input = `ウマ娘A 🎲 dice1d100= 50`;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'ウマ娘A',
                diceStr: '1d100',
                diceResult: 50,
                fixValue: 0,
                total: 50,
                validChecksum: true,
            });
        });

        it('should reject value below lower bound (1d100=0)', () => {
            const input = `ウマ娘A 🎲 dice1d100= 0`;
            const result = parser.parse(input, participants, 'RACE');

            // results 不追加（範囲外データを下流のスコア計算へ流さないため）
            expect(result.results).toHaveLength(0);
            // errors に範囲外文言（仕様書 §B Step 2 Case A 改訂版）
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('1d100') &&
                e.includes('合計 0') &&
                e.includes('1〜100 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should reject value above upper bound (1d100=101)', () => {
            const input = `ウマ娘A 🎲 dice1d100= 101`;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('1d100') &&
                e.includes('合計 101') &&
                e.includes('1〜100 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should reject multi-face dice value above X×Y (2d6=15, regression guard)', () => {
            // 上限が個数 × 面数で算出されることを担保する regression guard。
            // 改訂前の `(\d+d\d+)` は diceStr のみ取得していたため X / Y を分離できず、本検知は不可能だった。
            const input = `ウマ娘A 🎲 dice2d6= 15`;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('2d6') &&
                e.includes('合計 15') &&
                e.includes('2〜12 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should not apply range check when (N) is present (regression guard)', () => {
            // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional / CR-SA-10-Followup-F2-E1 先取り反映]:
            // SA12 確定仕様により (N) はダイス出目の総和 (StandardParser §A 解釈) に統一。
            // 旧 input `15+🎲 dice3d6=18 (33)` (N=fixValue+diceResult) → 新 input `15+🎲 dice3d6=18 (18)` (N=diceResult)。
            // (N) あり時は範囲チェック非適用（既存仕様維持、仕様書 §B Step 2 Case A の分岐を担保）。
            const input = `ウマ娘A 15+🎲 dice3d6=18 (18)`;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'ウマ娘A',
                diceStr: '3d6',
                diceResult: 18,
                fixValue: 15,
                total: 18,
                validChecksum: true,
            });
        });
    });

    // CR-SA-10-Followup-F1: 88ch Multi-line Case B 範囲チェック追加
    // 仕様: parser-system.md §B Step 2 Case B 改訂版（CR-SA-10-Followup-F1 / 2026-05-09）
    // 改訂内容:
    //   - Single Line Case A 同等の範囲チェック (X ≤ |diceResult| ≤ X×Y) を Multi-line Case B にも適用。
    //   - 範囲外の場合は validChecksum=false + errors に範囲外文言を追加し、results には push しない。
    //   - 減算ケース（diceResult が負数化済）は絶対値で範囲を判定する。
    describe('CR-SA-10-Followup-F1: range check on Multi-line Case B (合計行)', () => {
        it('should accept value within range (1d100 + 合計: 50)', () => {
            const input = `
                ウマ娘A 🎲 dice1d100=
                合計: 50
            `;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'ウマ娘A',
                diceStr: '1d100',
                diceResult: 50,
                fixValue: 0,
                total: 50,
                validChecksum: true,
            });
        });

        it('should reject value below lower bound (1d100 + 合計: 0)', () => {
            const input = `
                ウマ娘A 🎲 dice1d100=
                合計: 0
            `;
            const result = parser.parse(input, participants, 'RACE');

            // results 不追加（範囲外データを下流のスコア計算へ流さないため）
            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('1d100') &&
                e.includes('合計 0') &&
                e.includes('1〜100 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should reject value above upper bound (1d100 + 合計: 999)', () => {
            const input = `
                ウマ娘A 🎲 dice1d100=
                合計: 999
            `;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('1d100') &&
                e.includes('合計 999') &&
                e.includes('1〜100 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should reject multi-face dice value above X×Y (2d6 + 合計: 15, regression guard)', () => {
            // 上限が個数 × 面数 (2×6=12) で算出されることを担保する regression guard。
            // currentBlock に _diceCount / _diceFaces を保持していないと上限計算が不可能になる。
            const input = `
                ウマ娘A 🎲 dice2d6=
                合計: 15
            `;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('2d6') &&
                e.includes('合計 15') &&
                e.includes('2〜12 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should apply range check on subtraction with absolute value (-dice + 合計: -101)', () => {
            // 減算ケース: 絶対値 101 で範囲外検知。エラー文言の合計値表示は元の符号付き (-101)。
            const input = `
                ウマ娘A -🎲 dice1d100=
                合計: -101
            `;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.results).toHaveLength(0);
            const rangeError = result.errors.find(e =>
                e.includes('ダイス合計値が範囲外です') &&
                e.includes('ウマ娘A') &&
                e.includes('1d100') &&
                e.includes('合計 -101') &&
                e.includes('1〜100 の範囲外')
            );
            expect(rangeError).toBeDefined();
        });

        it('should preserve existing multi-line subtraction within range (regression guard)', () => {
            // 範囲内 (1≤15≤100) の減算ケースは現行通り受理されること。
            // 既存テスト 'should parse multi-line subtraction correctly (Critical Fix)' と
            // 同等の挙動を別パラメータで確認する regression guard。
            const input = `
                ウマ娘A 73-🎲 dice3d6=
                合計: 15
            `;
            const result = parser.parse(input, participants, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'ウマ娘A',
                diceStr: '3d6',
                diceResult: -15,
                fixValue: 73,
                total: 58,
                validChecksum: true,
            });
        });
    });

    // CR-7 Part B: #3-3-G PACE コンテキスト委譲テスト
    // 仕様: docs/specs/architecture/parser-system.md §B "PACE コンテキストの委譲" (L209-211)
    // 委譲先: emojiParser.ts:6-9 → StandardParser.parse(text, participants, 'PACE')
    describe('PACE delegation', () => {
        // 移植先: realData.test.ts CR-SA-3-E5-2 #69 (CR-SA-3-E5-2)
        it.skip('delegates PACE context to StandardParser', () => {
            const text = '🎲 dice1d9=6';
            const result = parser.parse(text, [], 'PACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                diceResult: 6,
                participantId: 'GM',
                name: 'GM',
            });
        });

        it('returns StandardParser error when delegated PACE has no dice', () => {
            // 委譲経路の異常系: dice1d9= が無いテキストで委譲先のエラーがそのまま返ること
            const result = parser.parse('普通の雑談です', [], 'PACE');

            expect(result.results).toHaveLength(0);
            expect(result.errors[0]).toContain('ペースダイス');
        });
    });

    // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional 適用]:
    // 拡張固有タイプ「超ギャンブル」(-10+dice1d35=) の Single Line + (N) 形式を
    // EmojiParser でも Invalid 化せず正しく解析できることを保証。fixMatch regex の
    // (\d+) → (-?\d+) 拡張テスト。
    describe('Extended Unique Skill type Fix value (Bundle-2)', () => {
        const participantsExt: Umamusume[] = [
            { id: '1', name: 'RevivalSimon', strategy: '先行', uniqueSkill: { type: 'SuperGamble', phases: [] }, uniqueSkillPhase: '中盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
            { id: '2', name: 'マヨイゴメイズ', strategy: '差し', uniqueSkill: { type: 'SuperStability', phases: [] }, uniqueSkillPhase: '中盤', speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, score: 0 } as unknown as Umamusume,
        ];

        it('parses SuperGamble line "RevivalSimon -10+🎲 dice1d35=28 (28)" without Invalid error', () => {
            // 注: EmojiParser の total フィールドは (N) の値 = ダイス出目総和（StandardParser の total = fix+diceResult とは異なる既存設計）
            const input = 'RevivalSimon -10+🎲 dice1d35=28 (28)';
            const result = parser.parse(input, participantsExt, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'RevivalSimon',
                diceStr: '1d35',
                fixValue: -10,
                diceResult: 28,
                total: 28, // EmojiParser: total = (N) ダイス出目総和
                validChecksum: true
            });
        });

        it('parses SuperStability line "Name 8+🎲 dice1d3=2 (2)" without error (regression guard for positive Fix)', () => {
            const input = 'マヨイゴメイズ 8+🎲 dice1d3=2 (2)';
            const result = parser.parse(input, participantsExt, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'マヨイゴメイズ',
                diceStr: '1d3',
                fixValue: 8,
                diceResult: 2,
                total: 2, // EmojiParser: total = (N) ダイス出目総和
                validChecksum: true
            });
        });

        it('parses SuperGamble Multi-line format with negative Fix', () => {
            // 88-ch ヘッダー (-10+🎲 dice1d35=) + 別行「合計: 28」のフォーマット
            const input = `RevivalSimon -10+🎲 dice1d35=
1回目: 28
合計: 28`;
            const result = parser.parse(input, participantsExt, 'RACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'RevivalSimon',
                fixValue: -10,
                diceResult: 28,
                total: 18,
            });
        });
    });
});

// Bundle-8-T5 / CR-SA-4 / 2026-05-10:
// 【絆スキル】セクション認識テスト群（scene3-race.md §2 SSoT + parser-system.md §B 整合）。
// EmojiParser はあにまん形式（🎲含む）が主スコープだが、絆スキル行は Single Line 形式
// （`[名前]　[種別]　dice式=出目 (N)`）を想定する。currentBlock state machine とは独立に
// 【絆スキル】セクション内は共通 helper (parseBondSkillLineFromText) 経由で抽出される。
describe('EmojiParser - Bundle-8-T5 / 【絆スキル】セクション認識', () => {
    const parser = new EmojiParser();
    const participants: Umamusume[] = [
        { id: '1', name: 'ウマ娘A', strategy: '差し', uniqueSkill: { type: 'Stability', phases: [] }, score: 0 } as unknown as Umamusume,
        { id: '3', name: 'ウマ娘C', strategy: '逃げ', uniqueSkill: { type: 'Stability', phases: [] }, score: 0 } as unknown as Umamusume,
        { id: '5', name: 'ウマ娘E', strategy: '先行', uniqueSkill: { type: 'Stability', phases: [] }, score: 0 } as unknown as Umamusume,
    ];

    it('extracts a single bond skill (BondGamble) from 【絆スキル】 section', () => {
        const input = [
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
        ].join('\n');
        const result = parser.parse(input, participants, 'RACE');
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0]).toMatchObject({
            participantId: '1',
            name: 'ウマ娘A',
            type: 'BondGamble',
            diceStr: '1d15',
            diceResult: 12,
            sum: 12,
        });
    });

    it('extracts multiple bond skills (BondGamble + BondStable mixed)', () => {
        const input = [
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
            '③ ウマ娘C　絆安定　5+dice1d5=4 (4)',
            '⑤ ウマ娘E　絆ギャンブル　dice1d15=9 (9)',
        ].join('\n');
        const result = parser.parse(input, participants, 'RACE');
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(3);
        expect(result.bondResults![0]).toMatchObject({ name: 'ウマ娘A', type: 'BondGamble', sum: 12 });
        // 絆安定: fix 5 + dice 出目 4 → sum=9
        expect(result.bondResults![1]).toMatchObject({ name: 'ウマ娘C', type: 'BondStable', sum: 9 });
        expect(result.bondResults![2]).toMatchObject({ name: 'ウマ娘E', type: 'BondGamble', sum: 9 });
    });

    it('returns empty bondResults when only normal race lines are present', () => {
        // EmojiParser Single Line Case A: 1 ダイスのみで inline 結果 = (N) 検算が成立
        const input = 'ウマ娘A 15+🎲 dice1d6=4 (4)';
        const result = parser.parse(input, participants, 'RACE');
        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.bondResults).toHaveLength(0);
    });

    it('reports incomplete multi-line block when crossing into 【絆スキル】 header', () => {
        // 88-ch multi-line ブロック途中で【絆スキル】ヘッダーに遭遇するとブロックが途切れて errors に報告
        const input = [
            '② ウマ娘A 15+🎲 dice3d6=',
            '1回目: 6',
            '2回目: 6',
            // 合計行未到達のまま【絆スキル】ヘッダー突入
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
        ].join('\n');
        const result = parser.parse(input, participants, 'RACE');
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('合計行が見つかりません');
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0].name).toBe('ウマ娘A');
    });

    it('rejects unknown participant inside 【絆スキル】 section', () => {
        const input = [
            '【絆スキル】',
            '① 知らないウマ娘　絆ギャンブル　dice1d15=12 (12)',
        ].join('\n');
        const result = parser.parse(input, participants, 'RACE');
        expect(result.bondResults).toHaveLength(0);
        expect(result.errors.some((e) => e.includes('登録名と一致しないデータ'))).toBe(true);
    });

    it('exits 【絆スキル】 section on next 【XXX】 header', () => {
        const input = [
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
            '【固有スキル】',
            // 【絆スキル】ヘッダーで開始、【固有スキル】ヘッダーで終了
        ].join('\n');
        const result = parser.parse(input, participants, 'RACE');
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0].name).toBe('ウマ娘A');
    });

    it('extracts bond skills from 88-ch format with 🎲 between fix and dice (no (N) trailing)', () => {
        // 実 GM 運用で観測されたフォーマット: `[枠番] [名前]　[種別]　[fix]+🎲 dice式= 出目` (N) なし
        // - fix と dice の間に 🎲 + 空白が挿入される
        // - 末尾に (N) 検算が付かない
        // 仕様 §2 SSoT は (N) 必須化していないため範囲チェックで通過させる。
        const participantsBD: Umamusume[] = [
            { id: '1', name: 'B', strategy: '差し', uniqueSkill: { type: 'Stability', phases: [] }, score: 0 } as unknown as Umamusume,
            { id: '2', name: 'D', strategy: '逃げ', uniqueSkill: { type: 'Stability', phases: [] }, score: 0 } as unknown as Umamusume,
        ];
        const input = [
            '【絆スキル】',
            '② D　絆安定　5+🎲 dice1d5= 1',
            '⑤ B　絆ギャンブル　🎲 dice1d15= 2',
        ].join('\n');
        const result = parser.parse(input, participantsBD, 'RACE');
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(2);
        expect(result.bondResults![0]).toMatchObject({
            name: 'D',
            type: 'BondStable',
            diceStr: '1d5',
            diceResult: 1,
            sum: 6, // fix 5 + dice 1
        });
        expect(result.bondResults![1]).toMatchObject({
            name: 'B',
            type: 'BondGamble',
            diceStr: '1d15',
            diceResult: 2,
            sum: 2, // fix なし
        });
    });
});
