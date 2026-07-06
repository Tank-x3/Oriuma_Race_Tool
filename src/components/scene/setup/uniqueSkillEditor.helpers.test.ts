// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル UI 用純粋関数群のテスト
// (modal-houserule.md §4 + houserule-features.md §5 SSoT 準拠)
import { describe, it, expect } from 'vitest';
import type { CustomUniqueSkill, UniqueDiceConfig, Umamusume } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import {
    UNIQUE_SKILL_TYPE_LABELS,
    getVisibleUniqueSkillTypes,
    createEditFormState,
    createDefaultResetFormState,
    formStateToEntry,
    validateUniqueDiceFixValue,
    buildUpdatedUniqueDiceConfig,
    getUniqueDicePreview,
    createNewCustomFormState,
    createEditCustomFormState,
    formStateToCustomSkill,
    validateCustomUniqueSkillName,
    getCustomUniqueDicePreview,
    isCustomUniqueSkillInUse,
    getCustomInitialDeleteStep,
    progressCustomDeleteStep,
    getCustomDeleteConfirmMessage,
    formatCustomUniqueLabel,
} from './uniqueSkillEditor.helpers';

describe('uniqueSkillEditor.helpers - UNIQUE_SKILL_TYPE_LABELS', () => {
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加で 5 → 7 タイプ
    it('固有スキル 7 タイプすべてのキーを持ち、表示名が modal-houserule.md §4 ワイヤーフレーム準拠', () => {
        expect(Object.keys(UNIQUE_SKILL_TYPE_LABELS).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII'].sort(),
        );
        expect(UNIQUE_SKILL_TYPE_LABELS.Stability).toBe('安定型');
        expect(UNIQUE_SKILL_TYPE_LABELS.Gamble).toBe('ギャンブル型');
        expect(UNIQUE_SKILL_TYPE_LABELS.Persistent).toBe('持続型');
        expect(UNIQUE_SKILL_TYPE_LABELS.SuperGamble).toBe('超ギャンブル');
        expect(UNIQUE_SKILL_TYPE_LABELS.SuperStability).toBe('超安定');
        expect(UNIQUE_SKILL_TYPE_LABELS.GambleII).toBe('ギャンブル型Ⅱ');
        expect(UNIQUE_SKILL_TYPE_LABELS.StabilityII).toBe('安定型Ⅱ');
    });
});

describe('uniqueSkillEditor.helpers - getVisibleUniqueSkillTypes (Round 2: 2 引数化)', () => {
    // Round 2 修正（2026-05-15 ユーザーフィードバック）: 持続型は enableCompositeUnique 連動。
    // entryForm.helpers.ts getUniqueSkillTypeOptions の挙動と整合させる。
    it('enableExtendedUnique OFF + enableCompositeUnique OFF → 安定型 / ギャンブル型のみ（2 種、持続型・拡張固有タイプを含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(false, false);
        expect(visible).toEqual(['Stability', 'Gamble']);
    });

    it('enableExtendedUnique OFF + enableCompositeUnique ON → 安定型 / ギャンブル型 / 持続型（3 種、拡張固有タイプを含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(false, true);
        expect(visible).toEqual(['Stability', 'Gamble', 'Persistent']);
        expect(visible).not.toContain('SuperGamble');
    });

    // CR-SA-19 / 2026-06-06: 拡張固有タイプ 4 種（超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ）
    it('enableExtendedUnique ON + enableCompositeUnique OFF → 安定型 / ギャンブル型 / 拡張 4 種（6 種、持続型を含まない）', () => {
        const visible = getVisibleUniqueSkillTypes(true, false);
        expect(visible).toEqual(['Stability', 'Gamble', 'SuperGamble', 'SuperStability', 'GambleII', 'StabilityII']);
        expect(visible).not.toContain('Persistent');
    });

    it('両 ON → 7 種すべて（表示順: 安定型 → ギャンブル型 → 持続型 → 超ギャンブル → 超安定 → ギャンブル型Ⅱ → 安定型Ⅱ）', () => {
        expect(getVisibleUniqueSkillTypes(true, true)).toEqual([
            'Stability',
            'Gamble',
            'Persistent',
            'SuperGamble',
            'SuperStability',
            'GambleII',
            'StabilityII',
        ]);
    });
});

