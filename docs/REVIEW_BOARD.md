# Stage 0: ドキュメント整理 レビューボード

## 現在のステップ
**Step 0-3: 実作業チェックリスト作成** — 方針確定、作業リスト策定完了

---

## Step 0-1: ドキュメント棚卸し結果

### 分類凡例
- **Active** — 現在も参照・更新される正式ドキュメント
- **Legacy** — 4層フロー導入前の遺物。整理対象
- **Duplicate** — 他ファイルと内容が重複
- **Uncertain** — 役割・鮮度が不明。要確認

| # | ファイル | 分類 | 概要 | 備考 |
|---|---------|------|------|------|
| 1 | `docs/REQUIREMENTS.md` | **Active** | 要件定義書（1066行）。全仕様が単一ファイルに集約 | 4セクション構成: Goal, UI/UX(Scene1-4), FuncReq, TechStack。**肥大化が最大の課題** |
| 2 | `docs/ROADMAP.md` | **Active** | 開発ロードマップ。Phase1-3完了、Phase4-5未着手 | PM管轄。4層フロー準拠。問題なし |
| 3 | `docs/ARCHITECT_HANDOVER.md` | **Active (Stale)** | Architect→PM/Engineer引継書。2026-01-22付 | 内容はParser v2.0対応時のもの。**最新ではない**（2/8のエスカレーション対応後に更新されていない） |
| 4 | `docs/SESSION_HANDOVER.md` | **Active (Stale)** | PMセッション引継書。2026-02-08付 | 最新セッションの引継ぎ。次回Phase4開始用。問題なし |
| 5 | `docs/TASK_INSTRUCTION.md` | **Active (Stale)** | PM→Engineerタスク指示書 | 2/8のダイス解析バグ修正指示が残存。完了済みタスクの残骸 |
| 6 | `docs/USER_REVIEW.md` | **Active (Stale)** | Engineer→User動作確認依頼 | 2/8のバグ修正レビュー。完了済み。フィードバック記入済み |
| 7 | `docs/PM_BOARD.md` | **Legacy** | 旧PMホワイトボード | 4層フロー導入前の遺物。Scene2対応時の記述で停止。`management/BOARD.md` に統合済み |
| 8 | `docs/implementation_plan.md` | **Legacy** | Phase 3.1実装計画書 | 4層フロー導入前にEngineerが直接作成したもの。完了済み。ファイル名もルール外 |
| 9 | `docs/DEPLOYMENT_GUIDE.md` | **Duplicate** | CI/CDの解説ガイド（初心者向け） | ユーザー教育用ドキュメント。`management/DEPLOY_GUIDE.md` と**重複** |
| 10 | `docs/SCENE1_UX_REVIEW.md` | **Legacy** | Scene1のUXレビューボード | 4層フロー導入前のレビュー記録。全課題「対応済み」。歴史的資料のみ |
| 11 | `docs/REQUIREMENT_UPDATE_REQUEST.md` | **Legacy** | PM→Architectへの要件更新依頼 | 4層フロー導入前の形式。現在は`ESCALATION_TO_ARCHITECT.md`が正式経路。内容は全て対応済み |
| 12 | `docs/management/BOARD.md` | **Active** | PM管理ボード（現行） | Closed Betaフィードバック管理。全課題対応済み。次Phase4の計画あり |
| 13 | `docs/management/DEPLOY_GUIDE.md` | **Duplicate** | 簡易デプロイガイド（コマンド集） | #9と内容重複。こちらの方がコンパクトで実用的 |
| 14 | `docs/management/BACKUP/` (14files) | **Mixed** | REQUIREMENTS/ROADMAP/BOARD等のバックアップ群 | Architect用バックアップが`management/`内に混在。ルール上は`specs/BACKUP/`に置くべき |
| 15 | `docs/USER_TEMP/` | **Uncertain** | 空のテキストファイル1つのみ | ユーザー作業用フォルダ？内容なし |

### REQUIREMENTS.md 内部構造（1066行）

