# Work Log: チェックサムロジック修正 (Critical)

**Date:** 2026-02-08
**Task:** ユーザーフィードバックに基づくクリティカル修正

## 🔴 エスカレーション

### REQUIREMENTS.md の更新が必要

**問題:**
- `(N)` の定義が曖昧で、実装者に誤解を与える記述になっている
- L476付近の「`(Total)`」という表現が `fix + diceResult` と誤解される

**推奨対応:**
1. `(N)` は「ダイス出目の総和」であることを明記
2. チェックサム検証の詳細仕様を追記:
   - 出目の個数が `X` と一致すること
   - 各出目が `1~Y` の範囲内であること
   - 出目の合計が `(N)` と一致すること

---

## 変更内容

### `src/core/parser/standardParser.ts`

**修正前 (誤り):**
```typescript
const calculatedTotal = fixValue + diceResult;
if (calculatedTotal !== checkVal) {
    errors.push(`ダイス合計値が不正です`);
}
```

**修正後 (正しい):**
```typescript
// diceStr から X (個数) と Y (面数) を抽出
const diceMatch = diceStr.match(/(\d*)d(\d+)/i);
const diceCount = diceMatch && diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
const diceFaces = diceMatch ? parseInt(diceMatch[2], 10) : 0;

// 検証1: 出目の数がダイス個数(X)と一致するか
if (diceValues.length !== diceCount) { ... }

// 検証2: 各出目がダイス面数(Y)を超えていないか
const invalidDice = diceValues.filter(v => v < 1 || v > diceFaces);

// 検証3: ダイス出目の総和と(N)の値が一致するか
const absVal = Math.abs(val);
const absCheckVal = Math.abs(checkVal);
if (absVal !== absCheckVal) { ... }
```

### `src/core/parser/standardParser.test.ts`

- 既存テストの `(N)` を正しい形式（ダイス出目総和）に修正
- 複数ダイスを単一値ではなくスペース区切り形式に変更

## テスト結果

```
Test Files  8 passed (8)
     Tests  49 passed (49)
  Duration  608ms
```

## 技術的申し送り

- `parseJudgment` も同様のロジック変更がすでに適用済み（L86付近）
- EmojiParser は別ファイルだが、同様の修正が必要な可能性あり（要確認）

