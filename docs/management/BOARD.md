# ホワイトボード (PM)

## Phase 3.5: コードレビュー対応 (2026-03-06)

> Stage 1〜5 のコードレビュー（`CODE_REVIEW_BOARD.md`）で167件の発見事項を検出。
> 重複排除後 **93件のユニーク課題** を Step 5-3 で分類済み。
> 詳細は `CODE_REVIEW_BOARD.md` Step 5-3 セクション、`FINDINGS_CONSOLIDATED.md` を参照。

### ステータス

| 区分 | 状態 | 件数 |
|------|------|------|
| **Critical Engineer タスク** | ✅ 完了（E-1, E-2 Round 1+2） | 2件 + Round 2追加 |
| **SA エスカレーション** | ⬜ E-1/E-2 完了後に発行 | 34件 |
| **High Engineer タスク** | ⬜ SA完了後に発行 | 16件 |
| **Medium/Low Engineer タスク** | ⬜ High完了後に発行 | 32件 |
| **Phase 4 へルート（未実装既知）** | ⬜ Phase 4 で対応 | 9件 |

### Critical（即座対応）— Engineer

| Issue | 事項番号 | 概要 | 対象ファイル | 状態 |
|-------|----------|------|-------------|------|
| CR-1 | #2-2-A | **固有スキル発動フェーズ制限未チェック** — uniqueDice無条件加算で二重計上リスク | `calculator.ts` | ✅ E-1 完了（検証済み） |
| CR-2 | #3-2-F | **EmojiParser減算Fix未実装** — `73-🎲 dice3d6=` が `73+15=88` と誤計算 | `emojiParser.ts` | ✅ E-2 完了（Round 1+2 併せて承認） |
| CR-2b | — | **StandardParser `Fix-dice` 未対応**（E-2 Round 2 で同一クラスタとして修正） | `standardParser.ts` | ✅ E-2 完了（Round 2） |

### 新規Issue（E-1 エスカレーション報告）

| Issue | 事項番号 | 概要 | 対象 | 状態 |
|-------|----------|------|------|------|
| CR-38 | — | **history残存データによる進行ブロック** — 固有スキル発動位置変更時、旧フェーズのhistoryが残存し再到達時に進行不能。historyクリア/リセット機能が未実装 | `store` / `history管理` | ⬜ PM#3でSAエスカレーション対象に含める |

### Architect対応待ち — SA エスカレーション

| Issue | バッチ | 概要 | 件数 | 状態 |
|-------|--------|------|------|------|
| CR-SA-1 | Part 1 | tech-stack.md + parser-system.md の仕様更新 | 約15件 | ⬜ エスカレーション未発行 |
| CR-SA-2 | Part 2 | UI仕様更新 + 双方調整(X)の仕様決定 + validator.ts責務設計 | 約19件 | ⬜ エスカレーション未発行 |

### High Engineer タスク（SA完了後に発行）

| Issue | 事項番号 | 概要 | 状態 |
|-------|----------|------|------|
| CR-3 | #1-3a-3, #1-3a-5, #1-3a-9 | Scene 1 バリデーション: 空欄行スキップ、名前重複チェック、Soft Delete | ⬜ |
| CR-4 | #1-2-3, #3-2-C, #1-2-6 | パーサー修正: (N)エラー化、未完了ブロック破棄防止、名前検証強化 | ⬜ |
| CR-5 | #1-1-B, #1-4-9 | RankingCalculator参照改善 + zustand persist導入 | ⬜ |
| CR-6 | #5-1-1, #2-4-A, #2-4-K | GateScene構造修正 + validator.ts責務再設計 | ⬜ |
| CR-7 | #3-3-A, #3-3-G, #3-3-J, #3-3-K | パーサーテスト追加（High T群） | ⬜ |
| CR-8 | #4-1-4 | prevPhase()データ巻き戻し未実装 | ⬜ |

### Medium Engineer タスク

