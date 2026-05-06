// CR-SA-3-E3 (ENG04 / 2026-05-04): 実データ層 Vitest ハーネス。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §A〜§E
//            docs/specs/architecture/parser-system.md §A / §B
//            docs/REQUIREMENTS.md §1 CC-7（実データ基盤テスト）

import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../core/parser/parserFactory';
import { StandardParser } from '../core/parser/standardParser';
import { EmojiParser } from '../core/parser/emojiParser';
import type { Umamusume } from '../types';
import {
  listAllFixtures,
  listRealDataFixtures,
  loadFixture,
  extractPhases,
  type ParsedParticipant,
  type ParsedFrontmatter,
  type PhaseBlock,
  type PhaseName,
} from './fixtureLoader';

const SOURCE_DEFINED = ['animan', '88ch'] as const;
const DATA_TYPE_DEFINED = ['live', 'synthetic'] as const;
const STRATEGY_DEFINED = ['大逃げ', '逃げ', '先行', '差し', '追込'] as const;
const UNIQUE_TYPE_DEFINED = ['Stability', 'Gamble', 'Persistent'] as const;
const PHASES_ALLOWED = ['Start', 'Mid', 'Mid1', 'Mid2', 'Mid3', 'Mid4', 'End'] as const;

function toUmamusume(p: ParsedParticipant, idx: number): Umamusume {
  return {
    id: `participant-${idx}`,
    entryIndex: idx,
    name: p.name,
    // 「その他」自由入力（pending_categories に extended_unique 含有時）も保持するため as any でキャスト
    strategy: p.strategy as Umamusume['strategy'],
    uniqueSkill: {
      type: p.uniqueSkill.type as Umamusume['uniqueSkill']['type'],
      phases: p.uniqueSkill.phases,
    },
    gate: null,
    score: 0,
    history: {},
  };
}

const realDataPaths = listRealDataFixtures();

describe('Real data layer fixtures (CR-SA-3-E3)', () => {
  it('lists at least one real data fixture under _raw/{animan,88ch}', () => {
    expect(realDataPaths.length).toBeGreaterThan(0);
  });

  for (const filePath of realDataPaths) {
    describe(filePath, () => {
      const { frontmatter, body } = loadFixture(filePath);
      const phases = extractPhases(body);
      const participants = frontmatter.participants.map(toUmamusume);
      const hasExtendedUnique = frontmatter.pending_categories.includes('extended_unique');

      it('metadata integrity', () => {
        expect(SOURCE_DEFINED).toContain(frontmatter.source);
        expect(DATA_TYPE_DEFINED).toContain(frontmatter.dataType);
        expect([0, 1, 2, 3, 4]).toContain(frontmatter.midPhaseCount);
        expect(frontmatter.participants.length).toBeGreaterThan(0);

        for (const p of frontmatter.participants) {
          // 仕様未定義値の自由入力は extended_unique 含有時のみ許容（testing-strategy.md §B「『その他』自由入力データの集計運用」）
          if (!hasExtendedUnique) {
            expect(STRATEGY_DEFINED).toContain(p.strategy as (typeof STRATEGY_DEFINED)[number]);
            expect(UNIQUE_TYPE_DEFINED).toContain(
              p.uniqueSkill.type as (typeof UNIQUE_TYPE_DEFINED)[number],
            );
          }
          // phases 値域（Pace 除外、CR-SA-5 SA04 + testing-strategy.md §B L185）
          for (const phase of p.uniqueSkill.phases) {
            expect(PHASES_ALLOWED).toContain(phase as (typeof PHASES_ALLOWED)[number]);
            expect(phase).not.toBe('Pace');
          }
        }
      });

      // 各フェーズコードブロックを Parser に通す
      phases.forEach((phase, idx) => {
        it(`parses ${phase.phaseName} block #${idx}`, () => {
          const code = phase.codeBlock;

          if (phase.phaseName === 'Judgment') {
            // 空コードブロックは省略可（TASK_INSTRUCTION §3.3 B / 5.5）
            if (code.trim() === '') return;
            const result = StandardParser.parseJudgment(code);
            expect(result.errors).toEqual([]);
            expect(result.results.length).toBeGreaterThan(0);
            return;
          }

          if (phase.phaseName === 'Pace') {
            const parser = ParserFactory.getParser(code);
            const result = parser.parse(code, participants, 'PACE');
            expect(result.errors).toEqual([]);
            expect(result.results.length).toBe(1);
            expect(result.results[0].participantId).toBe('GM');
            return;
          }

          // Gate / Start / Mid / Mid1〜4 / End → RACE
          const parser = ParserFactory.getParser(code);
          const result = parser.parse(code, participants, 'RACE');
          expect(result.errors).toEqual([]);
          // 実例には Gate ダイス未振り行や固有ダイス一部発動が含まれるため、
          // results.length === participants.length を厳格に求めず ≥ 1 に緩和
          expect(result.results.length).toBeGreaterThan(0);
        });
      });
    });
  }
});

