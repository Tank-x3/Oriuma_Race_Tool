# Work Log: 2026-01-26 Navigation & Parsing Fix

## Summary
*   **Focus**: Phase 3.1 (Navigation/UX Polish) & Regression Fix
*   **Status**: Completed
*   **Tests**: All Passed (`v24.12.0` / `npm ver 11.6.2`)

## Implementation Details

### 1. Robust Navigation (Persistence)
*   **`useRaceStore.ts`**: Added `moveToSetup` action.
*   **`GateScene.tsx`**:
    *   Added "Back to Setup" button.
    *   Implemented **State Restoration**: On mount, if participants already have assigned gates, the result list is reconstructed immediately. This prevents data loss when returning from Race Scene.
*   **`RaceScene.tsx`**:
    *   Implemented "Back to Gate" logic (triggers `moveToGate`).
    *   Added `useEffect` to force scroll-to-top on phase transitions.

### 2. Validation & Quality Control
*   **`RaceScene.tsx`**:
    *   Added validation blocking "Next Phase" if the current phase hasn't been analyzed (checked via `participant.history`).
    *   Note: Pace phase was already validated, added consistent check for other phases.

### 3. Critical Bug Fix (StandardParser)
*   **Issue**: Regression detected in `standardParser.test.ts`. logic introduced for Oonige (negative dice) was blindly accepting the value in parentheses `(...)` as the `diceResult` to satisfy the Oonige format `(15)`, causing standard checksum validation to be bypassed or incorrect.
*   **Fix**: 
    *   Refactored `StandardParser.ts` to prioritize `rollRaw` (the explicit value after `=`) as the source of truth.
    *   Implemented strict checksum validation (`total === parens`).
    *   Added an exception clause specifically for **Negative Dice (Oonige)** where `Math.abs(total) === checkVal` is allowed to accept the `(15)` notation for a `-15` result.

### 4. Feedback Fixes (Post-Review)
*   **Scene 3 Navigation**:
    *   Fixed issue where "Back" button was disabled in the first phase of the race (Start Phase). Now correctly allows navigating back to Gate Scene (`moveToGate`).
*   **UI Adjustments**:
    *   Renamed "Back" button to **「内容修正へ」** to match Requirements semantics (Undo/Correction).
*   **Data Integrity & Correction Flow**:
    *   Implemented **Selective Re-roll Support**:
        *   **`RaceScene.tsx`**: Added strict validation in `handleNext`. Blocks progress if any participant's history does not match their current Strategy/Unique configuration (e.g., different dice formula).
        *   **`PhaseOutput.tsx`**: Added **"Correction Mode"** (toggle button). Automatically detects entries with missing or mismatched history and allows filtering the output template to show *only* those targets.
        *   **`strategies.ts`**: Centralized `getStrategyDice` logic to share formula generation between display and validation.

*   **Bug Fixes & Refinements**:
    *   **PhaseOutput Refactor**: Implemented granular correction tracking (`base`, `unique`). "Show Correction Only" now filters line-by-line, showing only the specific dice formula that needs correction (e.g., hiding valid Base dice if only Unique is wrong).
    *   **Oonige Fix**: Fixed false positive "Incorrect" badge for Negative Dice strategies by normalizing the expected string before comparison.
    *   **Navigation / State Fix**: Fixed critical bug where returning from Scene 4 (Result/Judgment) set the phase ID to `'phase_end'` (invalid) instead of `'End'`. Also resolved a potential navigation loop in ResultScene when no judgment is required.
    *   **Auto-Scroll Support**: Implemented `useEffect` in `RaceScene` to automatically scroll to the top (error notification area) whenever a validation error occurs, improving visibility of blocking issues.

## Files Modified
*   `src/store/useRaceStore.ts`
*   `src/components/scene/GateScene.tsx`
*   `src/components/scene/RaceScene.tsx`
*   `src/components/scene/JudgmentScene.tsx`
*   `src/components/scene/ResultScene.tsx`
*   `src/components/scene/race/PhaseOutput.tsx`
*   `src/core/strategies.ts`
*   `src/core/parser/implementations/StandardParser.ts`
*   `docs/USER_REVIEW.md`

## Next Steps
*   User confirmation of UX behavior.
*   Proceed to Phase 3.2 (Visual Tweaks) or Phase 4 (House Rules).