describe('uniqueSkillEditor.helpers - createEditFormState', () => {
    it('UniqueDiceEntry の各フィールドを文字列化して初期化する（正の固定値 / 負の固定値）', () => {
        const stability = createEditFormState(DEFAULT_UNIQUE_DICE_CONFIG.Stability);
        expect(stability).toEqual({ fixValue: '5', diceStr: '1d10' });
        const superGamble = createEditFormState(DEFAULT_UNIQUE_DICE_CONFIG.SuperGamble);
        expect(superGamble).toEqual({ fixValue: '-10', diceStr: '1d35' });
    });
});

describe('uniqueSkillEditor.helpers - createDefaultResetFormState', () => {
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加で 5 → 7 タイプ
    it('DEFAULT_UNIQUE_DICE_CONFIG の値でフォームを生成する（7 タイプ）', () => {
        expect(createDefaultResetFormState('Stability')).toEqual({ fixValue: '5', diceStr: '1d10' });
        expect(createDefaultResetFormState('Gamble')).toEqual({ fixValue: '0', diceStr: '1d20' });
        expect(createDefaultResetFormState('Persistent')).toEqual({ fixValue: '0', diceStr: '1d10' });
        expect(createDefaultResetFormState('SuperGamble')).toEqual({ fixValue: '-10', diceStr: '1d35' });
        expect(createDefaultResetFormState('SuperStability')).toEqual({ fixValue: '8', diceStr: '1d3' });
        expect(createDefaultResetFormState('GambleII')).toEqual({ fixValue: '-20', diceStr: '1d45' });
        expect(createDefaultResetFormState('StabilityII')).toEqual({ fixValue: '0', diceStr: '2d7' });
    });
});

describe('uniqueSkillEditor.helpers - formStateToEntry', () => {
    it('正常系: 整数文字列（正・負）を数値に変換し、diceStr を trim する', () => {
        expect(formStateToEntry({ fixValue: '7', diceStr: '  1d11  ' })).toEqual({
            fixValue: 7,
            diceStr: '1d11',
        });
        expect(formStateToEntry({ fixValue: '-3', diceStr: '1d35' }).fixValue).toBe(-3);
    });

    it('fixValue が空欄 / 非数値の場合は 0 にフォールバック', () => {
        expect(formStateToEntry({ fixValue: '', diceStr: '1d10' }).fixValue).toBe(0);
        expect(formStateToEntry({ fixValue: 'abc', diceStr: '1d10' }).fixValue).toBe(0);
    });
});

describe('uniqueSkillEditor.helpers - validateUniqueDiceFixValue', () => {
    it('整数（正・負・ゼロ）→ エラーなし', () => {
        expect(validateUniqueDiceFixValue('5')).toEqual([]);
        expect(validateUniqueDiceFixValue('-10')).toEqual([]);
        expect(validateUniqueDiceFixValue('0')).toEqual([]);
    });

    it('空欄 / 空白のみ → エラー', () => {
        expect(validateUniqueDiceFixValue('')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('   ')).toHaveLength(1);
    });

    it('整数以外（小数 / 非数値 / 符号のみ）→ エラー', () => {
        expect(validateUniqueDiceFixValue('1.5')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('abc')).toHaveLength(1);
        expect(validateUniqueDiceFixValue('-')).toHaveLength(1);
    });
});

