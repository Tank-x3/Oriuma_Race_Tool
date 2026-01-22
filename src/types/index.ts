export type StrategyName = '大逃げ' | '逃げ' | '先行' | '差し' | '追込' | string;

export type PhaseType = 'Start' | 'Pace' | 'Mid' | 'End';

export type UniqueSkillType = 'Stability' | 'Gamble' | 'Persistent';

// Represents "Start", "Pace", "Mid1", "Mid2", "End" etc.
export interface PhaseConfig {
    id: string;
    type: PhaseType;
    name: string; // Display name like "序盤", "中盤1"
    order: number;
}

export interface DiceConfig {
    count: number;
    face: number;
    modifier: number; // For "3d6+5", usually handled separately but structure supports it
}

export interface DiceResult {
    diceStr: string; // "3d6"
    values: number[]; // [2, 5, 1]
    sum: number; // 8
    isNegative?: boolean; // For "-1d27" logic
}

export interface Strategy {
    name: StrategyName;
    fixValue: number;
    dice: {
        start: string; // "3d8"
        mid: string;   // "3d5"
        end: string;   // "-1d27" or "1d7"
    };
    paceModifiers: {
        // Pace dice result (1-9) -> modifier value
        [key: number]: number;
    };
}

export interface Umamusume {
    id: string;
    entryIndex: number; // Preservation of entry order for tie-breaking
    name: string;
    strategy: StrategyName;
    uniqueSkill: {
        type: UniqueSkillType;
        phases: string[]; // Phase IDs where it activates
    };
    gate: number | null;
    score: number;
    // History of score/dice input
    // Keyed by Phase ID.
    history: Record<string, {
        baseDice?: DiceResult;
        uniqueDice?: DiceResult;
        manualModifier?: number; // From "Correct" button
        specialStrategy?: 'Makuri' | 'Tame' | null; // 捲り/溜め
        computedScore: number; // Score at end of this phase
    }>;
    judgment?: {
        photo?: number; // 1d5 result (for ties)
        margin?: number; // 1d2 result (for 1-point diff representation)
    };
}

export interface RaceState {
    config: {
        midPhaseCount: number;
        fullGateSize: number | null;
        houseRules: {
            enableModifier: boolean;
            enableSpecialStrategy: boolean;
            enableCompositeUnique: boolean;
        };
    };
    participants: Umamusume[];
    // Global race state
    currentPhaseId: string;
    paceResult: {
        face: number | null; // 1-9
        label: string | null; // "High", "Slow" etc - derived
    };
    strategies: Strategy[]; // Default + Custom strategies
}
