// CR-SA-3-E4 (ENG05 / 2026-05-05): 派生データ層生成ヘルパー（核心 3 パターン）。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B L140-155
//            docs/specs/architecture/parser-system.md §A / §B
//            docs/handover/TASK_INSTRUCTION.md §2.1
// 純関数 (副作用なし、I/O は fixtureLoader.ts のみが担う)。

import type { PhaseBlock, PhaseName } from './fixtureLoader';

export type DerivedPattern =
  | 'rangeShiftHead'
  | 'rangeShiftTail'
  | 'phaseInjection';

export interface DerivedFromMeta {
  filePath: string;
  phaseName: PhaseName;
  blockIndex: number;
}

export interface DerivedBlock {
  derivedFrom: DerivedFromMeta;
  derivedPattern: DerivedPattern;
  phaseName: PhaseName;
  codeBlock: string;
}

// 行配列の先頭 dropLines 行を削除した派生ブロックを返す。
// 仕様書 §B「実データの最初の N 行を削除」と整合。
export function generateRangeShiftHead(
  block: PhaseBlock,
  dropLines: number,
  meta: DerivedFromMeta,
): DerivedBlock {
  if (dropLines < 1) {
    throw new Error(`dropLines must be >= 1 (got ${dropLines})`);
  }
  const lines = block.codeBlock.split(/\r?\n/);
  const truncated = lines.slice(dropLines);
  return {
    derivedFrom: meta,
    derivedPattern: 'rangeShiftHead',
    phaseName: block.phaseName,
    codeBlock: truncated.join('\n'),
  };
}

// 行配列の末尾 dropLines 行を削除した派生ブロックを返す。
// 仕様書 §B「実データの最後の N 行を削除」と整合。
export function generateRangeShiftTail(
  block: PhaseBlock,
  dropLines: number,
  meta: DerivedFromMeta,
): DerivedBlock {
  if (dropLines < 1) {
    throw new Error(`dropLines must be >= 1 (got ${dropLines})`);
  }
  const lines = block.codeBlock.split(/\r?\n/);
  const truncated = lines.slice(0, Math.max(0, lines.length - dropLines));
  return {
    derivedFrom: meta,
    derivedPattern: 'rangeShiftTail',
    phaseName: block.phaseName,
    codeBlock: truncated.join('\n'),
  };
}

// targetBlock の末尾に sourceBlock のコードブロックを追記した派生ブロックを返す。
// 仕様書 §B「異なるフェーズの結果が混入」と整合。
// derivedFrom メタは target 側を記録（混入元 phase は呼び出し側で別途観察ログに残す想定）。
export function generatePhaseInjection(
  targetBlock: PhaseBlock,
  sourceBlock: PhaseBlock,
  meta: DerivedFromMeta,
): DerivedBlock {
  return {
    derivedFrom: meta,
    derivedPattern: 'phaseInjection',
    phaseName: targetBlock.phaseName,
    codeBlock: `${targetBlock.codeBlock}\n${sourceBlock.codeBlock}`,
  };
}

// dropLines を「dice 行を含む位置」に動的設定するためのヘルパー（純関数、副作用なし）。
// テスト側で参加者ダイス行を確実に欠落させる N 値計算に使用する。
const DICE_LINE_RE = /dice\d*d\d+/i;

export function findFirstDiceLineIndex(codeBlock: string): number {
  const lines = codeBlock.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (DICE_LINE_RE.test(lines[i])) return i;
  }
  return -1;
}

export function findLastDiceLineIndex(codeBlock: string): number {
  const lines = codeBlock.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (DICE_LINE_RE.test(lines[i])) return i;
  }
  return -1;
}
