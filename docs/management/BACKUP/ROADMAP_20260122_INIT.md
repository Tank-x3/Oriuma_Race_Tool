# Project Roadmap: Ori-Uma Race Aggregation Tool

## Overview
本ロードマップは、オリウマレース集計ツールの開発フェーズとマイルストーンを定義する。
開発は「Core Logic First」および「MVP Prototype Verification」のアプローチを採用し、早期に実戦投入可能な状態を作ることを優先する。

## Phases

### Phase 1: Project Setup & Core Logic (基盤構築とロジック実装)
**Goal:** 計算ロジックの完全性とテスト環境の確立。

- [x] **1.1. Environment Setup**
    - [x] Initialize Vite + React + TypeScript project
    - [x] Configure Tailwind CSS
    - [x] Setup Vitest (Unit Testing)
    - [x] Directory Structure creation (`src/core`, `src/components`, etc.)

- [x] **1.2. Domain Logic Implementation (TDD)**
    - [x] `Dice` module (Random number generation & formatting)
    - [x] `Calculator` module (Score calculation logic)
    - [x] `Types` definition (Race, Umamusume, Skill, etc.)
    - [x] `Validator` module (Input integrity check)

- [x] **1.3. Parser Implementation**
    - [x] Implement `ParserInterface`
    - [x] Implement `StandardParser` (Basic rule text parsing)
    - [x] Unit tests for Parser with real sample data

### Phase 2: MVP Prototype & Verification (MVPプロトタイプと実戦検証)
**Goal:** 実際の掲示板入出力が動作し、デプロイしてユーザー検証を行える状態にする。

- [x] **2.1. UI Foundation**
    - [x] Theme setup (Font, Color palette based on modern design)
    - [x] Basic Layout (Responsive container)
    - [x] Notification Area component (Strict adherence to Requirements)

- [x] **2.2. Scene 1: Setup & Entry**
    - [x] Race Config Form (Phase counts, Gate size)
    - [x] Entry Form (Table Layout, Batch Input Generation)
    - [x] Validation feedback integration
    - [x] UX Improvements (Validation timing, scroll prevention, confirm dialogs)

- [x] **2.3. Scene 2: Gate Lottery (枠順抽選)**
    - [x] **[CRITICAL]** Gate Determination Logic (Die roll -> Sort by Value & Entry Order)
    - [x] UI Refactor: Match strict Requirements (4 sections layout)
    - [x] Entry List Display (Confirmation view)
    - [x] Dice Output & Result Parsing (Gate determining phase)
    - [x] Result List (Gate Number assignment)

- [ ] **2.4. Scene 3: Race Execution (レース進行)**
    - [ ] Dice Roll Input Interface (Paste area)
    - [ ] Real-time Score Calculation & Display
    - [ ] Phase Management (Opening -> Middle -> Final)
    - [ ] Result Display (Text format for copy)
    - [ ] **[Verification]** Ensure compatibility with strict Entry data from Scene 1

- [ ] **2.4. Deployment & Feedback**
    - [ ] Setup GitHub Actions for GH Pages Deployment
    - [ ] **[MILESTONE] Release MVP for User Testing**
    - [ ] Collect feedback (Bug reports, UX issues)

### Phase 3: Advanced Features Implementation (拡張機能実装)
**Goal:** ユーザビリティの向上と、ハウスルール等の柔軟性確保。

- [ ] **3.1. Feedback Reflection**
    - [ ] Fix critical bugs from MVP testing
    - [ ] Adjust UI based on user feedback

- [ ] **3.2. House Rules System**
    - [ ] Rule Configuration Modal
    - [ ] Custom Dice Config implementation
    - [ ] JSON Import/Export for Rules

- [ ] **3.3. Result Image Generation**
    - [ ] `html2canvas` integration
    - [ ] Off-screen rendering implementation
    - [ ] Image download functionality

- [ ] **3.4. Data Persistence Strategy**
    - [ ] LocalStorage integration for Auto-save
    - [ ] Session recovery logic

### Phase 4: Polish & Final Release (仕上げと正式リリース)
**Goal:** プロダクトとしての品質向上と完成。

- [ ] **4.1. UX Polish**
    - [ ] Micro-animations (Framer Motion etc.)
    - [ ] Keyboard Navigation support
    - [ ] Mobile view optimization

- [ ] **4.2. Final Check**
    - [ ] Edge case testing
    - [ ] Cross-browser testing
    - [ ] Performance optimization

- [ ] **4.3. Documentation**
    - [ ] User Manual (Usage Guide)
    - [ ] Developer Documentation (Maintenance Guide)

- [ ] **[MILESTONE] Final Release v1.0**
