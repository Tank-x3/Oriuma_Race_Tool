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

// CR-SA-15-E1 / 2026-05-14: 固有スキルの全タイプのキーを明示した object スキーマ
// （houserule-features.md §4「固有スキル全タイプのキーを持つ」= 全キー必須）。
// z.record ではキー欠落を検出できないため、明示 object 方式を採用する。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（GambleII）/ 安定型Ⅱ（StabilityII）を追加（5 → 7 キー）。
// 新 2 キーのみ uniqueDiceEntrySchema.default(...) を付与し、旧 5 キー（CR-SA-15/16 期）のみの
// 保存データ・JSON プリセットを「不足 2 キーをデフォルト補完して受理」する後方互換とする
// （houserule-features.md §5.4 SSoT。CR-SA-15-E4「欠落キーのデフォルト補完」方針を 7 キーに拡張）。
// 旧 5 キーのうちいずれかが欠落した不揃いデータ（例: Stability 欠落の 4 キー）は、旧 5 キーが
// 必須のままのため従来どおり検証失敗で拒否される（CR-SA-15-E4 の「不完全構造の拒否」方針を維持）。
export const uniqueDiceConfigSchema = z.object({
    Stability: uniqueDiceEntrySchema,
    Gamble: uniqueDiceEntrySchema,
    Persistent: uniqueDiceEntrySchema,
    SuperGamble: uniqueDiceEntrySchema,
    SuperStability: uniqueDiceEntrySchema,
    GambleII: uniqueDiceEntrySchema.default(DEFAULT_UNIQUE_DICE_CONFIG.GambleII),
    StabilityII: uniqueDiceEntrySchema.default(DEFAULT_UNIQUE_DICE_CONFIG.StabilityII),
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
    // CR-SA-17-E1 / 2026-06-06: フェーズ構成変更ハウスルールの ON/OFF（houserule-features.md §7 / §4 zod 検証範囲表）。
    // .default(false) により、enablePhaseConfig フィールドが欠落した旧データ
    // （旧 persist データ / 旧 JSON プリセット）が検証通過し、false で補完される（後方互換）。
    // 序盤・終盤回数 / ペース位置（config 直下のレース個別設定）は §7.8 によりプリセット非対象のため本スキーマに含めない。
    enablePhaseConfig: z.boolean().default(false),
    // CR-SA-20-E1 / 2026-06-11: 隊列〔バ群〕ダイスの ON/OFF（houserule-features.md §6 / §4 zod 検証範囲表）。
    // .default(false) により、enableFormationDice フィールドが欠落した旧データ
    // （旧 persist データ / 旧 JSON プリセット）が検証通過し、false で補完される（後方互換、enablePhaseConfig と同方式）。
    enableFormationDice: z.boolean().default(false),
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
// CR-SA-16-E1 / 2026-05-15: 適用中プリセット名識別用 `name` フィールドを optional 追加。
// modal-houserule.md §3.1 JSON 構造 / houserule-features.md §4 zod 検証範囲表 SSoT。
// optional = 後方互換（`name` 欠落の旧 JSON プリセットも受理）。Import 時に存在すれば
// useRaceStore.importHouseRulesConfig 側で `appliedPresetName` にセット、欠落時は `null` 扱い。
// `houseRulesSchema` 本体には追加しない（JSON I/O ラッパー `houseRulesConfigSchema` のみ）。
export const houseRulesConfigSchema = z.object({
    name: z.string().optional(),
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
