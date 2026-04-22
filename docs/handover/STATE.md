# プロジェクトステート
最終更新: 2026-04-22 / 移行セッション（旧方式 → 新方式への移行時に、既存 SESSION_HANDOVER.md + ARCHITECT_HANDOVER.md + DECISION.md を統合して作成）

## 現在のフェーズ
Implementation（Phase 3.5 進行中：Critical 2件完了、High/Medium/Low 未着手、SA 対応待ち3件）

## 前回セッションの結果
- **ロール:** PM (Session #2)
- **成果:**
  - E-1 (CR-1: `src/core/calculator.ts` 固有スキルフェーズ制限) 完了・検証済み
  - E-2 (CR-2: `src/core/parser/emojiParser.ts` 減算 Fix Round 1 + `standardParser.ts` Round 2) 完了・検証済み
  - `docs/ROADMAP.md` に Phase 3.5 セクション新設、3.5.1/3.5.2 完了マーク
  - `docs/management/BOARD.md` に CR-2b（Round 2）および CR-38（history 残存問題）を新規登録
  - Engineer 成果物（src/、work_logs/ 2件、PM 管理系 docs 5件）をすべて本移行セッションで3コミットに整理してコミット完了
- **未解決事項:**
  - CR-SA-1（tech-stack.md + parser-system.md 仕様乖離約15件）、CR-SA-2（UI 仕様・複合固有スキル矛盾約19件）、CR-38（history 残存問題）の3件が **SA 対応待ち**。詳細は下記「エスカレーション」参照。
  - Phase 3.5 残タスク: High Engineer CR-3〜CR-8（6件）、Medium CR-9〜CR-24（16件）、Low CR-25〜CR-37（13件）、設計改善 CR-I-1〜5（Low）。SA 対応完了後に着手。

## 次回アクション
- **ロール:** System Architect
- **内容:**
  1. 本 STATE.md のエスカレーションセクション（CR-SA-1 / CR-SA-2 / CR-38）を精査し、それぞれ Accept / Modify / Reject を判断する。
  2. `docs/REQUIREMENTS.md` および `docs/specs/` 配下の該当ファイル（`architecture/tech-stack.md`, `architecture/parser-system.md`, `ui/modal-houserule.md`, `logic/houserule-features.md`, `logic/basic-rules.md` 等）を更新する。
  3. 本 STATE.md のエスカレーション状態を「対応済み」に更新し、判定結果と REQUIREMENTS.md への変更サマリーをコンテキストに追記する。
  4. Architect セッション終了後、新 PM セッションで Step 0 から再開（エスカレーション対応済みを確認し、High Engineer タスクの選定に進む）。

## エスカレーション

### CR-SA-1: tech-stack.md + parser-system.md 仕様乖離（約15件）
- **Issue:**
  - `docs/specs/architecture/tech-stack.md` §A State Management が「React Context API + useReducer」と記載 → 実態は Zustand（`useRaceStore`）
  - `tech-stack.md` §B Directory Structure が `core/calculator/` サブツリー想定 → 実態は `src/core/calculator.ts` 単一ファイル。`parser/implementations/` 構造も実態と差異
  - `tech-stack.md` §B の `docs/` 配下記述が ARCHITECT_HANDOVER.md のみ → 現行の `APP_FLOW.md`, `specs/`, `management/`, `ideas/` 等が欠落
  - `docs/specs/architecture/parser-system.md` Interface が `parse(text, context: 'RACE' | 'PACE')` → 実態は `'JUDGMENT'` コンテキストも存在（`APP_FLOW.md` §5 と不整合）
  - `parser-system.md` に EmojiParser の減算仕様（`-🎲`, 複数行 `合計:` 減算, `Fix-dice` 対応）が未反映（CR-2 / CR-2b の成果物が spec 側に未反映）
- **Context:** コードレビュー特別作業（`docs/REVIEW_AGENT_GUIDE.md` 準拠、stash に退避中の `docs/CODE_REVIEW_BOARD.md` Step 5-3 カテゴリS「仕様書更新27件」）で抽出された項目を統合。PM#2 セッション内で CR-SA-1 として登録済み。
- **Suggested Fix:** `tech-stack.md` / `parser-system.md` を実態（Zustand 採用、平坦ディレクトリ、3種 Parser コンテキスト、EmojiParser 減算仕様）に合わせて全面更新。
- **状態:** 未対応

### CR-SA-2: UI 仕様・複合固有スキル制約の仕様矛盾（約19件）
- **Issue:**
  - `docs/specs/ui/modal-houserule.md` §1「複合固有スキルは連続する2フェーズが原則、非連続ならクリティカルエラーでブロック」
  - `docs/specs/logic/houserule-features.md` §2「警告レベル・3つ以上含め柔軟許容」
  - 上記2ファイルで複合固有スキルの発動フェーズ制約の記述が**相反**している
  - その他、UI 仕様（`scene1-setup.md` 等）の実装整合性と、「双方調整(X)」の仕様決定、`validator.ts` の責務設計などが未確定
- **Context:** Step 5-3 カテゴリX（双方調整5件）+ カテゴリB（UI 関連不具合）を統合。PM#2 セッション内で CR-SA-2 として登録済み。
- **Suggested Fix:** `modal-houserule.md` と `houserule-features.md` の複合固有スキル制約を一本化（推奨: どちらの運用を正とするかユーザーに確認）。`validator.ts` の責務を仕様書で明文化する。
- **状態:** 未対応

### CR-38: history 残存問題（致命的・進行ブロック）
- **Issue:** 固有スキル発動位置を Mid2 → Mid1 に変更した場合、旧 history が残り Mid2 再到達時に進行ブロックされる。ユーザー操作での回復手段が現状なし。
- **Context:** `work_logs/2026-03-06_unique-skill-phase-restriction.md` で Engineer が `[ESCALATION REQUIRED]` として報告。PM#2 で BOARD.md に CR-38 として新規登録。
- **Suggested Fix:** `docs/specs/logic/basic-rules.md` §6「途中修正運用ルール」に「固有タイプ修正時の history 挙動（自動クリア / 手動リセット / 警告表示など）」を追記。実装方針は SA 判断に委ねる。
- **状態:** 未対応

## コンテキスト（申し送り）

### プロジェクト概要
- オリウマレース集計ツール（クライアントサイドSPA、React 19 + Vite + TypeScript + Zustand + Tailwind CSS）。掲示板レースの GM 業務を支援し、集計負担と計算ミスをゼロにする。
- プロジェクトの Why/コアバリュー（CC-1〜CC-6）: `docs/ideas/DECISION.md` および `docs/REQUIREMENTS.md` §1 参照。

### Phase 3.5 の進行概要（旧 PM#2 計画）
旧 SESSION_HANDOVER.md では「PM#1(済) → E-1(済) → PM#2(済) → E-2(済) → **SA対応** → 新 PM セッションで High Engineer タスク開始」と記載されていた。本移行後、新方式では PM セッション冒頭で本 STATE.md を読み込み Step 1 で都度方針決定する。

### BOARD.md の Issue 番号体系
- Engineer: CR-1〜CR-37（+ CR-2b = Round 2）、CR-38（history 残存）
- SA: CR-SA-1 / CR-SA-2
- 設計改善: CR-I-1〜5（Low 優先度）
- Phase 4 ルート: P4-1〜P4-8

### 技術的申し送り（Engineer CR-2 work_log より）
- `ParsedLine` 型に `isSubtractive` フィールドが存在せず、`diceResult` を負数化することで減算を吸収している設計。
- 将来的に検算ロジック（絶対値比較など）を含めて再確認推奨 → 設計改善タスク化の余地あり（Low 優先度）。

### 本移行セッションでの特記事項
- **方式移行:** 旧方式（`.agent/rules/` + `docs/SESSION_HANDOVER.md` + `docs/ARCHITECT_HANDOVER.md` + `docs/ESCALATION_TO_ARCHITECT.md` の多ファイル運用）→ 新方式（`guidelines/` + `docs/handover/STATE.md` 一元管理）。
- 旧 `SESSION_HANDOVER.md` と `ARCHITECT_HANDOVER.md` は `docs/_archived/` にアーカイブ（参照専用）。
- **特別作業の分離:** コードレビュー特別作業ドキュメント（`docs/CODE_REVIEW_BOARD.md`, `docs/FINDINGS_CONSOLIDATED.md`, `docs/REVIEW_BOARD.md`, `docs/REVIEW_AGENT_GUIDE.md`）は通常ワークフロー外のため**本移行の対象外**。変更分（`CODE_REVIEW_BOARD.md` +1924 行、`FINDINGS_CONSOLIDATED.md` untracked）は移行前に `git stash push -u` で退避済み（`stash@{0}: WIP: review work artifacts + migration investigation reports`）。移行完了後に `git stash pop` で復元し、別軸で扱う。
- 移行時の調査レポート 3 本（`_resume_report_mgmt.md`, `_resume_report_review.md`, `_resume_report_specs.md`）も同 stash に含まれる。参考資料として保持するか削除するかは移行完了後にユーザーと合意する。

### 参照ドキュメント
- `docs/REQUIREMENTS.md` — 要件定義（インデックス + 横断的制約 CC-1〜CC-6、SA 管轄）
- `docs/APP_FLOW.md` — アプリケーションフロー図（SA 管轄）
- `docs/specs/` — 技術仕様書群（SA 管轄）
- `docs/ideas/DECISION.md` — プロジェクトの Why・コアバリュー（CA 管轄）
- `docs/management/BOARD.md` — Issue トラッキング（PM 管轄）
- `docs/ROADMAP.md` — ロードマップ（PM 管轄）
- 詳細なコードレビュー成果物: stash 復元後の `docs/CODE_REVIEW_BOARD.md` Step 5-3、`docs/FINDINGS_CONSOLIDATED.md`
