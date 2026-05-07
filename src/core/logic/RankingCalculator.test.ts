import { describe, it, expect } from 'vitest';
import { RankingCalculator } from './RankingCalculator';
import type { Umamusume } from '../../types';

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

  describe('CR-5b: 同点者隣接着差判定（複合シナリオ）', () => {
    it('should reference the smallest-gate representative dice in tie + 1-point diff scenario', () => {
      // A・B 同点（score 100）+ C 1 点差（score 99）
      // 代表者 = 最小 gate の A（gate=1）。A.judgment.margin=2（クビ）が参照されるべき
      const pA = createMockUma('1', 'A', 100, 1);
      const pB = createMockUma('2', 'B', 100, 2);
      const pC = createMockUma('3', 'C', 99, 3);

      pA.judgment = { photo: 5, margin: 2 }; // 代表者ダイス = クビ
      pB.judgment = { photo: 1 };

      const results = RankingCalculator.calculateFinalRanking([pA, pB, pC]);

      // 順位: A (photo=5 勝) → B (photo=1 負) → C
      expect(results[0].participant.id).toBe('1');
      expect(results[1].participant.id).toBe('2');
      expect(results[2].participant.id).toBe('3');
      // C の着差は A の代表者ダイス margin=2 → 「クビ」
      expect(results[2].marginText).toBe('クビ');
    });

    it('should NOT reference non-representative dice even if it is set', () => {
      // A・B 同点（score 100）+ C 1 点差（score 99）
      // 代表者は A（gate=1）。誤って B（gate=2）に margin=1 が入っていても参照されない
      const pA = createMockUma('1', 'A', 100, 1);
      const pB = createMockUma('2', 'B', 100, 2);
      const pC = createMockUma('3', 'C', 99, 3);

      pA.judgment = { photo: 5 }; // 代表者だが margin 未設定
      pB.judgment = { photo: 1, margin: 1 }; // 非代表者だが margin=1 が入っている

      const results = RankingCalculator.calculateFinalRanking([pA, pB, pC]);

      // C の着差は A.judgment.margin が undefined なので fallback "1"
      // B.judgment.margin=1（アタマ）は参照されてはならない
      expect(results[2].participant.id).toBe('3');
      expect(results[2].marginText).not.toBe('アタマ');
      expect(results[2].marginText).toBe('1'); // fallback
    });

    it('should reference correct representative for each gap in 3-tier score structure', () => {
      // A 100（単独）/ B・C 99（同点）/ D 98（単独）
      // gap1: A vs B/C グループ → 代表者 A（gate=1）の margin が参照される
      // gap2: B/C グループ vs D → 代表者 B（gate=2、最小 gate）の margin が参照される
      const pA = createMockUma('1', 'A', 100, 1);
      const pB = createMockUma('2', 'B', 99, 2);
      const pC = createMockUma('3', 'C', 99, 3);
      const pD = createMockUma('4', 'D', 98, 4);

      pA.judgment = { margin: 1 };               // gap1 代表 → アタマ
      pB.judgment = { photo: 5, margin: 2 };     // gap2 代表 → クビ
      pC.judgment = { photo: 1 };                // 非代表
      // D の手前判定で参照されるのは B のダイス

      const results = RankingCalculator.calculateFinalRanking([pA, pB, pC, pD]);

      // 順位順: A → B (photo=5) → C (photo=1) → D
      expect(results[0].participant.id).toBe('1');
      expect(results[1].participant.id).toBe('2');
      expect(results[2].participant.id).toBe('3');
      expect(results[3].participant.id).toBe('4');

      // gap1 (A → B): A の margin=1 → 「アタマ」
      expect(results[1].marginText).toBe('アタマ');
      // C は B と同点で写真判定負け → 「ハナ」
      expect(results[2].marginText).toBe('ハナ');
      // gap2 (C → D, score diff=1): B の margin=2 → 「クビ」
      expect(results[3].marginText).toBe('クビ');
    });
  });
});
