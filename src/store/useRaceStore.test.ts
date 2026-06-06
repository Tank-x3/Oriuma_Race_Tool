import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    useRaceStore,
    persistPartialize,
    persistMigrate,
    handleRehydrateError,
    PERSIST_NAME,
    PERSIST_VERSION,
    PRESET_KEY_PREFIX,
    RESTORE_ERROR_MESSAGE,
    DEFAULT_HOUSE_RULES,
    type PersistedRaceState,
} from './useRaceStore';
import { useNotificationStore } from './useNotificationStore';
import type { DiceResult, GateAssignment, Strategy, Umamusume } from '../types';
import { getActivePhaseIds } from '../core/calculator';
// CR-SA-15-E1 / 2026-05-14: DEFAULT_UNIQUE_DICE_CONFIG = 固有スキル設定の初期値 / マイグレーション補完値
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from '../core/strategies';

// 固有ダイス DiceResult の生成ヘルパー
const makeDice = (str: string, values: number[]): DiceResult => ({
    diceStr: str,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

const setupParticipant = (override: Partial<Umamusume>): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '先行',
    uniqueSkill: { type: 'Stability', phases: ['Mid2'] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

// addParticipant は history / score を破棄するため、テストでは setState で直接注入する。
// 既存テストは Mid1/Mid2 を扱う前提で設計されているため、midPhaseCount=2 を併せてセットする。
// （CR-3 で Calculator が activePhaseIds で絞り込むようになったため、config.midPhaseCount が
//   resetRace 直後の初期値 1 のままだと Mid1/Mid2 が合算から除外されてしまう。）
const installParticipant = (uma: Umamusume) => {
    useRaceStore.setState({
        config: {
            midPhaseCount: 2,
            fullGateSize: null,
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                // Bundle-1 / D-5 / 2026-05-09: 型定義拡張に追従
                enableExtendedUnique: false,
                // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 型定義拡張に追従（6 フィールド）
                enableBondSkill: false,
                effectValue: 15,
                // CR-SA-15-E1 / 2026-05-14: 型定義拡張に追従（7 フィールド）
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
        },
        participants: [uma],
    });
};

describe('useRaceStore.updateParticipant - CR-38 / basic-rules §6 Case 4', () => {
    beforeEach(() => {
        // ストアを初期状態へリセット
        useRaceStore.getState().resetRace();
    });

    it('Scenario 1: 発動フェーズ移動（縮小）で removed フェーズの uniqueDice が削除される', () => {
        const startDice = makeDice('3d5', [3, 4, 3]); // sum 10
        const mid1Dice = makeDice('3d5', [2, 2, 2]); // sum 6
        const mid2Dice = makeDice('3d5', [4, 4, 4]); // sum 12
        const uniqueMid2 = makeDice('1d10', [7]); // 5 (Stability fixed) + 7

        const initial = setupParticipant({
            history: {
                Start: { baseDice: startDice, computedScore: 20 },
                Mid1: { baseDice: mid1Dice, computedScore: 26 },
                Mid2: { baseDice: mid2Dice, uniqueDice: uniqueMid2, computedScore: 50 },
            },
        });

        installParticipant(initial);

        // phases: Mid2 -> Mid1
        useRaceStore.getState().updateParticipant('p1', {
            uniqueSkill: { type: 'Stability', phases: ['Mid1'] },
        });

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid2'].uniqueDice).toBeUndefined();
        // baseDice は維持
        expect(updated.history['Mid2'].baseDice).toEqual(mid2Dice);
        // Mid1 の baseDice も維持（追加フェーズ側は何もしない）
        expect(updated.history['Mid1'].baseDice).toEqual(mid1Dice);
        // score は 固有ダイス分（5 + 7 = 12）が引かれた値に再計算される
        // Strategy 先行: fix 10 + Start 10 + Mid1 6 + Mid2 12 = 38
        expect(updated.score).toBe(38);
    });

    it('Scenario 2: 発動フェーズ全解除で全フェーズの uniqueDice が削除されスコアが固有抜きで再計算される', () => {
        const startDice = makeDice('3d5', [3, 4, 3]); // 10
        const mid1Dice = makeDice('3d5', [2, 2, 2]); // 6
        const mid2Dice = makeDice('3d5', [4, 4, 4]); // 12
        const uniqueMid1 = makeDice('1d10', [8]);
        const uniqueMid2 = makeDice('1d10', [9]);

        const initial = setupParticipant({
            uniqueSkill: { type: 'Stability', phases: ['Mid1', 'Mid2'] },
            history: {
                Start: { baseDice: startDice, computedScore: 20 },
                Mid1: { baseDice: mid1Dice, uniqueDice: uniqueMid1, computedScore: 39 },
                Mid2: { baseDice: mid2Dice, uniqueDice: uniqueMid2, computedScore: 65 },
            },
        });

        installParticipant(initial);

        useRaceStore.getState().updateParticipant('p1', {
            uniqueSkill: { type: 'Stability', phases: [] },
        });

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid1'].uniqueDice).toBeUndefined();
        expect(updated.history['Mid2'].uniqueDice).toBeUndefined();
        // score: fix 10 + 10 + 6 + 12 = 38（固有ダイス + Stability 固定値 5 はすべて除外）
        expect(updated.score).toBe(38);
    });

    it('Scenario 3: manualModifier / baseDice は手動データ保護として維持される', () => {
        const startDice = makeDice('3d5', [3, 4, 3]); // 10
        const mid2Dice = makeDice('3d5', [2, 2, 2]); // 6
        const uniqueMid2 = makeDice('1d10', [4]);

        const initial = setupParticipant({
            history: {
                Start: { baseDice: startDice, computedScore: 20 },
                Mid2: {
                    baseDice: mid2Dice,
                    uniqueDice: uniqueMid2,
                    // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 構造体化（{ value, reason }）
                    manualModifier: { value: 10, reason: '妨害' },
                    specialStrategy: 'Makuri',
                    computedScore: 45,
                },
            },
        });

        installParticipant(initial);

        useRaceStore.getState().updateParticipant('p1', {
            uniqueSkill: { type: 'Stability', phases: ['Mid1'] },
        });

        const updated = useRaceStore.getState().participants[0];
        const mid2 = updated.history['Mid2'];
        expect(mid2.uniqueDice).toBeUndefined();
        expect(mid2.baseDice).toEqual(mid2Dice);
        expect(mid2.manualModifier).toEqual({ value: 10, reason: '妨害' });
        expect(mid2.specialStrategy).toBe('Makuri');
        // score: fix 10 + Start 10 + Mid2 (baseDice 6 + manualModifier.value 10) = 36
        expect(updated.score).toBe(36);
    });

    it('CR-38-E との独立性: midPhaseCount 変更では uniqueSkill.phases は触らない', () => {
        // Scenario: midPhaseCount を 2 -> 1 に変更しても、Mid2 指定の uniqueSkill.phases
        // は EntryForm の useEffect 経由でリセットされるのが本筋であり、
        // setMidPhaseCount 自体では uniqueSkill には触らない（スコープ外）。
        const mid2Dice = makeDice('3d5', [4, 4, 4]); // 12
        const uniqueMid2 = makeDice('1d10', [7]);

        const initial = setupParticipant({
            uniqueSkill: { type: 'Stability', phases: ['Mid2'] },
            history: {
                Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 20 },
                Mid1: { baseDice: makeDice('3d5', [2, 2, 2]), computedScore: 26 },
                Mid2: { baseDice: mid2Dice, uniqueDice: uniqueMid2, computedScore: 50 },
            },
        });

        useRaceStore.setState({
            config: {
                midPhaseCount: 2,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    // Bundle-1 / D-5 / 2026-05-09: 型定義拡張に追従
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 型定義拡張に追従（6 フィールド）
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 型定義拡張に追従（7 フィールド）
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [initial],
        });

        useRaceStore.getState().setMidPhaseCount(1);

        const updated = useRaceStore.getState().participants[0];
        // uniqueSkill.phases はそのまま（独立性確保）
        expect(updated.uniqueSkill.phases).toEqual(['Mid2']);
        // Mid2 の history も保持（Soft Delete）
        expect(updated.history['Mid2'].baseDice).toEqual(mid2Dice);
        expect(updated.history['Mid2'].uniqueDice).toEqual(uniqueMid2);
    });

    it('保護: phases に変更がなければ history も score も触らない', () => {
        const startDice = makeDice('3d5', [3, 4, 3]);
        const uniqueStart = makeDice('1d10', [5]);

        const initial = setupParticipant({
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            score: 999, // 既存値が温存されることを確認
            history: {
                Start: {
                    baseDice: startDice,
                    uniqueDice: uniqueStart,
                    computedScore: 30,
                },
            },
        });

        installParticipant(initial);

        // 名前のみ変更（uniqueSkill は updates に含めない）
        useRaceStore.getState().updateParticipant('p1', { name: 'Renamed' });

        const updated = useRaceStore.getState().participants[0];
        expect(updated.name).toBe('Renamed');
        expect(updated.history['Start'].uniqueDice).toEqual(uniqueStart);
        // score は再計算されず元の値が温存される
        expect(updated.score).toBe(999);
    });
});

describe('getActivePhaseIds - CR-3 / scene1-setup.md §4', () => {
    it('midPhaseCount = 0: 中盤フェーズなし', () => {
        expect(getActivePhaseIds(0)).toEqual(['Start', 'End']);
    });

    it('midPhaseCount = 1: 中盤は単に "Mid"', () => {
        expect(getActivePhaseIds(1)).toEqual(['Start', 'Mid', 'End']);
    });

    it('midPhaseCount = 2: "Mid1", "Mid2" でナンバリング', () => {
        expect(getActivePhaseIds(2)).toEqual(['Start', 'Mid1', 'Mid2', 'End']);
    });

    it('midPhaseCount = 4: 仕様上の最大値', () => {
        expect(getActivePhaseIds(4)).toEqual(['Start', 'Mid1', 'Mid2', 'Mid3', 'Mid4', 'End']);
    });
});

describe('useRaceStore.setMidPhaseCount - CR-3 / scene1-setup.md §4 Soft Delete', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    // midPhaseCount = 2 の状態で Mid1 / Mid2 にダイス履歴がある参加者を注入するヘルパー
    const installParticipantWithMid2History = () => {
        const startDice = makeDice('3d8', [3, 4, 3]); // 10
        const mid1Dice = makeDice('3d5', [2, 2, 2]); // 6
        const mid2Dice = makeDice('3d5', [4, 4, 4]); // 12
        const endDice = makeDice('1d7', [3]); // 3

        const initial: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: [] }, // 固有ダイスは別軸（CR-38-E）なので本テストでは無効化
            gate: 1,
            score: 0,
            history: {
                Start: { baseDice: startDice, computedScore: 20 },
                Mid1: { baseDice: mid1Dice, computedScore: 26 },
                Mid2: { baseDice: mid2Dice, computedScore: 50 },
                End: { baseDice: endDice, computedScore: 53 },
            },
        };

        useRaceStore.setState({
            config: {
                midPhaseCount: 2,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    // Bundle-1 / D-5 / 2026-05-09: 型定義拡張に追従
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 型定義拡張に追従（6 フィールド）
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 型定義拡張に追従（7 フィールド）
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [initial],
        });

        return { startDice, mid1Dice, mid2Dice, endDice };
    };

    it('Scenario 1: 2 -> 1 で Mid2 の history は保持、score は Mid2 を除外した値に再計算される', () => {
        const { mid2Dice } = installParticipantWithMid2History();

        useRaceStore.getState().setMidPhaseCount(1);

        const updated = useRaceStore.getState().participants[0];

        // history は Soft Delete（削除せず保持）
        expect(updated.history['Mid2']).toBeDefined();
        expect(updated.history['Mid2'].baseDice).toEqual(mid2Dice);

        // config は更新
        expect(useRaceStore.getState().config.midPhaseCount).toBe(1);

        // score: fix 10 + Start 10 + Mid1 6 + End 3 = 29（Mid2 12 を除外）
        // ただし activePhaseIds = ['Start', 'Mid', 'End']、Mid1 は含まれないので実際は Mid1 も除外
        // Mid1 を除外するか含めるかは midPhaseCount=1 時の仕様：「中盤」は単一フェーズ ID「Mid」
        // であり、データは Mid1 に残っているため合算されない（＝ユーザーは Mid1 のデータを
        // Mid に再貼り付けするか、2 に戻して復元する運用になる）。
        // よって: fix 10 + Start 10 + End 3 = 23
        expect(updated.score).toBe(23);
    });

    it('Scenario 2: 2 -> 1 -> 2 で Mid2 の history が自動復活し合算に戻る', () => {
        installParticipantWithMid2History();

        // 2 -> 1
        useRaceStore.getState().setMidPhaseCount(1);
        const afterShrink = useRaceStore.getState().participants[0];
        expect(afterShrink.history['Mid2']).toBeDefined(); // Soft Delete で保持

        // 1 -> 2（復元）
        useRaceStore.getState().setMidPhaseCount(2);
        const restored = useRaceStore.getState().participants[0];

        // history は引き続き保持されており、score が Mid1 + Mid2 を含む値に復帰
        expect(restored.history['Mid2']).toBeDefined();
        // fix 10 + Start 10 + Mid1 6 + Mid2 12 + End 3 = 41
        expect(restored.score).toBe(41);
    });

    it('Scenario 3: 同じ値への再設定（no-op）でも history / 参加者構造は破壊されない', () => {
        const { mid1Dice, mid2Dice } = installParticipantWithMid2History();

        useRaceStore.getState().setMidPhaseCount(2);

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid1'].baseDice).toEqual(mid1Dice);
        expect(updated.history['Mid2'].baseDice).toEqual(mid2Dice);
        // fix 10 + Start 10 + Mid1 6 + Mid2 12 + End 3 = 41
        expect(updated.score).toBe(41);
    });

    it('Scenario 4: midPhaseCount = 0 へ変更で全ての中盤 history が合算除外される', () => {
        installParticipantWithMid2History();

        useRaceStore.getState().setMidPhaseCount(0);

        const updated = useRaceStore.getState().participants[0];
        // history は保持
        expect(updated.history['Mid1']).toBeDefined();
        expect(updated.history['Mid2']).toBeDefined();
        // score: fix 10 + Start 10 + End 3 = 23
        expect(updated.score).toBe(23);
    });
});

describe('useRaceStore.moveToGate - CR-3 / #1-3a-3 名前空欄行スキップ', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    it('moveToGate 時、名前空欄の参加者は participants から除外される', () => {
        const make = (id: string, name: string): Umamusume => ({
            id,
            entryIndex: 0,
            name,
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: null,
            score: 0,
            history: {},
        });

        useRaceStore.setState({
            participants: [
                make('p1', 'タンク'),
                make('p2', '  '),     // trim で空になる空白のみの行
                make('p3', 'タンク2'),
                make('p4', ''),       // 完全な空欄
            ],
        });

        useRaceStore.getState().moveToGate();

        const after = useRaceStore.getState().participants;
        expect(after.map(p => p.id)).toEqual(['p1', 'p3']);
        expect(useRaceStore.getState().uiState.scene).toBe('gate');
    });
});

