import { describe, it, expect } from 'vitest';
import { getUniqueSkillTypeOptions } from './entryForm.helpers';

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
    });
});
