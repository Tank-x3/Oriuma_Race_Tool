import { describe, it, expect } from 'vitest';
import { getUniqueSkillTypeOptions } from './entryForm.helpers';

describe('entryForm.helpers - Bundle-2 / D-1, D-14 / 2026-05-09', () => {
    describe('getUniqueSkillTypeOptions', () => {
        // Bundle-2 必須テスト (v): enableExtendedUnique: false 時、SuperGamble / SuperStability が出現しない
        it('returns only base 2 options when enableExtendedUnique is false', () => {
            const options = getUniqueSkillTypeOptions(false);
            expect(options).toHaveLength(2);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble']);
            expect(options.find(o => o.type === 'SuperGamble')).toBeUndefined();
            expect(options.find(o => o.type === 'SuperStability')).toBeUndefined();
        });

        // Bundle-2 必須テスト (vi): enableExtendedUnique: true 時、SuperGamble / SuperStability が出現する
        it('returns 4 options including SuperGamble and SuperStability when enableExtendedUnique is true', () => {
            const options = getUniqueSkillTypeOptions(true);
            expect(options).toHaveLength(4);
            expect(options.map(o => o.type)).toEqual(['Stability', 'Gamble', 'SuperGamble', 'SuperStability']);

            // ラベル形式を houserule-features.md §2 [v] 出力フォーマット記述と整合確認
            const sg = options.find(o => o.type === 'SuperGamble');
            const ss = options.find(o => o.type === 'SuperStability');
            expect(sg?.label).toBe('超ギャンブル (-10+1d35)');
            expect(ss?.label).toBe('超安定 (8+1d3)');
        });

        it('keeps base options ordering stable regardless of flag', () => {
            // 既存挙動の regression guard: 'Stability' が常に先頭、'Gamble' が次
            const off = getUniqueSkillTypeOptions(false);
            const on = getUniqueSkillTypeOptions(true);
            expect(off[0].type).toBe('Stability');
            expect(off[1].type).toBe('Gamble');
            expect(on[0].type).toBe('Stability');
            expect(on[1].type).toBe('Gamble');
        });

        it('does NOT include Persistent (Bundle-3 scope)', () => {
            // Bundle-2 スコープ: 'Persistent' は本関数では扱わない（複合固有スキルは Bundle-3 で別管理）
            const off = getUniqueSkillTypeOptions(false);
            const on = getUniqueSkillTypeOptions(true);
            expect(off.find(o => o.type === 'Persistent')).toBeUndefined();
            expect(on.find(o => o.type === 'Persistent')).toBeUndefined();
        });
    });
});
