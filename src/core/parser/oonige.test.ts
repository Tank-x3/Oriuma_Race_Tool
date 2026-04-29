import { describe, test, expect } from 'vitest';
import { StandardParser } from './standardParser';
import { EmojiParser } from './emojiParser';

describe('Great Escape (Oonige) Negative Dice Logic', () => {
  // Dummy participants for matching
  const participants = [
    { id: 'p1', name: 'Silence Suzuka', strategy: '大逃げ' } as any,
    { id: 'p2', name: 'Twin Turbo', strategy: '大逃げ' } as any
  ];

  describe('StandardParser', () => {
    test('parses negative dice correctly: "大逃げ -dice1d27=15 (15)"', () => {
      const input = 'Silence Suzuka -dice1d27=15 (15)';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].diceResult).toBe(-15);
      expect(result.results[0].total).toBe(-15);
    });

    test('parses negative dice without fix value: "Twin Turbo -dice1d27=20"', () => {
      const input = 'Twin Turbo -dice1d27=20';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(-20);
    });

    test('parses Fix-dice format (no emoji, 大逃げ 終盤): "① Twin Turbo　58-dice1d27=20(20)"', () => {
      // 大逃げの終盤ダイス形式: Fix あり + マイナス演算子 + 絵文字なし
      const input = '① Twin Turbo　58-dice1d27=20(20)';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].fixValue).toBe(58);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(38);
    });

    test('parses Fix-dice format with space: "Twin Turbo 58-dice1d27=20"', () => {
      // parensなしバージョンの回帰確認
      const input = 'Twin Turbo 58-dice1d27=20';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].fixValue).toBe(58);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(38);
    });
  });

  describe('EmojiParser', () => {
    test('parses negative dice with emoji: "Silence Suzuka -dice1d27=15 (15) 🎲"', () => {
      // Mock input with emoji to trigger EmojiFactory -> EmojiParser
      const input = 'Silence Suzuka -dice1d27=15 (15) 🎲';

      const parser = new EmojiParser();
      const result = parser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].diceResult).toBe(-15);
      expect(result.results[0].total).toBe(-15);
    });


    test('parses multi-line negative dice with negative total: "合計: -20"', () => {
      const input = `Twin Turbo -dice1d27=
      (Disregarded line)
      合計: -20`;

      const parser = new EmojiParser();
      const result = parser.parse(input, participants, 'RACE');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(-20);
    });
  });

  test('parses 88-ch format with minus before emoji: "73-🎲 dice1d27= 23"', () => {
    // Fix 73, Dice -23 -> Total 50
    // Currently problematic as it parses Fix 73 and Dice +23 -> Total 96
    // CR-4 Part B 以降、名前不一致は results に追加されないため登録名（Twin Turbo）を使用
    const input = '③ Twin Turbo　73-🎲 dice1d27= 23';
    const parser = new EmojiParser();
    const result = parser.parse(input, participants, 'RACE');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].fixValue).toBe(73);
    // Expect negative dice result
    expect(result.results[0].diceResult).toBe(-23);
    expect(result.results[0].total).toBe(50);
  });
});

