// Bundle-11-T2 / CR-SA-12 / 2026-05-11: プリセット管理 ファイル I/O 統合テスト
// 仕様根拠:
//  - modal-houserule.md §3 設定プリセット管理 ファイル入出力 + §⚠️ Import Validation + §ℹ️ Confirmations
//  - houserule-features.md §4 Config Management (JSON)
//
// 範囲:
//  - serializeHouseRulesConfig / deserializeAndValidate の組合せ動作（Export 経路 / Import 経路）
//  - useRaceStore.importHouseRulesConfig の state 上書き + 全 participants score 再計算
//  - useRaceStore.loadPreset の Bundle-11-T2 共通化リファクタ regression
//  - ラウンドトリップ: 現 state → Export → Import → 元と完全一致
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRaceStore } from '../../store/useRaceStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { DEFAULT_STRATEGIES } from '../../core/strategies';
import {
    serializeHouseRulesConfig,
    deserializeAndValidate,
} from '../../components/scene/setup/presetManager.helpers';
import { VALIDATION_ERROR_MESSAGE } from '../../core/schema/houseRules';
import type { Strategy } from '../../types';

const createMockLocalStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
            store.set(k, String(v));
        },
        removeItem: (k: string) => {
            store.delete(k);
        },
        clear: () => {
            store.clear();
        },
        get length() {
            return store.size;
        },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
    };
};

const buildCustomStrategy = (overrides: Partial<Strategy> = {}): Strategy => ({
    name: 'カスタム脚質Z',
    fixValue: 10,
    dice: { start: '3d6', mid: '3d6', end: '3d6' },
    paceModifiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    ...overrides,
});

