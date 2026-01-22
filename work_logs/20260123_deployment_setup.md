# Work Log: Phase 2.6 Deployment Setup

**Date:** 2026-01-23
**Author:** Engineer Agent

## Task Overview
GitHub Pagesへの自動デプロイ環境の構築。
`vite.config.ts` の `base` パス設定および GitHub Actions ワークフローの作成を行った。

## Changes

### 1. Vite Configuration
*   **File:** `vite.config.ts`
*   **Change:** `base: './'` を追加。
*   **Reason:** GitHub Pages（サブディレクトリ運用）において、アセット（JS/CSS）の読み込みパスを正しく解決させるため。
    *   絶対パス (`/repo-name/`) ではなく相対パス (`./`) を採用し、リポジトリ名に依存せず動作するようにした。

### 2. CI/CD Workflow
*   **File:** `.github/workflows/deploy.yml` (New)
*   **Change:** `peaceiris/actions-gh-pages` を使用したデプロイワークフローを定義。
*   **Trigger:** `main` または `master` への push。
*   **Build:** Node.js v20, `npm ci`, `npm run build`。
*   **Deploy:** `dist` ディレクトリの内容を `gh-pages` ブランチにプッシュする。

## Verification Results
*   **Local Build:**
    *   Command: `npm run build`
    *   Result: Success (Exit code 0)
    *   Output: `dist/assets/` containing built files.

## Next Steps for User (PM)
*   コードをGitHubにプッシュし、Actionsタブで動作確認を行う。
*   初回はGitHubリポジトリ設定（Settings > Pages）で、Sourceが `gh-pages` ブランチになっているか確認が必要な場合がある。