describe('CR-5a: zustand persist 設定', () => {
    it('persistPartialize: uiState.isParsingInput を除外し、その他全フィールドを含める', () => {
        const fullState = useRaceStore.getState();
        // isParsingInput を意図的に true にしても partialize 出力は scene のみで除外される
        const stateWithParsing = {
            ...fullState,
            uiState: { scene: 'race' as const, isParsingInput: true },
        };

        const partialized = persistPartialize(stateWithParsing);

        // CR-SA-16-E1 / 2026-05-15: appliedPresetName / isPresetDirty 永続化対象拡張に追従
        // （§4 案 X1 = 既存テスト構造的検証への期待値追加は DoD 内対応）
        expect(partialized).toEqual({
            config: fullState.config,
            participants: fullState.participants,
            currentPhaseId: fullState.currentPhaseId,
            paceResult: fullState.paceResult,
            strategies: fullState.strategies,
            gateAssignments: fullState.gateAssignments,
            appliedPresetName: fullState.appliedPresetName,
            isPresetDirty: fullState.isPresetDirty,
            uiState: { scene: 'race' },
        });
        // uiState.isParsingInput が確実に除外されていること
        expect((partialized.uiState as { isParsingInput?: boolean }).isParsingInput).toBeUndefined();
    });

    it('persistPartialize: actions（function）が永続化対象から除外される', () => {
        const fullState = useRaceStore.getState();
        const partialized = persistPartialize(fullState);

        // partialize の戻り値に function 系のアクションが含まれていないこと
        const partializedKeys = Object.keys(partialized);
        expect(partializedKeys).not.toContain('setMidPhaseCount');
        expect(partializedKeys).not.toContain('resetRace');
        expect(partializedKeys).not.toContain('moveToGate');
        // CR-SA-16-E1 / 2026-05-15: appliedPresetName / isPresetDirty 永続化対象拡張に追従
        // （§4 案 X1 = 既存テスト構造的検証への期待値追加は DoD 内対応）
        expect(partializedKeys.sort()).toEqual([
            'appliedPresetName',
            'config',
            'currentPhaseId',
            'gateAssignments',
            'isPresetDirty',
            'paceResult',
            'participants',
            'strategies',
            'uiState',
        ]);
    });

    it('PERSIST_VERSION / PERSIST_NAME: 想定値が export されている', () => {
        // Bundle-7 / P4-6 / 2026-05-10: 1 → 2 にバンプ
        // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 2 → 3 にバンプ
        // CR-SA-15-E1 / 2026-05-14: 3 → 4 にバンプ
        // CR-SA-16-E1 / 2026-05-15: 4 → 5 にバンプ（§4 案 X1 = 期待値追加は DoD 内対応）
        // CR-SA-19 / 2026-06-06: 5 → 6 にバンプ（uniqueDiceConfig 旧 5 キー → 新 7 キー補完）
        expect(PERSIST_VERSION).toBe(6);
        expect(PERSIST_NAME).toBe('race-store');
    });

    it('persistMigrate: version=3 データは uniqueDiceConfig 補完で通過する（基本動作）', () => {
        // Bundle-7 / 2026-05-10: 旧 passthrough テストを「正常な version=2 データの通過」テストに書き換え
        // Bundle-8-T1 / 2026-05-10: enableBondSkill 追加（6 フィールド）に伴い version=3 データ通過テストへ更新
        // CR-SA-15-E1 / 2026-05-14: PERSIST_VERSION 3→4 バンプに伴い、version=3 旧データ（uniqueDiceConfig 欠落）は
        // DEFAULT_HOUSE_RULES マージ + houseRulesSchema.default() で uniqueDiceConfig がデフォルト補完されて通過する
        const validPersisted = {
            config: {
                midPhaseCount: 3,
                fullGateSize: 12,
                houseRules: {
                    enableModifier: true,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: false,
                    effectValue: 15,
                },
            },
            participants: [{ id: 'old', name: 'legacy' }],
            currentPhaseId: 'Mid1',
            paceResult: { face: 5, label: 'Slow' },
            strategies: [],
            uiState: { scene: 'race' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(validPersisted, 3);

        // CR-SA-15-E1 / 2026-05-14: 既存 6 フィールドはそのまま、uniqueDiceConfig がデフォルト補完されて通過
        expect(result.config.houseRules).toEqual({
            ...validPersisted.config.houseRules,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
        // その他フィールドも保持される
        expect(result.config.midPhaseCount).toBe(3);
        expect(result.currentPhaseId).toBe('Mid1');
    });

    it('handleRehydrateError: error 引数があれば useNotificationStore に error 通知を追加', () => {
        // notification store をクリア
        useNotificationStore.setState({ notifications: [] });

        handleRehydrateError(new Error('JSON parse failed'));

        const notifications = useNotificationStore.getState().notifications;
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('error');
        expect(notifications[0].message).toBe(RESTORE_ERROR_MESSAGE);

        // 後続テストへの影響回避
        useNotificationStore.setState({ notifications: [] });
    });

    it('handleRehydrateError: error が undefined のときは通知を追加しない', () => {
        useNotificationStore.setState({ notifications: [] });

        handleRehydrateError(undefined);

        const notifications = useNotificationStore.getState().notifications;
        expect(notifications).toHaveLength(0);
    });
});

describe('CR-5a-2: gateAssignments ストア昇格', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    it('setGateAssignments: 配列値で上書き保存できる', () => {
        const value: GateAssignment[] = [
            { id: 'p1', roll: 42, gate: 1 },
            { id: 'p2', roll: 77, gate: 2 },
        ];

        useRaceStore.getState().setGateAssignments(value);

        expect(useRaceStore.getState().gateAssignments).toEqual(value);
    });

    it('setGateAssignments: null で前回保存値をクリアできる（解析失敗時の挙動）', () => {
        useRaceStore.getState().setGateAssignments([{ id: 'p1', roll: 5, gate: 1 }]);
        expect(useRaceStore.getState().gateAssignments).not.toBeNull();

        useRaceStore.getState().setGateAssignments(null);

        expect(useRaceStore.getState().gateAssignments).toBeNull();
    });

    it('resetRace: gateAssignments を null にリセットする（houserule-features.md §4.5）', () => {
        useRaceStore.getState().setGateAssignments([
            { id: 'p1', roll: 12, gate: 1 },
            { id: 'p2', roll: 34, gate: 2 },
        ]);
        expect(useRaceStore.getState().gateAssignments).not.toBeNull();

        useRaceStore.getState().resetRace();

        expect(useRaceStore.getState().gateAssignments).toBeNull();
    });

    it('persistPartialize: gateAssignments を保存対象に含める（中間状態の永続化、houserule-features.md §4.2 #6）', () => {
        const value: GateAssignment[] = [
            { id: 'p1', roll: 88, gate: 1 },
            { id: 'p2', roll: 55, gate: 2 },
        ];
        useRaceStore.getState().setGateAssignments(value);

        const partialized = persistPartialize(useRaceStore.getState());

        expect(partialized.gateAssignments).toEqual(value);
    });

    it('フォールバック条件: gateAssignments == null かつ participants[].gate != null の状態を保てる（Scene 3 以降からの戻り経路 / 旧データ復元、scene2-gate.md §3 復元優先順位 (2)）', () => {
        // Scene 2 で確定 → Scene 3 へ進み participants[].gate に値が入った後、
        // 何らかの遷移で gateAssignments のみが先にリセットされた想定。
        // GateScene 側のフォールバック再構築ロジック（既存 line 22-37 由来）が
        // 起動できる状態の組み合わせがストアで成立していることを確認する。
        useRaceStore.setState({
            participants: [
                {
                    id: 'p1', entryIndex: 1, name: 'A',
                    strategy: '先行',
                    uniqueSkill: { type: 'Stability', phases: ['Start'] },
                    gate: 1, score: 0, history: {},
                },
                {
                    id: 'p2', entryIndex: 2, name: 'B',
                    strategy: '先行',
                    uniqueSkill: { type: 'Stability', phases: ['Start'] },
                    gate: 2, score: 0, history: {},
                },
            ],
            gateAssignments: null,
        });

        const state = useRaceStore.getState();
        expect(state.gateAssignments).toBeNull();
        expect(state.participants.some(p => p.gate !== null)).toBe(true);
    });
});

// Bundle-6 / P4-4 + CR-19 / 2026-05-10: 仕様 scene3-race.md §6「完全な状態復元」準拠で
// CR-8 由来の revertPhaseHistory action は完全削除した。本 describe は「戻る操作で
// 何も消えない（history / paceResult / specialStrategy / manualModifier 全保持）」を
// store level で保証する新 describe（store action 自体が消えたため、戻り操作の代替経路 =
// useRaceEngine.prevPhase の単純 setCurrentPhase 経由のシナリオを直接 store に対して検証）。
describe('useRaceStore - Bundle-6 / scene3-race.md §6 完全な状態復元', () => {
    // resetRace は houseRules を保持する設計のため、Bundle-9 describe と同パターンで
    // 明示的に初期値へ戻す。afterEach も併用し次 describe への houseRules 状態リーク防止。
    const resetHouseRules = () => {
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 15,
        });
    };
    beforeEach(resetHouseRules);
    afterEach(resetHouseRules);

    const installForPreserve = (
        midPhaseCount: number,
        paceFace: number | null,
        history: Umamusume['history'],
        houseRulesOverride: Partial<{
            enableModifier: boolean;
            enableSpecialStrategy: boolean;
            enableCompositeUnique: boolean;
            enableExtendedUnique: boolean;
            enableBondSkill: boolean;
            effectValue: number;
        }> = {}
    ): Umamusume => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行', // fixValue 10
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 0,
            history,
        };
        useRaceStore.setState({
            config: {
                midPhaseCount,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 7 フィールドに拡張（override より前に置きデフォルトを基底とする）
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                    ...houseRulesOverride,
                },
            },
            participants: [uma],
            paceResult:
                paceFace === null
                    ? { face: null, label: null }
                    : { face: paceFace, label: 'Test' },
        });
        return uma;
    };

    it('(i) End → Mid 戻り（setCurrentPhase のみ）: history.End が保持される', () => {
        installForPreserve(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });

        // Bundle-6: 戻る操作 = setCurrentPhase のみ（history 操作なし）
        useRaceStore.getState().setCurrentPhase('Mid');

        const updated = useRaceStore.getState().participants[0];
        // history は完全保持
        expect(updated.history['End']).toBeDefined();
        expect(updated.history['End']?.baseDice?.sum).toBe(5);
        expect(updated.history['Mid']).toBeDefined();
        expect(updated.history['Start']).toBeDefined();
        // score 自動再計算なし（history が変わらない）
        expect(updated.score).toBe(0);
    });

    it('(ii) Mid → Pace 戻り: paceResult が保持される', () => {
        installForPreserve(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });
        useRaceStore.setState({ currentPhaseId: 'Mid' });

        useRaceStore.getState().setCurrentPhase('Pace');

        const state = useRaceStore.getState();
        // paceResult は完全保持（Bundle-6 = 仕様 §6 完全な状態復元）
        expect(state.paceResult.face).toBe(5);
        expect(state.paceResult.label).toBe('Test');
        // history も保持
        expect(state.participants[0].history['Mid']).toBeDefined();
    });

    it('(iii) 戦法 ON 状態で戻る: history.Mid.specialStrategy が保持される', () => {
        installForPreserve(
            1,
            5,
            {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            },
            { enableSpecialStrategy: true }
        );
        useRaceStore.setState({ currentPhaseId: 'Mid' });
        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');

        // 戻る操作 = setCurrentPhase のみ
        useRaceStore.getState().setCurrentPhase('Pace');

        const updated = useRaceStore.getState().participants[0];
        // specialStrategy 完全保持
        expect(updated.history['Mid']?.specialStrategy).toBe('Makuri');
        // score もそのまま（setCurrentPhase は score 再計算しない）
        // 28 (Mid baseDice) + 15 (Makuri 即時) = 43
        expect(updated.score).toBe(43);
    });

    it('(iv) 補正値設定状態で戻る: history.Mid.manualModifier が保持される', () => {
        installForPreserve(
            1,
            5,
            {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            },
            { enableModifier: true }
        );
        useRaceStore.setState({ currentPhaseId: 'Mid' });
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');

        useRaceStore.getState().setCurrentPhase('Pace');

        const updated = useRaceStore.getState().participants[0];
        // manualModifier 完全保持
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
        // 28 + 5 (補正) = 33
        expect(updated.score).toBe(33);
    });

    it('(v) ダイス解析後に戻る: baseDice / uniqueDice / computedScore が保持される', () => {
        const midDice = makeDice('3d5', [3, 3, 2]);
        const uniqueDice = makeDice('1d6', [4]);
        installForPreserve(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: midDice, uniqueDice, computedScore: 32 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });

        useRaceStore.getState().setCurrentPhase('Mid');

        const updated = useRaceStore.getState().participants[0];
        // ダイス解析データ完全保持
        expect(updated.history['Mid']?.baseDice).toEqual(midDice);
        expect(updated.history['Mid']?.uniqueDice).toEqual(uniqueDice);
        expect(updated.history['Mid']?.computedScore).toBe(32);
    });

    it('(vi) 戻った後に再進行: 保持されていた score と整合する', () => {
        installForPreserve(
            1,
            5,
            {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            },
            { enableModifier: true }
        );
        useRaceStore.setState({ currentPhaseId: 'End' });
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        // この時点 score = 33

        // 戻る → 再進行
        useRaceStore.getState().setCurrentPhase('Mid');
        useRaceStore.getState().setCurrentPhase('End');

        const updated = useRaceStore.getState().participants[0];
        // history と score が保持されたまま End に戻ってくる
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
        expect(updated.score).toBe(33);
    });

    it('(vii) 戻った後に手動でダイス再貼付け（updateParticipant）: 当該 history が上書きされる', () => {
        installForPreserve(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });

        // 戻る
        useRaceStore.getState().setCurrentPhase('Mid');

        // 手動でダイス再貼付け（PhaseInput 解析実行経路）
        const newMidDice = makeDice('3d5', [4, 4, 4]); // sum 12
        useRaceStore.getState().updateParticipant('p1', {
            history: {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: newMidDice, computedScore: 32 },
            },
        });

        const updated = useRaceStore.getState().participants[0];
        // 当該 history が上書きされる（ユーザー意識的操作で消す経路）
        expect(updated.history['Mid']?.baseDice?.sum).toBe(12);
    });

    it('(viii) 連続戻り（End → Mid → Pace → Start）: すべての history が保持される', () => {
        installForPreserve(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });

        useRaceStore.getState().setCurrentPhase('Mid');
        useRaceStore.getState().setCurrentPhase('Pace');
        useRaceStore.getState().setCurrentPhase('Start');

        const state = useRaceStore.getState();
        const updated = state.participants[0];
        // すべて完全保持
        expect(updated.history['Start']).toBeDefined();
        expect(updated.history['Mid']).toBeDefined();
        expect(updated.history['End']).toBeDefined();
        expect(state.paceResult.face).toBe(5);
        expect(state.currentPhaseId).toBe('Start');
    });

    it('(ix) revertPhaseHistory action 不存在保証: store API surface から削除されている', () => {
        // Bundle-6 で完全削除されたことの regression guard
        const store = useRaceStore.getState() as unknown as Record<string, unknown>;
        expect(store.revertPhaseHistory).toBeUndefined();
    });

    it('(x) 戻った先で個別 action による消去経路: clearManualModifier で当該 phase の補正のみ消える', () => {
        // Bundle-6 ユーザー視点: 戻り操作は何も消さない → やり直したい場合は戻り先で
        // 個別 action を呼ぶ運用。clearManualModifier の単独呼び出しで Mid 補正のみクリアされ、
        // 他 phase の history（Start.baseDice, End.specialStrategy 等）には影響しないことを保証。
        installForPreserve(
            1,
            5,
            {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
                End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
            },
            { enableModifier: true, enableSpecialStrategy: true }
        );
        useRaceStore.setState({ currentPhaseId: 'End' });
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        useRaceStore.getState().setSpecialStrategy('p1', 'End', 'Tame');

        // 戻り後に Mid の補正のみクリア
        useRaceStore.getState().setCurrentPhase('Mid');
        useRaceStore.getState().clearManualModifier('p1', 'Mid');

        const updated = useRaceStore.getState().participants[0];
        // Mid の補正のみ消える、specialStrategy / 他 phase は保持
        expect(updated.history['Mid']?.manualModifier).toBeUndefined();
        expect(updated.history['Mid']?.baseDice?.sum).toBe(8);
        expect(updated.history['End']?.specialStrategy).toBe('Tame');
        expect(updated.history['Start']).toBeDefined();
    });
});

