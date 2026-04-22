# Work Log: EmojiParser/StandardParser 減算ダイス修正

**日付:** 2026-04-22
**タスク:** CR-2（事項番号 #3-2-F 相当）
**ステータス:** 完了（追加修正1件含む）

---

## 実装概要

大逃げ（Great Escape）の終盤ダイス減算に関する2つのパーサーバグを修正。

### Round 1: EmojiParser 複数行減算バグ
88-ch 形式の複数行ダイス（`Name 73-🎲 dice3d6=` + `合計: 15`）で、減算演算子 `-` が無視され常に加算されていた（`73 + 15 = 88`）。本来は `73 - 15 = 58` が期待値。

### Round 2: StandardParser `Fix-dice` 未対応
実動作テスト中に `Invalid dice format: "① ツインターボ　58-dice1d27=20(20)"` を確認。絵文字なしで Fix + `-` + dice の形式が regex に未対応だった。

---

## 変更内容

### Round 1: EmojiParser 複数行減算
- ヘッダー解析時に `isSubtractive` フラグを `currentBlock._isSubtractive` へ保存
- `合計:` 行処理時にフラグを参照し、`diceResult` の符号を決定
- 未解決コメント群（旧L84-98）を整理

### Round 2: StandardParser regex拡張
- 既存 regex `(?:(\d+)[+＋])?(-)?` → `(?:(\d+)([+＋\-]))?\s*(-)?` に拡張
  - Group 3 で Fix 演算子（`+` / `-`）をキャプチャ
  - Group 4 は既存の Fix なしマイナスダイス用（Silence Suzuka 系）を維持
- `isSubtractive = fixOperator === '-' || Boolean(negativeSign)` で減算判定を統合
- `parseRace` と `parseJudgment` の両方を同時修正（同一 regex 使用のため）
- regex Analysis コメントのグループ番号更新

### 変更ファイル
| ファイル | 変更内容 |
|----------|----------|
| `src/core/parser/emojiParser.ts` | `_isSubtractive` フラグ導入、`合計:` 行処理で符号適用、コメント整理 |
| `src/core/parser/emojiParser.test.ts` | テスト3件追加（複数行減算 Critical / 複数行加算回帰 / 単一行減算回帰） |
| `src/core/parser/standardParser.ts` | regex 拡張、`fixOperator` キャプチャ、`isSubtractive` 統合（parseRace/parseJudgment両方） |
| `src/core/parser/oonige.test.ts` | テスト2件追加（Fix-dice parens付/parens無） |
| `docs/USER_REVIEW.md` | レビュー文書の作成と追加修正の追記 |

---

## テスト結果

| 段階 | Test Files | Tests |
|------|------------|-------|
| 修正前 | 8 | 54 |
| Round 1 完了後 | 8 | 57 (+3) |
| Round 2 完了後 | 8 | 59 (+2) |

全テスト通過。既存57件への回帰なし。

### 新規テストケース
**EmojiParser**
- 複数行減算 Critical Fix: `73-🎲 dice3d6=` + `合計: 15` → `diceResult: -15, total: 58`
- 複数行加算 回帰確認: `15+🎲 dice3d6=` + `合計: 18` → `diceResult: 18, total: 33`
- 単一行減算 回帰確認: `73-🎲 dice1d12=7` → `diceResult: -7, total: 66`

**StandardParser (oonige.test.ts)**
- Fix-dice parens付: `① Twin Turbo　58-dice1d27=20(20)` → `fixValue: 58, diceResult: -20, total: 38`
- Fix-dice parens無: `Twin Turbo 58-dice1d27=20` → `fixValue: 58, diceResult: -20, total: 38`

---

## 仕様補足

大逃げの終盤ダイスは3つの入力経路が存在する:
1. **絵文字あり・単一行**: `Name 73-🎲 dice1d27=23` → EmojiParser single-line
2. **絵文字あり・複数行**: `Name 73-🎲 dice1d27=` + `合計: 23` → EmojiParser multi-line（Round 1）
3. **絵文字なし・単一行**: `① Name　58-dice1d27=20(20)` → StandardParser（Round 2）

今回の修正で3パターンすべてが正しく減算処理されるようになった。

---

## 技術的申し送り

### 発見された設計上の示唆
両パーサーとも `isSubtractive` 概念で統一的に扱うのが自然だが、ParsedLine インターフェースには `isSubtractive` フィールドが存在せず、`diceResult` を負数に変換して吸収している。将来的に `diceResult` の符号だけで全ての減算意図を表現する現設計で問題ないか、検算ロジック（絶対値比較など）含めて再確認すると良い。

### 回帰リスク
今回追加した `(?:(\d+)([+＋\-]))?` は任意マッチのため、既存の `Fix+` / Fix なし / `-dice` ケースに影響なし（テスト全件通過で確認済み）。ただし `Name 30+-dice1d27=...`（`+-` 併記）のような変則形式は Group 3 で `+` を、Group 4 で `-` をキャプチャすることになり、意図通り減算として扱われる。
