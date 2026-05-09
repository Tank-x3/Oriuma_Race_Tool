import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Umamusume, RaceState, GateAssignment } from '../types';
import { DEFAULT_STRATEGIES as STRATEGIES } from '../core/strategies';
import { Calculator, getActivePhaseIds } from '../core/calculator';
import { useNotificationStore } from './useNotificationStore';

interface RaceStoreState extends RaceState {
    uiState: {
        scene: 'setup' | 'gate' | 'race' | 'judgment' | 'result';
        isParsingInput: boolean;
    };

    // Actions
    setMidPhaseCount: (count: number) => void;
    setFullGateSize: (size: number) => void;
    // Bundle-9 / 2026-05-10: ハウスルール 5 フィールドの部分更新 action
    updateHouseRules: (updates: Partial<RaceState['config']['houseRules']>) => void;
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
export const PERSIST_VERSION = 1;
export const RESTORE_ERROR_MESSAGE = '保存データの復元に失敗しました。新規セッションを開始します。';

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

// 当面 passthrough。将来のスキーマ変更時に version 分岐を追加する足場。
export const persistMigrate = (persistedState: unknown, _version: number): PersistedRaceState => {
    void _version;
    return persistedState as PersistedRaceState;
};

export const handleRehydrateError = (error: unknown): void => {
    if (error) {
        // 破損データ復元失敗時: zustand persist はエラー時 rehydrate を skip するため
        // 初期 state（デフォルト値）が維持される。併せてユーザー通知を発行する。
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
                            score: Calculator.calculateTotalScore(
                                p,
                                state.strategies,
                                state.paceResult.face,
                                activePhaseIds
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
            updateHouseRules: (updates) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        houseRules: {
                            ...state.config.houseRules,
                            ...updates,
                        },
                    },
                })),

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

                            next.score = Calculator.calculateTotalScore(
                                next,
                                state.strategies,
                                state.paceResult.face,
                                getActivePhaseIds(state.config.midPhaseCount)
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
                        next.score = Calculator.calculateTotalScore(
                            next,
                            state.strategies,
                            newPaceFace,
                            activePhaseIds
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
