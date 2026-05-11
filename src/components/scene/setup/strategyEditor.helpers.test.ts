// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル UI 用純粋関数群のテスト
import { describe, it, expect } from 'vitest';
import type { Strategy, Umamusume } from '../../../types';
import { DEFAULT_STRATEGIES } from '../../../core/strategies';
import {
    PACE_ROLL_RANGE,
    createEditFormState,
    createInsertFormState,
    createDefaultResetFormState,
    formStateToStrategy,
    getDefaultPaceModifiers,
    getInitialDeleteStep,
    progressDeleteStep,
    getDeleteConfirmMessage,
} from './strategyEditor.helpers';

const makeParticipant = (override: Partial<Umamusume>): Umamusume => ({
    id: 'p1',
    entryIndex: 1,
    name: 'Test',
    strategy: '逃げ',
    uniqueSkill: { type: 'Stability', phases: ['Mid1'] },
    gate: 1,
    score: 0,
    history: {},
    ...override,
});

describe('strategyEditor.helpers - PACE_ROLL_RANGE', () => {
    it('1 から 9 までの 9 要素を持つ', () => {
        expect(PACE_ROLL_RANGE).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(PACE_ROLL_RANGE).toHaveLength(9);
    });
});

describe('strategyEditor.helpers - getDefaultPaceModifiers', () => {
    it('「逃げ」の PACE_MODIFIERS 値を抽出する', () => {
        const result = getDefaultPaceModifiers('逃げ');
        // PACE_MODIFIERS[1]['逃げ'] = 10, [9]['逃げ'] = -5
        expect(result[1]).toBe(10);
        expect(result[9]).toBe(-5);
        expect(result[5]).toBe(0); // 中段は 0
    });

    it('「大逃げ」の PACE_MODIFIERS 値を抽出する', () => {
        const result = getDefaultPaceModifiers('大逃げ');
        expect(result[1]).toBe(12);
        expect(result[9]).toBe(-7);
    });

    it('PACE_MODIFIERS に存在しない名前 → 空オブジェクト', () => {
        const result = getDefaultPaceModifiers('カスタム X');
        expect(Object.keys(result)).toHaveLength(0);
    });
});

describe('strategyEditor.helpers - createEditFormState', () => {
    it('既存 Strategy の全フィールドを文字列化して初期化する (逃げの場合)', () => {
        const nige = DEFAULT_STRATEGIES.find((s) => s.name === '逃げ')!;
        const form = createEditFormState(nige);
        expect(form.name).toBe('逃げ');
        expect(form.fixValue).toBe('15');
        expect(form.diceStart).toBe('3d6');
        expect(form.diceMid).toBe('3d5');
        expect(form.diceEnd).toBe('1d7');
    });

    it('DEFAULT 脚質編集時、paceModifiers は PACE_MODIFIERS グローバルからフォールバック', () => {
        // DEFAULT_STRATEGIES.paceModifiers は空 {} のため、フォールバックで PACE_MODIFIERS グローバル参照
        const nige = DEFAULT_STRATEGIES.find((s) => s.name === '逃げ')!;
        const form = createEditFormState(nige);
        expect(form.paceModifiers[1]).toBe('10'); // PACE_MODIFIERS[1]['逃げ'] = 10
        expect(form.paceModifiers[9]).toBe('-5'); // PACE_MODIFIERS[9]['逃げ'] = -5
        expect(form.paceModifiers[5]).toBe('0');
    });

    it('カスタム脚質 + paceModifiers が一部のみ定義されている場合、定義済キーは文字列化、未定義キーは空文字', () => {
        const custom: Strategy = {
            name: 'カスタム A',
            fixValue: 20,
            dice: { start: '2d6', mid: '2d5', end: '1d10' },
            paceModifiers: { 1: 8, 5: 0, 9: -5 },
        };
        const form = createEditFormState(custom);
        expect(form.paceModifiers[1]).toBe('8');
        expect(form.paceModifiers[2]).toBe('');
        expect(form.paceModifiers[5]).toBe('0');
        expect(form.paceModifiers[9]).toBe('-5');
    });
});

describe('strategyEditor.helpers - createDefaultResetFormState', () => {
    it('「逃げ」の基本ルール値で初期化されたフォームを返す', () => {
        const form = createDefaultResetFormState('逃げ')!;
        expect(form).not.toBeNull();
        expect(form.name).toBe('逃げ');
        expect(form.fixValue).toBe('15');
        expect(form.diceStart).toBe('3d6');
        expect(form.paceModifiers[1]).toBe('10');
        expect(form.paceModifiers[9]).toBe('-5');
    });

    it('DEFAULT 脚質名以外を渡された場合は null を返す', () => {
        expect(createDefaultResetFormState('カスタム A')).toBeNull();
        expect(createDefaultResetFormState('')).toBeNull();
    });

    it('「大逃げ」も DEFAULT_STRATEGIES + PACE_MODIFIERS から復元', () => {
        const form = createDefaultResetFormState('大逃げ')!;
        expect(form.fixValue).toBe('30');
        expect(form.diceEnd).toBe('-1d27');
        expect(form.paceModifiers[1]).toBe('12');
    });
});

describe('strategyEditor.helpers - createInsertFormState', () => {
    it('直前脚質のパラメータをコピーしつつ、名前のみ空欄初期化', () => {
        const sakigake = DEFAULT_STRATEGIES.find((s) => s.name === '先行')!;
        const form = createInsertFormState(sakigake);
        expect(form.name).toBe('');
        expect(form.fixValue).toBe('10');
        expect(form.diceStart).toBe('3d5');
        expect(form.diceMid).toBe('3d5');
        expect(form.diceEnd).toBe('4d5');
    });

    it('paceModifiers がコピーされる (カスタム脚質直後挿入)', () => {
        const custom: Strategy = {
            name: 'カスタム B',
            fixValue: 12,
            dice: { start: '2d8', mid: '3d4', end: '1d20' },
            paceModifiers: { 1: 5, 9: -3 },
        };
        const form = createInsertFormState(custom);
        expect(form.name).toBe('');
        expect(form.paceModifiers[1]).toBe('5');
        expect(form.paceModifiers[9]).toBe('-3');
        expect(form.paceModifiers[5]).toBe('');
    });
});

