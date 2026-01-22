# Whiteboard (PM)

## User Issue / Request
- Scene 1(エントリー登録）
  - 中盤ダイス回数の設定がスライダーになっている
  - 中盤回数を減らした際、固有発動位置の不整合時の挙動（自動リセット要望）
- Scene 2(枠順抽選)
  - エントリー内容確認の文言不一致
  - ダイス出力の区切り文字（全角スペース）
  - `88-ch` 形式 (`🎲`) への対応
- Scene 3
  - **[CRITICAL]** 全面的な作り直しが必要
      - 作業混乱時の残骸（ダークテーマ、不適切なレイアウト）がそのまま残っている。
      - ダイス出力機能など、必須機能が欠落している。
      - 要件定義（ワイヤーフレーム）に忠実な再実装が必要。
- **Scene 4 (New)**
  - 未実装のためデプロイ不可。次回最優先。

## PM Proposal
### Current Status
- **Phase 2.5 (Scene 4 (Result & Judgment))**: **DONE**
- **Phase 2.6 (Deployment)**: **TODO** (Current Task)

### Action Plan
1.  **Next Session (Engineer)**:
    - **Deployment**: Setup GitHub Actions for GH Pages.
    - **Verify**: Check build process locally.
## User Feedback (2026-01-22)
### Scene 3 Reconstruction Result
- **UI/UX Consistency**: Good (Theme switching works).
- **Issues Found**:
    1.  **[UI]** Section Header text color (Light Mode legibility).
    2.  **[UI]** Error Messages: Replace Toast with Persistent/Embedded Error Area. No truncation (`他 n 件`).
    3.  **[CRITICAL] 88-ch Parser Failure**:
        - **Resolved**: Parser v2.0 (EmojiParser) implemented & verified.

### Project Status
- **Phase 2.5 (Scene 4)**: ✅ **Completed**
- **Next Phase**: **Phase 2.6: Deployment & Feedback**

### Proposed Workflow
1.  **Step 1: PM Planning**
    - Create `TASK_INSTRUCTION.md` for Deployment.
2.  **Step 2: Engineer Session**
    - Setup GitHub Actions.
    - Configure Vite for deployment.