// CR-SA-3-E5-2 (ENG09 / 2026-05-06): 設計駆動層 22 件相当の検出力カバー（実データ層への移植）。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §D / §E
//            docs/handover/TASK_INSTRUCTION.md §2.1 / §2.4
//            work_logs/issues/CR-SA-3/e5_classification_report.md §5
// 移植戦略: 個別 it 追加（方針 B）。実データから対象行を抽出 → Parser 通過 → 期待値完全一致比較。
// 移植件数: 16 件（#42, #43, #47, #48, #51, #54, #56, #57, #58, #60, #62, #63, #69, #71, #75, #77）。
// 保持判断（移植中止 + 設計駆動層に残置）: 6 件（#50, #61, #72, #73, #74, #76）。
//   理由: 該当形式が実データ層 7 ファイルに存在しない（fix なし negative / 複数行 negative /
//         複数ダイス space-separated negative / Twin Turbo 形式 等）。詳細は USER_REVIEW.md §6 参照。
describe('CR-SA-3-E5-2: 設計駆動層 22 件相当の実データ層移植', () => {
  function findFixture(matchSource: string, fileSuffix: string): string {
    const found = realDataPaths.find((p) => p.includes(matchSource) && p.endsWith(fileSuffix));
    if (!found) throw new Error(`Fixture not found: ${matchSource}/${fileSuffix}`);
    return found;
  }

  const animan001 = loadFixture(findFixture('animan', 'race-001.md'));
  const ch88_001 = loadFixture(findFixture('88ch', 'race-001.md'));
  const ch88_002 = loadFixture(findFixture('88ch', 'race-002.md'));

  const animan001Phases = extractPhases(animan001.body);
  const ch88_001Phases = extractPhases(ch88_001.body);
  const ch88_002Phases = extractPhases(ch88_002.body);

  const animan001Participants = animan001.frontmatter.participants.map(toUmamusume);
  const ch88_001Participants = ch88_001.frontmatter.participants.map(toUmamusume);
  const ch88_002Participants = ch88_002.frontmatter.participants.map(toUmamusume);

  function getBlock(phases: PhaseBlock[], name: PhaseName, occurrence = 0): PhaseBlock {
    let count = 0;
    for (const p of phases) {
      if (p.phaseName === name) {
        if (count === occurrence) return p;
        count++;
      }
    }
    throw new Error(`Phase ${name} #${occurrence} not found`);
  }

  function findLine(text: string, predicate: (line: string) => boolean): string {
    for (const line of text.split(/\r?\n/)) {
      if (predicate(line)) return line;
    }
    throw new Error('No matching line found');
  }

  // ---- StandardParser 系（animan / 88ch PACE delegation）----

  it('移植元: standardParser.test.ts #42 - parses standard format with fix value', () => {
    // 元検証: '①Silence Suzuka 30+dice3d8=5 5 5 (15)' (fix=30, dice=3d8, result=15, total=45)
    // 実データ: animan/race-001 Start ①ミシオントレース 15+dice3d6=3 2 4 (9)
    const startBlock = getBlock(animan001Phases, 'Start');
    const line = findLine(
      startBlock.codeBlock,
      (l) => l.includes('ミシオントレース') && l.includes('15+dice3d6'),
    );
    const result = StandardParser.parse(line, animan001Participants);

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: 'ミシオントレース',
      diceStr: '3d6',
      fixValue: 15,
      diceResult: 9,
      total: 24,
      validChecksum: true,
    });
  });

  it('移植元: standardParser.test.ts #43 - parses format without fix value (Start固有)', () => {
    // 元検証: 'Special Week dice1d100=50 (50)' (fix=0, dice=1d100, result=50)
    // 実データ: animan/race-001 Start 2 つ目コードブロック「【序盤固有発動！】」
    //          ⑤アイファーバインド dice1d20=18 (18) (fix prefix なし)
    const uniqueBlock = getBlock(animan001Phases, 'Start', 1);
    const line = findLine(
      uniqueBlock.codeBlock,
      (l) => l.includes('アイファーバインド') && l.includes('dice1d20=18'),
    );
    const result = StandardParser.parse(line, animan001Participants);

    expect(result.errors).toHaveLength(0);
    expect(result.results[0]).toMatchObject({
      name: 'アイファーバインド',
      fixValue: 0,
      diceResult: 18,
      total: 18,
    });
  });

  it('移植元: standardParser.test.ts #47 - parses with full-width space separator', () => {
    // 元検証: 'Silence Suzuka　30+dice3d8=5 5 5 (15)' (全角スペース区切り)
    // 実データ: animan/race-001 Gate ボクダンダン　dice1d100=56 (56)
    const gateBlock = getBlock(animan001Phases, 'Gate');
    const line = findLine(
      gateBlock.codeBlock,
      (l) => l.includes('ボクダンダン') && l.includes('dice1d100=56'),
    );
    const result = StandardParser.parse(line, animan001Participants);

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('ボクダンダン');
    expect(result.results[0].diceResult).toBe(56);
    expect(result.results[0].total).toBe(56);
  });

  it('移植元: standardParser.test.ts #48 - parses space-separated dice values with parens', () => {
    // 元検証: '① カンパネラ　10+dice3d5=3 1 4 (8)' (出目スペース区切り + (N))
    // 実データ: animan/race-001 Start ①ミシオントレース 15+dice3d6=3 2 4 (9)
    const startBlock = getBlock(animan001Phases, 'Start');
    const line = findLine(
      startBlock.codeBlock,
      (l) => l.includes('ミシオントレース') && l.includes('3 2 4'),
    );
    const result = StandardParser.parse(line, animan001Participants);

    expect(result.errors).toHaveLength(0);
    expect(result.results[0]).toMatchObject({
      name: 'ミシオントレース',
      diceResult: 9,
      total: 24,
      fixValue: 15,
    });
  });

  it('移植元: standardParser.test.ts #51 - parses PACE context correctly (StandardParser direct)', () => {
    // 元検証: 'GM\ndice1d9=4' (PACE context, GM 自動付与)
    // 実データ: animan/race-001 PACE ペースダイスdice1d9=9 (9)
    const paceBlock = getBlock(animan001Phases, 'Pace');
    const result = StandardParser.parse(paceBlock.codeBlock, [], 'PACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      diceStr: '1d9',
      diceResult: 9,
      participantId: 'GM',
      name: 'GM',
      fixValue: 0,
    });
  });

  it('移植元: standardParser.test.ts #54 - parses PACE with leading 🎲 emoji (via ParserFactory delegation)', () => {
    // 元検証: '🎲 dice1d9=5' を StandardParser 直接呼び出し
    // 実データ: 88ch/race-001 PACE 🎲 dice1d9= 5
    // 観察事項: 設計駆動層 #54 は StandardParser 直接呼び出しを想定するが、実データでは
    // ParserFactory.getParser → EmojiParser → StandardParser delegation 経由が常態。
    // 本検証では delegation 経路で 🎲 prefix 処理が機能することを担保する。
    const paceBlock = getBlock(ch88_001Phases, 'Pace');
    const parser = ParserFactory.getParser(paceBlock.codeBlock);
    const result = parser.parse(paceBlock.codeBlock, [], 'PACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      diceResult: 5,
      participantId: 'GM',
      name: 'GM',
    });
  });

  // ---- EmojiParser 系（88ch）----

  it('移植元: emojiParser.test.ts #56 - single-line format', () => {
    // 元検証: 'ウマ娘A 15+🎲 dice3d6=18 (33)' (Standard-like behavior)
    // 実データ: 88ch/race-001 Start ① フルールドシュマン　5+🎲 dice1d12= 7
    const startBlock = getBlock(ch88_001Phases, 'Start');
    const line = findLine(
      startBlock.codeBlock,
      (l) => l.includes('フルールドシュマン') && l.includes('dice1d12'),
    );
    const parser = new EmojiParser();
    const result = parser.parse(line, ch88_001Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: 'フルールドシュマン',
      diceStr: '1d12',
      diceResult: 7,
      fixValue: 5,
      total: 12,
    });
  });

  it('移植元: emojiParser.test.ts #57 - single-line space after equals', () => {
    // 元検証: 'ウマ娘A 5+🎲 dice1d12= 7' (= の後に半角SP)
    // 実データ: 88ch/race-001 Start 同形式（フルールドシュマン= 7）
    const startBlock = getBlock(ch88_001Phases, 'Start');
    const line = findLine(
      startBlock.codeBlock,
      (l) => l.includes('フルールドシュマン') && /=\s+7/.test(l),
    );
    const parser = new EmojiParser();
    const result = parser.parse(line, ch88_001Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results[0].diceResult).toBe(7);
    expect(result.results[0].fixValue).toBe(5);
    expect(result.results[0].total).toBe(12);
  });

  it('移植元: emojiParser.test.ts #58 - multi-line block format', () => {
    // 元検証: '② ウマ娘A 15+🎲 dice3d6= ... 合計: 15' (multi-line block)
    // 実データ: 88ch/race-001 Start ② タンクタンクタンク 15+🎲 dice3d6= ... 合計: 6
    const startBlock = getBlock(ch88_001Phases, 'Start');
    const parser = new EmojiParser();
    const result = parser.parse(startBlock.codeBlock, ch88_001Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    const tank = result.results.find((r) => r.name === 'タンクタンクタンク');
    expect(tank).toBeDefined();
    expect(tank!.diceStr).toBe('3d6');
    expect(tank!.fixValue).toBe(15);
    expect(tank!.diceResult).toBe(6);
    expect(tank!.total).toBe(21);
  });

  it('移植元: emojiParser.test.ts #60 - ignore non-dice posts', () => {
    // 元検証: 「普通の雑談レス」等のノイズ行を無視し、ダイス行のみ results 化
    // 実データ: 88ch/race-001 Start 「【序盤ダイス】」「【序盤固有ダイス】」の地の文ノイズあり
    const startBlock = getBlock(ch88_001Phases, 'Start');
    const parser = new EmojiParser();
    const result = parser.parse(startBlock.codeBlock, ch88_001Participants, 'RACE');

    // 全 results は participants の登録名と一致する（地の文「【序盤ダイス】」は除外）
    const validNames = ch88_001Participants.map((p) => p.name);
    for (const r of result.results) {
      expect(validNames).toContain(r.name);
    }
    // ダイス行（4 名 + 1 名固有 = 5 行）が拾えていること
    expect(result.results.length).toBeGreaterThanOrEqual(4);
  });

  it('移植元: emojiParser.test.ts #62 - multi-line addition (regression)', () => {
    // 元検証: '15+🎲 dice3d6= ... 合計: 18' (加算 multi-line regression)
    // 実データ: 88ch/race-001 Start ③ ブリッジコンプ 15+🎲 dice3d6= ... 合計: 9
    const startBlock = getBlock(ch88_001Phases, 'Start');
    const parser = new EmojiParser();
    const result = parser.parse(startBlock.codeBlock, ch88_001Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    const bridge = result.results.find((r) => r.name === 'ブリッジコンプ');
    expect(bridge).toBeDefined();
    expect(bridge!.fixValue).toBe(15);
    expect(bridge!.diceResult).toBe(9);
    expect(bridge!.total).toBe(24);
  });

  it('移植元: emojiParser.test.ts #63 - single-line subtraction (regression)', () => {
    // 元検証: 'ウマ娘A 73-🎲 dice1d12=7' (single-line negative regression)
    // 実データ: 88ch/race-002 End ③ ダイタクヘリオス 73-🎲 dice1d27= 23
    const endBlock = getBlock(ch88_002Phases, 'End');
    const line = findLine(
      endBlock.codeBlock,
      (l) => l.includes('ダイタクヘリオス') && l.includes('73-🎲'),
    );
    const parser = new EmojiParser();
    const result = parser.parse(line, ch88_002Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: 'ダイタクヘリオス',
      diceStr: '1d27',
      diceResult: -23,
      fixValue: 73,
      total: 50,
    });
  });

  it('移植元: emojiParser.test.ts #69 - PACE delegation to StandardParser', () => {
    // 元検証: '🎲 dice1d9=6' を EmojiParser.parse(_, _, 'PACE') 経由で StandardParser に委譲
    // 実データ: 88ch/race-001 PACE 🎲 dice1d9= 5
    const paceBlock = getBlock(ch88_001Phases, 'Pace');
    const parser = new EmojiParser();
    const result = parser.parse(paceBlock.codeBlock, [], 'PACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      diceResult: 5,
      participantId: 'GM',
      name: 'GM',
    });
  });

  // ---- oonige（大逃げ）系 ----

  it('移植元: oonige.test.ts #71 - StandardParser negative dice basic', () => {
    // 元検証: 'Silence Suzuka -dice1d27=15 (15)' (大逃げ standard negative)
    // 実データ: animan/race-001 End ②ブランクドリャフカ 57＋-dice1d27=1 (1)
    // 注記: animan は全角プラス(＋) + 半角マイナス(-) の特殊形式（fix + negative dice）
    const endBlock = getBlock(animan001Phases, 'End');
    const line = findLine(
      endBlock.codeBlock,
      (l) => l.includes('ブランクドリャフカ') && l.includes('-dice1d27'),
    );
    const result = StandardParser.parse(line, animan001Participants);

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      name: 'ブランクドリャフカ',
      diceStr: '1d27',
      diceResult: -1,
      fixValue: 57,
      total: 56,
    });
  });

  it('移植元: oonige.test.ts #75 - EmojiParser negative dice with emoji', () => {
    // 元検証: 'Silence Suzuka -dice1d27=15 (15) 🎲' (88ch 大逃げ negative + 🎲)
    // 実データ: 88ch/race-002 End ③ ダイタクヘリオス 73-🎲 dice1d27= 23
    const endBlock = getBlock(ch88_002Phases, 'End');
    const line = findLine(
      endBlock.codeBlock,
      (l) => l.includes('ダイタクヘリオス') && l.includes('73-🎲'),
    );
    const parser = new EmojiParser();
    const result = parser.parse(line, ch88_002Participants, 'RACE');

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].diceResult).toBe(-23);
    expect(result.results[0].total).toBe(50);
  });

  it('移植元: oonige.test.ts #77 - 88ch CR-2 Critical: minus before emoji "73-🎲"', () => {
    // 元検証: '③ Twin Turbo　73-🎲 dice1d27= 23' (CR-2 Critical: マイナス が 🎲 prefix の前)
    // 実データ: 88ch/race-002 End ③ ダイタクヘリオス 73-🎲 dice1d27= 23
    const endBlock = getBlock(ch88_002Phases, 'End');
    const line = findLine(
      endBlock.codeBlock,
      (l) => l.includes('ダイタクヘリオス') && l.includes('73-🎲'),
    );
    const parser = new EmojiParser();
    const result = parser.parse(line, ch88_002Participants, 'RACE');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].fixValue).toBe(73);
    expect(result.results[0].diceResult).toBe(-23); // CR-2 fix で negative 化
    expect(result.results[0].total).toBe(50);
  });
});

describe('CR-SA-3-E2-Followup-B: houseRules True 集計', () => {
  it('reports houseRules True flags across all fixtures (real data + pending)', () => {
    const allPaths = listAllFixtures();
    const report: Record<keyof ParsedFrontmatter['houseRules'], string[]> = {
      enableModifier: [],
      enableSpecialStrategy: [],
      enableCompositeUnique: [],
    };

    for (const p of allPaths) {
      const { frontmatter } = loadFixture(p);
      (Object.keys(report) as Array<keyof typeof report>).forEach((flag) => {
        if (frontmatter.houseRules?.[flag]) {
          report[flag].push(p);
        }
      });
    }

    console.log('[CR-SA-3-E2-Followup-B] houseRules True 集計:');
    (Object.entries(report) as Array<[keyof typeof report, string[]]>).forEach(([flag, paths]) => {
      console.log(`  ${flag}=true: ${paths.length} 件`);
      paths.forEach((p) => console.log(`    - ${p}`));
    });

    // テスト失敗にはせず、レポート出力のみ
    expect(report).toBeDefined();
  });
});