describe('strategyEditor.helpers - formStateToStrategy', () => {
    it('フォーム値を Strategy オブジェクトに変換 (正常系)', () => {
        const form = {
            name: '  カスタム C  ',
            fixValue: '25',
            diceStart: '3d7',
            diceMid: '2d8',
            diceEnd: '1d15',
            paceModifiers: { 1: '10', 2: '5', 3: '0', 4: '', 5: '', 6: '', 7: '-2', 8: '-4', 9: '-8' },
        };
        const strategy = formStateToStrategy(form);
        expect(strategy.name).toBe('カスタム C'); // trim
        expect(strategy.fixValue).toBe(25);
        expect(strategy.dice.start).toBe('3d7');
        expect(strategy.dice.mid).toBe('2d8');
        expect(strategy.dice.end).toBe('1d15');
        expect(strategy.paceModifiers[1]).toBe(10);
        expect(strategy.paceModifiers[7]).toBe(-2);
        expect(strategy.paceModifiers[4]).toBeUndefined(); // 空欄は paceModifiers から除外
    });

    it('fixValue が空欄 / NaN の場合 0 にフォールバック', () => {
        const form = {
            name: 'X',
            fixValue: '',
            diceStart: '3d6',
            diceMid: '3d5',
            diceEnd: '1d7',
            paceModifiers: {},
        };
        const strategy = formStateToStrategy(form);
        expect(strategy.fixValue).toBe(0);
    });

    it('dice 各フェーズが trim される', () => {
        const form = {
            name: 'Y',
            fixValue: '5',
            diceStart: '  3d6  ',
            diceMid: ' 3d5 ',
            diceEnd: '1d7 ',
            paceModifiers: {},
        };
        const strategy = formStateToStrategy(form);
        expect(strategy.dice.start).toBe('3d6');
        expect(strategy.dice.mid).toBe('3d5');
        expect(strategy.dice.end).toBe('1d7');
    });
});

describe('strategyEditor.helpers - getInitialDeleteStep', () => {
    it('全 participant の Start.baseDice 不在 → pre-race', () => {
        const participants = [
            makeParticipant({ id: 'p1' }),
            makeParticipant({ id: 'p2' }),
        ];
        expect(getInitialDeleteStep(participants)).toBe('pre-race');
    });

    it('1 名でも Start.baseDice 存在 → mid-race-warning', () => {
        const participants = [
            makeParticipant({ id: 'p1' }),
            makeParticipant({
                id: 'p2',
                history: {
                    Start: {
                        baseDice: { diceStr: '3d6', values: [1, 2, 3], sum: 6 },
                        computedScore: 0,
                    },
                },
            }),
        ];
        expect(getInitialDeleteStep(participants)).toBe('mid-race-warning');
    });
});

describe('strategyEditor.helpers - progressDeleteStep', () => {
    it('mid-race-warning → mid-race-final', () => {
        expect(progressDeleteStep('mid-race-warning')).toBe('mid-race-final');
    });

    it('pre-race / mid-race-final は終端段階 (現状値を返す)', () => {
        expect(progressDeleteStep('pre-race')).toBe('pre-race');
        expect(progressDeleteStep('mid-race-final')).toBe('mid-race-final');
    });
});

describe('strategyEditor.helpers - getDeleteConfirmMessage', () => {
    it('Pre-Race + 未使用 → 単純な削除確認文言', () => {
        const participants = [makeParticipant({ strategy: '逃げ' })];
        const msg = getDeleteConfirmMessage('pre-race', 'カスタム X', participants);
        expect(msg.title).toBe('脚質の削除');
        expect(msg.body).toContain('カスタム X');
        expect(msg.body).not.toContain('リセット');
        expect(msg.primaryLabel).toBe('削除');
    });

    it('Pre-Race + 使用中 → リセット注意文言を含む', () => {
        const participants = [makeParticipant({ strategy: 'カスタム X' })];
        const msg = getDeleteConfirmMessage('pre-race', 'カスタム X', participants);
        expect(msg.body).toContain('リセット');
    });

    it('Mid-Race Warning + 使用中 → 仕様 SSoT 文言「現在使用されています」', () => {
        const participants = [makeParticipant({ strategy: 'カスタム X' })];
        const msg = getDeleteConfirmMessage('mid-race-warning', 'カスタム X', participants);
        expect(msg.body).toContain('現在使用されています');
        expect(msg.body).toContain('リセット');
        expect(msg.primaryLabel).toBe('次へ');
    });

    it('Mid-Race Warning + 未使用 → 簡略な削除予告文言', () => {
        const participants = [makeParticipant({ strategy: '逃げ' })];
        const msg = getDeleteConfirmMessage('mid-race-warning', 'カスタム X', participants);
        expect(msg.body).not.toContain('現在使用されています');
        expect(msg.primaryLabel).toBe('次へ');
    });

    it('Mid-Race Final → 最終確認文言', () => {
        const participants = [makeParticipant({ strategy: 'カスタム X' })];
        const msg = getDeleteConfirmMessage('mid-race-final', 'カスタム X', participants);
        expect(msg.title).toBe('最終確認');
        expect(msg.body).toContain('最終確認');
        expect(msg.body).toContain('カスタム X');
        expect(msg.primaryLabel).toBe('削除');
    });
});
