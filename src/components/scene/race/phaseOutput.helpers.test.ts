import { describe, it, expect } from 'vitest';
import {
    getUniqueDiceFormula,
    getExpectedUniqueDiceStr,
    getExpectedUniqueFixValue,
    getDiceFormulaBaseValue,
    isSecondaryStartPhase,
    getDiceFormulaPrefix,
} from './phaseOutput.helpers';
import type { Strategy, Umamusume, UniqueDiceConfig, CustomUniqueSkill } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';

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

const makeBaseDice = (diceStr: string, values: number[]) => ({
    diceStr,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

const strategiesFixture: Strategy[] = [
    {
        name: '先行',
        fixValue: 10,
        dice: { start: 'dice3d8', mid: 'dice2d8', end: 'dice1d7' },
        paceModifiers: {},
    },
    {
        name: '差し',
        fixValue: 0,
        dice: { start: 'dice3d8', mid: 'dice2d10', end: 'dice1d9' },
        paceModifiers: {},
    },
];

const houseRulesEnabled = { effectValue: 15, enableSpecialStrategy: true };
const houseRulesDisabled = { effectValue: 15, enableSpecialStrategy: false };

describe('phaseOutput.helpers - Bundle-2 / D-1, D-14 / 2026-05-09', () => {
    describe('getUniqueDiceFormula', () => {
        it('returns "5+dice1d10=" for Stability', () => {
            expect(getUniqueDiceFormula('Stability')).toBe('5+dice1d10=');
        });

        it('returns "dice1d20=" for Gamble', () => {
            expect(getUniqueDiceFormula('Gamble')).toBe('dice1d20=');
        });

        it('returns "dice1d10=" for Persistent', () => {
            expect(getUniqueDiceFormula('Persistent')).toBe('dice1d10=');
        });

        // Bundle-2 必須テスト (iii): 超ギャンブル選択者の固有ダイス行に -10+dice1d35= が含まれる
        it('returns "-10+dice1d35=" for SuperGamble (Bundle-2)', () => {
            expect(getUniqueDiceFormula('SuperGamble')).toBe('-10+dice1d35=');
        });

        // Bundle-2 必須テスト (iv): 超安定選択者の固有ダイス行に 8+dice1d3= が含まれる
        it('returns "8+dice1d3=" for SuperStability (Bundle-2)', () => {
            expect(getUniqueDiceFormula('SuperStability')).toBe('8+dice1d3=');
        });

        // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（fixValue -20 → 負号込み）の出力フォーマット
        it('returns "-20+dice1d45=" for GambleII (CR-SA-19)', () => {
            expect(getUniqueDiceFormula('GambleII')).toBe('-20+dice1d45=');
        });

        // CR-SA-19 / 2026-06-06: 安定型Ⅱ（fixValue 0 → ダイス式のみ、複数ダイス）の出力フォーマット
        // CR-SA-19-Followup / 2026-07-06: 安定型Ⅱ の diceStr を '2d7' → '7d2' に修正
        //（振れ幅 7〜14 / 期待値 10.5、houserule-features.md §5.2 / §5.4 SSoT）。
        it('returns "dice7d2=" for StabilityII (CR-SA-19-Followup, 複数ダイス)', () => {
            expect(getUniqueDiceFormula('StabilityII')).toBe('dice7d2=');
        });
    });

    // Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
    // ダイス式 [基礎値] 算出は specialStrategy 効果値反映前のスコアを使用する。
    // 結果取り込み済 phase で発動 specialStrategy が score に既に反映されている場合は差し引く。
    describe('getDiceFormulaBaseValue - Bundle-4-Followup-E1 / 2026-05-12', () => {
        it('(G1) Start phase → strategy.fixValue（specialStrategy 状態に関わらず）', () => {
            const p = makeParticipant({ strategy: '先行', score: 999 });
            expect(
                getDiceFormulaBaseValue(p, 'Start', houseRulesEnabled, strategiesFixture)
            ).toBe(10);
        });
        it('(G2) Mid + Makuri 結果取り込み済 + score 28 → 13（28 - 15、効果値反映前）', () => {
            // Bundle-4-Followup-E1 二重加算誤認リスク解消の核心シナリオ:
            // 序盤完了時 13 → 中盤フェーズで Makuri ON + 中盤取り込み済で score = 28
            // ダイス式 [基礎値] は効果値反映前 13 を返す（scene3-race.md §2 SSoT）
            const p = makeParticipant({
                strategy: '先行',
                score: 28,
                history: {
                    Mid: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        specialStrategy: 'Makuri',
                        computedScore: 28,
                    },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'Mid', houseRulesEnabled, strategiesFixture)
            ).toBe(13);
        });
        it('(G3) Mid + Makuri 結果取り込み前 + score 13 → 13（delta 0、score 不変）', () => {
            // 事前操作シナリオ: score には効果値が反映されていない → 差し引きなし
            const p = makeParticipant({
                strategy: '先行',
                score: 13,
                history: {
                    Mid: { specialStrategy: 'Makuri', computedScore: 0 },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'Mid', houseRulesEnabled, strategiesFixture)
            ).toBe(13);
        });
        it('(G4) End + 発動 Makuri 取り込み済 + history.End あり → score 不変（相殺 delta 0）', () => {
            // 中盤取り込み済 + 終盤到達済 = +15 即時 + (-15) 反動 = delta 0
            // 終盤フェーズのダイス式 [基礎値] は score そのまま
            const p = makeParticipant({
                strategy: '先行',
                score: 33,
                history: {
                    Mid: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        specialStrategy: 'Makuri',
                        computedScore: 28,
                    },
                    End: { baseDice: makeBaseDice('1d7', [5]), computedScore: 33 },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'End', houseRulesEnabled, strategiesFixture)
            ).toBe(33);
        });
        it('(G5) enableSpecialStrategy === false + 発動済 → score 不変（HR OFF で delta 強制 0）', () => {
            const p = makeParticipant({
                strategy: '先行',
                score: 28,
                history: {
                    Mid: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        specialStrategy: 'Makuri',
                        computedScore: 28,
                    },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'Mid', houseRulesDisabled, strategiesFixture)
            ).toBe(28);
        });
        it('(G6) End フェーズ + 中盤 Makuri 発動取り込み済 + End 取り込み前 + score 48 → 48（終盤反動先取り回避 regression）', () => {
            // ユーザー指摘 Round 1 解消: 中盤完了時 score = 48 で終盤フェーズ進入時、
            // 終盤ダイス式 [基礎値] は 48 のまま（反動 -15 を先取りして 33 にしない）。
            // 終盤反動はダイス取り込み実行で score へ反映する設計（SA21 案 A）。
            const p = makeParticipant({
                strategy: '先行',
                score: 48,
                history: {
                    Mid: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        specialStrategy: 'Makuri',
                        computedScore: 48,
                    },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'End', houseRulesEnabled, strategiesFixture)
            ).toBe(48);
        });
        it('(G7) End フェーズ + 中盤 Tame 発動取り込み済 + End 取り込み前 + score -2 → -2（同上、Tame 側）', () => {
            const p = makeParticipant({
                strategy: '差し',
                score: -2,
                history: {
                    Mid: {
                        baseDice: makeBaseDice('2d10', [5, 5]),
                        specialStrategy: 'Tame',
                        computedScore: -2,
                    },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'End', houseRulesEnabled, strategiesFixture)
            ).toBe(-2);
        });
        it('(G8) Mid2 + 別 phase（Mid1）Makuri 発動取り込み済 + Mid2 取り込み前 + score 48 → 48（別 phase 発動時は差し引きなし）', () => {
            // 中盤 1 で Makuri 発動済、中盤 2 フェーズ進入で中盤 2 のダイス式表示時、
            // [基礎値] は中盤 1 完了時の score をそのまま（中盤 1 発動効果値は中盤 1 phase で反映済）
            const p = makeParticipant({
                strategy: '先行',
                score: 48,
                history: {
                    Mid1: {
                        baseDice: makeBaseDice('2d8', [4, 5]),
                        specialStrategy: 'Makuri',
                        computedScore: 48,
                    },
                },
            });
            expect(
                getDiceFormulaBaseValue(p, 'Mid2', houseRulesEnabled, strategiesFixture)
            ).toBe(48);
        });
    });

    describe('getExpectedUniqueDiceStr', () => {
        it('returns "1d10" for Stability', () => {
            expect(getExpectedUniqueDiceStr('Stability')).toBe('1d10');
        });

        it('returns "1d20" for Gamble', () => {
            expect(getExpectedUniqueDiceStr('Gamble')).toBe('1d20');
        });

        it('returns "1d10" for Persistent', () => {
            expect(getExpectedUniqueDiceStr('Persistent')).toBe('1d10');
        });

        it('returns "1d35" for SuperGamble (Bundle-2)', () => {
            expect(getExpectedUniqueDiceStr('SuperGamble')).toBe('1d35');
        });

        it('returns "1d3" for SuperStability (Bundle-2)', () => {
            expect(getExpectedUniqueDiceStr('SuperStability')).toBe('1d3');
        });
    });
});

// CR-SA-15-E2 / 2026-05-15: 固有ダイス 3 関数の uniqueDiceConfig 参照化検証
// （houserule-features.md §5.3 投稿用ダイス出力フォーマット生成ルール / §5.4 既存ハードコード置換対象）。
describe('CR-SA-15-E2: 固有ダイス 3 関数の uniqueDiceConfig 参照化', () => {
    describe('getUniqueDiceFormula — §5.3 符号別生成ルール', () => {
        it('fixValue > 0: カスタム設定（安定型 7+1d11）→ "7+dice1d11="', () => {
            const config: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 7, diceStr: '1d11' },
            };
            expect(getUniqueDiceFormula('Stability', config)).toBe('7+dice1d11=');
        });

        it('fixValue < 0: カスタム設定（超ギャンブル -5+1d40）→ "-5+dice1d40="', () => {
            const config: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                SuperGamble: { fixValue: -5, diceStr: '1d40' },
            };
            expect(getUniqueDiceFormula('SuperGamble', config)).toBe('-5+dice1d40=');
        });

        it('fixValue === 0: カスタム設定（ギャンブル型 0+1d25）→ "dice1d25="', () => {
            const config: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Gamble: { fixValue: 0, diceStr: '1d25' },
            };
            expect(getUniqueDiceFormula('Gamble', config)).toBe('dice1d25=');
        });

        // 注: 引数省略時の DEFAULT_UNIQUE_DICE_CONFIG フォールバックは、本 describe 上部の
        // 既存 getUniqueDiceFormula テスト群（引数省略呼び出しが全件 Pass）が証跡となる。
    });

    describe('getExpectedUniqueDiceStr — uniqueDiceConfig 参照', () => {
        it('カスタム設定（安定型 diceStr 1d11）→ "1d11"', () => {
            const config: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 5, diceStr: '1d11' },
            };
            expect(getExpectedUniqueDiceStr('Stability', config)).toBe('1d11');
        });
        // 注: 引数省略時のフォールバックは既存 getExpectedUniqueDiceStr テスト群が証跡となる。
    });

    describe('getExpectedUniqueFixValue — uniqueDiceConfig 参照', () => {
        it('カスタム設定（安定型 fixValue 7）→ 7、引数省略時はデフォルト 5 フォールバック', () => {
            const config: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 7, diceStr: '1d10' },
            };
            expect(getExpectedUniqueFixValue('Stability', config)).toBe(7);
            // getExpectedUniqueFixValue は本ファイルに既存テストがないため引数省略時の挙動も併せて検証
            expect(getExpectedUniqueFixValue('Stability')).toBe(5);
        });
    });
});

