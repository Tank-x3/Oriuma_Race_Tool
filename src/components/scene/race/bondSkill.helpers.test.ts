import { describe, it, expect } from 'vitest';
import {
    getBondSkillTypeLabel,
    formatBondSkillLine,
    getBondSkillSection,
    calculateBondSkillDelta,
    calculateScoreWithBondSkill,
} from './bondSkill.helpers';
import type { DiceResult, Strategy, Umamusume, UniqueDiceConfig } from '../../../types';
import { DEFAULT_STRATEGIES, DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import { getActivePhaseIds, getActivePhaseIdsForConfig } from '../../../core/calculator';
import type { RaceState } from '../../../types';

const makeParticipant = (override: Partial<Umamusume> = {}): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '先行',
    uniqueSkill: { type: 'Stability', phases: [] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

const makeDice = (str: string, values: number[]): DiceResult => ({
    diceStr: str,
    values,
    sum: values.reduce((a, b) => a + b, 0),
});

describe('getBondSkillTypeLabel - Bundle-8-T4', () => {
    it('"BondGamble" → "絆ギャンブル"', () => {
        expect(getBondSkillTypeLabel('BondGamble')).toBe('絆ギャンブル');
    });
    it('"BondStable" → "絆安定"', () => {
        expect(getBondSkillTypeLabel('BondStable')).toBe('絆安定');
    });
    it('null / undefined → 空文字列', () => {
        expect(getBondSkillTypeLabel(null)).toBe('');
        expect(getBondSkillTypeLabel(undefined)).toBe('');
    });
});

describe('formatBondSkillLine - Bundle-8-T4', () => {
    it('絆ギャンブル + 枠番 1 + 名前 "ウィトゲンクリア" → "① ウィトゲンクリア　絆ギャンブル　dice1d15="', () => {
        const p = makeParticipant({
            gate: 1,
            name: 'ウィトゲンクリア',
            bondSkill: { type: 'BondGamble' },
        });
        expect(formatBondSkillLine(p)).toBe('① ウィトゲンクリア　絆ギャンブル　dice1d15=');
    });
    it('絆安定 + 枠番 3 + 名前 "ウマ娘C" → "③ ウマ娘C　絆安定　5+dice1d5="', () => {
        const p = makeParticipant({
            gate: 3,
            name: 'ウマ娘C',
            bondSkill: { type: 'BondStable' },
        });
        expect(formatBondSkillLine(p)).toBe('③ ウマ娘C　絆安定　5+dice1d5=');
    });
    it('枠番 21 以上 → "(21)" フォールバック表記', () => {
        const p = makeParticipant({
            gate: 21,
            name: 'X',
            bondSkill: { type: 'BondGamble' },
        });
        expect(formatBondSkillLine(p)).toBe('(21) X　絆ギャンブル　dice1d15=');
    });
    it('種別 null → 空文字列', () => {
        const p = makeParticipant({
            gate: 1,
            name: 'A',
            bondSkill: { type: null },
        });
        expect(formatBondSkillLine(p)).toBe('');
    });
    it('bondSkill 自体 undefined → 空文字列', () => {
        const p = makeParticipant({ gate: 1, name: 'A' });
        expect(formatBondSkillLine(p)).toBe('');
    });
    it('gate=null（枠未確定）→ 空文字列（防御的、Scene 3 では枠確定済みが前提）', () => {
        const p = makeParticipant({
            gate: null,
            name: 'A',
            bondSkill: { type: 'BondGamble' },
        });
        expect(formatBondSkillLine(p)).toBe('');
    });
});

describe('getBondSkillSection - Bundle-8-T4 / 終盤判定 + 抑制 + ソート', () => {
    const houseRulesOn = { enableBondSkill: true };
    const houseRulesOff = { enableBondSkill: false };

    it('終盤 + フラグ ON + 2 名指定（絆ギャンブル / 絆安定混在）→ ヘッダー + 枠順 2 行', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, name: 'ウィトゲンクリア', bondSkill: { type: 'BondGamble' } }),
            makeParticipant({ id: 'p2', gate: 3, name: 'ウマ娘C', bondSkill: { type: 'BondStable' } }),
        ];
        const expected = [
            '【絆スキル】',
            '① ウィトゲンクリア　絆ギャンブル　dice1d15=',
            '③ ウマ娘C　絆安定　5+dice1d5=',
        ].join('\n');
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).toBe(expected);
    });

    it('終盤 + フラグ ON + 0 名指定 → 空文字列（空セクション抑制）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, bondSkill: { type: null } }),
            makeParticipant({ id: 'p2', gate: 2 }),
        ];
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).toBe('');
    });

    it('終盤 + フラグ OFF + 申告あり → 空文字列（フラグ OFF で完全抑制）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, bondSkill: { type: 'BondGamble' } }),
        ];
        expect(getBondSkillSection(participants, 'End', houseRulesOff)).toBe('');
    });

    it('中盤 + フラグ ON + 申告あり → 空文字列（他フェーズ非表示）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, bondSkill: { type: 'BondGamble' } }),
        ];
        expect(getBondSkillSection(participants, 'Mid', houseRulesOn)).toBe('');
        expect(getBondSkillSection(participants, 'Mid1', houseRulesOn)).toBe('');
    });

    it('序盤 + フラグ ON + 申告あり → 空文字列（同上）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, bondSkill: { type: 'BondGamble' } }),
        ];
        expect(getBondSkillSection(participants, 'Start', houseRulesOn)).toBe('');
    });

    it('ペース + フラグ ON + 申告あり → 空文字列（同上）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, bondSkill: { type: 'BondGamble' } }),
        ];
        expect(getBondSkillSection(participants, 'Pace', houseRulesOn)).toBe('');
    });

    it('終盤 + フラグ ON + 入力順 gate=3,1,5 → 出力 ①→③→⑤ の枠順ソート', () => {
        const participants = [
            makeParticipant({ id: 'p3', gate: 3, name: 'C', bondSkill: { type: 'BondStable' } }),
            makeParticipant({ id: 'p1', gate: 1, name: 'A', bondSkill: { type: 'BondGamble' } }),
            makeParticipant({ id: 'p5', gate: 5, name: 'E', bondSkill: { type: 'BondGamble' } }),
        ];
        const expected = [
            '【絆スキル】',
            '① A　絆ギャンブル　dice1d15=',
            '③ C　絆安定　5+dice1d5=',
            '⑤ E　絆ギャンブル　dice1d15=',
        ].join('\n');
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).toBe(expected);
    });

    it('終盤 + フラグ ON + 種別 null 含む混在 → null 者は除外、種別ありのみ出力', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, name: 'A', bondSkill: { type: 'BondGamble' } }),
            makeParticipant({ id: 'p2', gate: 2, name: 'B', bondSkill: { type: null } }),
            makeParticipant({ id: 'p3', gate: 3, name: 'C', bondSkill: { type: 'BondStable' } }),
            makeParticipant({ id: 'p4', gate: 4, name: 'D' }),
        ];
        const expected = [
            '【絆スキル】',
            '① A　絆ギャンブル　dice1d15=',
            '③ C　絆安定　5+dice1d5=',
        ].join('\n');
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).toBe(expected);
    });

    it('終盤 + フラグ ON + 枠未確定（gate=null）→ 当該者除外', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, name: 'A', bondSkill: { type: 'BondGamble' } }),
            makeParticipant({ id: 'p2', gate: null, name: 'B', bondSkill: { type: 'BondStable' } }),
        ];
        const expected = [
            '【絆スキル】',
            '① A　絆ギャンブル　dice1d15=',
        ].join('\n');
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).toBe(expected);
    });

    it('入力 participants 配列を破壊しない（純粋関数性）', () => {
        const participants = [
            makeParticipant({ id: 'p3', gate: 3, name: 'C', bondSkill: { type: 'BondStable' } }),
            makeParticipant({ id: 'p1', gate: 1, name: 'A', bondSkill: { type: 'BondGamble' } }),
        ];
        const beforeOrder = participants.map((p) => p.id);
        getBondSkillSection(participants, 'End', houseRulesOn);
        expect(participants.map((p) => p.id)).toEqual(beforeOrder);
    });
});

// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキル最終加算ロジックのテスト群。
// Parser 仕様（bondTypes.ts L19-23）により bondDice.sum は既に fix 込みの total が格納される。
describe('calculateBondSkillDelta - Bundle-8-T6', () => {
    const houseRulesOn = { enableBondSkill: true };
    const houseRulesOff = { enableBondSkill: false };

    it('絆ギャンブル + bondDice.sum=12（dice1d15=12）→ delta=12', () => {
        const p = makeParticipant({
            bondSkill: { type: 'BondGamble' },
            history: { End: { bondDice: makeDice('1d15', [12]), computedScore: 0 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(12);
    });

    it('絆安定 + bondDice.sum=8（5+dice1d5= 出目3 → Parser が fix 5 込みで sum=8 格納）→ delta=8', () => {
        // Parser 仕様: bondTypes.ts#parseBondSkillLineFromText が `total = fixValue + diceResult` を
        // sum として格納するため、helper 側は種別分岐なく単純に sum を返すのが SSoT 整合動作。
        const p = makeParticipant({
            bondSkill: { type: 'BondStable' },
            history: { End: { bondDice: { diceStr: '1d5', values: [3], sum: 8 }, computedScore: 0 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(8);
    });

    it('種別 null → delta=0（種別未指定で抑制）', () => {
        const p = makeParticipant({
            bondSkill: { type: null },
            history: { End: { bondDice: makeDice('1d15', [12]), computedScore: 0 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(0);
    });

    it('bondSkill 自体 undefined → delta=0', () => {
        const p = makeParticipant({
            history: { End: { bondDice: makeDice('1d15', [12]), computedScore: 0 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(0);
    });

    it('bondDice 不在（解析未実行 / 終盤未到達）→ delta=0', () => {
        const p = makeParticipant({
            bondSkill: { type: 'BondGamble' },
            history: {},
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(0);
    });

    it('HR フラグ OFF + 種別指定済 + bondDice あり → delta=0（フラグ OFF で完全抑制）', () => {
        const p = makeParticipant({
            bondSkill: { type: 'BondGamble' },
            history: { End: { bondDice: makeDice('1d15', [12]), computedScore: 0 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOff)).toBe(0);
    });

    it('終盤未到達（history.End なし）+ 中盤までは進んでいる → delta=0', () => {
        const p = makeParticipant({
            bondSkill: { type: 'BondGamble' },
            history: { Start: { computedScore: 30 }, Mid: { computedScore: 50 } },
        });
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(0);
    });
});

describe('calculateScoreWithBondSkill - Bundle-8-T6', () => {
    const strategies: Strategy[] = DEFAULT_STRATEGIES;
    const activePhaseIds = getActivePhaseIds(1); // Start, Mid, End

    // 計算前提:
    // 戦法「先行」 fixValue=10, paceModifier(face=null)=0
    // Start baseDice sum=10 → Strategy fix 10 + 10 = 20
    // Mid baseDice sum=15 → 15 (paceFace=null で modifier 0)
    // End baseDice sum=20 → 20
    // baseScore = 10 + 10 + 15 + 20 = 55
    const baseHistory = {
        Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
        Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
        End: { baseDice: makeDice('3d6', [7, 7, 6]), computedScore: 0 },
    };

    it('絆ギャンブル + bondDice sum=12 → baseScore + 12 加算', () => {
        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history: {
                ...baseHistory,
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    bondDice: makeDice('1d15', [12]),
                    computedScore: 0,
                },
            },
        });
        // CR-SA-15-E2 / 2026-05-15: houseRules Pick 型拡張（uniqueDiceConfig 追加）に追従
        const houseRules = { enableBondSkill: true, enableSpecialStrategy: false, effectValue: 15, uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG };
        const score = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRules);
        const baseOnly = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, {
            ...houseRules,
            enableBondSkill: false,
        });
        expect(score - baseOnly).toBe(12);
    });

    it('絆安定 + bondDice sum=8（fix 5 込み）→ baseScore + 8 加算', () => {
        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondStable' },
            history: {
                ...baseHistory,
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    bondDice: { diceStr: '1d5', values: [3], sum: 8 },
                    computedScore: 0,
                },
            },
        });
        // CR-SA-15-E2 / 2026-05-15: houseRules Pick 型拡張（uniqueDiceConfig 追加）に追従
        const houseRules = { enableBondSkill: true, enableSpecialStrategy: false, effectValue: 15, uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG };
        const score = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRules);
        const baseOnly = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, {
            ...houseRules,
            enableBondSkill: false,
        });
        expect(score - baseOnly).toBe(8);
    });

    it('種別 null + bondDice あり → baseScore のみ（加算なし）', () => {
        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: null },
            history: {
                ...baseHistory,
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    bondDice: makeDice('1d15', [12]),
                    computedScore: 0,
                },
            },
        });
        // CR-SA-15-E2 / 2026-05-15: houseRules Pick 型拡張（uniqueDiceConfig 追加）に追従
        const houseRules = { enableBondSkill: true, enableSpecialStrategy: false, effectValue: 15, uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG };
        const score = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRules);
        const baseOnly = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, {
            ...houseRules,
            enableBondSkill: false,
        });
        expect(score).toBe(baseOnly);
    });

    it('特殊戦法（捲り Mid 発動）+ 絆ギャンブル併用 → 戦法 delta + 絆 delta 両方加算', () => {
        // Bundle-4 既存パターン: 中盤発動 Makuri → +effectValue（終盤 history あれば反動 -effectValue 累積で 0）
        // 終盤に End history あり → delta 0
        // 但し、終盤発動扱いとならず Mid 発動 → +effectValue になり、End あれば反動 -effectValue で結局 0
        // ここでは絆スキルが特殊戦法と独立加算されることだけを検証する
        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history: {
                ...baseHistory,
                Mid: {
                    baseDice: makeDice('3d5', [5, 5, 5]),
                    specialStrategy: 'Makuri' as const,
                    computedScore: 0,
                },
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    bondDice: makeDice('1d15', [12]),
                    computedScore: 0,
                },
            },
        });
        const houseRulesBoth = {
            enableBondSkill: true,
            enableSpecialStrategy: true,
            effectValue: 15,
            // CR-SA-15-E2 / 2026-05-15: houseRules Pick 型拡張（uniqueDiceConfig 追加）に追従
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        };
        const houseRulesNoBond = { ...houseRulesBoth, enableBondSkill: false };
        const scoreBoth = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRulesBoth);
        const scoreNoBond = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRulesNoBond);
        // 絆スキル ON との差分は bondDice.sum と一致
        expect(scoreBoth - scoreNoBond).toBe(12);
    });

    it('bondDice 不在 + 種別あり → baseScore のみ（解析未実行）', () => {
        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history: baseHistory,
        });
        // CR-SA-15-E2 / 2026-05-15: houseRules Pick 型拡張（uniqueDiceConfig 追加）に追従
        const houseRules = { enableBondSkill: true, enableSpecialStrategy: false, effectValue: 15, uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG };
        const score = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRules);
        const baseOnly = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, {
            ...houseRules,
            enableBondSkill: false,
        });
        expect(score).toBe(baseOnly);
    });
});

