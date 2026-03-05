# レビューエージェント運用ガイド

> サブエージェント `review-checker` を使った整合性チェックの運用手順書。
> メインセッションの操作者（人間 or メイン Claude）が参照する。

---

## 1. 全体フロー

```
[1. 起動] Step固有の指示を組み立て、サブエージェントを起動
    ├─ 並列可能な Step は同一メッセージ内で複数起動
    └─ run_in_background: true でバックグラウンド実行
         ↓
[2. 受信] サブエージェントのマークダウンレポートを受け取る
         ↓
[3. 転記] CODE_REVIEW_BOARD.md へ反映
    ├─ チェックボックスの更新（[x] + 結果ラベル）
    ├─ 発見事項テーブルへの行追加
    └─ 詳細セクションの生成
         ↓
[4. 提示] ユーザーに結果サマリーを報告
         ↓
[5. FB受付] ユーザーフィードバックを受け取る
         ↓
[6. 再評価] 必要に応じて同一エージェントを resume で再開
    └─ フィードバック内容を追加指示として渡す
         ↓
[7. 更新] 再評価結果でレビューボードを上書き更新
```

---

## 2. Step 起動テンプレート

サブエージェント起動時に以下の形式で指示を渡す。

```markdown
## 整合性チェック指示

### Step情報
- **Step ID:** {stepId}（例: 1-2）
- **Step タイトル:** {stepTitle}（例: specs/architecture/ ↔ パーサー実装）

### チェック対象

**仕様書（すべて読み込んでください）:**
- `{仕様ファイルの絶対パス}`
- ...

**実装コード（すべて読み込んでください）:**
- `{実装ファイルの絶対パス}`
- ...

**補助参照（必要に応じて）:**
- `{型定義やストアなど、理解に必要な追加ファイル}`

### チェック項目
以下の各項目について整合性を判定してください:
1. {チェック項目1の説明}
2. {チェック項目2の説明}
3. ...

### 補足コンテキスト（あれば）
{前のStepで発見された関連事項、ユーザーフィードバックなど}
```

---

## 3. Step 別の起動指示一覧

### Step 1-2: パーサー実装

```
Step ID: 1-2
Step タイトル: specs/architecture/ ↔ パーサー実装

仕様書:
- C:\u_temp\race\docs\specs\architecture\parser-system.md

実装コード:
- C:\u_temp\race\src\core\parser\standardParser.ts
- C:\u_temp\race\src\core\parser\emojiParser.ts
- C:\u_temp\race\src\core\parser\parserFactory.ts
- C:\u_temp\race\src\core\parser\interface.ts

チェック項目:
1. parser-system.md の StandardParser 仕様 ↔ standardParser.ts
2. parser-system.md の EmojiParser 仕様 ↔ emojiParser.ts
3. parser-system.md の自動判別ルール ↔ parserFactory.ts
```

### Step 1-3a: Scene 1（Setup）

```
Step ID: 1-3a
Step タイトル: specs/ui/scene1 ↔ Setup UIコンポーネント

仕様書:
- C:\u_temp\race\docs\specs\ui\scene1-setup.md

実装コード:
- C:\u_temp\race\src\components\scene\SetupScene.tsx
- C:\u_temp\race\src\components\scene\setup\EntryForm.tsx
- C:\u_temp\race\src\components\scene\setup\RaceConfigForm.tsx

補助参照:
- C:\u_temp\race\src\store\useRaceStore.ts（状態管理の確認用）
- C:\u_temp\race\src\types\index.ts（型定義の確認用）

チェック項目:
1. scene1-setup.md §1-2 初期状態/レース設定 ↔ RaceConfigForm.tsx の実装
2. scene1-setup.md §1 エントリーフォーム ↔ EntryForm.tsx の実装
3. scene1-setup.md §3 通知エリア/バリデーション ↔ エラーハンドリングの実装
4. scene1-setup.md §4 途中修正とデータ保持 ↔ useRaceStore.ts の状態管理
```

### Step 1-3b: Scene 2（Gate）