| セクション | 行範囲 | 内容 |
|-----------|--------|------|
| `## 1. Project Goal & Core Value` | L1-33 | プロジェクト目標、コアバリュー（コピペ運用、厳格検証等） |
| `## 2. UI/UX Design (Wireframe)` | L34-664 | **最大セクション**。Scene1-4のワイヤーフレーム+仕様詳細 |
| ├ `### Scene 1: Setup & Entry` | L36-136 | レース設定・エントリー登録 |
| ├ `### Modal: House Rule` | L137-222 | ハウスルール設定モーダル（未実装） |
| ├ `### Scene 2: Gate Lottery` | L223-307 | 枠順抽選 |
| ├ `### Scene 3: Progression` | L308-491 | レース進行メインループ |
| ├ `### Scene 4-A: Judgment` | L492-583 | 判定割り込み |
| └ `### Scene 4-B: Final Output` | L584-664 | 最終結果確定 |
| `## 3. Functional Requirements` | L665-984 | 機能要件（データ/ロジック、ハウスルール、アーキテクチャ） |
| ├ `### A. Data & Logic` | L667-801 | 基本ルール（脚質、ダイス、スコア計算、パーサー） |
| ├ `### B. House Rule & Advanced` | L802-891 | 拡張機能仕様（未実装部分多数） |
| └ `### C. Architecture` | L892-984 | Parser Plugin System、テスト方針 |
| `## 4. Technical Stack & Directory` | L985-1066 | 技術スタック、ディレクトリ構造、実装ガイドライン |

---

## Step 0-2: 構造設計

### 設計原則
1. **AI最適化**: 各エージェントが「今必要な情報だけ」を1-2ファイル読めば作業に着手できる粒度にする
2. **4層ルール準拠**: 各ロール（Concept/Architect/PM/Engineer）の管轄ディレクトリを正しく分離する
3. **インデックスによるナビゲーション**: REQUIREMENTS.mdを「目次+横断的関心事」の役割に変え、詳細は個別specファイルに委譲する

### 提案: ディレクトリ構成（After）

```
docs/
├── ideas/                              # [Concept Architect 管轄]
│   └── DECISION.md                     # プロジェクト目標・コアバリュー・UX方針
│                                       #   (現REQUIREMENTS §1 から切り出し)
│
├── REQUIREMENTS.md                     # [System Architect 管轄] ★スリム化
│                                       #   → 「インデックス + 横断的制約」のみ
│                                       #   → 各specファイルへのリンク集
│                                       #   → 目標: 100-150行以内
│
├── specs/                              # [System Architect 管轄] 詳細仕様群
│   ├── ui/                             #   UI/UX仕様（Scene別）
│   │   ├── scene1-setup.md             #     Scene 1: レース設定 & エントリー
│   │   ├── scene2-gate.md              #     Scene 2: 枠順抽選
│   │   ├── scene3-race.md              #     Scene 3: レース進行メインループ
│   │   ├── scene4-judgment.md          #     Scene 4-A: 判定割り込み
│   │   ├── scene4-result.md            #     Scene 4-B: 最終結果確定
│   │   └── modal-houserule.md          #     ハウスルール設定モーダル
│   ├── logic/                          #   機能要件・ロジック仕様
│   │   ├── basic-rules.md              #     基本ルール（脚質データ、ペース補正、スコア計算）
│   │   ├── scoring-and-judgment.md     #     スコア合計・着差判定・同着処理
│   │   └── houserule-features.md       #     ハウスルール拡張仕様
│   ├── architecture/                   #   アーキテクチャ・技術仕様
│   │   ├── parser-system.md            #     パーサープラグインシステム
│   │   ├── image-generation.md         #     画像生成戦略
│   │   └── tech-stack.md              #     技術スタック・ディレクトリ構造・実装ガイドライン
│   └── BACKUP/                         #   Architect用バックアップ
│       └── (REQUIREMENTS_*.md等を移動)
│
├── APP_FLOW.md                         # [System Architect 管轄] アプリフロー図（新規作成を検討）
├── ARCHITECT_HANDOVER.md               # [System Architect 管轄] 引継書
│
├── management/                         # [PM 管轄]
│   ├── BOARD.md                        #   課題管理ボード
│   ├── DEPLOY_GUIDE.md                 #   デプロイ手順書（統合版）
│   └── BACKUP/                         #   PM用バックアップ（ROADMAP_*.md等のみ残す）
│
├── ROADMAP.md                          # [PM 管轄]
├── SESSION_HANDOVER.md                 # [PM 管轄]
├── TASK_INSTRUCTION.md                 # [PM 管轄]
├── USER_REVIEW.md                      # [Engineer 管轄]
│
├── archive/                            # [参照専用] レガシードキュメント置き場
│   ├── PM_BOARD.md
│   ├── implementation_plan.md
│   ├── SCENE1_UX_REVIEW.md
│   ├── REQUIREMENT_UPDATE_REQUEST.md
│   └── DEPLOYMENT_GUIDE.md
│
└── USER_TEMP/                          # ユーザー作業用（現状維持）
```

### REQUIREMENTS.md のスリム化方針

**Before:** 1066行の全仕様一体型ドキュメント
**After:** 「インデックス + 横断的制約」（目標100-150行）

