# User Review: EmojiParser 減算Fix実装 (CR-2 #3-2-F)

## 概要
**ステータス:** レビュー待ち
**変更日:** 2026-03-06

`emojiParser.ts` の複数行フォーマット解析で、減算ケース（`73-dice3d6=`）の `isSubtractive` フラグが未実装だった問題を修正。`合計:` 行処理時に `diceSum` が常に加算され `73 + 15 = 88` となっていたのを、正しく `73 - 15 = 58` と計算されるようにした。

---

## 起動手順

```powershell
cd c:\u_temp\race
npm test
```

テスト結果のみで検証可能（手動検証不要）。

---

## 動作確認結果

### 自動テスト
```
 Test Files  8 passed (8)
      Tests  57 passed (57)
   Duration  544ms
```

### テストケース一覧（新規追加分）
| テスト | 内容 | 期待値 |
|--------|------|--------|
| 複数行減算 (Critical Fix) | `73-dice3d6=` + `合計: 15` | `diceResult: -15`, `total: 58` |
| 複数行加算 (回帰確認) | `15+dice3d6=` + `合計: 18` | `diceResult: 18`, `total: 33` |
| 単一行減算 (回帰確認) | `73-dice1d12=7` | `diceResult: -7`, `total: 66` |

---

## 変更ファイル
- `src/core/parser/emojiParser.ts` — 減算フラグ `_isSubtractive` の保存と `合計:` 行処理での参照。未解決コメント群を整理
- `src/core/parser/emojiParser.test.ts` — テストケース3件追加

---

## Self-Check Result
- 複数行減算: ヘッダー解析時に `_isSubtractive` フラグを `currentBlock` に保存し、`合計:` 行処理時に `diceResult` を負数に変換
- 単一行減算: 既存ロジック（L79-81の `inlineResult` 負数変換）は変更なし、回帰テストで動作確認済み
- 複数行加算: 既存テスト + 新規回帰テストで動作確認済み
- `ParsedLine` インターフェースへの変更なし（内部フラグのみ使用）
- `StandardParser` の `-dice` 処理パターンと一貫した動作

---

## User Feedback
- Round 1（EmojiParser 複数行減算）および Round 2（StandardParser `Fix-dice` 対応）を併せて **完了承認**（PM Session #2, 2026-04-22）
- Round 2 はタスクスコープ外だが、実動作検証中に発見された同一バグクラスタの追加修正として妥当と判断
- テスト 54→59件、全通過。回帰なし

---

## 追加修正: StandardParser `Fix-dice` 対応 (同Critical Fix追加分)

### 問題
実動作テスト中に `Invalid dice format: "① ツインターボ　58-dice1d27=20(20)"` エラーを確認。

### 原因
`standardParser.ts` の regex `(?:(\d+)[+＋])?(-)?` は以下のみ対応:
- `Name Fix+dice...` （Fix + plus）
- `Name -dice...` （Fix なし、マイナス dice）

**`Name Fix-dice...`（Fixの後にマイナス演算子）がカバーされていなかった**。大逃げで Fix あり + 終盤ダイス減算 + 絵文字なしのケースで `Invalid dice format` エラー。

### 修正内容
1. regex を `(?:(\d+)([+＋\-]))?\s*(-)?` に拡張し、Fix演算子をキャプチャ（Group 3）
2. `isSubtractive = fixOperator === '-' || Boolean(negativeSign)` で減算判定を統合
3. `parseRace` と `parseJudgment` の両方を同時修正（同じregexを使用しているため）

### 追加テストケース
| テスト | 内容 | 期待値 |
|--------|------|--------|
| Fix-dice (parens付) | `① Twin Turbo　58-dice1d27=20(20)` | `fixValue: 58, diceResult: -20, total: 38` |
| Fix-dice (parens無) | `Twin Turbo 58-dice1d27=20` | `fixValue: 58, diceResult: -20, total: 38` |

### テスト結果
```
 Test Files  8 passed (8)
      Tests  59 passed (59)  ← 57 → 59
```