// CR-SA-15-E2 / 2026-05-15: houseRules.uniqueDiceConfig が calculateScoreWithBondSkill 経由で
// 固有固定値計算に伝播することの検証（houserule-features.md §5.4）。
describe('CR-SA-15-E2: calculateScoreWithBondSkill uniqueDiceConfig 参照化', () => {
    const strategies: Strategy[] = DEFAULT_STRATEGIES;
    const activePhaseIds = getActivePhaseIds(1);

    const baseHistory = {
        Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
        Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
        End: { baseDice: makeDice('3d6', [7, 7, 6]), computedScore: 0 },
    };

    it('uniqueDiceConfig カスタム値（安定型固定値 5→12）が固有固定値加算に反映される', () => {
        // 固有スキル安定型（発動フェーズ End）+ End に固有ダイス取り込み済
        const p = makeParticipant({
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['End'] },
            bondSkill: { type: null },
            history: {
                ...baseHistory,
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    uniqueDice: makeDice('1d10', [8]),
                    computedScore: 0,
                },
            },
        });
        const houseRulesDefault = {
            enableBondSkill: false,
            enableSpecialStrategy: false,
            effectValue: 15,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        };
        // 安定型固定値を 5 → 12 に変更したカスタム設定
        const customConfig: UniqueDiceConfig = {
            ...DEFAULT_UNIQUE_DICE_CONFIG,
            Stability: { fixValue: 12, diceStr: '1d10' },
        };
        const houseRulesCustom = { ...houseRulesDefault, uniqueDiceConfig: customConfig };
        const scoreDefault = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRulesDefault);
        const scoreCustom = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRulesCustom);
        // 固有固定値 5 → 12 の差分 +7 が score に反映される
        expect(scoreCustom - scoreDefault).toBe(7);
    });

    it('uniqueDiceConfig デフォルト値では固有固定値が従来のハードコード値（安定型 +5）と一致', () => {
        const p = makeParticipant({
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: ['End'] },
            bondSkill: { type: null },
            history: {
                ...baseHistory,
                End: {
                    baseDice: makeDice('3d6', [7, 7, 6]),
                    uniqueDice: makeDice('1d10', [8]),
                    computedScore: 0,
                },
            },
        });
        // 固有スキルなし参加者との score 差分 = 固有固定値 5 + uniqueDice sum 8 = 13
        const pNoUnique = makeParticipant({
            strategy: '先行',
            uniqueSkill: { type: 'Stability', phases: [] },
            bondSkill: { type: null },
            history: baseHistory,
        });
        const houseRules = {
            enableBondSkill: false,
            enableSpecialStrategy: false,
            effectValue: 15,
            uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
        };
        const scoreWithUnique = calculateScoreWithBondSkill(p, strategies, null, activePhaseIds, houseRules);
        const scoreNoUnique = calculateScoreWithBondSkill(pNoUnique, strategies, null, activePhaseIds, houseRules);
        expect(scoreWithUnique - scoreNoUnique).toBe(13);
    });
});