#### 残す内容（REQUIREMENTS.mdに維持）
- プロジェクト概要（1-2行のサマリー。Goal詳細はideas/DECISION.mdへ）
- 横断的な設計制約（コピペ運用の徹底、厳格なバリデーション方針など — これはArchitectが各specを書く際の「前提条件」として必要）
- **仕様インデックス**: 各specファイルへのリンクと1行説明
- 仕様変更履歴（Changelog）

#### 切り出す内容
| 現在の場所 | 移動先 | 行数 |
|---|---|---|
| §1 Project Goal & Core Value | `ideas/DECISION.md` | ~33行 |
| §2 Scene 1 UI/UX | `specs/ui/scene1-setup.md` | ~100行 |
| §2 Modal: House Rule | `specs/ui/modal-houserule.md` | ~86行 |
| §2 Scene 2 UI/UX | `specs/ui/scene2-gate.md` | ~85行 |
| §2 Scene 3 UI/UX | `specs/ui/scene3-race.md` | ~183行 |
| §2 Scene 4-A Judgment | `specs/ui/scene4-judgment.md` | ~92行 |
| §2 Scene 4-B Final Output | `specs/ui/scene4-result.md` | ~80行 |
| §3-A Data & Logic | `specs/logic/basic-rules.md` | ~135行 |
| §3-A (Scoring/Judgment部分) | `specs/logic/scoring-and-judgment.md` | ※basic-rulesから更に分離 |
| §3-B House Rule | `specs/logic/houserule-features.md` | ~90行 |
| §3-C Parser System | `specs/architecture/parser-system.md` | ~73行 |
| §3-C Image Generation | `specs/architecture/image-generation.md` | ~18行 |
| §4 Tech Stack & Dir | `specs/architecture/tech-stack.md` | ~82行 |

### AI参照パターン（想定ユースケース）

この構造により、各タスクで読むべきファイルが明確になる:

| タスク例 | 参照ファイル | 行数(推定) |
|---------|------------|-----------|
| Scene 3のUI修正 | `specs/ui/scene3-race.md` | ~183行 |
| パーサーのバグ修正 | `specs/architecture/parser-system.md` | ~73行 |
| 脚質データの追加 | `specs/logic/basic-rules.md` | ~135行 |
| 着差判定ロジック修正 | `specs/logic/scoring-and-judgment.md` | ~60行 |
| ハウスルール実装 | `specs/ui/modal-houserule.md` + `specs/logic/houserule-features.md` | ~176行 |
| 新規Scene実装 | `REQUIREMENTS.md`(横断制約) + 該当`specs/ui/` | ~250行 |

※ 最大でも250行程度。現在の1066行一括読み込みから **60-85%削減**。

### 確定事項（ユーザー承認済み）

- **N1** `ideas/DECISION.md` → 「なぜ(Why)」をConcept側、「どう守るか(How)」をArchitect側に分離
- **N2** `APP_FLOW.md` → Stage 0 の中で新規作成する
- **N3** バックアップ → 4層ロール定義に基づいて仕分け（Architect用は`specs/BACKUP/`、PM用は`management/BACKUP/`）
- **N4** `DEPLOYMENT_GUIDE.md` → 解説セクションを`management/DEPLOY_GUIDE.md`に統合し、元ファイルは`archive/`へ

---

## Step 0-3: 実作業チェックリスト

### Phase A: ディレクトリ作成 & ファイル移動
- [x] A1. `docs/ideas/` ディレクトリ作成
- [x] A2. `docs/specs/ui/` ディレクトリ作成
- [x] A3. `docs/specs/logic/` ディレクトリ作成
- [x] A4. `docs/specs/architecture/` ディレクトリ作成
- [x] A5. `docs/specs/BACKUP/` ディレクトリ作成
- [x] A6. `docs/archive/` ディレクトリ作成
- [x] A7. レガシーファイルを `archive/` に移動（5件: PM_BOARD, implementation_plan, SCENE1_UX_REVIEW, REQUIREMENT_UPDATE_REQUEST, DEPLOYMENT_GUIDE）
- [x] A8. バックアップ仕分け: Architect用（REQUIREMENTS_*4, ESCALATION_*1）→ `specs/BACKUP/`、PM用（ROADMAP_*8, BOARD_*1）→ `management/BACKUP/` 残留
- [x] A9. `USER_TEMP/` — テストデータメモが含まれるため現状維持

