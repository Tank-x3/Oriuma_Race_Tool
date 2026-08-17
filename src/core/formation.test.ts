import { describe, it, expect } from 'vitest';
import {
    FORMATION_EFFECT_TABLE,
    FORMATION_ROW_IDS,
    getFormationLabel,
    getFormationModifier,
    getFormationTemplateLines,
} from './formation';
import { DEFAULT_STRATEGIES as DEFAULT_STRATEGY_LIST } from './strategies';
import type { FormationRowId, Strategy } from '../types';

// CR-SA-20-E2 / 2026-06-11: 隊列〔バ群〕ダイスの効果表・補正ロジック（純粋関数層）。
// SSoT: houserule-features.md §6.2（形態）/ §6.3（効果表 = 全セル網羅）/ §6.6（影響値テンプレート）。
// CR-SA-24-E1 / 2026-08-16: 脚質ごとの隊列補正設定値（§6.10）に対応。
// 解決順「脚質の設定値 → 効果表 → ±0」（§6.10.3）は末尾の describe で網羅する。

const DEFAULT_STRATEGIES = ['大逃げ', '逃げ', '先行', '差し', '追込'] as const;

/** テスト用の脚質オブジェクト生成（CR-SA-24-E1）。 */
const makeStrategy = (
    name: string,
    formationModifiers?: Partial<Record<FormationRowId, number>>,
): Strategy => ({
    name,
    fixValue: 0,
    dice: { start: '1d1', mid: '1d1', end: '1d1' },
    paceModifiers: {},
    ...(formationModifiers ? { formationModifiers } : {}),
});

/** §6.3 効果表の期待値（脚質列順 = 大逃げ / 逃げ / 先行 / 差し / 追込）。 */
const expectRow = (
    formationRoll: number,
    paceRoll: number,
    expected: readonly number[],
) => {
    DEFAULT_STRATEGIES.forEach((name, i) => {
        expect(getFormationModifier(formationRoll, paceRoll, name), `出目${formationRoll} × ペース${paceRoll} × ${name}`).toBe(expected[i]);
    });
};

describe('FORMATION_EFFECT_TABLE - CR-SA-20-E2 / houserule-features.md §6.3', () => {
    it('§6.3 の 7 行 × 5 脚質 = 35 セルがすべて明示定義されている（±0 含む）', () => {
        expect(FORMATION_EFFECT_TABLE).toHaveLength(7);
        for (const row of FORMATION_EFFECT_TABLE) {
            expect(Object.keys(row.modifiers).sort()).toEqual([...DEFAULT_STRATEGIES].sort());
        }
    });

    it('隊列出目 1〜9 がペース条件込みで一意の行に解決される（重複・欠落なし）', () => {
        for (let face = 1; face <= 9; face++) {
            for (const pace of ['middleOrSlower', 'highOrFaster'] as const) {
                const rows = FORMATION_EFFECT_TABLE.filter(r =>
                    r.faces.includes(face) && (r.pace === 'any' || r.pace === pace));
                expect(rows, `出目${face} × ${pace}`).toHaveLength(1);
            }
        }
    });
});

describe('getFormationLabel - CR-SA-20-E2 / houserule-features.md §6.2', () => {
    it('出目 → 形態名（1=超縦長 / 2,3=縦長 / 4,5,6=普通 / 7,8=団子 / 9=超団子）', () => {
        expect(getFormationLabel(1)).toBe('超縦長');
        expect(getFormationLabel(2)).toBe('縦長');
        expect(getFormationLabel(3)).toBe('縦長');
        expect(getFormationLabel(4)).toBe('普通');
        expect(getFormationLabel(5)).toBe('普通');
        expect(getFormationLabel(6)).toBe('普通');
        expect(getFormationLabel(7)).toBe('団子');
        expect(getFormationLabel(8)).toBe('団子');
        expect(getFormationLabel(9)).toBe('超団子');
    });

    it('範囲外の出目は「不明」（getPaceLabel と同方針）', () => {
        expect(getFormationLabel(0)).toBe('不明');
        expect(getFormationLabel(10)).toBe('不明');
    });
});

