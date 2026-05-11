import { describe, it, expect } from 'vitest';
import {
    sanitizeInputForParser,
    isUniqueDice,
} from './phaseInput.preprocessors';
import type { UniqueSkillType } from '../../../types';

describe('CR-SA-11-Sub-B-E1: phaseInput preprocessors', () => {
    describe('sanitizeInputForParser', () => {
        // (P1) 戦法注釈除去（基本、Bundle-4 ENG28 由来の挙動 regression）
        it('(P1) 戦法注釈付きダイス出力 → 注釈が除去される', () => {
            const input = '① makuri　5+dice1d12=10(10) 【捲り】+15';
            expect(sanitizeInputForParser(input)).toBe('① makuri　5+dice1d12=10(10)');
        });

        // (P2) 戦法注釈なし regression（同一文字列返却）
        it('(P2) 戦法注釈なし入力 → 同一文字列返却', () => {
            const input = '① makuri　5+dice1d12=10(10)';
            expect(sanitizeInputForParser(input)).toBe(input);
        });

        // (P3) 複数行入力での戦法注釈除去
        it('(P3) 複数行入力で複数行に戦法注釈混在 → 各行で除去される', () => {
            const input = [
                '① makuri　5+dice1d12=10(10) 【捲り】+15',
                '② tame　5+dice1d12=8(8) 【溜め】-15',
                '③ normal　5+dice1d12=7(7)',
            ].join('\n');
            const expected = [
                '① makuri　5+dice1d12=10(10)',
                '② tame　5+dice1d12=8(8)',
                '③ normal　5+dice1d12=7(7)',
            ].join('\n');
            expect(sanitizeInputForParser(input)).toBe(expected);
        });

        // (P4) edge case: 空文字 / 戦法注釈のみ / 捲り・溜めバリアント
        it('(P4) edge case: 空文字 / 戦法注釈のみ行 / 捲り・溜め両バリアント網羅', () => {
            // 空文字 → 空文字
            expect(sanitizeInputForParser('')).toBe('');
            // 戦法注釈のみ → 注釈除去後は空文字
            expect(sanitizeInputForParser(' 【捲り】+15')).toBe('');
            expect(sanitizeInputForParser(' 【溜め】-15')).toBe('');
            // 終盤反動・解放パターン
            expect(sanitizeInputForParser('① x　1+dice1d10=2(2) 【捲り】-15')).toBe('① x　1+dice1d10=2(2)');
            expect(sanitizeInputForParser('② y　1+dice1d10=3(3) 【溜め】+15')).toBe('② y　1+dice1d10=3(3)');
        });
    });

    describe('isUniqueDice', () => {
        // (U1) 拡張固有タイプ一致（Gamble + 1d20）
        it('(U1) Gamble + "1d20" → true', () => {
            expect(isUniqueDice('Gamble', '1d20')).toBe(true);
        });

        // (U2) 拡張固有タイプ不一致（Gamble + 1d10）
        it('(U2) Gamble + "1d10" → false（不一致）', () => {
            expect(isUniqueDice('Gamble', '1d10')).toBe(false);
        });

        // (U3) uniqueSkillType undefined regression
        it('(U3) uniqueSkillType undefined → false（防御的ガード）', () => {
            expect(isUniqueDice(undefined, '1d20')).toBe(false);
        });

        // (U4) 各 UniqueSkillType の網羅（5 種完全一致 + 不一致パターン）
        it('(U4) 5 種固有タイプ網羅: Stability / Gamble / Persistent / SuperGamble / SuperStability', () => {
            const expectations: Array<[UniqueSkillType, string, boolean]> = [
                // 期待ダイス式と完全一致 → true
                ['Stability', '1d10', true],
                ['Gamble', '1d20', true],
                ['Persistent', '1d10', true],
                ['SuperGamble', '1d35', true],
                ['SuperStability', '1d3', true],
                // 不一致パターン → false（拡張固有タイプを含む 5 種すべて検証）
                ['Stability', '1d20', false],
                ['Gamble', '1d10', false],
                ['Persistent', '1d20', false],
                ['SuperGamble', '1d20', false],
                ['SuperStability', '1d10', false],
            ];
            expectations.forEach(([type, diceStr, expected]) => {
                expect(isUniqueDice(type, diceStr)).toBe(expected);
            });
        });
    });
});
