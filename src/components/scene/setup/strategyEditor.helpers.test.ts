// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル UI 用純粋関数群のテスト
import { describe, it, expect } from 'vitest';
import type { Strategy, Umamusume } from '../../../types';
import { DEFAULT_STRATEGIES } from '../../../core/strategies';
import { FORMATION_ROW_IDS } from '../../../core/formation';
import {
    PACE_ROLL_RANGE,
    FORMATION_ROW_LABELS,
    createEditFormState,
    createInsertFormState,
    createDefaultResetFormState,
    formStateToStrategy,
    getDefaultPaceModifiers,
    getDefaultFormationModifiers,
    getInitialDeleteStep,
    progressDeleteStep,
    getDeleteConfirmMessage,
    type StrategyFormState,
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
            formationModifiers: {},
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
            formationModifiers: {},
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
            formationModifiers: {},
        };
        const strategy = formStateToStrategy(form);
        expect(strategy.dice.start).toBe('3d6');
        expect(strategy.dice.mid).toBe('3d5');
        expect(strategy.dice.end).toBe('1d7');
    });
});

// CR-SA-24-E2 / 2026-08-16: 隊列〔バ群〕補正マトリクスの編集
// （modal-houserule.md §2 / houserule-features.md §6.10 / §1 Insert）。
// E1 の「編集元の値を無条件パススルー」は、入力欄が付いた E2 で「フォーム値優先」へ方式転換した
// （指示書 必須編集 A-6）。値の消失防止（A-7）は、隊列 OFF でもフォーム状態に値を保持したまま
// 入力欄だけを隠す造りで担保する（本ファイルではフォームに値がある状態の保存で検証する）。
describe('strategyEditor.helpers - getDefaultFormationModifiers (CR-SA-24-E2)', () => {
    it('DEFAULT 脚質「差し」の効果表 7 行を抽出する', () => {
        const result = getDefaultFormationModifiers('差し');
        expect(Object.keys(result)).toHaveLength(7);
        expect(result['1:middleOrSlower']).toBe(-5);
        expect(result['1:highOrFaster']).toBe(7);
        expect(result['2-3']).toBe(0);
        expect(result['4-6']).toBe(0);
        expect(result['7-8']).toBe(5);
        expect(result['9:middleOrSlower']).toBe(8);
        expect(result['9:highOrFaster']).toBe(0);
    });

    it('DEFAULT 脚質「大逃げ」の効果表値を抽出する', () => {
        const result = getDefaultFormationModifiers('大逃げ');
        expect(result['1:middleOrSlower']).toBe(10);
        expect(result['9:middleOrSlower']).toBe(-10);
        expect(result['9:highOrFaster']).toBe(7);
    });

    it('±0 セルも明示的な 0 として返る（「先行」は 2.3 縦長のみ +5、他 6 行は 0）', () => {
        const result = getDefaultFormationModifiers('先行');
        expect(Object.keys(result)).toHaveLength(7);
        expect(result['2-3']).toBe(5);
        expect(result['1:middleOrSlower']).toBe(0);
        expect(result['9:highOrFaster']).toBe(0);
        expect(Object.values(result).filter((v) => v === 0)).toHaveLength(6);
    });

    it('効果表に列を持たないカスタム脚質 → 空オブジェクト', () => {
        const result = getDefaultFormationModifiers('カスタム X');
        expect(Object.keys(result)).toHaveLength(0);
    });
});

describe('strategyEditor.helpers - FORMATION_ROW_LABELS (CR-SA-24-E2)', () => {
    it('効果表と同じ 7 行・同じ順序の行 ID を持つ', () => {
        expect(FORMATION_ROW_LABELS).toHaveLength(7);
        expect(FORMATION_ROW_LABELS.map((r) => r.id)).toEqual([...FORMATION_ROW_IDS]);
    });

    it('行ラベルは「出目 + 形態名 + ペース条件」で構成される（ワイヤーフレーム準拠）', () => {
        const labels = Object.fromEntries(FORMATION_ROW_LABELS.map((r) => [r.id, r.label]));
        expect(labels['1:middleOrSlower']).toBe('1 超縦長（ペース〜ミドル）');
        expect(labels['1:highOrFaster']).toBe('1 超縦長（ペース ハイ〜）');
        expect(labels['2-3']).toBe('2.3 縦長');
        expect(labels['4-6']).toBe('4.5.6 普通');
        expect(labels['7-8']).toBe('7.8 団子');
        expect(labels['9:middleOrSlower']).toBe('9 超団子（ペース〜ミドル）');
        expect(labels['9:highOrFaster']).toBe('9 超団子（ペース ハイ〜）');
    });
});

