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
    // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
    enablePhaseConfig: false,
    // CR-SA-20-E1 / 2026-06-11: 型定義拡張に追従（9 フィールド）
    enableFormationDice: false,
    // CR-SA-21+22-E1 / 2026-07-06: 型定義拡張に追従（11 フィールド）
    enableNoUniqueSkill: false,
    customUniqueSkills: [],
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

// CR-SA-15-E4 / 2026-05-15:
// 固有スキル設定（uniqueDiceConfig）の JSON I/O 動作確認（modal-houserule.md §3 + §4 + ⚠️ Import Validation
// / houserule-features.md §4 zod 検証範囲表 + §5.2 設定項目 + §5.5 既存ロジック整合）。
// E1 で組み込んだ zod スキーマ（`.default(DEFAULT_UNIQUE_DICE_CONFIG)` + 5 キー明示 object）が、
// `serializeHouseRulesConfig` / `deserializeAndValidate` を通じて期待どおりに動作することの構造的証跡。
describe('uniqueDiceConfig - CR-SA-15-E4', () => {
    // ユーザーリクエスト由来の代表的なカスタム値（ハウスルール郡の安定型 5+1d11 運用相当）
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加で 5 → 7 キー（現行実態に追従）。
    const customUniqueDiceConfig = {
        Stability: { fixValue: 7, diceStr: '1d11' },
        Gamble: { fixValue: 3, diceStr: '1d24' },
        Persistent: { fixValue: 2, diceStr: '1d12' },
        SuperGamble: { fixValue: -5, diceStr: '1d20' },
        SuperStability: { fixValue: 10, diceStr: '1d4' },
        GambleII: { fixValue: -15, diceStr: '1d40' },
        StabilityII: { fixValue: 1, diceStr: '2d6' },
    };

    const customHouseRules: HouseRulesData = {
        ...sampleHouseRules,
        uniqueDiceConfig: customUniqueDiceConfig,
    };

    // (U1) カスタム uniqueDiceConfig が serialize 出力 JSON に正しく含まれる
    it('(U1) カスタム uniqueDiceConfig が serialize 出力 JSON に反映される', () => {
        const json = serializeHouseRulesConfig(customHouseRules, [...DEFAULT_STRATEGIES]);
        const parsed = JSON.parse(json);
        expect(parsed.houseRules.uniqueDiceConfig.Stability).toEqual({ fixValue: 7, diceStr: '1d11' });
        expect(parsed.houseRules.uniqueDiceConfig.SuperGamble).toEqual({ fixValue: -5, diceStr: '1d20' });
        expect(parsed.houseRules.uniqueDiceConfig.SuperStability).toEqual({ fixValue: 10, diceStr: '1d4' });
        // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ もカスタム値が反映される
        expect(parsed.houseRules.uniqueDiceConfig.GambleII).toEqual({ fixValue: -15, diceStr: '1d40' });
        expect(parsed.houseRules.uniqueDiceConfig.StabilityII).toEqual({ fixValue: 1, diceStr: '2d6' });
        // 7 キー揃っていること
        expect(Object.keys(parsed.houseRules.uniqueDiceConfig).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
        );
    });

    // (U2) カスタム uniqueDiceConfig 含有 JSON が deserialize で復元される
    it('(U2) カスタム uniqueDiceConfig 含有 JSON が deserializeAndValidate で復元される', () => {
        const json = serializeHouseRulesConfig(customHouseRules, [...DEFAULT_STRATEGIES]);
        const result = deserializeAndValidate(json);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.houseRules.uniqueDiceConfig).toEqual(customUniqueDiceConfig);
        }
    });

    // (U3) 後方互換性 = uniqueDiceConfig フィールド欠落 JSON のデフォルト補完
    // E1 で `.default(DEFAULT_UNIQUE_DICE_CONFIG)` を付与した最大の理由 = 旧プリセット .json
    // （CR-SA-15-E1 以前に Export されたもの）を読み込めるようにするための後方互換性。
    it('(U3) uniqueDiceConfig フィールド欠落 JSON は DEFAULT_UNIQUE_DICE_CONFIG で補完されて成功する', () => {
        const legacyJson = JSON.stringify({
            houseRules: {
                enableModifier: true,
                enableSpecialStrategy: true,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: true,
                effectValue: 25,
                // uniqueDiceConfig フィールドそのものが欠落（旧形式プリセット相当）
            },
            strategies: [],
        });
        const result = deserializeAndValidate(legacyJson);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.houseRules.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
        }
    });

    // (U4-a) 5 キー不揃い = `.default()` の補完対象外。フィールド存在で内部キー欠落の場合は検証失敗
    // （明示 object 方式の真価。z.record 不採用の SSoT 根拠）
    it('(U4-a) uniqueDiceConfig が存在するが 5 キー不揃い（Stability 欠落）は拒否される', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    // Stability キー欠落
                    Gamble: { fixValue: 0, diceStr: '1d20' },
                    Persistent: { fixValue: 0, diceStr: '1d10' },
                    SuperGamble: { fixValue: -10, diceStr: '1d35' },
                    SuperStability: { fixValue: 8, diceStr: '1d3' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U4-b) fixValue が小数 → `z.number().int()` で拒否（houserule-features.md §5.2 整数 SSoT）
    it('(U4-b) fixValue が小数（1.5）は拒否される', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Stability: { fixValue: 1.5, diceStr: '1d10' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U4-c) fixValue が文字列 → `z.number()` で拒否
    it('(U4-c) fixValue が文字列（"5"）は拒否される', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Gamble: { fixValue: '5', diceStr: '1d20' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U4-d) diceStr が XdY 形式違反 → /^\d+d\d+$/ で拒否（houserule-features.md §5.2 SSoT）
    it('(U4-d) diceStr が XdY 形式違反（"1x10"）は拒否される', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Stability: { fixValue: 5, diceStr: '1x10' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U4-e) diceStr が完全非数値（"abc"）→ 拒否
    it('(U4-e) diceStr が完全非数値（"abc"）は拒否される', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Gamble: { fixValue: 0, diceStr: 'abc' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U4-f) diceStr に負号付き（"-1d10"）→ 拒否（houserule-features.md §5.2 SSoT = 負号なし、
    // validator.ts の validateDiceFormat の負号許容とは差異あり、§4 案 V2 で PM73 既知）
    it('(U4-f) diceStr 負号付き（"-1d10"）は固有ダイス側で拒否される（脚質エディタとの差異）', () => {
        const invalidJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Stability: { fixValue: 5, diceStr: '-1d10' },
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(invalidJson);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    // (U5) CR-SA-19 / 2026-06-06: 旧 5 キープリセット（GambleII / StabilityII 欠落、旧必須 5 キーは揃う）の後方互換。
    // CR-SA-15/16 期に Export された配布済みプリセット .json をそのまま読み込めることを保証する
    // （houserule-features.md §5.4 SSoT。新 2 キーは uniqueDiceConfigSchema の .default() でデフォルト補完される）。
    // 旧 5 キーのカスタム値は保持され、新 2 キーのみデフォルトで埋まる（U4-a の「必須キー欠落は拒否」とは別経路）。
    it('(U5) 旧 5 キープリセット（GambleII / StabilityII 欠落）は新 2 キーがデフォルト補完されて受理される', () => {
        const legacyFiveKeyJson = JSON.stringify({
            houseRules: {
                ...sampleHouseRules,
                uniqueDiceConfig: {
                    Stability: { fixValue: 7, diceStr: '1d11' }, // カスタム値（保持されること）
                    Gamble: { fixValue: 0, diceStr: '1d20' },
                    Persistent: { fixValue: 0, diceStr: '1d10' },
                    SuperGamble: { fixValue: -10, diceStr: '1d35' },
                    SuperStability: { fixValue: 8, diceStr: '1d3' },
                    // GambleII / StabilityII 欠落（CR-SA-15/16 期の旧プリセット相当）
                },
            },
            strategies: [],
        });
        const result = deserializeAndValidate(legacyFiveKeyJson);
        expect(result.success).toBe(true);
        if (result.success) {
            const cfg = result.data.houseRules.uniqueDiceConfig;
            // 旧 5 キーのカスタム値は保持される
            expect(cfg.Stability).toEqual({ fixValue: 7, diceStr: '1d11' });
            expect(cfg.SuperGamble).toEqual({ fixValue: -10, diceStr: '1d35' });
            // 新 2 キーはデフォルト値で補完される
            expect(cfg.GambleII).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.GambleII);
            expect(cfg.StabilityII).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.StabilityII);
            // 結果として 7 キー揃う
            expect(Object.keys(cfg).sort()).toEqual(
                ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
            );
        }
    });
});

// CR-SA-16-E2 / 2026-05-15:
// serializeHouseRulesConfig の末尾オプショナル引数 appliedPresetName 拡張に対する検証
// （modal-houserule.md §3.1 JSON 構造、Export 経路で `name` フィールドを含めるかどうかの分岐）。
// 既存呼び出し（引数省略 / null）は旧 2 キー構造を維持し、非 null 時のみ 3 キー構造になる。
describe('serializeHouseRulesConfig with appliedPresetName - CR-SA-16-E2', () => {
    // CR-SA-16-E2 / 2026-05-15:
    // (P1) appliedPresetName 引数省略時: 既存挙動（{houseRules, strategies} 2 キー構造）。
    // Bundle-11-T2 (S1) 既存テストと同等の構造 = 後方互換性の機械的証跡。
    it('(P1) appliedPresetName 引数省略時は旧 2 キー構造（name フィールドなし）で出力される', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, [...DEFAULT_STRATEGIES]);
        const parsed = JSON.parse(json);
        expect(parsed.name).toBeUndefined();
        expect(Object.keys(parsed).sort()).toEqual(['houseRules', 'strategies']);
        expect(parsed.houseRules).toEqual(sampleHouseRules);
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (P2) appliedPresetName=null 時: name フィールドを含めない（!= null ガードで null は非含有側）。
    // modal-houserule.md §3.1「name 欠落時の挙動」と整合（appliedPresetName=null → 旧 2 キー構造）。
    it('(P2) appliedPresetName=null 時は name フィールドを含めず 2 キー構造で出力される', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, [...DEFAULT_STRATEGIES], null);
        const parsed = JSON.parse(json);
        expect(parsed.name).toBeUndefined();
        expect(Object.keys(parsed).sort()).toEqual(['houseRules', 'strategies']);
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (P3) appliedPresetName='My House Rule A' 時: 先頭に name フィールドを含めた 3 キー構造。
    // Stage 1 動作確認 §3.3 ステップ 7（Export JSON に `name` フィールド含有）の構造的証跡。
    it('(P3) appliedPresetName が非 null 文字列なら name フィールドを含めた 3 キー構造で出力される', () => {
        const json = serializeHouseRulesConfig(
            sampleHouseRules,
            [...DEFAULT_STRATEGIES],
            'My House Rule A',
        );
        const parsed = JSON.parse(json);
        expect(parsed.name).toBe('My House Rule A');
        expect(Object.keys(parsed).sort()).toEqual(['houseRules', 'name', 'strategies']);
        expect(parsed.houseRules).toEqual(sampleHouseRules);
        expect(parsed.strategies).toHaveLength(DEFAULT_STRATEGIES.length);
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (P4) appliedPresetName=空文字列 '': 空文字列も `name` として含める
    // （`!= null` ガードで空文字列は非 null 扱い、Engineer 裁量範囲の選択）。
    // 空文字 name は Import 経路（zod の z.string()）で受理されるため、Export → Import の
    // 往復で構造的整合性を保つ。
    it('(P4) appliedPresetName=空文字列 でも name フィールドとして含められる', () => {
        const json = serializeHouseRulesConfig(sampleHouseRules, [...DEFAULT_STRATEGIES], '');
        const parsed = JSON.parse(json);
        expect(parsed.name).toBe('');
        expect(Object.keys(parsed).sort()).toEqual(['houseRules', 'name', 'strategies']);
    });
});
