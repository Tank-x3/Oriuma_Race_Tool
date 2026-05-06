import { describe, it, expect } from 'vitest';
import { computePrevPhasePlan } from './useRaceEngine';

// CR-8: prevPhase の純粋計画決定ロジックの単体検証。
// store / React に依存しない純関数のため、direct invoke で副作用なくテストする。

describe('computePrevPhasePlan - CR-8 / scene3-race.md §6', () => {
    // midPhaseCount=1 を想定した phaseSequence
    const seq1 = ['Start', 'Pace', 'Mid', 'End'];
    // midPhaseCount=2 を想定した phaseSequence
    const seq2 = ['Start', 'Pace', 'Mid1', 'Mid2', 'End'];

    it('(d) 序盤(Start)からの呼び出し: null を返す（hook 側 no-op、Scene 2 遷移は呼び出し元責務）', () => {
        expect(computePrevPhasePlan('Start', seq1)).toBeNull();
        expect(computePrevPhasePlan('Start', seq2)).toBeNull();
    });

    it('レースループ外フェーズ（setup / gate_lottery 等）: null を返す（防御的挙動）', () => {
        expect(computePrevPhasePlan('setup', seq1)).toBeNull();
        expect(computePrevPhasePlan('gate_lottery', seq1)).toBeNull();
        expect(computePrevPhasePlan('judgment_phase', seq1)).toBeNull();
    });

    it('Pace → Start: revertPhaseId=Pace + resetPace=true + prevPhaseId=Start', () => {
        expect(computePrevPhasePlan('Pace', seq1)).toEqual({
            revertPhaseId: 'Pace',
            resetPace: true,
            prevPhaseId: 'Start',
        });
    });

    it('Mid → Pace（midPhaseCount=1）: 最初の Mid からの戻りなので resetPace=true', () => {
        expect(computePrevPhasePlan('Mid', seq1)).toEqual({
            revertPhaseId: 'Mid',
            resetPace: true,
            prevPhaseId: 'Pace',
        });
    });

    it('Mid1 → Pace（midPhaseCount=2）: 最初の Mid からの戻りなので resetPace=true', () => {
        expect(computePrevPhasePlan('Mid1', seq2)).toEqual({
            revertPhaseId: 'Mid1',
            resetPace: true,
            prevPhaseId: 'Pace',
        });
    });

    it('Mid2 → Mid1（midPhaseCount=2）: 最初の Mid ではないので resetPace=false', () => {
        expect(computePrevPhasePlan('Mid2', seq2)).toEqual({
            revertPhaseId: 'Mid2',
            resetPace: false,
            prevPhaseId: 'Mid1',
        });
    });

    it('End → Mid（midPhaseCount=1）: ペース戻りでないので resetPace=false', () => {
        expect(computePrevPhasePlan('End', seq1)).toEqual({
            revertPhaseId: 'End',
            resetPace: false,
            prevPhaseId: 'Mid',
        });
    });

    it('End → Mid2（midPhaseCount=2）: ペース戻りでないので resetPace=false', () => {
        expect(computePrevPhasePlan('End', seq2)).toEqual({
            revertPhaseId: 'End',
            resetPace: false,
            prevPhaseId: 'Mid2',
        });
    });
});
