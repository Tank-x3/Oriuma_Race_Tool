# Work Log: Scene 4 Feedback Fixes (Round 6)

## 変更の概要
大逃げの「減算ダイス」が正しくパースされず計算エラーになる問題と、Scene 3の見出し文字色がLightテーマで白飛びする問題を修正しました。

## 変更ファイル一覧
- `src/core/parser/standardParser.ts`:
    - 正規表現に `(\-)?dice` のパターンを追加し、`dice` の前にマイナス記号がある場合（または `＋-dice` の場合）に検出できるように変更。
    - マイナス記号検出時は `diceResult` を負の値として扱うロジックを追加。
    - これにより `62＋-dice1d27=15 (15)` は `62 + (-15) = 47` として正しく計算されます。
- `src/components/scene/JudgmentScene.tsx`:
    - ヘッダーのクラス指定を `text-slate-800 dark:text-slate-200` に厳密に修正。
    - `dark:` プレフィックスを伴うスタイルを明記することで、Light/Dark 両テーマでの視認性を確保。

## 検証
- ビルド (`npm run build`) 通過確認済み。
