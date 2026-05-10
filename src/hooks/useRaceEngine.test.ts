import { describe, it, expect } from 'vitest';
import { computePrevPhasePlan } from './useRaceEngine';

// Bundle-6 / P4-4 + CR-19 / 2026-05-10: 仕様 scene3-race.md §6「完全な状態復元」準拠。
// CR-8 (2026-04) 由来の {revertPhaseId, resetPace, prevPhaseId} 戻り値構造は本 Bundle で
// {prevPhaseId} 単一フィールドに簡素化された。本テスト群は新戻り値構造で再構築。
// store / React に依存しない純関数のため、direct invoke で副作用なくテストする。

describe('computePrevPhasePlan - Bundle-6 / scene3-race.md §6 完全な状態復元', () => {
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

    it('Pace → Start: prevPhaseId=Start のみ返す（paceResult 保持）', () => {
        expect(computePrevPhasePlan('Pace', seq1)).toEqual({
            prevPhaseId: 'Start',
        });
    });

    it('Mid → Pace（midPhaseCount=1）: prevPhaseId=Pace のみ返す（paceResult 保持）', () => {
        expect(computePrevPhasePlan('Mid', seq1)).toEqual({
            prevPhaseId: 'Pace',
        });
    });

    it('Mid1 → Pace（midPhaseCount=2）: prevPhaseId=Pace のみ返す（paceResult 保持）', () => {
        expect(computePrevPhasePlan('Mid1', seq2)).toEqual({
            prevPhaseId: 'Pace',
        });
    });

    it('Mid2 → Mid1（midPhaseCount=2）: prevPhaseId=Mid1', () => {
        expect(computePrevPhasePlan('Mid2', seq2)).toEqual({
            prevPhaseId: 'Mid1',
        });
    });

    it('End → Mid（midPhaseCount=1）: prevPhaseId=Mid', () => {
        expect(computePrevPhasePlan('End', seq1)).toEqual({
            prevPhaseId: 'Mid',
        });
    });

    it('End → Mid2（midPhaseCount=2）: prevPhaseId=Mid2', () => {
        expect(computePrevPhasePlan('End', seq2)).toEqual({
            prevPhaseId: 'Mid2',
        });
    });
});
