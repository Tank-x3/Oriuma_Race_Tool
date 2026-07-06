import { describe, it, expect } from 'vitest';
import { Calculator, getActivePhaseIdsForConfig, getLastEndPhaseId } from './calculator';
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from './strategies';
import type { Umamusume, UniqueDiceConfig, RaceState, CustomUniqueSkill } from '../types';

describe('Calculator', () => {
    const mockUma: Umamusume = {
        id: '1',
        entryIndex: 1,
        name: 'Teio',
        strategy: '先行',
        uniqueSkill: { type: 'Stability', phases: ['Start'] },
        gate: 1,
        score: 0,
        history: {}
    };

    it('calculates Start phase score correctly', () => {
        // Strategy: 先行 (Fix 10)
        // Rolling 3d5 -> Assume dice sum is 10
        const startDice = { diceStr: '3d5', values: [3, 4, 3], sum: 10, isNegative: false };

        // Create a deep copy to modify
        const uma = {
            ...mockUma, history: {
                'Start': { baseDice: startDice, computedScore: 0 }
            }
        };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
        // 10 (Fix) + 10 (Dice) = 20
        expect(score).toBe(20);
    });

    it('applies Pace modifier correctly for Mid phase', () => {
        // Strategy: 先行 (Fix 10)
        // Pace 1 (Do-Slow) -> 先行 gets +5
        const startDice = { diceStr: '3d5', values: [3, 4, 3], sum: 10 }; // Fix 10 + 10 = 20
        const midDice = { diceStr: '3d5', values: [2, 2, 2], sum: 6 };

        const uma = {
            ...mockUma, history: {
                'Start': { baseDice: startDice, computedScore: 20 },
                'Mid': { baseDice: midDice, computedScore: 0 }
            }
        };

        // Calculate score with Pace roll 1
        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, 1);
        // Start: 20
        // Pace Mod: +5
        // Mid: +6
        // Total: 31
        expect(score).toBe(31);
    });

    it('handles negative dice logic (Oonige End)', () => {
        // Strategy: 大逃げ (Fix 30)
        // Pace: 5 (Middle) -> +0

        // Mock Oonige
        const oonige: Umamusume = {
            ...mockUma,
            strategy: '大逃げ',
            name: 'Suzuka'
        };

        const startDice = { diceStr: '3d8', values: [1, 1, 1], sum: 3 }; // Fix 30 + 3 = 33
        // End dice: -1d27. If result is 15, logic says negative value.
        // Dice.roll('-1d27') would return sum -15, isNegative true.
        const endDice = { diceStr: '-1d27', values: [15], sum: -15, isNegative: true };

        const history = {
            'Start': { baseDice: startDice, computedScore: 33 },
            'End': { baseDice: endDice, computedScore: 0 }
        };
        const uma = { ...oonige, history };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, 5);
        // Start: 33
        // Pace: +0
        // End: -15
        // Total: 18
        expect(score).toBe(18);
    });

    describe('Unique Skill phase restriction', () => {
        it('adds uniqueDice when phase matches (phases: ["Start"], phase: Start)', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Dice 9 + Unique (5 + 8) = 32
            expect(score).toBe(32);
        });

        it('does NOT add uniqueDice when phase does not match (prevents double counting)', () => {
            // phases: ['Mid1'] だが Mid2 に uniqueDice が残存しているケース
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const mid1Unique = { diceStr: '1d10', values: [7], sum: 7 };
            const mid2Unique = { diceStr: '1d10', values: [6], sum: 6 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: ['Mid1'] },
                history: {
                    'Start': { baseDice: startDice, computedScore: 0 },
                    'Mid1': { baseDice: { diceStr: '3d5', values: [2, 2, 2], sum: 6 }, uniqueDice: mid1Unique, computedScore: 0 },
                    'Mid2': { baseDice: { diceStr: '3d5', values: [3, 3, 3], sum: 9 }, uniqueDice: mid2Unique, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Mid1 (6 + Unique 5+7=12) + Mid2 (9のみ、uniqueは加算されない)
            // = 10 + 9 + 6 + 12 + 9 = 46
            expect(score).toBe(46);
        });

        it('does NOT add uniqueDice when phases is empty', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: [] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Dice 9 = 19 (uniqueは加算されない)
            expect(score).toBe(19);
        });

        it('respects phase restriction for Gamble type', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d20', values: [15], sum: 15 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Gamble', phases: ['Mid1'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Dice 9 = 19 (Start は phases に含まれないので unique 無視)
            expect(score).toBe(19);
        });

        it('respects phase restriction for Persistent type', () => {
            const midDice = { diceStr: '3d5', values: [4, 4, 4], sum: 12 };
            const uniqueDice = { diceStr: '1d6', values: [5], sum: 5 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Persistent', phases: ['Mid2'] },
                history: {
                    'Start': { baseDice: { diceStr: '3d5', values: [3, 3, 3], sum: 9 }, computedScore: 0 },
                    'Mid2': { baseDice: midDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Mid2 (12 + 5) = 36 (Persistent は固定ボーナスなし)
            expect(score).toBe(36);
        });
    });

    describe('Bundle-2 / D-1, D-14 / 2026-05-09 拡張固有タイプ accumulated score', () => {
        it('adds SuperGamble (-10 + diceSum) when phase matches', () => {
            // 先行 (Fix 10), Start dice 9, SuperGamble 1d35 → 20
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d35', values: [20], sum: 20 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'SuperGamble', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Unique (-10 + 20) = 29
            expect(score).toBe(29);
        });

        it('adds SuperStability (+8 + diceSum) when phase matches', () => {
            // 先行 (Fix 10), Start dice 9, SuperStability 1d3 → 2
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d3', values: [2], sum: 2 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'SuperStability', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Unique (8 + 2) = 29
            expect(score).toBe(29);
        });

        it('adds SuperGamble fixed value (-10) in Mid phase as well', () => {
            // 先行 (Fix 10), Start dice 9, Mid dice 6, SuperGamble in Mid1
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const midDice = { diceStr: '3d5', values: [2, 2, 2], sum: 6 };
            const uniqueDice = { diceStr: '1d35', values: [25], sum: 25 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'SuperGamble', phases: ['Mid1'] },
                history: {
                    'Start': { baseDice: startDice, computedScore: 0 },
                    'Mid1': { baseDice: midDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Mid1 6 + Unique (-10 + 25) = 40
            expect(score).toBe(40);
        });

        it('does NOT add SuperGamble fixed value when phase does not match', () => {
            // SuperGamble の発動位置が Mid1 だが Start にダイス残存しているケース
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const startUnique = { diceStr: '1d35', values: [20], sum: 20 }; // 不正データ

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'SuperGamble', phases: ['Mid1'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: startUnique, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 = 19 (Start は phases に含まれないので unique 無視)
            expect(score).toBe(19);
        });

        // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（fixValue -20 + 1d45）の固定値加算（uniqueDiceConfig 参照経路）
        it('adds GambleII (-20 + diceSum) when phase matches', () => {
            // 先行 (Fix 10), Start dice 9, GambleII 1d45 → 25
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d45', values: [25], sum: 25 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'GambleII', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Unique (-20 + 25) = 24
            expect(score).toBe(24);
        });

        // CR-SA-19 / 2026-06-06 ★複数ダイス合算の核心: 安定型Ⅱ（fixValue 0 + 2d7）。
        // 固有スキル初の複数ダイス（count >= 2）。uniqueDice.sum が 2 個出目の合算（3+5=8）であることを検証。
        it('adds StabilityII (0 + 複数ダイス sum) and sums 2 dice values correctly', () => {
            // 先行 (Fix 10), Start dice 9, StabilityII 2d7 → [3, 5] sum 8
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '2d7', values: [3, 5], sum: 8 };

            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'StabilityII', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };

            const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            // Fix 10 + Start 9 + Unique (0 + 8) = 27（2 個出目 3+5 が合算されて加算される）
            expect(score).toBe(27);
        });
    });

    it('adds Unique Skill bonus if activated', () => {
        // 先行 (Fix 10)
        // Unique: Stability (5 + 1d10)
        // Activated in Start

        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 }; // 8 rolled
        // Logic: Stability gets +5 fix + dice sum.

        const uma: Umamusume = {
            ...mockUma,
            history: {
                'Start': {
                    baseDice: startDice,
                    uniqueDice: uniqueDice,
                    computedScore: 0
                }
            }
        };

        const score = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
        // Fix 10 + Dice 9 = 19
        // Unique: 5 (Stab Fix) + 8 (Dice) = 13
        // Total: 32
        expect(score).toBe(32);
    });

    // CR-SA-15-E2 / 2026-05-15: calculateTotalScore の固有固定値が uniqueDiceConfig 参照化された
    // ことの検証（houserule-features.md §5.4）。カスタム設定値が score に反映され、引数省略時は
    // DEFAULT_UNIQUE_DICE_CONFIG フォールバック（= 従来のハードコード値と完全一致）となる。
    describe('CR-SA-15-E2: calculateTotalScore uniqueDiceConfig 参照化', () => {
        it('カスタム設定（安定型 fixValue 5→7）で固有固定値加算が +2 される（Start phase）', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };
            const customConfig: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 7, diceStr: '1d10' },
            };
            const scoreDefault = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            const scoreCustom = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, customConfig);
            // Fix 10 + Dice 9 + Unique(default 5 + 8) = 32
            expect(scoreDefault).toBe(32);
            // 固有固定値 5 → 7 で +2
            expect(scoreCustom).toBe(34);
        });

        it('カスタム設定（超ギャンブル fixValue -10→-3）で固有固定値加算が +7 される（Mid phase）', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const midDice = { diceStr: '3d5', values: [2, 2, 2], sum: 6 };
            const uniqueDice = { diceStr: '1d35', values: [25], sum: 25 };
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'SuperGamble', phases: ['Mid1'] },
                history: {
                    'Start': { baseDice: startDice, computedScore: 0 },
                    'Mid1': { baseDice: midDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };
            const customConfig: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                SuperGamble: { fixValue: -3, diceStr: '1d35' },
            };
            const scoreDefault = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            const scoreCustom = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, customConfig);
            // Fix 10 + Start 9 + Mid1 6 + Unique(default -10 + 25) = 40
            expect(scoreDefault).toBe(40);
            // 固有固定値 -10 → -3 で +7
            expect(scoreCustom).toBe(47);
        });

        it('カスタム設定（ギャンブル型 fixValue 0→4）で固有固定値が score に加算される（全 5 タイプ一律加算経路）', () => {
            // 従来ハードコードでは Gamble は固定値加算分岐なし（= 0）。uniqueDiceConfig 参照化で
            // 全 5 タイプ一律 fixValue 加算となるため、Gamble の fixValue 変更も反映される。
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d20', values: [15], sum: 15 };
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Gamble', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };
            const customConfig: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Gamble: { fixValue: 4, diceStr: '1d20' },
            };
            const scoreDefault = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            const scoreCustom = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, customConfig);
            // Fix 10 + Dice 9 + Unique(default 0 + 15) = 34
            expect(scoreDefault).toBe(34);
            // 固有固定値 0 → 4 で +4
            expect(scoreCustom).toBe(38);
        });

        it('引数省略時は DEFAULT_UNIQUE_DICE_CONFIG フォールバック（明示指定と完全一致 = 既存挙動完全維持）', () => {
            const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
            const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: ['Start'] },
                history: {
                    'Start': { baseDice: startDice, uniqueDice: uniqueDice, computedScore: 0 }
                }
            };
            const scoreOmitted = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null);
            const scoreExplicit = Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG);
            expect(scoreOmitted).toBe(scoreExplicit);
        });
    });

    // CR-SA-17-E4 / 2026-06-08（Review Gate 修正）: 脚質基礎値（fixValue）は「序盤フェーズごと」に加算する。
    // ユーザー確認: 序盤が複数回ある場合、脚質固定値は回数分加算される（OFF / 序盤 1 回では従来どおり 1 回）。
    describe('CR-SA-17-E4: fixValue 序盤フェーズごと加算（可変序盤対応）', () => {
        it('OFF / 従来呼び出し（activePhaseIds 未指定）は Start で fixValue 加算 = 現行同一', () => {
            const uma: Umamusume = {
                ...mockUma,
                history: { 'Start': { baseDice: { diceStr: '3d5', values: [3, 3, 3], sum: 9 }, computedScore: 0 } },
            };
            // 先行 fix 10 + Start dice 9 = 19
            expect(Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null)).toBe(19);
        });

        it('可変序盤（Start1/Start2）: fixValue は序盤フェーズごとに加算（序盤 2 回 = fixValue ×2）', () => {
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: [] },
                history: {
                    'Start1': { baseDice: { diceStr: '3d5', values: [3, 3, 3], sum: 9 }, computedScore: 0 },
                    'Start2': { baseDice: { diceStr: '3d5', values: [2, 2, 2], sum: 6 }, computedScore: 0 },
                    'End': { baseDice: { diceStr: '1d7', values: [3], sum: 3 }, computedScore: 0 },
                },
            };
            const activePhaseIds = ['Start1', 'Start2', 'End'];
            // 先行 fix 10（Start1）+ Start1 9 + fix 10（Start2）+ Start2 6 + End 3 = 38
            expect(Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, activePhaseIds)).toBe(38);
        });

        it('可変序盤で各序盤の固有ダイスも phases 一致時に加算される', () => {
            const uma: Umamusume = {
                ...mockUma,
                uniqueSkill: { type: 'Stability', phases: ['Start1'] },
                history: {
                    'Start1': {
                        baseDice: { diceStr: '3d5', values: [3, 3, 3], sum: 9 },
                        uniqueDice: { diceStr: '1d10', values: [8], sum: 8 },
                        computedScore: 0,
                    },
                    'Start2': { baseDice: { diceStr: '3d5', values: [2, 2, 2], sum: 6 }, computedScore: 0 },
                },
            };
            const activePhaseIds = ['Start1', 'Start2'];
            // fix 10（Start1）+ Start1 9 + 固有(5+8) + fix 10（Start2）+ Start2 6 = 48
            expect(Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, activePhaseIds)).toBe(48);
        });

        it('可変終盤（End1/End2）: 終盤ダイスは各終盤で加算、終盤には fixValue を加算しない', () => {
            // 大逃げ fix 30（序盤のみ）/ 終盤ダイス -1d27（各終盤で減算累積、§7.4）
            const uma: Umamusume = {
                ...mockUma,
                strategy: '大逃げ',
                uniqueSkill: { type: 'Stability', phases: [] },
                history: {
                    'Start': { baseDice: { diceStr: '3d8', values: [1, 1, 1], sum: 3 }, computedScore: 0 },
                    'End1': { baseDice: { diceStr: '-1d27', values: [10], sum: -10, isNegative: true }, computedScore: 0 },
                    'End2': { baseDice: { diceStr: '-1d27', values: [5], sum: -5, isNegative: true }, computedScore: 0 },
                },
            };
            const activePhaseIds = ['Start', 'End1', 'End2'];
            // 大逃げ fix 30（Start で 1 回、終盤には加算なし）+ Start 3 + End1 -10 + End2 -5 = 18
            expect(Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, activePhaseIds)).toBe(18);
        });
    });

    // CR-SA-17-E4 / 2026-06-08: enablePhaseConfig ゲート付きヘルパー（OFF 透過の核心）。
    describe('CR-SA-17-E4: getActivePhaseIdsForConfig / getLastEndPhaseId ゲート', () => {
        const makeConfig = (
            enablePhaseConfig: boolean,
            startPhaseCount: number,
            midPhaseCount: number,
            endPhaseCount: number,
        ): Pick<RaceState['config'], 'midPhaseCount' | 'startPhaseCount' | 'endPhaseCount' | 'houseRules'> => ({
            midPhaseCount,
            startPhaseCount,
            endPhaseCount,
            houseRules: { enablePhaseConfig } as RaceState['config']['houseRules'],
        });

        it('OFF: 可変値（序盤2/終盤2）が残っていても固定列 [Start, Mid, End]', () => {
            expect(getActivePhaseIdsForConfig(makeConfig(false, 2, 1, 2))).toEqual(['Start', 'Mid', 'End']);
        });

        it('ON: 序盤2/中盤1/終盤2 → [Start1, Start2, Mid, End1, End2]', () => {
            expect(getActivePhaseIdsForConfig(makeConfig(true, 2, 1, 2))).toEqual(
                ['Start1', 'Start2', 'Mid', 'End1', 'End2'],
            );
        });

        it('getLastEndPhaseId: OFF（終盤2残存）→ End / ON 終盤2 → End2 / ON 終盤1 → End', () => {
            expect(getLastEndPhaseId(makeConfig(false, 2, 1, 2))).toBe('End');
            expect(getLastEndPhaseId(makeConfig(true, 1, 1, 2))).toBe('End2');
            expect(getLastEndPhaseId(makeConfig(true, 1, 1, 1))).toBe('End');
        });
    });
});
// CR-SA-20-E4 / 2026-06-11: 隊列〔バ群〕補正の 1 回加算（houserule-features.md §6.3 / §6.5）。
// (隊列出目, ペース出目, 脚質名) → 効果表の補正値をペース補正と同方式で total に上乗せする。
describe('CR-SA-20-E4: calculateTotalScore 隊列補正（formationRoll）', () => {
    const baseUma: Umamusume = {
        id: 'f1',
        entryIndex: 1,
        name: 'フォーメーションテスト',
        strategy: '大逃げ',
        uniqueSkill: { type: 'Gamble', phases: [] },
        gate: 1,
        score: 0,
        history: {
            // 大逃げ Start: fixValue 30 + dice 10 = 40
            'Start': { baseDice: { diceStr: '3d8', values: [4, 3, 3], sum: 10 }, computedScore: 0 },
        },
    };
    it('formationRoll 省略時は従来と完全同一（OFF 透過）', () => {
        // 大逃げ: 30 (fix) + 10 (dice) + 0 (pace 5 = ミドル ±0) = 40
        const score = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, 5);
        expect(score).toBe(40);
    });
    it('超縦長（出目 1）× ミドル以下（ペース 5）: 大逃げ +10', () => {
        const score = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, 5, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 1);
        expect(score).toBe(50); // 40 + 10
    });
    it('超縦長（出目 1）× ハイ以上（ペース 9）: 大逃げ ±0 だが追込は +10（ペース境界の切替）', () => {
        // 大逃げ: pace 9 = -7、formation(1, 9, 大逃げ) = 0 → 30 + 10 - 7 = 33
        const oonige = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, 9, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 1);
        expect(oonige).toBe(33);
        // 追込: fix 0 + dice 10、pace 9 = +10、formation(1, 9, 追込) = +10 → 30
        const oikomi = { ...baseUma, strategy: '追込' };
        const score = Calculator.calculateTotalScore(oikomi, DEFAULT_STRATEGIES, 9, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 1);
        expect(score).toBe(30); // 0 + 10 + 10 + 10
    });
    it('普通（出目 4-6）は全脚質 ±0（補正なし）', () => {
        const score = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, 5, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 5);
        expect(score).toBe(40);
    });
    it('超団子（出目 9）× ミドル以下: 大逃げ -10', () => {
        const score = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, 5, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 9);
        expect(score).toBe(30); // 40 - 10
    });
    it('カスタム脚質（効果表に列がない）は補正 0', () => {
        const customStrategies = [
            ...DEFAULT_STRATEGIES,
            {
                name: 'カスタムX',
                fixValue: 30,
                dice: { start: '3d8', mid: '3d5', end: '1d7' },
                paceModifiers: {},
            },
        ];
        const customUma = { ...baseUma, strategy: 'カスタムX' };
        // 30 (fix) + 10 (dice) + pace 5 補正なし + formation(1, 5, カスタムX) = 0 → 40
        const score = Calculator.calculateTotalScore(customUma, customStrategies, 5, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 1);
        expect(score).toBe(40);
    });
    it('ペース未確定（paceRoll = null）では隊列補正も加算しない（隊列はペースより後の安全側）', () => {
        // pace null → fix 30 + dice 10 = 40（pace 補正もなし）
        const score = Calculator.calculateTotalScore(baseUma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, 1);
        expect(score).toBe(40);
    });
});

