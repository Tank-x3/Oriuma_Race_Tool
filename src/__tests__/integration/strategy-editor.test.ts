// Bundle-10-T3 / CR-SA-12 / 2026-05-11: 脚質エディタ Insert→Edit→Delete 統合テスト。
// 仕様根拠:
//  - modal-houserule.md §2 脚質・ダイステーブル設定 + §Critical Errors
//  - houserule-features.md §1 脚質エディタ (Edit/Insert/Delete/Validation)
//
// 範囲: useRaceStore の addStrategy / updateStrategy / removeStrategy 連動 +
//       isDefaultStrategy 保護 + 永続化 rehydrate + Validation 純粋関数の組合せ動作。
//       単体テスト (validator.test.ts / useRaceStore.test.ts / strategyEditor.helpers.test.ts) は
//       それぞれの責務で網羅済のため、本ファイルは結合面の動作確認に絞る。
import { describe, it, expect, beforeEach } from 'vitest';
import {
    useRaceStore,
    persistPartialize,
    persistMigrate,
} from '../../store/useRaceStore';
import { isDefaultStrategy } from '../../core/strategy.helpers';
import { validateStrategyName, validateDiceFormat } from '../../core/validator';
import { DEFAULT_STRATEGIES } from '../../core/strategies';
import type { Strategy } from '../../types';

const buildCustomStrategy = (overrides: Partial<Strategy> = {}): Strategy => ({
    name: 'カスタム脚質X',
    fixValue: 10,
    dice: { start: '3d6', mid: '3d6', end: '3d6' },
    paceModifiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    ...overrides,
});

