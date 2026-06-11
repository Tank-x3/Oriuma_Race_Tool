// Bundle-10-Followup-runtime-sync / 2026-05-11: カスタム脚質編集の実機計算反映 統合テスト。
// 仕様根拠:
//  - houserule-features.md §1 脚質エディタ「既存の 5 脚質のパラメータ（固定値・ダイス・paceModifiers）を編集可能」
//  - SSoT: state.strategies が DEFAULT 5 脚質 + カスタム脚質を含む実機計算ソース
//
// 範囲: useRaceStore.updateStrategy / addStrategy + setPaceResult + savePreset/loadPreset 経由で
//       participant.score へ「実機反映」される regression を担保する。
//       単体テスト (strategies.test.ts) は getStrategy / getPaceModifier 直接、
//       本ファイルは useRaceStore の score 再計算フロー全体を end-to-end で検証する。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRaceStore } from '../../store/useRaceStore';
// CR-SA-15-E1 / 2026-05-14: DEFAULT_UNIQUE_DICE_CONFIG = houseRules 型厳密化（uniqueDiceConfig 必須）に追従するため import
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from '../../core/strategies';
import type { DiceResult, Strategy, Umamusume } from '../../types';

const makeDice = (str: string, values: number[]): DiceResult => ({
    diceStr: str,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

const setupParticipant = (override: Partial<Umamusume>): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '大逃げ',
    uniqueSkill: { type: 'Stability', phases: [] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

const installParticipant = (uma: Umamusume) => {
    useRaceStore.setState({
        config: {
            midPhaseCount: 1,
            // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
            startPhaseCount: 1,
            endPhaseCount: 1,
            pacePosition: 'Start',
            fullGateSize: null,
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                // CR-SA-15-E1 / 2026-05-14: houseRules 型厳密化（uniqueDiceConfig 必須）に追従
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
                enablePhaseConfig: false,
                // CR-SA-20-E1 / 2026-06-11: 型定義拡張に追従（9 フィールド）
                enableFormationDice: false,
            },
        },
        participants: [uma],
    });
};

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

describe('Bundle-10-Followup-runtime-sync / カスタム脚質編集実機反映 統合テスト', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        // resetRace は strategies をリセットしないため DEFAULT_STRATEGIES に明示復帰する
        // (Bundle-10-T3 / Bundle-11-T1 統合テスト同パターン)。
        useRaceStore.setState({
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                dice: { ...s.dice },
                paceModifiers: { ...s.paceModifiers },
            })),
        });
    });

    // (7) V1 regression: DEFAULT「大逃げ」を編集 (fixValue 30 → 50) → score 再計算で +20 反映
    it('(7) V1 regression: DEFAULT 大逃げ fixValue 編集が participant.score に即時反映される', () => {
        const startDice = makeDice('3d8', [2, 3, 4]); // sum = 9
        const p = setupParticipant({
            strategy: '大逃げ',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);

        // updateStrategy (同値再代入) で score 再計算を発火 → 編集前 baseline を確定。
        // 大逃げ fixValue 30 + Start dice sum 9 = 39
        useRaceStore.getState().updateStrategy('大逃げ', { fixValue: 30 });
        const before = useRaceStore.getState().participants[0].score;
        expect(before).toBe(39);

        // 大逃げの fixValue を 30 → 50 に編集
        useRaceStore.getState().updateStrategy('大逃げ', { fixValue: 50 });
        const after = useRaceStore.getState().participants[0].score;
        expect(after - before).toBe(20);
        expect(after).toBe(59);
    });

    // (8) 観察事項 B regression: カスタム脚質 paceModifiers が paceRoll 計算に反映される
    it('(8) 観察事項 B regression: カスタム脚質 paceModifiers が participant.score に反映される', () => {
        const custom: Strategy = {
            name: '奇行型',
            fixValue: 0,
            dice: { start: '1d6', mid: '1d6', end: '1d6' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('追込', custom);

        const startDice = makeDice('1d6', [3]); // sum = 3
        const p = setupParticipant({
            strategy: '奇行型',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);
        useRaceStore.getState().setPaceResult(1, 'ドスロー');

        // updateStrategy 経由で paceModifiers={1:15} 設定 + score 再計算発火
        useRaceStore.getState().updateStrategy('奇行型', {
            paceModifiers: { 1: 15 },
        });
        const score = useRaceStore.getState().participants[0].score;
        // fixValue 0 + Start dice 3 + paceModifier(1) 15 = 18
        expect(score).toBe(18);
    });

    // (9) 既存挙動回帰: DEFAULT 5 脚質編集なし + paceModifiers 空 → PACE_MODIFIERS 固定テーブル互換
    it('(9) 既存挙動回帰: DEFAULT 大逃げ paceModifiers 空 → 固定テーブル PACE_MODIFIERS[1] 適用', () => {
        const startDice = makeDice('3d8', [2, 3, 4]); // sum = 9
        const p = setupParticipant({
            strategy: '大逃げ',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);
        useRaceStore.getState().setPaceResult(1, 'ドスロー');

        // updateStrategy (同値再代入) で score 再計算を発火
        useRaceStore.getState().updateStrategy('大逃げ', { fixValue: 30 });
        const score = useRaceStore.getState().participants[0].score;
        // 大逃げ fixValue 30 + Start dice 9 + PACE_MODIFIERS[1]['大逃げ'] 12 = 51
        expect(score).toBe(51);
    });

    // (10) Bundle-11-T1 プリセット連動 regression: 編集済 DEFAULT + カスタム脚質 paceModifiers を含む読込で計算反映
    describe('プリセット連動 regression', () => {
        let mockStorage: ReturnType<typeof createMockLocalStorage>;

        beforeEach(() => {
            mockStorage = createMockLocalStorage();
            vi.stubGlobal('localStorage', mockStorage);
            useRaceStore.getState().resetRace();
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

        it('(10) loadPreset で編集済 DEFAULT + カスタム脚質 paceModifiers を含む復元 → 計算反映', () => {
            // 編集状態を作って保存
            useRaceStore.getState().updateStrategy('大逃げ', { fixValue: 50 });
            useRaceStore.getState().addStrategy('追込', {
                name: '奇行型',
                fixValue: 0,
                dice: { start: '1d6', mid: '1d6', end: '1d6' },
                paceModifiers: { 1: 25 },
            });
            useRaceStore.getState().savePreset('テスト用');

            // 別状態に変更 (DEFAULT に明示復帰)
            useRaceStore.setState({
                strategies: DEFAULT_STRATEGIES.map((s) => ({
                    ...s,
                    dice: { ...s.dice },
                    paceModifiers: { ...s.paceModifiers },
                })),
            });
            expect(useRaceStore.getState().strategies.length).toBe(5);

            // 「奇行型」を選択した participant を installParticipant 後にプリセット読込し、
            // loadPreset 内の score 再計算で paceModifier が反映されるかを確認する。
            const startDice = makeDice('1d6', [0]); // sum = 0
            const p = setupParticipant({
                strategy: '奇行型',
                history: { Start: { baseDice: startDice, computedScore: 0 } },
            });
            installParticipant(p);
            useRaceStore.getState().setPaceResult(1, 'ドスロー');

            useRaceStore.getState().loadPreset('テスト用');

            // 復元確認
            const restored = useRaceStore.getState().strategies;
            const oonige = restored.find((s) => s.name === '大逃げ');
            expect(oonige?.fixValue).toBe(50);
            const kikou = restored.find((s) => s.name === '奇行型');
            expect(kikou).toBeDefined();
            expect(kikou?.paceModifiers).toEqual({ 1: 25 });

            // score 反映確認: fixValue 0 + dice 0 + paceModifier(1) 25 = 25
            const score = useRaceStore.getState().participants[0].score;
            expect(score).toBe(25);
        });
    });
});
