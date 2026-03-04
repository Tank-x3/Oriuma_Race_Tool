# REQUIREMENTS.md — オリウマレース集計ツール

> **管轄:** System Architect
> **役割:** 全specファイルへの入口（インデックス）と、全仕様に共通する横断的制約（ガードレール）を定義する。
> **プロジェクトのWhyとコアバリュー:** [`docs/ideas/DECISION.md`](ideas/DECISION.md) を参照のこと。

## プロジェクト概要

掲示板（あにまん掲示板形式等）で行われる「オリウマレース」のGM業務を支援し、集計負担と計算ミスをゼロにするためのクライアントサイドSPAツール。

**運用前提:** 本ツールは「GMが全てのダイスを管理・投稿・集計する」ことを前提とする。参加者が個別にダイスを振る運用は想定しない。

---

## §1 横断的制約（Cross-Cutting Constraints）

全specファイルに共通して適用される実装上のガードレール。
個別specファイルからは `> 横断的制約: REQUIREMENTS.md を併読のこと` として参照される。

---

### CC-1: コピペ運用の強制（Copy & Paste Oriented）

- **数値の直接手入力は原則禁止。** レース進行中（Scene 2〜4）において、ダイス結果・スコアを手入力するUIは設けない。
- 掲示板のレステキストを貼り付けるだけで解析・計算が完結するUXを提供する。
- 設定・登録フェーズ（Scene 1、ハウスルール設定）での入力欄は例外として許容する。

### CC-2: 厳格なバリデーション（Strict Validation & Specific Feedback）

- **推測処理の禁止:** ツールは曖昧なデータを補完・推測して処理してはならない。
  - 例: ダイス個数とX値の不一致、内訳合計とTotalの不一致、行数の過不足が検知された場合は必ずエラーとする。
- **修正の方向:** 不整合時はツール側での数値修正を求めず、正しいデータの再入力（貼り直し）を促す。
  これによりデータの正当性（改ざんがないこと）を担保する。
- **エラーメッセージのトーン:**
  - GMを萎縮させる・責める表現は禁止。
  - 「何が問題か」と「どう解決するか」を具体的に提示すること。
  - 良い例: `3行目のダイス合計値が一致しません。コピー範囲が途切れていないか確認してください`
  - 悪い例: `入力エラー`、`無効なデータです`

### CC-3: 複雑性の自動解決（Automated Complexity）

- 「捲り/溜め」のような「現在の行動が将来のターンに影響する」処理は、システム側で完全自動化する。
- 「着差判定（同着・ハナ・アタマ・クビ）」のロジックはシステムが自動処理する。
- GMが記憶に頼って補正を行う設計は禁止。ヒューマンエラーをシステム的に防ぐ責務をツールが持つ。

### CC-4: 段階的開示（Progressive Disclosure）

- **デフォルト状態:** 基本ルールに則ったシンプルなUIのみを表示する。初心者GMが追加設定なしで操作できること。
- **オプション展開:** ハウスルール設定を有効化したときのみ、高度な編集機能・例外処理UIが開放される。
- デフォルトOFFの機能を、ユーザーが意図せず有効にしてしまう設計は禁止。

### CC-5: スケーラビリティ要件（Scalability & Flexibility）

- **規模:** 1人（単走）から最大 **100人** 規模まで、パフォーマンスを落とさず処理できること。
- **Parser拡張性:** 将来的な掲示板の仕様変更や他サイト対応のため、Parserを差し替え・追加できる構造を維持する。
  コアロジック（計算機）側に影響を与えずにParser層のみ変更可能であること。

### CC-6: アクセシビリティの除外スコープ（Accessibility Scope）

- 初期リリースにおいて、スクリーンリーダー対応およびキーボードナビゲーション完全準拠は **要件に含まない**。
- 将来的なアップデートでの対応を検討する。これを理由にUI実装を過度に複雑化させないこと。

---

## §2 仕様インデックス（Specification Index）

各specファイルには `> 横断的制約: REQUIREMENTS.md を併読のこと` が記載されている。
本ドキュメントの制約（§1）は全specに共通して適用される。

---

### コンセプト・意思決定

| ファイル | 内容 |
|---|---|
| [`ideas/DECISION.md`](ideas/DECISION.md) | プロジェクト目標・コアバリューの「Why」。Concept Architect 管轄。 |

### UI仕様（specs/ui/）

| ファイル | 内容 |
|---|---|
| [`specs/ui/scene1-setup.md`](specs/ui/scene1-setup.md) | Scene 1: レース設定・出走者登録 |
| [`specs/ui/modal-houserule.md`](specs/ui/modal-houserule.md) | Modal: ハウスルール設定（脚質エディタ・プリセット管理） |
| [`specs/ui/scene2-gate.md`](specs/ui/scene2-gate.md) | Scene 2: 枠順抽選 |
| [`specs/ui/scene3-race.md`](specs/ui/scene3-race.md) | Scene 3: レース進行（ダイス入力・スコア計算） |
| [`specs/ui/scene4-judgment.md`](specs/ui/scene4-judgment.md) | Scene 4-A: 着差判定 |
| [`specs/ui/scene4-result.md`](specs/ui/scene4-result.md) | Scene 4-B: 最終リザルト・画像生成 |

### ロジック仕様（specs/logic/）

| ファイル | 内容 |
|---|---|
| [`specs/logic/basic-rules.md`](specs/logic/basic-rules.md) | 基本ルール・デフォルト脚質データ・フェーズ別ダイス定義 |
| [`specs/logic/scoring-and-judgment.md`](specs/logic/scoring-and-judgment.md) | スコアリング・着差判定（同着・ハナ・アタマ・クビ）ロジック |
| [`specs/logic/houserule-features.md`](specs/logic/houserule-features.md) | ハウスルール機能（捲り/溜め・複合固有スキル・汎用補正） |

### アーキテクチャ仕様（specs/architecture/）

| ファイル | 内容 |
|---|---|
| [`specs/architecture/parser-system.md`](specs/architecture/parser-system.md) | Parser設計・あにまん形式・絵文字形式の解析仕様 |
| [`specs/architecture/image-generation.md`](specs/architecture/image-generation.md) | html2canvas を使用したリザルト画像生成戦略 |
| [`specs/architecture/tech-stack.md`](specs/architecture/tech-stack.md) | 技術スタック・ディレクトリ構造・実装ガイドライン |

---

## §3 変更履歴（Changelog）

| 日付 | 変更内容 |
|---|---|
| 2026-03-04 | §1〜§4を13個のspecファイルに切り出し完了。本ファイルをインデックス＋横断的制約のみに再構成（1067行→約108行）。 |
| 2026-01-22 | 初版作成。 |
