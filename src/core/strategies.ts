import type { Strategy, UniqueDiceConfig } from '../types';

export const PACE_MODIFIERS: Record<number, Record<string, number>> = {
    1: { '大逃げ': 12, '逃げ': 10, '先行': 5, '差し': 0, '追込': -5 },
    2: { '大逃げ': 5, '逃げ': 5, '先行': 5, '差し': 0, '追込': 0 }, // Same for 3
    3: { '大逃げ': 5, '逃げ': 5, '先行': 5, '差し': 0, '追込': 0 },
    4: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 0, '追込': 0 }, // 4,5,6 -> 0
    5: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 0, '追込': 0 },
    6: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 0, '追込': 0 },
    7: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 5, '追込': 5 }, // 7,8 -> positive for late
    8: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 5, '追込': 5 },
    9: { '大逃げ': -7, '逃げ': -5, '先行': 0, '差し': 5, '追込': 10 },
};

export const DEFAULT_STRATEGIES: Strategy[] = [
    {
        name: '大逃げ',
        fixValue: 30,
        dice: { start: '3d8', mid: '3d5', end: '-1d27' },
        paceModifiers: {}, // Handled by PACE_MODIFIERS logic globally, but could be stored here if inverted. 
        // Requirements say "based on pace dice roll... scan strategy modifiers".
        // The table is "Dice Roll -> Strategy -> Modifier".
        // So Strategy object ideally would store its modifiers for each pace roll.
        // However, standard strategies are defined in the table.
        // Let's implement helper to get modifier.
    },
    {
        name: '逃げ',
        fixValue: 15,
        dice: { start: '3d6', mid: '3d5', end: '1d7' },
        paceModifiers: {},
    },
    {
        name: '先行',
        fixValue: 10,
        dice: { start: '3d5', mid: '3d5', end: '4d5' },
        paceModifiers: {},
    },
    {
        name: '差し',
        fixValue: 5,
        dice: { start: '1d12', mid: '1d15', end: '1d33' },
        paceModifiers: {},
    },
    {
        name: '追込',
        fixValue: 0,
        dice: { start: '1d9', mid: '1d15', end: '1d46' },
        paceModifiers: {},
    },
];

// CR-SA-15-E1 / 2026-05-14: 固有スキル設定のデフォルト値（houserule-features.md §5.2 設定項目表）。
// 現行ハードコード（phaseOutput.helpers.ts の getUniqueDiceFormula / getExpectedUniqueDiceStr /
// getExpectedUniqueFixValue）と完全一致。state.config.houseRules.uniqueDiceConfig の初期値 +
// 永続化マイグレーションのデフォルト補完値として参照される。E2 で既存ハードコード関数が
// 本定数 + state 参照（state 優先 + デフォルトフォールバック、getStrategy / getPaceModifier 同パターン）
// へ切り替わる。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ（-20/1d45）/ 安定型Ⅱ（0/2d7）を追加（houserule-features.md §5.2 表 SSoT）。
// 安定型Ⅱの diceStr '2d7' は固有スキル初の複数ダイス（count >= 2）。Dice.parse / calculator の sum 合算で透過対応。
export const DEFAULT_UNIQUE_DICE_CONFIG: UniqueDiceConfig = {
    Stability: { fixValue: 5, diceStr: '1d10' },
    Gamble: { fixValue: 0, diceStr: '1d20' },
    Persistent: { fixValue: 0, diceStr: '1d10' },
    SuperGamble: { fixValue: -10, diceStr: '1d35' },
    SuperStability: { fixValue: 8, diceStr: '1d3' },
    GambleII: { fixValue: -20, diceStr: '1d45' },
    StabilityII: { fixValue: 0, diceStr: '2d7' },
};

// Bundle-10-Followup-runtime-sync / 2026-05-11: state.strategies の paceModifiers を優先参照。
// 未定義時のみ固定テーブル PACE_MODIFIERS にフォールバックし、DEFAULT 5 脚質互換性を維持する。
export function getPaceModifier(
    strategyName: string,
    paceRoll: number,
    strategies: Strategy[],
): number {
    const strategy = strategies.find(s => s.name === strategyName);
    if (strategy?.paceModifiers && strategy.paceModifiers[paceRoll] !== undefined) {
        return strategy.paceModifiers[paceRoll];
    }
    if (!PACE_MODIFIERS[paceRoll]) return 0;
    return PACE_MODIFIERS[paceRoll][strategyName] || 0;
}

// Bundle-10-Followup-runtime-sync / 2026-05-11: state.strategies のみから検索する形に変更。
// DEFAULT 5 脚質も含めて state.strategies が SSoT として動作するため、ユーザー編集が実機計算に反映される。
export function getStrategy(name: string, strategies: Strategy[]): Strategy | undefined {
    return strategies.find(s => s.name === name);
}

export function getPaceLabel(face: number): string {
    if (face === 1) return 'ドスロー';
    if (face >= 2 && face <= 3) return 'スロー';
    if (face >= 4 && face <= 6) return 'ミドル';
    if (face >= 7 && face <= 8) return 'ハイ';
    if (face === 9) return '超ハイ';
    return '不明';
}

export function getStrategyDice(strategy: Strategy, phaseId: string): string {
    if (phaseId === 'Start') return strategy.dice.start;
    if (phaseId.startsWith('Mid')) return strategy.dice.mid;
    if (phaseId === 'End') return strategy.dice.end;
    return 'dice0d0'; // Fallback
}