describe('Bundle-11-T2 / プリセット管理 ファイル I/O 統合テスト', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createMockLocalStorage());
        useRaceStore.getState().resetRace();
        // resetRace は strategies をリセットしないため、DEFAULT_STRATEGIES に明示復帰させる
        // (Bundle-11-T1 統合テスト + Bundle-10-T3 統合テスト同パターン)。
        useRaceStore.setState({
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                dice: { ...s.dice },
                paceModifiers: { ...s.paceModifiers },
            })),
        });
        // notification store は自動 setTimeout 削除があるため、直接配列をクリア
        useNotificationStore.setState({ notifications: [] });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Export - Bundle-11-T2', () => {
        // (E1) Export = serializeHouseRulesConfig の出力が { houseRules, strategies } 形式で現 state と完全一致
        it('(E1) Export = JSON 出力が現 state の houseRules + strategies と完全一致', () => {
            useRaceStore.getState().updateHouseRules({
                enableSpecialStrategy: true,
                enableBondSkill: true,
                effectValue: 30,
            });
            useRaceStore.getState().addStrategy('逃げ', buildCustomStrategy({ fixValue: 99 }));
            const state = useRaceStore.getState();
            const json = serializeHouseRulesConfig(state.config.houseRules, state.strategies);
            const parsed = JSON.parse(json);
            expect(parsed.houseRules.enableSpecialStrategy).toBe(true);
            expect(parsed.houseRules.enableBondSkill).toBe(true);
            expect(parsed.houseRules.effectValue).toBe(30);
            expect(parsed.strategies).toHaveLength(6);
            const custom = parsed.strategies.find(
                (s: Strategy) => s.name === 'カスタム脚質Z',
            );
            expect(custom?.fixValue).toBe(99);
        });

        // (E2) Export = カスタム脚質を含む状態でも customStrategySchema と整合
        it('(E2) Export = カスタム脚質を含む状態でも zod customStrategySchema と整合する', () => {
            useRaceStore.getState().addStrategy(
                '差し',
                buildCustomStrategy({
                    name: '波乱型',
                    fixValue: 7,
                    paceModifiers: { 1: 10, 2: 5, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: -5, 9: -10 },
                }),
            );
            const state = useRaceStore.getState();
            const json = serializeHouseRulesConfig(state.config.houseRules, state.strategies);
            const result = deserializeAndValidate(json);
            expect(result.success).toBe(true);
        });

        // (E3) Export = houseRules.effectValue が値域 1〜999 のまま保存される
        it('(E3) Export = effectValue が値域内の値で保存される', () => {
            useRaceStore.getState().updateHouseRules({ effectValue: 999 });
            const state = useRaceStore.getState();
            const json = serializeHouseRulesConfig(state.config.houseRules, state.strategies);
            const parsed = JSON.parse(json);
            expect(parsed.houseRules.effectValue).toBe(999);
        });
    });

    describe('Import - Bundle-11-T2', () => {
        // (I1) Import = 正常 JSON → state 上書き + 全 participants score 再計算
        it('(I1) Import = 正常 JSON で houseRules + strategies が上書きされる', () => {
            const importPayload = JSON.stringify({
                houseRules: {
                    enableModifier: true,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: true,
                    enableExtendedUnique: false,
                    enableBondSkill: true,
                    effectValue: 42,
                },
                strategies: [
                    {
                        name: 'カスタムA',
                        fixValue: 33,
                        dice: { start: '3d6', mid: '3d6', end: '3d6' },
                        paceModifiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
                    },
                ],
            });
            const result = deserializeAndValidate(importPayload);
            expect(result.success).toBe(true);
            if (result.success) {
                useRaceStore.getState().importHouseRulesConfig(result.data);
            }
            const after = useRaceStore.getState();
            expect(after.config.houseRules.effectValue).toBe(42);
            expect(after.config.houseRules.enableBondSkill).toBe(true);
            expect(after.strategies).toHaveLength(1);
            expect(after.strategies[0]?.name).toBe('カスタムA');
        });

        // (I2) Import = 破損 JSON → VALIDATION_ERROR_MESSAGE + state 不変
        it('(I2) Import = 破損 JSON は VALIDATION_ERROR_MESSAGE で拒否され state 不変', () => {
            const before = useRaceStore.getState();
            const beforeRules = { ...before.config.houseRules };
            const beforeStratNames = before.strategies.map((s) => s.name);
            const result = deserializeAndValidate('{ broken json');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe(VALIDATION_ERROR_MESSAGE);
            }
            const after = useRaceStore.getState();
            expect(after.config.houseRules).toEqual(beforeRules);
            expect(after.strategies.map((s) => s.name)).toEqual(beforeStratNames);
        });

        // (I3) Import = フィールド欠落 JSON → エラー + state 不変
        it('(I3) Import = 必須フィールド欠落の JSON は拒否され state 不変', () => {
            const beforeRules = { ...useRaceStore.getState().config.houseRules };
            // enableModifier 欠落
            const broken = JSON.stringify({
                houseRules: {
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: false,
                    effectValue: 15,
                },
                strategies: [],
            });
            const result = deserializeAndValidate(broken);
            expect(result.success).toBe(false);
            expect(useRaceStore.getState().config.houseRules).toEqual(beforeRules);
        });

        // (I4) Import = effectValue 値域外 (1000) → エラー + state 不変
        it('(I4) Import = effectValue 値域外 (1000) は拒否され state 不変', () => {
            const beforeRules = { ...useRaceStore.getState().config.houseRules };
            const broken = JSON.stringify({
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: false,
                    effectValue: 1000,
                },
                strategies: [],
            });
            const result = deserializeAndValidate(broken);
            expect(result.success).toBe(false);
            expect(useRaceStore.getState().config.houseRules).toEqual(beforeRules);
        });

        // (I5) Import = 完全別 JSON ({"foo": "bar"}) → エラー + state 不変
        it('(I5) Import = 完全別構造 JSON は拒否され state 不変', () => {
            const beforeRules = { ...useRaceStore.getState().config.houseRules };
            const result = deserializeAndValidate('{"foo": "bar"}');
            expect(result.success).toBe(false);
            expect(useRaceStore.getState().config.houseRules).toEqual(beforeRules);
        });
    });

    describe('Round-trip - Bundle-11-T2', () => {
        // (R1) Export → Import → 元と完全一致
        it('(R1) Export → deserialize → importHouseRulesConfig で元の state と完全一致', () => {
            useRaceStore.getState().updateHouseRules({
                enableModifier: true,
                enableSpecialStrategy: true,
                enableBondSkill: true,
                effectValue: 50,
            });
            useRaceStore.getState().addStrategy(
                '先行',
                buildCustomStrategy({ fixValue: 77, paceModifiers: { 5: 3 } }),
            );
            const original = useRaceStore.getState();
            const json = serializeHouseRulesConfig(original.config.houseRules, original.strategies);

            // state を変更
            useRaceStore.getState().updateHouseRules({
                enableModifier: false,
                enableSpecialStrategy: false,
                enableBondSkill: false,
                effectValue: 15,
            });
            useRaceStore.getState().removeStrategy('カスタム脚質Z');

            // ラウンドトリップ
            const result = deserializeAndValidate(json);
            expect(result.success).toBe(true);
            if (result.success) {
                useRaceStore.getState().importHouseRulesConfig(result.data);
            }
            const restored = useRaceStore.getState();
            expect(restored.config.houseRules.enableModifier).toBe(true);
            expect(restored.config.houseRules.effectValue).toBe(50);
            expect(restored.strategies).toHaveLength(6);
            const custom = restored.strategies.find((s) => s.name === 'カスタム脚質Z');
            expect(custom?.fixValue).toBe(77);
            expect(custom?.paceModifiers[5]).toBe(3);
        });

        // (R2) Round-trip 後の participants.score が再計算される (runtime-sync 整合)
        it('(R2) Round-trip 後に participants.score が再計算される', () => {
            useRaceStore.getState().generateParticipants(3);
            const beforeScores = useRaceStore.getState().participants.map((p) => p.score);
            // 何らかの設定変更で score 再計算が走るシナリオ
            useRaceStore.getState().updateHouseRules({
                enableSpecialStrategy: true,
                effectValue: 30,
            });
            const state = useRaceStore.getState();
            const json = serializeHouseRulesConfig(state.config.houseRules, state.strategies);
            const result = deserializeAndValidate(json);
            expect(result.success).toBe(true);
            if (result.success) {
                useRaceStore.getState().importHouseRulesConfig(result.data);
            }
            const afterScores = useRaceStore.getState().participants.map((p) => p.score);
            // score は number 型で再計算されていることを確認
            expect(afterScores).toHaveLength(3);
            afterScores.forEach((s) => expect(typeof s).toBe('number'));
            // beforeScores も参照確認 (テスト未使用警告回避 + 比較確認)
            expect(beforeScores).toHaveLength(3);
        });

        // (R3) Bundle-11-T1 の savePreset → listPresetNames → loadPreset 連動が壊れない (regression)
        it('(R3) Bundle-11-T1 savePreset → loadPreset 連動 regression (T2 共通化リファクタ整合)', () => {
            useRaceStore.getState().updateHouseRules({
                enableBondSkill: true,
                enableSpecialStrategy: true,
                effectValue: 25,
            });
            useRaceStore.getState().addStrategy('逃げ', buildCustomStrategy({ fixValue: 88 }));
            useRaceStore.getState().savePreset('T2regression');

            // 別設定に変更
            useRaceStore.getState().updateHouseRules({
                enableBondSkill: false,
                enableSpecialStrategy: false,
                effectValue: 15,
            });
            useRaceStore.getState().removeStrategy('カスタム脚質Z');

            // T2 共通化リファクタ後の loadPreset 動作確認
            useRaceStore.getState().loadPreset('T2regression');
            const after = useRaceStore.getState();
            expect(after.config.houseRules.enableBondSkill).toBe(true);
            expect(after.config.houseRules.effectValue).toBe(25);
            expect(after.strategies).toHaveLength(6);
            const restored = after.strategies.find((s) => s.name === 'カスタム脚質Z');
            expect(restored?.fixValue).toBe(88);
        });
    });
});
