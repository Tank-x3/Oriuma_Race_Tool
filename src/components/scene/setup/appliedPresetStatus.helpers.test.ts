// CR-SA-16-E2 / 2026-05-15: appliedPresetStatus.helpers 純粋関数 単体テスト
// 仕様根拠: scene1-setup.md §0-2「適用中プリセット名表示 — 状態 4 種」+ §0-3 状態判定ロジックの所在
//
// getAppliedPresetStatus の 4 状態判定 + 表示文言生成 + uniqueDiceConfig 含む deep equality を網羅検証。
// uniqueSkillEditor.helpers.test.ts / strategyEditor.helpers.test.ts と同パターンの純粋関数テスト。
import { describe, it, expect } from 'vitest';
import { getAppliedPresetStatus } from './appliedPresetStatus.helpers';
import { DEFAULT_HOUSE_RULES } from '../../../store/useRaceStore';
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import type { Strategy } from '../../../types';
import type { HouseRulesData } from '../../../core/schema/houseRules';

describe('getAppliedPresetStatus - CR-SA-16-E2', () => {
    // CR-SA-16-E2 / 2026-05-15:
    // (A1) ① 基本ルール: appliedPresetName=null + houseRules / strategies がデフォルト完全一致
    it('(A1) appliedPresetName=null + デフォルト完全一致なら ① 基本ルール', () => {
        const result = getAppliedPresetStatus(
            DEFAULT_HOUSE_RULES,
            DEFAULT_STRATEGIES,
            null,
            false,
        );
        expect(result.kind).toBe('default');
        expect(result.label).toBe('適用中: 基本ルール');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A2) ② 未保存のカスタム設定: appliedPresetName=null + houseRules.enableModifier 変更
    it('(A2) appliedPresetName=null + houseRules.enableModifier 変更なら ② 未保存のカスタム設定', () => {
        const modifiedHouseRules: HouseRulesData = {
            ...DEFAULT_HOUSE_RULES,
            enableModifier: true,
        };
        const result = getAppliedPresetStatus(
            modifiedHouseRules,
            DEFAULT_STRATEGIES,
            null,
            false,
        );
        expect(result.kind).toBe('custom');
        expect(result.label).toBe('適用中: 未保存のカスタム設定');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A3) ② 未保存のカスタム設定: appliedPresetName=null + uniqueDiceConfig.Gamble.fixValue 変更
    // CR-SA-15-E1 で追加した uniqueDiceConfig が deep equality 対象に含まれることの検証。
    it('(A3) appliedPresetName=null + uniqueDiceConfig.Gamble.fixValue 変更なら ② 未保存のカスタム設定', () => {
        const modifiedHouseRules: HouseRulesData = {
            ...DEFAULT_HOUSE_RULES,
            uniqueDiceConfig: {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Gamble: { fixValue: 5, diceStr: '1d20' }, // デフォルト fixValue=0 → 5 に変更
            },
        };
        const result = getAppliedPresetStatus(
            modifiedHouseRules,
            DEFAULT_STRATEGIES,
            null,
            false,
        );
        expect(result.kind).toBe('custom');
        expect(result.label).toBe('適用中: 未保存のカスタム設定');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A4) ② 未保存のカスタム設定: appliedPresetName=null + strategies にカスタム脚質追加
    it('(A4) appliedPresetName=null + strategies にカスタム脚質追加なら ② 未保存のカスタム設定', () => {
        const customStrategy: Strategy = {
            name: 'カスタム脚質X',
            fixValue: 42,
            dice: { start: '3d6', mid: '3d6', end: '3d6' },
            paceModifiers: { 1: 0, 2: 5, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: -5 },
        };
        const result = getAppliedPresetStatus(
            DEFAULT_HOUSE_RULES,
            [...DEFAULT_STRATEGIES, customStrategy],
            null,
            false,
        );
        expect(result.kind).toBe('custom');
        expect(result.label).toBe('適用中: 未保存のカスタム設定');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A5) ③ 読込済（変更なし）: appliedPresetName='テスト A' + isPresetDirty=false
    it('(A5) appliedPresetName 非 null + isPresetDirty=false なら ③ 読込済（変更なし）', () => {
        const result = getAppliedPresetStatus(
            DEFAULT_HOUSE_RULES,
            DEFAULT_STRATEGIES,
            'テスト A',
            false,
        );
        expect(result.kind).toBe('preset-clean');
        expect(result.label).toBe('適用中: テスト A');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A6) ④ 読込済（変更あり）: appliedPresetName='テスト A' + isPresetDirty=true
    // 全角括弧（U+FF08 / U+FF09）= scene1-setup.md §0-2 表示文言 SSoT。
    it('(A6) appliedPresetName 非 null + isPresetDirty=true なら ④ 読込済（変更あり、全角括弧）', () => {
        const result = getAppliedPresetStatus(
            DEFAULT_HOUSE_RULES,
            DEFAULT_STRATEGIES,
            'テスト A',
            true,
        );
        expect(result.kind).toBe('preset-dirty');
        expect(result.label).toBe('適用中: テスト A（変更あり）');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A7) ③ deep equality 不要の確認: appliedPresetName 非 null 時は houseRules / strategies の
    // 内容に関わらず isPresetDirty フラグのみで ③ / ④ を分岐する（§0-3 比較タイミング SSoT）。
    it('(A7) appliedPresetName 非 null + isPresetDirty=false なら houseRules / strategies がデフォルトと相違しても ③ 維持', () => {
        const modifiedHouseRules: HouseRulesData = {
            ...DEFAULT_HOUSE_RULES,
            enableModifier: true,
            enableSpecialStrategy: true,
            effectValue: 30,
        };
        const customStrategy: Strategy = {
            name: 'カスタム脚質Z',
            fixValue: 99,
            dice: { start: '5d5', mid: '5d5', end: '5d5' },
            paceModifiers: {},
        };
        const result = getAppliedPresetStatus(
            modifiedHouseRules,
            [...DEFAULT_STRATEGIES, customStrategy],
            'My Preset',
            false,
        );
        expect(result.kind).toBe('preset-clean');
        expect(result.label).toBe('適用中: My Preset');
    });

    // CR-SA-16-E2 / 2026-05-15:
    // (A8) プリセット名のエスケープ非対象: 特殊文字を含むプリセット名も label にそのまま埋め込む。
    // JSX 補間（{...}）で React 側が自動エスケープする前提のため、本関数は文字列としてそのまま含める。
    it('(A8) プリセット名に特殊文字を含む場合も label にそのまま埋め込まれる', () => {
        const specialName = 'テスト&特殊<文字>';
        const result = getAppliedPresetStatus(
            DEFAULT_HOUSE_RULES,
            DEFAULT_STRATEGIES,
            specialName,
            false,
        );
        expect(result.kind).toBe('preset-clean');
        expect(result.label).toBe(`適用中: ${specialName}`);
    });
});
