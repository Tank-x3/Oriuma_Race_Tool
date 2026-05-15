import { describe, it, expect } from 'vitest';
import type { UniqueDiceConfig } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    formatUniqueDiceLabel,
    getUniqueSkillTypeOptions,
    shouldUseTwoRowLayout,
    getSecondRowFields,
    getSpecialStrategyPhaseOptions,
    getBondSkillTypeOptions,
    getSpecialStrategyTypeOptions,
} from './entryForm.helpers';

describe('entryForm.helpers - Bundle-2 / D-1, D-14 / 2026-05-09', () => {
    describe('getUniqueSkillTypeOptions (Bundle-3 / D-2 で 2 引数化)', () => {
        // Bundle-2 必須テスト (v) 改: 両 OFF 時、SuperGamble / SuperStability / Persistent が出現しない
        it('returns only base 2 options when both flags are false', () => {
            const options = getUniqueSkillTypeOptions(false, false);
            expect(options).toHaveLength(2);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble']);
            expect(options.find(o => o.type === 'SuperGamble')).toBeUndefined();
            expect(options.find(o => o.type === 'SuperStability')).toBeUndefined();
            expect(options.find(o => o.type === 'Persistent')).toBeUndefined();
        });

        // Bundle-2 必須テスト (vi) 改: enableExtendedUnique のみ true 時、4 件（Persistent 不在）
        it('returns 4 options including SuperGamble and SuperStability when only enableExtendedUnique is true', () => {
            const options = getUniqueSkillTypeOptions(true, false);
            expect(options).toHaveLength(4);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble', 'SuperGamble', 'SuperStability']);

            // ラベル形式を houserule-features.md §2 [v] 出力フォーマット記述と整合確認
            const sg = options.find(o => o.type === 'SuperGamble');
            const ss = options.find(o => o.type === 'SuperStability');
            expect(sg?.label).toBe('超ギャンブル (-10+1d35)');
            expect(ss?.label).toBe('超安定 (8+1d3)');
            expect(options.find(o => o.type === 'Persistent')).toBeUndefined();
        });

        it('keeps base options ordering stable regardless of flags', () => {
            // 既存挙動の regression guard: 'Stability' が常に先頭、'Gamble' が次
            const offOff = getUniqueSkillTypeOptions(false, false);
            const onOff = getUniqueSkillTypeOptions(true, false);
            const offOn = getUniqueSkillTypeOptions(false, true);
            const onOn = getUniqueSkillTypeOptions(true, true);
            for (const opts of [offOff, onOff, offOn, onOn]) {
                expect(opts[0].type).toBe('Stability');
                expect(opts[1].type).toBe('Gamble');
            }
        });

        // Bundle-3 / D-2 / 2026-05-09 regression guard:
        // enableCompositeUnique: false 時は Persistent 不在
        it('does NOT include Persistent when enableCompositeUnique is false', () => {
            const offOff = getUniqueSkillTypeOptions(false, false);
            const onOff = getUniqueSkillTypeOptions(true, false);
            expect(offOff.find(o => o.type === 'Persistent')).toBeUndefined();
            expect(onOff.find(o => o.type === 'Persistent')).toBeUndefined();
        });

        // Bundle-3 / D-2 必須テスト (i): enableCompositeUnique のみ true 時、Persistent が出現
        it('includes Persistent when only enableCompositeUnique is true', () => {
            const options = getUniqueSkillTypeOptions(false, true);
            expect(options).toHaveLength(3);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble', 'Persistent']);
            const persistent = options.find(o => o.type === 'Persistent');
            expect(persistent?.label).toBe('持続型 (1d10)');
        });

        // Bundle-3 / D-2 必須テスト (ii): 両 ON 時、5 件 + 順序確認
        it('returns 5 options in correct order when both flags are true', () => {
            const options = getUniqueSkillTypeOptions(true, true);
            expect(options).toHaveLength(5);
            expect(options.map(o => o.type)).toEqual([
                'Stability',
                'Gamble',
                'Persistent',
                'SuperGamble',
                'SuperStability',
            ]);
        });

        // Bundle-3 / D-2 推奨テスト (iv): enableCompositeUnique のみ true、enableExtendedUnique false 時 3 件
        it('returns 3 options with Persistent at index 2 when only enableCompositeUnique is true', () => {
            const options = getUniqueSkillTypeOptions(false, true);
            expect(options[2].type).toBe('Persistent');
            expect(options[2].label).toBe('持続型 (1d10)');
        });

        // CR-SA-15-E3 Round 2 / 2026-05-15 ユーザーフィードバック対応:
        // formatUniqueDiceLabel 符号別ルール + getUniqueSkillTypeOptions の uniqueDiceConfig 連動。
        // 引数省略時は DEFAULT_UNIQUE_DICE_CONFIG フォールバック = 既存ハードコードラベルと完全一致
        // （上記既存テストが無改修で全件 Pass する機械的証跡 = 既存挙動完全維持）。
        it('CR-SA-15-E3 Round 2: formatUniqueDiceLabel 符号別 + カスタム uniqueDiceConfig でラベルが連動変化する', () => {
            // formatUniqueDiceLabel: fixValue > 0 / < 0 / === 0 の 3 分岐（短縮表記、houserule-features.md §5.3 派生形式）
            expect(formatUniqueDiceLabel('安定', { fixValue: 5, diceStr: '1d10' })).toBe('安定 (5+1d10)');
            expect(formatUniqueDiceLabel('超ギャンブル', { fixValue: -10, diceStr: '1d35' })).toBe(
                '超ギャンブル (-10+1d35)',
            );
            expect(formatUniqueDiceLabel('ギャンブル', { fixValue: 0, diceStr: '1d20' })).toBe(
                'ギャンブル (1d20)',
            );

            // カスタム uniqueDiceConfig（安定型 5→7 / 1d10→1d11、ギャンブル型 0→4）で
            // getUniqueSkillTypeOptions のラベルが連動する。
            const customConfig: UniqueDiceConfig = {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 7, diceStr: '1d11' },
                Gamble: { fixValue: 4, diceStr: '1d20' },
            };
            const options = getUniqueSkillTypeOptions(false, false, customConfig);
            expect(options.find((o) => o.type === 'Stability')?.label).toBe('安定 (7+1d11)');
            expect(options.find((o) => o.type === 'Gamble')?.label).toBe('ギャンブル (4+1d20)');
        });
    });
});