describe('getFormationModifier - CR-SA-20-E2 / houserule-features.md §6.3 全セル網羅', () => {
    it('出目 1（超縦長）× ペース 1〜6（ミドルまで）: +10 / +7 / ±0 / -5 / -5', () => {
        expectRow(1, 1, [10, 7, 0, -5, -5]);
        expectRow(1, 6, [10, 7, 0, -5, -5]);
    });

    it('出目 1（超縦長）× ペース 7〜9（ハイ以上）: ±0 / ±0 / ±0 / +7 / +10', () => {
        expectRow(1, 7, [0, 0, 0, 7, 10]);
        expectRow(1, 9, [0, 0, 0, 7, 10]);
    });

    it('出目 2, 3（縦長）はペース無関係: +5 / +5 / +5 / ±0 / ±0', () => {
        expectRow(2, 1, [5, 5, 5, 0, 0]);
        expectRow(2, 9, [5, 5, 5, 0, 0]);
        expectRow(3, 6, [5, 5, 5, 0, 0]);
        expectRow(3, 7, [5, 5, 5, 0, 0]);
    });

    it('出目 4, 5, 6（普通）はペース無関係: 全脚質 ±0', () => {
        expectRow(4, 1, [0, 0, 0, 0, 0]);
        expectRow(5, 7, [0, 0, 0, 0, 0]);
        expectRow(6, 9, [0, 0, 0, 0, 0]);
    });

    it('出目 7, 8（団子）はペース無関係: ±0 / ±0 / ±0 / +5 / +5', () => {
        expectRow(7, 1, [0, 0, 0, 5, 5]);
        expectRow(7, 9, [0, 0, 0, 5, 5]);
        expectRow(8, 6, [0, 0, 0, 5, 5]);
        expectRow(8, 7, [0, 0, 0, 5, 5]);
    });

    it('出目 9（超団子）× ペース 1〜6（ミドルまで）: -10 / -7 / ±0 / +8 / +12', () => {
        expectRow(9, 1, [-10, -7, 0, 8, 12]);
        expectRow(9, 6, [-10, -7, 0, 8, 12]);
    });

    it('出目 9（超団子）× ペース 7〜9（ハイ以上）: +7 / +5 / ±0 / ±0 / ±0', () => {
        expectRow(9, 7, [7, 5, 0, 0, 0]);
        expectRow(9, 9, [7, 5, 0, 0, 0]);
    });

    it('ペース境界（6 → 7）で超縦長・超団子の補正が切り替わる', () => {
        expect(getFormationModifier(1, 6, '大逃げ')).toBe(10);
        expect(getFormationModifier(1, 7, '大逃げ')).toBe(0);
        expect(getFormationModifier(1, 6, '追込')).toBe(-5);
        expect(getFormationModifier(1, 7, '追込')).toBe(10);
        expect(getFormationModifier(9, 6, '大逃げ')).toBe(-10);
        expect(getFormationModifier(9, 7, '大逃げ')).toBe(7);
        expect(getFormationModifier(9, 6, '追込')).toBe(12);
        expect(getFormationModifier(9, 7, '追込')).toBe(0);
    });

    // CR-SA-24-E1 / 2026-08-16: 脚質リスト未指定 = 設定値なしのため §6.10.3 の ③（±0）に落ちる。
    it('カスタム脚質（デフォルト 5 脚質以外）は脚質リスト未指定なら 0', () => {
        for (let face = 1; face <= 9; face++) {
            expect(getFormationModifier(face, 3, 'カスタム脚質')).toBe(0);
            expect(getFormationModifier(face, 8, 'カスタム脚質')).toBe(0);
        }
    });

    it('範囲外の隊列出目（0 / 10 / 非整数）は 0', () => {
        expect(getFormationModifier(0, 3, '大逃げ')).toBe(0);
        expect(getFormationModifier(10, 3, '大逃げ')).toBe(0);
        expect(getFormationModifier(1.5, 3, '大逃げ')).toBe(0);
    });

    it('範囲外のペース出目（0 / 10 / 非整数）は 0', () => {
        expect(getFormationModifier(1, 0, '大逃げ')).toBe(0);
        expect(getFormationModifier(1, 10, '大逃げ')).toBe(0);
        expect(getFormationModifier(2, 6.5, '大逃げ')).toBe(0);
    });
});

