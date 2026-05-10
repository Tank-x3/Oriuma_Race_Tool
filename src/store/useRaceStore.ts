import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Umamusume, RaceState, GateAssignment } from '../types';
import { DEFAULT_STRATEGIES as STRATEGIES } from '../core/strategies';
import { getActivePhaseIds } from '../core/calculator';
import { useNotificationStore } from './useNotificationStore';
// Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法（捲り/溜め）の score 補正計算を純粋関数に委譲。
// calculator.ts は不変厳守エリアのため、Calculator 戻り値に上乗せする運用とする。
// Round 2 改修: 解析未実行 history を fixValue 加算から除外する一元化関数 `calculateScoreWithSpecialStrategy` を採用。
import { calculateScoreWithSpecialStrategy } from '../components/scene/race/specialStrategy.helpers';
// Bundle-7 / P4-6 / 2026-05-10: 永続化マイグレーションで houseRules を zod 検証する。
// houserule-features.md §4 zod 検証範囲表に基づく検証 + Bundle-1 で追加された 2 フィールドの補完。
import { houseRulesSchema, type HouseRulesData } from '../core/schema/houseRules';

interface RaceStoreState extends RaceState {
    uiState: {
        scene: 'setup' | 'gate' | 'race' | 'judgment' | 'result';
        isParsingInput: boolean;
    };

    // Actions
    setMidPhaseCount: (count: number) => void;
    setFullGateSize: (size: number) => void;
    // Bundle-9 / 2026-05-10: ハウスルール 5 フィールドの部分更新 action。
    // Bundle-4 / 2026-05-10: effectValue 変更時は specialStrategy 設定済参加者の score を自動再計算する。
    updateHouseRules: (updates: Partial<RaceState['config']['houseRules']>) => void;
    // Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法（捲り/溜め）の設定 + score 即時加減算。
    // value === null で取り消し（未使用扱い）。1 レース 1 回制限の判定は UI 側で行い、
    // 本 action は呼ばれた値をそのまま反映する（防御的判定なし）。
    setSpecialStrategy: (
        participantId: string,
        phaseId: string,
        value: 'Makuri' | 'Tame' | null
    ) => void;
    // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の設定 / クリア + score 即時加減算。
    // value は整数、reason は trim 後非空（CR-22 統合）。バリデーション通過済の値が渡る前提で
    // 防御的判定はモーダル側で実施し、本 action は呼ばれた値をそのまま反映する。
    setManualModifier: (
        participantId: string,
        phaseId: string,
        value: number,
        reason: string
    ) => void;
    clearManualModifier: (participantId: string, phaseId: string) => void;
    generateParticipants: (count: number) => void;
    addParticipant: (participant: Omit<Umamusume, 'score' | 'history'>) => void;
    removeParticipant: (id: string) => void;
    updateParticipant: (id: string, updates: Partial<Umamusume>) => void;
    applyGateAssignments: (assignments: { id: string; gate: number }[]) => void;
    // CR-5a-2: Scene 2 解析実行直後の中間状態（gateAssignments）の上書き / null クリア。
    setGateAssignments: (value: GateAssignment[] | null) => void;
    moveToGate: () => void;
    startRace: () => void;
    setCurrentPhase: (phaseId: string) => void;
    setPaceResult: (face: number, label: string) => void;
    // CR-8: prevPhase() からの呼び出し用。指定 phaseId の participants[].history を削除し、
    // score を再計算する。options.resetPace=true の場合は paceResult も { face: null, label: null }
    // にリセットし、その状態で score 再計算する（ペース戻り時の再投擲フロー成立条件）。
    revertPhaseHistory: (phaseId: string, options: { resetPace: boolean }) => void;
    moveToJudgment: () => void;
    moveToResult: () => void;
    moveToSetup: () => void;
    resetRace: () => void;
}