describe('Bundle-1 / D-5 / 2026-05-09 houseRules 拡張フィールドの初期値検証', () => {
    it('houseRules 初期値: enableExtendedUnique === false, effectValue === 15（houserule-features.md §3 デフォルト由来）', () => {
        const houseRules = useRaceStore.getState().config.houseRules;
        // Bundle-1 で追加された 2 フィールドの初期値検証
        expect(houseRules.enableExtendedUnique).toBe(false);
        expect(houseRules.effectValue).toBe(15);
        // 既存 3 フィールドの regression guard
        expect(houseRules.enableModifier).toBe(false);
        expect(houseRules.enableSpecialStrategy).toBe(false);
        expect(houseRules.enableCompositeUnique).toBe(false);
    });
});

// Bundle-9 / 2026-05-10: updateHouseRules action（5 フィールド部分更新）
describe('Bundle-9 / 2026-05-10 useRaceStore.updateHouseRules', () => {
    beforeEach(() => {
        // resetRace は houseRules を保持する設計（ハウスルールはレース間で維持される）ため、
        // テスト間の状態リーク防止に明示的に初期値へ戻す
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 15,
        });
    });

    it('単一フィールド更新: enableModifier のみ true、他 4 フィールドは初期値維持', () => {
        useRaceStore.getState().updateHouseRules({ enableModifier: true });

        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.enableModifier).toBe(true);
        expect(houseRules.enableSpecialStrategy).toBe(false);
        expect(houseRules.enableCompositeUnique).toBe(false);
        expect(houseRules.enableExtendedUnique).toBe(false);
        expect(houseRules.effectValue).toBe(15);
    });

    it('複数フィールド同時更新: enableSpecialStrategy + effectValue 同時変更、他 3 フィールドは初期値維持', () => {
        useRaceStore.getState().updateHouseRules({
            enableSpecialStrategy: true,
            effectValue: 20,
        });

        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.enableSpecialStrategy).toBe(true);
        expect(houseRules.effectValue).toBe(20);
        expect(houseRules.enableModifier).toBe(false);
        expect(houseRules.enableCompositeUnique).toBe(false);
        expect(houseRules.enableExtendedUnique).toBe(false);
    });

    it('連続呼び出しで累積更新: enableModifier → enableExtendedUnique で 2 フィールドが両方 true', () => {
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        useRaceStore.getState().updateHouseRules({ enableExtendedUnique: true });

        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.enableModifier).toBe(true);
        expect(houseRules.enableExtendedUnique).toBe(true);
        // 中間で更新されなかったフィールドは初期値維持
        expect(houseRules.enableSpecialStrategy).toBe(false);
        expect(houseRules.enableCompositeUnique).toBe(false);
        expect(houseRules.effectValue).toBe(15);
    });
});

// Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法 setSpecialStrategy + updateHouseRules effectValue 連動
describe('Bundle-4 / P4-1, P4-5 / 2026-05-10 useRaceStore.setSpecialStrategy', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: false,
            enableSpecialStrategy: true,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 15,
        });
    });

    // setSpecialStrategy 専用の参加者注入ヘルパー（Mid1 まで進行している前提）
    const installForStrategy = (history: Umamusume['history'] = {}) => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行', // fixValue 10
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 0,
            history,
        };
        useRaceStore.setState({
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 7 フィールドに拡張
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [uma],
            currentPhaseId: 'Mid',
            paceResult: { face: 5, label: 'Test' }, // 先行 中立
        });
    };

    it('(i) Makuri 設定 → score に +effectValue 加算 + history.specialStrategy === "Makuri"', () => {
        // 先行 fix 10 + Start 10 + Mid 8 + paceMod 0 = 28
        installForStrategy({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.specialStrategy).toBe('Makuri');
        // 28 + 15 (Makuri 即時) = 43
        expect(updated.score).toBe(43);
    });

    it('(ii) Tame 設定 → score に -effectValue 減算', () => {
        installForStrategy({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Tame');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.specialStrategy).toBe('Tame');
        // 28 + (-15) = 13
        expect(updated.score).toBe(13);
    });

    it('(iii) null 設定（取り消し）→ score が元の値に戻る + specialStrategy === null', () => {
        installForStrategy({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        // 一度 Makuri 設定 → 取り消し
        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');
        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', null);

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.specialStrategy).toBeNull();
        // 28（補正なし）
        expect(updated.score).toBe(28);
    });

    it('(iv) 終盤到達後（history.End あり）の Makuri = 反動相殺で delta = 0', () => {
        // Start 10 + Mid 8 + End 5 + paceMod 0 = 33
        installForStrategy({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });

        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');

        const updated = useRaceStore.getState().participants[0];
        // 33 + 15 (Mid 即時) + (-15) (End 反動) = 33
        expect(updated.score).toBe(33);
        expect(updated.history['Mid']?.specialStrategy).toBe('Makuri');
    });

    it('(v-pre) Bundle-4-Followup-E1 / 2026-05-12: 解析未実行（baseDice なし）で Makuri 設定 → score = 0（事前操作 + 結果取り込み前 = score 不変）', () => {
        // Bundle-4 ENG28 ユーザー報告（Round 2）当時: 「差し脚質で戦法 ON 時に +20 表示、ダイス出力は +15」
        // ENG28 修正: 解析未実行（baseDice/uniqueDice/manualModifier いずれも未投入）の history を score 計算から除外
        //   → 旧仕様では「effectValue のみ加算」（score = 15）の挙動。
        // Bundle-4-Followup-E1 / 2026-05-12 (SA21 案 A 採択): 効果値の score 反映タイミング統一。
        //   発動 phase が結果取り込み済の場合のみ effectValue を delta に加算する形に
        //   `computeSpecialStrategyTotalDelta` を改修。事前操作 + 結果取り込み前 = delta 0 = score 不変。
        //   → 新仕様では「effectValue も加算されない」（score = 0）の挙動。
        installForStrategy({}); // 解析未実行（history 全空）
        useRaceStore.setState({ currentPhaseId: 'Start' });

        useRaceStore.getState().setSpecialStrategy('p1', 'Start', 'Makuri');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Start']?.specialStrategy).toBe('Makuri');
        // Bundle-4-Followup-E1: 0（解析未実行 = 結果取り込み前 → fixValue + effectValue いずれも加算なし）
        // 旧 ENG28 仕様では 15（effectValue のみ即時加算）、二重加算誤認リスク解消のため本 E1 で挙動変更
        expect(updated.score).toBe(0);
    });

    it('(v) Bundle-6 戻る操作（setCurrentPhase のみ）で history.End が保持される → 終盤反動も維持', () => {
        // Bundle-6 / 2026-05-10: CR-8 由来 revertPhaseHistory を完全削除し、戻る操作で
        // history を一切削除しない仕様（scene3-race.md §6 完全な状態復元）。
        // 終盤反動も history.End 保持のため維持される。
        installForStrategy({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
        });
        useRaceStore.setState({ currentPhaseId: 'End' });
        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');
        // この時点 score = 33（相殺、Mid 即時 +15 + End 反動 -15）

        // Bundle-6 戻る操作 = setCurrentPhase のみ（history は完全保持）
        useRaceStore.getState().setCurrentPhase('Mid');

        const updated = useRaceStore.getState().participants[0];
        // history.End 保持 → 反動も維持。score は 33 のまま
        expect(updated.score).toBe(33);
        expect(updated.history['Mid']?.specialStrategy).toBe('Makuri');
        // Bundle-6 / 2026-05-10: history.End は完全保持される（CR-8 削除 → Bundle-6 保持に逆転）
        expect(updated.history['End']).toBeDefined();
        expect(updated.history['End']?.baseDice?.sum).toBe(5);
    });
});

describe('Bundle-4 / P4-1, P4-5 / 2026-05-10 useRaceStore.updateHouseRules effectValue 連動再計算', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: false,
            enableSpecialStrategy: true,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 15,
        });
    });

    it('(i) effectValue 変更時、specialStrategy 設定済参加者の score が新値で再計算される', () => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 0,
            history: {
                Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
                Mid: { baseDice: makeDice('3d5', [3, 3, 2]), specialStrategy: 'Makuri', computedScore: 28 },
            },
        };
        useRaceStore.setState({
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 7 フィールドに拡張
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [uma],
            currentPhaseId: 'Mid',
            paceResult: { face: 5, label: 'Test' },
        });

        // effectValue 15 → 30 に変更
        useRaceStore.getState().updateHouseRules({ effectValue: 30 });

        const updated = useRaceStore.getState().participants[0];
        // fix 10 + Start 10 + Mid 8 + paceMod 0 + Makuri 即時 30 = 58
        expect(updated.score).toBe(58);
        expect(useRaceStore.getState().config.houseRules.effectValue).toBe(30);
    });

    it('(ii) effectValue 以外のフィールド変更時は score 再計算しない（最適化）', () => {
        // specialStrategy 設定済かつ score が「正しくない」状態でも、effectValue が変わらなければ score は触らない
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 999, // 意図的にズレた値
            history: {
                Mid: { specialStrategy: 'Makuri', computedScore: 0 },
            },
        };
        useRaceStore.setState({ participants: [uma] });

        useRaceStore.getState().updateHouseRules({ enableModifier: true });

        // score は再計算されず 999 のまま
        expect(useRaceStore.getState().participants[0].score).toBe(999);
    });
});

