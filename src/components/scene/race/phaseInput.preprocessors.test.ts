import { describe, it, expect } from 'vitest';
import {
    sanitizeInputForParser,
    isUniqueDice,
    classifyDiceResultsForParticipant,
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

// CR-SA-13-E1 / 2026-05-12: ハウスルール脚質ダイス × 固有期待ダイス衝突解消の
// 振り分けロジック（規則 R-1 / R-2 / R-3）。SSoT = scene3-race.md §2 / houserule-features.md §1。
describe('CR-SA-13-E1: phaseInput dice classification (R-1/R-2/R-3)', () => {
    const makeLine = (diceStr: string, diceResult: number, fixValue: number) => ({
        diceStr,
        diceResult,
        fixValue,
    });

    describe('規則 R-1: 発動フェーズ非該当者の不可侵性', () => {
        // (R1-1) ユーザー報告ケース再現 + 解消
        it('(R1-1) 追込 dice.start=1d10 × Stability(phases=[Mid1]) × 現フェーズ Start → baseDice 格納（ユーザー報告ケース再現）', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d10', 8, 0)],
                'Start',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (R1-2) Gamble × End 固有 × 現 Mid1 衝突パターン
        it('(R1-2) Gamble(phases=[End]) × 現フェーズ Mid1 で (0, 1d20) → baseDice 格納', () => {
            const result = classifyDiceResultsForParticipant(
                'Gamble',
                ['End'],
                [makeLine('1d20', 15, 0)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d20', values: [], sum: 15 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (R1-3) 持続型複合固有 × 発動フェーズ外
        it('(R1-3) Persistent(phases=[Mid1, Mid2]) × 現フェーズ Start で (0, 1d10) → baseDice 格納（持続型でも発動外で R-1 適用）', () => {
            const result = classifyDiceResultsForParticipant(
                'Persistent',
                ['Mid1', 'Mid2'],
                [makeLine('1d10', 7, 0)],
                'Start',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 7 });
            expect(result.uniqueDice).toBeUndefined();
        });
    });

    describe('規則 R-2: 発動フェーズ該当者の base 優先原則', () => {
        // (R2-1) baseDice 未設定 + 固有期待一致 1 件 → 先取り抑止
        it('(R2-1) Stability(phases=[Mid1]) × 現フェーズ Mid1 + baseDice 未設定 + 1 件 (5, 1d10) → baseDice 格納（uniqueDice 先取り抑止）', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d10', 8, 5)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (R2-2) baseDice 既存 + 追加 1 件 固有期待一致 → R-3 経由 uniqueDice 格納
        it('(R2-2) Stability × baseDice 既存 (0, 3d8) + 追加 1 件 (5, 1d10) → R-3 経由で uniqueDice 格納', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d10', 8, 5)],
                'Mid1',
                { diceStr: '3d8', values: [], sum: 12 },
            );
            expect(result.baseDice).toBeUndefined();
            expect(result.uniqueDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
        });
    });

    describe('規則 R-3: 同一ブロック貼付時の振り分け', () => {
        // (R3-1) 同一ブロック 2 件貼付 + (fixValue, diceStr) 完全一致
        it('(R3-1) Stability × 同一ブロック 2 件 (0, 3d8) + (5, 1d10) → 1 件目 baseDice + 2 件目 uniqueDice', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('3d8', 12, 0), makeLine('1d10', 8, 5)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '3d8', values: [], sum: 12 });
            expect(result.uniqueDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
        });

        // (R3-2) fixValue 不一致 → uniqueDice 振り分けされず baseDice 上書き
        it('(R3-2) Stability × (0, 3d8) + (0, 1d10) ＝ fixValue 不一致 → 2 件目も baseDice 上書き', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('3d8', 12, 0), makeLine('1d10', 8, 0)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (R3-3) 5 種固有タイプ網羅
        it('(R3-3) 5 種固有タイプ網羅: Stability(5,1d10) / Gamble(0,1d20) / Persistent(0,1d10) / SuperGamble(-10,1d35) / SuperStability(8,1d3)', () => {
            const cases: Array<[UniqueSkillType, string, number]> = [
                ['Stability', '1d10', 5],
                ['Gamble', '1d20', 0],
                ['Persistent', '1d10', 0],
                ['SuperGamble', '1d35', -10],
                ['SuperStability', '1d3', 8],
            ];
            cases.forEach(([type, expectedDiceStr, expectedFixValue]) => {
                const result = classifyDiceResultsForParticipant(
                    type,
                    ['Mid1'],
                    [
                        makeLine('3d8', 12, 0),
                        makeLine(expectedDiceStr, 7, expectedFixValue),
                    ],
                    'Mid1',
                    undefined,
                );
                expect(result.baseDice).toEqual({ diceStr: '3d8', values: [], sum: 12 });
                expect(result.uniqueDice).toEqual({
                    diceStr: expectedDiceStr,
                    values: [],
                    sum: 7,
                });
            });
        });

        // (R3-4) カスタム脚質 dice.mid=1d20 × Gamble 固有衝突解消
        it('(R3-4) Gamble × カスタム脚質 dice.mid=1d20 衝突: (0, 1d20) + (0, 1d20) 2 件 → 1 件目 baseDice + 2 件目 uniqueDice', () => {
            const result = classifyDiceResultsForParticipant(
                'Gamble',
                ['Mid1'],
                [makeLine('1d20', 10, 0), makeLine('1d20', 18, 0)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d20', values: [], sum: 10 });
            expect(result.uniqueDice).toEqual({ diceStr: '1d20', values: [], sum: 18 });
        });
    });

    describe('Default 5 脚質構成 regression（既存挙動完全維持）', () => {
        // (DEF-1) 大逃げ dice.mid=3d6 × Stability × 現 Mid1 = 既存 Default 挙動
        it('(DEF-1) 大逃げ × Stability(phases=[Mid1]) × 現フェーズ Mid1: (0, 3d6) + (5, 1d10) → baseDice + uniqueDice', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('3d6', 11, 0), makeLine('1d10', 7, 5)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '3d6', values: [], sum: 11 });
            expect(result.uniqueDice).toEqual({ diceStr: '1d10', values: [], sum: 7 });
        });

        // (DEF-2) Default 脚質単独フェーズダイスのみ
        it('(DEF-2) Stability(phases=[Mid1]) × 現フェーズ Start: (0, 1d9) 1 件 → baseDice 単独格納', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d9', 6, 0)],
                'Start',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d9', values: [], sum: 6 });
            expect(result.uniqueDice).toBeUndefined();
        });
    });

    describe('state.strategies SSoT 化整合性（Bundle-10-Followup-runtime-sync 連動）', () => {
        // (SYNC-1) カスタム脚質編集後の振り分け = R-1 適用で衝突解消
        it('(SYNC-1) state.strategies で追込 dice.start=1d10 に編集後 × Stability(phases=[Mid1]) × 現フェーズ Start → R-1 適用で baseDice 格納', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d10', 8, 0)],
                'Start',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
            expect(result.uniqueDice).toBeUndefined();
        });
    });

    describe('エッジケース', () => {
        // (EDGE-1) 1 件のみ R-2 適用後の単独完遂
        it('(EDGE-1) Gamble × 現フェーズ Mid1 + 1 件 (0, 1d20) → R-2 で baseDice 単独格納（後続 uniqueDice 不在）', () => {
            const result = classifyDiceResultsForParticipant(
                'Gamble',
                ['Mid1'],
                [makeLine('1d20', 15, 0)],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d20', values: [], sum: 15 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (EDGE-2) 3 件以上の連続到達: defensive 動作
        it('(EDGE-2) 同一参加者 3 件連続到達 (3d8 / 1d10 unique 一致 / 3d8) → uniqueDice 維持 + baseDice 上書き', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [
                    makeLine('3d8', 12, 0),
                    makeLine('1d10', 8, 5),
                    makeLine('3d8', 14, 0),
                ],
                'Mid1',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '3d8', values: [], sum: 14 });
            expect(result.uniqueDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
        });

        // (EDGE-3) uniqueSkillType undefined → R-3 一致判定常に false
        it('(EDGE-3) uniqueSkillType undefined + baseDice 既存 + (5, 1d10) → R-3 で baseDice 上書き（防御的ガード）', () => {
            const result = classifyDiceResultsForParticipant(
                undefined,
                ['Mid1'],
                [makeLine('1d10', 8, 5)],
                'Mid1',
                { diceStr: '3d8', values: [], sum: 12 },
            );
            expect(result.baseDice).toEqual({ diceStr: '1d10', values: [], sum: 8 });
            expect(result.uniqueDice).toBeUndefined();
        });

        // (EDGE-4) 終盤フェーズ End × bondDice 経路と独立
        it('(EDGE-4) End フェーズ × Stability(phases=[Mid1]) で (0, 1d7) → R-1 適用で baseDice 格納（bondResults 経路と独立）', () => {
            const result = classifyDiceResultsForParticipant(
                'Stability',
                ['Mid1'],
                [makeLine('1d7', 5, 0)],
                'End',
                undefined,
            );
            expect(result.baseDice).toEqual({ diceStr: '1d7', values: [], sum: 5 });
            expect(result.uniqueDice).toBeUndefined();
        });
    });
});