describe('Bundle-10-T3 / 脚質エディタ Insert→Edit→Delete 統合テスト', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        // resetRace は strategies をリセットしないため、DEFAULT_STRATEGIES に明示復帰させる
        // (テスト間で前ケースのカスタム脚質が漏れることを防ぐ)。
        useRaceStore.setState({
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                dice: { ...s.dice },
                paceModifiers: { ...s.paceModifiers },
            })),
        });
    });

    // (15) 初期状態 5 デフォルト → カスタム挿入 → 配列 6 件
    it('(15) addStrategy: 初期 5 デフォルト → カスタム挿入で 6 件 + 順序保持', () => {
        const before = useRaceStore.getState().strategies;
        expect(before.length).toBe(5);
        expect(before.map((s) => s.name)).toEqual(['大逃げ', '逃げ', '先行', '差し', '追込']);

        const custom = buildCustomStrategy();
        useRaceStore.getState().addStrategy('逃げ', custom);

        const after = useRaceStore.getState().strategies;
        expect(after.length).toBe(6);
        // 「逃げ」の直後に挿入される (insertAfterName セマンティクス)
        expect(after.map((s) => s.name)).toEqual([
            '大逃げ',
            '逃げ',
            'カスタム脚質X',
            '先行',
            '差し',
            '追込',
        ]);
    });

    // (16) カスタム編集 → 配列内容更新（dice / fixValue / paceModifiers の partial merge）
    // score 再計算発火の実機反映は Bundle-10-Followup-runtime-sync (V1 + 観察事項 B 統合) で対応中のため
    // 本 T3 統合テストでは strategies 配列側の更新のみを検証する (score 再計算自体は
    // ストア単体テスト useRaceStore.test.ts Bundle-10-T1 で網羅済)。
    it('(16) updateStrategy: 内容更新 (dice / fixValue partial merge)', () => {
        useRaceStore.getState().addStrategy('逃げ', buildCustomStrategy({ fixValue: 0 }));

        useRaceStore.getState().updateStrategy('カスタム脚質X', {
            fixValue: 20,
            dice: { start: '2d8', mid: '3d8', end: '4d8' },
        });

        const updated = useRaceStore
            .getState()
            .strategies.find((s) => s.name === 'カスタム脚質X');
        expect(updated).toBeDefined();
        expect(updated?.fixValue).toBe(20);
        expect(updated?.dice).toEqual({ start: '2d8', mid: '3d8', end: '4d8' });
        // partial merge: 渡されていない paceModifiers は維持される
        expect(updated?.paceModifiers).toEqual({
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
        });
    });

    // (17) カスタム削除 → 配列 5 件 + 強制リセット + score 再計算
    it('(17) removeStrategy: カスタム削除で 5 件復帰 + 当該脚質選択 participant の strategy リセット', () => {
        useRaceStore.getState().generateParticipants(2);
        useRaceStore.getState().addStrategy('逃げ', buildCustomStrategy());
        useRaceStore.getState().updateParticipant(
            useRaceStore.getState().participants[0].id,
            { strategy: 'カスタム脚質X' },
        );
        expect(useRaceStore.getState().participants[0].strategy).toBe('カスタム脚質X');

        useRaceStore.getState().removeStrategy('カスタム脚質X');

        const after = useRaceStore.getState().strategies;
        expect(after.length).toBe(5);
        expect(after.find((s) => s.name === 'カスタム脚質X')).toBeUndefined();
        // 削除された脚質を選択していた participant の strategy は空文字に強制リセット
        expect(useRaceStore.getState().participants[0].strategy).toBe('');
    });

    // (18) DEFAULT 5 脚質削除: isDefaultStrategy === true で削除拒否
    it('(18) removeStrategy: DEFAULT 5 脚質は isDefaultStrategy 保護で no-op', () => {
        const before = useRaceStore.getState().strategies;
        expect(isDefaultStrategy('逃げ')).toBe(true);

        useRaceStore.getState().removeStrategy('逃げ');

        const after = useRaceStore.getState().strategies;
        expect(after.length).toBe(before.length);
        expect(after.map((s) => s.name)).toEqual(before.map((s) => s.name));
    });

    // (19) 永続化 regression: addStrategy → partialize → migrate で完全復元
    it('(19) persistence regression: 追加したカスタム脚質が rehydrate 後も保持される', () => {
        useRaceStore.getState().addStrategy('逃げ', buildCustomStrategy({ fixValue: 7 }));
        const original = useRaceStore.getState().strategies;
        expect(original.length).toBe(6);

        const persisted = persistPartialize(useRaceStore.getState());
        const restored = persistMigrate(persisted, 3);

        expect(restored.strategies.length).toBe(6);
        const restoredCustom = restored.strategies.find(
            (s) => s.name === 'カスタム脚質X',
        );
        expect(restoredCustom).toBeDefined();
        expect(restoredCustom?.fixValue).toBe(7);
    });

    // (20) Validation regression: UI 経由相当のガードを純粋関数で検証
    it('(20) Validation regression: 重複名 + 不正ダイス式は純粋関数でブロック判定可能', () => {
        const existingNames = useRaceStore.getState().strategies.map((s) => s.name);

        // 重複名チェック (新規追加モード)
        expect(validateStrategyName('逃げ', existingNames).length).toBe(1);
        expect(validateStrategyName('カスタム脚質X', existingNames).length).toBe(0);

        // 編集モード時の自分自身は除外
        expect(validateStrategyName('逃げ', existingNames, '逃げ').length).toBe(0);

        // 不正ダイス形式
        expect(validateDiceFormat('3+6').length).toBe(1);
        expect(validateDiceFormat('dice3d6').length).toBe(1);

        // 正常ダイス (DEFAULT 大逃げ既存値 -1d27 を含めて許容)
        expect(validateDiceFormat('3d6').length).toBe(0);
        expect(validateDiceFormat('-1d27').length).toBe(0);

        // DEFAULT_STRATEGIES の既存ダイス式は全件 validation を通過する
        for (const s of DEFAULT_STRATEGIES) {
            expect(validateDiceFormat(s.dice.start)).toEqual([]);
            expect(validateDiceFormat(s.dice.mid)).toEqual([]);
            expect(validateDiceFormat(s.dice.end)).toEqual([]);
        }
    });
});
