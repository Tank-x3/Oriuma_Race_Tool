// Bundle-8-T3 / CR-SA-4 / 2026-05-10: gateScene.helpers の単体テスト
// scene2-gate.md §2 SSoT に基づく併記文字列生成ロジック検証
import { describe, it, expect } from 'vitest';
import {
    getSpecialStrategyAnnotation,
    getBondSkillAnnotation,
    getEntryListAnnotations,
} from './gateScene.helpers';
import type { Umamusume, RaceState } from '../../types';
// CR-SA-15-E1 / 2026-05-14: DEFAULT_UNIQUE_DICE_CONFIG = houseRules 型厳密化（uniqueDiceConfig 必須）に追従するため import
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../core/strategies';

type HouseRules = RaceState['config']['houseRules'];

// テスト用 phaseMap / getPhaseLabel（GateScene.tsx の entryListText useMemo 内ロジックと等価）
const phaseMap: Record<string, string> = {
    Start: '序盤',
    Mid: '中盤',
    End: '終盤',
};
const getPhaseLabel = (pId: string): string => {
    if (phaseMap[pId]) return phaseMap[pId];
    if (pId.startsWith('Mid')) return pId.replace('Mid', '中盤');
    return pId;
};

// テスト用 participant ファクトリ（最小限のフィールド + HR 関連フィールド可変）
const buildParticipant = (overrides: Partial<Umamusume> = {}): Umamusume => ({
    id: 'p1',
    entryIndex: 0,
    name: 'テスト',
    strategy: '逃げ',
    uniqueSkill: { type: 'Stability', phases: [] },
    gate: null,
    score: 0,
    history: {},
    ...overrides,
});

const baseHouseRules: HouseRules = {
    enableModifier: false,
    enableSpecialStrategy: false,
    enableCompositeUnique: false,
    enableExtendedUnique: false,
    enableBondSkill: false,
    effectValue: 15,
    // CR-SA-15-E1 / 2026-05-14: houseRules 型厳密化（uniqueDiceConfig 必須）に追従
    uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
    // CR-SA-17-E1 / 2026-06-06: 型定義拡張に追従
    enablePhaseConfig: false,
    // CR-SA-20-E1 / 2026-06-11: 型定義拡張に追従（9 フィールド）
    enableFormationDice: false,
    // CR-SA-21+22-E1 / 2026-07-06: 型定義拡張に追従（11 フィールド）
    enableNoUniqueSkill: false,
    customUniqueSkills: [],
};