// CR-SA-17-E4 / 2026-06-08: 可変終盤（End1/End2…）対応（houserule-features.md §7.4）。
// 絆スキルセクション出力・最終加算は「最後の終盤フェーズ」で行う。
describe('CR-SA-17-E4: 絆スキルの可変終盤対応', () => {
    const houseRulesOn = { enableBondSkill: true };

    it('getBondSkillSection: 最後の終盤 End2 で出力、途中の終盤 End1 では空', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, name: 'ウィトゲンクリア', bondSkill: { type: 'BondGamble' } }),
        ];
        const expected = ['【絆スキル】', '① ウィトゲンクリア　絆ギャンブル　dice1d15='].join('\n');
        // lastEndPhaseId='End2' を渡す
        expect(getBondSkillSection(participants, 'End2', houseRulesOn, 'End2')).toBe(expected);
        // 途中の終盤 End1 → 非出力
        expect(getBondSkillSection(participants, 'End1', houseRulesOn, 'End2')).toBe('');
    });

    it('getBondSkillSection: lastEndPhaseId 省略時は End（終盤 1 回 / OFF 同一）', () => {
        const participants = [
            makeParticipant({ id: 'p1', gate: 1, name: 'A', bondSkill: { type: 'BondGamble' } }),
        ];
        expect(getBondSkillSection(participants, 'End', houseRulesOn)).not.toBe('');
        expect(getBondSkillSection(participants, 'End2', houseRulesOn)).toBe('');
    });

    it('calculateBondSkillDelta: 最後の終盤 End2 の bondDice を参照（lastEndPhaseId 指定）', () => {
        const p = makeParticipant({
            bondSkill: { type: 'BondGamble' },
            history: { End2: { bondDice: makeDice('1d15', [12]), computedScore: 0 } },
        });
        // lastEndPhaseId='End2' で End2 の bondDice 参照 → 12
        expect(calculateBondSkillDelta(p, houseRulesOn, 'End2')).toBe(12);
        // 省略時 'End' では End2 を見ないため 0
        expect(calculateBondSkillDelta(p, houseRulesOn)).toBe(0);
    });

    it('calculateScoreWithBondSkill: 可変終盤の activePhaseIds 末尾（End2）から bondDice を加算', () => {
        // ON 終盤 2 構成: activePhaseIds = [Start, Mid, End1, End2]
        const config = {
            midPhaseCount: 1,
            startPhaseCount: 1,
            endPhaseCount: 2,
            houseRules: { enablePhaseConfig: true } as RaceState['config']['houseRules'],
        };
        const activePhaseIds = getActivePhaseIdsForConfig(config);
        expect(activePhaseIds).toEqual(['Start', 'Mid', 'End1', 'End2']);

        const p = makeParticipant({
            strategy: '先行',
            bondSkill: { type: 'BondGamble' },
            history: {
                Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
                Mid: { baseDice: makeDice('3d5', [5, 5, 5]), computedScore: 0 },
                End1: { baseDice: makeDice('3d6', [7, 7, 6]), computedScore: 0 },
                End2: { baseDice: makeDice('3d6', [6, 6, 6]), bondDice: makeDice('1d15', [12]), computedScore: 0 },
            },
        });
        const houseRules = { enableBondSkill: true, enableSpecialStrategy: false, effectValue: 15, uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG };
        const score = calculateScoreWithBondSkill(p, DEFAULT_STRATEGIES, null, activePhaseIds, houseRules);
        const baseOnly = calculateScoreWithBondSkill(p, DEFAULT_STRATEGIES, null, activePhaseIds, { ...houseRules, enableBondSkill: false });
        // End2（最後の終盤）の bondDice sum=12 が加算される
        expect(score - baseOnly).toBe(12);
    });
});
// CR-SA-20-E4 / 2026-06-11: 隊列〔バ群〕補正の enableFormationDice ゲート
// （houserule-features.md §6.5 + scene1-setup.md L211「OFF 時は値が残っていても反映しない」）。
describe('calculateScoreWithBondSkill - CR-SA-20-E4 / 隊列補正ゲート', () => {
    const strategies: Strategy[] = DEFAULT_STRATEGIES;
    const activePhaseIds = getActivePhaseIds(1); // Start, Mid, End
    // 大逃げ Start: fix 30 + dice 10 = 40。pace 5（ミドル ±0）。
    // formation 1（超縦長）× pace 5（ミドル以下）→ 大逃げ +10。
    const p = makeParticipant({
        strategy: '大逃げ',
        history: {
            Start: { baseDice: makeDice('3d8', [3, 3, 4]), computedScore: 0 },
        },
    });
    const baseHouseRules = {
        enableBondSkill: false,
        enableSpecialStrategy: false,
        effectValue: 15,
        uniqueDiceConfig: DEFAULT_UNIQUE_DICE_CONFIG,
    };
    it('enableFormationDice=true × 隊列出目確定 → 補正が加算される', () => {
        const score = calculateScoreWithBondSkill(
            p, strategies, 5, activePhaseIds,
            { ...baseHouseRules, enableFormationDice: true },
            1,
        );
        expect(score).toBe(50); // 40 + 10
    });
    it('enableFormationDice=false × 隊列出目あり → 補正なし（OFF 透過 = 値が残っていても反映しない）', () => {
        const score = calculateScoreWithBondSkill(
            p, strategies, 5, activePhaseIds,
            { ...baseHouseRules, enableFormationDice: false },
            1,
        );
        expect(score).toBe(40);
    });
    it('enableFormationDice 省略（旧 4 キー houseRules）× formationFace 省略 → 従来と完全同一', () => {
        const score = calculateScoreWithBondSkill(p, strategies, 5, activePhaseIds, baseHouseRules);
        expect(score).toBe(40);
    });
    it('enableFormationDice=true × 隊列未確定（null）→ 補正なし', () => {
        const score = calculateScoreWithBondSkill(
            p, strategies, 5, activePhaseIds,
            { ...baseHouseRules, enableFormationDice: true },
            null,
        );
        expect(score).toBe(40);
    });
});
