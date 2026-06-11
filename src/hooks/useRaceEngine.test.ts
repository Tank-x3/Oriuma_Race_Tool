import { describe, it, expect } from 'vitest';
import { computePrevPhasePlan, buildPhaseSequence, getPhaseLabel } from './useRaceEngine';

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

// CR-SA-17-E4 / 2026-06-08: フェーズ構成変更（houserule-features.md §7）の進行列生成（純粋関数）。
describe('buildPhaseSequence - CR-SA-17-E4 / 進行フェーズ列生成 + OFF 透過ゲート', () => {
    // ★OFF 透過: enablePhaseConfig=false のとき config に可変値が残っていても固定列を返す
    it('OFF: 可変値（序盤2/終盤2/ペース中盤後）が残っていても現行固定列 [Start, Pace, Mid, End]', () => {
        expect(buildPhaseSequence(false, 2, 1, 2, 'Mid')).toEqual(['Start', 'Pace', 'Mid', 'End']);
    });

    it('OFF: midPhaseCount=2 でも [Start, Pace, Mid1, Mid2, End]（現行と完全同一）', () => {
        expect(buildPhaseSequence(false, 3, 2, 4, 'End2')).toEqual(['Start', 'Pace', 'Mid1', 'Mid2', 'End']);
    });

    it('OFF: midPhaseCount=0 でも [Start, Pace, End]（現行と完全同一）', () => {
        expect(buildPhaseSequence(false, 1, 0, 1, 'Start')).toEqual(['Start', 'Pace', 'End']);
    });

    // ON: 可変構成 + ペース位置挿入
    it('ON: 序盤2/中盤1/終盤1/ペース中盤後 → [Start1, Start2, Mid, Pace, End]', () => {
        expect(buildPhaseSequence(true, 2, 1, 1, 'Mid')).toEqual(['Start1', 'Start2', 'Mid', 'Pace', 'End']);
    });

    it('ON: 序盤1/中盤1/終盤2/ペース序盤後（デフォルト）→ [Start, Pace, Mid, End1, End2]', () => {
        expect(buildPhaseSequence(true, 1, 1, 2, 'Start')).toEqual(['Start', 'Pace', 'Mid', 'End1', 'End2']);
    });

    it('ON: ペース位置「なし」（null）→ Pace 非挿入 [Start, Mid, End]', () => {
        expect(buildPhaseSequence(true, 1, 1, 1, null)).toEqual(['Start', 'Mid', 'End']);
    });

    it('ON: 序盤2/中盤2/終盤2/ペース中盤2後 → [Start1, Start2, Mid1, Mid2, Pace, End1, End2]', () => {
        expect(buildPhaseSequence(true, 2, 2, 2, 'Mid2')).toEqual(
            ['Start1', 'Start2', 'Mid1', 'Mid2', 'Pace', 'End1', 'End2'],
        );
    });

    it('ON: ペース位置が列に存在しない無効値 → Pace 非挿入（防御的、なし相当）', () => {
        expect(buildPhaseSequence(true, 1, 1, 1, 'Mid2')).toEqual(['Start', 'Mid', 'End']);
    });
});

describe('getPhaseLabel - CR-SA-17-E4 / 可変序盤・終盤ラベル', () => {
    it('単一フェーズは従来どおり', () => {
        expect(getPhaseLabel('Start')).toBe('序盤');
        expect(getPhaseLabel('Mid')).toBe('中盤');
        expect(getPhaseLabel('End')).toBe('終盤');
        expect(getPhaseLabel('Pace')).toBe('ペース判定');
    });

    it('可変序盤 Start1/Start2 → 序盤1/序盤2', () => {
        expect(getPhaseLabel('Start1')).toBe('序盤1');
        expect(getPhaseLabel('Start2')).toBe('序盤2');
    });

    it('可変終盤 End1/End2 → 終盤1/終盤2', () => {
        expect(getPhaseLabel('End1')).toBe('終盤1');
        expect(getPhaseLabel('End2')).toBe('終盤2');
    });

    it('中盤連番は従来どおり Mid1/Mid2 → 中盤1/中盤2', () => {
        expect(getPhaseLabel('Mid1')).toBe('中盤1');
        expect(getPhaseLabel('Mid2')).toBe('中盤2');
    });

    it('未知 ID はそのまま返す', () => {
        expect(getPhaseLabel('setup')).toBe('setup');
    });
});
