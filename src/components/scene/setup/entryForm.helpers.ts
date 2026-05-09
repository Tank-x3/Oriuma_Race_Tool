import type { UniqueSkillType } from '../../../types';

// Bundle-2 / D-1, D-14 / 2026-05-09: EntryForm の固有タイプ選択肢生成を純粋関数化。
// Bundle-3 / D-2 / 2026-05-09: `enableCompositeUnique` 連動で `Persistent` 動的追加対応。
// 純粋関数化により単体テストを容易にする
// （houserule-features.md §2 [v] 拡張固有タイプ + [v] 複合固有スキル反映）。

export interface UniqueSkillTypeOption {
    type: UniqueSkillType;
    label: string;
}

/**
 * 固有タイプの選択肢配列を返す。
 *
 * - 既定（両 OFF）: `Stability` / `Gamble` の 2 件
 * - `enableCompositeUnique === true`: `Stability` / `Gamble` の直後に `Persistent` を追加
 * - `enableExtendedUnique === true`: 末尾に `SuperGamble` / `SuperStability` を追加
 *
 * 表示順: `Stability` → `Gamble` → `Persistent` → `SuperGamble` → `SuperStability`
 * （両 ON 時 5 件、片方 OFF 時 3〜4 件、両 OFF 時 2 件）
 */
export const getUniqueSkillTypeOptions = (
    enableExtendedUnique: boolean,
    enableCompositeUnique: boolean,
): UniqueSkillTypeOption[] => {
    const options: UniqueSkillTypeOption[] = [
        { type: 'Stability', label: '安定 (5+1d10)' },
        { type: 'Gamble', label: 'ギャンブル (1d20)' },
    ];

    if (enableCompositeUnique) {
        options.push({ type: 'Persistent', label: '持続型 (1d10)' });
    }

    if (enableExtendedUnique) {
        options.push({ type: 'SuperGamble', label: '超ギャンブル (-10+1d35)' });
        options.push({ type: 'SuperStability', label: '超安定 (8+1d3)' });
    }

    return options;
};
