import type { RaceState, UniqueSkillType, UniqueDiceConfig, UniqueDiceEntry } from '../../../types';
// CR-SA-15-E3 Round 2 / 2026-05-15: 固有タイプ選択肢ラベルを uniqueDiceConfig 連動の動的生成に切替
// （ユーザーフィードバック「実際に計算に使用される値が不明瞭になり混乱を招く」対応）。
// 引数省略時は DEFAULT_UNIQUE_DICE_CONFIG フォールバック = 既存ハードコードラベルと完全一致
// （E2 フォールバックパターン踏襲）。
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import { getNonPacePhaseSequence } from '../../../core/phaseSequence';

type HouseRules = RaceState['config']['houseRules'];

// Bundle-2 / D-1, D-14 / 2026-05-09: EntryForm の固有タイプ選択肢生成を純粋関数化。
// Bundle-3 / D-2 / 2026-05-09: `enableCompositeUnique` 連動で `Persistent` 動的追加対応。
// CR-SA-15-E3 Round 2 / 2026-05-15: `uniqueDiceConfig` 連動でラベル動的生成（短縮表記、規則は formatUniqueDiceLabel 参照）。
// 純粋関数化により単体テストを容易にする
// （houserule-features.md §2 [v] 拡張固有タイプ + [v] 複合固有スキル + §5 固有スキル設定 反映）。

export interface UniqueSkillTypeOption {
    type: UniqueSkillType;
    label: string;
}

/**
 * 固有タイプ選択肢ラベルの短縮表記を生成する純粋関数。
 *
 * 規則（投稿用ダイス出力の `getUniqueDiceFormula` とは別の短縮表記。`dice` プレフィックス /
 * `=` サフィックスなし、括弧内表記）:
 * - `fixValue === 0` → `${name} (${diceStr})`（例: ギャンブル `ギャンブル (1d20)`）
 * - `fixValue !== 0` → `${name} (${fixValue}+${diceStr})`（負値も `-10+1d35` 形式、例: 超ギャンブル `超ギャンブル (-10+1d35)`）
 *
 * DEFAULT_UNIQUE_DICE_CONFIG での全タイプ生成は既存ハードコードラベルと完全一致
 * （安定 `5+1d10` / ギャンブル `1d20` / 持続型 `1d10` / 超ギャンブル `-10+1d35` / 超安定 `8+1d3`）。
 */
export const formatUniqueDiceLabel = (name: string, entry: UniqueDiceEntry): string => {
    const { fixValue, diceStr } = entry;
    if (fixValue === 0) return `${name} (${diceStr})`;
    return `${name} (${fixValue}+${diceStr})`;
};

/**
 * 固有タイプの選択肢配列を返す。
 *
 * - 既定（両 OFF）: `Stability` / `Gamble` の 2 件
 * - `enableCompositeUnique === true`: `Stability` / `Gamble` の直後に `Persistent` を追加
 * - `enableExtendedUnique === true`: 末尾に `SuperGamble` / `SuperStability` / `GambleII` / `StabilityII` を追加
 *
 * 表示順: `Stability` → `Gamble` → `Persistent` → `SuperGamble` → `SuperStability` → `GambleII` → `StabilityII`
 * （両 ON 時 7 件、片方 OFF 時 3〜6 件、両 OFF 時 2 件）
 *
 * CR-SA-19 / 2026-06-06: 拡張固有タイプに ギャンブル型Ⅱ / 安定型Ⅱ を追加（enableExtendedUnique 共用）。
 *
 * CR-SA-15-E3 Round 2 / 2026-05-15: ラベルは `uniqueDiceConfig` 参照の動的生成。
 * 引数省略時は `DEFAULT_UNIQUE_DICE_CONFIG` フォールバックで既存ハードコードラベルと完全一致
 * （E2 フォールバックパターン踏襲、既存呼び出し側の挙動完全維持）。
 */
export const getUniqueSkillTypeOptions = (
    enableExtendedUnique: boolean,
    enableCompositeUnique: boolean,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG,
): UniqueSkillTypeOption[] => {
    const options: UniqueSkillTypeOption[] = [
        { type: 'Stability', label: formatUniqueDiceLabel('安定', uniqueDiceConfig.Stability) },
        { type: 'Gamble', label: formatUniqueDiceLabel('ギャンブル', uniqueDiceConfig.Gamble) },
    ];

    if (enableCompositeUnique) {
        options.push({ type: 'Persistent', label: formatUniqueDiceLabel('持続型', uniqueDiceConfig.Persistent) });
    }

    if (enableExtendedUnique) {
        options.push({ type: 'SuperGamble', label: formatUniqueDiceLabel('超ギャンブル', uniqueDiceConfig.SuperGamble) });
        options.push({ type: 'SuperStability', label: formatUniqueDiceLabel('超安定', uniqueDiceConfig.SuperStability) });
        // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ（短縮ラベルは既存パターン踏襲、modal-houserule.md §4 フル表示名と矛盾しない範囲）。
        options.push({ type: 'GambleII', label: formatUniqueDiceLabel('ギャンブルⅡ', uniqueDiceConfig.GambleII) });
        options.push({ type: 'StabilityII', label: formatUniqueDiceLabel('安定Ⅱ', uniqueDiceConfig.StabilityII) });
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
 * 特殊戦法発動位置プルダウン選択肢を返す。終盤（`End` / `End1`〜）は除外
 * （houserule-features.md §3 SSoT「Phase Restriction」、終盤が複数でも全終盤で発動禁止）。
 *
 * CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数に連動して一般化（houserule-features.md §7.7）。
 * 序盤 ≥2 では `序盤1`〜 が候補に並ぶ。`startPhaseCount` / `endPhaseCount` 省略時は 1
 *（= OFF 時の固定値）で従来挙動と完全一致:
 * - midPhaseCount === 0: [序盤]
 * - midPhaseCount === 1: [序盤, 中盤]
 * - midPhaseCount >= 2: [序盤, 中盤1, ..., 中盤N]
 *
 * 統一ヘルパー `getNonPacePhaseSequence` で非ペース列を生成し、終盤フェーズ（id が `End` で始まる）を
 * 除外することで「序盤ブロック + 中盤ブロック」のみを返す。
 */
export const getSpecialStrategyPhaseOptions = (
    midPhaseCount: number,
    startPhaseCount = 1,
    endPhaseCount = 1,
): PhaseOption[] =>
    getNonPacePhaseSequence(startPhaseCount, midPhaseCount, endPhaseCount)
        .filter(p => !p.id.startsWith('End'))
        .map(p => ({ id: p.id, label: p.label }));

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