// Bundle-7 / P4-6 / 2026-05-10:
// persistMigrate の version=1 → 2 デフォルト補完 + zod 検証統合の検証。
// houserule-features.md §4 zod 検証範囲表に基づく検証経路と RESTORE_ERROR_MESSAGE 通知経路を担保。
describe('Bundle-7 / P4-6 / 2026-05-10 persistMigrate (zod 検証 + デフォルト補完)', () => {
    const baseValid = {
        config: {
            midPhaseCount: 1,
            fullGateSize: null,
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
                enableBondSkill: false,
                effectValue: 15,
            },
        },
        participants: [],
        currentPhaseId: 'setup',
        paceResult: { face: null, label: null },
        strategies: [],
        gateAssignments: null,
        uiState: { scene: 'setup' },
    } as unknown as PersistedRaceState;

    it('(i) version=1 旧データ（enableExtendedUnique / effectValue 欠落）→ デフォルト補完 + 既存 3 フィールド維持', () => {
        const oldPersisted = {
            ...baseValid,
            config: {
                midPhaseCount: 2,
                fullGateSize: 18,
                houseRules: {
                    enableModifier: true,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: false,
                    // Bundle-1 で追加された 2 フィールドが旧データには存在しない
                },
            },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(oldPersisted, 1);

        // Bundle-8-T1 / 2026-05-10: 補完済の 6 フィールド構造になる（enableBondSkill 追加）
        // CR-SA-15-E1 / 2026-05-14: uniqueDiceConfig 追加で 7 フィールド構造になる
        expect(result.config.houseRules).toEqual({
            enableModifier: true,
            enableSpecialStrategy: true,
            enableCompositeUnique: false,
            enableExtendedUnique: false, // デフォルト補完
            enableBondSkill: false, // Bundle-8-T1 デフォルト補完
            effectValue: 15, // デフォルト補完
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG, // CR-SA-15-E1 デフォルト補完
        });
        // 既存フィールドは維持
        expect(result.config.midPhaseCount).toBe(2);
        expect(result.config.fullGateSize).toBe(18);
    });

    it('(ii) houseRules 自体が undefined → デフォルト 6 フィールドで補完', () => {
        const noHouseRules = {
            ...baseValid,
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                // houseRules フィールド自体が無い極端ケース
            },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(noHouseRules, 1);

        // Bundle-8-T1 / 2026-05-10: デフォルト補完は 6 フィールド構造
        // CR-SA-15-E1 / 2026-05-14: uniqueDiceConfig 追加で 7 フィールド構造
        expect(result.config.houseRules).toEqual({
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            enableBondSkill: false,
            effectValue: 15,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    });

    it('(iii) effectValue が小数の不正データ → throw（破損データ経路）', () => {
        const invalid = {
            ...baseValid,
            config: {
                ...baseValid.config,
                houseRules: {
                    ...baseValid.config.houseRules,
                    effectValue: 15.5,
                },
            },
        } as unknown as PersistedRaceState;

        expect(() => persistMigrate(invalid, 2)).toThrow();
    });

    it('(iv) effectValue が負値の不正データ → throw', () => {
        const invalid = {
            ...baseValid,
            config: {
                ...baseValid.config,
                houseRules: {
                    ...baseValid.config.houseRules,
                    effectValue: -5,
                },
            },
        } as unknown as PersistedRaceState;

        expect(() => persistMigrate(invalid, 2)).toThrow();
    });

    it('(v) enableModifier 等が boolean 以外の不正データ → throw', () => {
        const invalid = {
            ...baseValid,
            config: {
                ...baseValid.config,
                houseRules: {
                    ...baseValid.config.houseRules,
                    enableModifier: 'yes' as unknown as boolean,
                },
            },
        } as unknown as PersistedRaceState;

        expect(() => persistMigrate(invalid, 2)).toThrow();
    });

    it('(vi) persistedState が null/非オブジェクト → throw', () => {
        expect(() => persistMigrate(null, 2)).toThrow();
        expect(() => persistMigrate('garbage', 2)).toThrow();
        expect(() => persistMigrate(42, 2)).toThrow();
    });

    it('(vii) 補完経路と handleRehydrateError 連動: throw 後の error が通知に変換される', () => {
        // persistMigrate の throw を catch して handleRehydrateError に渡す統合経路の確認。
        // 実際の zustand persist 内では migrate throw が onRehydrateStorage の error 引数に伝わる。
        useNotificationStore.setState({ notifications: [] });

        let caught: unknown = undefined;
        try {
            persistMigrate({ config: { houseRules: { effectValue: -1 } } }, 1);
        } catch (e) {
            caught = e;
        }
        // throw 自体は発生
        expect(caught).toBeDefined();

        // handleRehydrateError 経由で通知が出る
        handleRehydrateError(caught);
        const notifications = useNotificationStore.getState().notifications;
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('error');
        expect(notifications[0].message).toBe(RESTORE_ERROR_MESSAGE);

        useNotificationStore.setState({ notifications: [] });
    });
});

describe('Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10 useRaceStore.setManualModifier / clearManualModifier', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: true,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
            enableBondSkill: false,
            effectValue: 15,
        });
    });

    // setManualModifier 専用の参加者注入ヘルパー（Mid1 まで進行している前提、Bundle-4 setSpecialStrategy 同パターン）
    const installForModifier = (history: Umamusume['history'] = {}) => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行', // fixValue 10
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 0,
            history,
        };
        useRaceStore.setState({
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: true,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 6 フィールドに拡張
                    enableBondSkill: false,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 7 フィールドに拡張
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [uma],
            currentPhaseId: 'Mid',
            paceResult: { face: 5, label: 'Test' },
        });
    };

    it('(i) setManualModifier 単独: history[phaseId].manualModifier 設定 + score 加算', () => {
        // 先行 fix 10 + Start 10 + Mid 8 + paceMod 0 = 28
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
        // 28 + 5 = 33
        expect(updated.score).toBe(33);
    });

    it('(ii) setManualModifier 上書き: 既存値を新値で上書き + score 再計算', () => {
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        useRaceStore.getState().setManualModifier('p1', 'Mid', -3, 'ファンブル');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: -3,
            reason: 'ファンブル',
        });
        // 28 + (-3) = 25
        expect(updated.score).toBe(25);
    });

    it('(iii) clearManualModifier: 既存補正クリア + score 復元', () => {
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        useRaceStore.getState().clearManualModifier('p1', 'Mid');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.manualModifier).toBeUndefined();
        // 補正消失で 28 に復元
        expect(updated.score).toBe(28);
    });

    it('(iv) setManualModifier + 戦法併用: Bundle-4 setSpecialStrategy との同居挙動（独立加減算）', () => {
        // 戦法 ON にする
        useRaceStore.getState().updateHouseRules({ enableSpecialStrategy: true });
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });
        // installForModifier が houseRules を上書きするため、再度 ON
        useRaceStore.setState((state) => ({
            config: {
                ...state.config,
                houseRules: { ...state.config.houseRules, enableSpecialStrategy: true },
            },
        }));

        // 捲り発動 + 補正 +5
        useRaceStore.getState().setSpecialStrategy('p1', 'Mid', 'Makuri');
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');

        const updated = useRaceStore.getState().participants[0];
        // 28 + 15 (Makuri 即時) + 5 (補正) = 48
        expect(updated.score).toBe(48);
        expect(updated.history['Mid']?.specialStrategy).toBe('Makuri');
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
    });

    it('(v) 複数 phase に補正設定 + score 累積', () => {
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setManualModifier('p1', 'Start', 3, '初動');
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');

        const updated = useRaceStore.getState().participants[0];
        // 28 + 3 (Start 補正) + 5 (Mid 補正) = 36
        expect(updated.score).toBe(36);
        expect(updated.history['Start']?.manualModifier).toEqual({
            value: 3,
            reason: '初動',
        });
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
    });

    it('(vi) Bundle-6 戻る操作（setCurrentPhase のみ）で history.Mid.manualModifier が保持される', () => {
        // Bundle-6 / 2026-05-10: CR-8 由来 revertPhaseHistory を完全削除し、戻る操作で
        // history を一切削除しない仕様（scene3-race.md §6 完全な状態復元）。
        // 補正値も history.Mid 保持のため維持される（CR-8 削除 → Bundle-6 保持に逆転）。
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        // この時点 score = 33

        // Bundle-6 戻る操作 = setCurrentPhase のみ（history は完全保持）
        useRaceStore.setState({ currentPhaseId: 'Mid' });
        useRaceStore.getState().setCurrentPhase('Pace');

        const updated = useRaceStore.getState().participants[0];
        // Mid 保持 → 補正値も維持
        expect(updated.history['Mid']).toBeDefined();
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
        expect(updated.score).toBe(33);
    });

    it('(vii) clearManualModifier: 存在しない participant ID には no-op（防御的、設定済 score は不変）', () => {
        installForModifier({
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });
        // 設定済 score を確定させる
        useRaceStore.getState().setManualModifier('p1', 'Mid', 5, '妨害');
        // この時点 score = 33

        // 存在しない ID に対する clear は participants.map 内で early return → 副作用なし
        useRaceStore.getState().clearManualModifier('nonexistent', 'Mid');

        const updated = useRaceStore.getState().participants[0];
        expect(updated.history['Mid']?.manualModifier).toEqual({
            value: 5,
            reason: '妨害',
        });
        expect(updated.score).toBe(33);
    });
});

// Bundle-8-T1 / CR-SA-4 / 2026-05-10:
// 絆スキル基盤（型/zod/永続化 + 2 actions 新設）の動作検証。
// houserule-features.md §2 [v] 絆スキル §データ仕様 + §3 §捲り 前 cross-reference (specialStrategyPhase)
// に基づく setBondSkill / setSpecialStrategyPhase の最小動作確認。
// score 再計算は本 T1 では行わない（T6 でスコア計算統合時に追加）。
describe('useRaceStore - Bundle-8-T1 / 絆スキル基盤', () => {
    beforeEach(() => {
        // resetRace は houseRules を保持する設計のため、明示的に初期値へ戻す
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            enableBondSkill: false,
            effectValue: 15,
        });
    });

    const installBondParticipant = (override: Partial<Umamusume> = {}) => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: [] },
            gate: 1,
            score: 100, // score 再計算が走らないことを確認するため非ゼロ値を入れる
            history: {},
            ...override,
        };
        useRaceStore.setState({ participants: [uma] });
    };

    it('(i) houseRules 初期値: enableBondSkill === false（houserule-features.md §2 [v] 絆スキル デフォルト OFF）', () => {
        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.enableBondSkill).toBe(false);
    });

    it('(ii) setBondSkill("p1", "BondGamble") → bondSkill.type === "BondGamble"', () => {
        installBondParticipant();
        useRaceStore.getState().setBondSkill('p1', 'BondGamble');
        const updated = useRaceStore.getState().participants[0];
        expect(updated.bondSkill?.type).toBe('BondGamble');
    });

    it('(iii) setBondSkill("p1", "BondStable") → bondSkill.type === "BondStable"', () => {
        installBondParticipant();
        useRaceStore.getState().setBondSkill('p1', 'BondStable');
        const updated = useRaceStore.getState().participants[0];
        expect(updated.bondSkill?.type).toBe('BondStable');
    });

    it('(iv) setBondSkill("p1", null) → bondSkill.type === null', () => {
        installBondParticipant({ bondSkill: { type: 'BondGamble' } });
        useRaceStore.getState().setBondSkill('p1', null);
        const updated = useRaceStore.getState().participants[0];
        expect(updated.bondSkill?.type).toBeNull();
    });

    it('(v) setBondSkill: bondDice 不在 + HR フラグ OFF → score 変動なし（Bundle-8-T6 で score 再計算経路を追加するも delta=0）', () => {
        // Bundle-8-T6 / 2026-05-10: T6 で setBondSkill action 内に score 再計算を追加した。
        // installBondParticipant は houseRules.enableBondSkill デフォルト false + history 空なので
        // bondDice 不在 → calculateBondSkillDelta が 0 を返し、再計算後の score は baseScore（=0）になる。
        // T1 期間の「score 100 を維持」期待は T6 仕様変更（採用案 a 例外、TASK_INSTRUCTION §4 案 X1 正常範囲）で改訂。
        installBondParticipant({ score: 100 });
        useRaceStore.getState().setBondSkill('p1', 'BondGamble');
        const updated = useRaceStore.getState().participants[0];
        // baseScore（history 空 + 戦法情報なし）= 0、絆スキル delta = 0（フラグ OFF + bondDice 不在）
        expect(updated.score).toBe(0);
    });

    it('(vi) setBondSkill: 存在しない participant ID には no-op（防御的、他参加者は不変）', () => {
        installBondParticipant({ bondSkill: { type: 'BondStable' } });
        useRaceStore.getState().setBondSkill('nonexistent', 'BondGamble');
        const updated = useRaceStore.getState().participants[0];
        // 既存値が維持される（'nonexistent' に対する更新は副作用なし）
        expect(updated.bondSkill?.type).toBe('BondStable');
    });

    it('(vii) setSpecialStrategyPhase("p1", "Mid1") → specialStrategyPhase === "Mid1"', () => {
        installBondParticipant();
        useRaceStore.getState().setSpecialStrategyPhase('p1', 'Mid1');
        const updated = useRaceStore.getState().participants[0];
        expect(updated.specialStrategyPhase).toBe('Mid1');
    });

    it('(viii) setSpecialStrategyPhase("p1", null) → specialStrategyPhase === null', () => {
        installBondParticipant({ specialStrategyPhase: 'Start' });
        useRaceStore.getState().setSpecialStrategyPhase('p1', null);
        const updated = useRaceStore.getState().participants[0];
        expect(updated.specialStrategyPhase).toBeNull();
    });

    it('(ix) setSpecialStrategyPhase 呼び出し時に score は変更されない（T1 はスコア計算統合なし、T4 で実装）', () => {
        installBondParticipant({ score: 100 });
        useRaceStore.getState().setSpecialStrategyPhase('p1', 'Start');
        const updated = useRaceStore.getState().participants[0];
        expect(updated.score).toBe(100);
    });

    it('(x) generateParticipants で生成された参加者の bondSkill / specialStrategyPhase 初期値が undefined（オプショナル）', () => {
        useRaceStore.getState().generateParticipants(3);
        const all = useRaceStore.getState().participants;
        expect(all).toHaveLength(3);
        for (const p of all) {
            expect(p.bondSkill).toBeUndefined();
            expect(p.specialStrategyPhase).toBeUndefined();
        }
    });
});

