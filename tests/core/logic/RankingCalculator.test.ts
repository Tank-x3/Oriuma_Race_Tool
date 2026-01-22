import { describe, it, expect } from 'vitest';
import { RankingCalculator } from '../../../src/core/logic/RankingCalculator';
import { Umamusume } from '../../../src/types';

const createMockUma = (id: string, name: string, score: number, gate: number): Umamusume => ({
  id,
  name,
  score,
  gate,
  entryIndex: gate,
  strategy: '逃げ',
  uniqueSkill: { type: 'Stability', phases: [] },
  history: {}
});

describe('RankingCalculator', () => {
  it('should sort by score desc then gate asc', () => {
    const p1 = createMockUma('1', 'A', 100, 2);
    const p2 = createMockUma('2', 'B', 100, 1);
    const p3 = createMockUma('3', 'C', 90, 3);

    const sorted = RankingCalculator.sortParticipants([p1, p2, p3]);
    expect(sorted[0].id).toBe('2'); // Score 100, Gate 1
    expect(sorted[1].id).toBe('1'); // Score 100, Gate 2
    expect(sorted[2].id).toBe('3'); // Score 90
  });

  it('should detect photo judgment for ties', () => {
    const p1 = createMockUma('1', 'A', 100, 2);
    const p2 = createMockUma('2', 'B', 100, 1);
    const p3 = createMockUma('3', 'C', 90, 3);

    const reqs = RankingCalculator.detectJudgmentNeeds([p1, p2, p3]);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].type).toBe('photo');
    expect(reqs[0].representativeId).toBe('2'); // Smaller gate
    expect(reqs[0].targetIds).toContain('1');
    expect(reqs[0].targetIds).toContain('2');
  });

  it('should detect margin judgment for 1-point diff', () => {
    const p1 = createMockUma('1', 'A', 100, 1);
    const p2 = createMockUma('2', 'B', 99, 2);

    const reqs = RankingCalculator.detectJudgmentNeeds([p1, p2]);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].type).toBe('margin');
    expect(reqs[0].representativeId).toBe('1'); // Upper group rep
  });

  it('should calculate final ranking with photo finish (User A wins)', () => {
    const p1 = createMockUma('1', 'Loser', 100, 1);
    const p2 = createMockUma('2', 'Winner', 100, 2);

    // Assign judgment results
    p1.judgment = { photo: 1 };
    p2.judgment = { photo: 5 };

    const results = RankingCalculator.calculateFinalRanking([p1, p2]);

    // Winner should be first
    expect(results[0].participant.id).toBe('2');
    expect(results[0].rank).toBe(1);
    expect(results[0].marginText).toBe('---');

    // Loser second
    expect(results[1].participant.id).toBe('1');
    expect(results[1].rank).toBe(2);
    expect(results[1].marginText).toBe('ハナ');
  });

  it('should calculate final ranking with dead heat', () => {
    const p1 = createMockUma('1', 'A', 100, 1);
    const p2 = createMockUma('2', 'B', 100, 2);

    p1.judgment = { photo: 5 };
    p2.judgment = { photo: 5 };

    const results = RankingCalculator.calculateFinalRanking([p1, p2]);

    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(1); // Same rank
    expect(results[1].marginText).toBe('同着');
  });

  it('should calculate margin text for 1-point diff (Atama)', () => {
    const p1 = createMockUma('1', 'A', 100, 1);
    const p2 = createMockUma('2', 'B', 99, 2);

    // Rep (p1) rolls 1d2 = 1 (Atama)
    p1.judgment = { margin: 1 };

    const results = RankingCalculator.calculateFinalRanking([p1, p2]);

    expect(results[1].marginText).toBe('アタマ');
  });

  it('should calculate large margins', () => {
    const p1 = createMockUma('1', 'A', 100, 1);
    const p2 = createMockUma('2', 'B', 90, 2); // 10 diff -> 2.5 lengths

    const results = RankingCalculator.calculateFinalRanking([p1, p2]);
    expect(results[1].marginText).toBe('2 1/2');
  });
});