// CR-SA-21+22-E3 / 2026-07-06: カスタム固有スキル + 固有スキルなし出走者のスコア加算
// SSoT: houserule-features.md §8.5 スコア計算（Custom = fixValue + uniqueDice.sum、None = 加算なし）
describe('CR-SA-21+22-E3: calculateTotalScore Custom / None 対応', () => {
    const customs: CustomUniqueSkill[] = [
        { id: 'cust-a', name: '先行特化', fixValue: -5, diceStr: '1d30' },
        { id: 'cust-b', name: '安定Ⅲ', fixValue: 3, diceStr: '2d6' },
    ];

    it('(CE-1) Custom + fixValue=-5 + uniqueDice.sum=22 + phases=[Mid] → fixValue + sum = 17 加算', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uniqueDice = { diceStr: '1d30', values: [22], sum: 22 };
        const uma: Umamusume = {
            id: 'c1', entryIndex: 1, name: 'Cust', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: ['Mid'], customUniqueSkillId: 'cust-a' },
            gate: 1, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, uniqueDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + Mid 9 + Custom(-5 + 22) = 45
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)
        ).toBe(45);
    });

    it('(CE-2) Custom + fixValue=3 + uniqueDice.sum=7 + phases=[End] → fixValue + sum = 10 加算', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const endDice = { diceStr: '1d7', values: [4], sum: 4 };
        const uniqueDice = { diceStr: '2d6', values: [3, 4], sum: 7 };
        const uma: Umamusume = {
            id: 'c2', entryIndex: 2, name: 'Cust2', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: ['End'], customUniqueSkillId: 'cust-b' },
            gate: 2, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'End': { baseDice: endDice, uniqueDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + End 4 + Custom(3 + 7) = 33
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)
        ).toBe(33);
    });

    it('(CE-3) Custom + phases=[] → 固有加算なし（フェーズ制限で unique スキップ）', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uniqueDice = { diceStr: '1d30', values: [22], sum: 22 };
        const uma: Umamusume = {
            id: 'c3', entryIndex: 3, name: 'Cust3', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: [], customUniqueSkillId: 'cust-a' },
            gate: 3, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, uniqueDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + Mid 9 = 28（Custom 分岐は phases 制限で不到達）
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)
        ).toBe(28);
    });

    it('(CE-4) Custom + 参照切れ（id 不在）→ 0 加算防御（防御的フォールバック）', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uniqueDice = { diceStr: '1d30', values: [22], sum: 22 };
        const uma: Umamusume = {
            id: 'c4', entryIndex: 4, name: 'Cust4', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: ['Mid'], customUniqueSkillId: 'cust-x' }, // 参照切れ
            gate: 4, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, uniqueDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + Mid 9 + Custom(0 + 0 = スキップ) = 28
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)
        ).toBe(28);
    });

    it('(CE-5) Custom + customUniqueSkills 未渡し（省略 = []）→ 0 加算防御', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uniqueDice = { diceStr: '1d30', values: [22], sum: 22 };
        const uma: Umamusume = {
            id: 'c5', entryIndex: 5, name: 'Cust5', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: ['Mid'], customUniqueSkillId: 'cust-a' },
            gate: 5, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, uniqueDice, computedScore: 0 },
            },
        };
        // customUniqueSkills 省略 = デフォルト [] → 参照切れ扱いで 0 加算
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null)
        ).toBe(28);
    });

    it('(CE-6) None + phases=[] → 固有加算完全にスキップ（uniqueDice 存在しないはずだが防御的にも 0）', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uma: Umamusume = {
            id: 'n1', entryIndex: 1, name: 'None1', strategy: '先行',
            uniqueSkill: { type: 'None', phases: [] },
            gate: 1, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + Mid 9 = 28（None は固有加算経路不到達）
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null)
        ).toBe(28);
    });

    it('(CE-7) None × 万一 uniqueDice が存在しても加算しない（防御的、phases 制限で不到達）', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const midDice = { diceStr: '2d8', values: [4, 5], sum: 9 };
        const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };
        const uma: Umamusume = {
            id: 'n2', entryIndex: 2, name: 'None2', strategy: '先行',
            uniqueSkill: { type: 'None', phases: [] }, // phases 空 = 加算経路不到達
            gate: 2, score: 0,
            history: {
                'Start': { baseDice: startDice, computedScore: 0 },
                'Mid': { baseDice: midDice, uniqueDice, computedScore: 0 },
            },
        };
        // phases に 'Mid' 含まれず = 固有加算経路不到達 → 28
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null)
        ).toBe(28);
    });

    it('(CE-8) 組み込み Stability は Custom/None 追加後も従来通り 5 + sum 加算（regression）', () => {
        const startDice = { diceStr: '3d5', values: [3, 3, 3], sum: 9 };
        const uniqueDice = { diceStr: '1d10', values: [8], sum: 8 };
        const uma: Umamusume = {
            id: 's1', entryIndex: 1, name: 'Stab', strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: 1, score: 0,
            history: {
                'Start': { baseDice: startDice, uniqueDice, computedScore: 0 },
            },
        };
        // 先行 fix 10 + Start 9 + Stability(5 + 8) = 32
        expect(
            Calculator.calculateTotalScore(uma, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)
        ).toBe(32);
    });

    it('(CE-9) 混在レース: Custom 選択者 (先行特化) + 組み込み (Stability) + None 選択者の 3 名', () => {
        // Custom fixValue=-5 + uniqueDice.sum=22 = 17 加算（phases=['Mid'] 一致）
        const p1: Umamusume = {
            id: 'p1', entryIndex: 1, name: 'A', strategy: '先行',
            uniqueSkill: { type: 'Custom', phases: ['Mid'], customUniqueSkillId: 'cust-a' },
            gate: 1, score: 0,
            history: {
                'Start': { baseDice: { diceStr: '3d5', values: [], sum: 9 }, computedScore: 0 },
                'Mid': { baseDice: { diceStr: '2d8', values: [], sum: 9 }, uniqueDice: { diceStr: '1d30', values: [], sum: 22 }, computedScore: 0 },
            },
        };
        // 10 + 9 + 9 + 17 = 45
        expect(Calculator.calculateTotalScore(p1, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)).toBe(45);

        // Stability fixValue=5 + uniqueDice.sum=8 = 13 加算
        const p2: Umamusume = {
            id: 'p2', entryIndex: 2, name: 'B', strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: 2, score: 0,
            history: {
                'Start': { baseDice: { diceStr: '3d5', values: [], sum: 9 }, uniqueDice: { diceStr: '1d10', values: [], sum: 8 }, computedScore: 0 },
            },
        };
        // 10 + 9 + 13 = 32
        expect(Calculator.calculateTotalScore(p2, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)).toBe(32);

        // None: 固有加算なし
        const p3: Umamusume = {
            id: 'p3', entryIndex: 3, name: 'C', strategy: '先行',
            uniqueSkill: { type: 'None', phases: [] },
            gate: 3, score: 0,
            history: {
                'Start': { baseDice: { diceStr: '3d5', values: [], sum: 9 }, computedScore: 0 },
            },
        };
        // 10 + 9 = 19
        expect(Calculator.calculateTotalScore(p3, DEFAULT_STRATEGIES, null, undefined, DEFAULT_UNIQUE_DICE_CONFIG, null, customs)).toBe(19);
    });
});