| Issue | 事項番号 | 概要 | 状態 |
|-------|----------|------|------|
| CR-9 | #1-3a-1, #1-3a-7 | 中盤ダイス回数の初期値・操作検知フラグ | ⬜ |
| CR-10 | #1-3a-4 | バリデーションメッセージ形式修正 | ⬜ |
| CR-11 | #1-3a-6 | 禁止文字チェック不完全（改行・全角＋） | ⬜ |
| CR-12 | #1-3a-8 | エントリー確定ボタンDisabled制御 | ⬜ |
| CR-13 | #1-3a-10 | 固有発動位置リセット時エラーメッセージ | ⬜ |
| CR-14 | #1-3b-5 | 未検出出走者の名前リストアップ | ⬜ |
| CR-15 | #1-3d-C | 着差判定ダイス出力フォーマット修正 | ⬜ |
| CR-16 | #3-1-D | チェックサム検証失敗後の二重登録修正 | ⬜ |
| CR-17 | #3-2-B | 合計行パターンの仕様外拡張除去 | ⬜ |
| CR-18 | #3-2-D, #3-2-E | チェックサム自動補完 + ヘッダーキャプチャ修正 | ⬜ |
| CR-19 | #4-1-2 | フェーズ履歴UI状態復元 | ⬜ |
| CR-20 | #5-1-2 | ThemeToggle useEffect setState修正 | ⬜ |
| CR-21 | #5-1-7 | any型使用箇所の型安全性改善 | ⬜ |
| CR-22 | #2-1-A | 汎用補正理由ラベルフィールド追加 | ⬜ |
| CR-23 | #3-3-C, #3-3-D, #3-3-H, #3-3-F | テスト追加（Medium T群） | ⬜ |
| CR-24 | #1-2-1, #1-2-5, #1-3c-4, #1-3c-9 | 双方調整(X)の実装側修正（SA仕様確定後） | ⬜ |

### Low Engineer タスク

| Issue | 事項番号 | 概要 | 状態 |
|-------|----------|------|------|
| CR-25 | #1-2-7 | ヘッダー検出🎲必須化 | ⬜ |
| CR-26 | #1-3c-10 | ペースラベル文言修正 | ⬜ |
| CR-27 | #1-3d-A, #1-3d-D | 暫定順位注釈 + エラーメッセージ修正 | ⬜ |
| CR-28 | #1-3d-I | 画像保存エラー詳細追加 | ⬜ |
| CR-29 | #1-4-16 | 余剰ファイル削除（App.css, react.svg） | ⬜ |
| CR-30 | #3-1-F | エラーメッセージ日本語統一 | ⬜ |
| CR-31 | #4-3-2, #4-3-7 | 合計値不一致メッセージ改善 + 状態復元時ダイス消失修正 | ⬜ |
| CR-32 | #4-4-5, #4-4-8 | テキストエリアリセット + スクロール位置調整 | ⬜ |
| CR-33 | #4-5-I, #4-5-J | フォールバック値修正 + リセットモーダル化 | ⬜ |
| CR-34 | #4-2-M | NotificationAreaダークモード対応 | ⬜ |
| CR-35 | #5-1-3 | Notification.tsx エクスポート整理 | ⬜ |
| CR-36 | #3-3-E | HTMLタグ混在テスト追加 | ⬜ |
| CR-37 | #3-1-C | StandardParser PACE🎲オプション除去 | ⬜ |

### 仕様書更新のみ（SA対応、Engineerタスクなし）

> 以下はカテゴリS（27件）のうち、コード変更を伴わない仕様書更新。SA エスカレーションに含める。
> 個別リストは `CODE_REVIEW_BOARD.md` Step 5-3-1 を参照。

### 設計・インフラ改善

| Issue | 事項番号 | 概要 | 状態 |
|-------|----------|------|------|
| CR-I-1 | #2-1-D | カスタム脚質区別フラグ設計検討 | ⬜ Low |
| CR-I-2 | #4-2-J | phaseリセットuseEffectパフォーマンス（24人規模で問題なし） | ⬜ Low |
| CR-I-3 | #5-1-8 | JSバンドルサイズ — コード分割検討 | ⬜ Low |
| CR-I-4 | #5-2-1 | deploy.yml — GitHub Pages推奨方式移行 | ⬜ Low |
| CR-I-5 | #2-1-F | paceModifiers全脚質空の実装検討 | ⬜ Low |

### Phase 4 へルート（未実装既知）

> 以下はカテゴリU（9件）。Phase 4（ハウスルール）以降の機能開発タスクとして管理。

| Issue | 事項番号 | 概要 |
|-------|----------|------|
| P4-1 | #1-3c-1 | 特殊戦法（捲り/溜め）UI・ロジック |
| P4-2 | #1-3c-2 | 汎用補正（手動補正値入力）UI |
| P4-3 | #1-3c-3 | 補正値のダイス式表示（P4-2依存） |
| P4-4 | #1-3c-8, #4-4-2 | 戻る操作でフェーズ履歴完全復元（ハウスルール依存） |
| P4-5 | #2-1-C | 状態異常効果値フィールド（P4-1依存） |
| P4-6 | #1-4-10 | zod導入（外部JSONインポート実装時） |
| P4-7 | #1-4-13 | 仮想スクロールライブラリ |
| P4-8 | #1-3d-G | 26名以上の画像分割生成 |

