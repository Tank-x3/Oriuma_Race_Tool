import { create } from 'zustand';
import type { Umamusume, RaceState } from '../types';
import { DEFAULT_STRATEGIES as STRATEGIES } from '../core/strategies';

interface RaceStoreState extends RaceState {
    uiState: {
        scene: 'setup' | 'gate' | 'race' | 'judgment' | 'result';
        isParsingInput: boolean;
    };

    // Actions
    setMidPhaseCount: (count: number) => void;
    setFullGateSize: (size: number) => void;
    generateParticipants: (count: number) => void;
    addParticipant: (participant: Omit<Umamusume, 'score' | 'history'>) => void;
    removeParticipant: (id: string) => void;
    updateParticipant: (id: string, updates: Partial<Umamusume>) => void;
    applyGateAssignments: (assignments: { id: string; gate: number }[]) => void;
    moveToGate: () => void;
    startRace: () => void;
    setCurrentPhase: (phaseId: string) => void;
    setPaceResult: (face: number, label: string) => void;
    moveToJudgment: () => void;
    moveToResult: () => void;
    resetRace: () => void;
}

export const useRaceStore = create<RaceStoreState>((set) => ({
    config: {
        midPhaseCount: 1,
        fullGateSize: null,
        houseRules: {
            enableModifier: false,
            enableSpecialStrategy: false,
            enableCompositeUnique: false,
        },
    },
    participants: [],
    currentPhaseId: 'setup',
    paceResult: {
        face: null,
        label: null,
    },
    strategies: STRATEGIES,

    uiState: {
        scene: 'setup',
        isParsingInput: false,
    },

    setCurrentPhase: (phaseId) => set({ currentPhaseId: phaseId }),
    setPaceResult: (face, label) => set({ paceResult: { face, label } }),

    setMidPhaseCount: (count) =>
        set((state) => ({
            config: {
                ...state.config,
                midPhaseCount: count,
            }
        })),

    setFullGateSize: (size: number) =>
        set((state) => ({
            config: {
                ...state.config,
                fullGateSize: size,
            }
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
            participants: state.participants.map((p) =>
                p.id === id ? { ...p, ...updates } : p
            ),
        })),

    applyGateAssignments: (assignments) =>
        set((state) => ({
            participants: state.participants.map((p) => {
                const assignment = assignments.find((a) => a.id === p.id);
                return assignment ? { ...p, gate: assignment.gate } : p;
            }),
        })),

    moveToGate: () =>
        set((state) => ({
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

    resetRace: () =>
        set((state) => ({
            participants: [],
            config: {
                ...state.config,
                fullGateSize: null,
            },
            currentPhaseId: 'setup',
            uiState: { scene: 'setup', isParsingInput: false },
            paceResult: { face: null, label: null },
        })),
}));
