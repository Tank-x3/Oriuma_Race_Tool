# Architect Handover (to PM & Engineer)
Date: 2026-01-22
Author: System Architect

## 1. Summary of Changes
88-ch掲示板のダイス出力（複数行形式）に対応するため、`REQUIREMENTS.md` の技術要件を更新しました。
これにより、既存の行単位パーサー（StandardParser）とは異なる、**ブロック単位の解析ロジック（EmojiParser）** の実装が必要となります。

## 2. Deliverables (Output)
*   **Requirements:** `docs/REQUIREMENTS.md` (Updated)
    *   Added: `C. Architecture > 1. Parser Plugin System > B. EmojiParser`
    *   定義変更: 88-ch形式の定義を「絵文字除去」から「ブロック単位での複数行解析」へ変更。
*   **Backup:** `docs/management/BACKUP/REQUIREMENTS_v2_before_parser_update.md`

## 3. Instructions for Engineer
以下の手順で実装・修正を行ってください。

### Priority 1: 88-ch Parser Implementation
*   **Target:** `src/core/parser/implementations/EmojiParser.ts` (or equivalent)
*   **Logic:**
    *   `src/core/parser/index.ts` (Factory) にて、入力テキストに `🎲` が含まれる場合は `EmojiParser` を使用するように分岐させる。
    *   **Parsing Logic:** `REQUIREMENTS.md` の定義に従い、正規表現を用いた単純な行マッチングではなく、**Statefulなループ処理（行を舐めてヘッダーと合計行を紐付ける処理）** を実装する。
*   **Test Data:**
    *   `docs/USER_REVIEW.md` に記載されている出力例を使用し、正しくパースできるか（特に「名前」と「合計値」の抽出）を検証する。 Test Driven Development (TDD) 推奨。

### Priority 2: Scene 3 Error UI (Follow-up)
*   User Reviewにて指摘された「エラーメッセージのUI改善（Toast廃止、常設エリア化）」を実施する。
*   実装イメージは `REQUIREMENTS.md` の `Scene 1 Notification Area` の記述を参照（Scene 3も同様のUXとする）。

## 4. Message to PM
*   要件定義の更新（Parser v2.0）が完了しました。
*   これにて **Phase 2.4 (Scene 3) のリジェクト要因（88-ch対応不可）** に対する技術的な解決策が提示されました。
*   次回のEngineerセッションにて実装・検証を行ってください。