// Bundle-8-T2 / CR-SA-4 / 2026-05-10: 2 行レイアウト判定 + HR 拡張入力 UI 生成
// scene1-setup.md §2「HR 連動レイアウト『2 行 = 1 出走者』構成」SSoT
describe('entryForm.helpers - Bundle-8-T2 / 2 行レイアウト判定', () => {
    describe('shouldUseTwoRowLayout', () => {
        it('両方 OFF なら false（従来 1 行レイアウト）', () => {
            expect(shouldUseTwoRowLayout({ enableBondSkill: false, enableSpecialStrategy: false })).toBe(false);
        });

        it('絆スキル ON のみで true', () => {
            expect(shouldUseTwoRowLayout({ enableBondSkill: true, enableSpecialStrategy: false })).toBe(true);
        });

        it('特殊戦法 ON のみで true', () => {
            expect(shouldUseTwoRowLayout({ enableBondSkill: false, enableSpecialStrategy: true })).toBe(true);
        });

        it('両方 ON で true', () => {
            expect(shouldUseTwoRowLayout({ enableBondSkill: true, enableSpecialStrategy: true })).toBe(true);
        });
    });

    describe('getSecondRowFields', () => {
        it('両方 OFF で空配列', () => {
            expect(getSecondRowFields({ enableBondSkill: false, enableSpecialStrategy: false })).toEqual([]);
        });

        it('絆スキル ON のみで [bondSkill]', () => {
            expect(getSecondRowFields({ enableBondSkill: true, enableSpecialStrategy: false })).toEqual([
                'bondSkill',
            ]);
        });

        it('特殊戦法 ON のみで [specialStrategyType, specialStrategyPhase]', () => {
            expect(getSecondRowFields({ enableBondSkill: false, enableSpecialStrategy: true })).toEqual([
                'specialStrategyType',
                'specialStrategyPhase',
            ]);
        });

        it('両方 ON で [specialStrategyType, specialStrategyPhase, bondSkill]（並び順固定 = Scene 2 出力順整合）', () => {
            expect(getSecondRowFields({ enableBondSkill: true, enableSpecialStrategy: true })).toEqual([
                'specialStrategyType',
                'specialStrategyPhase',
                'bondSkill',
            ]);
        });
    });

    describe('getSpecialStrategyPhaseOptions', () => {
        it('midPhaseCount = 0 で [Start] のみ', () => {
            expect(getSpecialStrategyPhaseOptions(0).map(o => o.id)).toEqual(['Start']);
        });

        it('midPhaseCount = 1 で [Start, Mid]', () => {
            expect(getSpecialStrategyPhaseOptions(1).map(o => o.id)).toEqual(['Start', 'Mid']);
        });

        it('midPhaseCount = 2 で [Start, Mid1, Mid2]', () => {
            expect(getSpecialStrategyPhaseOptions(2).map(o => o.id)).toEqual(['Start', 'Mid1', 'Mid2']);
        });

        it('midPhaseCount = 4 で [Start, Mid1, Mid2, Mid3, Mid4]（仕様上限）', () => {
            expect(getSpecialStrategyPhaseOptions(4).map(o => o.id)).toEqual([
                'Start',
                'Mid1',
                'Mid2',
                'Mid3',
                'Mid4',
            ]);
        });

        it('"End" を一切含めない（houserule-features.md §3 終盤発動禁止）', () => {
            for (const count of [0, 1, 2, 3, 4]) {
                const ids = getSpecialStrategyPhaseOptions(count).map(o => o.id);
                expect(ids).not.toContain('End');
            }
        });
    });

    describe('getBondSkillTypeOptions', () => {
        it('絆ギャンブル / 絆安定 の 2 件を返す（houserule-features.md §2 [v] 絆スキル SSoT）', () => {
            const options = getBondSkillTypeOptions();
            expect(options.map(o => o.type)).toEqual(['BondGamble', 'BondStable']);
            expect(options.map(o => o.label)).toEqual(['絆ギャンブル', '絆安定']);
        });
    });

    describe('getSpecialStrategyTypeOptions', () => {
        it('捲り / 溜め の 2 件を返す（houserule-features.md §3 SSoT）', () => {
            const options = getSpecialStrategyTypeOptions();
            expect(options.map(o => o.type)).toEqual(['Makuri', 'Tame']);
            expect(options.map(o => o.label)).toEqual(['捲り', '溜め']);
        });
    });
});
