import { describe, it, expect } from 'vitest';
import {
    houseRulesSchema,
    customStrategySchema,
    houseRulesConfigSchema,
    validateHouseRulesConfig,
    VALIDATION_ERROR_MESSAGE,
    EFFECT_VALUE_MIN,
    EFFECT_VALUE_MAX,
    // CR-SA-15-E1 / 2026-05-14: 固有スキル設定スキーマ
    uniqueDiceEntrySchema,
    uniqueDiceConfigSchema,
} from './houseRules';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../strategies';

// Bundle-7 / P4-6 / 2026-05-10:
// houserule-features.md §4 zod 検証範囲表に対する正常系/異常系テスト。
// validateHouseRulesConfig は modal-houserule.md §3 ⚠️ Import Validation 既定文言を返す。

describe('Bundle-7 / P4-6 / 2026-05-10 houseRulesSchema', () => {
    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: enableBondSkill 追加（5 → 6 フィールド）
    const validHouseRules = {
        enableModifier: false,
        enableSpecialStrategy: false,
        enableCompositeUnique: false,
        enableExtendedUnique: false,
        enableBondSkill: false,
        effectValue: 15,
    };

    it('(i) 6 フィールドすべて正常値で success', () => {
        const result = houseRulesSchema.safeParse(validHouseRules);
        expect(result.success).toBe(true);
    });

    it('(ii) effectValue 境界値（min/max）で success', () => {
        const minResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: EFFECT_VALUE_MIN,
        });
        const maxResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: EFFECT_VALUE_MAX,
        });
        expect(minResult.success).toBe(true);
        expect(maxResult.success).toBe(true);
    });

    it('(iii) effectValue が 0 / 負値 / 上限超過で failure', () => {
        const zeroResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: 0,
        });
        const negativeResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: -5,
        });
        const overResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: EFFECT_VALUE_MAX + 1,
        });
        expect(zeroResult.success).toBe(false);
        expect(negativeResult.success).toBe(false);
        expect(overResult.success).toBe(false);
    });

    it('(iv) effectValue が小数で failure（int 制約）', () => {
        const result = houseRulesSchema.safeParse({
            ...validHouseRules,
            effectValue: 15.5,
        });
        expect(result.success).toBe(false);
    });

    it('(v) enableModifier 等が boolean 以外で failure', () => {
        const stringResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            enableModifier: 'true',
        });
        const numberResult = houseRulesSchema.safeParse({
            ...validHouseRules,
            enableSpecialStrategy: 1,
        });
        expect(stringResult.success).toBe(false);
        expect(numberResult.success).toBe(false);
    });

    it('(vi) フィールド欠落で failure（マイグレーション層が補完前提）', () => {
        const { effectValue: _omit, ...incomplete } = validHouseRules;
        void _omit;
        const result = houseRulesSchema.safeParse(incomplete);
        expect(result.success).toBe(false);
    });
});

describe('Bundle-7 / P4-6 / 2026-05-10 customStrategySchema', () => {
    const validStrategy = {
        name: 'カスタム1',
        fixValue: 12,
        dice: { start: '3d6', mid: '3d5', end: '1d8' },
        paceModifiers: { '5': 0, '7': 5 },
    };

    it('(i) 正常な脚質構造で success', () => {
        const result = customStrategySchema.safeParse(validStrategy);
        expect(result.success).toBe(true);
    });

    it('(ii) dice フィールド欠落で failure', () => {
        const result = customStrategySchema.safeParse({
            ...validStrategy,
            dice: { start: '3d6', mid: '3d5' },
        });
        expect(result.success).toBe(false);
    });
});

describe('Bundle-7 / P4-6 / 2026-05-10 validateHouseRulesConfig', () => {
    const validConfig = {
        houseRules: {
            enableModifier: false,
            enableSpecialStrategy: true,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 20,
        },
        strategies: [
            {
                name: '先行',
                fixValue: 10,
                dice: { start: '3d5', mid: '3d5', end: '4d5' },
                paceModifiers: {},
            },
        ],
    };

    it('正常な統合 config で success: true + data 同一構造', () => {
        const result = validateHouseRulesConfig(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.houseRules.effectValue).toBe(20);
            expect(result.data.strategies).toHaveLength(1);
        }
    });

    it('houseRules 構造異常で success: false + 既定エラー文言', () => {
        const result = validateHouseRulesConfig({
            houseRules: { ...validConfig.houseRules, effectValue: -1 },
            strategies: validConfig.strategies,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
        }
    });

    it('全くスキーマが合わない JSON で success: false', () => {
        const result = validateHouseRulesConfig({ unrelated: 'data' });
        expect(result.success).toBe(false);
    });

    it('houseRulesConfigSchema 経由でも同等の検証結果', () => {
        const directResult = houseRulesConfigSchema.safeParse(validConfig);
        const wrappedResult = validateHouseRulesConfig(validConfig);
        expect(directResult.success).toBe(wrappedResult.success);
    });
});

