# Task Instruction: EmojiParser 減算Fix実装 (Critical)

## 1. Overview
**優先度:** CRITICAL (最優先)
**作成日:** 2026-03-06
**PM:** PMセッション #2
**Issue:** CR-2（事項番号 #3-2-F）

### 要約
`emojiParser.ts` の複数行フォーマット解析で、減算ケース（`73-🎲 dice3d6=`）の `isSubtractive` フラグが未実装。`合計:` 行処理時に `diceSum` が常に加算され、期待値 `73 - 15 = 58` が `73 + 15 = 88` と誤計算される。

---

## 2. Background & Problem

### 発生事象
88-ch形式の複数行フォーマットで、Fix値からダイス結果を**減算**するケース:

```
73-🎲 dice3d6=
1 2 3
合計: 15
```

- **期待結果:** `73 - 15 = 58`
- **現在の結果:** `73 + 15 = 88`（加算で誤計算）

### 根本原因
`emojiParser.ts` の以下の流れで減算情報が失われる:

1. **ヘッダー解析（L65-71）:** `fixMatch` で演算子 `+` or `-` を検出し、`isFixPlus = false` を設定 → ここまでは正しい
2. **単一行の場合（L81-83）:** `inlineResult` を負数に変換 → 正しく動作
3. **複数行の場合（L84-98）:** コード内コメントで「`isSubtractive` を保存する必要がある」と明記されているが**未実装**
4. **`合計:` 行処理（L167-171）:** `currentBlock.total = (currentBlock.fixValue || 0) + diceSum` → **常に加算**

### 影響範囲
- `src/core/parser/emojiParser.ts` — 複数行フォーマットの減算ケース全般
- 大逃げ戦法（基礎値から減算するケース）で順位・結果に直接影響する重大な計算誤り

### 参考資料
- `FINDINGS_CONSOLIDATED.md` #3-2-F（L1621-）
- `CODE_REVIEW_BOARD.md` Step 5-3-2 Critical B#2（L3783）
- `CODE_REVIEW_BOARD.md` Step 3-2 詳細（L1321-1326）

---

## 3. What to Implement (実装内容)

### 修正対象ファイル
- `src/core/parser/emojiParser.ts`
- `src/core/parser/emojiParser.test.ts`（テスト追加。ファイルが存在しない場合は新規作成）

### 変更内容

1. **`currentBlock` に減算フラグを保持する仕組みを追加する**
   - ヘッダー解析時に `isFixPlus` の値を `currentBlock` に記録する
   - 内部的な型拡張（`as any` やローカル型定義）で対応可

2. **`合計:` 行処理で減算フラグを参照する**
   - `isSubtractive` が true の場合: `total = fixValue - diceSum`
   - `isSubtractive` が false の場合: `total = fixValue + diceSum`（現行動作）

3. **単一行ケースの動作は維持する**
   - 既存の `inlineResult` 負数変換ロジック（L48-50, L81-83）は変更しないこと
   - 既存テストが壊れないことを確認

### 注意点
- `ParsedLine` インターフェースの変更は**不要**（`diceResult` を負数で格納するか、`total` 計算時に符号を反転すればよい）
- `StandardParser` には既に `-dice` 構文の減算処理が実装済み。動作の一貫性を意識すること
- `REQUIREMENTS.md` の修正は不要

---

## 4. Done Definition (完了条件)

### 必須
- [ ] 既存のユニットテストが全て通過すること（`npm test`）
- [ ] 以下のテストケースが追加され通過すること:
  - **複数行減算:** `73-🎲 dice3d6=` + `合計: 15` → `diceResult: -15`（or equivalent）、`total: 58`
  - **複数行加算（回帰確認）:** `15+🎲 dice3d6=` + `合計: 18` → `diceResult: 18`、`total: 33`
  - **単一行減算（回帰確認）:** `73-🎲 dice1d12=7` → `total: 66`

### 推奨
- [ ] 複数行減算で `(N)` チェックサム付きケースが正しく計算されること
- [ ] コード内の未解決コメント（L84-98付近の TODO的コメント）を解消すること

---

## 5. Verification (検証方法)

### 自動テスト
```powershell
cd c:\u_temp\race
npm test
```

### 手動検証（PM確認用）
減算ケースの手動検証は自動テストで十分にカバーされるため、テスト結果の確認をもって検証とする。

---

## 6. Notes

- history問題（CR-38）は本タスクの範囲外。PM#3でSAエスカレーションと併せて対応予定
- `emojiParser.ts` L84-98 のコメント群は問題の所在を正確に記述しているため、修正の参考にすること
- `StandardParser` の `-dice` 処理（`standardParser.ts`）を参照すると、減算の実装パターンが確認できる
