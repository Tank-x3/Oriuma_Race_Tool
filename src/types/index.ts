export type StrategyName = '大逃げ' | '逃げ' | '先行' | '差し' | '追込' | string;

export type PhaseType = 'Start' | 'Pace' | 'Mid' | 'End';

// Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ ON 時にのみ Scene 1 選択肢へ追加
// される識別子（houserule-features.md §2 [v] 拡張固有タイプ §データ仕様 L112 例示準拠）。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（GambleII）/ 安定型Ⅱ（StabilityII）を追加（5 → 7 タイプ）。
// いずれも超ギャンブル / 超安定と同じく enableExtendedUnique ON 時のみ Scene 1 選択肢へ現れる。
// CR-SA-21+22-E1 / 2026-07-06: 「なし」「カスタム」との型分離のため組み込み 7 タイプを
// BuiltInUniqueSkillType として独立させ、UniqueSkillType は拡張後の値域（正式値）とする。
// 設定表（UniqueDiceConfig）等の「組み込み専用」データ構造は BuiltInUniqueSkillType を使用する。
export type BuiltInUniqueSkillType =
    | 'Stability'
    | 'Gamble'
    | 'Persistent'
    | 'SuperGamble'
    | 'SuperStability'
    | 'GambleII'
    | 'StabilityII';

// CR-SA-21+22-E1 / 2026-07-06: 出走者の固有スキル選択値の値域
// （houserule-features.md §8.2 + §2 [v] 固有スキルなし出走者「データ仕様」SSoT）。
// 'None' = §2 [v] 固有スキルなし出走者の正式値（未選択 null / '---' とは明確に区別）。
// 'Custom' = §8 カスタム固有スキル参照。詳細は Umamusume.uniqueSkill.customUniqueSkillId を併用。
export type UniqueSkillType = BuiltInUniqueSkillType | 'None' | 'Custom';

// CR-SA-15-E1 / 2026-05-14: 固有スキル設定（houserule-features.md §5）。
// 固有スキル各タイプの「固定値」「ダイス式」。デフォルト値は strategies.ts の
// DEFAULT_UNIQUE_DICE_CONFIG、state（houseRules.uniqueDiceConfig）を SSoT として保持する。
export interface UniqueDiceEntry {
    fixValue: number; // 固定値（負の整数を許容、超ギャンブルの -10 等）
    diceStr: string;  // ダイス式（XdY 形式、例: 1d10 / 1d11）
}
// CR-SA-21+22-E1 / 2026-07-06: 設定表は組み込み 7 タイプ専用（§8.2「別フィールド」方針）。
// 'None' / 'Custom' は本 Record のキーには含まれない（カスタムは houseRules.customUniqueSkills
// の配列で個別保持し、「なし」は固有ダイス自体を持たない）。
export type UniqueDiceConfig = Record<BuiltInUniqueSkillType, UniqueDiceEntry>;

// CR-SA-21+22-E1 / 2026-07-06: カスタム固有スキル（houserule-features.md §8.2）。
// 組み込み 7 タイプの `uniqueDiceConfig`（キー固定 Record）とは別フィールドで、
// `houseRules.customUniqueSkills: CustomUniqueSkill[]` として保持する。
// `id` は追加時に自動採番する不変 ID（出走者からの参照は `id` 経由、rename 安全）。
// `name` は Scene 1 選択肢等に表示する自由名称（バリデーションは §8.3 参照）。
export interface CustomUniqueSkill {
    id: string;      // 不変識別子（crypto.randomUUID 等、Engineer 裁量。出走者からの参照キー）
    name: string;    // 表示名（20 文字以内、trim 後空欄禁止、禁止文字 + / = / 改行、予約語重複禁止）
    fixValue: number; // 整数（負値許容、小数不可）
    diceStr: string;  // XdY 形式（/^\d+d\d+$/）
}

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
        // CR-SA-21+22-E1 / 2026-07-06: カスタム固有スキル参照（houserule-features.md §8.2）。
        // `type === 'Custom'` のとき houseRules.customUniqueSkills の当該 id を指す。
        // 組み込み 7 タイプ / 'None' の場合は不要（未設定 = undefined）。
        customUniqueSkillId?: string;
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

