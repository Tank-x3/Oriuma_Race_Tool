// Bundle-11-T2 / CR-SA-12 / 2026-05-11: 設定プリセット管理 ファイル I/O ヘルパー
// 仕様根拠: modal-houserule.md §3 設定プリセット管理 ファイル入出力 + §⚠️ Import Validation
//
// Export 経路: state.config.houseRules + state.strategies をシリアライズ → Blob ダウンロード
// Import 経路: FileReader.readAsText → deserializeAndValidate (JSON.parse + zod 検証)
// 既存 validateHouseRulesConfig (Bundle-7 ENG29 / `src/core/schema/houseRules.ts`) を委譲先として再利用。
//
// 純粋関数のみ集約 (Modal レンダリング非依存) ＝ 単体テストでロジック網羅、
// PresetManagerModal.tsx は本ヘルパーを呼び出すだけの薄い責務 (組み合わせ統合テストで検証)。
import type { Strategy } from '../../../types';
import {
    validateHouseRulesConfig,
    VALIDATION_ERROR_MESSAGE,
    type HouseRulesData,
    type HouseRulesConfig,
    type ValidationResult,
} from '../../../core/schema/houseRules';

/**
 * 現 state の houseRules + strategies を JSON 文字列化する。
 * 既存 `loadPreset` の payload 形式 (`{ houseRules, strategies }`) と完全整合。
 * インデント 2 スペース固定 (ユーザーがテキストエディタで開いて目視確認しやすい想定)。
 */
export function serializeHouseRulesConfig(
    houseRules: HouseRulesData,
    strategies: Strategy[],
): string {
    return JSON.stringify({ houseRules, strategies }, null, 2);
}

/**
 * JSON 文字列をパースし、`validateHouseRulesConfig` で zod 検証する。
 * 構文不正 (JSON.parse throw) と型不正 (zod 失敗) で文言を統一する
 * (modal-houserule.md §⚠️ Import Validation = VALIDATION_ERROR_MESSAGE 単一エラー文言)。
 */
export function deserializeAndValidate(
    jsonText: string,
): ValidationResult<HouseRulesConfig> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return { success: false, error: VALIDATION_ERROR_MESSAGE };
    }
    return validateHouseRulesConfig(parsed);
}

/**
 * Export ダウンロード時のファイル名を生成する。
 * 形式: `race-house-rules-YYYYMMDD-HHmmss.json` (ISO 8601 セーフ文字列化)。
 * ローカル時刻ベース (ユーザー環境の認識と合致しやすい)、`new Date()` ベースの拡張で
 * テスト容易性を確保 (引数 now を取る)。
 */
export function buildExportFilename(now: Date): string {
    const pad2 = (n: number): string => n.toString().padStart(2, '0');
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    const hh = pad2(now.getHours());
    const mm = pad2(now.getMinutes());
    const ss = pad2(now.getSeconds());
    return `race-house-rules-${y}${m}${d}-${hh}${mm}${ss}.json`;
}
