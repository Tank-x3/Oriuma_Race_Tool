// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキル スコア統合のエンドツーエンドテスト。
// 仕様根拠:
//  - basic-rules.md §5 累積加算方式 末尾「絆スキルの最終加算」
//  - houserule-features.md §2 [v] 絆スキル §計算仕様 / §データ仕様
//  - scene3-race.md §2 末尾「貼付け解析後のスコア反映」
//  - 88ch 実例: docs/test_fixtures/_raw/_pending_bond_skill/88ch/race-001〜003.md
//
// 範囲: bondTypes Parser → useRaceStore.updateParticipant → bondSkill.helpers の連動 +
//       persistence rehydrate + 戻る操作 regression。Parser 単体・helpers 単体・ストア単体は
//       それぞれの単体テストで網羅済のため、本ファイルは結合面の動作確認に絞る。
import { describe, it, expect, beforeEach } from 'vitest';
import { useRaceStore, persistPartialize, persistMigrate } from '../../store/useRaceStore';
// CR-SA-15-E1 / 2026-05-14: DEFAULT_UNIQUE_DICE_CONFIG = houseRules 型厳密化（uniqueDiceConfig 必須）に追従するため import
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../core/strategies';
import type { DiceResult, Umamusume } from '../../types';

const makeDice = (str: string, values: number[]): DiceResult => ({
    diceStr: str,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

// 88ch 実例から抜粋した代表的な絆スキル発動パターン。
// race-001 等で観察された「絆ギャンブル `dice1d15=12`」「絆安定 `5+dice1d5= 出目3`」を再現する
// 最小限の participant fixture。Scene 1 申告 → 全フェーズ進行を経た後の history を直接構築する
// （Parser → PhaseInput 経路の完全再現は単体テストで済んでいるため、本統合テストでは省略）。
const make88chParticipant = (
    id: string,
    name: string,
    gate: number,
    bondType: 'BondGamble' | 'BondStable' | null,
    bondDiceSum: number | null,
): Umamusume => {
    const history: Umamusume['history'] = {
        Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
        Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
        End: { baseDice: makeDice('3d6', [7, 7, 6]), computedScore: 0 },
    };
    if (bondDiceSum !== null) {
        history.End = {
            ...history.End,
            bondDice: {
                diceStr: bondType === 'BondStable' ? '1d5' : '1d15',
                values: [bondDiceSum],
                sum: bondDiceSum,
            },
        };
    }
    return {
        id,
        entryIndex: gate,
        name,
        strategy: '先行',
        uniqueSkill: { type: 'Stability', phases: [] },
        bondSkill: { type: bondType },
        gate,
        score: 0,
        history,
    };
};

const installRace = (participants: Umamusume[]): void => {
    useRaceStore.setState({
        config: {
            midPhaseCount: 1,
            // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
            startPhaseCount: 1,
            endPhaseCount: 1,
            pacePosition: 'Start',
            fullGateSize: null,
            houseRules: {
                enableModifier: false,
                enableSpecialStrategy: false,
                enableCompositeUnique: false,
                enableExtendedUnique: false,
                enableBondSkill: true,
                effectValue: 15,
                // CR-SA-15-E1 / 2026-05-14: houseRules 型厳密化（uniqueDiceConfig 必須）に追従
                uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
                // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
                enablePhaseConfig: false,
                // CR-SA-20-E1 / 2026-06-11: 型定義拡張に追従（9 フィールド）
                enableFormationDice: false,
                // CR-SA-23-E1 / 2026-07-07: 型定義拡張に追従（12 フィールド）
                enableManualGate: false,
                // CR-SA-21+22-E1 / 2026-07-06: 型定義拡張に追従（11 フィールド）
                enableNoUniqueSkill: false,
                customUniqueSkills: [],
            },
        },
        participants,
        currentPhaseId: 'End',
    });
    // score を初期計算するため midPhaseCount を再設定（既存値と同じだが unconditional に再計算する仕様を活用）
    useRaceStore.getState().setMidPhaseCount(1);
};

describe('Bundle-8-T6 / 88ch 形式絆スキル実例統合テスト', () => {
    beforeEach(() => {
        useRaceStore.getState().resetRace();
    });

    it('(19) race-001 模擬: 絆ギャンブル + 絆安定 混在 → 各 participant に独立加算', () => {
        // race-001 で観察される代表シナリオ:
        //  - 絆ギャンブル `dice1d15=12` → bondDice.sum = 12
        //  - 絆安定 `5+dice1d5= 3` → Parser は fix 込みで sum = 8 を格納
        const participants = [
            make88chParticipant('p1', 'A', 1, 'BondGamble', 12),
            make88chParticipant('p2', 'B', 2, 'BondStable', 8),
            make88chParticipant('p3', 'C', 3, null, null), // 種別未指定（加算対象外）
        ];
        installRace(participants);

        const onScores = useRaceStore.getState().participants.map((p) => p.score);

        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const offScores = useRaceStore.getState().participants.map((p) => p.score);

        expect(onScores[0] - offScores[0]).toBe(12); // 絆ギャンブル
        expect(onScores[1] - offScores[1]).toBe(8); // 絆安定（fix 込み）
        expect(onScores[2]).toBe(offScores[2]); // 未指定者は変化なし
    });

    it('(20) race-002 模擬: 絆ギャンブル単独 + 不参加者 → 加算が独立計算', () => {
        const participants = [
            make88chParticipant('p1', 'X', 1, 'BondGamble', 7),
            make88chParticipant('p2', 'Y', 2, null, null),
        ];
        installRace(participants);

        const before = useRaceStore.getState().participants.map((p) => ({ ...p }));

        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const after = useRaceStore.getState().participants;

        expect(before[0].score - after[0].score).toBe(7);
        expect(before[1].score).toBe(after[1].score);
    });

    it('(21) race-003 模擬: 絆安定 sum=10（出目 5 + fix 5）→ +10 加算', () => {
        // 絆安定の最大値 dice1d5= 5 → Parser sum = 5 + 5 = 10
        const participants = [
            make88chParticipant('p1', 'Z', 1, 'BondStable', 10),
        ];
        installRace(participants);
        const on = useRaceStore.getState().participants[0].score;
        useRaceStore.getState().updateHouseRules({ enableBondSkill: false });
        const off = useRaceStore.getState().participants[0].score;
        expect(on - off).toBe(10);
    });

    it('(22) persistence regression: bondSkill / bondDice / score が partialize → migrate で完全復元', () => {
        const participants = [make88chParticipant('p1', 'A', 1, 'BondGamble', 12)];
        installRace(participants);
        const original = useRaceStore.getState().participants[0];
        const persisted = persistPartialize(useRaceStore.getState());
        const restored = persistMigrate(persisted, 3);
        const restoredP = restored.participants[0];

        expect(restoredP.bondSkill?.type).toBe('BondGamble');
        expect(restoredP.history['End']?.bondDice?.sum).toBe(12);
        expect(restoredP.score).toBe(original.score);
    });

    it('(23) 戻る操作 regression: End→Mid 戻り後、End 再投入で同じ score に戻る', () => {
        const participants = [make88chParticipant('p1', 'A', 1, 'BondGamble', 12)];
        installRace(participants);
        const initialScore = useRaceStore.getState().participants[0].score;

        // End→Mid に戻る（Bundle-6 仕様: history は保持される）
        useRaceStore.getState().setCurrentPhase('Mid');
        const midScore = useRaceStore.getState().participants[0].score;
        // 戻った時点で history 保持により score 不変（Bundle-6 SSoT 整合）
        expect(midScore).toBe(initialScore);

        // 再進行 → End → 同じ bondDice 再投入
        useRaceStore.getState().setCurrentPhase('End');
        const endHistory = useRaceStore.getState().participants[0].history['End']!;
        useRaceStore.getState().updateParticipant('p1', {
            history: {
                ...useRaceStore.getState().participants[0].history,
                End: { ...endHistory, bondDice: makeDice('1d15', [12]) },
            },
        });
        const finalScore = useRaceStore.getState().participants[0].score;
        expect(finalScore).toBe(initialScore);
    });
});
