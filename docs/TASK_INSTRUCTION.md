# Task Instruction: ダイス解析バグ修正 (Critical)

## 1. Overview
**優先度:** 🚨 **CRITICAL (最優先)**
**作成日:** 2026-02-08
**PM:** PMセッション

### 要約
レース中（Scene 3）のダイス結果解析で、複数ダイス（例: `dice3d5`）のスペース区切り出目を正しく合計できず、チェックサム検証がエラーになる致命的バグを修正する。

---

## 2. Background & Problem

### 発生事象
```
入力: ① カンパネラ　10+dice3d5=3 1 4 (8)
エラー: ダイス合計値が不正です (計算値: 13, 記載値: 8)
```

### 根本原因
`src/core/parser/standardParser.ts` の `parseRace` メソッド（L167付近）において：
```typescript
let val = parseInt(rollRaw.trim(), 10);
```
- `rollRaw` = `"3 1 4 "` (スペース区切りのダイス出目)
- `parseInt("3 1 4", 10)` → `3` (最初の数値のみ)
- 正しい計算: `3 + 1 + 4 = 8`

### 影響範囲
- **Scene 3 全フェーズ** (序盤・中盤・終盤)
- **全ての複数ダイス** (`XdY` で `X > 1` の場合)

---

## 3. What to Implement (実装内容)

### 修正対象ファイル
- `src/core/parser/standardParser.ts`

### 変更内容
`parseRace` メソッド内で `rollRaw` からダイス合計値を抽出する処理を以下のように変更：

1. **スペース区切りの数値を全て抽出**
2. **各数値を合計してダイス出目合計とする**

**擬似コード:**
```typescript
// Before
let val = parseInt(rollRaw.trim(), 10);

// After
const diceValues = rollRaw.trim().split(/\s+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
let val = diceValues.reduce((acc, cur) => acc + cur, 0);
```

### 注意点
- 単一ダイス（例: `dice1d100=50`）の場合も動作すること（`["50"].reduce(...)` = `50`）
- 空白のみの場合のエッジケースを考慮
- 既存の `negativeSign` 処理との整合性を維持

---

## 4. Done Definition (完了条件)

### 必須
- [ ] 既存のユニットテストが全て通過すること
- [ ] 新規テストケース「複数ダイスのスペース区切り形式」が通過すること
- [ ] 以下の入力が正しく解析されること:
  - `① カンパネラ　10+dice3d5=3 1 4 (8)` → diceResult: 8, total: 18
  - `② ウマ娘B　30+dice3d8=5 3 2 (10)` → diceResult: 10, total: 40

### 推奨
- [ ] 大逃げ（負のダイス）でも正しく動作すること
  - `① 大逃げ　62+-dice1d27=15 (15)` → diceResult: -15

---

## 5. Verification (検証方法)

### 自動テスト
```powershell
cd c:\u_temp\race
npm test
```

### 手動検証（PM確認用）
1. `npm run dev` で開発サーバー起動
2. Scene 1 でエントリー登録（脚質「先行」など複数ダイス系）
3. Scene 2 で枠順決定
4. Scene 3 で以下のテキストを貼り付けて解析実行:
   ```
   ① テストウマ娘　10+dice3d5=3 1 4 (8)
   ```
5. **期待結果:** エラーなしで正しく合計値(18)がスコアに反映

---

## 6. Notes

- `REQUIREMENTS.md` の修正は不要（要件定義は正しく、実装がそれを満たしていなかった）
- 変更範囲は `standardParser.ts` のみで十分
- `parseJudgment` メソッドも同様の問題がある可能性があるため、合わせて確認・修正
