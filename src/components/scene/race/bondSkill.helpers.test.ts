import { describe, it, expect } from 'vitest';
import {
    getBondSkillTypeLabel,
    formatBondSkillLine,
    getBondSkillSection,
} from './bondSkill.helpers';
import type { Umamusume } from '../../../types';

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
