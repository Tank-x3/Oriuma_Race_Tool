# Technical Stack & Directory Structure（技術スタック・ディレクトリ構造）

> **管轄:** System Architect
> **出典:** `REQUIREMENTS.md` §4 Technical Stack & Directory Structure より切り出し
> **横断的制約:** `REQUIREMENTS.md` を併読のこと

---

## 概要

本プロジェクトは、GitHub Pagesでのホスティングを前提とした完全なクライアントサイドSPAとして構築する。
複雑な計算ロジックとUIを切り離し、将来的な拡張（プラグイン追加やルール変更）に耐えうるアーキテクチャを採用する。

---

## A. Technical Stack

- **Runtime Environment:**
    - **Single Page Application (SPA):** サーバーサイド処理を一切持たない。
    - **Hosting:** GitHub Pages
- **Core Framework:**
    - **React 18+:** UI構築およびコンポーネント管理。
    - **Vite:** ビルドツール。高速なHMRと軽量なバンドル生成のため採用。
- **Language:**
    - **TypeScript (Strict Mode):** 必須。複雑な計算ロジックやデータ構造（ハウスルール、フェーズ状態）の整合性を型レベルで担保する。
- **Styling:**
    - **Tailwind CSS:** ユーティリティファーストCSS。レスポンシブ対応（PC/スマホ）を迅速に行うため採用。
- **State Management:**
    - **React Context API + useReducer:** レース進行状態（Undo/Redo履歴、未来の補正予約）やハウスルール設定をグローバルに管理する。
- **Key Libraries:**
    - **html2canvas:** リザルト画像の生成（Off-screen rendering）。
    - **zod:** 外部入力データ（インポートするJSON設定ファイル）のスキーマバリデーション。不正なファイルの読み込みをランタイムで阻止する。
    - **lucide-react:** UIアイコン。
    - **clsx / tailwind-merge:** 動的なクラス名制御（エラー時のスタイル切り替え等）。
    - **Performance Optimization:**
        - **Virtual Scrolling:** 100人規模のエントリーに対応するため、`react-window` や `react-virtuoso` 等の仮想スクロールライブラリを導入し、レンダリングコストを最小化する。

---

## B. Directory Structure

「ドメインロジック（計算・ルール）」と「UIコンポーネント（表示・操作）」を明確に分離するディレクトリ構成とする。

```text
root/
├── .github/
│   └── workflows/      # GitHub Actions (Deploy to GitHub Pages)
├── docs/               # 要件定義書、設計資料 (Read Only)
│   ├── REQUIREMENTS.md
│   └── ARCHITECT_HANDOVER.md
├── gas_src/            # Google Apps Script (Reserved for future sheet integration)
│   └── (README.md)     # ※現フェーズでは使用しないが、拡張用に場所を確保する
├── public/             # Static Assets (Favicon, Manifest)
├── src/
│   ├── assets/         # Global Styles (Tailwind directives)
│   ├── components/     # React Components
│   │   ├── ui/         # Generic UI Atoms (Button, Input, Card, Modal, Toast)
│   │   ├── shared/     # Shared Organisms (Header, Footer, ErrorBoundary)
│   │   ├── hidden/     # Off-screen Components (画像生成用の隠しレンダリング領域)
│   │   └── scenes/     # Scene-specific Page Components (各画面のメインUI)
│   │       ├── Setup/          # Scene 1: Entry & Config
│   │       ├── GateLottery/    # Scene 2: Gate Logic
│   │       ├── Progression/    # Scene 3: Main Race Loop
│   │       └── FinalResult/    # Scene 4: Judgment & Result
│   ├── core/           # Domain Logic (PURE TYPESCRIPT - NO UI/REACT DEPENDENCIES)
│   │   ├── types.ts    # Domain Types (RaceState, Entry, HouseRule, FutureEffect)
│   │   ├── constants.ts # Default Rules (Dice Tables, Pace Mods)
│   │   ├── calculator/ # Calculation Logic
│   │   │   ├── index.ts      # Main Calculator
│   │   │   ├── strategies.ts # 脚質ロジック
│   │   │   └── effects.ts    # 状態異常・予約効果(Queue)の処理
│   │   └── parser/     # Text Parsing Logic
│   │       ├── interface.ts  # ParserInterface definition
│   │       └── implementations/
│   │           └── StandardParser.ts # Default parser logic
│   ├── hooks/          # Custom React Hooks
│   │   ├── useRaceEngine.ts  # State Machine (Undo/Redo, Phase transition)
│   │   └── usePersistence.ts # LocalStorage & JSON Handler
│   ├── utils/          # Helper Functions (Formatters, Validators)
│   ├── App.tsx         # Main Routing / Layout
│   └── main.tsx        # Entry Point
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## C. Implementation Guidelines

1. **Separation of Concerns (関心の分離):**
    - `src/core/` 以下のコードは、ReactやDOMに一切依存してはならない。ここには純粋なTypeScriptのクラス/関数のみを配置する。これにより、ロジックの単体テストを容易にし、将来的なプラットフォーム変更（例：Node.jsサーバー化）にも対応可能とする。
2. **Scene Management & State:**
    - `App.tsx` または `Layout` コンポーネントが `CurrentPhase` ステートを監視し、`src/components/scenes/` 内の適切なコンポーネントを切り替えて表示する。
    - データは `useRaceEngine` フック内で一元管理し、画面遷移時にデータが失われないようにする。
3. **Strict Validation:**
    - 外部からの入力（掲示板テキストの解析結果、JSONファイルのインポート）に対しては、必ず `zod` 等を用いたバリデーションを通し、型安全性を確保してから `State` に反映させる。`any` 型の使用は禁止とする。
4. **Image Generation Constraint:**
    - リザルト画像の生成時、`useRef` 等で参照するコンテナ要素は必ず「可視状態（`display: block` 等）」である必要がある。
