                                                                                            # Implement Phase 2.3.5 & 2.4 Review Report

## 概要
本セッションでは、Phase 2.3.5 (Polish) および Phase 2.4 (Race Execution) の基本実装を行いました。
88-ch形式のダイス解析に関する不具合修正を含め、基本的なレース進行機能の実装が完了しています。
Scene 3の高度な機能（特殊戦法、Undo履歴、実況補助等）については、ロードマップ管理上の判断により本セッションでの実装を見送り、次フェーズ以降の課題としています。

## 実装内容 (Completed Items)

### 1. Phase 2.3.5 (Polish / Bug Fixes)
*   **Scene 1 (Setup):** `midPhaseCount` 変更時に、連動して無効になる「固有スキル発動フェーズ」のリセットロジックを実装。
*   **Scene 2 (Gate):**
    *   エントリー確認リストの用語を日本語化（Start/Mid/End -> 序盤/中盤/終盤 等）。
    *   ダイス出力テンプレートの区切り文字を全角スペース(`　`)に変更。
*   **Parser (Core):**
    *   `ParserFactory` の導入（自動形式判定）。
    *   `EmojiParser` (88-ch, `🎲`対応) の実装。
    *   **[Critical Fix]** 88-ch形式における「名前への絵文字混入」「`=`前後のスペースによる解析失敗」を修正するため、`StandardParser` の正規表現を強化。

### 2. Phase 2.4 (Race Execution - MVP)
*   **Component Structure:** `RaceScene` を実装し、`useRaceEngine` フックによるフェーズ管理を導入。
*   **Dice Input:**
    *   `ParserFactory` を統合し、通常/88-ch形式の両方に対応。
    *   ペースフェーズ(`1d9`)とレースフェーズ(`XdY`)のコンテキストに応じた解析ロジック実装。
*   **Calculator:** パーサー結果をStoreに反映し、合計スコアを算出する基本フローを接続。

## 未実装・次フェーズ送り (Deferred Items)
以下の項目は重要機能ですが、本セッションのスコープ外（またはロードマップ整理待ち）として未実装です。

*   **Scene 3 Specifics:**
    *   [ ] 特殊戦法（捲り/溜め）のUI操作と即時計算ロジック。
    *   [ ] 「戻る」ボタンによる完全な状態復元（History Undo）。
    *   [ ] スコアボードへの「バ身（点数差）」表示。
    *   [ ] 判定フェーズ（写真判定/着差判定）への自動遷移ロジック。

## 起動・確認方法 (Launch Guide)

1.  開発サーバー起動:
    ```bash
    npm run dev
    ```
2.  ブラウザでアクセスし、Scene 1 -> Scene 2 -> Scene 3 へ進行。
3.  **88-ch解析確認:**
    *   Scene 3 にて、以下のテキストを貼り付けて解析成功を確認可能。
    ```text
    タンクタンクタンク　🎲 dice1d100= 77
    ```

## 動作確認項目 (UAC Verification)

| カテゴリ | 項目 | 結果 | 備考 |
| :--- | :--- | :--- | :--- |
| **Scene 1** | 設定変更時の不整合データ自動修正 | OK | `midPhaseCount`減少時のPhase削除動作確認済み |
| **Scene 2** | 日本語表記の確認 | OK | |
| **Parser** | 通常形式の解析 (`name dice...`) | OK | |
| **Parser** | 88-ch形式の解析 (`name 🎲 dice...`) | OK | `🎲`除去、スペース対応修正済み |
| **Parser** | ペースダイス解析 (`dice1d9=...`) | OK | Paceフェーズでのみ有効 |
| **Scene 3** | フェーズ遷移 (Start -> Pace -> Mid...) | OK | |
| **Scene 3** | スコア加算・更新 | OK | 基本的な加算動作のみ確認 |

## 申し送り事項
Scene 3の機能不足分については、アーキテクトによる要件とロードマップの再定義を経て実装指示を出してください。
