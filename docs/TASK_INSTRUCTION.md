# Task Instruction: Phase 2.6.5 Hotfix (Oonige Logic)

**Target Role:** Engineer
**Goal:** 大逃げ脚質の終盤ダイス (`-1d27`) が正しく減算処理されるようにParserおよびLogicを修正する。

## Context
ユーザー報告により、大逃げの終盤ダイスが減算されず、そのまま加算（または無視）されているバグが判明しました。
`REQUIREMENTS.md` は既に修正済みであり、**「ツール側で `-dice` 表記を検出し、負の値として扱う」** 仕様となっています。

## Requirements (What to do)

### 1. Reproduction & Test Case (TDD)
*   `src/core/parser/*.test.ts` に、大逃げのマイナスダイスケースを追加してください。
    *   Input: `大逃げ -dice1d27=15 (15)` (掲示板の出力形式)
    *   Expected: `value: -15` (負の値としてパースされること)

### 2. Logic Fix
*   **Parser Logic (`StandardParser` / `EmojiParser`):**
    *   正規表現または解析ロジックを修正し、`dice` の直前にある `-` (マイナス記号) を認識できるようにしてください。
    *   掲示板によっては `dice-1d27=` や `-dice1d27=` のように表記揺れがある可能性がありますが、**`REQUIREMENTS.md` の定義通り `-dice` を正**として扱ってください。
    *   解析した数値に `-1` を掛けて、正しく負の値として `DiceResult` を生成してください。
*   **Validation:**
    *   合計スコア計算において、単純な足し算 (`current + diceValue`) で減算が成立することを確認してください（`50 + (-15) = 35`）。

## Definition of Done
*   [ ] 追加したテストケース（Oonige Negative Dice）がPassする。
*   [ ] 実際に `npm run dev` で起動し、Scene 3 で大逃げの終盤ダイスを入力してスコアが減ることを目視確認する。