describe('gateScene.helpers - Bundle-8-T3 / CR-SA-4 / 2026-05-10', () => {
    describe('getSpecialStrategyAnnotation - Bundle-8-T3', () => {
        // (1) 種別 'Makuri' + 発動位置 'Mid1' (midPhaseCount=2) → ' 中盤1【捲り】'
        it('returns " 中盤1【捲り】" for Makuri + Mid1', () => {
            const result = getSpecialStrategyAnnotation('Makuri', 'Mid1', getPhaseLabel);
            expect(result).toBe(' 中盤1【捲り】');
        });

        // (2) 種別 'Tame' + 発動位置 'Start' → ' 序盤【溜め】'
        it('returns " 序盤【溜め】" for Tame + Start', () => {
            const result = getSpecialStrategyAnnotation('Tame', 'Start', getPhaseLabel);
            expect(result).toBe(' 序盤【溜め】');
        });

        // (3) 種別 'Makuri' + 発動位置 null → 空文字列（セット必須未達）
        it('returns empty string when phase is null', () => {
            const result = getSpecialStrategyAnnotation('Makuri', null, getPhaseLabel);
            expect(result).toBe('');
        });

        // (4) 種別 null + 発動位置 'Mid1' → 空文字列
        it('returns empty string when type is null', () => {
            const result = getSpecialStrategyAnnotation(null, 'Mid1', getPhaseLabel);
            expect(result).toBe('');
        });

        // (5) 種別 null + 発動位置 null → 空文字列
        it('returns empty string when both are null', () => {
            const result = getSpecialStrategyAnnotation(null, null, getPhaseLabel);
            expect(result).toBe('');
        });
    });

    describe('getBondSkillAnnotation - Bundle-8-T3', () => {
        // (6) 種別 'BondGamble' → ' 【絆ギャンブル】'
        it('returns " 【絆ギャンブル】" for BondGamble', () => {
            const result = getBondSkillAnnotation('BondGamble');
            expect(result).toBe(' 【絆ギャンブル】');
        });

        // (7) 種別 'BondStable' → ' 【絆安定】'
        it('returns " 【絆安定】" for BondStable', () => {
            const result = getBondSkillAnnotation('BondStable');
            expect(result).toBe(' 【絆安定】');
        });

        // (8) 種別 null → 空文字列
        it('returns empty string for null', () => {
            const result = getBondSkillAnnotation(null);
            expect(result).toBe('');
        });

        // (9) bondSkill 自体が undefined → 空文字列
        it('returns empty string for undefined', () => {
            const result = getBondSkillAnnotation(undefined);
            expect(result).toBe('');
        });
    });

    describe('getEntryListAnnotations - Bundle-8-T3 / 並び順 + HR フラグ判定', () => {
        // (10) 両 HR ON + 両申告: ' 序盤【捲り】 【絆ギャンブル】'（特殊戦法 → 絆スキル順）
        it('returns " 序盤【捲り】 【絆ギャンブル】" when both HR ON and both declared', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Makuri',
                specialStrategyPhase: 'Start',
                bondSkill: { type: 'BondGamble' },
            });
            const houseRules = {
                ...baseHouseRules,
                enableSpecialStrategy: true,
                enableBondSkill: true,
            };
            const result = getEntryListAnnotations(participant, houseRules, getPhaseLabel);
            expect(result).toBe(' 序盤【捲り】 【絆ギャンブル】');
        });

        // (11) 特殊戦法 HR ON のみ + 特殊戦法申告: ' 中盤1【溜め】'
        it('returns " 中盤1【溜め】" when only specialStrategy HR ON and declared', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Tame',
                specialStrategyPhase: 'Mid1',
                bondSkill: { type: 'BondGamble' },
            });
            const houseRules = {
                ...baseHouseRules,
                enableSpecialStrategy: true,
                enableBondSkill: false,
            };
            const result = getEntryListAnnotations(participant, houseRules, getPhaseLabel);
            expect(result).toBe(' 中盤1【溜め】');
        });

        // (12) 絆スキル HR ON のみ + 絆スキル申告: ' 【絆安定】'
        it('returns " 【絆安定】" when only bondSkill HR ON and declared', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Makuri',
                specialStrategyPhase: 'Start',
                bondSkill: { type: 'BondStable' },
            });
            const houseRules = {
                ...baseHouseRules,
                enableSpecialStrategy: false,
                enableBondSkill: true,
            };
            const result = getEntryListAnnotations(participant, houseRules, getPhaseLabel);
            expect(result).toBe(' 【絆安定】');
        });

        // (13) 両 HR OFF: 空文字列（フラグ OFF で完全抑制）
        it('returns empty string when both HR OFF (regardless of declarations)', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Makuri',
                specialStrategyPhase: 'Start',
                bondSkill: { type: 'BondGamble' },
            });
            const result = getEntryListAnnotations(participant, baseHouseRules, getPhaseLabel);
            expect(result).toBe('');
        });

        // (14) 両 HR ON + 両未申告: 空文字列
        it('returns empty string when both HR ON but no declarations', () => {
            const participant = buildParticipant({
                specialStrategyType: null,
                specialStrategyPhase: null,
                bondSkill: { type: null },
            });
            const houseRules = {
                ...baseHouseRules,
                enableSpecialStrategy: true,
                enableBondSkill: true,
            };
            const result = getEntryListAnnotations(participant, houseRules, getPhaseLabel);
            expect(result).toBe('');
        });

        // (15) 両 HR ON + 特殊戦法のみ申告: ' 序盤【捲り】'（絆スキル `---` で抑制）
        it('returns " 序盤【捲り】" when both HR ON but only specialStrategy declared', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Makuri',
                specialStrategyPhase: 'Start',
                bondSkill: { type: null },
            });
            const houseRules = {
                ...baseHouseRules,
                enableSpecialStrategy: true,
                enableBondSkill: true,
            };
            const result = getEntryListAnnotations(participant, houseRules, getPhaseLabel);
            expect(result).toBe(' 序盤【捲り】');
        });

        // (16) HR フラグ OFF + 申告ありで完全抑制（フラグ判定優先、OFF 切替時の Scene 1 入力値保持と整合）
        it('suppresses both annotations when HR flags OFF even with declarations', () => {
            const participant = buildParticipant({
                specialStrategyType: 'Tame',
                specialStrategyPhase: 'Mid2',
                bondSkill: { type: 'BondStable' },
            });
            // 両 HR OFF だが Scene 1 入力値は残っている状態
            const result = getEntryListAnnotations(participant, baseHouseRules, getPhaseLabel);
            expect(result).toBe('');
        });
    });
});
