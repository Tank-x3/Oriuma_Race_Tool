import { describe, it, expect } from 'vitest';
import { StandardParser } from './standardParser';
import type { Umamusume } from '../../types';

describe('StandardParser', () => {
    const participants: Umamusume[] = [
        { id: '1', name: 'Special Week', strategy: '差し', entryIndex: 1, uniqueSkill: { type: 'Stability', phases: [] }, gate: 1, score: 0, history: {} },
        { id: '2', name: 'Silence Suzuka', strategy: '大逃げ', entryIndex: 2, uniqueSkill: { type: 'Gamble', phases: [] }, gate: 2, score: 0, history: {} }
    ];

    // 移植先: realData.test.ts CR-SA-3-E5-2 #42 (CR-SA-3-E5-2)
    it.skip('parses standard format with fix value', () => {
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

    // 移植先: realData.test.ts CR-SA-3-E5-2 #43 (CR-SA-3-E5-2)
    it.skip('parses format without fix value (Start/Unique)', () => {
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

    // 移植先: derivedData.test.ts invalidParenSum パターン (CR-SA-3-E5-2 #44)
    it.skip('detects checksum error', () => {
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

    // 移植先: realData.test.ts CR-SA-3-E5-2 #47 (CR-SA-3-E5-2)
    it.skip('parses with full-width space separator', () => {
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

        // 移植先: realData.test.ts CR-SA-3-E5-2 #48 (CR-SA-3-E5-2)
        it.skip('parses space-separated dice values with parens (dice3d5=3 1 4 (8))', () => {
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

        // 移植先: derivedData.test.ts invalidParenSum パターン (CR-SA-3-E5-2 #49)
        it.skip('rejects space-separated dice values without parens (CR-4b: (N) 必須化)', () => {
            // CR-4b: (N) 必須化（parser-system.md §A L93-94, L142）
            // あにまん仕様により StandardParser は (N) 必須。欠落時は errors 追加 + results 排除（continue）。
            const text = 'ウマ娘A 20+dice3d6=5 3 2';
            const result = StandardParser.parse(text, multiDiceParticipants);

            expect(result.results).toHaveLength(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('合計値');
        });

        // 保持判断 (CR-SA-3-E5-2 #50): 「複数ダイス space-separated negative」(-dice3d5=3 1 4) は実データ層 7 ファイルに不在のため移植中止。設計駆動層に残置。
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

    // CR-7 Part A: #3-3-A PACE コンテキストテスト
    // 仕様: docs/specs/architecture/parser-system.md §A Context 2 PACE (L121-128)
    // 委譲先: standardParser.ts:18-56 parsePace
    describe('PACE context', () => {
        // 移植先: realData.test.ts CR-SA-3-E5-2 #51 (CR-SA-3-E5-2)
        it.skip('parses PACE context correctly with dice1d9=N', () => {
            const text = 'GM\ndice1d9=4';
            const result = StandardParser.parse(text, [], 'PACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                diceResult: 4,
                diceStr: '1d9',
                participantId: 'GM',
                name: 'GM',
                total: 4,
                fixValue: 0,
                validChecksum: true,
            });
        });

        it('returns error when no PACE dice found', () => {
            const result = StandardParser.parse('no dice here', [], 'PACE');

            expect(result.results).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('ペースダイス');
        });

        it('returns error when multiple PACE dice found', () => {
            const text = 'dice1d9=4\ndice1d9=7';
            const result = StandardParser.parse(text, [], 'PACE');

            expect(result.results).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('複数');
        });

        // 移植先: realData.test.ts CR-SA-3-E5-2 #54 (ParserFactory delegation 経由)
        it.skip('parses PACE with leading 🎲 emoji', () => {
            // (?:🎲)? 分岐の網羅
            const text = '🎲 dice1d9=5';
            const result = StandardParser.parse(text, [], 'PACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].diceResult).toBe(5);
            expect(result.results[0].participantId).toBe('GM');
        });

        // CR-SA-3-E5-3 保持判断: 両側空白 `dice1d9 = 5` リテラルは実データに不在（88ch race-001〜004 全件は `dice1d9= N` の右側のみ空白、animan race-001〜003 全件は空白なし）。`\s*=\s*` 分岐の網羅は実データ層 88ch PACE phase 経由で間接カバー済だが、リテラル境界保証として設計駆動層に残置（CR-SA-3-E5-3）
        it('parses PACE with whitespace around equals sign', () => {
            // \s*=\s* 分岐の網羅
            const text = 'dice1d9 = 5';
            const result = StandardParser.parse(text, [], 'PACE');

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].diceResult).toBe(5);
        });
    });

    // Bundle-2 / D-1, D-14 / 2026-05-09 [ESCALATION 案 V Provisional 適用]:
    // 拡張固有タイプ「超ギャンブル」(-10+dice1d35=N) / 「超安定」(8+dice1d3=N) の Single Line + (N) 形式が
    // Parser で「Invalid dice format」エラーにならず正しく解析されることを保証する。
    describe('Extended Unique Skill type Fix value (Bundle-2)', () => {
        const participantsExt: Umamusume[] = [
            { id: '1', name: 'RevivalSimon', strategy: '先行', entryIndex: 1, uniqueSkill: { type: 'SuperGamble', phases: ['Mid'] }, gate: 3, score: 0, history: {} },
            { id: '2', name: 'マヨイゴメイズ', strategy: '差し', entryIndex: 2, uniqueSkill: { type: 'SuperStability', phases: ['Mid'] }, gate: 14, score: 0, history: {} },
        ];

        it('parses SuperGamble line "③　RevivalSimon　-10+dice1d35=28 (28)" without error', () => {
            // 全角スペース区切りの Single Line + (N) 形式（ユーザー実機テスト由来 88ch コピペ形式）
            const text = '③　RevivalSimon　-10+dice1d35=28 (28)';
            const result = StandardParser.parse(text, participantsExt);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'RevivalSimon',
                diceStr: '1d35',
                fixValue: -10,
                diceResult: 28,
                total: 18, // -10 + 28
                validChecksum: true
            });
        });

        it('parses SuperStability line "Name 8+dice1d3=2 (2)" without error', () => {
            const text = 'マヨイゴメイズ 8+dice1d3=2 (2)';
            const result = StandardParser.parse(text, participantsExt);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'マヨイゴメイズ',
                diceStr: '1d3',
                fixValue: 8,
                diceResult: 2,
                total: 10, // 8 + 2
                validChecksum: true
            });
        });

        it('keeps existing positive Fix value behavior intact (regression guard)', () => {
            // 既存の正の Fix value (30+dice3d8=...) が修正後も同じく解析されることを保証
            const text = '①Special Week 30+dice3d8=5 5 5 (15)';
            const result = StandardParser.parse(text, participants);

            expect(result.errors).toHaveLength(0);
            expect(result.results).toHaveLength(1);
            expect(result.results[0]).toMatchObject({
                name: 'Special Week',
                diceStr: '3d8',
                fixValue: 30,
                diceResult: 15,
                total: 45,
                validChecksum: true
            });
        });
    });
});

// Bundle-8-T5 / CR-SA-4 / 2026-05-10:
// 【絆スキル】セクション認識テスト群（scene3-race.md §2 SSoT 準拠）。
// Parser は phase 情報を持たないため、終盤抑制（仕様 §2「他フェーズでの非表示」）の検証は
// PhaseInput 側のガードで行う。本 describe は Parser 単体での抽出ロジックのみ検証する。
describe('StandardParser - Bundle-8-T5 / 【絆スキル】セクション認識', () => {
    const participants: Umamusume[] = [
        { id: '1', name: 'ウマ娘A', strategy: '差し', entryIndex: 1, uniqueSkill: { type: 'Stability', phases: [] }, gate: 1, score: 0, history: {} },
        { id: '3', name: 'ウマ娘C', strategy: '逃げ', entryIndex: 3, uniqueSkill: { type: 'Stability', phases: [] }, gate: 3, score: 0, history: {} },
        { id: '5', name: 'ウマ娘E', strategy: '先行', entryIndex: 5, uniqueSkill: { type: 'Stability', phases: [] }, gate: 5, score: 0, history: {} },
    ];

    it('extracts a single bond skill (BondGamble) from 【絆スキル】 section', () => {
        const text = '【絆スキル】\n① ウマ娘A　絆ギャンブル　dice1d15=12 (12)';
        const result = StandardParser.parse(text, participants);
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

    it('extracts multiple bond skills (BondGamble / BondStable mixed)', () => {
        const text = [
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
            '③ ウマ娘C　絆安定　5+dice1d5=3 (3)',
            '⑤ ウマ娘E　絆ギャンブル　dice1d15=7 (7)',
        ].join('\n');
        const result = StandardParser.parse(text, participants);
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(3);
        expect(result.bondResults![0]).toMatchObject({ name: 'ウマ娘A', type: 'BondGamble', diceResult: 12, sum: 12 });
        // 絆安定: fix=5 + dice 出目 3 → sum=8
        expect(result.bondResults![1]).toMatchObject({ name: 'ウマ娘C', type: 'BondStable', diceResult: 3, sum: 8 });
        expect(result.bondResults![2]).toMatchObject({ name: 'ウマ娘E', type: 'BondGamble', diceResult: 7, sum: 7 });
    });

    it('returns empty bondResults when 【絆スキル】 section is absent', () => {
        const text = 'ウマ娘A 30+dice3d8=5 5 5 (15)';
        const result = StandardParser.parse(text, participants);
        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.bondResults).toHaveLength(0);
    });

    it('rejects unknown participant inside 【絆スキル】 section', () => {
        const text = '【絆スキル】\n① 知らないウマ娘　絆ギャンブル　dice1d15=12 (12)';
        const result = StandardParser.parse(text, participants);
        expect(result.bondResults).toHaveLength(0);
        expect(result.errors[0]).toContain('登録名と一致しないデータ');
    });

    it('rejects unrecognized bond skill type label', () => {
        const text = '【絆スキル】\n① ウマ娘A　絆無限　dice1d15=12 (12)';
        const result = StandardParser.parse(text, participants);
        expect(result.bondResults).toHaveLength(0);
        expect(result.errors[0]).toContain('絆スキル種別ラベルが認識できません');
    });

    it('accepts bond line without (N) when dice value is within range', () => {
        // 仕様 §2 SSoT は (N) 必須化していない。範囲チェック (1〜15) で通過する。
        const text = '【絆スキル】\n① ウマ娘A　絆ギャンブル　dice1d15=12';
        const result = StandardParser.parse(text, participants);
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0]).toMatchObject({ name: 'ウマ娘A', diceResult: 12, sum: 12 });
    });

    it('rejects bond line without (N) when dice value is out of range', () => {
        // dice1d5 だが値 10 は範囲外（1〜5）→ 範囲外エラー
        const text = '【絆スキル】\n③ ウマ娘C　絆安定　5+dice1d5=10';
        const result = StandardParser.parse(text, participants);
        expect(result.bondResults).toHaveLength(0);
        expect(result.errors[0]).toContain('範囲外');
    });

    it('extracts bond results alongside normal race results in mixed input', () => {
        const text = [
            '【序盤 ダイス】',
            '① ウマ娘A 30+dice3d8=5 5 5 (15)',
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
        ].join('\n');
        const result = StandardParser.parse(text, participants);
        expect(result.errors).toHaveLength(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('ウマ娘A');
        expect(result.results[0].total).toBe(45);
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0]).toMatchObject({ name: 'ウマ娘A', type: 'BondGamble', sum: 12 });
    });

    it('exits 【絆スキル】 section on next 【XXX】 header', () => {
        const text = [
            '【絆スキル】',
            '① ウマ娘A　絆ギャンブル　dice1d15=12 (12)',
            '【固有スキル】',
            'ウマ娘C dice1d10=8 (8)',
        ].join('\n');
        const result = StandardParser.parse(text, participants);
        expect(result.errors).toHaveLength(0);
        expect(result.bondResults).toHaveLength(1);
        expect(result.bondResults![0].name).toBe('ウマ娘A');
        // 【固有スキル】ヘッダー行で inBondSection が解除され、次のダイス行は通常解析へ
        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('ウマ娘C');
    });

    it('rejects bond line with checksum mismatch ((N) not matching dice sum)', () => {
        // dice 出目 12 だが (5) と矛盾
        const text = '【絆スキル】\n① ウマ娘A　絆ギャンブル　dice1d15=12 (5)';
        const result = StandardParser.parse(text, participants);
        expect(result.bondResults).toHaveLength(0);
        expect(result.errors[0]).toContain('ダイス合計値が不正です');
    });
});
