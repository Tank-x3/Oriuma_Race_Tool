import type { Strategy } from '../types';

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

export function getPaceModifier(strategyName: string, paceRoll: number): number {
    if (!PACE_MODIFIERS[paceRoll]) return 0;
    return PACE_MODIFIERS[paceRoll][strategyName] || 0;
}

export function getStrategy(name: string, customStrategies: Strategy[] = []): Strategy | undefined {
    return [...DEFAULT_STRATEGIES, ...customStrategies].find(s => s.name === name);
}

export function getPaceLabel(face: number): string {
    if (face === 1) return 'ドスロー';
    if (face >= 2 && face <= 3) return 'スロー';
    if (face >= 4 && face <= 6) return 'ミドル';
    if (face >= 7 && face <= 8) return 'ハイ';
    if (face === 9) return '超ハイ';
    return '不明';
}
