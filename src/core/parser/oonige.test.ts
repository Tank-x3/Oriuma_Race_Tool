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
    // 移植先: realData.test.ts CR-SA-3-E5-2 #71 (CR-SA-3-E5-2)
    test.skip('parses negative dice correctly: "大逃げ -dice1d27=15 (15)"', () => {
      const input = 'Silence Suzuka -dice1d27=15 (15)';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].diceResult).toBe(-15);
      expect(result.results[0].total).toBe(-15);
    });

    // 保持判断 (CR-SA-3-E5-2 #72): 「fix なし negative dice」(-dice1d27=20 (20)) は実データ層 7 ファイルに不在のため移植中止。設計駆動層に残置。
    test('parses negative dice without fix value: "Twin Turbo -dice1d27=20"', () => {
      // CR-4b により (N) 必須化、テスト本来の意図（Fix なし負数ダイス解析）は (N) 付きで保持
      const input = 'Twin Turbo -dice1d27=20 (20)';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(-20);
    });

    // 保持判断 (CR-SA-3-E5-2 #73): 「Fix-dice 終盤大逃げ」(58-dice1d27=20(20) 形式、(N) 直接連結) は実データ層に不在（animan は ＋-dice 形式 + (N) 前空白）のため移植中止。設計駆動層に残置。
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

    // 保持判断 (CR-SA-3-E5-2 #74): 「Fix-dice 半角スペース形式」(Twin Turbo 58-dice1d27=20 (20)) は実データ層に不在（animan は全角スペース + ＋-dice 形式）のため移植中止。設計駆動層に残置。
    test('parses Fix-dice format with space: "Twin Turbo 58-dice1d27=20"', () => {
      // CR-4b により (N) 必須化、Fix-dice 半角スペース区切りの回帰確認は (N) 付きで維持
      const input = 'Twin Turbo 58-dice1d27=20 (20)';
      const result = StandardParser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].fixValue).toBe(58);
      expect(result.results[0].diceResult).toBe(-20);
      expect(result.results[0].total).toBe(38);
    });
  });

  describe('EmojiParser', () => {
    // 移植先: realData.test.ts CR-SA-3-E5-2 #75 (CR-SA-3-E5-2)
    test.skip('parses negative dice with emoji: "Silence Suzuka -dice1d27=15 (15) 🎲"', () => {
      // Mock input with emoji to trigger EmojiFactory -> EmojiParser
      const input = 'Silence Suzuka -dice1d27=15 (15) 🎲';

      const parser = new EmojiParser();
      const result = parser.parse(input, participants, 'RACE');

      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].diceResult).toBe(-15);
      expect(result.results[0].total).toBe(-15);
    });


    // 保持判断 (CR-SA-3-E5-2 #76): 「複数行 negative dice」(-dice1d27= ... 合計: -20) は実データ層 88ch 全件に不在（全 negative は単行形式）のため移植中止。設計駆動層に残置。
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

  // 移植先: realData.test.ts CR-SA-3-E5-2 #77 (CR-SA-3-E5-2)
  test.skip('parses 88-ch format with minus before emoji: "73-🎲 dice1d27= 23"', () => {
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