---

## Closed Beta フィードバック (2026-01-25)

### UI/UX 改善要望
- ✅ ~~シーン/フェーズ進行時、結果取り込みエリアでの解析が未実行の場合、エラーメッセージを表示して進行を止める~~ → **対応済み (2026-01-26)**
  - 解析未実行時のバリデーションブロック実装済み
  - Auto-Scroll対応（エラー発生時に通知エリアへ自動スクロール）
- ✅ ~~「次のフェーズへ」で進行した際、自動的にスクロールを最上部に戻す~~ → **対応済み (2026-01-26)**
  - `useEffect` によるフェーズ遷移時の自動スクロール実装済み
- ✅ ~~**途中修正とデータ保持 (Modification & Persistence)** の全面的実装~~ → **対応済み (2026-01-26)**
  - Scene間遷移（Scene 3 → Scene 2 → Scene 1）実装完了
  - 戻り時のデータ保持・状態復元実装済み
  - 「内容修正へ」ボタンでUIセマンティクスを明確化
  - 修正モード（Correction Mode）によるSelective Re-roll対応

### バグ / 問題
- ✅ ~~**[CRITICAL] Scene 3 ダイス解析バグ (2026-02-08)**~~ → **修正完了**
  - 2026-02-08 Engineerセッションで修正、全テストPass
  - `REQUIREMENTS.md` も更新完了（チェックサム仕様明確化）

### 機能要望
- （現在なし）

## 残課題 (MVPから継続)
- **Scene 4 (結果画像)**:
    - リッチなデザイン対応（現在はシンプル版）
    - 高解像度出力対応

## プロジェクトステータス
- **Phase 3.1 (ナビゲーション & ポリッシュ)**: ✅ **完了**
- **Phase 3.2 (ビジュアル)**: Phase 5 へ延期
- **Phase 3.5 (コードレビュー対応)**: 🔴 **進行中** — Critical E-1 タスク発行済み
- **次フェーズ**: Phase 3.5 完了後 → **Phase 4: 拡張機能実装（ハウスルール）**

### アクションプラン
1. **PM #1**: ✅ BOARD.md 更新（93件のIssue登録）+ CR-1 タスク発行
2. **PM #2**: ✅ E-1 検証完了 → CR-2 タスク発行 → E-2 検証完了（Round 1+2）
3. **PM #3（次回）**: ガイドライン改定に伴うプロジェクト整理 → SA エスカレーション発行（CR-SA-1/2 + CR-38 history問題）

---

## TRIAGE 由来タスク（2026-04-24 登録）

> 出典: `docs/_archived/TRIAGE.md` §6-B Wave 0〜4。通常ワークフロー外の整理として TRIAGE モードで確定した項目群。
> Wave 0 は 2026-04-24 の TRIAGE 解除コミット (deec17b) で完了済。
> Wave 1〜4 は本 BOARD に新規 Issue として登録（既存 Issue と重複なし）。

### Wave 1: REPO 整備 — PM 単独

| Issue | 概要 | 対象 | 状態 |
|-------|------|------|------|
| REPO-0 | 未コミット残滓（`M docs/CODE_REVIEW_BOARD.md` +1924 行 / `?? docs/FINDINGS_CONSOLIDATED.md`）を `git add` → コミット | リポジトリ状態 | ⬜ Wave 1 で実施 |
| REPO-1 | `.gitignore` に `docs/` + `work_logs/` + `guidelines/` + `CLAUDE.md` を追加 → コミット（ローカル専用化の境界確定） | `.gitignore` | ⬜ Wave 1 で実施 |
| REPO-2 | `git rm -r --cached` で除外対象 ∩ tracked ファイルを tracked 解除 → コミット → **push**（force-push 禁止、履歴残置） | 全 tracked docs / work_logs / guidelines / CLAUDE.md | ⬜ Wave 1 で実施 |
| REPO-3 | `guidelines/pm.md` Step 3 Verification に「GitHub push を規定値」明記、`guidelines/engineer.md` Step 3b に「push は PM 側」を注記（REPO-1 後はローカル編集のみ） | `guidelines/pm.md`, `guidelines/engineer.md` | ⬜ Wave 1 で実施 |

