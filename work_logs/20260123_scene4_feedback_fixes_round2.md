# Work Log: Scene 4 Feedback Fixes (Round 2)

## 変更の概要
Round 1のフィードバックを受け、画像保存仕様の厳密化と判定UXの改善を行いました。

## 変更ファイル一覧
- `src/components/scene/ResultScene.tsx`:
    - `html2canvas` の `onclone` オプションを利用し、**ユーザー画面に影響を与えずに**画像用レイアウトを調整するロジックを実装。
    - 画像幅を `1200px` (scale: 1) に強制。
    - 画像から「合計点」と「判定」列を除外（`.hide-on-image` クラス付与 & `onclone` で削除）。
- `src/components/scene/JudgmentScene.tsx`:
    - 着差判定のダイス指示形式を `[NameA] vs [NameB] dice1d2=` に変更。
    - `StandardParser` クラスに `parseJudgment` 静的メソッドを追加し、上記形式（参加者リストにない名称）のパースをサポート。
    - 通常の解析とフォールバック解析の二段構えで堅牢性を確保。
- `src/core/parser/standardParser.ts`:
    - `parseJudgment` メソッド追加。

## 技術的な特記事項
- **StandardParser拡張**: 既存の `parse` メソッドは登録済み参加者リストとの厳密な突き合わせを行いますが、`parseJudgment` は「ダイス形式の正当性」のみをチェックし、名前（"A vs B"など）をそのまま抽出する軽量パーサーとして実装しました。これにより、判定シーン特有の柔軟な入力に対応しています。

## 検証
- ビルド (`npm run build`) 通過確認済み。
