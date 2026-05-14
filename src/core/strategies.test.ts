// Bundle-10-Followup-runtime-sync / 2026-05-11: getStrategy / getPaceModifier 単体テスト。
// 仕様根拠:
//  - houserule-features.md §1 脚質エディタ「既存の 5 脚質のパラメータ（固定値・ダイス・paceModifiers）を編集可能」
//  - state.strategies が SSoT として動作することを保証する
//
// 単体面のカバレッジ:
//  - getStrategy: state.strategies 内の検索（DEFAULT 名 / カスタム名 / 不在名）
//  - getPaceModifier: state 優先参照 + 固定テーブル PACE_MODIFIERS フォールバック
import { describe, it, expect } from 'vitest';
import {
    DEFAULT_STRATEGIES,
    getStrategy,
    getPaceModifier,
    // CR-SA-15-E1 / 2026-05-14: 固有スキル設定のデフォルト値定数
    DEFAULT_UNIQUE_DICE_CONFIG,
} from './strategies';
import type { Strategy } from '../types';

const cloneDefaults = (): Strategy[] =>
    DEFAULT_STRATEGIES.map((s) => ({
        ...s,
        dice: { ...s.dice },
        paceModifiers: { ...s.paceModifiers },
    }));

describe('getStrategy - Bundle-10-Followup-runtime-sync', () => {
    it('(1) state.strategies 内 DEFAULT 名で検索 → state 編集済 Strategy が返る (V1 解消)', () => {
        const strategies = cloneDefaults();
        const idx = strategies.findIndex((s) => s.name === '大逃げ');
        // 編集を模倣: 大逃げ fixValue 30 → 99
        strategies[idx] = { ...strategies[idx], fixValue: 99 };

        const result = getStrategy('大逃げ', strategies);
        expect(result).toBeDefined();
        expect(result?.fixValue).toBe(99);
    });

    it('(2) state.strategies 内カスタム名で検索 → カスタム Strategy が返る', () => {
        const custom: Strategy = {
            name: '奇行型',
            fixValue: 7,
            dice: { start: '2d6', mid: '2d4', end: '1d10' },
            paceModifiers: { 1: 15 },
        };
        const strategies = [...cloneDefaults(), custom];

        const result = getStrategy('奇行型', strategies);
        expect(result).toEqual(custom);
    });

    it('(3) 不在名で検索 → undefined', () => {
        const strategies = cloneDefaults();
        const result = getStrategy('存在しない脚質', strategies);
        expect(result).toBeUndefined();
    });
});

describe('getPaceModifier - Bundle-10-Followup-runtime-sync', () => {
    it('(4) DEFAULT 脚質 + paceModifiers 空 → 固定テーブル PACE_MODIFIERS フォールバック (既存挙動互換)', () => {
        const strategies = cloneDefaults();
        // 大逃げ paceRoll=1 → 12（固定テーブル値、PACE_MODIFIERS[1]['大逃げ']）
        expect(getPaceModifier('大逃げ', 1, strategies)).toBe(12);
        // 追込 paceRoll=9 → 10
        expect(getPaceModifier('追込', 9, strategies)).toBe(10);
        // 先行 paceRoll=4 → 0（PACE_MODIFIERS[4] は全 0）
        expect(getPaceModifier('先行', 4, strategies)).toBe(0);
    });

    it('(5) カスタム脚質 + paceModifiers 設定済 → state 優先値を返却 (観察事項 B 解消)', () => {
        const custom: Strategy = {
            name: '奇行型',
            fixValue: 0,
            dice: { start: '1d6', mid: '1d6', end: '1d6' },
            paceModifiers: { 1: 15, 9: -10 },
        };
        const strategies = [...cloneDefaults(), custom];

        expect(getPaceModifier('奇行型', 1, strategies)).toBe(15);
        expect(getPaceModifier('奇行型', 9, strategies)).toBe(-10);
    });

    it('(6) カスタム脚質 + 該当 paceRoll なし → 固定テーブルフォールバック (該当名不在で 0)', () => {
        const custom: Strategy = {
            name: '奇行型',
            fixValue: 0,
            dice: { start: '1d6', mid: '1d6', end: '1d6' },
            paceModifiers: { 1: 15 }, // paceRoll=5 は未設定
        };
        const strategies = [...cloneDefaults(), custom];

        // paceRoll=5 は state.paceModifiers に無いため固定テーブルにフォールバック。
        // PACE_MODIFIERS[5] にも「奇行型」が無いため最終的に 0。
        expect(getPaceModifier('奇行型', 5, strategies)).toBe(0);
    });

    it('(7) state 編集済 DEFAULT 脚質 paceModifiers 上書き → state 優先 (V1 完全解消)', () => {
        const strategies = cloneDefaults();
        const idx = strategies.findIndex((s) => s.name === '大逃げ');
        // 大逃げ paceRoll=1 を 12 → 50 に上書き編集
        strategies[idx] = {
            ...strategies[idx],
            paceModifiers: { 1: 50 },
        };

        // state 優先で 50 を返す（固定テーブル 12 ではない）
        expect(getPaceModifier('大逃げ', 1, strategies)).toBe(50);
        // paceRoll=2 は state.paceModifiers に無いので固定テーブル 5 にフォールバック
        expect(getPaceModifier('大逃げ', 2, strategies)).toBe(5);
    });

    it('(8) 範囲外 paceRoll (PACE_MODIFIERS テーブル外) → 0', () => {
        const strategies = cloneDefaults();
        // PACE_MODIFIERS は 1〜9 のみ定義。範囲外は 0 にフォールバック。
        expect(getPaceModifier('大逃げ', 0, strategies)).toBe(0);
        expect(getPaceModifier('大逃げ', 10, strategies)).toBe(0);
    });
});

// CR-SA-15-E1 / 2026-05-14:
// houserule-features.md §5.2 設定項目 デフォルト値表に対する DEFAULT_UNIQUE_DICE_CONFIG の検証。
// E2 で既存ハードコード関数（phaseOutput.helpers.ts の getUniqueDiceFormula /
// getExpectedUniqueDiceStr / getExpectedUniqueFixValue）が本定数 + state 参照へ切り替わるため、
// デフォルト値がハードコード現行値と完全一致していることを保証する。
describe('DEFAULT_UNIQUE_DICE_CONFIG - CR-SA-15-E1', () => {
    it('(1) 固有スキル 5 タイプすべてのキーが存在する', () => {
        expect(Object.keys(DEFAULT_UNIQUE_DICE_CONFIG).sort()).toEqual(
            ['Gamble', 'Persistent', 'Stability', 'SuperGamble', 'SuperStability'],
        );
    });

    it('(2) 各タイプの fixValue / diceStr が houserule-features.md §5.2 デフォルト値表と完全一致', () => {
        expect(DEFAULT_UNIQUE_DICE_CONFIG.Stability).toEqual({ fixValue: 5, diceStr: '1d10' });
        expect(DEFAULT_UNIQUE_DICE_CONFIG.Gamble).toEqual({ fixValue: 0, diceStr: '1d20' });
        expect(DEFAULT_UNIQUE_DICE_CONFIG.Persistent).toEqual({ fixValue: 0, diceStr: '1d10' });
        expect(DEFAULT_UNIQUE_DICE_CONFIG.SuperGamble).toEqual({ fixValue: -10, diceStr: '1d35' });
        expect(DEFAULT_UNIQUE_DICE_CONFIG.SuperStability).toEqual({ fixValue: 8, diceStr: '1d3' });
    });
});
