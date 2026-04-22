# Implementation Plan - Phase 3.1: Robust Navigation & UX Polish

## Goal Description
Closed Betaのフィードバックに基づき、以下のUX改善を行う。
1.  **Backtracking:** Scene 3 (Race) -> Scene 2 (Gate) -> Scene 1 (Setup) への戻り導線を確立し、設定ミスを修正しても既存データ（進行中のダイス結果など）が消えないようにする。
2.  **Navigation UX:** フェーズ遷移時の自動スクロールトップ。
3.  **Error Feedback:** 解析未実行時に「次のフェーズへ」を押した際のエラー表示。

## User Review Required
> [!IMPORTANT]
> **Data Persistence Strategy:**
> Scene 1に戻った際、`generateParticipants` 等が走ってデータがリセットされないよう、`SetupScene` の初期化ロジック調整が必要。
> Scene 2 に戻った際、既に確定済みの枠順データがある場合はそれを表示し、「再抽選」をするかどうかの選択をユーザーに委ねる（あるいは単に修正のみか）。

## Proposed Changes

### Core Logic (Navigation)
#### [MODIFY] [RaceApp.tsx](file:///c:/u_temp/race/src/RaceApp.tsx)
*   `Scene` state management logic update.
*   Add `backToSetup()` and `backToGate()` functions or unify `handleBack`.
*   Ensure state is preserved when switching scenes backward.

### Scene Components
#### [MODIFY] [SetupScene.tsx](file:///c:/u_temp/race/src/components/scene/SetupScene.tsx)
*   Initialize local state from passed `participants` prop (if exists) instead of empty/default.
*   Prevent auto-clearing data on mount.

#### [MODIFY] [GateScene.tsx](file:///c:/u_temp/race/src/components/scene/GateScene.tsx)
*   Support re-entry mode (display existing result if available).

#### [MODIFY] [RaceScene.tsx](file:///c:/u_temp/race/src/components/scene/RaceScene.tsx)
*   **Scroll Top:** Add `useEffect` on `phase` change to scroll `window.scrollTo(0, 0)`.
*   **Validation:** In `handleNextPhase`, check if the current phase has valid results (score updated). If not, show error in `NotificationArea`.

## Verification Plan

### Automated Tests
*   **Unit Tests:** Verify `Calculator` or `Validator` still works (Regression test).
*   *Note:* Navigation logic is mostly UI/Integrational, manual verification is key.

### Manual Verification
1.  **Backtracking Flow:**
    *   Start Race -> Go to Scene 3 (Mid-phase).
    *   Click "Back" to Scene 2. Confirm Gate orders are still there.
    *   Click "Back" to Scene 1. Confirm Names/Strategies are still there.
    *   Modify a Name.
    *   Go forward to Scene 3. Confirm Name is updated and Scores are preserved.
2.  **Scroll Check:**
    *   In Scene 3, scroll down to bottom (Result area).
    *   Click "Next Phase".
    *   Confirm screen jumps to top.
3.  **Error Check:**
    *   In Scene 3 (Start), click "Next Phase" without pasting anything.
    *   Confirm error message "解析を実行してください" in Notification Area.