// Bundle-8-T1 / CR-SA-4 / 2026-05-10:
// PERSIST_VERSION 2 → 3 バンプに伴う v2→v3 マイグレーション（enableBondSkill デフォルト補完）の動作検証。
// houserule-features.md §4 zod 検証範囲表 +1 フィールド = enableBondSkill: boolean。
describe('useRaceStore.persistMigrate - Bundle-8-T1 / v2→v3 マイグレーション', () => {
    it('(i) v2 旧データ（enableBondSkill 欠落、他 5 フィールドあり）→ デフォルト false 補完で起動成功', () => {
        const v2Persisted = {
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: true,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: true,
                    enableExtendedUnique: false,
                    effectValue: 25,
                    // enableBondSkill が欠落している = v2 旧データ
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: { face: null, label: null },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'setup' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(v2Persisted, 2);

        // enableBondSkill が false で補完される
        expect(result.config.houseRules.enableBondSkill).toBe(false);
        // 他 5 フィールドは旧データの値を維持
        expect(result.config.houseRules.enableModifier).toBe(true);
        expect(result.config.houseRules.enableSpecialStrategy).toBe(false);
        expect(result.config.houseRules.enableCompositeUnique).toBe(true);
        expect(result.config.houseRules.enableExtendedUnique).toBe(false);
        expect(result.config.houseRules.effectValue).toBe(25);
    });

    it('(ii) v3 データ → uniqueDiceConfig 補完で検証成功通過', () => {
        // CR-SA-15-E1 / 2026-05-14: PERSIST_VERSION 3→4 バンプにより、v3 データ（uniqueDiceConfig 欠落）は
        // DEFAULT_HOUSE_RULES マージ + houseRulesSchema.default() で uniqueDiceConfig がデフォルト補完される
        const v3Persisted = {
            config: {
                midPhaseCount: 2,
                fullGateSize: 18,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: false,
                    enableExtendedUnique: true,
                    enableBondSkill: true,
                    effectValue: 30,
                },
            },
            participants: [],
            currentPhaseId: 'Start',
            paceResult: { face: 5, label: 'Slow' },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'race' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(v3Persisted, 3);
        expect(result.config.houseRules).toEqual({
            ...v3Persisted.config.houseRules,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    });

    it('(iii) v2 旧データ + houseRules 他 5 フィールドも欠落 → DEFAULT_HOUSE_RULES の 6 フィールド全補完', () => {
        const v2Minimal = {
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                // houseRules 自体が空オブジェクト（極端ケース、Bundle-1 以前由来想定）
                houseRules: {},
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: { face: null, label: null },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'setup' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(v2Minimal, 2);
        // すべてデフォルト補完
        // CR-SA-15-E1 / 2026-05-14: uniqueDiceConfig 追加で 7 フィールド構造
        expect(result.config.houseRules).toEqual({
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
            enableExtendedUnique: false,
            enableBondSkill: false,
            effectValue: 15,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    });

    it('(iv) v2 旧データ + enableBondSkill が boolean 以外（不正値）→ throw（zod 検証失敗 = 破損データ経路）', () => {
        const v2Invalid = {
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: 'true' as unknown as boolean, // 不正値（string）
                    effectValue: 15,
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: { face: null, label: null },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'setup' },
        } as unknown as PersistedRaceState;

        expect(() => persistMigrate(v2Invalid, 2)).toThrow();
    });

    // (v) CR-SA-19 / 2026-06-06 ★最重要: v5 旧データ（uniqueDiceConfig が旧 5 キー = GambleII / StabilityII 欠落）
    // → persistMigrate の uniqueDiceConfig ネスト補完で 7 キーに復元される（既存ユーザーデータ保護）。
    // 浅いマージのままだと旧 5 キーが新 7 キーのデフォルトを完全上書きし、新 2 キー欠落 → 7 キー必須スキーマで
    // 検証失敗 → 全保存データリセットとなる。ネスト補完により旧 5 キーのカスタム値を保持しつつ新 2 キーをデフォルト補完する。
    it('(v) v5 旧データ → uniqueDiceConfig 旧 5 キーのカスタム値保持 + 新 2 キーデフォルト補完で検証成功通過', () => {
        const v5Persisted = {
            config: {
                midPhaseCount: 2,
                fullGateSize: 18,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: true,
                    enableCompositeUnique: false,
                    enableExtendedUnique: true,
                    enableBondSkill: false,
                    effectValue: 20,
                    // 旧 5 キー（CR-SA-15/16 期）= GambleII / StabilityII 欠落、Stability はカスタム値
                    uniqueDiceConfig: {
                        Stability: { fixValue: 7, diceStr: '1d11' }, // カスタム値（保持されること）
                        Gamble: { fixValue: 0, diceStr: '1d20' },
                        Persistent: { fixValue: 0, diceStr: '1d10' },
                        SuperGamble: { fixValue: -10, diceStr: '1d35' },
                        SuperStability: { fixValue: 8, diceStr: '1d3' },
                    },
                },
            },
            participants: [],
            currentPhaseId: 'Start',
            paceResult: { face: 5, label: 'Slow' },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'race' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(v5Persisted, 5);
        const cfg = result.config.houseRules.uniqueDiceConfig;
        // 旧 5 キーのカスタム値は保持される
        expect(cfg.Stability).toEqual({ fixValue: 7, diceStr: '1d11' });
        expect(cfg.SuperGamble).toEqual({ fixValue: -10, diceStr: '1d35' });
        // 新 2 キーはデフォルト値で補完される
        expect(cfg.GambleII).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.GambleII);
        expect(cfg.StabilityII).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.StabilityII);
        // 結果として 7 キー揃う（検証成功 = リセットされない）
        expect(Object.keys(cfg).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
        );
    });
});

// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキル スコア最終加算のストア統合テスト。
// 仕様根拠: basic-rules.md §5 末尾「絆スキルの最終加算」+ houserule-features.md §2 [v] §計算仕様。
describe('useRaceStore - Bundle-8-T6 / 絆スキル スコア最終加算', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    const setupBondParticipant = (
        bondType: 'BondGamble' | 'BondStable' | null,
        bondDiceSum: number | null,
        opts: { enableBondSkill: boolean; midPhaseCount?: number; reachEnd?: boolean } = {
            enableBondSkill: true,
        },
    ) => {
        const midPhaseCount = opts.midPhaseCount ?? 1;
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
        };
        if (opts.reachEnd !== false) {
            history.End = {
                baseDice: makeDice('3d6', [7, 7, 6]),
                computedScore: 0,
            };
            if (bondDiceSum !== null) {
                history.End.bondDice = {
                    diceStr: bondType === 'BondStable' ? '1d5' : '1d15',
                    values: [bondDiceSum],
                    sum: bondDiceSum,
                };
            }
        }
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: bondType },
            history,
        });
        useRaceStore.setState({
            config: {
                midPhaseCount,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: opts.enableBondSkill,
                    effectValue: 15,
                    // CR-SA-15-E1 / 2026-05-14: 7 フィールドに拡張
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [p],
        });
        // setMidPhaseCount で score 再計算をトリガー（既存値と同じだが unconditional に再計算する仕様を活用）
        useRaceStore.getState().setMidPhaseCount(midPhaseCount);
        return p;
    };

    it('(1) HR 絆スキル ON + 絆ギャンブル + bondDice.sum=12 → score に +12 反映', () => {
        setupBondParticipant('BondGamble', 12, { enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const scoreOff = useRaceStore.getState().participants[0].score;
        expect(scoreOn - scoreOff).toBe(12);
    });

    it('(2) HR 絆スキル ON + 絆安定 + bondDice.sum=8（fix 5 込み）→ score に +8 反映', () => {
        setupBondParticipant('BondStable', 8, { enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const scoreOff = useRaceStore.getState().participants[0].score;
        expect(scoreOn - scoreOff).toBe(8);
    });

    it('(3) HR 絆スキル ON + 種別 null → 加算なし', () => {
        setupBondParticipant(null, 12, { enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const scoreOff = useRaceStore.getState().participants[0].score;
        expect(scoreOn).toBe(scoreOff); // 種別未指定 = フラグ ON/OFF ともに加算なし
    });

    it('(4) HR 絆スキル OFF + 種別指定済 → 加算なし（フラグ OFF 抑制）', () => {
        setupBondParticipant('BondGamble', 12, { enableBondSkill: false });
        const score = useRaceStore.getState().participants[0].score;
        // 同条件 + フラグ ON にすると +12 されるはず
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        expect(scoreOn - score).toBe(12);
    });

    it('(5) 終盤 bondDice 不在（解析未実行）→ 加算なし', () => {
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
            End: { baseDice: makeDice('3d6', [7, 7, 6]), computedScore: 0 },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history,
        });
        installParticipant(p);
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const scoreOff = useRaceStore.getState().participants[0].score;
        expect(scoreOn).toBe(scoreOff); // bondDice 不在 = フラグ ON/OFF ともに加算なし
    });

    it('(6) 終盤未到達（中盤フェーズまで）→ 加算なし', () => {
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history,
        });
        installParticipant(p);
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const scoreOn = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const scoreOff = useRaceStore.getState().participants[0].score;
        expect(scoreOn).toBe(scoreOff);
    });
});

describe('useRaceStore - Bundle-8-T6 / setBondSkill action score 再計算', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    it('(7) bondDice 既存 + setBondSkill(p1, BondGamble) → score 即時加算', () => {
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            End: {
                baseDice: makeDice('3d6', [7, 7, 6]),
                bondDice: makeDice('1d15', [12]),
                computedScore: 0,
            },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: null },
            history,
        });
        installParticipant(p);
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const before = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().setBondSkill('p1', 'BondGamble');
        const after = useRaceStore.getState().participants[0].score;
        expect(after - before).toBe(12);
    });

    it('(8) bondDice 不在 + setBondSkill(p1, BondGamble) → score 変動なし', () => {
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: null },
            history,
        });
        installParticipant(p);
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const before = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().setBondSkill('p1', 'BondGamble');
        const after = useRaceStore.getState().participants[0].score;
        expect(after).toBe(before);
    });

    it('(9) BondGamble 状態 → setBondSkill(p1, null) で加算分が減じられる', () => {
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            End: {
                baseDice: makeDice('3d6', [7, 7, 6]),
                bondDice: makeDice('1d15', [12]),
                computedScore: 0,
            },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history,
        });
        installParticipant(p);
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        const before = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().setBondSkill('p1', null);
        const after = useRaceStore.getState().participants[0].score;
        expect(before - after).toBe(12);
    });
});

// Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ Insert/Edit/Delete actions
// (houserule-features.md §1 / modal-houserule.md §2 SSoT)
// Bundle-10-T1 用ヘルパー: resetRace は strategies をリセットしないため、各テスト前に
// DEFAULT_STRATEGIES の deep copy で明示的に再初期化する。
const resetStrategies = () => {
    useRaceStore.setState({
        strategies: DEFAULT_STRATEGIES.map((s) => ({
            ...s,
            dice: { ...s.dice },
            paceModifiers: { ...s.paceModifiers },
        })),
    });
};

