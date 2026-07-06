import { describe, it, expect } from 'vitest';
import type { CustomUniqueSkill, UniqueDiceConfig } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    formatUniqueDiceLabel,
    getUniqueSkillTypeOptions,
    shouldUseTwoRowLayout,
    getSecondRowFields,
    getSpecialStrategyPhaseOptions,
    getBondSkillTypeOptions,
    getSpecialStrategyTypeOptions,
    encodeCustomUniqueValue,
    encodeUniqueSkillSelectValue,
    decodeUniqueSkillValue,
    CUSTOM_UNIQUE_VALUE_PREFIX,
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
        // CR-SA-19 / 2026-06-06: enableExtendedUnique ON で拡張 4 タイプ（超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ）
        it('returns 6 options including the 4 extended types when only enableExtendedUnique is true', () => {
            const options = getUniqueSkillTypeOptions(true, false);
            expect(options).toHaveLength(6);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII']);

            // ラベル形式を houserule-features.md §2 [v] 出力フォーマット記述と整合確認
            const sg = options.find(o => o.type === 'SuperGamble');
            const ss = options.find(o => o.type === 'SuperStability');
            expect(sg?.label).toBe('超ギャンブル (-10+1d35)');
            expect(ss?.label).toBe('超安定 (8+1d3)');
            // CR-SA-19: ギャンブル型Ⅱ（fixValue -20 → 負号込み）/ 安定型Ⅱ（fixValue 0 → ダイス式のみ）
            const g2 = options.find(o => o.type === 'GambleII');
            const s2 = options.find(o => o.type === 'StabilityII');
            expect(g2?.label).toBe('ギャンブルⅡ (-20+1d45)');
            expect(s2?.label).toBe('安定Ⅱ (7d2)');
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

        // Bundle-3 / D-2 必須テスト (ii): 両 ON 時 + 順序確認
        // CR-SA-19 / 2026-06-06: 拡張固有タイプ 2 種追加で 5 件 → 7 件
        it('returns 7 options in correct order when both flags are true', () => {
            const options = getUniqueSkillTypeOptions(true, true);
            expect(options).toHaveLength(7);
            expect(options.map(o => o.type)).toEqual([
                'Stability',
                'Gamble',
                'Persistent',
                'SuperGamble',
                'SuperStability',
                'GambleII',
                'StabilityII',
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

        // CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数連動の一般化（houserule-features.md §7.7）。
        it('序盤2 連動で [序盤1, 序盤2, 中盤...] を返す（startPhaseCount=2）', () => {
            expect(getSpecialStrategyPhaseOptions(1, 2, 1).map(o => o.id)).toEqual(['Start1', 'Start2', 'Mid']);
            expect(getSpecialStrategyPhaseOptions(2, 2, 1).map(o => o.id)).toEqual(['Start1', 'Start2', 'Mid1', 'Mid2']);
        });

        it('ラベルも序盤1〜/中盤1〜 で連動する', () => {
            expect(getSpecialStrategyPhaseOptions(2, 2, 1).map(o => o.label)).toEqual(['序盤1', '序盤2', '中盤1', '中盤2']);
        });

        it('終盤回数を増やしても終盤（End / End1〜）は一切含めない', () => {
            for (const endCount of [1, 2, 3, 4]) {
                const ids = getSpecialStrategyPhaseOptions(2, 2, endCount).map(o => o.id);
                expect(ids.some(id => id.startsWith('End'))).toBe(false);
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

// CR-SA-22 / CR-SA-21 / CR-SA-21+22-E2 / 2026-07-06:
// 「なし」+ カスタム連動 + select value エンコード規則の SSoT テスト
// （scene1-setup.md §2 L181-194 SSoT）。
describe('entryForm.helpers - CR-SA-21+22-E2 / 「なし」+ カスタム対応', () => {
    describe('getUniqueSkillTypeOptions - 「なし」+ カスタム連動', () => {
        it('enableNoUniqueSkill=false + カスタムなし → 既存挙動と完全同一（後方互換）', () => {
            const options = getUniqueSkillTypeOptions(false, false, DEFAULT_UNIQUE_DICE_CONFIG, false, []);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble']);
        });

        it('enableNoUniqueSkill=true → 「なし」が先頭（`---` 直後）に追加、ラベル固定 = `なし`', () => {
            const options = getUniqueSkillTypeOptions(false, false, DEFAULT_UNIQUE_DICE_CONFIG, true, []);
            expect(options).toHaveLength(3);
            expect(options[0]).toEqual({ type: 'None', value: 'None', label: 'なし' });
            expect(options.slice(1).map(o => o.type)).toEqual(['Stability', 'Gamble']);
        });

        it('カスタム 2 件登録あり → 末尾に登録順で追加、ラベルは fixValue 符号別で動的生成', () => {
            const customs: CustomUniqueSkill[] = [
                { id: 'id-a', name: '先行特化', fixValue: 0, diceStr: '1d25' },
                { id: 'id-b', name: '逃げ加速', fixValue: -5, diceStr: '1d30' },
            ];
            const options = getUniqueSkillTypeOptions(false, false, DEFAULT_UNIQUE_DICE_CONFIG, false, customs);
            expect(options).toHaveLength(4);
            expect(options[2]).toEqual({
                type: 'Custom',
                value: 'Custom:id-a',
                label: '先行特化 (1d25)',
                customUniqueSkillId: 'id-a',
            });
            expect(options[3]).toEqual({
                type: 'Custom',
                value: 'Custom:id-b',
                label: '逃げ加速 (-5+1d30)',
                customUniqueSkillId: 'id-b',
            });
        });

        it('全表示（Extended ON + Composite ON + NoUnique ON + カスタム 1 件）の並び順は SSoT L186 と一致', () => {
            const customs: CustomUniqueSkill[] = [
                { id: 'x', name: 'A', fixValue: 0, diceStr: '1d10' },
            ];
            const options = getUniqueSkillTypeOptions(true, true, DEFAULT_UNIQUE_DICE_CONFIG, true, customs);
            expect(options.map(o => o.type)).toEqual([
                'None',
                'Stability',
                'Gamble',
                'Persistent',
                'SuperGamble',
                'SuperStability',
                'GambleII',
                'StabilityII',
                'Custom',
            ]);
        });

        it('カスタムは HR 非依存 = 両 OFF でも末尾に表示される（§8.1 完全独立）', () => {
            const customs: CustomUniqueSkill[] = [
                { id: 'x', name: 'A', fixValue: 0, diceStr: '1d10' },
            ];
            const options = getUniqueSkillTypeOptions(false, false, DEFAULT_UNIQUE_DICE_CONFIG, false, customs);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble', 'Custom']);
        });
    });

    describe('encode/decode - select value エンコード規則（Custom:<id> / None / 組み込み）', () => {
        it('encodeCustomUniqueValue は `Custom:<id>` を生成する', () => {
            expect(encodeCustomUniqueValue('abc-123')).toBe('Custom:abc-123');
            expect(CUSTOM_UNIQUE_VALUE_PREFIX).toBe('Custom:');
        });

        it('decodeUniqueSkillValue: 空文字は未選択（type=""）', () => {
            expect(decodeUniqueSkillValue('')).toEqual({ type: '', customUniqueSkillId: undefined });
        });

        it('decodeUniqueSkillValue: "None" は type=None（id なし）', () => {
            expect(decodeUniqueSkillValue('None')).toEqual({ type: 'None', customUniqueSkillId: undefined });
        });

        it('decodeUniqueSkillValue: "Custom:<id>" は type=Custom + id 分離', () => {
            expect(decodeUniqueSkillValue('Custom:xyz')).toEqual({
                type: 'Custom',
                customUniqueSkillId: 'xyz',
            });
        });

        it('decodeUniqueSkillValue: 組み込み型はそのまま返す', () => {
            expect(decodeUniqueSkillValue('Stability')).toEqual({ type: 'Stability', customUniqueSkillId: undefined });
            expect(decodeUniqueSkillValue('SuperGamble')).toEqual({ type: 'SuperGamble', customUniqueSkillId: undefined });
        });

        it('encodeUniqueSkillSelectValue: 各 type から適切な value を生成する（decode の逆）', () => {
            expect(encodeUniqueSkillSelectValue({ type: '' })).toBe('');
            expect(encodeUniqueSkillSelectValue({ type: 'None' })).toBe('None');
            expect(encodeUniqueSkillSelectValue({ type: 'Stability' })).toBe('Stability');
            expect(encodeUniqueSkillSelectValue({ type: 'Custom', customUniqueSkillId: 'foo' })).toBe('Custom:foo');
        });

        it('encodeUniqueSkillSelectValue: type=Custom + id なし → 空文字（参照切れ相当 = 未選択扱い）', () => {
            expect(encodeUniqueSkillSelectValue({ type: 'Custom' })).toBe('');
        });

        it('encode → decode → encode の往復（Custom）で情報が保存される', () => {
            const original = { type: 'Custom' as const, customUniqueSkillId: 'my-id' };
            const encoded = encodeUniqueSkillSelectValue(original);
            const decoded = decodeUniqueSkillValue(encoded);
            expect(decoded.type).toBe('Custom');
            expect(decoded.customUniqueSkillId).toBe('my-id');
        });
    });
});