// Bundle-8-T1 / CR-SA-4 / 2026-05-10:
// houserule-features.md §4 zod 検証範囲表 +1 フィールド = enableBondSkill: boolean。
describe('houseRulesSchema - Bundle-8-T1 / enableBondSkill 拡張', () => {
    const baseValid = {
        enableModifier: false,
        enableSpecialStrategy: false,
        enableCompositeUnique: false,
        enableExtendedUnique: false,
        effectValue: 15,
    };

    it('(i) enableBondSkill = true で success', () => {
        const result = houseRulesSchema.safeParse({ ...baseValid, enableBondSkill: true });
        expect(result.success).toBe(true);
    });

    it('(ii) enableBondSkill = false で success', () => {
        const result = houseRulesSchema.safeParse({ ...baseValid, enableBondSkill: false });
        expect(result.success).toBe(true);
    });

    it('(iii) enableBondSkill が boolean 以外（string / number / null）で failure', () => {
        const stringResult = houseRulesSchema.safeParse({
            ...baseValid,
            enableBondSkill: 'true' as unknown as boolean,
        });
        const numberResult = houseRulesSchema.safeParse({
            ...baseValid,
            enableBondSkill: 1 as unknown as boolean,
        });
        const nullResult = houseRulesSchema.safeParse({
            ...baseValid,
            enableBondSkill: null as unknown as boolean,
        });
        expect(stringResult.success).toBe(false);
        expect(numberResult.success).toBe(false);
        expect(nullResult.success).toBe(false);
    });

    it('(iv) enableBondSkill 欠落で failure（DEFAULT 補完は persistMigrate の責務、schema 単体は厳格）', () => {
        // baseValid には enableBondSkill が含まれない = 欠落ケース
        const result = houseRulesSchema.safeParse(baseValid);
        expect(result.success).toBe(false);
    });

    it('(v) houseRulesConfigSchema 経由で enableBondSkill 含む完全データが通過する', () => {
        const fullConfig = {
            houseRules: { ...baseValid, enableBondSkill: true },
            strategies: [],
        };
        const result = houseRulesConfigSchema.safeParse(fullConfig);
        expect(result.success).toBe(true);
    });
});

// CR-SA-15-E1 / 2026-05-14:
// houserule-features.md §5.2 設定項目 + §4 zod 検証範囲表に対する固有スキル設定スキーマの検証。
// - uniqueDiceEntrySchema: fixValue 整数 / diceStr XdY 形式（正規表現 /^\d+d\d+$/）
// - uniqueDiceConfigSchema: 固有スキル 5 タイプすべてのキー必須（明示 object 方式）
// - houseRulesSchema.uniqueDiceConfig: .default() による後方互換（フィールド欠落の旧データを補完）
describe('CR-SA-15-E1 / 2026-05-14 uniqueDiceConfig schema', () => {
    // uniqueDiceConfig フィールドを含まない旧 houseRules（6 フィールド = CR-SA-15-E1 以前の構造）
    const validHouseRules6 = {
        enableModifier: false,
        enableSpecialStrategy: false,
        enableCompositeUnique: false,
        enableExtendedUnique: false,
        enableBondSkill: false,
        effectValue: 15,
    };

    describe('uniqueDiceEntrySchema', () => {
        it('(i) diceStr が XdY 形式（1d10 / 1d11 / 3d6）で success', () => {
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 5, diceStr: '1d10' }).success).toBe(true);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '1d11' }).success).toBe(true);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '3d6' }).success).toBe(true);
        });

        it('(ii) diceStr が非 XdY 形式（abc / 10 / 空文字 / 1d）で failure', () => {
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: 'abc' }).success).toBe(false);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '10' }).success).toBe(false);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '' }).success).toBe(false);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '1d' }).success).toBe(false);
        });

        it('(iii) fixValue が整数（5 / 0 / -10）で success', () => {
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 5, diceStr: '1d10' }).success).toBe(true);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 0, diceStr: '1d10' }).success).toBe(true);
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: -10, diceStr: '1d35' }).success).toBe(true);
        });

        it('(iv) fixValue が小数（5.5）で failure（int 制約）', () => {
            expect(uniqueDiceEntrySchema.safeParse({ fixValue: 5.5, diceStr: '1d10' }).success).toBe(false);
        });
    });

    describe('uniqueDiceConfigSchema', () => {
        it('(v) 固有スキル 5 タイプすべてのキー揃いで success', () => {
            const result = uniqueDiceConfigSchema.safeParse(DEFAULT_UNIQUE_DICE_CONFIG);
            expect(result.success).toBe(true);
        });

        it('(vi) 1 キー欠落（SuperStability なし）で failure', () => {
            const { SuperStability: _omit, ...incomplete } = DEFAULT_UNIQUE_DICE_CONFIG;
            void _omit;
            const result = uniqueDiceConfigSchema.safeParse(incomplete);
            expect(result.success).toBe(false);
        });
    });

    describe('houseRulesSchema との統合（.default() 後方互換）', () => {
        it('(vii) uniqueDiceConfig フィールド欠落の旧 houseRules が .default() で success + デフォルト補完', () => {
            const result = houseRulesSchema.safeParse(validHouseRules6);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
            }
        });

        it('(viii) uniqueDiceConfig フィールドが存在するが 5 キー不揃いで failure（不完全構造は許容しない）', () => {
            const result = houseRulesSchema.safeParse({
                ...validHouseRules6,
                uniqueDiceConfig: { Stability: { fixValue: 5, diceStr: '1d10' } },
            });
            expect(result.success).toBe(false);
        });

        it('(ix) uniqueDiceConfig を含む 7 フィールド完全データ（安定型 5+1d11 運用）で success', () => {
            const result = houseRulesSchema.safeParse({
                ...validHouseRules6,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Stability: { fixValue: 5, diceStr: '1d11' },
                },
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.uniqueDiceConfig.Stability.diceStr).toBe('1d11');
            }
        });
    });
});
