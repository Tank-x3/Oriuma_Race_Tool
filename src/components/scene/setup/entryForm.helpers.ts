import type { UniqueSkillType } from '../../../types';

// Bundle-2 / D-1, D-14 / 2026-05-09: EntryForm の固有タイプ選択肢生成を純粋関数化。
// 純粋関数化により単体テストを容易にする（houserule-features.md §2 [v] 拡張固有タイプ反映）。

export interface UniqueSkillTypeOption {
    type: UniqueSkillType;
    label: string;
}

/**
 * 固有タイプの選択肢配列を返す。
 * `enableExtendedUnique` が true のときのみ「超ギャンブル」「超安定」を追加する。
 *
 * 注: 'Persistent' は Bundle-3（複合固有スキル `enableCompositeUnique` 連動）で扱うため、
 * 本関数では含めない（Bundle-2 / D-1, D-14 スコープ外）。
 */
export const getUniqueSkillTypeOptions = (enableExtendedUnique: boolean): UniqueSkillTypeOption[] => {
    const base: UniqueSkillTypeOption[] = [
        { type: 'Stability', label: '安定 (5+1d10)' },
        { type: 'Gamble', label: 'ギャンブル (1d20)' },
    ];

    if (enableExtendedUnique) {
        base.push({ type: 'SuperGamble', label: '超ギャンブル (-10+1d35)' });
        base.push({ type: 'SuperStability', label: '超安定 (8+1d3)' });
    }

    return base;
};