### Phase B: REQUIREMENTS.md の分割
- [x] B1. `ideas/DECISION.md` 作成 — §1 の「Why」部分（Project Goal, Core Values のコンセプト部分）を切り出し
- [x] B2. `specs/ui/scene1-setup.md` 作成 — §2 Scene 1 を切り出し
- [x] B3. `specs/ui/modal-houserule.md` 作成 — §2 Modal: House Rule を切り出し
- [x] B4. `specs/ui/scene2-gate.md` 作成 — §2 Scene 2 を切り出し
- [x] B5. `specs/ui/scene3-race.md` 作成 — §2 Scene 3 を切り出し
- [x] B6. `specs/ui/scene4-judgment.md` 作成 — §2 Scene 4-A を切り出し
- [x] B7. `specs/ui/scene4-result.md` 作成 — §2 Scene 4-B を切り出し
- [x] B8. `specs/logic/basic-rules.md` 作成 — §3-A の脚質データ・ペース補正・スコア計算を切り出し
- [x] B9. `specs/logic/scoring-and-judgment.md` 作成 — §3-A のスコア合計・着差判定部分を切り出し
- [x] B10. `specs/logic/houserule-features.md` 作成 — §3-B を切り出し
- [x] B11. `specs/architecture/parser-system.md` 作成 — §3-C Parser部分を切り出し
- [x] B12. `specs/architecture/image-generation.md` 作成 — §3-C Image Generation部分を切り出し
- [x] B13. `specs/architecture/tech-stack.md` 作成 — §4 を切り出し
- [x] B14. `REQUIREMENTS.md` をスリム化 — インデックス+横断的制約のみに再構成（目標100-150行）

### Phase C: 新規ドキュメント作成
- [ ] C1. `docs/APP_FLOW.md` 作成 — Scene間遷移・データ保持・修正フローの図解
- [ ] C2. `management/DEPLOY_GUIDE.md` 更新 — DEPLOYMENT_GUIDE.mdの解説セクションを統合

### Phase D: 整合性検証
- [ ] D1. REQUIREMENTS.md のインデックスリンクが全て正しいことを確認
- [ ] D2. 4層ルール（`.agent/rules/*.md`）内のファイルパス参照が新構造と整合していることを確認・更新
- [ ] D3. 各specファイルが自己完結しているか（他ファイルへの過度な依存がないか）レビュー

### 作業ルール（Phase B）
- Phase B 移行時は新規セッションを開始する
- 1ファイル作成ごとに停止し、ユーザーがトークン数を確認して次の指示を出す
- B14（REQUIREMENTS.md スリム化）は B1-B13 完了後に実施
- セッション途中で区切る場合、セッションログを更新してから終了する

---

## Session Log
*(セッション間の引き継ぎ記録)*

### Session 1 (2026-03-04)
- **実施内容:** Step 0-1（棚卸し）、Step 0-2（構造設計）、Step 0-3（チェックリスト作成）、Phase A（ファイル移動）
- **完了タスク:** Phase A 全完了（A1-A9）。ディレクトリ作成6件、ファイル移動10件（archive5件、specs/BACKUP5件）、USER_TEMP現状維持。
- **次回アクション:** Phase B（REQUIREMENTS.md 分割）を新規セッションで開始。B1 から順に着手。

### Session 2 (2026-03-04)
- **実施内容:** Phase B（REQUIREMENTS.md 分割）B1～B13
- **完了タスク:** B1-B13 全完了。REQUIREMENTS.md の全セクションを個別specファイルに切り出し（計13ファイル作成）。
    - `ideas/DECISION.md` — §1 コンセプト（Why）
    - `specs/ui/` — Scene 1-4 + Modal（6ファイル）
    - `specs/logic/` — 基本ルール / 着差判定 / ハウスルール（3ファイル）
    - `specs/architecture/` — Parser / 画像生成 / 技術スタック（3ファイル）
- **残タスク:** B14（REQUIREMENTS.md スリム化 — インデックス+横断的制約のみに再構成）は次セッションで実施。
- **次回アクション:** B14 → Phase C（新規ドキュメント作成）→ Phase D（整合性検証）

### Session 3 (2026-03-04)
- **実施内容:** Phase B の最終タスク B14（REQUIREMENTS.md スリム化）
- **完了タスク:** B14 完了。REQUIREMENTS.md を1067行→112行に再構成。ヘッダー+横断的制約(CC-1〜CC-6)+仕様インデックス(13 specファイル)+変更履歴の4セクション構成。**Phase B 全完了。**
- **残タスク:** Phase C（C1: APP_FLOW.md作成、C2: DEPLOY_GUIDE.md統合）→ Phase D（整合性検証）
- **次回アクション:** Phase C から着手

---

## User Feedback
*(意見・修正指示・質問などをこちらに記入してください)*

