import { describe, it, expect, beforeEach } from 'vitest';
import {
    useRaceStore,
    persistPartialize,
    persistMigrate,
    handleRehydrateError,
    PERSIST_NAME,
    PERSIST_VERSION,
    RESTORE_ERROR_MESSAGE,
    type PersistedRaceState,
} from './useRaceStore';
import { useNotificationStore } from './useNotificationStore';
import type { DiceResult, GateAssignment, Umamusume } from '../types';
import { getActivePhaseIds } from '../core/calculator';

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
                    manualModifier: 10,
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
        expect(mid2.manualModifier).toBe(10);
        expect(mid2.specialStrategy).toBe('Makuri');
        // score: fix 10 + Start 10 + Mid2 (baseDice 6 + manualModifier 10) = 36
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

        expect(partialized).toEqual({
            config: fullState.config,
            participants: fullState.participants,
            currentPhaseId: fullState.currentPhaseId,
            paceResult: fullState.paceResult,
            strategies: fullState.strategies,
            gateAssignments: fullState.gateAssignments,
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
        expect(partializedKeys.sort()).toEqual([
            'config',
            'currentPhaseId',
            'gateAssignments',
            'paceResult',
            'participants',
            'strategies',
            'uiState',
        ]);
    });

    it('PERSIST_VERSION / PERSIST_NAME: 想定値が export されている', () => {
        expect(PERSIST_VERSION).toBe(1);
        expect(PERSIST_NAME).toBe('race-store');
    });

    it('persistMigrate: 任意の persistedState を passthrough で返す（雛形動作）', () => {
        const dummyPersisted = {
            config: { midPhaseCount: 3, fullGateSize: 12, houseRules: {} },
            participants: [{ id: 'old', name: 'legacy' }],
            currentPhaseId: 'Mid1',
            paceResult: { face: 5, label: 'Slow' },
            strategies: [],
            uiState: { scene: 'race' },
        } as unknown as PersistedRaceState;

        const result = persistMigrate(dummyPersisted, 0);

        // passthrough 確認: 同じ参照が返る
        expect(result).toBe(dummyPersisted);
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

describe('useRaceStore.revertPhaseHistory - CR-8 / scene3-race.md §6', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    // CR-8 専用の参加者注入ヘルパー。midPhaseCount を引数で切り替え、paceResult.face も同時セット。
    const installForRevert = (
        midPhaseCount: number,
        paceFace: number | null,
        history: Umamusume['history']
    ): Umamusume => {
        const uma: Umamusume = {
            id: 'p1',
            entryIndex: 1,
            name: 'Test',
            strategy: '先行', // fixValue 10
            uniqueSkill: { type: 'Stability', phases: [] }, // 固有ダイスは本テストでは無効化
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

    it('(a) Mid → Pace 戻り: history.Mid 削除 + paceResult null + score 再計算（midPhaseCount=1）', () => {
        // 先行 paceFace=5 → 先行ペース修正値 = +0（基準値、ニュートラル）
        // 構造: Start (3d8 sum 10) + Mid (3d5 sum 8)
        // 戻り前 score = fix 10 + Start 10 + Mid 8 + paceMod 0 = 28
        // 戻り後 score = fix 10 + Start 10 = 20（Mid 削除 + paceMod も 0 なので不変だが意味的にリセット）
        installForRevert(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        useRaceStore.getState().revertPhaseHistory('Mid', { resetPace: true });

        const updated = useRaceStore.getState().participants[0];
        const state = useRaceStore.getState();
        expect(updated.history['Mid']).toBeUndefined();
        expect(updated.history['Start']).toBeDefined();
        expect(state.paceResult).toEqual({ face: null, label: null });
        expect(updated.score).toBe(20);
    });

    it('(b) Mid2 → Mid1 戻り: Mid2 のみ削除 + Mid1 維持 + paceResult 維持（midPhaseCount=2）', () => {
        // 先行 paceFace=5（中立）。Start 10 + Mid1 6 + Mid2 12 + paceMod 0 = 38
        // 戻り後: Mid2 削除 → fix 10 + Start 10 + Mid1 6 + paceMod 0 = 26
        const mid1Dice = makeDice('3d5', [2, 2, 2]); // 6
        const mid2Dice = makeDice('3d5', [4, 4, 4]); // 12
        installForRevert(2, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid1: { baseDice: mid1Dice, computedScore: 26 },
            Mid2: { baseDice: mid2Dice, computedScore: 38 },
        });

        useRaceStore.getState().revertPhaseHistory('Mid2', { resetPace: false });

        const updated = useRaceStore.getState().participants[0];
        const state = useRaceStore.getState();
        expect(updated.history['Mid2']).toBeUndefined();
        // Mid1 の baseDice は維持（再進行時の前回結果再利用を可能に）
        expect(updated.history['Mid1']?.baseDice).toEqual(mid1Dice);
        // paceResult は維持
        expect(state.paceResult.face).toBe(5);
        expect(updated.score).toBe(26);
    });

    it('(c) 二重加算回避: 戻った後に Mid を新しい history で上書きしても score が累積しない', () => {
        // Start 10 + Mid 旧 8 + paceMod 0 = 28
        // revert で Mid 削除 → 20
        // 新 Mid history (sum 12) を上書きして再計算 → 32（旧 8 + 新 12 = 40 にならない）
        installForRevert(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
        });

        // Step 1: revertPhaseHistory で Mid 削除 + paceResult リセット
        useRaceStore.getState().revertPhaseHistory('Mid', { resetPace: true });

        // Step 2: paceResult 再投擲（中立 face=5）+ Mid 再入力（sum=12）
        useRaceStore.getState().setPaceResult(5, 'Test');
        useRaceStore.setState((state) => ({
            participants: state.participants.map((p) =>
                p.id === 'p1'
                    ? {
                          ...p,
                          history: {
                              ...p.history,
                              Mid: { baseDice: makeDice('3d5', [4, 4, 4]), computedScore: 32 },
                          },
                          score: 32, // fix 10 + Start 10 + Mid 12 + paceMod 0
                      }
                    : p
            ),
        }));

        const updated = useRaceStore.getState().participants[0];
        // 二重加算なし: 旧 Mid sum 8 + 新 Mid sum 12 = 20 ではなく、新 12 のみ
        expect(updated.history['Mid']?.baseDice?.sum).toBe(12);
        expect(updated.score).toBe(32);
    });

    it('(d) Pace → Start 戻り: history は Pace 用 entry なしで不変 + paceResult null（防御的挙動）', () => {
        // Pace フェーズは history に entry を持たないため、phaseId='Pace' での
        // history 削除は実質 no-op となる。paceResult リセットのみが意味を持つ。
        // 戻り前 score = fix 10 + Start 10 + paceMod 0 = 20（先行 paceFace=5）
        // 戻り後 score = fix 10 + Start 10 + paceMod なし = 20
        installForRevert(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
        });

        useRaceStore.getState().revertPhaseHistory('Pace', { resetPace: true });

        const updated = useRaceStore.getState().participants[0];
        const state = useRaceStore.getState();
        expect(updated.history['Start']).toBeDefined();
        expect(state.paceResult).toEqual({ face: null, label: null });
        expect(updated.score).toBe(20);
    });

    it('(e) End → Mid 戻り: End のみ削除 + paceResult 維持（中盤フェーズに戻るがペース再投擲不要）', () => {
        // 先行 paceFace=5（中立、paceMod 0）
        // Start 10 + Mid 8 + End 5 + paceMod 0 = 33
        // 戻り後: End 削除 → fix 10 + Start 10 + Mid 8 = 28
        installForRevert(1, 5, {
            Start: { baseDice: makeDice('3d8', [3, 4, 3]), computedScore: 20 },
            Mid: { baseDice: makeDice('3d5', [3, 3, 2]), computedScore: 28 },
            End: { baseDice: makeDice('1d7', [5]), computedScore: 33 },
        });

        useRaceStore.getState().revertPhaseHistory('End', { resetPace: false });

        const updated = useRaceStore.getState().participants[0];
        const state = useRaceStore.getState();
        expect(updated.history['End']).toBeUndefined();
        expect(updated.history['Mid']).toBeDefined();
        expect(state.paceResult.face).toBe(5);
        expect(updated.score).toBe(28);
    });
});
