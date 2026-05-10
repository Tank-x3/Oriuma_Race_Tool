// Bundle-7 / P4-6 / 2026-05-10:
// houserule-features.md §4 zod 検証範囲表に基づく zod スキーマ集約。
// 永続化マイグレーション（useRaceStore persistMigrate）と
// 将来の JSON I/O（modal-houserule.md §3 設定プリセット管理）の双方で利用される。

import { z } from 'zod';

export const EFFECT_VALUE_MIN = 1;
export const EFFECT_VALUE_MAX = 999;

// modal-houserule.md §3 ⚠️ Import Validation 既定文言（変更不可）
export const VALIDATION_ERROR_MESSAGE =
    'ファイル形式が正しくありません。オリウマツール用の設定ファイルを選択してください';

// Bundle-7 / 2026-05-10: houserule-features.md §4 zod 検証範囲表 (5 フィールド)
// effectValue 値域: Bundle-9 ENG27 で Engineer 裁量採用済の 1〜999 に整合。
export const houseRulesSchema = z.object({
    enableModifier: z.boolean(),
    enableSpecialStrategy: z.boolean(),
    enableCompositeUnique: z.boolean(),
    enableExtendedUnique: z.boolean(),
    effectValue: z.number().int().min(EFFECT_VALUE_MIN).max(EFFECT_VALUE_MAX),
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
