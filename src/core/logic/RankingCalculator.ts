import type { Umamusume } from '../../types';

export interface RankingResult {
  participant: Umamusume;
  rank: number;
  finalScore: number;
  marginText: string; // "---", "1 1/4", "アタマ", "同着" etc.
}

export interface JudgmentRequest {
  type: 'photo' | 'margin';
  targetIds: string[]; // IDs of participants needing this judgment
  description: string;
  diceType: '1d5' | '1d2';
  representativeId: string; // Who rolls this dice
}

export const RankingCalculator = {
  /**
   * Sort participants by Score Desc > Gate Asc (or Entry Index Asc if Gate is null)
   */
  sortParticipants: (participants: Umamusume[]): Umamusume[] => {
    return [...participants].sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      // Tie-break: Gate (Low is better)
      const gateA = a.gate ?? a.entryIndex;
      const gateB = b.gate ?? b.entryIndex;
      return gateA - gateB;
    });
  },

  /**
   * Detect if any judgments are needed (Step 4-A logic)
   */
  detectJudgmentNeeds: (participants: Umamusume[]): JudgmentRequest[] => {
    const sorted = RankingCalculator.sortParticipants(participants);
    const requests: JudgmentRequest[] = [];

    // 1. Group by score
    const groups: Umamusume[][] = [];
    let currentGroup: Umamusume[] = [];
    sorted.forEach((p, i) => {
      if (i === 0) {
        currentGroup.push(p);
      } else {
        if (p.score === currentGroup[0].score) {
          currentGroup.push(p);
        } else {
          groups.push(currentGroup);
          currentGroup = [p];
        }
      }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    // 2. Photo Judgment (Tie)
    groups.forEach(group => {
      if (group.length >= 2) {
        requests.push({
          type: 'photo',
          targetIds: group.map(p => p.id),
          description: `【写真判定】${group.length}名同着 (Score: ${group[0].score})`,
          diceType: '1d5',
          representativeId: group[0].id // Sorted by gate in Step 1, so indices[0] is smallest gate
        });
      }
    });

    // 3. Margin Judgment (1 point diff)
    // Check adjacent groups
    for (let i = 0; i < groups.length - 1; i++) {
      const upperGroup = groups[i];
      const lowerGroup = groups[i + 1];

      const upperScore = upperGroup[0].score;
      const lowerScore = lowerGroup[0].score;

      if (upperScore - lowerScore === 1) {
        // Determine representative for the margin check (Upper's representative)
        // Actually, requirements say: "Representative: The Uma with the smallest gate number in the group."
        // The dice is usually "A vs B". 
        // We'll assign it to the Upper group's rep for consistent tracking.
        requests.push({
          type: 'margin',
          targetIds: [upperGroup[0].id, lowerGroup[0].id], // Just for reference
          description: `【着差判定】${upperGroup[0].name} vs ${lowerGroup[0].name}`,
          diceType: '1d2',
          representativeId: upperGroup[0].id,
        });
      }
    }

    return requests;
  },

  /**
   * Calculate Final Ranking and Margins (Step 4-B logic)
   */
  calculateFinalRanking: (participants: Umamusume[]): RankingResult[] => {
    // 4. Calculate Final Ranking
    // Sort logic: Score Desc > Photo Desc > Gate Asc
    const finalSorted = [...participants].sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      // Tie: Check Photo Dice (High is better)
      const photoA = a.judgment?.photo ?? 0;
      const photoB = b.judgment?.photo ?? 0;
      if (photoA !== photoB) return photoB - photoA;

      // Tie-break: Gate (Low is better) IF photo is also tied
      const gateA = a.gate ?? a.entryIndex;
      const gateB = b.gate ?? b.entryIndex;
      return gateA - gateB;
    });

    // Assign Ranks and Margins
    const finalResults: RankingResult[] = [];

    for (let i = 0; i < finalSorted.length; i++) {
      const current = finalSorted[i];
      const prev = i > 0 ? finalSorted[i - 1] : null;
      let rank = i + 1;
      let marginText = "---";

      if (prev) {
        const scoreDiff = prev.score - current.score;

        if (scoreDiff === 0) {
          // Tie Logic (Same Score)
          // Since we sorted by Photo dice, if Photo dice are different, rank should cascade.
          // But if Photo dice are same, it is 'Dead Heat' (Same Rank).

          const prevPhoto = prev.judgment?.photo ?? 0;
          const currPhoto = current.judgment?.photo ?? 0;

          if (prevPhoto === currPhoto) {
            // True Dead Heat: Same rank as previous
            rank = finalResults[i - 1].rank;
            marginText = "同着";
          } else {
            // Different Photo dice: Current is loser of the photo finish.
            // Margin is "Hana".
            marginText = "ハナ";
          }
        } else if (scoreDiff === 1) {
          // Margin Logic (1 point diff)
          // Find who holds the dice for this gap (The Rep of the Upper Score Group).
          // Search in original `participants` or strictly by score matching.
          const upperRep = participants.find(p => p.score === prev.score && p.judgment?.margin !== undefined);
          const dice = upperRep?.judgment?.margin ?? 0;

          if (dice === 1) marginText = "アタマ";
          else if (dice === 2) marginText = "クビ";
          else marginText = "1"; // Fallback or "1" if no judgment
        } else {
          // Normal Margin (>= 2)
          const lengths = scoreDiff / 4;
          marginText = formatFraction(lengths);
        }
      }

      finalResults.push({
        participant: current,
        rank,
        finalScore: current.score,
        marginText
      });
    }

    return finalResults;
  }
};

function formatFraction(val: number): string {
  if (val === 0) return "0"; // Should not happen for >=2 diff
  const whole = Math.floor(val);
  const fraction = val - whole;

  let fracStr = "";
  if (fraction === 0.25) fracStr = "1/4";
  else if (fraction === 0.5) fracStr = "1/2";
  else if (fraction === 0.75) fracStr = "3/4";

  if (whole === 0) return fracStr;
  if (fracStr === "") return `${whole}`;
  return `${whole} ${fracStr}`;
}
