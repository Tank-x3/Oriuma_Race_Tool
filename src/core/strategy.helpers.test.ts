import { describe, it, expect } from 'vitest';
import {
    isMidRace,
    isStrategyInUse,
    isDefaultStrategy,
    DEFAULT_STRATEGY_NAMES,
} from './strategy.helpers';
import type { DiceResult, Umamusume } from '../types';

const makeParticipant = (override: Partial<Umamusume> = {}): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '先行',
    uniqueSkill: { type: 'Stability', phases: [] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

const makeDice = (str: string, values: number[]): DiceResult => ({
    diceStr: str,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

describe('isMidRace - Bundle-10-T1', () => {
    it('全 participant の history.Start.baseDice 不在 → false（Pre-Race）', () => {
        const participants = [
            makeParticipant({ id: 'p1' }),
            makeParticipant({ id: 'p2' }),
        ];
        expect(isMidRace(participants)).toBe(false);
    });

    it('1 名でも history.Start.baseDice 存在 → true（Mid-Race）', () => {
        const participants = [
            makeParticipant({ id: 'p1' }),
            makeParticipant({
                id: 'p2',
                history: { Start: { baseDice: makeDice('3d6', [3, 4, 5]), computedScore: 0 } },
            }),
        ];
        expect(isMidRace(participants)).toBe(true);
    });

    it('participants 空配列 → false', () => {
        expect(isMidRace([])).toBe(false);
    });
});

describe('isStrategyInUse - Bundle-10-T1', () => {
    it('該当 strategy 名を選択した participant が 1 名以上 → true', () => {
        const participants = [
            makeParticipant({ id: 'p1', strategy: '逃げ' }),
            makeParticipant({ id: 'p2', strategy: 'カスタムA' }),
        ];
        expect(isStrategyInUse('カスタムA', participants)).toBe(true);
    });

    it('該当 strategy 名を選択した participant ゼロ → false', () => {
        const participants = [
            makeParticipant({ id: 'p1', strategy: '逃げ' }),
            makeParticipant({ id: 'p2', strategy: '差し' }),
        ];
        expect(isStrategyInUse('カスタムA', participants)).toBe(false);
    });

    it('participants 空配列 → false', () => {
        expect(isStrategyInUse('逃げ', [])).toBe(false);
    });
});

describe('isDefaultStrategy - Bundle-10-T1', () => {
    it('デフォルト 5 脚質名のいずれか → true', () => {
        expect(isDefaultStrategy('大逃げ')).toBe(true);
        expect(isDefaultStrategy('逃げ')).toBe(true);
        expect(isDefaultStrategy('先行')).toBe(true);
        expect(isDefaultStrategy('差し')).toBe(true);
        expect(isDefaultStrategy('追込')).toBe(true);
    });

    it('カスタム名 → false', () => {
        expect(isDefaultStrategy('カスタムA')).toBe(false);
        expect(isDefaultStrategy('逃げ ')).toBe(false); // 末尾スペース
    });

    it('空文字 → false', () => {
        expect(isDefaultStrategy('')).toBe(false);
    });

    it('DEFAULT_STRATEGY_NAMES 定数が 5 件 = デフォルト 5 脚質と整合', () => {
        expect(DEFAULT_STRATEGY_NAMES).toHaveLength(5);
        expect([...DEFAULT_STRATEGY_NAMES]).toEqual(['大逃げ', '逃げ', '先行', '差し', '追込']);
    });
});
