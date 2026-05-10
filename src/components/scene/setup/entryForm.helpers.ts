import type { RaceState, UniqueSkillType } from '../../../types';

type HouseRules = RaceState['config']['houseRules'];

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

// Bundle-8-T2 / CR-SA-4 / 2026-05-10: 2 行レイアウト判定 + HR 拡張入力 UI 生成 (scene1-setup.md §2)。
// 絆スキル ON または 特殊戦法 ON 時に 1 出走者 = 2 行構成に切替。両方 OFF なら従来 1 行構成。

/**
 * `enableBondSkill` または `enableSpecialStrategy` のいずれかが ON なら true。
 * scene1-setup.md §2 「2 行レイアウト切替トリガー」SSoT 準拠。
 */
export const shouldUseTwoRowLayout = (
    houseRules: Pick<HouseRules, 'enableBondSkill' | 'enableSpecialStrategy'>,
): boolean => {
    return houseRules.enableBondSkill || houseRules.enableSpecialStrategy;
};

export type SecondRowField = 'specialStrategyType' | 'specialStrategyPhase' | 'bondSkill';

/**
 * 2 行目に表示する HR 拡張入力 UI のフィールド配列を返す。
 * 並び順 = 特殊戦法（種別 → 発動位置）→ 絆スキル（scene1-setup.md §2 SSoT、Scene 2 出力順と整合）。
 * 両方 OFF の場合は空配列を返す（呼び出し側は shouldUseTwoRowLayout で事前判定する想定）。
 */
export const getSecondRowFields = (
    houseRules: Pick<HouseRules, 'enableBondSkill' | 'enableSpecialStrategy'>,
): SecondRowField[] => {
    const fields: SecondRowField[] = [];
    if (houseRules.enableSpecialStrategy) {
        fields.push('specialStrategyType', 'specialStrategyPhase');
    }
    if (houseRules.enableBondSkill) {
        fields.push('bondSkill');
    }
    return fields;
};

export interface PhaseOption {
    id: string;
    label: string;
}

/**
 * 特殊戦法発動位置プルダウン選択肢を返す。`'End'` は除外（houserule-features.md §3 SSoT、終盤発動禁止）。
 *
 * - midPhaseCount === 0: [Start]
 * - midPhaseCount === 1: [Start, Mid]
 * - midPhaseCount >= 2: [Start, Mid1, ..., MidN]
 */
export const getSpecialStrategyPhaseOptions = (midPhaseCount: number): PhaseOption[] => {
    const options: PhaseOption[] = [{ id: 'Start', label: '序盤' }];
    if (midPhaseCount === 1) {
        options.push({ id: 'Mid', label: '中盤' });
    } else if (midPhaseCount >= 2) {
        for (let i = 1; i <= midPhaseCount; i++) {
            options.push({ id: `Mid${i}`, label: `中盤${i}` });
        }
    }
    return options;
};

export interface BondSkillOption {
    type: 'BondGamble' | 'BondStable';
    label: string;
}

/**
 * 絆スキル種別プルダウン選択肢（houserule-features.md §2 [v] 絆スキル SSoT）。
 * 値域: `BondGamble` / `BondStable`。`---` = null（未獲得）は呼び出し側で `<option value="">---</option>` として表示する。
 */
export const getBondSkillTypeOptions = (): BondSkillOption[] => [
    { type: 'BondGamble', label: '絆ギャンブル' },
    { type: 'BondStable', label: '絆安定' },
];

export interface SpecialStrategyTypeOption {
    type: 'Makuri' | 'Tame';
    label: string;
}

/**
 * 特殊戦法種別プルダウン選択肢（houserule-features.md §3 SSoT）。
 * 値域: `Makuri` / `Tame`。`---` = null（未指定）は呼び出し側で `<option value="">---</option>` として表示する。
 */
export const getSpecialStrategyTypeOptions = (): SpecialStrategyTypeOption[] => [
    { type: 'Makuri', label: '捲り' },
    { type: 'Tame', label: '溜め' },
];
