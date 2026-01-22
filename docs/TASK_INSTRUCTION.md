# Task Instruction: Phase 2.6 Deployment

**Target Role:** Engineer
**Goal:** GitHub Pagesへのデプロイ環境を構築し、公開可能な状態にする。

## Context
Phase 2.5 (MVP機能実装) が完了しました。
ユーザーテストおよび一般公開に向けて、GitHub Pagesでのホスティングを開始します。

## Requirements (What to do)

### 1. Build Verification
*   ローカル環境で `npm run build` を実行し、エラーなくビルドが完了することを確認してください。
*   生成された `dist/` ディレクトリの中身が正しそうか確認してください。

### 2. GitHub Actions Setup
*   `.github/workflows/deploy.yml` を作成してください。
*   **Workflow仕様:**
    *   Trigger: `main` (または `master`) ブランチへの Push
    *   Jobs:
        *   Checkout code
        *   Setup Node.js
        *   Install dependencies (`npm ci` or `npm install`)
        *   Build (`npm run build`)
        *   Deploy to GitHub Pages (推奨: `actions/deploy-pages` または `peaceiris/actions-gh-pages`)

### 3. Vite Configuration
*   `vite.config.ts` を確認し、GitHub Pages向けの `base` パス設定が必要か判断・適用してください。
    *   *Note:* プロジェクトページ (`username.github.io/repo-name/`) の場合、`base: '/repo-name/'` の設定が必要です。
    *   リポジトリ名が不明な場合は、一旦デフォルト(`/`)のままにするか、ユーザーに確認できるようなコメントを残してください。
    *   必要な場合、`.nojekyll` ファイルの生成などがビルドプロセスに含まれているか（またはDeploy Actionが処理するか）も考慮してください。

## Definition of Done
*   [ ] ローカルビルドが成功する。
*   [ ] `.github/workflows/deploy.yml` がコミットされている。
*   [ ] (Optional) `vite.config.ts` が適切に設定されている。