describe('strategyEditor.helpers - createEditFormState 隊列補正 (CR-SA-24-E2)', () => {
    it('DEFAULT 脚質は設定値が空でも効果表の値を表示する（解決順 ②）', () => {
        const sashi = DEFAULT_STRATEGIES.find((s) => s.name === '差し')!;
        const form = createEditFormState(sashi);
        expect(Object.keys(form.formationModifiers)).toHaveLength(7);
        expect(form.formationModifiers['1:middleOrSlower']).toBe('-5');
        expect(form.formationModifiers['7-8']).toBe('5');
        expect(form.formationModifiers['4-6']).toBe('0');
    });

    it('脚質の設定値がある行は効果表より優先して表示する（解決順 ①）', () => {
        const sashi = DEFAULT_STRATEGIES.find((s) => s.name === '差し')!;
        const form = createEditFormState({
            ...sashi,
            formationModifiers: { '7-8': 9 },
        });
        expect(form.formationModifiers['7-8']).toBe('9'); // 設定値
        expect(form.formationModifiers['1:middleOrSlower']).toBe('-5'); // 効果表
    });

    it('明示的な 0 は "0" として表示され、空欄と区別される', () => {
        const custom: Strategy = {
            name: 'カスタム A',
            fixValue: 20,
            dice: { start: '2d6', mid: '2d5', end: '1d10' },
            paceModifiers: {},
            formationModifiers: { '2-3': 0 },
        };
        const form = createEditFormState(custom);
        expect(form.formationModifiers['2-3']).toBe('0');
        expect(form.formationModifiers['7-8']).toBe('');
    });

    it('設定値のないカスタム脚質は全 7 行が空欄（解決順 ③ = ±0）', () => {
        const custom: Strategy = {
            name: 'カスタム A',
            fixValue: 20,
            dice: { start: '2d6', mid: '2d5', end: '1d10' },
            paceModifiers: {},
        };
        const form = createEditFormState(custom);
        expect(Object.keys(form.formationModifiers)).toHaveLength(7);
        expect(Object.values(form.formationModifiers).every((v) => v === '')).toBe(true);
    });
});

describe('strategyEditor.helpers - createDefaultResetFormState 隊列補正 (CR-SA-24-E2)', () => {
    it('「初期値に戻す」で隊列補正も効果表の値へ戻る', () => {
        const form = createDefaultResetFormState('追込')!;
        expect(Object.keys(form.formationModifiers)).toHaveLength(7);
        expect(form.formationModifiers['1:middleOrSlower']).toBe('-5');
        expect(form.formationModifiers['1:highOrFaster']).toBe('10');
        expect(form.formationModifiers['9:middleOrSlower']).toBe('12');
    });

    it('編集中に上書きした設定値に依存せず効果表の値になる', () => {
        // 「初期値に戻す」は脚質名のみを引数に取るため、現在の設定値は参照されない
        const form = createDefaultResetFormState('逃げ')!;
        expect(form.formationModifiers['1:middleOrSlower']).toBe('7');
        expect(form.formationModifiers['9:middleOrSlower']).toBe('-7');
    });
});

describe('strategyEditor.helpers - createInsertFormState 隊列補正 (CR-SA-24-E2)', () => {
    it('直前が DEFAULT 脚質のとき、表示上の有効値（効果表の値）を引き継ぐ', () => {
        const sakigake = DEFAULT_STRATEGIES.find((s) => s.name === '先行')!;
        const form = createInsertFormState(sakigake);
        expect(form.name).toBe('');
        expect(Object.keys(form.formationModifiers)).toHaveLength(7);
        // 「先行」は 2.3 縦長のみ +5、他は ±0。±0 の行もキー未設定ではなく "0" が入る（実値化の起点）
        expect(form.formationModifiers['2-3']).toBe('5');
        expect(form.formationModifiers['1:middleOrSlower']).toBe('0');
        expect(form.formationModifiers['9:highOrFaster']).toBe('0');
    });

    it('直前がカスタム脚質のとき、その設定値を引き継ぐ', () => {
        const prev: Strategy = {
            name: 'カスタム B',
            fixValue: 12,
            dice: { start: '2d8', mid: '3d4', end: '1d20' },
            paceModifiers: {},
            formationModifiers: { '1:middleOrSlower': 6, '7-8': -2 },
        };
        const form = createInsertFormState(prev);
        expect(form.formationModifiers['1:middleOrSlower']).toBe('6');
        expect(form.formationModifiers['7-8']).toBe('-2');
        expect(form.formationModifiers['2-3']).toBe(''); // 未設定 = 空欄のまま
    });
});

