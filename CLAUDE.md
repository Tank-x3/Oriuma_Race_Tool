> ## ⚠️ TRIAGE モード中（2026-04-22 開始）
>
> 進捗管理が混乱しており、状況整理を最優先で行っている。
> **本ブロックが残っている間は、通常ワークフロー上の作業を全面停止する。**
>
> - **最優先ドキュメント:** `docs/handover/TRIAGE.md`。他の全てのハンドオーバー／管理ドキュメント（STATE.md / BOARD.md / ROADMAP.md / CODE_REVIEW_BOARD.md 等）より優先して参照すること。
> - **全面禁止される作業:** 実装・テスト修正・仕様書編集・ロードマップ更新・PM ボード更新・コードレビュー進行・コミット作成など、通常ロール（Concept Architect / System Architect / PM / Engineer）としての成果物更新・前進作業は一切禁止。
> - **唯一許可される作業:** `docs/handover/TRIAGE.md` の整備・更新と、TRIAGE を進めるために必要な調査・対話・既存ドキュメントの読み取りのみ。`TRIAGE.md` の更新以外でファイルを新規作成・編集することは原則禁止。
> - **ロール指定があっても TRIAGE が優先:** ユーザーが「PM ロールで作業開始」等と指示しても、まず `docs/handover/TRIAGE.md` を読み、TRIAGE 作業を継続する。通常ロール業務への復帰は解除後。
> - **解除条件:** `docs/handover/TRIAGE.md` 冒頭の「TRIAGE 解除条件」を全て満たし、**ユーザーが明示的に「TRIAGE 解除」と宣言したとき**のみ、本ブロックを CLAUDE.md から削除してよい。AI 側判断での解除は禁止。
>
> セッション開始時は `docs/handover/STATE.md` より先に `docs/handover/TRIAGE.md` を読むこと。

---

# race — オリウマレース集計ツール

掲示板（あにまん掲示板形式等）で行われる「オリウマレース」のGM業務を支援し、集計負担と計算ミスをゼロにするためのクライアントサイドSPAツール。

## セッションモデル
本プロジェクトは4つの専門ロールがリレー形式で連携する。ロールごとに独立したセッションで作業を行う。

| ロール | 指示ファイル | 責務 |
|-------|------------|------|
| Concept Architect | `guidelines/concept-architect.md` | アイデア発散・UX設計 |
| System Architect | `guidelines/system-architect.md` | 要件定義・技術設計 |
| PM | `guidelines/pm.md` | タスク管理・進行管理 |
| Engineer | `guidelines/engineer.md` | 実装・検証 |

### ロールの開始方法
ユーザーがロール名を指定してセッションを開始する（例:「PMロールで作業開始」）。
指定されたロールの指示ファイル（`guidelines/<ロール名>.md`）を読み込み、その内容に従って作業を行うこと。

### プロジェクト状態の確認
セッション開始時に `docs/handover/STATE.md` を読み込み、プロジェクトの現在の状態を把握すること。

## 共通ルール
- **セッション終了はユーザー主導。** AI側からセッション切り替えを促すことは全ロールで禁止。
- **Docs First:** 全ての決定をドキュメントに記録する。チャットでの合意のみはNG。
- **バックアップはgitで管理。** セッション完了時にユーザーの承認を得てからコミットする。
- 全てのドキュメントは**日本語**で記述する。

## 移行・セットアップ
旧方式からの移行時は `C:\Gemini_Temp\Guideline\templates\MIGRATION_GUIDE.md` を読み込み、手順に従って実施すること。

## プロジェクト固有情報

### Tech Stack
- **Frontend:** React 19 + TypeScript 5.9
- **Build:** Vite 7（開発サーバー・本番ビルド）
- **State Management:** Zustand 5（`useRaceStore` による一元管理）
- **Styling:** Tailwind CSS 3.4 + clsx + tailwind-merge
- **Image Generation:** html2canvas 1.4（結果画面のOGP画像生成）
- **Icons:** lucide-react
- **Testing:** Vitest 4
- **Lint/Format:** ESLint 9 + TypeScript-ESLint

### ディレクトリ構成
```
race/
├── CLAUDE.md                     本ファイル
├── guidelines/                   4ロール指示書
│   ├── concept-architect.md
│   ├── system-architect.md
│   ├── pm.md
│   └── engineer.md
├── docs/
│   ├── REQUIREMENTS.md          要件定義（SA管轄、インデックス+横断的制約）
│   ├── APP_FLOW.md              アプリフロー図（SA管轄）
│   ├── ROADMAP.md               ロードマップ（PM管轄）
│   ├── USER_REVIEW.md           実装レビュー（Engineer成果物）
│   ├── handover/                セッション引き継ぎ（PM/SA/CA管轄）
│   │   ├── STATE.md             プロジェクトステート（一元管理）
│   │   └── TASK_INSTRUCTION.md  Engineerタスク指示書（PMが作成）
│   ├── management/              PM管理ドキュメント
│   │   └── BOARD.md             Issueトラッキング
│   ├── specs/                   SA管轄の技術仕様書群
│   │   ├── ui/                  Scene毎のUI仕様
│   │   ├── logic/               ルール/スコア計算/ハウスルール仕様
│   │   └── architecture/        Parser/画像生成/技術スタック
│   ├── ideas/                   CA管轄
│   │   └── DECISION.md          プロジェクトの Why・コアバリュー
│   └── _archived/               旧方式のハンドオーバー文書（参照専用）
├── work_logs/                   Engineerの作業ログ（PM向け）
├── src/
│   ├── App.tsx / main.tsx        エントリポイント
│   ├── components/               UIコンポーネント（Scene別）
│   ├── core/                     ドメインロジック
│   │   ├── calculator.ts         スコア計算
│   │   ├── parser/               StandardParser / EmojiParser（掲示板解析）
│   │   └── ...
│   ├── hooks/                    カスタムフック
│   ├── store/                    Zustand ストア
│   ├── types/                    型定義
│   └── utils/                    ユーティリティ
└── ...設定ファイル（eslint.config.js, tsconfig.json, vite.config.ts 等）
```

### 備考
- **運用前提:** GMが全てのダイスを管理・投稿・集計する前提。参加者が個別にダイスを振る運用は想定しない。
- **デプロイ:** GitHub Pages（`npm run build` → 静的ホスティング）。
- **特別作業ドキュメント:** `docs/CODE_REVIEW_BOARD.md` / `docs/FINDINGS_CONSOLIDATED.md` / `docs/REVIEW_BOARD.md` / `docs/REVIEW_AGENT_GUIDE.md` は通常ワークフロー外のコードレビュー特別作業で使用。通常のPMセッションからは参照のみ（編集は別軸で管理）。
- **横断的制約:** 全 spec ファイルは `docs/REQUIREMENTS.md` §1 の CC-1〜CC-6（コピペ運用強制・厳格バリデーション・複雑性の自動解決・段階的開示・スケーラビリティ・アクセシビリティ除外スコープ）に従う。
