// CR-SA-3-E4 (ENG05 / 2026-05-05): 派生データ層生成ヘルパー（核心 3 パターン）。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B L140-155
//            docs/specs/architecture/parser-system.md §A / §B
//            docs/handover/TASK_INSTRUCTION.md §2.1
// 純関数 (副作用なし、I/O は fixtureLoader.ts のみが担う)。

import type { PhaseBlock, PhaseName } from './fixtureLoader';

export type DerivedPattern =
  | 'rangeShiftHead'
  | 'rangeShiftTail'
  | 'phaseInjection'
  | 'trailingWhitespaceEdit'
  | 'blankLineInjection'
  | 'invalidParenSum';

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

// CR-SA-3-E4-2 (ENG07 / 2026-05-06): 残り 3 パターン純関数追加。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B L140-155

// 各行末に半角空白 1 つ + 全角空白 1 つを追加した派生ブロックを返す。
// 仕様書 §B「各行末に半角/全角空白を 1〜数個追加」と整合。
// Parser 前処理 trim で吸収される想定 → regression guard。
export function generateTrailingWhitespaceEdit(
  block: PhaseBlock,
  meta: DerivedFromMeta,
): DerivedBlock {
  const lines = block.codeBlock.split(/\r?\n/);
  const edited = lines.map((line) => `${line} 　`); // 半角SP + 全角SP
  return {
    derivedFrom: meta,
    derivedPattern: 'trailingWhitespaceEdit',
    phaseName: block.phaseName,
    codeBlock: edited.join('\n'),
  };
}

// 各行間に空行を 1 行追加した派生ブロックを返す。
// 仕様書 §B「各行間に空行を追加」と整合。
// Parser 前処理 空行フィルタで吸収される想定 → regression guard。
export function generateBlankLineInjection(
  block: PhaseBlock,
  meta: DerivedFromMeta,
): DerivedBlock {
  const lines = block.codeBlock.split(/\r?\n/);
  const edited = lines.flatMap((line) => [line, '']);
  return {
    derivedFrom: meta,
    derivedPattern: 'blankLineInjection',
    phaseName: block.phaseName,
    codeBlock: edited.join('\n'),
  };
}

// 最初に検出された (N) の N を意図的に大きく書き換えた派生ブロックを返す。
// (N) が見つからない場合は codeBlock を変更せずそのまま返す（テスト側で skip 判定）。
// 仕様書 §B「(N) の値を意図的に書き換え」と整合。
// 「ダイス合計値が不正です」(StandardParser L203) エラー検出。
// EmojiParser は (N) 自動算出のため改竄概念が成立せず、対象外（テスト側で instanceof 判定）。
export function generateInvalidParenSum(
  block: PhaseBlock,
  meta: DerivedFromMeta,
): DerivedBlock {
  const parenRe = /\((-?\d+)\)/;
  const matched = block.codeBlock.match(parenRe);
  let edited = block.codeBlock;
  if (matched) {
    const orig = parseInt(matched[1], 10);
    const tampered = orig + 9999; // 衝突回避のため大きく加算
    edited = block.codeBlock.replace(parenRe, `(${tampered})`);
  }
  return {
    derivedFrom: meta,
    derivedPattern: 'invalidParenSum',
    phaseName: block.phaseName,
    codeBlock: edited,
  };
}
