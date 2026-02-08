import { describe, it, expect } from 'vitest';
import { StandardParser } from './standardParser';
import type { Umamusume } from '../../types';

describe('StandardParser', () => {
    const participants: Umamusume[] = [
        { id: '1', name: 'Special Week', strategy: '差し', entryIndex: 1, uniqueSkill: { type: 'Stability', phases: [] }, gate: 1, score: 0, history: {} },
        { id: '2', name: 'Silence Suzuka', strategy: '大逃げ', entryIndex: 2, uniqueSkill: { type: 'Gamble', phases: [] }, gate: 2, score: 0, history: {} }
    ];

    it('parses standard format with fix value', () => {
        // (N) はダイス出目の総和を表す（totalではない）
        // dice3d8 = 3個の8面ダイス、出目: 5 5 5 = 15
        const text = '①Silence Suzuka 30+dice3d8=5 5 5 (15)';
        const result = StandardParser.parse(text, participants);

        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toMatchObject({
            name: 'Silence Suzuka',
            diceStr: '3d8',
            fixValue: 30,
            diceResult: 15,
            total: 45,
            validChecksum: true
        });
    });

    it('parses format without fix value (Start/Unique)', () => {
        const text = 'Special Week dice1d100=50 (50)';
        const result = StandardParser.parse(text, participants);

        expect(result.errors).toHaveLength(0);
        expect(result.results[0]).toMatchObject({
            name: 'Special Week',
            fixValue: 0,
            diceResult: 50,
            total: 50
        });
    });

    it('detects checksum error', () => {
        // Need matching participant
        const p = [...participants, { id: '3', name: 'Something', strategy: '逃げ', entryIndex: 3, uniqueSkill: { type: 'Stability' as const, phases: [] }, gate: 3, score: 0, history: {} } as Umamusume];
        const text = 'Something dice1d6=3 (10)'; // 0+3 != 10

        const result = StandardParser.parse(text, p);
        // Expect Japanese error
        expect(result.errors[0]).toContain('ダイス合計値が不正です');
    });

    it('detects unknown participant', () => {
        const text = 'UnknownHorse dice1d6=3 (3)';
        const result = StandardParser.parse(text, participants);
        expect(result.errors[0]).toContain('登録名と一致しないデータが含まれています');
    });

    it('ignores invalid lines but reports explicit dice errors', () => {
        const text = `
    Just a comment
    InvalidFormat dice3d6
    `;
        const result = StandardParser.parse(text, participants);
        // "Invalid dice format" is still English in code?
        // Checking code: errors.push(`Invalid dice format: "${trimmed}"`); 
        // Yes line 60 of step 53.
        expect(result.errors[0]).toContain('Invalid dice format');
    });

    it('parses with full-width space separator', () => {
        // (N) はダイス出目の総和を表す
        // dice3d8 = 3個の8面ダイス、出目: 5 5 5 = 15
        const text = 'Silence Suzuka　30+dice3d8=5 5 5 (15)';
        const result = StandardParser.parse(text, participants);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('Silence Suzuka');
    });

    // 新規テストケース: 複数ダイスのスペース区切り形式
    describe('複数ダイスのスペース区切り形式', () => {
        const multiDiceParticipants: Umamusume[] = [
            { id: '1', name: 'カンパネラ', strategy: '先行', entryIndex: 1, uniqueSkill: { type: 'Stability', phases: [] }, gate: 1, score: 0, history: {} },
            { id: '2', name: 'ウマ娘A', strategy: '差し', entryIndex: 2, uniqueSkill: { type: 'Stability', phases: [] }, gate: 2, score: 0, history: {} },
            { id: '3', name: 'Silence Suzuka', strategy: '大逃げ', entryIndex: 3, uniqueSkill: { type: 'Gamble', phases: [] }, gate: 3, score: 0, history: {} }
        ];

        it('parses space-separated dice values with parens (dice3d5=3 1 4 (8))', () => {
            // (8) はダイス出目の総和 (3+1+4=8)
            const text = '① カンパネラ　10+dice3d5=3 1 4 (8)';
            const result = StandardParser.parse(text, multiDiceParticipants);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'カンパネラ',
                fixValue: 10,
                diceResult: 8,
                total: 18
            });
        });

        it('parses space-separated dice values without parens (dice3d6=5 3 2)', () => {
            const text = 'ウマ娘A 20+dice3d6=5 3 2';
            const result = StandardParser.parse(text, multiDiceParticipants);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'ウマ娘A',
                fixValue: 20,
                diceResult: 10,
                total: 30
            });
        });

        it('parses negative dice with space-separated values (-dice3d5=3 1 4)', () => {
            // 負のダイスの場合、(8)は-8のダイス結果の絶対値を表す
            const text = 'Silence Suzuka -dice3d5=3 1 4 (8)';
            const result = StandardParser.parse(text, multiDiceParticipants);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'Silence Suzuka',
                diceResult: -8,
                total: -8
            });
        });
    });
});
