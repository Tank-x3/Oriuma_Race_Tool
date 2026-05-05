// CR-SA-3-E4 (ENG05 / 2026-05-05): 派生データ層 Vitest ハーネス（核心 3 パターン）。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B L140-155
//            docs/specs/architecture/parser-system.md §A / §B
//            docs/REQUIREMENTS.md §1 CC-7（実データ基盤テスト）
// PM15 観察事項 C 連動: 実データ層の results.length > 0 緩和を派生データ層で厳密化。
// ENG05 観察事項 (USER_REVIEW.md §6 参照): 実データ層では固有ダイス行を含むため
// origResult.results.length が participants.length を上回るのが通常。よって DoD #4
// の主軸 assertion は「派生 results < 元 results」（変化検出 = dice 行欠落の確証）として
// 実装し、PM 判断のため §7 ESCALATION マーカーを併記する。

import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../core/parser/parserFactory';
import { StandardParser } from '../core/parser/standardParser';
import type { Umamusume } from '../types';
import {
  listRealDataFixtures,
  loadFixture,
  extractPhases,
  type ParsedParticipant,
  type PhaseBlock,
  type PhaseName,
} from './fixtureLoader';
import {
  generateRangeShiftHead,
  generateRangeShiftTail,
  generatePhaseInjection,
  generateTrailingWhitespaceEdit,
  generateBlankLineInjection,
  generateInvalidParenSum,
  findFirstDiceLineIndex,
  findLastDiceLineIndex,
  type DerivedFromMeta,
} from './derivedDataGenerator';

const RACE_PHASES: ReadonlyArray<PhaseName> = [
  'Start',
  'Mid',
  'Mid1',
  'Mid2',
  'Mid3',
  'Mid4',
  'End',
];

function toUmamusume(p: ParsedParticipant, idx: number): Umamusume {
  return {
    id: `participant-${idx}`,
    entryIndex: idx,
    name: p.name,
    // realData.test.ts と同一キャスト方針（extended_unique 対応）
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

describe('Derived data layer fixtures (CR-SA-3-E4)', () => {
  const realDataPaths = listRealDataFixtures();

  it('lists at least one real data fixture for derived layer', () => {
    expect(realDataPaths.length).toBeGreaterThan(0);
  });

  for (const filePath of realDataPaths) {
    describe(filePath, () => {
      const { frontmatter, body } = loadFixture(filePath);
      const phases = extractPhases(body);
      const participants = frontmatter.participants.map(toUmamusume);

      // Race 系 phase のみ対象。PACE / Gate / Judgment は仕様書 §B L153 注記
      // および Parser 振り分けが特殊（PACE / parseJudgment）なため除外。
      const raceBlocks: { block: PhaseBlock; index: number }[] = [];
      phases.forEach((block, idx) => {
        if (RACE_PHASES.includes(block.phaseName)) {
          raceBlocks.push({ block, index: idx });
        }
      });

      raceBlocks.forEach(({ block, index }) => {
        const meta: DerivedFromMeta = {
          filePath,
          phaseName: block.phaseName,
          blockIndex: index,
        };

        describe(`${block.phaseName} block #${index}`, () => {
          const firstDice = findFirstDiceLineIndex(block.codeBlock);
          const lastDice = findLastDiceLineIndex(block.codeBlock);
          const totalLines = block.codeBlock.split(/\r?\n/).length;

          // ベースライン解析結果（派生との変化検出の基準）。
          const origParser = ParserFactory.getParser(block.codeBlock);
          const origResult = origParser.parse(block.codeBlock, participants, 'RACE');

          it('rangeShiftHead detects 範囲ズレ先頭欠落', () => {
            // dice 行を含まないブロックは派生対象外（実データ整合性は realData.test.ts で担保済）。
            if (firstDice < 0) return;

            // 最初の dice 行を含めて削除（dropLines = firstDice + 1）。
            // 仕様書 §B「最初の N 行を削除」に従い、dice 行を含む最小 N を選定。
            const dropLines = firstDice + 1;
            const derived = generateRangeShiftHead(block, dropLines, meta);
            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            // 主軸 assertion (DoD #4 解釈): 元 results より減少 = dice 行欠落の検出証拠。
            expect(result.results.length).toBeLessThan(origResult.results.length);
          });

          it('rangeShiftTail detects 範囲ズレ末尾欠落', () => {
            if (lastDice < 0) return;

            // 最後の dice 行を含めて削除（dropLines = totalLines - lastDice）。
            // 末尾空行や閉じ記号があっても dice 行までを確実に欠落させる N。
            const dropLines = totalLines - lastDice;
            const derived = generateRangeShiftTail(block, dropLines, meta);
            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            expect(result.results.length).toBeLessThan(origResult.results.length);
          });

          it('phaseInjection detects 異フェーズ混入', () => {
            // 同 race 内の別 race 系 block を最初に検出されたものから採用。
            // race 系 block が単独 (midPhaseCount=0 + Start なし等) の場合は本テスト skip。
            const injectionSource = raceBlocks.find((rb) => rb.index !== index);
            if (!injectionSource) return;

            const derived = generatePhaseInjection(block, injectionSource.block, meta);
            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            // 主軸 assertion: 元との差分検出（results 件数変化 OR errors 件数変化）。
            // 仕様書 §B「想定エラー検知: 合計値が不一致 / 複数のペースダイスが検出された 等」
            // は Parser 実装依存のため、変化検出を主軸とする。
            const detected =
              result.results.length !== origResult.results.length ||
              result.errors.length !== origResult.errors.length;
            expect(detected).toBe(true);
          });

          // CR-SA-3-E4-2 (ENG07 / 2026-05-06): 残り 3 パターン。
          // 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B L140-155

          it('trailingWhitespaceEdit: Parser 前処理 trim で吸収（regression guard）', () => {
            const derived = generateTrailingWhitespaceEdit(block, meta);
            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            // 主軸 assertion (regression guard): 元と同じ件数 = trim 吸収成功。
            expect(result.results.length).toBe(origResult.results.length);
            expect(result.errors.length).toBe(origResult.errors.length);
          });

          it('blankLineInjection: Parser 前処理 空行フィルタで吸収（regression guard）', () => {
            const derived = generateBlankLineInjection(block, meta);
            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            // 主軸 assertion (regression guard): 元と同じ件数 = 空行フィルタ吸収成功。
            expect(result.results.length).toBe(origResult.results.length);
            expect(result.errors.length).toBe(origResult.errors.length);
          });

          it('invalidParenSum: StandardParser で (N) 改竄エラー検出', () => {
            // ParserFactory が StandardParser を返す block のみ対象。
            // EmojiParser は (N) 自動算出のため改竄概念が成立せず skip。
            const probe = ParserFactory.getParser(block.codeBlock);
            if (!(probe instanceof StandardParser)) return;

            const derived = generateInvalidParenSum(block, meta);
            // (N) を含まないブロックは派生不可 = 入力不変 → skip。
            if (derived.codeBlock === block.codeBlock) return;

            const parser = ParserFactory.getParser(derived.codeBlock);
            const result = parser.parse(derived.codeBlock, participants, 'RACE');

            // 主軸 assertion: errors 件数増加 = (N) 改竄検出証拠。
            expect(result.errors.length).toBeGreaterThan(origResult.errors.length);
          });
        });
      });
    });
  }
});