describe('strategyEditor.helpers - formStateToStrategy 隊列補正 (CR-SA-24-E2)', () => {
    const makeForm = (
        formationModifiers: StrategyFormState['formationModifiers'],
    ): StrategyFormState => ({
        name: 'カスタム D',
        fixValue: '20',
        diceStart: '3d6',
        diceMid: '3d5',
        diceEnd: '1d7',
        paceModifiers: {},
        formationModifiers,
    });

    const withFormation: Strategy = {
        name: 'カスタム D',
        fixValue: 10,
        dice: { start: '3d6', mid: '3d5', end: '1d7' },
        paceModifiers: {},
        formationModifiers: { '1:middleOrSlower': 6, '7-8': -2 },
    };

    it('フォームの入力値が数値化されて保存される（フォーム値優先）', () => {
        const strategy = formStateToStrategy(makeForm({ '1:middleOrSlower': '12', '7-8': '9' }));
        expect(strategy.formationModifiers).toEqual({ '1:middleOrSlower': 12, '7-8': 9 });
    });

    it('空欄の行はキーを立てない（= 未設定へ戻す明示操作）', () => {
        const strategy = formStateToStrategy(makeForm({ '2-3': '', '7-8': '5' }));
        expect(strategy.formationModifiers).toEqual({ '7-8': 5 });
        expect(strategy.formationModifiers?.['2-3']).toBeUndefined();
    });

    it('明示的な 0 と負値は保持される（空欄と区別）', () => {
        const strategy = formStateToStrategy(makeForm({ '2-3': '0', '4-6': '-3' }));
        expect(strategy.formationModifiers).toEqual({ '2-3': 0, '4-6': -3 });
    });

    it('入力途中の "-" のみはキーを立てない（空欄と同じ扱い）', () => {
        const strategy = formStateToStrategy(makeForm({ '2-3': '-' }));
        expect(strategy.formationModifiers).toBeUndefined();
    });

    it('全行が空欄ならフィールド自体を付与しない（既存構造を変えない）', () => {
        const strategy = formStateToStrategy(makeForm({}));
        expect(strategy.formationModifiers).toBeUndefined();
        expect('formationModifiers' in strategy).toBe(false);
    });

    it('編集元に値があってもフォーム値が優先される（空欄にした行は消える）', () => {
        // GM が '1:middleOrSlower' を空欄にし、'7-8' を -2 → 4 に変更した保存を模す
        const strategy = formStateToStrategy(makeForm({ '7-8': '4' }), withFormation);
        expect(strategy.formationModifiers).toEqual({ '7-8': 4 });
    });

    it('隊列 OFF（セクション非表示）で保存しても設定値は消えない', () => {
        // OFF 時も createEditFormState が解決した値がフォーム状態に残るため、
        // 固定値だけを変更した保存で隊列補正が失われない（必須編集 A-7 / DoD #6）。
        const form = { ...createEditFormState(withFormation), fixValue: '20' };
        const strategy = formStateToStrategy(form, withFormation);
        expect(strategy.fixValue).toBe(20);
        expect(strategy.formationModifiers).toEqual({ '1:middleOrSlower': 6, '7-8': -2 });
    });

    it('効果表 7 行に該当しないキー（旧 / 将来形式の JSON 由来）は編集元から引き継ぐ', () => {
        const source = {
            ...withFormation,
            formationModifiers: { '7-8': -2, 'unknown-row': 3 },
        } as unknown as Strategy;
        const strategy = formStateToStrategy(makeForm({ '7-8': '4' }), source);
        expect(strategy.formationModifiers).toEqual({ '7-8': 4, 'unknown-row': 3 });
    });

    it('保存結果は編集元と別オブジェクト（保存後の変更が元へ波及しない）', () => {
        const strategy = formStateToStrategy(makeForm({ '7-8': '4' }), withFormation);
        expect(strategy.formationModifiers).not.toBe(withFormation.formationModifiers);
    });

    it('Insert 経路: DEFAULT 脚質の直後に追加したカスタム脚質は実値を得る（本命ケース）', () => {
        const sashi = DEFAULT_STRATEGIES.find((s) => s.name === '差し')!;
        const form = { ...createInsertFormState(sashi), name: 'カスタム E' };
        const strategy = formStateToStrategy(form, sashi);
        expect(strategy.name).toBe('カスタム E');
        // 直前「差し」の効果表値が実値として書き込まれる（保存後は設定値として解決される）
        expect(strategy.formationModifiers).toEqual({
            '1:middleOrSlower': -5,
            '1:highOrFaster': 7,
            '2-3': 0,
            '4-6': 0,
            '7-8': 5,
            '9:middleOrSlower': 8,
            '9:highOrFaster': 0,
        });
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
