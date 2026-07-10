// Bundle-8-T3 / CR-SA-4 / 2026-05-10: gateScene.helpers の単体テスト
// scene2-gate.md §2 SSoT に基づく併記文字列生成ロジック検証
import { describe, it, expect } from 'vitest';
import {
    getSpecialStrategyAnnotation,
    getBondSkillAnnotation,
    getEntryListAnnotations,
    // CR-SA-21+22-E3 / 2026-07-06: エントリー確認リストの固有スキル表示ラベル解決
    getEntryListUniqueTypeLabel,
    // CR-SA-23-E2 / 2026-07-08: 枠順手動配置 Scene 2 配線用純粋関数 4 個
    getEntryListManualGateLabel,
    getManualGateOptions,
    getRaffleTargets,
    assignGatesWithManualHold,
} from './gateScene.helpers';
import type { Umamusume, RaceState, CustomUniqueSkill } from '../../types';
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
    // CR-SA-23-E1 / 2026-07-07: 型定義拡張に追従（12 フィールド）
    enableManualGate: false,
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

    // CR-SA-21+22-E3 / 2026-07-06: エントリー確認リスト固有スキルラベル解決（Custom/None 含む）
    // SSoT: scene2-gate.md §2 L82-83 + houserule-features.md §8.8
    describe('getEntryListUniqueTypeLabel - CR-SA-21+22-E3 / 2026-07-06', () => {
        const customs: CustomUniqueSkill[] = [
            { id: 'cust-a', name: '先行特化', fixValue: -5, diceStr: '1d30' },
            { id: 'cust-b', name: '安定Ⅲ', fixValue: 3, diceStr: '2d6' },
        ];

        it('(U1) 組み込み Stability → "安定"', () => {
            expect(getEntryListUniqueTypeLabel('Stability', undefined, [])).toBe('安定');
        });

        it('(U2) 組み込み GambleII → "ギャンブルⅡ"', () => {
            expect(getEntryListUniqueTypeLabel('GambleII', undefined, [])).toBe('ギャンブルⅡ');
        });

        it('(U3) 組み込み StabilityII → "安定Ⅱ"', () => {
            expect(getEntryListUniqueTypeLabel('StabilityII', undefined, [])).toBe('安定Ⅱ');
        });

        it('(U4) None → "なし"（§2 [v] 固有スキルなし出走者）', () => {
            expect(getEntryListUniqueTypeLabel('None', undefined, [])).toBe('なし');
        });

        it('(U5) Custom + 有効 id → ユーザー命名 "先行特化"', () => {
            expect(getEntryListUniqueTypeLabel('Custom', 'cust-a', customs)).toBe('先行特化');
        });

        it('(U6) Custom + 別 id → ユーザー命名 "安定Ⅲ"', () => {
            expect(getEntryListUniqueTypeLabel('Custom', 'cust-b', customs)).toBe('安定Ⅲ');
        });

        it('(U7) Custom + 参照切れ（id 不在）→ フォールバック "Custom" 文字列', () => {
            expect(getEntryListUniqueTypeLabel('Custom', 'cust-x', customs)).toBe('Custom');
        });

        it('(U8) Custom + customUniqueSkillId undefined → フォールバック "Custom"', () => {
            expect(getEntryListUniqueTypeLabel('Custom', undefined, customs)).toBe('Custom');
        });

        it('(U9) 組み込みタイプは customUniqueSkills 内容に依存しない', () => {
            expect(getEntryListUniqueTypeLabel('Stability', 'cust-a', customs)).toBe('安定');
        });
    });

    // CR-SA-23-E2 / 2026-07-08: 枠順手動配置 Scene 2 配線用純粋関数
    // SSoT: scene2-gate.md §1.2 / §2 + houserule-features.md §9
    describe('getEntryListManualGateLabel - CR-SA-23-E2', () => {
        it('(MG-L1) HR OFF: manualGate 値があっても空文字（他 HR 群と同方針の OFF ゲート）', () => {
            const p = buildParticipant({ manualGate: 3 });
            expect(getEntryListManualGateLabel(p, false)).toBe('');
        });

        it('(MG-L2) HR ON × manualGate=null: 空文字（抽選対象は併記なし、§9.3）', () => {
            const p = buildParticipant({ manualGate: null });
            expect(getEntryListManualGateLabel(p, true)).toBe('');
        });

        it('(MG-L3) HR ON × manualGate=undefined: 空文字（未定義も抽選対象扱い）', () => {
            const p = buildParticipant({});
            expect(getEntryListManualGateLabel(p, true)).toBe('');
        });

        it('(MG-L4) HR ON × manualGate=3: " [固定枠: 3]"（先頭半角スペース + SSoT 固定文言）', () => {
            const p = buildParticipant({ manualGate: 3 });
            expect(getEntryListManualGateLabel(p, true)).toBe(' [固定枠: 3]');
        });

        it('(MG-L5) HR ON × manualGate=1: " [固定枠: 1]"（境界値）', () => {
            const p = buildParticipant({ manualGate: 1 });
            expect(getEntryListManualGateLabel(p, true)).toBe(' [固定枠: 1]');
        });
    });

    describe('getManualGateOptions - CR-SA-23-E2', () => {
        const buildParticipants = (specs: { id: string; manualGate?: number | null }[]): Umamusume[] =>
            specs.map((s, i) => buildParticipant({ id: s.id, entryIndex: i, manualGate: s.manualGate ?? null }));

        it('(MG-O1) 全員未指定 × 4 名: 対象は [null,1,2,3,4]（全枠選択可）', () => {
            const ps = buildParticipants([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
            expect(getManualGateOptions(ps, 'a', 4)).toEqual([null, 1, 2, 3, 4]);
        });

        it('(MG-O2) 他 2 名が [3,1] 指定: 対象 b は [null,2,4]（既指定除外）', () => {
            const ps = buildParticipants([
                { id: 'a', manualGate: 3 },
                { id: 'b' },
                { id: 'c', manualGate: 1 },
                { id: 'd' },
            ]);
            expect(getManualGateOptions(ps, 'b', 4)).toEqual([null, 2, 4]);
        });

        it('(MG-O3) 対象参加者自身の現在値は候補に含む（自身の枠を維持したまま UI 再描画するため）', () => {
            const ps = buildParticipants([
                { id: 'a', manualGate: 3 },
                { id: 'b', manualGate: 2 },
                { id: 'c', manualGate: 1 },
                { id: 'd' },
            ]);
            // 対象 = a、a 自身の 3 は候補に含む。b(2) / c(1) は除外 → [null, 3, 4]
            expect(getManualGateOptions(ps, 'a', 4)).toEqual([null, 3, 4]);
        });

        it('(MG-O4) 全員他指定（対象自身のみ未指定）: 空きが 1 つのみ + 未指定候補', () => {
            const ps = buildParticipants([
                { id: 'a' },
                { id: 'b', manualGate: 1 },
                { id: 'c', manualGate: 3 },
                { id: 'd', manualGate: 4 },
            ]);
            expect(getManualGateOptions(ps, 'a', 4)).toEqual([null, 2]);
        });

        it('(MG-O5) N の指定枠を超える指定は候補に出さない（Import 由来の防御）', () => {
            const ps = buildParticipants([
                { id: 'a' },
                { id: 'b', manualGate: 3 },
                { id: 'c' },
            ]);
            // N=3、b=3 → 対象 a: [null, 1, 2]（3 は既指定除外）
            expect(getManualGateOptions(ps, 'a', 3)).toEqual([null, 1, 2]);
        });
    });

    describe('getRaffleTargets - CR-SA-23-E2', () => {
        const buildParticipants = (specs: { id: string; name: string; manualGate?: number | null }[]): Umamusume[] =>
            specs.map((s, i) => buildParticipant({ id: s.id, name: s.name, entryIndex: i, manualGate: s.manualGate ?? null }));

        it('(MG-R1) HR OFF: 全参加者を Scene 1 エントリー順のまま返す（現行挙動）', () => {
            const ps = buildParticipants([
                { id: 'a', name: 'A', manualGate: 3 }, // OFF 時は manualGate があっても関係なく全員抽選
                { id: 'b', name: 'B' },
                { id: 'c', name: 'C' },
            ]);
            const result = getRaffleTargets(ps, false);
            expect(result.map(p => p.id)).toEqual(['a', 'b', 'c']);
        });

        it('(MG-R2) HR ON × 一部指定: 未指定者のみ Scene 1 エントリー順で返す', () => {
            const ps = buildParticipants([
                { id: 'a', name: 'A', manualGate: 3 },
                { id: 'b', name: 'B' },
                { id: 'c', name: 'C', manualGate: 1 },
                { id: 'd', name: 'D' },
            ]);
            const result = getRaffleTargets(ps, true);
            expect(result.map(p => p.id)).toEqual(['b', 'd']);
        });

        it('(MG-R3) HR ON × 全員指定: 空配列（[2b][3] 非表示のトリガー、§9.7）', () => {
            const ps = buildParticipants([
                { id: 'a', name: 'A', manualGate: 1 },
                { id: 'b', name: 'B', manualGate: 2 },
            ]);
            expect(getRaffleTargets(ps, true)).toEqual([]);
        });

        it('(MG-R4) HR ON × 全員未指定: 全員が抽選対象（HR OFF と同結果）', () => {
            const ps = buildParticipants([
                { id: 'a', name: 'A' },
                { id: 'b', name: 'B' },
            ]);
            expect(getRaffleTargets(ps, true).map(p => p.id)).toEqual(['a', 'b']);
        });
    });

    describe('assignGatesWithManualHold - CR-SA-23-E2', () => {
        const buildParticipants = (specs: { id: string; entryIndex: number; manualGate?: number | null }[]): Umamusume[] =>
            specs.map((s) => buildParticipant({ id: s.id, entryIndex: s.entryIndex, manualGate: s.manualGate ?? null }));

        it('(MG-A1) HR OFF: 既存全員抽選ロジックと同一（出目昇順 + tie-breaker エントリー順）', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0 },
                { id: 'b', entryIndex: 1 },
                { id: 'c', entryIndex: 2 },
            ]);
            const rolls = [
                { id: 'a', roll: 50 },
                { id: 'b', roll: 20 },
                { id: 'c', roll: 30 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, false);
            expect(result).toEqual([
                { id: 'b', roll: 20, gate: 1 },
                { id: 'c', roll: 30, gate: 2 },
                { id: 'a', roll: 50, gate: 3 },
            ]);
        });

        it('(MG-A2) HR OFF: tie-breaker（同値時はエントリー順優先）', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0 },
                { id: 'b', entryIndex: 1 },
                { id: 'c', entryIndex: 2 },
            ]);
            const rolls = [
                { id: 'a', roll: 50 },
                { id: 'b', roll: 50 },
                { id: 'c', roll: 50 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, false);
            expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
        });

        it('(MG-A3) HR ON × SSoT §9.6 例: A→3枠 / C→1枠 / B=15 / D=45 → B→2枠 / D→4枠', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0, manualGate: 3 },
                { id: 'b', entryIndex: 1 },
                { id: 'c', entryIndex: 2, manualGate: 1 },
                { id: 'd', entryIndex: 3 },
            ]);
            const rolls = [
                { id: 'b', roll: 15 },
                { id: 'd', roll: 45 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, true);
            // gate 昇順ソート
            expect(result).toEqual([
                { id: 'c', roll: null, gate: 1 }, // 指定枠
                { id: 'b', roll: 15, gate: 2 },    // 抽選
                { id: 'a', roll: null, gate: 3 }, // 指定枠
                { id: 'd', roll: 45, gate: 4 },    // 抽選
            ]);
        });

        it('(MG-A4) HR ON × 全員手動指定（rolls=[]）: 手動指定者のみ / 抽選者 0 名', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0, manualGate: 2 },
                { id: 'b', entryIndex: 1, manualGate: 1 },
            ]);
            const result = assignGatesWithManualHold(ps, [], true);
            expect(result).toEqual([
                { id: 'b', roll: null, gate: 1 },
                { id: 'a', roll: null, gate: 2 },
            ]);
        });

        it('(MG-A5) HR ON × 全員抽選（manualGate 全 null）: HR OFF と同結果', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0 },
                { id: 'b', entryIndex: 1 },
            ]);
            const rolls = [
                { id: 'a', roll: 40 },
                { id: 'b', roll: 10 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, true);
            expect(result).toEqual([
                { id: 'b', roll: 10, gate: 1 },
                { id: 'a', roll: 40, gate: 2 },
            ]);
        });

        it('(MG-A6) HR ON × 抽選者間の tie-breaker（同出目 → エントリー順優先）', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0, manualGate: 1 },
                { id: 'b', entryIndex: 1 },
                { id: 'c', entryIndex: 2 },
            ]);
            const rolls = [
                { id: 'b', roll: 20 },
                { id: 'c', roll: 20 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, true);
            expect(result).toEqual([
                { id: 'a', roll: null, gate: 1 },
                { id: 'b', roll: 20, gate: 2 }, // 同出目 → エントリー順優先
                { id: 'c', roll: 20, gate: 3 },
            ]);
        });

        it('(MG-A7) HR ON × 抽選者ダイス行に無関係な id が混入 → 抽選対象のみ集計', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0, manualGate: 2 },
                { id: 'b', entryIndex: 1 },
            ]);
            const rolls = [
                { id: 'a', roll: 99 }, // 手動指定者のダイス行 = 無視
                { id: 'b', roll: 30 },
            ];
            const result = assignGatesWithManualHold(ps, rolls, true);
            expect(result).toEqual([
                { id: 'b', roll: 30, gate: 1 },
                { id: 'a', roll: null, gate: 2 },
            ]);
        });

        it('(MG-A8) HR ON × 全員指定 + 空き枠計算（1〜N から重複除外）', () => {
            const ps = buildParticipants([
                { id: 'a', entryIndex: 0, manualGate: 4 },
                { id: 'b', entryIndex: 1, manualGate: 2 },
                { id: 'c', entryIndex: 2, manualGate: 1 },
                { id: 'd', entryIndex: 3, manualGate: 3 },
            ]);
            const result = assignGatesWithManualHold(ps, [], true);
            expect(result.map(r => ({ id: r.id, gate: r.gate }))).toEqual([
                { id: 'c', gate: 1 },
                { id: 'b', gate: 2 },
                { id: 'd', gate: 3 },
                { id: 'a', gate: 4 },
            ]);
        });
    });
});
