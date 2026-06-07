import { describe, it, expect } from 'vitest';
import { getNonPacePhaseSequence, getNonPacePhaseIds } from './phaseSequence';

// CR-SA-17-E2 / 2026-06-07: 非ペースフェーズ列生成の統一ヘルパー
// （houserule-features.md §7.3 命名規則 / §7.7 一般化対象 = Bundle-3 dedup 解消）。

describe('getNonPacePhaseSequence - CR-SA-17-E2 / houserule-features.md §7.3', () => {
    describe('OFF 時の固定構成（序盤 = 終盤 = 1）= 現行と完全同一', () => {
        it('序盤 1・中盤 0・終盤 1: [序盤, 終盤]', () => {
            expect(getNonPacePhaseSequence(1, 0, 1)).toEqual([
                { id: 'Start', label: '序盤' },
                { id: 'End', label: '終盤' },
            ]);
        });

        it('序盤 1・中盤 1・終盤 1: [序盤, 中盤, 終盤]（単一は接尾辞なし）', () => {
            expect(getNonPacePhaseSequence(1, 1, 1)).toEqual([
                { id: 'Start', label: '序盤' },
                { id: 'Mid', label: '中盤' },
                { id: 'End', label: '終盤' },
            ]);
        });

        it('序盤 1・中盤 2・終盤 1: 中盤のみ連番化', () => {
            expect(getNonPacePhaseSequence(1, 2, 1)).toEqual([
                { id: 'Start', label: '序盤' },
                { id: 'Mid1', label: '中盤1' },
                { id: 'Mid2', label: '中盤2' },
                { id: 'End', label: '終盤' },
            ]);
        });
    });

    describe('可変回数（§7.3 命名規則 = Start1〜 / Mid1〜 / End1〜）', () => {
        it('序盤 2・中盤 1・終盤 1: 序盤が Start1 / Start2 + ラベル 序盤1 / 序盤2', () => {
            expect(getNonPacePhaseSequence(2, 1, 1)).toEqual([
                { id: 'Start1', label: '序盤1' },
                { id: 'Start2', label: '序盤2' },
                { id: 'Mid', label: '中盤' },
                { id: 'End', label: '終盤' },
            ]);
        });

        it('序盤 1・中盤 1・終盤 2: 終盤が End1 / End2 + ラベル 終盤1 / 終盤2', () => {
            expect(getNonPacePhaseSequence(1, 1, 2)).toEqual([
                { id: 'Start', label: '序盤' },
                { id: 'Mid', label: '中盤' },
                { id: 'End1', label: '終盤1' },
                { id: 'End2', label: '終盤2' },
            ]);
        });

        it('序盤 2・中盤 2・終盤 2: 全種別が連番化', () => {
            expect(getNonPacePhaseSequence(2, 2, 2)).toEqual([
                { id: 'Start1', label: '序盤1' },
                { id: 'Start2', label: '序盤2' },
                { id: 'Mid1', label: '中盤1' },
                { id: 'Mid2', label: '中盤2' },
                { id: 'End1', label: '終盤1' },
                { id: 'End2', label: '終盤2' },
            ]);
        });

        it('序盤 3・中盤 0・終盤 4: 中盤なし + 序盤・終盤連番（ペースは含めない）', () => {
            expect(getNonPacePhaseSequence(3, 0, 4)).toEqual([
                { id: 'Start1', label: '序盤1' },
                { id: 'Start2', label: '序盤2' },
                { id: 'Start3', label: '序盤3' },
                { id: 'End1', label: '終盤1' },
                { id: 'End2', label: '終盤2' },
                { id: 'End3', label: '終盤3' },
                { id: 'End4', label: '終盤4' },
            ]);
        });
    });
});

describe('getNonPacePhaseIds - CR-SA-17-E2', () => {
    it('ラベルを落とした ID 列を返す（序盤 = 終盤 = 1）', () => {
        expect(getNonPacePhaseIds(1, 1, 1)).toEqual(['Start', 'Mid', 'End']);
    });

    it('可変回数の ID 列（序盤 2・中盤 1・終盤 2）', () => {
        expect(getNonPacePhaseIds(2, 1, 2)).toEqual([
            'Start1', 'Start2', 'Mid', 'End1', 'End2',
        ]);
    });

    it('getNonPacePhaseSequence の id と完全一致する', () => {
        const seq = getNonPacePhaseSequence(2, 3, 2);
        expect(getNonPacePhaseIds(2, 3, 2)).toEqual(seq.map(p => p.id));
    });
});