describe('uniqueSkillEditor.helpers - buildUpdatedUniqueDiceConfig', () => {
    it('指定タイプのエントリのみを更新し、指定外のタイプは不変', () => {
        const next = buildUpdatedUniqueDiceConfig(DEFAULT_UNIQUE_DICE_CONFIG, 'Stability', {
            fixValue: 7,
            diceStr: '1d11',
        });
        expect(next.Stability).toEqual({ fixValue: 7, diceStr: '1d11' });
        expect(next.Gamble).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.Gamble);
        expect(next.SuperGamble).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.SuperGamble);
    });

    it('新しいオブジェクトを返し（参照比較トリガー対応）、引数の current を破壊しない（mutate しない）', () => {
        const current: UniqueDiceConfig = { ...DEFAULT_UNIQUE_DICE_CONFIG };
        const next = buildUpdatedUniqueDiceConfig(current, 'Persistent', {
            fixValue: 99,
            diceStr: '1d99',
        });
        expect(next).not.toBe(current);
        expect(current.Persistent).toEqual(DEFAULT_UNIQUE_DICE_CONFIG.Persistent);
    });
});

describe('uniqueSkillEditor.helpers - getUniqueDicePreview', () => {
    it('fixValue > 0 → `[fixValue]+dice[diceStr]=`（houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('Stability', { fixValue: 5, diceStr: '1d10' })).toBe(
            '5+dice1d10=',
        );
        expect(getUniqueDicePreview('Stability', { fixValue: 7, diceStr: '1d11' })).toBe(
            '7+dice1d11=',
        );
    });

    it('fixValue < 0 → `[fixValue]+dice[diceStr]=`（負号込み、houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('SuperGamble', { fixValue: -10, diceStr: '1d35' })).toBe(
            '-10+dice1d35=',
        );
    });

    it('fixValue === 0 → `dice[diceStr]=`（houserule-features.md §5.3）', () => {
        expect(getUniqueDicePreview('Gamble', { fixValue: 0, diceStr: '1d20' })).toBe('dice1d20=');
    });
});