describe('getFormationTemplateLines - CR-SA-20-E2 / houserule-features.md §6.6', () => {
    it('ミドルまで確定時（ペース 1〜6）は §6.6 出力例と完全一致', () => {
        const expected = [
            '1,超縦長　大逃げに+10、逃げに+7、差しに-5、追込に-5',
            '2.3,縦長　大逃げ・逃げ・先行に+5',
            '7.8,団子　差し・追込に+5',
            '9,超団子　大逃げに-10、逃げに-7、差しに+8、追込に+12',
        ];
        expect(getFormationTemplateLines(1)).toEqual(expected);
        expect(getFormationTemplateLines(6)).toEqual(expected);
    });

    it('ハイ以上確定時（ペース 7〜9）は同一規則からの導出どおり', () => {
        const expected = [
            '1,超縦長　差しに+7、追込に+10',
            '2.3,縦長　大逃げ・逃げ・先行に+5',
            '7.8,団子　差し・追込に+5',
            '9,超団子　大逃げに+7、逃げに+5',
        ];
        expect(getFormationTemplateLines(7)).toEqual(expected);
        expect(getFormationTemplateLines(9)).toEqual(expected);
    });

    it('全脚質 ±0 の普通（4,5,6）行はペースによらず出力しない', () => {
        for (let pace = 1; pace <= 9; pace++) {
            const lines = getFormationTemplateLines(pace);
            expect(lines).toHaveLength(4);
            expect(lines.some(l => l.includes('普通'))).toBe(false);
        }
    });

    it('ペース境界（6 → 7）で出目 1・出目 9 の行のみ切り替わり、縦長・団子行は不変', () => {
        const middle = getFormationTemplateLines(6);
        const high = getFormationTemplateLines(7);
        expect(middle[0]).not.toBe(high[0]);
        expect(middle[3]).not.toBe(high[3]);
        expect(middle[1]).toBe(high[1]);
        expect(middle[2]).toBe(high[2]);
    });

    it('同値まとめ規則: 変動脚質が全同値の行のみ「・」結合、混在行は「、」個別列挙', () => {
        const lines = getFormationTemplateLines(3);
        expect(lines[1]).toContain('大逃げ・逃げ・先行に+5');
        expect(lines[2]).toContain('差し・追込に+5');
        // 超縦長行は差し・追込が同値 -5 でも「・」結合しない（§6.6 例どおり個別列挙）
        expect(lines[0]).toContain('差しに-5、追込に-5');
        expect(lines[0]).not.toContain('差し・追込');
    });

    it('範囲外のペース出目では空配列（全セル 0 扱いのフォールバック）', () => {
        expect(getFormationTemplateLines(0)).toEqual([]);
        expect(getFormationTemplateLines(10)).toEqual([]);
    });
});

// CR-SA-24-E1 / 2026-08-16: 隊列補正テーブルの GM 設定（houserule-features.md §6.10）。
// 解決順（§6.10.3）= ①脚質の設定値 → ②効果表（デフォルト 5 脚質のみ）→ ③±0。
describe('FORMATION_ROW_IDS - CR-SA-24-E1 / houserule-features.md §6.10.2', () => {
    it('効果表 7 行に §6.10.2 の行 ID が 1 対 1 で付与されている（重複なし・表順一致）', () => {
        expect(FORMATION_ROW_IDS).toEqual([
            '1:middleOrSlower',
            '1:highOrFaster',
            '2-3',
            '4-6',
            '7-8',
            '9:middleOrSlower',
            '9:highOrFaster',
        ]);
        expect(new Set(FORMATION_ROW_IDS).size).toBe(7);
        expect(FORMATION_EFFECT_TABLE.map(r => r.id)).toEqual(FORMATION_ROW_IDS);
    });
});

