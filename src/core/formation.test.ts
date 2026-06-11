import { describe, it, expect } from 'vitest';
import {
    FORMATION_EFFECT_TABLE,
    getFormationLabel,
    getFormationModifier,
    getFormationTemplateLines,
} from './formation';

// CR-SA-20-E2 / 2026-06-11: 隊列〔バ群〕ダイスの効果表・補正ロジック（純粋関数層）。
// SSoT: houserule-features.md §6.2（形態）/ §6.3（効果表 = 全セル網羅）/ §6.6（影響値テンプレート）。
// 本モジュールは E2 時点では未配線（配線は E4）。

const DEFAULT_STRATEGIES = ['大逃げ', '逃げ', '先行', '差し', '追込'] as const;

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

    it('カスタム脚質（デフォルト 5 脚質以外）は常に 0（§6.3 SA 判断）', () => {
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
