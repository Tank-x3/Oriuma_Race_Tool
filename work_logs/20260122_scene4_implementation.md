# Work Log: Scene 4 Implementation

## 変更の概要
- **RankingCalculator**: 順位付けおよび判定ロジック(同着1d5, 着差1d2)の実装。UnitTest作成。
- **UI Components**: `JudgmentScene`(判定入力) および `ResultScene`(結果表示・画像保存) の新規作成。
- **Store**: `judgment` ステートの追加、シーン遷移アクションの追加。
- **App/RaceScene**: シーン遷移ロジックの統合。自動判定検知(判定不要ならスキップ)の実装。

## 変更ファイル一覧
- `src/types/index.ts`: `judgment` フィールド追加
- `src/store/useRaceStore.ts`: `scene` 型拡張、アクション追加
- `src/core/logic/RankingCalculator.ts`: [NEW] 順位計算ロジック
- `src/components/scene/JudgmentScene.tsx`: [NEW] 判定画面
- `src/components/scene/ResultScene.tsx`: [NEW] 結果画面
- `src/components/scene/RaceScene.tsx`: 終了時の遷移判定ロジック追加
- `src/App.tsx`: シーンルーティング追加
- `tests/core/logic/RankingCalculator.test.ts`: [NEW] テストコード
- `package.json`: `html2canvas` 追加

## 技術的な特記事項
- **StandardParser**: 判定シーンでの入力解析において、StandardParserの汎用性を利用しつつ、結果の適用ロジックはComponent側で制御しました。
- **html2canvas**: 結果画像の生成に使用。高DPI対応設定(`scale: 2`)を入れています。
- **Lint修正**: `PhaseOutput` 等、今回直接変更していないファイルでもStrictなチェックによるエラーが出ていたため修正を行いました。

## 次のステップ
- Scene 4までの基本フローは完了しました。
- 今後は「ハウスルール設定(Scene 1詳細)」や「ユニークスキル効果の条件分岐(Scene 3詳細)」などの機能拡張が考えられます。
