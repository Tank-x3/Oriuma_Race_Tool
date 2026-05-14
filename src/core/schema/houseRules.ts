// Bundle-7 / P4-6 / 2026-05-10:
// houserule-features.md §4 zod 検証範囲表に基づく zod スキーマ集約。
// 永続化マイグレーション（useRaceStore persistMigrate）と
// 将来の JSON I/O（modal-houserule.md §3 設定プリセット管理）の双方で利用される。

import { z } from 'zod';
// CR-SA-15-E1 / 2026-05-14: 固有スキル設定のデフォルト値。
// houseRulesSchema.uniqueDiceConfig の .default() に渡し、フィールド欠落の旧データ
// （旧 persist データ / 旧 JSON プリセット）をデフォルト補完する後方互換の要とする。
// houseRules.ts → strategies.ts は strategies.ts が zod 非依存・types のみ参照のため循環しない。
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../strategies';

export const EFFECT_VALUE_MIN = 1;
export const EFFECT_VALUE_MAX = 999;

// modal-houserule.md §3 ⚠️ Import Validation 既定文言（変更不可）
export const VALIDATION_ERROR_MESSAGE =
    'ファイル形式が正しくありません。オリウマツール用の設定ファイルを選択してください';

// CR-SA-15-E1 / 2026-05-14: 固有スキル設定の zod スキーマ（houserule-features.md §5.2 / §4 zod 検証範囲表）。
// fixValue は整数（負の整数を許容、超ギャンブルの -10 等。小数は不可）。
// diceStr は XdY 形式（§5.2 正規表現 /^\d+d\d+$/ を SSoT として完全一致、脚質エディタ §1 と同形式）。
export const uniqueDiceEntrySchema = z.object({
    fixValue: z.number().int(),
    diceStr: z.string().regex(/^\d+d\d+$/),
});

// CR-SA-15-E1 / 2026-05-14: 固有スキル 5 タイプすべてのキーを明示した object スキーマ
// （houserule-features.md §4「固有スキル 5 タイプすべてのキーを持つ」= 5 キー必須）。
// z.record ではキー欠落を検出できないため、明示 object 方式を採用する。
export const uniqueDiceConfigSchema = z.object({
    Stability: uniqueDiceEntrySchema,
    Gamble: uniqueDiceEntrySchema,
    Persistent: uniqueDiceEntrySchema,
    SuperGamble: uniqueDiceEntrySchema,
    SuperStability: uniqueDiceEntrySchema,
});

// Bundle-7 / 2026-05-10: houserule-features.md §4 zod 検証範囲表
// effectValue 値域: Bundle-9 ENG27 で Engineer 裁量採用済の 1〜999 に整合。
// Bundle-8-T1 / CR-SA-4 / 2026-05-10: enableBondSkill 追加（houserule-features.md §4 zod 検証範囲表 +1 フィールド = 6 フィールド）
// CR-SA-15-E1 / 2026-05-14: uniqueDiceConfig 追加（houserule-features.md §4 zod 検証範囲表 +1 フィールド = 7 フィールド）。
export const houseRulesSchema = z.object({
    enableModifier: z.boolean(),
    enableSpecialStrategy: z.boolean(),
    enableCompositeUnique: z.boolean(),
    enableExtendedUnique: z.boolean(),
    enableBondSkill: z.boolean(),
    effectValue: z.number().int().min(EFFECT_VALUE_MIN).max(EFFECT_VALUE_MAX),
    // CR-SA-15-E1 / 2026-05-14: 固有スキル設定（houserule-features.md §5）。
    // .default() により、uniqueDiceConfig フィールド自体が欠落した旧データ
    // （旧 persist データ / 旧 JSON プリセット）が検証通過し、デフォルト値で補完される（後方互換）。
    // フィールドは存在するが 5 キー不揃いのデータは uniqueDiceConfigSchema が検証失敗させる
    // （「フィールド欠落の補完」と「不完全構造の許容」は別、§4「5 キー必須」と矛盾しない）。
    uniqueDiceConfig: uniqueDiceConfigSchema.default(DEFAULT_UNIQUE_DICE_CONFIG),
});

export type HouseRulesData = z.infer<typeof houseRulesSchema>;

// Bundle-7 / 2026-05-10: houserule-features.md §4 zod 検証範囲表 (カスタム脚質配列)
// strategies.ts の Strategy 型と整合。paceModifiers は JSON シリアライズ後 key が string 化されるため
// keyType は z.string() を採用 (key を Number にパースする変換は将来追加検討)。
export const customStrategySchema = z.object({
    name: z.string(),
    fixValue: z.number(),
    dice: z.object({
        start: z.string(),
        mid: z.string(),
        end: z.string(),
    }),
    paceModifiers: z.record(z.string(), z.number()),
});

export type CustomStrategyData = z.infer<typeof customStrategySchema>;

// Bundle-7 / 2026-05-10: modal-houserule.md §3 設定プリセット管理 + ⚠️ Import Validation
// JSON ファイル取り込み機能で利用予定（UI 接続は別 Bundle 候補、本 Bundle では関数 export のみ）。
export const houseRulesConfigSchema = z.object({
    houseRules: houseRulesSchema,
    strategies: z.array(customStrategySchema),
});

export type HouseRulesConfig = z.infer<typeof houseRulesConfigSchema>;

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

// Bundle-7 / 2026-05-10: ファイル取り込み用検証関数。
// modal-houserule.md §3 ⚠️ Import Validation 既定の文言を返す（zod 詳細エラーは内部で破棄）。
export function validateHouseRulesConfig(
    json: unknown
): ValidationResult<HouseRulesConfig> {
    const result = houseRulesConfigSchema.safeParse(json);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: VALIDATION_ERROR_MESSAGE };
}
