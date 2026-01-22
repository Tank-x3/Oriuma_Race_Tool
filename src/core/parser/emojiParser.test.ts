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

    it('should parse single-line format correctly (Standard-like behavior)', () => {
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

    it('should handle single-line with space after equals (User Report)', () => {
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

    it('should parse multi-line block format (88-ch)', () => {
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

    it('should ignore non-dice posts', () => {
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
});