```
Step ID: 1-3b
Step タイトル: specs/ui/scene2 ↔ Gate UIコンポーネント

仕様書:
- C:\u_temp\race\docs\specs\ui\scene2-gate.md

実装コード:
- C:\u_temp\race\src\components\scene\GateScene.tsx

補助参照:
- C:\u_temp\race\src\store\useRaceStore.ts

チェック項目:
1. scene2-gate.md のワイヤーフレーム/4セクション構成 ↔ GateScene.tsx のレイアウト
2. scene2-gate.md の解析・ソートロジック ↔ GateScene.tsx の handleParse 実装
```

### Step 1-3c: Scene 3（Race）

```
Step ID: 1-3c
Step タイトル: specs/ui/scene3 ↔ Race UIコンポーネント

仕様書:
- C:\u_temp\race\docs\specs\ui\scene3-race.md

実装コード:
- C:\u_temp\race\src\components\scene\RaceScene.tsx
- C:\u_temp\race\src\components\scene\race\PhaseInput.tsx
- C:\u_temp\race\src\components\scene\race\PhaseOutput.tsx
- C:\u_temp\race\src\components\scene\race\RaceDashboard.tsx

補助参照:
- C:\u_temp\race\src\hooks\useRaceEngine.ts（フェーズシーケンス管理）
- C:\u_temp\race\src\store\useRaceStore.ts
- C:\u_temp\race\src\core\calculator.ts（スコア計算）
- C:\u_temp\race\src\core\strategies.ts（ダイス式取得）

チェック項目:
1. scene3-race.md のフェーズシーケンス（序盤→ペース→中盤→終盤）↔ useRaceEngine.ts
2. scene3-race.md のダイス出力テキスト生成仕様 ↔ PhaseOutput.tsx
3. scene3-race.md のテキスト貼り付け→解析→スコア反映 ↔ PhaseInput.tsx
4. scene3-race.md のダッシュボード表示仕様 ↔ RaceDashboard.tsx
5. scene3-race.md の自動スクロール仕様 ↔ RaceScene.tsx
```

### Step 1-3d: Scene 4（Judgment + Result）

```
Step ID: 1-3d
Step タイトル: specs/ui/scene4 ↔ Judgment & Result UIコンポーネント

仕様書:
- C:\u_temp\race\docs\specs\ui\scene4-judgment.md
- C:\u_temp\race\docs\specs\ui\scene4-result.md

実装コード:
- C:\u_temp\race\src\components\scene\JudgmentScene.tsx
- C:\u_temp\race\src\components\scene\ResultScene.tsx

補助参照:
- C:\u_temp\race\src\core\logic\RankingCalculator.ts（順位計算ロジック）
- C:\u_temp\race\src\types\index.ts

チェック項目:
1. scene4-judgment.md の着差判定UI ↔ JudgmentScene.tsx の実装
2. scene4-judgment.md の写真判定・着差判定ダイスUI ↔ ダイス入力/表示の実装
3. scene4-result.md の結果テーブル表示 ↔ ResultScene.tsx の実装
4. scene4-result.md のテキストコピー/画像出力 ↔ ResultScene.tsx のエクスポート機能
```

### Step 1-4: 技術スタック

```
Step ID: 1-4
Step タイトル: specs/architecture/tech-stack.md ↔ 実際の構造

仕様書:
- C:\u_temp\race\docs\specs\architecture\tech-stack.md

実装コード:
- プロジェクトルートの設定ファイル群（package.json, tsconfig.json, vite.config.ts 等）
- src/ ディレクトリ全体の構造（Glob で確認）

チェック項目:
1. tech-stack.md のディレクトリ構造定義 ↔ 実際の src/ 構造
2. tech-stack.md の技術スタック一覧 ↔ package.json の依存関係（記載ありだが未使用、記載なしだが使用中の検出）
```

---

## 4. 並列実行マトリクス

### Stage 1 の残り Step

| Step | 内容 | 仕様行数 | 実装行数 | 並列 |
|------|------|---------|---------|------|
| 1-2 | パーサー | ~109 | ~495 | ✅ |
| 1-3a | Scene 1 | ~128 | ~390 | ✅ |
| 1-3b | Scene 2 | ~106 | ~328 | ✅ |
| 1-3c | Scene 3 | ~211 | ~943 | ✅ |
| 1-3d | Scene 4 | ~216 | ~527 | ✅ |
| 1-4 | 技術スタック | ~100 | 設定ファイル群 | ✅ |

