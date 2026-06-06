export type StrategyName = '大逃げ' | '逃げ' | '先行' | '差し' | '追込' | string;

export type PhaseType = 'Start' | 'Pace' | 'Mid' | 'End';

// Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ ON 時にのみ Scene 1 選択肢へ追加
// される識別子（houserule-features.md §2 [v] 拡張固有タイプ §データ仕様 L112 例示準拠）。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（GambleII）/ 安定型Ⅱ（StabilityII）を追加（5 → 7 タイプ）。
// いずれも超ギャンブル / 超安定と同じく enableExtendedUnique ON 時のみ Scene 1 選択肢へ現れる。
export type UniqueSkillType =
    | 'Stability'
    | 'Gamble'
    | 'Persistent'
    | 'SuperGamble'
    | 'SuperStability'
    | 'GambleII'
    | 'StabilityII';

// CR-SA-15-E1 / 2026-05-14: 固有スキル設定（houserule-features.md §5）。
// 固有スキル各タイプの「固定値」「ダイス式」。デフォルト値は strategies.ts の
// DEFAULT_UNIQUE_DICE_CONFIG、state（houseRules.uniqueDiceConfig）を SSoT として保持する。
export interface UniqueDiceEntry {
    fixValue: number; // 固定値（負の整数を許容、超ギャンブルの -10 等）
    diceStr: string;  // ダイス式（XdY 形式、例: 1d10 / 1d11）
}
export type UniqueDiceConfig = Record<UniqueSkillType, UniqueDiceEntry>;

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
    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆スキル種別 (houserule-features.md §2 [v] 絆スキル §データ仕様)
    // フェーズ非依存で参加者直下に配置。終盤後一括発動のため history 配下ではない。
    bondSkill?: { type: 'BondGamble' | 'BondStable' | null };
    // Bundle-8-T1 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法発動位置 Scene 1 事前申告 (scene1-setup.md §2)
    // 値域: 'Start' | 'Mid' | 'Mid1' | 'Mid2' | 'Mid3' | 'Mid4' | null（'End' は含めない）。
    specialStrategyPhase?: string | null;
    // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法種別 Scene 1 事前申告 (scene1-setup.md §2)
    // フェーズ非依存で参加者直下に配置。Bundle-4 の history[phaseId].specialStrategy（Scene 3 戦法ボタン操作専用、フェーズ単位）
    // とは責務を完全分離する。Scene 3 戦法ボタンの初期値は本フィールドから供給される（T4 で実装、T2 では値の保存のみ）。
    specialStrategyType?: 'Makuri' | 'Tame' | null;
    gate: number | null;
    score: number;
    // History of score/dice input
    // Keyed by Phase ID.
    history: Record<string, {
        baseDice?: DiceResult;
        uniqueDice?: DiceResult;
        // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆ダイス結果保存先（終盤のみ、houserule-features.md §2 [v] 絆スキル §データ仕様）
        // Parser は終盤フェーズ解析時に【絆スキル】セクションを抽出してこのフィールドへ格納（T5 で Parser 拡張、T1 では型のみ）。
        bondDice?: DiceResult;
        // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正（GM が Scene 3 で任意に加減算する数値）。
        // CR-22 統合で理由ラベル必須化、{ value, reason } 構造体に拡張。value は整数、reason は trim 後非空。
        manualModifier?: { value: number; reason: string };
        specialStrategy?: 'Makuri' | 'Tame' | null; // 捲り/溜め
        computedScore: number; // Score at end of this phase
    }>;
    judgment?: {
        photo?: number; // 1d5 result (for ties)
        margin?: number; // 1d2 result (for 1-point diff representation)
    };
}

// CR-SA-7 / SA07: Scene 2 解析実行直後の中間状態（[4] 枠順確定リスト）を
// ストアに保持して中間リロード復元を成立させるための最小情報。
// `name` は participants から再構築可能なため除外（最小情報原則）。
export interface GateAssignment {
    id: string;
    roll: number;
    gate: number;
}

export interface RaceState {
    config: {
        midPhaseCount: number;
        fullGateSize: number | null;
        houseRules: {
            enableModifier: boolean;
            enableSpecialStrategy: boolean;
            enableCompositeUnique: boolean;
            // Bundle-1 / D-5 / 2026-05-09: 拡張固有タイプ ON/OFF（houserule-features.md §2 [v]）
            enableExtendedUnique: boolean;
            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆スキル ON/OFF（houserule-features.md §2 [v] 絆スキル）
            enableBondSkill: boolean;
            // Bundle-1 / D-5 / 2026-05-09: 状態異常効果値 (N)（houserule-features.md §3 デフォルト 15）
            effectValue: number;
            // CR-SA-15-E1 / 2026-05-14: 固有スキル設定（houserule-features.md §5）。
            // 固有スキル 5 タイプの固定値・ダイス式。state を SSoT とし、
            // デフォルト値は strategies.ts DEFAULT_UNIQUE_DICE_CONFIG。
            uniqueDiceConfig: UniqueDiceConfig;
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
    // CR-SA-7 / SA07: Scene 2 解析実行直後の中間状態。null = 未解析 / 解析失敗。
    gateAssignments: GateAssignment[] | null;
}