// CR-SA-21 / CR-SA-21+22-E2 / 2026-07-06: カスタム固有スキル helpers（modal-houserule.md §4 + houserule-features.md §8 SSoT）
describe('uniqueSkillEditor.helpers - カスタム固有 (CR-SA-21+22-E2)', () => {
    describe('createNewCustomFormState / createEditCustomFormState', () => {
        it('createNewCustomFormState は空フォームを返す（fixValue=0 デフォルト）', () => {
            expect(createNewCustomFormState()).toEqual({ name: '', fixValue: '0', diceStr: '' });
        });

        it('createEditCustomFormState は既存 CustomUniqueSkill を文字列化して初期化', () => {
            const skill: CustomUniqueSkill = { id: 'x', name: '先行特化', fixValue: -5, diceStr: '1d30' };
            expect(createEditCustomFormState(skill)).toEqual({
                name: '先行特化',
                fixValue: '-5',
                diceStr: '1d30',
            });
        });
    });

    describe('formStateToCustomSkill', () => {
        it('trim + 数値変換 + id 差し込み', () => {
            const skill = formStateToCustomSkill(
                { name: '  A  ', fixValue: '3', diceStr: '  1d10  ' },
                'id-1',
            );
            expect(skill).toEqual({ id: 'id-1', name: 'A', fixValue: 3, diceStr: '1d10' });
        });

        it('fixValue が空欄 / 非数値 → 0 にフォールバック（formStateToEntry と同方針）', () => {
            expect(formStateToCustomSkill({ name: 'X', fixValue: '', diceStr: '1d5' }, 'i').fixValue).toBe(0);
            expect(formStateToCustomSkill({ name: 'X', fixValue: 'abc', diceStr: '1d5' }, 'i').fixValue).toBe(0);
        });
    });

    describe('validateCustomUniqueSkillName - modal-houserule.md §Error Handling L302-307 SSoT 完全一致', () => {
        it('空欄 → 「固有スキル名を入力してください。」', () => {
            expect(validateCustomUniqueSkillName('', [])).toEqual(['固有スキル名を入力してください。']);
            expect(validateCustomUniqueSkillName('   ', [])).toEqual(['固有スキル名を入力してください。']);
        });

        it('20 文字超過 → 「固有スキル名は 20 文字以内で入力してください。」', () => {
            const long = 'あ'.repeat(21);
            expect(validateCustomUniqueSkillName(long, [])).toEqual([
                '固有スキル名は 20 文字以内で入力してください。',
            ]);
        });

        it('20 文字ちょうどは通過', () => {
            const exact = 'あ'.repeat(20);
            expect(validateCustomUniqueSkillName(exact, [])).toEqual([]);
        });

        it('禁止文字 + / = / 改行 → 「固有スキル名に計算記号(+, =)や改行は使用できません」', () => {
            expect(validateCustomUniqueSkillName('逃げ+', [])).toEqual([
                '固有スキル名に計算記号(+, =)や改行は使用できません',
            ]);
            expect(validateCustomUniqueSkillName('A=B', [])).toEqual([
                '固有スキル名に計算記号(+, =)や改行は使用できません',
            ]);
            expect(validateCustomUniqueSkillName('A\nB', [])).toEqual([
                '固有スキル名に計算記号(+, =)や改行は使用できません',
            ]);
        });

        it('予約語（組み込み 7 表示名 +「なし」）→ 重複エラー（8 パターン）', () => {
            const reserved = ['安定型', 'ギャンブル型', '持続型', '超ギャンブル', '超安定', 'ギャンブル型Ⅱ', '安定型Ⅱ', 'なし'];
            for (const name of reserved) {
                expect(validateCustomUniqueSkillName(name, [])).toEqual([
                    `固有スキル名 '${name}' は既に使用されています。別の名前を指定してください。`,
                ]);
            }
        });

        it('他カスタムとの trim 後重複 → 重複エラー', () => {
            const existing: CustomUniqueSkill[] = [
                { id: 'a', name: '先行特化', fixValue: 0, diceStr: '1d10' },
            ];
            expect(validateCustomUniqueSkillName('先行特化', existing)).toEqual([
                `固有スキル名 '先行特化' は既に使用されています。別の名前を指定してください。`,
            ]);
            // trim 後比較
            expect(validateCustomUniqueSkillName('  先行特化  ', existing)).toEqual([
                `固有スキル名 '先行特化' は既に使用されています。別の名前を指定してください。`,
            ]);
        });

        it('編集時（editingId 一致）は自分自身との重複を無視', () => {
            const existing: CustomUniqueSkill[] = [
                { id: 'a', name: '先行特化', fixValue: 0, diceStr: '1d10' },
            ];
            expect(validateCustomUniqueSkillName('先行特化', existing, 'a')).toEqual([]);
            // 他カスタムとの重複は引き続き検出
            const both: CustomUniqueSkill[] = [
                { id: 'a', name: '先行特化', fixValue: 0, diceStr: '1d10' },
                { id: 'b', name: '逃げ加速', fixValue: 0, diceStr: '1d20' },
            ];
            expect(validateCustomUniqueSkillName('逃げ加速', both, 'a')).toEqual([
                `固有スキル名 '逃げ加速' は既に使用されています。別の名前を指定してください。`,
            ]);
        });

        it('正常系: 未登録の名前 → エラーなし', () => {
            expect(validateCustomUniqueSkillName('新しいスキル', [])).toEqual([]);
        });
    });

    describe('getCustomUniqueDicePreview - §5.3 生成ルール', () => {
        it('fixValue === 0 → `dice[diceStr]=`', () => {
            expect(getCustomUniqueDicePreview({ fixValue: 0, diceStr: '1d25' })).toBe('dice1d25=');
        });

        it('fixValue > 0 → `[fixValue]+dice[diceStr]=`', () => {
            expect(getCustomUniqueDicePreview({ fixValue: 5, diceStr: '1d10' })).toBe('5+dice1d10=');
        });

        it('fixValue < 0 → `[fixValue]+dice[diceStr]=`（負号込み）', () => {
            expect(getCustomUniqueDicePreview({ fixValue: -5, diceStr: '1d30' })).toBe('-5+dice1d30=');
        });
    });

    describe('isCustomUniqueSkillInUse', () => {
        const makeP = (id: string, customId?: string): Umamusume => ({
            id,
            entryIndex: 1,
            name: id,
            strategy: '逃げ',
            uniqueSkill: {
                type: customId ? ('Custom' as const) : ('Stability' as const),
                phases: [],
                customUniqueSkillId: customId,
            },
            gate: null,
            score: 0,
            history: {},
        });

        it('該当 id を参照する出走者がいれば true', () => {
            const parts = [makeP('a', 'target'), makeP('b')];
            expect(isCustomUniqueSkillInUse('target', parts)).toBe(true);
        });

        it('参照者ゼロなら false', () => {
            expect(isCustomUniqueSkillInUse('nobody', [makeP('a', 'other')])).toBe(false);
            expect(isCustomUniqueSkillInUse('nobody', [])).toBe(false);
        });
    });

    describe('getCustomInitialDeleteStep + progressCustomDeleteStep', () => {
        const makeP = (hasStartDice: boolean): Umamusume => ({
            id: 'p',
            entryIndex: 1,
            name: 'p',
            strategy: '逃げ',
            uniqueSkill: { type: 'Stability' as const, phases: [] },
            gate: null,
            score: 0,
            history: hasStartDice
                ? { Start: { computedScore: 0, baseDice: { diceStr: '3d6', values: [1, 2, 3], sum: 6 } } }
                : {},
        });

        it('序盤ダイス未入力（isMidRace=false） → pre-race', () => {
            expect(getCustomInitialDeleteStep([makeP(false)])).toBe('pre-race');
            expect(getCustomInitialDeleteStep([])).toBe('pre-race');
        });

        it('序盤ダイス入力済（isMidRace=true） → mid-race-warning', () => {
            expect(getCustomInitialDeleteStep([makeP(true)])).toBe('mid-race-warning');
        });

        it('progressCustomDeleteStep: warning → final、他は不変', () => {
            expect(progressCustomDeleteStep('mid-race-warning')).toBe('mid-race-final');
            expect(progressCustomDeleteStep('pre-race')).toBe('pre-race');
            expect(progressCustomDeleteStep('mid-race-final')).toBe('mid-race-final');
        });
    });

    describe('getCustomDeleteConfirmMessage', () => {
        const inUseParts: Umamusume[] = [
            {
                id: 'p1',
                entryIndex: 1,
                name: 'p1',
                strategy: '逃げ',
                uniqueSkill: { type: 'Custom' as const, phases: ['Start'], customUniqueSkillId: 'target' },
                gate: null,
                score: 0,
                history: {},
            },
        ];

        it('pre-race + 使用中 → title「カスタム固有スキルの削除」+ 使用中文言 + primary 「削除」', () => {
            const msg = getCustomDeleteConfirmMessage('pre-race', '先行特化', 'target', inUseParts);
            expect(msg.title).toBe('カスタム固有スキルの削除');
            expect(msg.body).toContain('先行特化');
            expect(msg.body).toContain('該当する出走者');
            expect(msg.primaryLabel).toBe('削除');
            expect(msg.cancelLabel).toBe('キャンセル');
        });

        it('mid-race-warning + 使用中 → title「（警告）」+ 使用中文言 + primary「次へ」', () => {
            const msg = getCustomDeleteConfirmMessage('mid-race-warning', '先行特化', 'target', inUseParts);
            expect(msg.title).toContain('警告');
            expect(msg.body).toContain('現在使用されています');
            expect(msg.primaryLabel).toBe('次へ');
        });

        it('mid-race-final → 「最終確認」+ primary「削除」', () => {
            const msg = getCustomDeleteConfirmMessage('mid-race-final', '先行特化', 'target', []);
            expect(msg.title).toBe('最終確認');
            expect(msg.body).toContain('先行特化');
            expect(msg.primaryLabel).toBe('削除');
        });
    });

    describe('formatCustomUniqueLabel', () => {
        it('カスタム名 + fixValue 符号別 = EntryForm 選択肢と同一規則', () => {
            expect(formatCustomUniqueLabel({ id: 'x', name: '先行特化', fixValue: 0, diceStr: '1d25' })).toBe(
                '先行特化 (1d25)',
            );
            expect(formatCustomUniqueLabel({ id: 'x', name: '逃げ加速', fixValue: -5, diceStr: '1d30' })).toBe(
                '逃げ加速 (-5+1d30)',
            );
        });
    });
});
