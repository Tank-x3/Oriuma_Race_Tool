# Work Log: Scene 3 Reconstruction (2026-01-22)

## Summary
Scene 3 (Race Execution) の完全再構築を行いました。
`REQUIREMENTS.md` のワイヤーフレームに準拠したUI構築は完了し、基本的なダイス生成・入力ロジックの実装を行いました。
しかし、ユーザー検証により「88-chのダイス形式（複数行）」の対応が困難であることが判明したため、**解析ロジックの抜本的なオーバーホールは次期セッションへ持ち越し**となりました。

## Changes
### Cleanup
- **Deleted:** `src/components/scene/race/DiceInput.tsx`, `ResultView.tsx`, `ScoreBoard.tsx`
- **Updated:** `src/components/scene/RaceScene.tsx` (Complete Rewrite)

### New Implementations
1.  **PhaseOutput (`src/components/scene/race/PhaseOutput.tsx`)**
    - 現在のフェーズや脚質に応じたダイス式（`Base + diceXdY`）を自動生成。
    - ペース判定フェーズの特殊表示に対応。
    - 固有スキルの発動判定ロジックを実装。

2.  **PhaseInput (`src/components/scene/race/PhaseInput.tsx`)**
    - 掲示板レス（`diceXdY=...`）のパース処理。
    - ペース判定（`1d9`）の即時解析と表示。
    - *Deferred: Multi-line parser logic for complex dice outputs.*

3.  **RaceDashboard (`src/components/scene/race/RaceDashboard.tsx`)**
    - 現在スコアに基づく降順ランキング表示。
    - 「バ身差（着差）」の実況補助計算（0-1点差は「並ぶ」、それ以外は分数表記）。

4.  **Logic Integration**
    - **Pace Modifier:** ペースフェーズから次フェーズへの遷移時、`Calculator` を使用して全員のスコアを再計算・更新するロジックを `RaceScene` に実装。

## Feedback addressed
- **Theme Fixes:** セクションヘッダーのテキスト色を `gray-700` から `gray-900` に変更し、ライトモードでの視認性を向上させました。

## Next Steps (Deferred)
- **Parsing Logic Overhaul:** 88-chの複雑な（複数行にわたる）ダイス結果を解析するためのロジック再設計。
- **Error UI Improvements:** トースト通知を廃止し、常設エリアへのエラー表示へ変更。
- **Scene 4 (Judgment):** 最終結果判定への遷移ロジックの実装（未着手）。
