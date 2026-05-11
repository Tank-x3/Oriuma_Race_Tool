// Bundle-11-T1 / CR-SA-12 / 2026-05-11: プリセット管理 統合テスト
// 仕様根拠:
//  - modal-houserule.md §3 設定プリセット管理 + §Critical Errors + §Confirmations
//  - houserule-features.md §4 Config Management (JSON)
//
// 範囲: useRaceStore.savePreset / loadPreset / deletePreset / listPresetNames の組合せ動作 +
//       LocalStorage 永続化往復 + state.config.houseRules + state.strategies の完全置換 +
//       設定名バリデーション regression + 既存 race-store 主キー名前空間分離。
//       単体テスト (useRaceStore.test.ts Bundle-11-T1 describe) は actions 個別の網羅、
//       本ファイルは結合面の動作確認に絞る。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRaceStore, PRESET_KEY_PREFIX, PERSIST_NAME } from '../../store/useRaceStore';
import { DEFAULT_STRATEGIES } from '../../core/strategies';
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

describe('Bundle-11-T1 / プリセット管理 統合テスト', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createMockLocalStorage());
        useRaceStore.getState().resetRace();
        // resetRace は strategies をリセットしないため、DEFAULT_STRATEGIES に明示復帰させる
        // (テスト間で前ケースのカスタム脚質が漏れることを防ぐ、Bundle-10-T3 統合テスト同パターン)。
        useRaceStore.setState({
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                dice: { ...s.dice },
                paceModifiers: { ...s.paceModifiers },
            })),
        });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // (19) save → 別設定 → load の往復: houseRules + strategies の完全復元
    it('(19) save → 別設定変更 → load 往復で houseRules + strategies が完全復元される', () => {
        // 保存時: 絆スキル ON + カスタム脚質「カスタム脚質Z」追加
        useRaceStore.getState().updateHouseRules({
            enableBondSkill: true,
            enableSpecialStrategy: true,
            effectValue: 25,
        });
        useRaceStore.getState().addStrategy(
            '逃げ',
            buildCustomStrategy({ fixValue: 50 }),
        );
        useRaceStore.getState().savePreset('完全な設定');

        // 別設定に変更: 全フラグ OFF + カスタム脚質削除
        useRaceStore.getState().updateHouseRules({
            enableBondSkill: false,
            enableSpecialStrategy: false,
            effectValue: 15,
        });
        useRaceStore.getState().removeStrategy('カスタム脚質Z');
        expect(useRaceStore.getState().strategies).toHaveLength(5);
        expect(useRaceStore.getState().config.houseRules.enableBondSkill).toBe(false);

        // 読込で完全復元
        useRaceStore.getState().loadPreset('完全な設定');
        const restored = useRaceStore.getState();
        expect(restored.config.houseRules.enableBondSkill).toBe(true);
        expect(restored.config.houseRules.enableSpecialStrategy).toBe(true);
        expect(restored.config.houseRules.effectValue).toBe(25);
        expect(restored.strategies).toHaveLength(6);
        const custom = restored.strategies.find((s) => s.name === 'カスタム脚質Z');
        expect(custom?.fixValue).toBe(50);
    });

    // (20) save → delete → listPresetNames で削除済が返らない
    it('(20) save → delete → listPresetNames で削除済名が返らない', () => {
        useRaceStore.getState().savePreset('A');
        useRaceStore.getState().savePreset('B');
        useRaceStore.getState().savePreset('C');
        expect(useRaceStore.getState().listPresetNames().sort()).toEqual(['A', 'B', 'C']);
        useRaceStore.getState().deletePreset('B');
        const after = useRaceStore.getState().listPresetNames().sort();
        expect(after).toEqual(['A', 'C']);
    });

    // (21) 同名で 2 回 save → 後者で上書き（同一キー上書き）
    it('(21) 同名で 2 回 save → 後者の内容で上書き', () => {
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        useRaceStore.getState().savePreset('上書きテスト');
        useRaceStore.getState().updateHouseRules({ enableModifier: false });
        useRaceStore.getState().savePreset('上書きテスト');
        // listPresetNames は重複なく 1 件のみ
        expect(useRaceStore.getState().listPresetNames()).toEqual(['上書きテスト']);
        // 読込内容は後者の値
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        useRaceStore.getState().loadPreset('上書きテスト');
        expect(useRaceStore.getState().config.houseRules.enableModifier).toBe(false);
    });

    // (22) 設定名バリデーション regression: 空欄 / 空白のみは save / load / delete すべて no-op
    it('(22) 設定名バリデーション regression: 空欄 / 空白のみは save/load/delete すべて no-op', () => {
        useRaceStore.getState().savePreset('');
        useRaceStore.getState().savePreset('   ');
        useRaceStore.getState().savePreset('\t');
        expect(useRaceStore.getState().listPresetNames()).toEqual([]);
        // load / delete も crash しない
        expect(() => useRaceStore.getState().loadPreset('')).not.toThrow();
        expect(() => useRaceStore.getState().deletePreset('   ')).not.toThrow();
    });

    // (23) 名前空間分離: race-store 主キーと LocalStorage 領域が衝突しない
    it('(23) 名前空間分離: race-store 主キーは listPresetNames に混入しない', () => {
        const mock = globalThis.localStorage as Storage;
        mock.setItem(PERSIST_NAME, '{"some":"persist-data"}');
        mock.setItem('some-other-app', 'foo');
        useRaceStore.getState().savePreset('正規プリセット');
        const names = useRaceStore.getState().listPresetNames();
        expect(names).toEqual(['正規プリセット']);
        // 主キーは保持される（誤って削除されていない）
        expect(mock.getItem(PERSIST_NAME)).toBe('{"some":"persist-data"}');
        // PRESET_KEY_PREFIX の確認
        expect(PRESET_KEY_PREFIX).toBe('race-store-presets:');
    });

    // (24) Unicode / 特殊文字を含む設定名で往復可能
    it('(24) Unicode・特殊文字を含む設定名で save → load 往復可能', () => {
        const specialName = '🏇 my race "set"';
        useRaceStore.getState().updateHouseRules({ enableCompositeUnique: true });
        useRaceStore.getState().savePreset(specialName);
        useRaceStore.getState().updateHouseRules({ enableCompositeUnique: false });
        useRaceStore.getState().loadPreset(specialName);
        expect(useRaceStore.getState().config.houseRules.enableCompositeUnique).toBe(true);
        expect(useRaceStore.getState().listPresetNames()).toEqual([specialName]);
    });
});