// CR-SA-17-E1 / 2026-06-06: ペース挿入位置の内部表現（houserule-features.md §7.5 アンカー方式）。
// 「どのフェーズの直後にペースを挟むか」を当該フェーズの ID（例: 'Start' / 'Mid1'）で保持する。
// null = ペースなし（ペース 0 回。§7.2 の「なし」許可）。
// デフォルト = 'Start'（序盤 1 回構成の最後の序盤フェーズ ID = 「序盤ブロック直後」を表す、§7.5）。
// アンカー候補の動的生成・禁止構成バリデーション（start 前 / end 後）・フェーズ列への実挿入は E2/E3 スコープ。
export type PacePosition = string | null;

export interface RaceState {
    config: {
        midPhaseCount: number;
        // CR-SA-17-E1 / 2026-06-06: フェーズ構成変更（houserule-features.md §7.2）。
        // 序盤回数 / 終盤回数（各 1〜4、デフォルト 1）+ ペース挿入位置（PacePosition）。
        // midPhaseCount と並列のレース個別設定（ハウスルール JSON プリセット非対象、§7.8）。
        // enablePhaseConfig=false（デフォルト）時は UI 非表示・既定値固定で現行構成を維持（OFF 透過）。
        startPhaseCount: number;
        endPhaseCount: number;
        pacePosition: PacePosition;
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
            // CR-SA-17-E1 / 2026-06-06: フェーズ構成変更ハウスルールの ON/OFF（houserule-features.md §7 / §2 [v]）。
            // ハウスルールトグル = JSON プリセット対象（§7.8）。デフォルト false。
            // ON 時のみ序盤・終盤回数 / ペース位置の設定 UI を開放（E3 スコープ）。
            enablePhaseConfig: boolean;
            // CR-SA-20-E1 / 2026-06-11: 隊列〔バ群〕ダイスの ON/OFF（houserule-features.md §6 / §2 [v]）。
            // ハウスルールトグル = JSON プリセット対象（§6.7）。デフォルト false。
            // ON 時のみ隊列フェーズ・関連 UI を開放（効果表・補正は E2、UI は E3、進行統合は E4 スコープ）。
            enableFormationDice: boolean;
            // CR-SA-22 / CR-SA-21+22-E1 / 2026-07-06: 固有スキルなし出走者を許可するハウスルール
            // （houserule-features.md §2 [v] 固有スキルなし出走者 / §4 zod 検証範囲）。
            // ハウスルールトグル = JSON プリセット対象（§8.7 で customUniqueSkills と合同マイグレ）。
            // デフォルト false。ON 時のみ Scene 1 選択肢先頭に「なし」が現れる（UI は E2 スコープ）。
            enableNoUniqueSkill: boolean;
            // CR-SA-21 / CR-SA-21+22-E1 / 2026-07-06: カスタム固有スキルの一覧
            // （houserule-features.md §8 / §8.2 データ構造）。組み込み 7 タイプの uniqueDiceConfig
            // とは別フィールド（キー構造が異なる。組み込み = 固定キー Record / カスタム = id 付き配列）。
            // 常時アクセス（専用トグルなし、複合固有 / 拡張固有 HR と完全独立、§8.1）。
            // JSON プリセット対象 = §8.7 で enableNoUniqueSkill と合同 v9→v10 マイグレ。
            // Scene 1 選択肢反映（末尾登録順）は E2、Scene 3 出力・R-3 拡張は E3 スコープ。
            customUniqueSkills: CustomUniqueSkill[];
        };
    };
    participants: Umamusume[];
    // Global race state
    currentPhaseId: string;
    paceResult: {
        face: number | null; // 1-9
        label: string | null; // "High", "Slow" etc - derived
    };
    // CR-SA-20-E4 / 2026-06-11: 隊列〔バ群〕ダイスの確定結果（houserule-features.md §6.2 / §6.7）。
    // ペースと同じ「GM がレース全体に 1 回振る」全体補正のため、paceResult と対称の
    // グローバル state として保持する（participants[*].history 配下ではない）。
    // face = 隊列出目（1-9）、label = 隊列形態名（超縦長/縦長/普通/団子/超団子、getFormationLabel 導出）。
    // null = 未確定。enableFormationDice OFF 時は値が残っていても計算・出力・進行へ反映しない（OFF 透過）。
    formationResult: {
        face: number | null; // 1-9
        label: string | null; // 隊列形態名
    };
    strategies: Strategy[]; // Default + Custom strategies
    // CR-SA-7 / SA07: Scene 2 解析実行直後の中間状態。null = 未解析 / 解析失敗。
    gateAssignments: GateAssignment[] | null;
}