describe('useRaceStore - Bundle-10-T1 / addStrategy action', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        resetStrategies();
    });

    it('デフォルト 5 脚質「逃げ」直後にカスタム脚質を追加 → 配列順序が [大逃げ, 逃げ, カスタム1, 先行, 差し, 追込] に変化', () => {
        const customA = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        const names = useRaceStore.getState().strategies.map((s) => s.name);
        expect(names).toEqual(['大逃げ', '逃げ', 'カスタムA', '先行', '差し', '追込']);
    });

    it('カスタム脚質の直後にさらに別カスタムを追加 → 既存カスタムの直後に挿入される', () => {
        const customA = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        const customB = {
            name: 'カスタムB',
            fixValue: 3,
            dice: { start: '1d6', mid: '1d4', end: '1d8' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        useRaceStore.getState().addStrategy('カスタムA', customB);
        const names = useRaceStore.getState().strategies.map((s) => s.name);
        expect(names).toEqual(['大逃げ', '逃げ', 'カスタムA', 'カスタムB', '先行', '差し', '追込']);
    });

    it('末尾「追込」直後に追加 → 配列末尾に挿入される', () => {
        const customZ = {
            name: 'カスタムZ',
            fixValue: 2,
            dice: { start: '1d4', mid: '1d4', end: '1d4' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('追込', customZ);
        const names = useRaceStore.getState().strategies.map((s) => s.name);
        expect(names).toEqual(['大逃げ', '逃げ', '先行', '差し', '追込', 'カスタムZ']);
    });

    it('該当 insertAfterName 不在 → no-op（state 不変、配列順序維持）', () => {
        const before = useRaceStore.getState().strategies;
        const customX = {
            name: 'カスタムX',
            fixValue: 1,
            dice: { start: '1d2', mid: '1d2', end: '1d2' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('存在しない名前', customX);
        const after = useRaceStore.getState().strategies;
        expect(after.map((s) => s.name)).toEqual(before.map((s) => s.name));
        expect(after).toHaveLength(5);
    });
});

describe('useRaceStore - Bundle-10-T1 / updateStrategy action', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        resetStrategies();
    });

    it('デフォルト 5 脚質「逃げ」の fixValue を編集 → strategies 配列に反映', () => {
        useRaceStore.getState().updateStrategy('逃げ', { fixValue: 99 });
        const updated = useRaceStore.getState().strategies.find((s) => s.name === '逃げ');
        expect(updated?.fixValue).toBe(99);
        // 他フィールドは不変
        expect(updated?.dice.start).toBe('3d6');
    });

    it('デフォルト 5 脚質「先行」の dice を編集 → strategies 配列に反映', () => {
        useRaceStore.getState().updateStrategy('先行', {
            dice: { start: '5d10', mid: '5d10', end: '5d10' },
        });
        const updated = useRaceStore.getState().strategies.find((s) => s.name === '先行');
        expect(updated?.dice).toEqual({ start: '5d10', mid: '5d10', end: '5d10' });
    });

    it('カスタム脚質の paceModifiers を編集 → strategies 配列に反映', () => {
        const customA = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        useRaceStore.getState().updateStrategy('カスタムA', {
            paceModifiers: { 1: 8, 9: -8 },
        });
        const updated = useRaceStore.getState().strategies.find((s) => s.name === 'カスタムA');
        expect(updated?.paceModifiers).toEqual({ 1: 8, 9: -8 });
    });

    // Bundle-10-T1 ENG38 で発見された ESCALATION 案 V V1（getStrategy 設計の DEFAULT 5 脚質編集 score 反映齟齬）は
    // Bundle-10-Followup-runtime-sync (2026-05-11) で getStrategy(name, strategies) シグネチャ変更により解消済。
    // 本テストはカスタム脚質ベースで score 再計算経路が走ることを確認する位置付けは維持する
    // （DEFAULT 編集の score 反映 regression は strategy-runtime-sync.test.ts で別途カバー）。
    it('編集した脚質を選択している participant の score が再計算される（カスタム脚質の fixValue 変更）', () => {
        const customA: Strategy = {
            name: 'カスタムA',
            fixValue: 10,
            dice: { start: '3d6', mid: '3d5', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        const startDice = makeDice('3d6', [2, 3, 4]); // sum 9
        const p = setupParticipant({
            strategy: 'カスタムA',
            history: {
                Start: { baseDice: startDice, computedScore: 0 },
            },
        });
        installParticipant(p);
        // installParticipant 直後は setState 注入で score=0。updateStrategy 経由で再計算をトリガー。
        useRaceStore.getState().updateStrategy('カスタムA', { fixValue: 10 });
        const before = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateStrategy('カスタムA', { fixValue: 40 }); // +30
        const after = useRaceStore.getState().participants[0].score;
        expect(after - before).toBe(30);
    });

    it('該当 name が存在しない場合 = no-op（strategies / participants 不変）', () => {
        const startDice = makeDice('3d6', [2, 3, 4]);
        const p = setupParticipant({
            strategy: '逃げ',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);
        const beforeStrategies = useRaceStore.getState().strategies;
        const beforeScore = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateStrategy('存在しない名前', { fixValue: 999 });
        const afterStrategies = useRaceStore.getState().strategies;
        const afterScore = useRaceStore.getState().participants[0].score;
        expect(afterStrategies).toEqual(beforeStrategies);
        expect(afterScore).toBe(beforeScore);
    });
});

describe('useRaceStore - Bundle-10-T1 / removeStrategy action', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
        resetStrategies();
    });

    it('カスタム脚質の削除 → strategies 配列から消える', () => {
        const customA = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        expect(useRaceStore.getState().strategies).toHaveLength(6);
        useRaceStore.getState().removeStrategy('カスタムA');
        const names = useRaceStore.getState().strategies.map((s) => s.name);
        expect(names).toEqual(['大逃げ', '逃げ', '先行', '差し', '追込']);
    });

    it('デフォルト 5 脚質の削除試行 = no-op（仕様 SSoT 準拠の保護）', () => {
        const beforeNames = useRaceStore.getState().strategies.map((s) => s.name);
        useRaceStore.getState().removeStrategy('逃げ');
        useRaceStore.getState().removeStrategy('追込');
        useRaceStore.getState().removeStrategy('大逃げ');
        useRaceStore.getState().removeStrategy('先行');
        useRaceStore.getState().removeStrategy('差し');
        const afterNames = useRaceStore.getState().strategies.map((s) => s.name);
        expect(afterNames).toEqual(beforeNames);
    });

    it('削除実行時、当該脚質を選択していた participant の strategy が空文字に強制リセット', () => {
        const customA = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        const p = setupParticipant({ strategy: 'カスタムA' });
        installParticipant(p);
        useRaceStore.getState().removeStrategy('カスタムA');
        const after = useRaceStore.getState().participants[0];
        expect(after.strategy).toBe('');
    });

    it('強制リセット後の participant の score が再計算される（脚質未選択 → ベーススコア 0 扱い）', () => {
        const customA: Strategy = {
            name: 'カスタムA',
            fixValue: 50,
            dice: { start: '3d6', mid: '3d5', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        const startDice = makeDice('3d6', [2, 3, 4]);
        const p = setupParticipant({
            strategy: 'カスタムA',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);
        useRaceStore.getState().removeStrategy('カスタムA');
        const after = useRaceStore.getState().participants[0];
        // strategy = '' になり、getStrategy() が undefined を返す = ベーススコア 0
        expect(after.strategy).toBe('');
        expect(after.score).toBe(0);
    });

    it('該当 name が存在しない場合 = no-op（strategies / participants 不変）', () => {
        const startDice = makeDice('3d6', [2, 3, 4]);
        const p = setupParticipant({
            strategy: '逃げ',
            history: { Start: { baseDice: startDice, computedScore: 0 } },
        });
        installParticipant(p);
        const beforeStrategies = useRaceStore.getState().strategies;
        const beforeScore = useRaceStore.getState().participants[0].score;
        const beforeStrategy = useRaceStore.getState().participants[0].strategy;
        useRaceStore.getState().removeStrategy('存在しない名前');
        const afterStrategies = useRaceStore.getState().strategies;
        const afterScore = useRaceStore.getState().participants[0].score;
        const afterStrategy = useRaceStore.getState().participants[0].strategy;
        expect(afterStrategies).toEqual(beforeStrategies);
        expect(afterScore).toBe(beforeScore);
        expect(afterStrategy).toBe(beforeStrategy);
    });
});

// Bundle-11-T1 / CR-SA-12 / 2026-05-11: プリセット管理 actions
// (modal-houserule.md §3 設定プリセット管理 + houserule-features.md §4 Config Management)
// LocalStorage を vi.stubGlobal で in-memory モック化し、Node 環境（jsdom/happy-dom 未導入）下で
// savePreset / loadPreset / deletePreset / listPresetNames の挙動を検証する。
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

describe('savePreset - Bundle-11-T1', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('(1) 設定名 + 現在の houseRules + strategies で LocalStorage に保存される', () => {
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        useRaceStore.getState().savePreset('プリセットA');
        const raw = mockStorage.getItem(`${PRESET_KEY_PREFIX}プリセットA`);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.houseRules.enableBondSkill).toBe(true);
        expect(Array.isArray(parsed.strategies)).toBe(true);
        expect(parsed.strategies).toHaveLength(5);
    });

    it('(2) 既存設定名で再保存 → 既存キーが新値で上書きされる', () => {
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        useRaceStore.getState().savePreset('プリセットA');
        useRaceStore.getState().updateHouseRules({ enableModifier: false });
        useRaceStore.getState().savePreset('プリセットA');
        const raw = mockStorage.getItem(`${PRESET_KEY_PREFIX}プリセットA`);
        const parsed = JSON.parse(raw!);
        expect(parsed.houseRules.enableModifier).toBe(false);
    });

    it('(3) 設定名 trim 後空欄 → no-op（LocalStorage 不変）', () => {
        useRaceStore.getState().savePreset('');
        useRaceStore.getState().savePreset('   ');
        expect(mockStorage.length).toBe(0);
    });

    it('(4) LocalStorage キー = `race-store-presets:<name>` 完全一致 + PERSIST_NAME 主キーと別名前空間', () => {
        useRaceStore.getState().savePreset('XYZ');
        expect(mockStorage.getItem('race-store-presets:XYZ')).not.toBeNull();
        // 主キー race-store とは別キー
        expect(mockStorage.getItem('race-store')).toBeNull();
        expect(PRESET_KEY_PREFIX).toBe('race-store-presets:');
        expect(PRESET_KEY_PREFIX).not.toBe(PERSIST_NAME);
    });

    it('(5) カスタム脚質を含む strategies が完全シリアライズされる', () => {
        const customA: Strategy = {
            name: 'カスタムA',
            fixValue: 99,
            dice: { start: '2d10', mid: '2d8', end: '2d6' },
            paceModifiers: { 1: -3, 9: 3 },
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        useRaceStore.getState().savePreset('カスタム含む');
        const raw = mockStorage.getItem(`${PRESET_KEY_PREFIX}カスタム含む`);
        const parsed = JSON.parse(raw!);
        const restored = parsed.strategies.find((s: Strategy) => s.name === 'カスタムA');
        expect(restored).toBeDefined();
        expect(restored.fixValue).toBe(99);
        expect(restored.dice).toEqual({ start: '2d10', mid: '2d8', end: '2d6' });
        expect(restored.paceModifiers).toEqual({ 1: -3, 9: 3 });
    });
});

describe('loadPreset - Bundle-11-T1', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
        useNotificationStore.setState({ notifications: [] });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('(6) 既存プリセットを読込 → state.config.houseRules + state.strategies が上書きされる', () => {
        // プリセット保存（enableBondSkill=true, enableModifier=true）
        useRaceStore.getState().updateHouseRules({
            enableBondSkill: true,
            enableModifier: true,
        });
        useRaceStore.getState().savePreset('プリセットB');
        // 現状をデフォルトに戻す
        useRaceStore.getState().updateHouseRules({
            enableBondSkill: false,
            enableModifier: false,
        });
        expect(useRaceStore.getState().config.houseRules.enableBondSkill).toBe(false);
        // 読込
        useRaceStore.getState().loadPreset('プリセットB');
        const after = useRaceStore.getState().config.houseRules;
        expect(after.enableBondSkill).toBe(true);
        expect(after.enableModifier).toBe(true);
    });

    it('(7) 存在しないプリセット名 → state 不変 + 通知エラー発行', () => {
        const before = useRaceStore.getState().config.houseRules;
        useRaceStore.getState().loadPreset('存在しない');
        const after = useRaceStore.getState().config.houseRules;
        expect(after).toEqual(before);
        const notifs = useNotificationStore.getState().notifications;
        expect(notifs).toHaveLength(1);
        expect(notifs[0].type).toBe('error');
        expect(notifs[0].message).toContain('存在しない');
    });

    it('(8) loadPreset 後の participants の score が再計算される（updateHouseRules と同パターン）', () => {
        // 絆スキル + 終盤ダイス完備の participant を installParticipant で注入
        const history: Umamusume['history'] = {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
            End: {
                baseDice: makeDice('3d6', [7, 7, 6]),
                bondDice: makeDice('1d15', [12]),
                computedScore: 0,
            },
        };
        const p = setupParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history,
        });
        installParticipant(p);
        // 絆スキル ON 状態でプリセット保存
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        useRaceStore.getState().savePreset('絆ON設定');
        const scoreWithBond = useRaceStore.getState().participants[0].score;
        // 絆スキル OFF に切り替え（score 12 減）
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        expect(useRaceStore.getState().participants[0].score).not.toBe(scoreWithBond);
        // 読込 → score が再計算され、保存時の値に復元
        useRaceStore.getState().loadPreset('絆ON設定');
        expect(useRaceStore.getState().participants[0].score).toBe(scoreWithBond);
    });

    it('(9) JSON.parse 失敗（破損データ） → state 不変 + 通知エラー', () => {
        mockStorage.setItem(`${PRESET_KEY_PREFIX}壊れたデータ`, '{ invalid json');
        const before = useRaceStore.getState().config.houseRules;
        useRaceStore.getState().loadPreset('壊れたデータ');
        const after = useRaceStore.getState().config.houseRules;
        expect(after).toEqual(before);
        const notifs = useNotificationStore.getState().notifications;
        expect(notifs).toHaveLength(1);
        expect(notifs[0].type).toBe('error');
    });

    it('(10) loadPreset で strategies が完全置換される（カスタム脚質も含めて）', () => {
        const customA: Strategy = {
            name: 'カスタムA',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customA);
        useRaceStore.getState().savePreset('カスタム含む');
        // カスタム脚質を削除
        useRaceStore.getState().removeStrategy('カスタムA');
        expect(useRaceStore.getState().strategies).toHaveLength(5);
        // 読込で復元
        useRaceStore.getState().loadPreset('カスタム含む');
        expect(useRaceStore.getState().strategies).toHaveLength(6);
        expect(
            useRaceStore.getState().strategies.find((s) => s.name === 'カスタムA'),
        ).toBeDefined();
    });

    it('(11) 設定名 trim 空欄 → no-op（state 不変、通知も発行されない）', () => {
        const before = useRaceStore.getState().config.houseRules;
        useRaceStore.getState().loadPreset('');
        useRaceStore.getState().loadPreset('   ');
        expect(useRaceStore.getState().config.houseRules).toEqual(before);
        expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
});

describe('deletePreset - Bundle-11-T1', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('(12) 既存プリセット削除 → LocalStorage から消える', () => {
        useRaceStore.getState().savePreset('削除対象');
        expect(mockStorage.getItem(`${PRESET_KEY_PREFIX}削除対象`)).not.toBeNull();
        useRaceStore.getState().deletePreset('削除対象');
        expect(mockStorage.getItem(`${PRESET_KEY_PREFIX}削除対象`)).toBeNull();
    });

    it('(13) 存在しないプリセット名 → no-op（エラーなし）', () => {
        expect(() => useRaceStore.getState().deletePreset('存在しない')).not.toThrow();
        expect(mockStorage.length).toBe(0);
    });

    it('(14) 設定名 trim 空欄 → no-op + 他キー不変', () => {
        useRaceStore.getState().savePreset('keepMe');
        useRaceStore.getState().deletePreset('');
        useRaceStore.getState().deletePreset('   ');
        expect(mockStorage.getItem(`${PRESET_KEY_PREFIX}keepMe`)).not.toBeNull();
    });
});

describe('listPresetNames - Bundle-11-T1', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('(15) PRESET_KEY_PREFIX のキーのみ列挙される', () => {
        useRaceStore.getState().savePreset('alpha');
        useRaceStore.getState().savePreset('beta');
        useRaceStore.getState().savePreset('gamma');
        const names = useRaceStore.getState().listPresetNames();
        expect(names.sort()).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('(16) 既存 `race-store` 主キー（Zustand persist）は列挙対象外', () => {
        mockStorage.setItem('race-store', '{"foo":"bar"}');
        mockStorage.setItem('unrelated-key', 'value');
        useRaceStore.getState().savePreset('プリセットX');
        const names = useRaceStore.getState().listPresetNames();
        expect(names).toEqual(['プリセットX']);
        expect(names).not.toContain('race-store');
        expect(names).not.toContain('unrelated-key');
    });

    it('(17) プリセット 0 件 → 空配列を返す', () => {
        const names = useRaceStore.getState().listPresetNames();
        expect(names).toEqual([]);
    });

    it('(18) deletePreset 後、削除済名前が一覧から消える', () => {
        useRaceStore.getState().savePreset('a');
        useRaceStore.getState().savePreset('b');
        useRaceStore.getState().deletePreset('a');
        const names = useRaceStore.getState().listPresetNames();
        expect(names).toEqual(['b']);
    });
});

// CR-SA-15-E1 / 2026-05-14:
// 固有スキル設定（uniqueDiceConfig）のストア統合検証（houserule-features.md §5.4 / basic-rules.md §6 Case 5）。
// - 初期 state の uniqueDiceConfig が DEFAULT_UNIQUE_DICE_CONFIG と一致
// - updateHouseRules({ uniqueDiceConfig }) で値が更新される
// - persistMigrate: version=3 旧データ（uniqueDiceConfig 欠落）→ DEFAULT_UNIQUE_DICE_CONFIG 補完
// CR-SA-15-E2 / 2026-05-15: test (3) を更新。E1 では calculator.ts が uniqueDiceConfig 未参照のため
// 「updateHouseRules({ uniqueDiceConfig }) で score 値は不変」だったが、E2 で calculator.ts が
// 参照化されたため、固有スキル発動フェーズに固有ダイス取り込み済の参加者は固有固定値の変更で
// score が再計算され値が変わる（basic-rules.md §6 Case 5 成立 = E1 「実質 no-op」の実効化）。
describe('CR-SA-15-E1 / 2026-05-14 uniqueDiceConfig store integration', () => {
    // resetRace は houseRules を保持する設計のため、uniqueDiceConfig を明示的に初期値へ戻す
    // （Bundle-9 / Bundle-6 describe と同パターン、次 describe への状態リーク防止）。
    const resetUniqueDiceConfig = () => {
        useRaceStore.getState().resetRace();
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    };
    beforeEach(resetUniqueDiceConfig);
    afterEach(resetUniqueDiceConfig);

    it('(1) 初期 state の config.houseRules.uniqueDiceConfig が DEFAULT_UNIQUE_DICE_CONFIG と一致', () => {
        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
    });

    it('(2) updateHouseRules({ uniqueDiceConfig }) で uniqueDiceConfig が更新される（他フィールドは現状維持）', () => {
        const customConfig = {
            ...DEFAULT_UNIQUE_DICE_CONFIG,
            // ハウスルール郡の安定型 5+1d11 運用
            Stability: { fixValue: 5, diceStr: '1d11' },
        };
        useRaceStore.getState().updateHouseRules({ uniqueDiceConfig: customConfig });

        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.uniqueDiceConfig.Stability).toEqual({ fixValue: 5, diceStr: '1d11' });
        // 他タイプはデフォルト維持
        expect(houseRules.uniqueDiceConfig.Gamble).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.Gamble);
        // 他 6 フィールドは部分更新で現状維持
        expect(houseRules.enableModifier).toBe(false);
        expect(houseRules.effectValue).toBe(15);
    });

    it('(3) updateHouseRules({ uniqueDiceConfig }) で score 再計算が実効化する（E2 で固有固定値の変更が score に反映、basic-rules.md §6 Case 5 成立）', () => {
        // CR-SA-15-E2 / 2026-05-15: E1 では calculator.ts が uniqueDiceConfig 未参照のため
        // 「score 値は不変」だったが、E2 で calculator.ts が参照化されたため、固有スキル発動
        // フェーズに固有ダイス取り込み済の参加者は固有固定値変更で score が変わる。
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            // 固有スキル安定型・発動フェーズ Start（固有固定値が score に効く構成）
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: 1,
            score: 0,
            history: {
                Start: {
                    baseDice: makeDice('3d8', [3, 4, 3]),
                    uniqueDice: makeDice('1d10', [8]),
                    computedScore: 0,
                },
            },
        };
        useRaceStore.setState({ participants: [uma] });
        // setMidPhaseCount で score を初期計算
        useRaceStore.getState().setMidPhaseCount(1);
        const scoreBefore = useRaceStore.getState().participants[0].score;

        // 安定型固定値を 5 → 12 に変更
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 12, diceStr: '1d10' },
            },
        });
        const scoreAfter = useRaceStore.getState().participants[0].score;

        // E2 で calculator.ts が uniqueDiceConfig を参照するため、
        // 固有固定値 5 → 12 の差分 +7 が score に反映される。
        expect(scoreAfter - scoreBefore).toBe(7);
    });

    it('(4) persistMigrate: version=3 旧データ（uniqueDiceConfig 欠落）→ DEFAULT_UNIQUE_DICE_CONFIG 補完 + zod 検証通過', () => {
        const v3Persisted = {
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: false,
                    effectValue: 15,
                    // uniqueDiceConfig が欠落している = version=3 旧データ
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: { face: null, label: null },
            strategies: [],
            gateAssignments: null,
            uiState: { scene: 'setup' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(v3Persisted, 3);
        // uniqueDiceConfig がデフォルト補完される
        expect(result.config.houseRules.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
        // 既存 6 フィールドは旧データの値を維持
        expect(result.config.houseRules.effectValue).toBe(15);
        expect(result.config.houseRules.enableBondSkill).toBe(false);
    });
});

// CR-SA-15-E4 / 2026-05-15:
// 固有スキル設定（uniqueDiceConfig）の JSON I/O 動作確認（modal-houserule.md §3 設定プリセット管理 + §4
// 固有スキル設定 — JSON I/O 連動 / houserule-features.md §4 + §5.5 既存ロジック整合 — JSON プリセット I/O）。
// E1 で組み込み済の savePreset / loadPreset / importHouseRulesConfig 経路が `uniqueDiceConfig` を含めて
// 正しく往復することの構造的証跡。プロダクトコード完全不変、テスト追加のみで動作を「テストで保証」する。
describe('CR-SA-15-E4 / 2026-05-15 uniqueDiceConfig JSON I/O', () => {
    // 既存 savePreset / loadPreset describe と同パターン: in-memory localStorage モック化
    // + resetStrategies (前 describe の state.strategies リーク防止)
    // + uniqueDiceConfig を初期値に戻す。
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        useRaceStore.getState().resetRace();
        resetStrategies();
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        });
    });

    // ユーザーリクエスト由来の代表的なカスタム値（DEFAULT と明確に差分が出る組合せ）
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

    // (P1) savePreset → loadPreset 経路でカスタム uniqueDiceConfig が往復復元される
    it('(P1) savePreset → loadPreset でカスタム uniqueDiceConfig が往復復元される', () => {
        // カスタム値を適用 → savePreset
        useRaceStore.getState().updateHouseRules({ uniqueDiceConfig: customUniqueDiceConfig });
        useRaceStore.getState().savePreset('e4-test');

        // 別のカスタム値に変更（往復前の混入を確認するため明確に異なる値）
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 99, diceStr: '9d9' },
            },
        });
        expect(useRaceStore.getState().config.houseRules.uniqueDiceConfig.Stability.fixValue).toBe(99);

        // loadPreset で savePreset 時点のカスタム値に復元されることを検証
        useRaceStore.getState().loadPreset('e4-test');
        expect(useRaceStore.getState().config.houseRules.uniqueDiceConfig).toEqual(customUniqueDiceConfig);
    });

    // (P2) savePreset 時 LocalStorage 内 JSON に uniqueDiceConfig が含まれる（構造的証跡）
    it('(P2) savePreset 時 LocalStorage の JSON に uniqueDiceConfig が含まれる', () => {
        useRaceStore.getState().updateHouseRules({ uniqueDiceConfig: customUniqueDiceConfig });
        useRaceStore.getState().savePreset('p2-test');

        const raw = mockStorage.getItem(`${PRESET_KEY_PREFIX}p2-test`);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw as string);
        expect(parsed.houseRules.uniqueDiceConfig).toEqual(customUniqueDiceConfig);
        // CR-SA-19 / 2026-06-06: 7 キー揃っていること
        expect(Object.keys(parsed.houseRules.uniqueDiceConfig).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
        );
    });

    // (P3) 後方互換性 = uniqueDiceConfig 欠落の古いプリセット JSON の loadPreset で
    // DEFAULT_UNIQUE_DICE_CONFIG が補完される（E1 `.default()` の真価をプリセット経路で証跡化）。
    // loadPreset は内部で deserializeAndValidate（zod safeParse 経由）を介して importHouseRulesConfig
    // に渡す経路のため、`.default()` 補完が validateHouseRulesConfig の戻り値時点で発動済となる。
    it('(P3) uniqueDiceConfig 欠落の古いプリセット JSON は loadPreset で DEFAULT 補完される', () => {
        const legacyPreset = JSON.stringify({
            houseRules: {
                enableModifier: true,
                enableSpecialStrategy: true,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: true,
                effectValue: 20,
                // uniqueDiceConfig フィールドそのものが欠落（CR-SA-15-E1 以前の旧形式相当）
            },
            strategies: [],
        });
        mockStorage.setItem(`${PRESET_KEY_PREFIX}legacy`, legacyPreset);

        useRaceStore.getState().loadPreset('legacy');
        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
        // 既存 6 フィールドは旧データの値で上書きされる
        expect(houseRules.effectValue).toBe(20);
        expect(houseRules.enableBondSkill).toBe(true);
    });

    // (P4) importHouseRulesConfig 経路でカスタム uniqueDiceConfig が state に反映され、
    // E2 で配線済のスコア再計算が走る（固有固定値変更で score が変わる = test (3) のプリセット経路版）。
    it('(P4) importHouseRulesConfig でカスタム uniqueDiceConfig 適用 + score 再計算が走る', () => {
        // 固有スキル安定型・発動フェーズ Start の参加者を配置（test (3) と同構成）
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: 1,
            score: 0,
            history: {
                Start: {
                    baseDice: makeDice('3d8', [3, 4, 3]),
                    uniqueDice: makeDice('1d10', [8]),
                    computedScore: 0,
                },
            },
        };
        useRaceStore.setState({ participants: [uma] });
        useRaceStore.getState().setMidPhaseCount(1);
        const scoreBefore = useRaceStore.getState().participants[0].score;

        // importHouseRulesConfig 経由で安定型固定値を 5 → 12 に変更
        useRaceStore.getState().importHouseRulesConfig({
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: {
                    ...DEFAULT_UNIQUE_DICE_CONFIG,
                    Stability: { fixValue: 12, diceStr: '1d10' },
                },
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });

        // state.config.houseRules.uniqueDiceConfig がカスタム値で上書きされる
        const houseRules = useRaceStore.getState().config.houseRules;
        expect(houseRules.uniqueDiceConfig.Stability).toEqual({ fixValue: 12, diceStr: '1d10' });

        // E2 で配線済の score 再計算が走り、固有固定値 5 → 12 の差分 +7 が反映される
        const scoreAfter = useRaceStore.getState().participants[0].score;
        expect(scoreAfter - scoreBefore).toBe(7);
    });

    // (P5) importHouseRulesConfig 経路でカスタム strategies も同時に上書きされる
    // （CR-SA-15 系列の主スコープではないが、houseRules + strategies 同一トランザクション保証の証跡）
    it('(P5) importHouseRulesConfig で houseRules + strategies が同一トランザクションで上書きされる', () => {
        const customStrategy: Strategy = {
            name: 'カスタム脚質X',
            fixValue: 99,
            dice: { start: '3d6', mid: '3d6', end: '3d6' },
            paceModifiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        };
        useRaceStore.getState().importHouseRulesConfig({
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: customUniqueDiceConfig,
            },
            strategies: [
                {
                    ...customStrategy,
                    paceModifiers: customStrategy.paceModifiers as Record<string, number>,
                },
            ],
        });

        const state = useRaceStore.getState();
        expect(state.config.houseRules.uniqueDiceConfig).toEqual(customUniqueDiceConfig);
        expect(state.strategies).toHaveLength(1);
        expect(state.strategies[0].name).toBe('カスタム脚質X');
    });
});

