# Work Log: Scene 4 Feedback Fixes (Emergency)

## 変更の概要
検証で見つかった「実際のBBSログ形式をパースできない」という致命的な不具合と、UI上の不備（重複表示、配色）を修正しました。

## 変更ファイル一覧
- `src/App.tsx`:
    - `GateScene` が2重にレンダリングされていたバグを修正（重複行を削除）。
- `src/core/parser/standardParser.ts`:
    - 正規表現を拡張し、`dice3d6= 5 3 5 (13)` のような「個別ロール値 + 合計値(括弧)」のフォーマットに対応。
    - 括弧内の数値が存在する場合はそれを優先的に `diceResult` として採用するロジックを追加。
    - 未使用変数 `checkValue` を削除（Lintエラー対応）。
- `src/components/scene/JudgmentScene.tsx`:
    - セクション見出しのクラスを `text-gray-700` から `text-gray-800 text-lg` に変更し、ライトテーマでの視認性を向上。

## 検証
- ビルド (`npm run build`) 通過確認済み。
- これにより、提示されたログ（`15+dice3d6=5 3 5 (13)`）が正常にパース可能となります。