describe('getFormationModifier 解決順 - CR-SA-24-E1 / houserule-features.md §6.10.3', () => {
    it('① 脚質の設定値がある場合は効果表より優先される（デフォルト脚質）', () => {
        const strategies = [makeStrategy('大逃げ', { '1:middleOrSlower': 3 })];
        // 効果表は +10 だが、設定値 3 が優先される
        expect(getFormationModifier(1, 5, '大逃げ', strategies)).toBe(3);
    });

    it('② 設定値がなく効果表に列を持つデフォルト 5 脚質は効果表の値', () => {
        const strategies = [...DEFAULT_STRATEGY_LIST];
        expect(getFormationModifier(1, 5, '大逃げ', strategies)).toBe(10);
        expect(getFormationModifier(9, 5, '追込', strategies)).toBe(12);
        expect(getFormationModifier(7, 3, '差し', strategies)).toBe(5);
    });

    it('③ カスタム脚質でキー未設定なら ±0', () => {
        const strategies = [...DEFAULT_STRATEGY_LIST, makeStrategy('カスタムA')];
        for (let face = 1; face <= 9; face++) {
            expect(getFormationModifier(face, 3, 'カスタムA', strategies)).toBe(0);
            expect(getFormationModifier(face, 8, 'カスタムA', strategies)).toBe(0);
        }
    });

    it('カスタム脚質でも設定値があればその値が使われる（旧「常に ±0」判断の撤回）', () => {
        const strategies = [
            ...DEFAULT_STRATEGY_LIST,
            makeStrategy('カスタムA', { '2-3': 8, '9:highOrFaster': -4 }),
        ];
        expect(getFormationModifier(2, 5, 'カスタムA', strategies)).toBe(8);
        expect(getFormationModifier(3, 5, 'カスタムA', strategies)).toBe(8);
        expect(getFormationModifier(9, 8, 'カスタムA', strategies)).toBe(-4);
    });

    it('明示的な 0 は「キー未設定」と区別され、効果表へフォールバックしない', () => {
        const strategies = [makeStrategy('大逃げ', { '1:middleOrSlower': 0 })];
        // 効果表は +10 だが、明示 0 が優先される
        expect(getFormationModifier(1, 5, '大逃げ', strategies)).toBe(0);
        // 同脚質でもキー未設定の行は効果表どおり（出目 9 ミドル = -10）
        expect(getFormationModifier(9, 5, '大逃げ', strategies)).toBe(-10);
    });

    it('設定値は行単位で適用され、他の行（ペース分岐違いを含む）に影響しない', () => {
        const strategies = [makeStrategy('追込', { '1:middleOrSlower': 99 })];
        expect(getFormationModifier(1, 5, '追込', strategies)).toBe(99);
        // 同じ出目 1 でもハイ以上は別行 → 効果表の +10
        expect(getFormationModifier(1, 7, '追込', strategies)).toBe(10);
    });

    it('負値の設定値を受け付ける（§6.10.2 値の制約）', () => {
        const strategies = [makeStrategy('カスタムA', { '4-6': -12 })];
        expect(getFormationModifier(4, 5, 'カスタムA', strategies)).toBe(-12);
        expect(getFormationModifier(6, 5, 'カスタムA', strategies)).toBe(-12);
    });

    it('脚質リスト未指定時は効果表のみで解決（改訂前と同一動作）', () => {
        for (let face = 1; face <= 9; face++) {
            for (const pace of [1, 6, 7, 9]) {
                for (const name of DEFAULT_STRATEGIES) {
                    expect(getFormationModifier(face, pace, name))
                        .toBe(getFormationModifier(face, pace, name, [...DEFAULT_STRATEGY_LIST]));
                }
            }
        }
    });

    it('デフォルト 5 脚質の名前を変更した脚質は、設定値がなければ ±0（§6.10.3 注記）', () => {
        const renamed = makeStrategy('大逃げ改');
        expect(getFormationModifier(1, 5, '大逃げ改', [renamed])).toBe(0);
        // 設定値を入れれば効く
        const configured = makeStrategy('大逃げ改', { '1:middleOrSlower': 6 });
        expect(getFormationModifier(1, 5, '大逃げ改', [configured])).toBe(6);
    });

    it('範囲外の隊列出目・ペース出目は設定値があっても 0（既存フォールバック方針は不変）', () => {
        const strategies = [makeStrategy('大逃げ', { '1:middleOrSlower': 5 })];
        expect(getFormationModifier(0, 5, '大逃げ', strategies)).toBe(0);
        expect(getFormationModifier(10, 5, '大逃げ', strategies)).toBe(0);
        expect(getFormationModifier(1, 0, '大逃げ', strategies)).toBe(0);
        expect(getFormationModifier(1, 10, '大逃げ', strategies)).toBe(0);
    });
});