### Wave 2: CR-38 対応（致命的・進行ブロック解消） — SA → Engineer

| Issue | 概要 | 対象 | 状態 |
|-------|------|------|------|
| CR-38-SA | `docs/specs/logic/basic-rules.md` §6「途中修正運用ルール」に固有タイプ修正時の history 挙動を追記し実装方針提示。**DOC-3a の basic-rules.md §6 部分は本タスクに吸収** | `basic-rules.md` §6 | ⬜ SA 対応待ち |
| CR-38-E | CR-38 実装（SA 方針に基づく） | store / history 管理 | ⬜ SA 完了後 |

### Wave 3: DEV-1 対応（ダークモード UX バグ） — Engineer（Wave 2-E と合流可）

| Issue | 概要 | 対象 | 状態 |
|-------|------|------|------|
| DEV-1a | Scene 4-A ダークモード配色整備（`GateScene.tsx` dark: 33 件基準）。337 行中の背景 / 文字 / 枠線色全般 | `src/components/scene/JudgmentScene.tsx` | ⬜ |
| DEV-1b | Scene 4-B ダークモード配色整備（dark: 0 件）。DEV-1a と連続で Scene 4 フロー一体修正 | `src/components/scene/ResultScene.tsx` | ⬜ |

### Wave 4: DOC 整備 — PM 1 セッション + SA 1 セッション

| Issue | 概要 | 対象 | ロール | 状態 |
|-------|------|------|------|------|
| DOC-2 | Docs リファクタ「構造維持 + 問題箇所是正」原則の明文化 | 方針確認のみ | PM | ⬜ |
| DOC-1a | CLAUDE.md §43 ディレクトリ構成に `docs/ideas/BOARD.md` / `docs/ideas/REJECTED.md` / `docs/ARCHITECT_FEEDBACK.md` / `docs/management/DEPLOY_GUIDE.md` を追記 | `CLAUDE.md` §43 | PM | ⬜ |
| DOC-1b | CLAUDE.md §28「移行・セットアップ」を削除 or 「移行完了済」注記化 | `CLAUDE.md` §28 | PM | ⬜ |
| DOC-1c | `guidelines/engineer.md` Capabilities の `gas_src/` 言及を削除 | `guidelines/engineer.md` | PM | ⬜ |
| DOC-1d | `guidelines/system-architect.md` の `PROJECT_OVERVIEW.md` 言及を削除 or 存在確認注記化 | `guidelines/system-architect.md` | PM | ⬜ |
| DOC-1e | 4 ガイドラインに「特別作業ドキュメント（CLAUDE.md §87 参照）は通常ロールセッションで編集しない」旨を追記 | 4 `guidelines/*.md` | PM | ⬜ |
| DOC-4 | `work_logs/` を「正式な作業記録・コードベース情報整理のベース」と位置づける旨を `guidelines/*.md` / `CLAUDE.md` に明記 | `guidelines/*.md`, `CLAUDE.md` | PM | ⬜ |
| DOC-3c | CR-10 スコープ記述に「Scene 2 バリデーションメッセージ文言（`REVIEW_20260121_Scene2.md` 指摘）の現状確認」を追記し DOC-3c クローズ | BOARD.md CR-10 行 | PM | ⬜ |
| DOC-3a | `parser-system.md` / `tech-stack.md` を実態反映更新（Zustand 採用 / 平坦ディレクトリ / 3 種 Parser コンテキスト / EmojiParser 減算仕様）。**CR-SA-1 駆動**（basic-rules.md §6 は W2-1 で処理済） | `docs/specs/architecture/*.md` | SA | ⬜ |
| DOC-3b | `parser-system.md` に `ParsedLine.isSubtractive` 設計注記（「現設計は diceResult 負数化で吸収、将来の検算ロジック拡張時に再確認」）。DOC-3a と同一セッション | `parser-system.md` | SA | ⬜ |
| DOC-3d | `docs/REQUIREMENTS.md` の `(N)` / チェックサム仕様の反映状態を目視確認 | `docs/REQUIREMENTS.md` | SA | ⬜ |

### Wave 依存関係

- **Wave 1 は Wave 2〜4 すべてに先行**（GitHub 露出最小化・ローカル専用化の確立）
- **Wave 2-SA → Wave 2-E** は直列
- **Wave 3 は Wave 2-E と合流可**
- **Wave 4 は Wave 3 完了後**（PM 管轄は Wave 2-SA と並行先行の余地あり）