// CR-5a: localStorage に永続化される state の形。
// uiState.isParsingInput は一時 UI フラグのため除外（リロード後 false で初期化）。
// CR-5a-2: gateAssignments を中間状態として永続化対象に含める（houserule-features.md §4.2 #6）。
export type PersistedRaceState = Pick<
    RaceStoreState,
    'config' | 'participants' | 'currentPhaseId' | 'paceResult' | 'strategies' | 'gateAssignments'
> & {
    uiState: { scene: RaceStoreState['uiState']['scene'] };
};

// CR-5a: persist 設定値（テスト容易性のため module-level に分離して export）
export const PERSIST_NAME = 'race-store';
// Bundle-7 / P4-6 / 2026-05-10: PERSIST_VERSION 1 → 2 にバンプ。
// version=1 旧データ（Bundle-1 D-5 で houseRules.enableExtendedUnique / effectValue 追加前）→
// version=2 へのデフォルト補完を persistMigrate で実施する。
export const PERSIST_VERSION = 2;
export const RESTORE_ERROR_MESSAGE = '保存データの復元に失敗しました。新規セッションを開始します。';

// Bundle-7 / 2026-05-10: マイグレーション時の houseRules デフォルト補完値。
// 下記 create() の初期 state と同一値を保持。新規セッションと旧データ補完で同じ初期値が使われる。
export const DEFAULT_HOUSE_RULES: HouseRulesData = {
    enableModifier: false,
    enableSpecialStrategy: false,
    enableCompositeUnique: false,
    enableExtendedUnique: false,
    effectValue: 15,
};

export const persistPartialize = (state: RaceStoreState): PersistedRaceState => ({
    config: state.config,
    participants: state.participants,
    currentPhaseId: state.currentPhaseId,
    paceResult: state.paceResult,
    strategies: state.strategies,
    gateAssignments: state.gateAssignments,
    uiState: {
        scene: state.uiState.scene,
    },
});

// Bundle-7 / P4-6 / 2026-05-10: 実マイグレーション化。
// version=1 → 2 への補完: houseRules.enableExtendedUnique / effectValue が旧データには欠落しているため
// DEFAULT_HOUSE_RULES でマージ補完。zod 検証で型不正・値域違反（effectValue 小数/負値/上限超等）を検知し、
// 失敗時は throw → onRehydrateStorage の handleRehydrateError に合流（RESTORE_ERROR_MESSAGE 通知 +
// デフォルト state 起動）。
export const persistMigrate = (persistedState: unknown, version: number): PersistedRaceState => {
    void version; // 現状全旧データ共通で同じ補完を行うため version 分岐は不要

    if (persistedState === null || typeof persistedState !== 'object') {
        throw new Error('persisted state is not an object');
    }

    const state = persistedState as Partial<PersistedRaceState> & {
        config?: Partial<PersistedRaceState['config']> & {
            houseRules?: Partial<HouseRulesData>;
        };
    };

    const persistedHouseRules = state.config?.houseRules ?? {};
    const mergedHouseRules: HouseRulesData = {
        ...DEFAULT_HOUSE_RULES,
        ...persistedHouseRules,
    };

    const validation = houseRulesSchema.safeParse(mergedHouseRules);
    if (!validation.success) {
        throw new Error(
            `houseRules schema validation failed: ${validation.error.message}`
        );
    }

    const baseConfig = state.config ?? { midPhaseCount: 1, fullGateSize: null };
    return {
        ...state,
        config: {
            ...baseConfig,
            houseRules: validation.data,
        },
    } as PersistedRaceState;
};

export const handleRehydrateError = (error: unknown): void => {
    if (error) {
        // 破損データ復元失敗時: zustand persist はエラー時 rehydrate を skip するため
        // 初期 state（デフォルト値）が維持される。併せてユーザー通知を発行する。
        // Bundle-7 / 2026-05-10: persistMigrate の zod 検証失敗 throw もここに合流する。
        useNotificationStore.getState().addNotification('error', RESTORE_ERROR_MESSAGE);
    }
};