describe('getFormationTemplateLines 脚質リスト対応 - CR-SA-24-E1 / houserule-features.md §6.6 改訂', () => {
    it('デフォルト 5 脚質のみの構成では引数省略時と完全一致（改訂前と同一出力）', () => {
        for (let pace = 1; pace <= 9; pace++) {
            expect(getFormationTemplateLines(pace, [...DEFAULT_STRATEGY_LIST]))
                .toEqual(getFormationTemplateLines(pace));
        }
    });

    it('設定値なしのカスタム脚質を含めても出力は変わらない（±0 は列挙対象外）', () => {
        const strategies = [...DEFAULT_STRATEGY_LIST, makeStrategy('カスタムA')];
        expect(getFormationTemplateLines(5, strategies)).toEqual(getFormationTemplateLines(5));
    });

    it('設定値を入れたカスタム脚質はテンプレートに列挙される', () => {
        const strategies = [
            ...DEFAULT_STRATEGY_LIST,
            makeStrategy('カスタムA', { '1:middleOrSlower': -3 }),
        ];
        const lines = getFormationTemplateLines(5, strategies);
        expect(lines[0]).toBe('1,超縦長　大逃げに+10、逃げに+7、差しに-5、追込に-5、カスタムAに-3');
    });

    it('列挙順は脚質リストの並び順に従う（間に挿入したカスタム脚質はその位置に出る）', () => {
        const strategies = [...DEFAULT_STRATEGY_LIST];
        strategies.splice(1, 0, makeStrategy('カスタムA', { '2-3': 5 }));
        const lines = getFormationTemplateLines(5, strategies);
        // 大逃げ → カスタムA → 逃げ → 先行 の順（全同値のため「・」結合）
        expect(lines[1]).toBe('2.3,縦長　大逃げ・カスタムA・逃げ・先行に+5');
    });

    it('デフォルト脚質の設定値を 0 にすると当該脚質が列挙から外れる（±0 省略規則は不変）', () => {
        const strategies = DEFAULT_STRATEGY_LIST.map(s =>
            s.name === '逃げ' ? makeStrategy('逃げ', { '1:middleOrSlower': 0 }) : s);
        const lines = getFormationTemplateLines(5, strategies);
        expect(lines[0]).toBe('1,超縦長　大逃げに+10、差しに-5、追込に-5');
    });

    it('全脚質 ±0 の「普通」行は設定値で変動が生じたときのみ現れる（行省略規則は不変）', () => {
        const noChange = getFormationTemplateLines(5, [...DEFAULT_STRATEGY_LIST]);
        expect(noChange.some(l => l.includes('普通'))).toBe(false);
        const strategies = [...DEFAULT_STRATEGY_LIST, makeStrategy('カスタムA', { '4-6': 4 })];
        const lines = getFormationTemplateLines(5, strategies);
        expect(lines).toHaveLength(5);
        expect(lines[2]).toBe('4.5.6,普通　カスタムAに+4');
    });

    it('同値まとめ規則は脚質数が増えても不変（全同値のみ「・」結合、混在は「、」個別列挙）', () => {
        const allSame = [...DEFAULT_STRATEGY_LIST, makeStrategy('カスタムA', { '7-8': 5 })];
        expect(getFormationTemplateLines(5, allSame)[2]).toBe('7.8,団子　差し・追込・カスタムAに+5');
        const mixed = [...DEFAULT_STRATEGY_LIST, makeStrategy('カスタムA', { '7-8': 6 })];
        expect(getFormationTemplateLines(5, mixed)[2]).toBe('7.8,団子　差しに+5、追込に+5、カスタムAに+6');
    });

    it('脚質を削除した構成ではテンプレートからも消える（脚質リストが SSoT）', () => {
        const strategies = DEFAULT_STRATEGY_LIST.filter(s => s.name !== '大逃げ');
        const lines = getFormationTemplateLines(5, strategies);
        expect(lines[0]).toBe('1,超縦長　逃げに+7、差しに-5、追込に-5');
        expect(lines.every(l => !l.includes('大逃げ'))).toBe(true);
    });
});
