// CR-SA-16-E2 / 2026-05-15: 適用中プリセット名表示の派生状態判定
// scene1-setup.md §0-2「適用中プリセット名表示 — 状態 4 種」+ §0-3「状態判定ロジックの所在」SSoT
//
// useRaceStore の appliedPresetName / isPresetDirty / config.houseRules / strategies を入力に、
// 4 状態（基本ルール / 未保存のカスタム設定 / 読込済（変更なし）/ 読込済（変更あり））を判定する。
// HouseRulesForm.tsx のヘッダー右側表示で利用される。
//
// 純粋関数として配置（uniqueSkillEditor.helpers.ts / strategyEditor.helpers.ts と同方針）。
// 単体テストは appliedPresetStatus.helpers.test.ts に集約。
import type { Strategy } from '../../../types';
import type { HouseRulesData } from '../../../core/schema/houseRules';
import { DEFAULT_HOUSE_RULES } from '../../../store/useRaceStore';
import { DEFAULT_STRATEGIES } from '../../../core/strategies';

// CR-SA-16-E2 / 2026-05-15: 4 状態の識別子（scene1-setup.md §0-2 SSoT）。
export type AppliedPresetStatusKind =
    | 'default'        // ① 基本ルール（appliedPresetName=null + デフォルト完全一致）
    | 'custom'         // ② 未保存のカスタム設定（appliedPresetName=null + デフォルト相違）
    | 'preset-clean'   // ③ 読込済（変更なし、appliedPresetName!=null + isPresetDirty=false）
    | 'preset-dirty';  // ④ 読込済（変更あり、appliedPresetName!=null + isPresetDirty=true）

export interface AppliedPresetStatus {
    kind: AppliedPresetStatusKind;
    // 表示文言（HouseRulesForm.tsx ヘッダー右側にそのまま埋め込む）。
    // SSoT: scene1-setup.md §0-2 表示文言列。
    label: string;
}

// CR-SA-16-E2 / 2026-05-15: JSON.stringify ベースの構造比較。
// DEFAULT_HOUSE_RULES（uniqueDiceConfig 含む 7 フィールド）と DEFAULT_STRATEGIES（5 脚質）の
// 全フィールドが JSON 化可能であることは CR-SA-15-E1 で確立済。
// useRaceStore のキー順序は初期 state 定義時の挿入順で安定しており、updateHouseRules /
// addStrategy 等の action もスプレッド構文で順序を維持するため、構造比較は安定する。
function deepEqualByJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 適用中プリセット表示の派生状態を判定する（scene1-setup.md §0-2 判定条件表 SSoT）。
 *
 * - appliedPresetName !== null のときは isPresetDirty フラグのみで ③ / ④ を分岐
 *   （deep equality 不要、§0-3「比較タイミング」明示）。
 * - appliedPresetName === null のときは houseRules + strategies の deep equality で ① / ② を分岐
 *   （DEFAULT_HOUSE_RULES + DEFAULT_STRATEGIES 完全一致なら ①、相違なら ②）。
 *
 * 表示文言は §0-2 表示文言列 SSoT に従う:
 *   ① 適用中: 基本ルール
 *   ② 適用中: 未保存のカスタム設定
 *   ③ 適用中: <appliedPresetName>
 *   ④ 適用中: <appliedPresetName>（変更あり、全角括弧）
 */
export function getAppliedPresetStatus(
    houseRules: HouseRulesData,
    strategies: Strategy[],
    appliedPresetName: string | null,
    isPresetDirty: boolean,
): AppliedPresetStatus {
    if (appliedPresetName !== null) {
        if (isPresetDirty) {
            return {
                kind: 'preset-dirty',
                // 全角括弧（U+FF08 / U+FF09）= scene1-setup.md §0-2 表示文言 SSoT。
                label: `適用中: ${appliedPresetName}（変更あり）`,
            };
        }
        return {
            kind: 'preset-clean',
            label: `適用中: ${appliedPresetName}`,
        };
    }
    // appliedPresetName === null のときのみ deep equality で判定（§0-3 比較タイミング）。
    const isHouseRulesDefault = deepEqualByJson(houseRules, DEFAULT_HOUSE_RULES);
    const isStrategiesDefault = deepEqualByJson(strategies, DEFAULT_STRATEGIES);
    if (isHouseRulesDefault && isStrategiesDefault) {
        return { kind: 'default', label: '適用中: 基本ルール' };
    }
    return { kind: 'custom', label: '適用中: 未保存のカスタム設定' };
}