**全 Step が互いに独立** — 同一メッセージ内で最大6並列起動可能。

### バッチ分割（保守的運用の場合）

| バッチ | Step | 理由 |
|--------|------|------|
| Batch 1 | 1-2, 1-3a, 1-3b, 1-4 | コンテキスト軽量（各500行以下） |
| Batch 2 | 1-3c, 1-3d | コンテキスト重め（各700-1100行） |

### Stage 間の依存関係

| Stage | 先行依存 | 並列可否 |
|-------|---------|---------|
| 1 | なし | - |
| 2 | なし | Stage 1 と並列可能（ただしFBサイクルの都合上、逐次推奨） |
| 3 | なし | 同上 |
| 4 | なし | 同上 |
| 5 | **Stage 1-4 全完了** | 逐次のみ |

---

## 5. 転記手順

サブエージェントの出力を `CODE_REVIEW_BOARD.md` に反映する手順。

### 5.1 チェック項目の更新

サブエージェントの「チェック結果サマリー」テーブルに基づき、レビューボードのチェックリストを更新する:

- `整合 ✅` → `- [x] {項目} → **整合 ✅**`
- `概ね整合 ⚠️` → `- [x] {項目} → **概ね整合 ⚠️ → #{findingRef}**`
- `不整合 ❌` → `- [x] {項目} → **不整合 ❌ → #{findingRef}**`

### 5.2 発見事項の追記

サブエージェントの「発見事項テーブル」と「発見事項詳細」を、レビューボードの該当 Stage の「発見事項」セクションに追記する。フォーマットは Step 1-1 の記載に準拠する。

### 5.3 セッションログの追記

```markdown
### Session N (YYYY-MM-DD)
- **実施内容:** Step {stepId}（{stepTitle}）の整合性チェック
- **手法:** サブエージェント `review-checker` による自動チェック
- **結果:** {n}項目中、整合{n}件 / 概ね整合{n}件 / 不整合{n}件
- **発見事項:** {id: severity} のリスト
- **次回アクション:** {次のStep or ユーザーフィードバック待ち}
```

---

## 6. フィードバックループ

### 6.1 再評価テンプレート

ユーザーフィードバックに基づきサブエージェントを `resume` で再開する際の追加指示:

```markdown
## 再評価指示

### ユーザーフィードバック
{ユーザーのフィードバック内容をそのまま転記}

### 更新要求
- #{findingId}: {変更内容の要約}（例: 影響度をMediumに格上げ、追加シナリオの検証）

### 追加検証事項（あれば）
{追加で検証すべきシナリオやファイルの指定}

前回の分析を踏まえ、上記フィードバックを反映した**完全なレポート**を再出力してください。
更新があった箇所には分析テキスト内に「**[更新]**」プレフィックスをつけてください。
```

### 6.2 フィードバックの分類

| フィードバック種別 | 対応方法 |
|----------------|---------|
| 影響度の変更 | resume で再評価、レビューボードを更新 |
| 追加シナリオの検証依頼 | resume で追加分析、発見事項詳細に追記 |
| 判定結果への異議 | resume で再評価、根拠を補強して再判定 |
| 仕様の意図の補足 | 発見事項の「仕様Gap」セクションに補足を追記（メインセッションで直接編集可） |

---

## 7. 使用例（メインセッションでの操作イメージ）

### 7.1 並列起動

```
// Step 1-2 と 1-3a を並列起動
Agent(review-checker, prompt="[Step 1-2 の起動指示]", run_in_background=true)
Agent(review-checker, prompt="[Step 1-3a の起動指示]", run_in_background=true)
```

### 7.2 結果受信後の転記

```
// サブエージェントの結果をパースし、CODE_REVIEW_BOARD.md に反映
// → Edit ツールでチェックリスト更新 + 発見事項追記
```

### 7.3 フィードバック後の再評価

```
// 同じエージェントを resume で再開
Agent(review-checker, resume={agentId}, prompt="[再評価指示テンプレート]")
```