```
[記入欄]
- Q1: 4層ルールとの構造ギャップ
  - 現在のルールに沿った形に情報を切り出して整理
    - 特に`Project Goal & Core Value`は本来Concept段階で定義されるべき
  - 必須扱いでないドキュメントについても、情報量の多く複雑なプロジェクトであることを考慮して切り出し・細分化を検討
- Q2: レガシードキュメントの処置方針
  - A（アーカイブフォルダに移動）を採用したい
  - 稀に「旧ドキュメントに記載されていた対処方法」が今後の仕様変更に影響を与える可能性がある
- Q3: デプロイガイドの重複
  - **`management/DEPLOY_GUIDE.md`**の内容を維持
  - 「どのように操作すればよいか」という手順を維持したい
  - `DEPLOYMENT_GUIDE.md`では、「コードを保存して送るだけで、Webサイトが勝手に更新される」という記述があるが、そもそも「どうやって"送る"のか？」が理解できていない状態だったため、有効に働いていない
  - 統合/削除については要検討

- Q4: REQUIREMENTS.md の分割粒度
  - **関心事別**の分割を検討
  - `docs/specs/`に切り出し、**かつ細分化**して「AIが今実装しようとしている箇所に必要な情報」だけを高精度で取り出しやすくしたい
  - 肥大化したドキュメントを読み込むと、AIが混乱する可能性がある
  - UI仕様（ワイヤーフレーム）の肥大化はやむを得ないが、その分他の情報を極力減らして、より高精度で取り出しやすくしたい
  - 実際に「すでにREQUIREMENTSに明記されているのに実装された内容が正しくない」という事態が多発している

- Q5: 完了済みドキュメント（TASK_INSTRUCTION, USER_REVIEW等）の扱い
  - セッション間の情報共有として次セッションの開始時にはすべて残っている状態が正常
  - 各セッションごとに定義づけられたタイミングで都度更新されるため、特段の対応は不要
  - 削除等は行わない


```

---

## Discussion / Open Questions

### Q1: 4層ルールとの構造ギャップ
4層ルールが期待するディレクトリ vs 現状:

| 期待（ルール定義） | 現状 | 状態 |
|---|---|---|
| `docs/ideas/` (Concept Architect) | 存在しない | 未作成（Concept段階をスキップして開発された） |
| `docs/ideas/BOARD.md` | 存在しない | 同上 |
| `docs/ideas/DECISION.md` | 存在しない | 同上 |
| `docs/specs/` (技術仕様分割先) | 存在しない | REQUIREMENTS.md に全集約 |
| `docs/specs/BACKUP/` (Architect用) | `management/BACKUP/` に混在 | バックアップの管轄が不明確 |
| `docs/APP_FLOW.md` | 存在しない | 任意（作成は必須ではない） |
| `docs/ESCALATION_TO_ARCHITECT.md` | 存在しない | 正常（処理済みはBACKUPに移動するため） |
| `docs/ARCHITECT_FEEDBACK.md` | 存在しない | 正常（必要時のみ作成） |

### Q2: レガシードキュメントの処置方針
以下のファイルは全て4層フロー導入前の遺物:
- `PM_BOARD.md` → `management/BOARD.md` に統合済み
- `implementation_plan.md` → 完了済み実装計画
- `SCENE1_UX_REVIEW.md` → 全課題対応済み
- `REQUIREMENT_UPDATE_REQUEST.md` → 全内容対応済み

**選択肢:**
- A) `docs/archive/` に移動して保存
- B) `management/BACKUP/` にまとめて移動
- C) 削除（gitに履歴が残る）

### Q3: デプロイガイドの重複
`DEPLOYMENT_GUIDE.md`（教育向け解説）と `management/DEPLOY_GUIDE.md`（コマンド集）が重複。
- 統合するか、片方を削除するか？

### Q4: REQUIREMENTS.md の分割粒度
1066行の巨大ファイルをどう分割するか。候補:
- **Scene単位分割**: Scene1/2/3/4 の UI/UX仕様を個別ファイルに
- **関心事分割**: UI仕様、機能要件、技術仕様を分離
- **ハイブリッド**: コア要件（Goal + 基本ルール）はREQUIREMENTS.mdに残し、Scene別UI仕様とHouseRule仕様を `docs/specs/` に切り出し

### Q5: 完了済みドキュメント（TASK_INSTRUCTION, USER_REVIEW等）の扱い
これらは「前回のセッション成果物」が残っている状態。
- 4層ルール上、TASK_INSTRUCTIONは毎回上書き → 問題なし（次回PMセッションで上書きされる）
- USER_REVIEWも同様
- **ただし、次回セッション開始までのこの中間状態は正常**
