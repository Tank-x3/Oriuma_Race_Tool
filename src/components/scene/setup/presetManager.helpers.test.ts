// Bundle-11-T2 / CR-SA-12 / 2026-05-11: presetManager.helpers 純粋関数 単体テスト
// 仕様根拠: modal-houserule.md §3 設定プリセット管理 ファイル入出力 + §⚠️ Import Validation
//
// serializeHouseRulesConfig / deserializeAndValidate / buildExportFilename の
// ロジックを Modal レンダリング非依存で網羅検証。
import { describe, it, expect } from 'vitest';
import {
    serializeHouseRulesConfig,
    deserializeAndValidate,
    buildExportFilename,
} from './presetManager.helpers';
// CR-SA-15-E1 / 2026-05-14: DEFAULT_UNIQUE_DICE_CONFIG = HouseRulesData 型厳密化（uniqueDiceConfig 必須）に追従するため import
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import { VALIDATION_ERROR_MESSAGE } from '../../../core/schema/houseRules';
import type { Strategy } from '../../../types';
import type { HouseRulesData } from '../../../core/schema/houseRules';

const sampleHouseRules: HouseRulesData = {
    enableModifier: true,
    enableSpecialStrategy: true,
    enableCompositeUnique: false,
    enableExtendedUnique: false,
    enableBondSkill: true,
    effectValue: 25,
    // CR-SA-15-E1 / 2026-05-14: HouseRulesData 型厳密化（uniqueDiceConfig 必須）に追従
    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
};

const customStrategy: Strategy = {
    name: 'カスタム脚質Z',
    fixValue: 42,
    dice: { start: '3d6', mid: '3d6', end: '3d6' },
    paceModifiers: { 1: 0, 2: 5, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: -5 },
};

describe('serializeHouseRulesConfig - Bundle-11-T2', () => {
    // (S1) houseRules + strategies が JSON 形式で正しく出力される
    it('(S1) houseRules + strategies を `{ houseRules, strategies }` 形式で文字列化する', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, [...DEFAULT_STRATEGIES, customStrategy]);
        const parsed = JSON.parse(json);
        expect(parsed.houseRules).toEqual(sampleHouseRules);
        expect(parsed.strategies).toHaveLength(DEFAULT_STRATEGIES.length + 1);
        expect(parsed.strategies[DEFAULT_STRATEGIES.length].name).toBe('カスタム脚質Z');
    });

    // (S2) インデント 2 スペース整形で人間可読
    it('(S2) インデント 2 スペースで整形される (人間可読性)', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, []);
        expect(json).toContain('\n  "houseRules"');
        expect(json).toContain('\n  "strategies"');
    });
});

describe('deserializeAndValidate - Bundle-11-T2', () => {
    // (D1) 正常な JSON 文字列 → success: true + data
    it('(D1) 正常な JSON 文字列を成功で返す', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, [customStrategy]);
        const result = deserializeAndValidate(json);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.houseRules.effectValue).toBe(25);
            expect(result.data.strategies[0]?.name).toBe('カスタム脚質Z');
        }
    });

    // (D2) 構文不正な JSON (JSON.parse throw) → VALIDATION_ERROR_MESSAGE
    it('(D2) 構文不正な JSON は VALIDATION_ERROR_MESSAGE で拒否される', () => {
        const result = deserializeAndValidate('{ invalid json');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (D3) zod 型不正 (フィールド欠落) → VALIDATION_ERROR_MESSAGE
    it('(D3) 必須フィールド欠落 JSON は VALIDATION_ERROR_MESSAGE で拒否される', () => {
        const result = deserializeAndValidate(JSON.stringify({ houseRules: { enableModifier: true } }));
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (D4) effectValue 値域外 → VALIDATION_ERROR_MESSAGE
    it('(D4) effectValue 値域外 (1000) は VALIDATION_ERROR_MESSAGE で拒否される', () => {
        const json = JSON.stringify({
            houseRules: { ...sampleHouseRules, effectValue: 1000 },
            strategies: [],
        });
        const result = deserializeAndValidate(json);
        expect(result.success).toBe(false);
    });

    // (D5) 完全別 JSON ({ foo: bar }) → VALIDATION_ERROR_MESSAGE
    it('(D5) 完全別構造の JSON は VALIDATION_ERROR_MESSAGE で拒否される', () => {
        const result = deserializeAndValidate('{"foo": "bar"}');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });
});

describe('buildExportFilename - Bundle-11-T2', () => {
    // (F1) ISO 8601 セーフ文字列化 (YYYYMMDD-HHmmss)
    it('(F1) `race-house-rules-YYYYMMDD-HHmmss.json` 形式でファイル名を生成する', () => {
        // 2026-05-11 14:30:22 ローカル時刻 (テスト実行環境非依存に固定)
        const now = new Date(2026, 4, 11, 14, 30, 22);
        expect(buildExportFilename(now)).toBe('race-house-rules-20260511-143022.json');
    });

    // (F2) 1 桁数値のゼロパディング
    it('(F2) 1 桁数値はゼロパディングされる', () => {
        const now = new Date(2026, 0, 5, 3, 4, 9); // 2026-01-05 03:04:09
        expect(buildExportFilename(now)).toBe('race-house-rules-20260105-030409.json');
    });
});