export const useRaceStore = create<RaceStoreState>()(
    persist(
        (set) => ({
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    // Bundle-1 / D-5 / 2026-05-09: 拡張固有タイプ ON/OFF
                    enableExtendedUnique: false,
                    // Bundle-1 / D-5 / 2026-05-09: 状態異常効果値 (N)（houserule-features.md §3 デフォルト 15）
                    effectValue: 15,
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: {
                face: null,
                label: null,
            },
            strategies: STRATEGIES,
            gateAssignments: null,

            uiState: {
                scene: 'setup',
                isParsingInput: false,
            },

            setCurrentPhase: (phaseId) => set({ currentPhaseId: phaseId }),
            setPaceResult: (face, label) => set({ paceResult: { face, label } }),

            // #1-3a-9 Soft Delete:
            // midPhaseCount を変更しても history は削除しない（データ保持）。
            // ただし合計スコア計算は「現在設定されているフェーズ」のみを合算対象とするため、
            // participants.score を新しい midPhaseCount で再計算する。
            // 回数を増やした場合は、保持されていた history[Mid2] 等が自動的に合算復帰する。
            setMidPhaseCount: (count) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(count);
                    return {
                        config: {
                            ...state.config,
                            midPhaseCount: count,
                        },
                        participants: state.participants.map(p => ({
                            ...p,
                            // Bundle-4 Round 2 / 2026-05-10: 解析未実行 phase 除外 + specialStrategy delta 一元化
                            score: calculateScoreWithSpecialStrategy(
                                p,
                                state.strategies,
                                state.paceResult.face,
                                activePhaseIds,
                                state.config.houseRules.effectValue,
                                state.config.houseRules.enableSpecialStrategy,
                            ),
                        })),
                    };
                }),

            setFullGateSize: (size: number) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        fullGateSize: size,
                    }
                })),

            // Bundle-9 / 2026-05-10: 5 フィールドのいずれか/複数を部分更新する。
            // 既存値とマージするため、未指定のフィールドは現状維持される。
            // Bundle-4 / P4-1, P4-5 / 2026-05-10: effectValue 変更時、specialStrategy 設定済の
            // 参加者は score に effectValue が反映されているため、新値で再計算する。
            updateHouseRules: (updates) =>
                set((state) => {
                    const newHouseRules = {
                        ...state.config.houseRules,
                        ...updates,
                    };
                    const newConfig = { ...state.config, houseRules: newHouseRules };

                    const effectValueChanged =
                        updates.effectValue !== undefined &&
                        updates.effectValue !== state.config.houseRules.effectValue;
                    const enableChanged =
                        updates.enableSpecialStrategy !== undefined &&
                        updates.enableSpecialStrategy !==
                            state.config.houseRules.enableSpecialStrategy;

                    if (!effectValueChanged && !enableChanged) {
                        return { config: newConfig };
                    }

                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        config: newConfig,
                        participants: state.participants.map((p) => ({
                            ...p,
                            score: calculateScoreWithSpecialStrategy(
                                p,
                                state.strategies,
                                state.paceResult.face,
                                activePhaseIds,
                                newHouseRules.effectValue,
                                newHouseRules.enableSpecialStrategy,
                            ),
                        })),
                    };
                }),

            // Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法設定 + score 即時加減算。
            // history[phaseId].specialStrategy を更新後、解析未実行 phase を除外した score を再計算。
            setSpecialStrategy: (participantId, phaseId, value) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId] ?? { computedScore: 0 };
                            const newHistory = {
                                ...p.history,
                                [phaseId]: { ...oldEntry, specialStrategy: value },
                            };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithSpecialStrategy(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules.effectValue,
                                    state.config.houseRules.enableSpecialStrategy,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の設定 + score 即時加減算。
            // history[phaseId].manualModifier = { value, reason } を更新後、Bundle-4 の純粋関数
            // calculateScoreWithSpecialStrategy 経由で score 再計算（manualModifier は Calculator 内
            // で `.value` のみ加算されるため、戦法 delta との合算挙動も統一される）。
            setManualModifier: (participantId, phaseId, value, reason) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId] ?? { computedScore: 0 };
                            const newHistory = {
                                ...p.history,
                                [phaseId]: {
                                    ...oldEntry,
                                    manualModifier: { value, reason },
                                },
                            };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithSpecialStrategy(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules.effectValue,
                                    state.config.houseRules.enableSpecialStrategy,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正のクリア + score 復元。
            // history[phaseId] から manualModifier フィールドを削除する（updateParticipant の
            // uniqueDice クリア処理と同パターン: { ...entry } して delete）。
            clearManualModifier: (participantId, phaseId) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId];
                            if (!oldEntry || oldEntry.manualModifier === undefined) {
                                return p;
                            }
                            const cleared = { ...oldEntry };
                            delete cleared.manualModifier;
                            const newHistory = { ...p.history, [phaseId]: cleared };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithSpecialStrategy(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules.effectValue,
                                    state.config.houseRules.enableSpecialStrategy,
                                ),
                            };
                        }),
                    };
                }),

            generateParticipants: (count: number) =>
                set((state) => {
                    const current = state.participants;
                    let newParticipants: Umamusume[] = [];

                    if (count >= current.length) {
                        // Keep existing and add new
                        const toAdd = count - current.length;
                        const added = Array.from({ length: toAdd }, (_, i) => ({
                            id: crypto.randomUUID(),
                            entryIndex: current.length + i + 1,
                            name: '',
                            strategy: undefined as unknown as string,
                            uniqueSkill: {
                                type: undefined as unknown as any,
                                phases: [],
                            },
                            gate: null,
                            score: 0,
                            history: {},
                        }));
                        newParticipants = [...current, ...added];
                    } else {
                        // Truncate
                        newParticipants = current.slice(0, count);
                    }

                    return { participants: newParticipants };
                }),

            addParticipant: (input) =>
                set((state) => ({
                    participants: [
                        ...state.participants,
                        {
                            ...input,
                            score: 0,
                            history: {},
                        },
                    ],
                })),

            removeParticipant: (id) =>
                set((state) => ({
                    participants: state.participants.filter((p) => p.id !== id),
                })),

            updateParticipant: (id, updates) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        if (p.id !== id) return p;
                        const next: Umamusume = { ...p, ...updates };

                        // CR-38 / basic-rules.md §6 Case 4:
                        // uniqueSkill.phases から外れたフェーズの uniqueDice をサイレント自動クリアし、
                        // スコアを再計算する。baseDice / manualModifier / specialStrategy / computedScore は保持する。
                        if (updates.uniqueSkill) {
                            const oldPhases = p.uniqueSkill?.phases ?? [];
                            const newPhases = next.uniqueSkill?.phases ?? [];
                            const removed = oldPhases.filter((ph) => !newPhases.includes(ph));

                            if (removed.length > 0) {
                                const newHistory: typeof next.history = { ...next.history };
                                for (const ph of removed) {
                                    const entry = newHistory[ph];
                                    if (entry && entry.uniqueDice !== undefined) {
                                        const cleared = { ...entry };
                                        delete cleared.uniqueDice;
                                        newHistory[ph] = cleared;
                                    }
                                }
                                next.history = newHistory;
                            }

                            // Bundle-4 / 2026-05-10: 解析未実行 phase 除外 + specialStrategy delta 上乗せの一元化関数
                            next.score = calculateScoreWithSpecialStrategy(
                                next,
                                state.strategies,
                                state.paceResult.face,
                                getActivePhaseIds(state.config.midPhaseCount),
                                state.config.houseRules.effectValue,
                                state.config.houseRules.enableSpecialStrategy,
                            );
                        } else if (updates.history) {
                            // Bundle-4 Round 2 / 2026-05-10: history 単独更新時も score 再計算（PhaseInput 解析実行経路で
                            // specialStrategy delta が反映されるようにするための連動）。
                            next.score = calculateScoreWithSpecialStrategy(
                                next,
                                state.strategies,
                                state.paceResult.face,
                                getActivePhaseIds(state.config.midPhaseCount),
                                state.config.houseRules.effectValue,
                                state.config.houseRules.enableSpecialStrategy,
                            );
                        }

                        return next;
                    }),
                })),

            applyGateAssignments: (assignments) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        const assignment = assignments.find((a) => a.id === p.id);
                        return assignment ? { ...p, gate: assignment.gate } : p;
                    }),
                })),

            setGateAssignments: (value) => set({ gateAssignments: value }),

            // CR-8: 戻り元フェーズの history を削除し、score を再計算する。
            // resetPace=true の場合は paceResult を null にリセットし、再計算もその前提で行う
            // （Mid 以降のフェーズスコアから paceModifier が外れる）。
            // 仕様根拠: scene3-race.md §6 「内容修正へ(Back)」 / CODE_REVIEW_BOARD #4-1-4
            revertPhaseHistory: (phaseId, options) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    const newPaceFace = options.resetPace ? null : state.paceResult.face;

                    const newParticipants = state.participants.map((p) => {
                        const newHistory = { ...p.history };
                        delete newHistory[phaseId];
                        const next: Umamusume = { ...p, history: newHistory };
                        // Bundle-4 / 2026-05-10: phaseId 削除で history が変わるため、specialStrategy
                        // delta も再計算（例: End 削除で終盤反動が消える、specialStrategy 発動フェーズの
                        // 削除で発動自体が取り消される）。Round 2: 解析未実行 phase 除外も一元化。
                        next.score = calculateScoreWithSpecialStrategy(
                            next,
                            state.strategies,
                            newPaceFace,
                            activePhaseIds,
                            state.config.houseRules.effectValue,
                            state.config.houseRules.enableSpecialStrategy,
                        );
                        return next;
                    });

                    return options.resetPace
                        ? {
                              participants: newParticipants,
                              paceResult: { face: null, label: null },
                          }
                        : { participants: newParticipants };
                }),

            // #1-3a-3: エントリー確定時に名前空欄行を除外し、以降の Scene では
            // 名前入力済みの有効参加者のみを扱う。仕様: scene1-setup.md ワイヤーフレーム
            // 「名前が空欄の行は無視される」。
            moveToGate: () =>
                set((state) => ({
                    participants: state.participants.filter(p => p.name.trim() !== ''),
                    uiState: { ...state.uiState, scene: 'gate' },
                    currentPhaseId: 'gate_lottery', // Use a clear ID
                })),

            startRace: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'race' },
                    currentPhaseId: 'Start',
                })),

            moveToJudgment: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'judgment' },
                    currentPhaseId: 'judgment_phase',
                })),

            moveToResult: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'result' },
                    currentPhaseId: 'result_phase',
                })),

            moveToSetup: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'setup' },
                    currentPhaseId: 'setup',
                })),

            resetRace: () => {
                set((state) => ({
                    participants: [],
                    config: {
                        ...state.config,
                        fullGateSize: null,
                    },
                    currentPhaseId: 'setup',
                    uiState: { scene: 'setup', isParsingInput: false },
                    paceResult: { face: null, label: null },
                    // CR-5a-2: 中間状態もリセット（houserule-features.md §4.5）
                    gateAssignments: null,
                }));
                // CR-5a: localStorage 側もクリア（storage 未提供環境では persist API 自体が未付与のため no-op）
                void useRaceStore.persist?.clearStorage?.();
            },
        }),
        {
            name: PERSIST_NAME,
            version: PERSIST_VERSION,
            migrate: persistMigrate,
            partialize: persistPartialize,
            onRehydrateStorage: () => (_state, error) => handleRehydrateError(error),
        }
    )
);
