import { describe, it, expect } from 'vitest';
import {
    hasReachedEndPhase,
    findActivatedSpecialStrategy,
    getSpecialStrategyAnnotation,
    computeSpecialStrategyTotalDelta,
    stripStrategyAnnotations,
    isPhaseResultLoaded,
} from './specialStrategy.helpers';
import type { Umamusume } from '../../../types';

const makeParticipant = (override: Partial<Umamusume> = {}): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '先行',
    uniqueSkill: { type: 'Stability', phases: [] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

// Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 用 baseDice fixture
// computeSpecialStrategyTotalDelta 新仕様（結果取り込み済判定）で「発動 phase 取り込み済」を表現する。
const makeBaseDice = (diceStr: string, values: number[]) => ({
    diceStr,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

describe('specialStrategy.helpers - Bundle-4 / P4-1, P4-5 / 2026-05-10', () => {
    describe('hasReachedEndPhase', () => {
        it('currentPhaseId === "End" → true', () => {
            expect(hasReachedEndPhase('End', {})).toBe(true);
        });
        it('history に End エントリあり → true', () => {
            expect(hasReachedEndPhase('Mid1', { End: { computedScore: 50 } })).toBe(true);
        });
        it('currentPhaseId が End 以外かつ history に End なし → false', () => {
            expect(hasReachedEndPhase('Mid1', { Start: { computedScore: 20 } })).toBe(false);
        });
        it('currentPhaseId === "judgment_phase" でも history に End あれば true（防御的）', () => {
            expect(hasReachedEndPhase('judgment_phase', { End: { computedScore: 60 } })).toBe(true);
        });
    });

    describe('findActivatedSpecialStrategy', () => {
        it('未発動 → null', () => {
            const p = makeParticipant({
                history: { Start: { computedScore: 20 } },
            });
            expect(findActivatedSpecialStrategy(p)).toBeNull();
        });
        it('Mid1 で Makuri 発動 → { phaseId: "Mid1", value: "Makuri" }', () => {
            const p = makeParticipant({
                history: {
                    Start: { computedScore: 20 },
                    Mid1: { computedScore: 35, specialStrategy: 'Makuri' },
                },
            });
            expect(findActivatedSpecialStrategy(p)).toEqual({ phaseId: 'Mid1', value: 'Makuri' });
        });
        it('Start で Tame 発動 → { phaseId: "Start", value: "Tame" }', () => {
            const p = makeParticipant({
                history: {
                    Start: { computedScore: 20, specialStrategy: 'Tame' },
                },
            });
            expect(findActivatedSpecialStrategy(p)).toEqual({ phaseId: 'Start', value: 'Tame' });
        });
        it('null 値は無視（取り消し済み）→ null', () => {
            const p = makeParticipant({
                history: {
                    Mid1: { computedScore: 26, specialStrategy: null },
                },
            });
            expect(findActivatedSpecialStrategy(p)).toBeNull();
        });
    });

    describe('getSpecialStrategyAnnotation', () => {
        it('発動フェーズで Makuri → " 【捲り】+15"（先頭スペース 1 個、効果値 15）', () => {
            const p = makeParticipant({
                history: { Mid1: { computedScore: 35, specialStrategy: 'Makuri' } },
            });
            expect(getSpecialStrategyAnnotation(p, 'Mid1', 15)).toBe(' 【捲り】+15');
        });
        it('発動フェーズで Tame → " 【溜め】-20"（効果値 20）', () => {
            const p = makeParticipant({
                history: { Start: { computedScore: 0, specialStrategy: 'Tame' } },
            });
            expect(getSpecialStrategyAnnotation(p, 'Start', 20)).toBe(' 【溜め】-20');
        });
        it('終盤フェーズで過去 Makuri 発動済 → " 【捲り】-15"（自動反動）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: { computedScore: 35, specialStrategy: 'Makuri' },
                    End: { computedScore: 60 },
                },
            });
            expect(getSpecialStrategyAnnotation(p, 'End', 15)).toBe(' 【捲り】-15');
        });
        it('終盤フェーズで過去 Tame 発動済 → " 【溜め】+15"（自動解放）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: { computedScore: 5, specialStrategy: 'Tame' },
                    End: { computedScore: 60 },
                },
            });
            expect(getSpecialStrategyAnnotation(p, 'End', 15)).toBe(' 【溜め】+15');
        });
        it('未発動 → 空文字列', () => {
            const p = makeParticipant({ history: { Mid1: { computedScore: 26 } } });
            expect(getSpecialStrategyAnnotation(p, 'Mid1', 15)).toBe('');
        });
        it('終盤フェーズで過去発動なし → 空文字列', () => {
            const p = makeParticipant({
                history: { End: { computedScore: 60 } },
            });
            expect(getSpecialStrategyAnnotation(p, 'End', 15)).toBe('');
        });
        it('発動フェーズで specialStrategy === null → 空文字列', () => {
            const p = makeParticipant({
                history: { Mid1: { computedScore: 26, specialStrategy: null } },
            });
            expect(getSpecialStrategyAnnotation(p, 'Mid1', 15)).toBe('');
        });
    });

    describe('computeSpecialStrategyTotalDelta', () => {
        it('未発動 → 0', () => {
            const p = makeParticipant({ history: { Start: { computedScore: 20 } } });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(0);
        });
        it('Mid1 で Makuri 発動 (取り込み済) ・history.End なし → +15（即時加算のみ）', () => {
            // Bundle-4-Followup-E1: 結果取り込み済を表現するため baseDice 追加（旧仕様 history に baseDice なくとも
            // +15 が期待されたが、新仕様では取り込み済前提で同 assertion を維持）
            const p = makeParticipant({
                history: {
                    Mid1: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        computedScore: 35,
                        specialStrategy: 'Makuri',
                    },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(15);
        });
        it('Mid1 で Makuri 発動 (取り込み済) ・history.End あり → 0（+15 即時 + (-15) 反動 = 0）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        computedScore: 35,
                        specialStrategy: 'Makuri',
                    },
                    End: { baseDice: makeBaseDice('1d7', [5]), computedScore: 60 },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(0);
        });
        it('Start で Tame 発動 (取り込み済) ・history.End なし → -20（即時減算のみ、効果値 20）', () => {
            const p = makeParticipant({
                history: {
                    Start: {
                        baseDice: makeBaseDice('3d8', [3, 4, 3]),
                        computedScore: 20,
                        specialStrategy: 'Tame',
                    },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 20, true)).toBe(-20);
        });
        it('Start で Tame 発動 (取り込み済) ・history.End あり → 0（-20 即時 + (+20) 解放 = 0、効果値 20）', () => {
            const p = makeParticipant({
                history: {
                    Start: {
                        baseDice: makeBaseDice('3d8', [3, 4, 3]),
                        computedScore: 20,
                        specialStrategy: 'Tame',
                    },
                    End: { baseDice: makeBaseDice('1d7', [5]), computedScore: 50 },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 20, true)).toBe(0);
        });
        it('発動フェーズ自体が End → 0（仕様上不可だが防御的に 0）', () => {
            const p = makeParticipant({
                history: {
                    End: {
                        baseDice: makeBaseDice('1d7', [5]),
                        computedScore: 60,
                        specialStrategy: 'Makuri',
                    },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(0);
        });
        it('enableSpecialStrategy === false → 0（過去データがあっても無効化）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        computedScore: 35,
                        specialStrategy: 'Makuri',
                    },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, false)).toBe(0);
        });
    });

    // Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
    // specialStrategy 効果値の score 反映タイミング統一に伴う新規テスト群。
    // 結果取り込み済判定 (`isPhaseResultLoaded`) + 結果取り込み前の delta 0 挙動の regression。
    describe('isPhaseResultLoaded - Bundle-4-Followup-E1 / 2026-05-12', () => {
        it('(I1) baseDice あり → true（Parser 解析実行済）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        computedScore: 9,
                    },
                },
            });
            expect(isPhaseResultLoaded(p, 'Mid1')).toBe(true);
        });
        it('(I2) uniqueDice あり → true（固有スキル取り込み済）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: {
                        uniqueDice: makeBaseDice('1d10', [7]),
                        computedScore: 7,
                    },
                },
            });
            expect(isPhaseResultLoaded(p, 'Mid1')).toBe(true);
        });
        it('(I3) manualModifier あり → true（GM 補正済）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: {
                        manualModifier: { value: 5, reason: '妨害' },
                        computedScore: 5,
                    },
                },
            });
            expect(isPhaseResultLoaded(p, 'Mid1')).toBe(true);
        });
        it('(I4) specialStrategy のみ + 上記いずれもなし → false（事前操作 = 結果取り込み前）', () => {
            const p = makeParticipant({
                history: {
                    Mid1: { specialStrategy: 'Makuri', computedScore: 0 },
                },
            });
            expect(isPhaseResultLoaded(p, 'Mid1')).toBe(false);
        });
        it('(I5) history エントリ不在 → false', () => {
            const p = makeParticipant({ history: {} });
            expect(isPhaseResultLoaded(p, 'Mid1')).toBe(false);
        });
    });

    describe('computeSpecialStrategyTotalDelta - Bundle-4-Followup-E1 / 2026-05-12 反映タイミング統一', () => {
        it('(T1) 事前操作 (baseDice なし) + Makuri → 0（結果取り込み前 = score 不変、二重加算誤認リスク解消）', () => {
            // Scene 1 事前申告連動 ON または戦法ボタン事前 ON のシナリオ
            // 旧仕様（Bundle-4 ENG28）では +15 即時加算だったが、SA21 案 A 採択で 0 に挙動変更
            const p = makeParticipant({
                history: { Mid1: { specialStrategy: 'Makuri', computedScore: 0 } },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(0);
        });
        it('(T2) 事前操作 (baseDice なし) + Tame + history.End あり (仕様外) → 0（防御的）', () => {
            // 発動 phase 結果取り込み前で End に到達するシナリオは GM 進行ルール上不可だが、
            // 防御的に delta = 0 を返すことを保証する
            const p = makeParticipant({
                history: {
                    Mid1: { specialStrategy: 'Tame', computedScore: 0 },
                    End: { baseDice: makeBaseDice('1d7', [5]), computedScore: 5 },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(0);
        });
        it('(T3) 取り込み済判定が manualModifier 単独でも成立 → +15（GM 操作のみで取り込み扱い）', () => {
            // 発動 phase に baseDice / uniqueDice なくとも manualModifier があれば「結果取り込み済」
            const p = makeParticipant({
                history: {
                    Mid1: {
                        manualModifier: { value: 3, reason: '加算' },
                        specialStrategy: 'Makuri',
                        computedScore: 3,
                    },
                },
            });
            expect(computeSpecialStrategyTotalDelta(p, 15, true)).toBe(15);
        });
    });

    describe('stripStrategyAnnotations - Bundle-4 ESCALATION 案 V Provisional', () => {
        it('単行内の【捲り】+15 を除去（半角符号、ユーザーフィードバック実例）', () => {
            const input = '① makuri　5+dice1d12=10(10) 【捲り】+15';
            expect(stripStrategyAnnotations(input)).toBe('① makuri　5+dice1d12=10(10)');
        });
        it('【溜め】-15 も除去', () => {
            const input = '② tame 5+dice1d12=10(10) 【溜め】-15';
            expect(stripStrategyAnnotations(input)).toBe('② tame 5+dice1d12=10(10)');
        });
        it('終盤の【捲り】-15 反動も除去', () => {
            const input = '36+-dice1d27=25(25) 【捲り】-15';
            expect(stripStrategyAnnotations(input)).toBe('36+-dice1d27=25(25)');
        });
        it('全角符号 ＋ も除去（防御的）', () => {
            const input = '① a 5+dice1d10=5(5) 【捲り】＋15';
            expect(stripStrategyAnnotations(input)).toBe('① a 5+dice1d10=5(5)');
        });
        it('複数行の併記をすべて除去', () => {
            const input = [
                '① a 5+dice1d10=5(5) 【捲り】+15',
                '② b 0+dice1d9=3(3) 【溜め】-15',
                '③ c 0+dice1d9=4(4)',
            ].join('\n');
            const expected = [
                '① a 5+dice1d10=5(5)',
                '② b 0+dice1d9=3(3)',
                '③ c 0+dice1d9=4(4)',
            ].join('\n');
            expect(stripStrategyAnnotations(input)).toBe(expected);
        });
        it('併記なしのテキストは無変更', () => {
            const input = '① a 5+dice1d10=5(5)';
            expect(stripStrategyAnnotations(input)).toBe(input);
        });
        it('部分的なパターン（括弧違い・別単語）は除去しない', () => {
            const input = '① a 5+dice1d10=5(5) [捲り]+15 / (溜め)-15';
            expect(stripStrategyAnnotations(input)).toBe(input);
        });
    });
});
