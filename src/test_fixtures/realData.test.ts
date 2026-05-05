// CR-SA-3-E3 (ENG04 / 2026-05-04): 実データ層 Vitest ハーネス。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §A〜§E
//            docs/specs/architecture/parser-system.md §A / §B
//            docs/REQUIREMENTS.md §1 CC-7（実データ基盤テスト）

import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../core/parser/parserFactory';
import { StandardParser } from '../core/parser/standardParser';
import type { Umamusume } from '../types';
import {
  listAllFixtures,
  listRealDataFixtures,
  loadFixture,
  extractPhases,
  type ParsedParticipant,
  type ParsedFrontmatter,
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