// CR-SA-16-E1 / 2026-05-15:
// 配布運用対応 UI の基盤となる appliedPresetName + isPresetDirty フィールド + 各 action 更新ロジック +
// 永続化マイグレーション + LocalStorage payload に `name` 含める拡張の検証
// （scene1-setup.md §0-2 / §0-4 + modal-houserule.md §3.1 / §3.2 SSoT）。
// 既存 savePreset / loadPreset / importHouseRulesConfig describe と同パターン:
// in-memory localStorage モック化 + resetRace + resetStrategies で前段リーク防止。
describe('CR-SA-16-E1 / 2026-05-15 appliedPresetName + isPresetDirty', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // (S1) 初期 state: appliedPresetName === null + isPresetDirty === false
    it('(S1) 初期 state: appliedPresetName === null + isPresetDirty === false', () => {
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBeNull();
        expect(state.isPresetDirty).toBe(false);
    });

    // (S2) savePreset(name) 成功時: appliedPresetName === trimmed + isPresetDirty === false
    it('(S2) savePreset(name) 成功時: appliedPresetName === trimmed + isPresetDirty === false', () => {
        // 事前に dirty 状態を作る（updateHouseRules で isPresetDirty=true）
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        useRaceStore.getState().savePreset('  プリセットA  ');
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBe('プリセットA');
        expect(state.isPresetDirty).toBe(false);
    });

    // (S3) savePreset 時 LocalStorage payload に name フィールド含有
    // （modal-houserule.md §3.1 SSoT、loadPreset 経路で zod 検証経由復元の前提）
    it('(S3) savePreset 時 LocalStorage payload に name フィールドが含まれる', () => {
        useRaceStore.getState().savePreset('プリセットB');
        const raw = mockStorage.getItem(`${PRESET_KEY_PREFIX}プリセットB`);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.name).toBe('プリセットB');
        // 既存 houseRules + strategies も維持（後方互換）
        expect(parsed.houseRules).toBeDefined();
        expect(Array.isArray(parsed.strategies)).toBe(true);
    });

    // (S4) loadPreset(name) 成功時: name を含む payload を事前格納 → appliedPresetName セット + dirty リセット
    it('(S4) loadPreset(name) 成功時: appliedPresetName === name + isPresetDirty === false', () => {
        useRaceStore.getState().savePreset('プリセットC');
        // dirty 状態を作る + appliedPresetName を一旦変更
        useRaceStore.getState().updateHouseRules({ enableBondSkill: true });
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        useRaceStore.getState().loadPreset('プリセットC');
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBe('プリセットC');
        expect(state.isPresetDirty).toBe(false);
    });

    // (S5) loadPreset で name 欠落の古いプリセット読込時: appliedPresetName === 引数 name（後方互換性）
    // CR-SA-16-E2 Round 2 / 2026-05-15: scene1-setup.md §0-4 SSoT「loadPreset(name) 成功時 = name をセット」
    // に厳密準拠する形に修正（E1 では `config.name ?? null` のみ反映 → null になっていた）。
    // 旧形式プリセット（JSON 内 name フィールド欠落）でも、LocalStorage キー末尾（= 引数 name =
    // `保存済みプリセット` 一覧の表示名）が透過的に appliedPresetName に反映されることの構造的証跡。
    // 採用案 c 例外（useRaceStore.ts loadPreset 1 行改修、ユーザー Round 2 承認済）の追従テスト。
    it('(S5) loadPreset で name 欠落の古いプリセット読込: appliedPresetName === 引数 name + isPresetDirty === false', () => {
        // name フィールドを含まない旧形式 payload を直接格納（CR-SA-16-E1 以前の savePreset 出力相当）
        const legacyPayload = JSON.stringify({
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        mockStorage.setItem(`${PRESET_KEY_PREFIX}旧プリセット`, legacyPayload);

        useRaceStore.getState().loadPreset('旧プリセット');
        const state = useRaceStore.getState();
        // CR-SA-16-E2 Round 2: 引数 name が透過的に appliedPresetName に反映される（旧形式 JSON 後方互換）。
        expect(state.appliedPresetName).toBe('旧プリセット');
        expect(state.isPresetDirty).toBe(false);
    });

    // (S6) importHouseRulesConfig(config) with name: config.name 反映 + dirty リセット
    it('(S6) importHouseRulesConfig(config) with name: appliedPresetName === config.name + isPresetDirty === false', () => {
        // dirty 状態を作る
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        useRaceStore.getState().importHouseRulesConfig({
            name: 'ImportedX',
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBe('ImportedX');
        expect(state.isPresetDirty).toBe(false);
    });

    // (S7) importHouseRulesConfig(config) without name: appliedPresetName === null + dirty リセット
    it('(S7) importHouseRulesConfig(config) without name: appliedPresetName === null + isPresetDirty === false', () => {
        // 事前に名前付きで Import した状態を作る
        useRaceStore.getState().importHouseRulesConfig({
            name: 'Previous',
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        expect(useRaceStore.getState().appliedPresetName).toBe('Previous');

        // name フィールドを省略した Import → null リセット
        useRaceStore.getState().importHouseRulesConfig({
            houseRules: {
                enableModifier: true,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBeNull();
        expect(state.isPresetDirty).toBe(false);
    });

    // (S8) updateHouseRules({ ... }): isPresetDirty === true + appliedPresetName 不変
    it('(S8) updateHouseRules({ enableModifier: true }): isPresetDirty === true + appliedPresetName 不変', () => {
        useRaceStore.getState().savePreset('keepName');
        expect(useRaceStore.getState().appliedPresetName).toBe('keepName');
        expect(useRaceStore.getState().isPresetDirty).toBe(false);

        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        const state = useRaceStore.getState();
        expect(state.isPresetDirty).toBe(true);
        expect(state.appliedPresetName).toBe('keepName'); // 不変
    });

    // (S9) addStrategy 成功時: isPresetDirty === true + appliedPresetName 不変
    it('(S9) addStrategy 成功時: isPresetDirty === true + appliedPresetName 不変', () => {
        useRaceStore.getState().savePreset('keepName2');
        const customX: Strategy = {
            name: 'カスタムX',
            fixValue: 5,
            dice: { start: '2d5', mid: '2d5', end: '2d5' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customX);
        const state = useRaceStore.getState();
        expect(state.isPresetDirty).toBe(true);
        expect(state.appliedPresetName).toBe('keepName2'); // 不変
    });

    // (S10) addStrategy no-op（存在しない insertAfterName）: isPresetDirty 不変
    it('(S10) addStrategy no-op（存在しない insertAfterName）: isPresetDirty 不変', () => {
        // savePreset 後で dirty=false 状態にする
        useRaceStore.getState().savePreset('noOpCase');
        expect(useRaceStore.getState().isPresetDirty).toBe(false);

        const customY: Strategy = {
            name: 'カスタムY',
            fixValue: 5,
            dice: { start: '2d5', mid: '2d5', end: '2d5' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('存在しない脚質', customY);
        expect(useRaceStore.getState().isPresetDirty).toBe(false); // 不変
    });

    // (S11) updateStrategy 成功時: isPresetDirty === true
    it('(S11) updateStrategy 成功時: isPresetDirty === true', () => {
        useRaceStore.getState().savePreset('keepName3');
        useRaceStore.getState().updateStrategy('先行', { fixValue: 99 });
        expect(useRaceStore.getState().isPresetDirty).toBe(true);
        expect(useRaceStore.getState().appliedPresetName).toBe('keepName3');
    });

    // (S12) removeStrategy 成功時: isPresetDirty === true（カスタム脚質を事前追加した状態で）
    it('(S12) removeStrategy 成功時: isPresetDirty === true', () => {
        const customZ: Strategy = {
            name: 'カスタムZ',
            fixValue: 5,
            dice: { start: '2d5', mid: '2d5', end: '2d5' },
            paceModifiers: {},
        };
        useRaceStore.getState().addStrategy('逃げ', customZ);
        useRaceStore.getState().savePreset('keepName4'); // ここで dirty=false
        expect(useRaceStore.getState().isPresetDirty).toBe(false);

        useRaceStore.getState().removeStrategy('カスタムZ');
        expect(useRaceStore.getState().isPresetDirty).toBe(true);
        expect(useRaceStore.getState().appliedPresetName).toBe('keepName4');
    });

    // (S13) resetRace(): appliedPresetName === null + isPresetDirty === false
    it('(S13) resetRace(): appliedPresetName === null + isPresetDirty === false（事前に非デフォルト値にセット）', () => {
        useRaceStore.getState().savePreset('beforeReset');
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        expect(useRaceStore.getState().appliedPresetName).toBe('beforeReset');
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        useRaceStore.getState().resetRace();
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBeNull();
        expect(state.isPresetDirty).toBe(false);
    });

    // (S14) deletePreset(name) で name === appliedPresetName: appliedPresetName === null + dirty リセット
    it('(S14) deletePreset(name) で name === appliedPresetName: appliedPresetName === null + isPresetDirty === false', () => {
        useRaceStore.getState().savePreset('deleteMe');
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        expect(useRaceStore.getState().appliedPresetName).toBe('deleteMe');
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        useRaceStore.getState().deletePreset('deleteMe');
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBeNull();
        expect(state.isPresetDirty).toBe(false);
    });

    // (S15) deletePreset(name) で name !== appliedPresetName: appliedPresetName / isPresetDirty 不変
    it('(S15) deletePreset(name) で name !== appliedPresetName: appliedPresetName / isPresetDirty 不変', () => {
        useRaceStore.getState().savePreset('keepThis');
        useRaceStore.getState().savePreset('alsoSaved'); // appliedPresetName = 'alsoSaved' に更新
        useRaceStore.getState().updateHouseRules({ enableModifier: true });
        expect(useRaceStore.getState().appliedPresetName).toBe('alsoSaved');
        expect(useRaceStore.getState().isPresetDirty).toBe(true);

        // 'keepThis' を削除しても 'alsoSaved' は不変
        useRaceStore.getState().deletePreset('keepThis');
        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBe('alsoSaved'); // 不変
        expect(state.isPresetDirty).toBe(true); // 不変
    });

    // (S16) persistPartialize 出力に 2 フィールド含有
    it('(S16) persistPartialize 出力に appliedPresetName / isPresetDirty が含まれる', () => {
        useRaceStore.getState().savePreset('partializeTest');
        const state = useRaceStore.getState();
        const partial = persistPartialize(state);
        expect(partial.appliedPresetName).toBe('partializeTest');
        expect(partial.isPresetDirty).toBe(false);
        // 既存 6 フィールド + 2 フィールド = 8 フィールド + uiState
        expect(Object.keys(partial)).toEqual(
            expect.arrayContaining([
                'config',
                'participants',
                'currentPhaseId',
                'paceResult',
                'strategies',
                'gateAssignments',
                'appliedPresetName',
                'isPresetDirty',
                'uiState',
            ])
        );
    });

    // (S17) persistMigrate で 2 フィールド欠落の旧データ補完
    it('(S17) persistMigrate で旧データ（2 フィールド欠落 version=4 相当）が null / false で補完される', () => {
        // version=4 相当の旧データ（appliedPresetName / isPresetDirty 欠落）
        const legacyState = {
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    enableExtendedUnique: false,
                    enableBondSkill: false,
                    effectValue: 15,
                    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: { face: null, label: null },
            strategies: DEFAULT_STRATEGIES,
            gateAssignments: null,
            uiState: { scene: 'setup' },
        };
        const migrated = persistMigrate(legacyState, 4);
        expect(migrated.appliedPresetName).toBeNull();
        expect(migrated.isPresetDirty).toBe(false);
    });

    // (S18) PERSIST_VERSION === 6（バンプの構造的証跡）
    // CR-SA-19 / 2026-06-06: 5 → 6（uniqueDiceConfig 旧 5 キー → 新 7 キー補完）
    it('(S18) PERSIST_VERSION === 6', () => {
        expect(PERSIST_VERSION).toBe(6);
    });
});

// CR-SA-16-E2 Round 2 / 2026-05-15:
// loadPreset(name) の appliedPresetName 反映が「JSON 内 name フィールド」依存ではなく
// 「引数 name（= LocalStorage キー末尾 = `保存済みプリセット` 一覧の表示名）」に統一されたことの検証。
// scene1-setup.md §0-4 SSoT「loadPreset(name) 成功時 = name をセット」を厳密に満たす後方互換修正。
// 採用案 c 例外（useRaceStore.ts loadPreset 1 行改修、ユーザー Round 2 承認済 = ESCALATION 案 X2）。
//
// localStorage は vi.stubGlobal 経由でモック注入（Bundle-11-T1 loadPreset テストと同パターン）。
describe('CR-SA-16-E2 Round 2 / 2026-05-15 loadPreset 引数 name 優先', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
        useNotificationStore.setState({ notifications: [] });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // CR-SA-16-E2 Round 2 / 2026-05-15:
    // (S19) E1 実装以前の LocalStorage プリセット（JSON 内 `name` フィールド欠落、旧形式）でも、
    // loadPreset(name) 成功時に引数 name が appliedPresetName に反映される（後方互換の要）。
    it('(S19) loadPreset 成功時、JSON に name フィールドがなくても引数 name が appliedPresetName にセットされる', () => {
        const legacyPayload = JSON.stringify({
            // `name` フィールド欠落（E1 実装以前のプリセット相当）
            houseRules: {
                enableModifier: true,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 15,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        mockStorage.setItem(`${PRESET_KEY_PREFIX}旧プリセット`, legacyPayload);

        useRaceStore.getState().loadPreset('旧プリセット');

        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBe('旧プリセット');
        expect(state.isPresetDirty).toBe(false);
        // houseRules も正しく反映されていることを併せて確認（既存挙動完全維持）
        expect(state.config.houseRules.enableModifier).toBe(true);
    });

    // CR-SA-16-E2 Round 2 / 2026-05-15:
    // (S20) LocalStorage 内 JSON の `name` フィールドが引数 name と異なる場合でも、
    // 引数 name（= LocalStorage キー末尾 = `保存済みプリセット` 一覧の表示名）が優先される。
    // scene1-setup.md §0-4 SSoT 厳密準拠 + ユーザー期待動作（命名の一貫性）。
    it('(S20) loadPreset 成功時、JSON 内 name と引数 name が異なる場合は引数 name が優先される', () => {
        const payloadWithMismatchedName = JSON.stringify({
            name: 'JSON 内別名', // 引数 name と異なる
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: true,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: false,
                effectValue: 20,
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
            },
            strategies: DEFAULT_STRATEGIES.map((s) => ({
                ...s,
                paceModifiers: s.paceModifiers as Record<string, number>,
            })),
        });
        mockStorage.setItem(`${PRESET_KEY_PREFIX}実キー名`, payloadWithMismatchedName);

        useRaceStore.getState().loadPreset('実キー名');

        const state = useRaceStore.getState();
        // 引数 name（LocalStorage キー末尾）が優先される
        expect(state.appliedPresetName).toBe('実キー名');
        expect(state.isPresetDirty).toBe(false);
    });
});

// CR-SA-16-Followup-reset-houserules / 2026-06-06:
// ハウスルール設定のみをデフォルトへ初期化する resetHouseRules action の検証
// （modal-houserule.md §5「設定の初期化」/ scene1-setup.md §0-2 状態 ① 基本ルール到達 SSoT）。
// importHouseRulesConfig と同じ score 再計算経路を使い、houseRules + strategies をデフォルト化 +
// appliedPresetName=null / isPresetDirty=false へ。participants / midPhaseCount / fullGateSize 等は保持。
describe('useRaceStore - CR-SA-16-Followup-reset-houserules / 2026-06-06 resetHouseRules action', () => {
    let mockStorage: ReturnType<typeof createMockLocalStorage>;
    beforeEach(() => {
        mockStorage = createMockLocalStorage();
        vi.stubGlobal('localStorage', mockStorage);
        useRaceStore.getState().resetRace();
        resetStrategies();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // (R1) カスタム設定 → 初期化: houseRules / strategies / effectValue / uniqueDiceConfig がデフォルト復帰
    it('(R1) カスタム houseRules + カスタム脚質 + effectValue≠15 → resetHouseRules でデフォルト復帰', () => {
        // カスタム脚質を 6 番目として追加（DEFAULT 5 脚質 + 1）
        const customStrategy: Strategy = {
            name: 'カスタム脚質X',
            fixValue: 99,
            dice: { start: '3d6', mid: '3d6', end: '3d6' },
            paceModifiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        };
        useRaceStore.setState({
            strategies: [
                ...DEFAULT_STRATEGIES.map((s) => ({
                    ...s,
                    dice: { ...s.dice },
                    paceModifiers: { ...s.paceModifiers },
                })),
                customStrategy,
            ],
        });
        // houseRules フラグ ON + effectValue 変更 + uniqueDiceConfig カスタム化
        useRaceStore.getState().updateHouseRules({
            enableModifier: true,
            enableSpecialStrategy: true,
            enableExtendedUnique: true,
            effectValue: 25,
            uniqueDiceConfig: {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 12, diceStr: '2d10' },
            },
        });
        // 事前条件確認（カスタム化されていること）
        expect(useRaceStore.getState().strategies).toHaveLength(DEFAULT_STRATEGIES.length + 1);
        expect(useRaceStore.getState().config.houseRules.effectValue).toBe(25);
        expect(useRaceStore.getState().config.houseRules.enableModifier).toBe(true);

        useRaceStore.getState().resetHouseRules();

        const state = useRaceStore.getState();
        // houseRules 全体がデフォルト（effectValue=15 + uniqueDiceConfig=DEFAULT を内包）
        expect(state.config.houseRules).toEqual(DEFAULT_HOUSE_RULES);
        expect(state.config.houseRules.effectValue).toBe(15);
        expect(state.config.houseRules.uniqueDiceConfig).toEqual(DEFAULT_UNIQUE_DICE_CONFIG);
        // strategies はデフォルト 5 脚質に戻る（カスタム脚質X 消滅）
        expect(state.strategies).toHaveLength(DEFAULT_STRATEGIES.length);
        expect(state.strategies.map((s) => s.name)).toEqual(DEFAULT_STRATEGIES.map((s) => s.name));
    });

    // (R2) プリセット名 / dirty が初期化後に null / false（状態 ① 基本ルール到達）
    it('(R2) appliedPresetName / isPresetDirty が初期化後に null / false へ', () => {
        useRaceStore.setState({ appliedPresetName: 'マイ設定', isPresetDirty: true });
        expect(useRaceStore.getState().appliedPresetName).toBe('マイ設定');

        useRaceStore.getState().resetHouseRules();

        const state = useRaceStore.getState();
        expect(state.appliedPresetName).toBeNull();
        expect(state.isPresetDirty).toBe(false);
    });

    // (R3) 初期化対象外（保持）: 出走者リスト・名前・脚質・history / midPhaseCount / fullGateSize
    it('(R3) 出走者リスト・中盤回数・フルゲート人数は初期化対象外（保持）', () => {
        const umaA = setupParticipant({
            id: 'a',
            name: 'アルファ',
            strategy: '先行',
            history: {
                Mid1: { baseDice: makeDice('3d8', [1, 2, 3]), computedScore: 0 },
            },
        });
        const umaB = setupParticipant({ id: 'b', name: 'ベータ', strategy: '差し' });
        useRaceStore.setState({
            participants: [umaA, umaB],
            config: {
                midPhaseCount: 3,
                fullGateSize: 12,
                houseRules: { ...DEFAULT_HOUSE_RULES },
            },
        });

        useRaceStore.getState().resetHouseRules();

        const state = useRaceStore.getState();
        // participants リスト自体・名前・脚質・history は保持される
        expect(state.participants).toHaveLength(2);
        expect(state.participants.map((p) => p.name)).toEqual(['アルファ', 'ベータ']);
        expect(state.participants.map((p) => p.strategy)).toEqual(['先行', '差し']);
        expect(state.participants[0].history).toHaveProperty('Mid1');
        // midPhaseCount / fullGateSize は不変
        expect(state.config.midPhaseCount).toBe(3);
        expect(state.config.fullGateSize).toBe(12);
    });

    // (R4) 全 participants の score がデフォルト houseRules / strategies で再計算される
    // （P4 = importHouseRulesConfig で Stability fixValue 5→12 = +7 の対称ケース、reset で 12→5 = -7）
    it('(R4) 全 participants の score がデフォルト houseRules / strategies で再計算される', () => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['Start'] },
            gate: 1,
            score: 0,
            history: {
                Start: {
                    baseDice: makeDice('3d8', [3, 4, 3]),
                    uniqueDice: makeDice('1d10', [8]),
                    computedScore: 0,
                },
            },
        };
        useRaceStore.setState({ participants: [uma] });
        useRaceStore.getState().setMidPhaseCount(1);
        // カスタム uniqueDiceConfig（安定型固定値 5 → 12）を適用し score を底上げ
        useRaceStore.getState().updateHouseRules({
            uniqueDiceConfig: {
                ...DEFAULT_UNIQUE_DICE_CONFIG,
                Stability: { fixValue: 12, diceStr: '1d10' },
            },
        });
        const scoreBefore = useRaceStore.getState().participants[0].score;

        useRaceStore.getState().resetHouseRules();
        const scoreAfter = useRaceStore.getState().participants[0].score;

        // デフォルト安定型固定値 5 に戻るため差分 -7（固定値 12 → 5）
        expect(scoreBefore - scoreAfter).toBe(7);
    });
});
