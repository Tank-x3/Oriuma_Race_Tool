import { describe, it, expect, beforeEach } from 'vitest';
import { useRaceStore } from './useRaceStore';
import type { DiceResult, Umamusume } from '../types';

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
const installParticipant = (uma: Umamusume) => {
    useRaceStore.setState({ participants: [uma] });
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