// CR-SA-21+22-E3 / 2026-07-06: カスタム固有スキル + 固有スキルなし出走者対応
// （houserule-features.md §5.3 生成ルール共用 + §8.5 Scene 3 出力・計算 + §2 [v] 固有スキルなし）。
describe('CR-SA-21+22-E3: 固有ダイス 3 関数の Custom/None 対応', () => {
    const customs: CustomUniqueSkill[] = [
        { id: 'cust-a', name: '先行特化', fixValue: -5, diceStr: '1d30' },
        { id: 'cust-b', name: '安定Ⅲ', fixValue: 3, diceStr: '2d6' },
        { id: 'cust-c', name: 'ゼロ型', fixValue: 0, diceStr: '1d25' },
    ];

    describe('getUniqueDiceFormula — Custom / None', () => {
        it('Custom + fixValue > 0 → "3+dice2d6="（§5.3 生成ルール、組み込み共用）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-b', customs)).toBe('3+dice2d6=');
        });
        it('Custom + fixValue < 0 → "-5+dice1d30="（負号は数値に含む）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-a', customs)).toBe('-5+dice1d30=');
        });
        it('Custom + fixValue === 0 → "dice1d25="（fixValue 省略）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-c', customs)).toBe('dice1d25=');
        });
        it('Custom + 参照切れ（id 不在）→ 空文字（防御）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-x', customs)).toBe('');
        });
        it('Custom + customUniqueSkills 未渡し → 空文字（防御）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-a')).toBe('');
        });
        it('Custom + customUniqueSkillId 未指定 → 空文字（防御）', () => {
            expect(getUniqueDiceFormula('Custom', DEFAULT_UNIQUE_DICE_CONFIG, undefined, customs)).toBe('');
        });
        it('None → 空文字（固有ダイスセクションから自然除外）', () => {
            expect(getUniqueDiceFormula('None')).toBe('');
        });
        it('組み込み 7 タイプは Custom/None 追加で挙動不変（Stability → "5+dice1d10="）', () => {
            expect(getUniqueDiceFormula('Stability', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-a', customs)).toBe('5+dice1d10=');
        });
    });

    describe('getExpectedUniqueDiceStr — Custom / None', () => {
        it('Custom → カスタム定義の diceStr（"2d6"）', () => {
            expect(getExpectedUniqueDiceStr('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-b', customs)).toBe('2d6');
        });
        it('Custom + 参照切れ → 空文字', () => {
            expect(getExpectedUniqueDiceStr('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-x', customs)).toBe('');
        });
        it('None → 空文字', () => {
            expect(getExpectedUniqueDiceStr('None')).toBe('');
        });
    });

    describe('getExpectedUniqueFixValue — Custom / None', () => {
        it('Custom → カスタム定義の fixValue（-5）', () => {
            expect(getExpectedUniqueFixValue('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-a', customs)).toBe(-5);
        });
        it('Custom + fixValue === 0 → 0', () => {
            expect(getExpectedUniqueFixValue('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-c', customs)).toBe(0);
        });
        it('Custom + 参照切れ → 0（防御）', () => {
            expect(getExpectedUniqueFixValue('Custom', DEFAULT_UNIQUE_DICE_CONFIG, 'cust-x', customs)).toBe(0);
        });
        it('None → 0', () => {
            expect(getExpectedUniqueFixValue('None')).toBe(0);
        });
    });
});

// CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
// 序盤2回目以降の N+Z（中間値+脚質固定値）投稿用ダイス出力（scene3-race.md §2 値の構成ルール）。
describe('CR-SA-17-Followup ESC-1: 序盤2回目以降 N+Z 出力', () => {
    // fixValue: 先行=10, 差し=0（Z=0 ケース検証用）
    const strategiesForNZ: Strategy[] = [
        {
            name: '大逃げ',
            fixValue: 30,
            dice: { start: 'dice3d8', mid: 'dice2d8', end: '-dice1d27' },
            paceModifiers: {},
        },
        ...strategiesFixture,
    ];

    describe('isSecondaryStartPhase', () => {
        it('先頭序盤（Start / Start1）→ false', () => {
            expect(isSecondaryStartPhase('Start')).toBe(false);
            expect(isSecondaryStartPhase('Start1')).toBe(false);
        });
        it('序盤2回目以降（Start2〜Start4）→ true', () => {
            expect(isSecondaryStartPhase('Start2')).toBe(true);
            expect(isSecondaryStartPhase('Start3')).toBe(true);
            expect(isSecondaryStartPhase('Start4')).toBe(true);
        });
        it('非序盤フェーズ（Mid / Mid1 / End / Pace）→ false', () => {
            expect(isSecondaryStartPhase('Mid')).toBe(false);
            expect(isSecondaryStartPhase('Mid1')).toBe(false);
            expect(isSecondaryStartPhase('End')).toBe(false);
            expect(isSecondaryStartPhase('End2')).toBe(false);
            expect(isSecondaryStartPhase('Pace')).toBe(false);
        });
    });

    describe('getDiceFormulaPrefix', () => {
        it('序盤2回目以降（Start2、大逃げ）→ "N+Z"（中間値 84 + 脚質固定値 30、数値2つ）', () => {
            const p = makeParticipant({ strategy: '大逃げ', score: 84 });
            expect(
                getDiceFormulaPrefix(p, 'Start2', houseRulesEnabled, strategiesForNZ)
            ).toBe('84+30');
        });
        it('序盤2回目以降 + Z=0（Start2、差し fixValue 0）→ "N+0"（2プレフィックス維持）', () => {
            const p = makeParticipant({ strategy: '差し', score: 84 });
            expect(
                getDiceFormulaPrefix(p, 'Start2', houseRulesEnabled, strategiesForNZ)
            ).toBe('84+0');
        });
        it('先頭序盤（Start、大逃げ）→ Z 単独 "30"（従来どおり、N を付けない）', () => {
            const p = makeParticipant({ strategy: '大逃げ', score: 84 });
            expect(
                getDiceFormulaPrefix(p, 'Start', houseRulesEnabled, strategiesForNZ)
            ).toBe('30');
        });
        it('先頭序盤（Start1、先行）→ Z 単独 "10"（従来どおり）', () => {
            const p = makeParticipant({ strategy: '先行', score: 50 });
            expect(
                getDiceFormulaPrefix(p, 'Start1', houseRulesEnabled, strategiesForNZ)
            ).toBe('10');
        });
        it('中盤（Mid）→ 累積スコア1個 "52"（従来どおり、getDiceFormulaBaseValue 委譲）', () => {
            const p = makeParticipant({ strategy: '先行', score: 52 });
            expect(
                getDiceFormulaPrefix(p, 'Mid', houseRulesDisabled, strategiesForNZ)
            ).toBe('52');
        });
        it('終盤（End）→ 累積スコア1個 "112"（従来どおり）', () => {
            const p = makeParticipant({ strategy: '大逃げ', score: 112 });
            expect(
                getDiceFormulaPrefix(p, 'End', houseRulesDisabled, strategiesForNZ)
            ).toBe('112');
        });
    });
});
