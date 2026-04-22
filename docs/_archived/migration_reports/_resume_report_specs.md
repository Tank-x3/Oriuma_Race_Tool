# 仕様・アーキテクチャ系ドキュメント調査レポート

> 対象: `docs/REQUIREMENTS.md`, `docs/APP_FLOW.md`, `docs/specs/`, `docs/ideas/DECISION.md`, `docs/archive/`, `docs/specs/BACKUP/`
> 目的: PM#3 の「`.agent/rules/` 改定に伴うドキュメント整理」、および SA エスカレーション（CR-SA-1 / CR-SA-2）に先立つ現状把握
> 作成日: 2026-04-22

---

## A. 仕様ドキュメント構造の現状

### A-1. `docs/specs/` の3分類構造と各ファイルの役割

```
docs/
├── REQUIREMENTS.md          … インデックス + 横断的制約(§1 CC-1～CC-6)
├── APP_FLOW.md              … Scene遷移・データフロー俯瞰図
├── ideas/
│   └── DECISION.md          … Why / コアバリュー(Concept Architect管轄)
└── specs/
    ├── architecture/
    │   ├── image-generation.md … html2canvas 画像生成戦略(off-screen, 25行分割)
    │   ├── parser-system.md    … ParserInterface + 自動判別 + Standard/Emoji仕様
    │   └── tech-stack.md       … React/Vite/TS/Tailwind/Zustand等とディレクトリ構造
    ├── logic/
    │   ├── basic-rules.md         … 枠順・脚質データ・ペース補正・固有スキル・累積計算
    │   ├── houserule-features.md  … 脚質エディタ/汎用補正/複合固有/捲り溜め/永続化
    │   └── scoring-and-judgment.md … 順位判定・写真判定(1d5)・着差判定(1d2)・バ身計算
    └── ui/
        ├── modal-houserule.md     … ハウスルールモーダルUI
        ├── scene1-setup.md        … Scene1: 設定・エントリー
        ├── scene2-gate.md         … Scene2: 枠順抽選
        ├── scene3-race.md         … Scene3: 進行ループ(最大/最重要)
        ├── scene4-judgment.md     … Scene4-A: 判定割込
        └── scene4-result.md       … Scene4-B: 最終結果・画像生成
```

### A-2. `REQUIREMENTS.md` と `specs/` の関係

- `REQUIREMENTS.md` は **インデックス + 横断的制約(CC-1〜CC-6)のみ** を保持する薄いルート文書に再構成済み（2026-03-04に1067行→108行へ圧縮）。
- 各 spec ファイルには `> 出典: REQUIREMENTS.md §X より切り出し` の出典行あり。重複記述は基本なし（具体仕様は spec 側が単一の正）。
- `DECISION.md` は REQUIREMENTS §1 Project Goal から「Why」部分を分離したもので、Concept Architect 管轄。
- **構造自体は既に「インデックス→3分類→個別spec」の健全な2階層になっており、設計としては整合している**。

---

## B. 各仕様ドキュメントのステータス

### B-1. 古い/WIP/TODO 記述の有無

| ファイル | 問題点 | 深刻度 |
|---|---|---|
| `REQUIREMENTS.md` §3 Changelog | 最終更新 2026-03-04（本日は 04-22、約1.5ヶ月停滞）。Phase 3.5 完了（CR-1, CR-2）や新規登録 CR-2b/CR-38 が未反映 | Medium |
| `tech-stack.md` §A State Management | **「React Context API + useReducer」と記載** → 実態は Zustand（`APP_FLOW.md` §1 で `useRaceStore` 明記）。**CR-SA-1 の対象と一致** | **High** |
| `tech-stack.md` §B Directory Structure | `calculator/index.ts`, `strategies.ts`, `effects.ts` のサブディレクトリ構造を示すが、実コードは `src/core/calculator.ts` 単一ファイル。`parser/implementations/` も実態と差異あり | **High** |
| `tech-stack.md` §B | `docs/ARCHITECT_HANDOVER.md` のみを `docs/` として記載。`APP_FLOW.md`, `specs/` 階層、`management/`, `ideas/`, `archive/` 等が欠落 | Medium |
| `tech-stack.md` §A Key Libraries | `zod` 利用・`react-window`/`react-virtuoso`の導入方針 → 実装現状の追認が必要（未確認） | Medium |
| `parser-system.md` Interface | `parse(text, context: 'RACE' \| 'PACE')` と記載 → 実際は `'JUDGMENT'` も存在（`APP_FLOW.md` §5 Parser コンテキストで明記）。**CR-SA-1 対象と一致** | **High** |
| `parser-system.md` | EmojiParser の減算仕様（`-🎲`, 複数行 `合計:` 減算, Fix-dice 等）が `work_log 2026-04-22` で追加実装済みだが **spec側への反映なし** | **High** |
| `basic-rules.md` 2. ※1 | 大逃げ `-dice1d27=` 形式は実装済みだが、上記 parser-system との整合性要確認 | Low |
| `modal-houserule.md` §1 複合固有スキル | 「連続する2つのフェーズが原則、クリティカルエラーでブロック」と記載 → 対する `houserule-features.md` §2 は「警告レベル・柔軟許容」。**2ファイルで相反する記述** | **High** |
| `scene1-setup.md` §4 | 「持続型」言及が存在するが、`basic-rules.md` §4 にも記述あり（重複は一旦許容範囲）。ただし発動位置バリデーションは `modal-houserule.md` と不整合（上記と同根） | Medium |
| `scene3-race.md` §1 ペース | ペース補正は「直後のフェーズ開始時に累積へ合算」と明確。実装確認不要 | Low |

### B-2. SA エスカレーション対象の現状

#### CR-SA-1（tech-stack.md + parser-system.md 仕様更新、約15件）

- **tech-stack.md**
  - State Management の記述が Context+useReducer → Zustand への更新が必要
  - Directory Structure の `core/calculator/` サブツリーは実態に合わせ平坦化、または実装側を整える判断が必要
  - `docs/` の配下構成を現状（`specs/`, `management/`, `ideas/`, `archive/`, `APP_FLOW.md` 等）に更新
- **parser-system.md**
  - Interface シグネチャに `'JUDGMENT'` を追加
  - EmojiParser の複数行減算仕様（`_isSubtractive` フラグ、`合計:` 行での符号適用）の追記
  - StandardParser の `Fix + [+/-] + dice` regex 仕様の追記（Round 2 で対応済み）
  - 各セクションの例示テキストと `work_log 2026-04-22` の実装整合性確認
- これらは**すべて未着手**。PM#3 が整理後に着手する予定。

#### CR-SA-2（UI仕様更新、約19件）

- `scene1-setup.md`, `scene3-race.md`, `modal-houserule.md` に対して、現在の実装（本セッション中に M 扱いで変更された `emojiParser`, `calculator`, `standardParser` の挙動）を踏まえたUI仕様更新
- 「双方調整(X)」の仕様決定、`validator.ts` 責務設計なども含む
- **複合固有スキル**に関して `houserule-features.md` と `modal-houserule.md` の記述矛盾を解消する必要あり（上記B-1参照）
- これらも**すべて未着手**。

#### CR-38（history残存問題、PM#3でSAエスカレーション対象）

- 固有スキル発動位置を変更した場合に旧フェーズ history データが残存し、以降の進行がブロックされる致命的問題。`work_log 2026-03-06` で発見、PM#2 で BOARD.md に CR-38 として登録済み。
- **仕様側への反映:** `basic-rules.md` §6 途中修正運用ルール Case 2 に「固有タイプ修正時の history 挙動」の追記が必要になる可能性あり（SA判断事項）。

---

## C. APP_FLOW.md と REQUIREMENTS.md の整合性

### C-1. 相互参照の整合

- `REQUIREMENTS.md` §2 仕様インデックスに **`APP_FLOW.md` への参照がない**（archive された `ARCHITECT_HANDOVER.md` 相当の位置付けだが、インデックスからの到達経路が欠落）。
- `APP_FLOW.md` 側は末尾「参照リンク」で REQUIREMENTS.md と specs/ 以下を適切に参照。
- **整理推奨:** REQUIREMENTS.md に「アーキテクチャ俯瞰 → `APP_FLOW.md`」の行を §2 先頭に追記する。

### C-2. 記述の食い違い

| 箇所 | REQUIREMENTS.md 側 | APP_FLOW.md 側 | 状態 |
|---|---|---|---|
| 状態管理 | 記述なし（`tech-stack.md` に「Context+useReducer」と古い記述あり） | 「Zustand 一元管理 `useRaceStore`」（§1） | **矛盾 (tech-stack側を更新要)** |
| Parserコンテキスト | `parser-system.md` は `'RACE'\|'PACE'` のみ | `'RACE'\|'PACE'\|'JUDGMENT'` 3種（§5） | **矛盾 (parser-system側を更新要)** |
| Scene4遷移 | `REQUIREMENTS.md` には記載なし | Scene4-A/-B 遷移条件テーブル完備 | APP_FLOW の方が詳細。矛盾なし |
| 横断的制約 | §1 に CC-1〜CC-6 を定義 | 参照のみ（末尾リンク） | 整合 |

### C-3. APP_FLOW.md 自体の古さ

- §3 データモデルで `config.houseRules` を `object` としか記載していない。ハウスルール詳細は別管理（`houserule-features.md`）で分離が徹底されているため許容範囲。
- フィールド名 `currentPhaseId`, `paceResult`, `strategies`, `uiState.scene` は実装側（`src/types/index.ts`）と要突合。PM#3 段階では確認必須ではない。

---

## D. Archive / BACKUP フォルダの内容

### D-1. `docs/archive/`（古いセッション資料）

| ファイル名 | 内容推定 | 現行影響 |
|---|---|---|
| `DEPLOYMENT_GUIDE.md` (2026-01-23) | GitHub Pages デプロイ手順 | 参照のみ、PM#3 対象外 |
| `PM_BOARD.md` (2026-01-21) | 初期PM管理ボード（現在は `docs/management/BOARD.md` に移行済み） | 参照のみ |
| `REQUIREMENT_UPDATE_REQUEST.md` (2026-01-22) | 要件更新依頼文書（初期） | 参照のみ |
| `SCENE1_UX_REVIEW.md` (2026-01-21) | Scene1 UX レビュー（初期） | 参照のみ |
| `implementation_plan.md` (2026-01-25) | 実装計画初版 | 参照のみ |

**現行ドキュメントへの影響:** なし。完全な過去資料アーカイブとして機能。

### D-2. `docs/specs/BACKUP/`（REQUIREMENTS.md の世代バックアップ）

| ファイル名 | 内容推定 | 現行影響 |
|---|---|---|
| `REQUIREMENTS_20260122_Backup.md` (89KB) | 2026-01-22 時点の REQUIREMENTS フル版 | 参照のみ |
| `REQUIREMENTS_v2_before_parser_update.md` (90KB, 01-22) | parser更新直前の v2 | 参照のみ |
| `REQUIREMENTS_20260125_GreatEscapeFix.md` (92KB, 01-22) | 大逃げ修正後の版 | 参照のみ |
| `REQUIREMENTS_backup_20260208.md` (92KB, 01-25) | 02-08時点のフル版 | 参照のみ |
| `ESCALATION_TO_ARCHITECT_20260208.md` (02-08) | 過去の SA エスカレーション文書 | **雛形として参照価値あり**（PM#3 の ESCALATION_TO_ARCHITECT.md 作成時） |

**現行ドキュメントへの影響:** ほぼなし。ただし `ESCALATION_TO_ARCHITECT_20260208.md` は PM#3 の CR-SA-1/2 発行時のフォーマット参考に使える。

---

## E. 直近の work_log から分かる事

### E-1. `2026-04-22_emoji-parser-subtraction-fix.md`（CR-2）

- **ステータス:** 完了（Round 1 + Round 2 含む）
- **未完了・課題残り:**
  - 「技術的申し送り」として記載: `ParsedLine` に `isSubtractive` フィールドが存在せず、`diceResult` を負数化で吸収する設計。**将来的な検算ロジック再確認が推奨されている**（Low優先度、設計改善タスク化の余地）。
  - 回帰リスクは現状なし（全テスト通過で確認済み）。

### E-2. `2026-03-06_unique-skill-phase-restriction.md`（CR-1）

- **ステータス:** 完了（エスカレーションあり）
- **未完了・課題残り:**
  - 「[ESCALATION REQUIRED] history残存データによる進行ブロック」として明記された致命的問題あり。
  - 固有スキル発動位置を Mid2 → Mid1 に変更しても旧 history が残り、Mid2 再到達時に進行ブロックされる。
  - ユーザー操作の範囲では対応不能な致命的問題、**現状リセット手段なし**。
  - → PM#2 で **CR-38** として BOARD.md に登録済み、**PM#3 の SA エスカレーション対象（CR-SA-1/2 と並ぶ第3の案件）**。

---

## F. PM#3 ガイドライン整理時の整理対象リスト

SESSION_HANDOVER.md が挙げた8候補に加え、スコープ内ファイルを含めて優先度付け。

### F-1. High（改定ガイドライン反映・SA前提のため必須）

| ファイル | 理由 |
|---|---|
| `docs/REQUIREMENTS.md` | §2 インデックスに APP_FLOW.md 参照を追加、§3 Changelog に Phase 3.5 完了・CR-2b/CR-38 登録を追記 |
| `docs/management/BOARD.md` | ガイドライン改定に応じた Issue 分類・ステータス構造の見直し（CR-SA-1/2/CR-38 を整理対象化） |
| `docs/TASK_INSTRUCTION.md` | ガイドライン改定の中核。改定後の書式・責務分離に合わせた雛形更新 |
| `docs/SESSION_HANDOVER.md` | 同上、改定後フォーマットへの移行 |
| `docs/ARCHITECT_HANDOVER.md` | SA エスカレーション (CR-SA-1/2) の送付フォーマットとなるため、ガイドライン側で書式固定されていれば準拠必須 |
| `docs/ROADMAP.md` | Phase 3.5 完了反映・次フェーズ記述の現状同期 |

### F-2. Medium（改定に応じ見直す可能性ありだが内容は概ね健全）

| ファイル | 理由 |
|---|---|
| `docs/APP_FLOW.md` | インデックス登録（REQUIREMENTS.md 側から参照されていない）を直す程度。内容自体は最新 |
| `docs/specs/architecture/tech-stack.md` | **SA エスカレーション CR-SA-1 対象**、ただしガイドライン整理スコープでは「SAが修正する対象」として現状のまま次工程へ引き継ぐ |
| `docs/specs/architecture/parser-system.md` | **CR-SA-1 対象**、同上 |
| `docs/specs/ui/*.md`, `docs/specs/logic/houserule-features.md` | **CR-SA-2 対象**、同上 |

### F-3. Low（整理作業では触れず、現状維持）

| ファイル | 理由 |
|---|---|
| `docs/ideas/DECISION.md` | Concept Architect 管轄、内容は Why の定義として安定 |
| `docs/specs/logic/basic-rules.md` | 内容が最新・安定。CR-38 決着後に §6 追記の可能性あり（SA判断） |
| `docs/specs/logic/scoring-and-judgment.md` | 内容が安定、改定影響なし見込み |
| `docs/specs/architecture/image-generation.md` | 内容が安定、改定影響なし見込み |
| `docs/archive/`, `docs/specs/BACKUP/` | 過去資料。PM#3 で触れる必要なし |

### F-4. PM#3 が留意すべき矛盾点（整理中に SA に引き継ぐべき項目）

1. **複合固有スキルの発動フェーズ制約の仕様矛盾**
   - `modal-houserule.md` §1: 「連続する2つのフェーズが原則。非連続ならクリティカルエラーでブロック」
   - `houserule-features.md` §2: 「警告レベル、3つ以上含め柔軟許容」
   - → CR-SA-2 に明示的に含めるべき（PM#3 でエスカレーション文書に記載）
2. **Parser Interface 契約の欠落**
   - `parser-system.md`: `context: 'RACE' \| 'PACE'`
   - `APP_FLOW.md` §5: `'RACE' \| 'PACE' \| 'JUDGMENT'`
   - → CR-SA-1 に明示的に含める
3. **State Management 記述のレガシー残存**
   - `tech-stack.md`: Context+useReducer
   - 実装: Zustand
   - → CR-SA-1 に明示的に含める
4. **Directory Structure の実態乖離**
   - `tech-stack.md` B項: `core/calculator/` サブツリー構造想定
   - 実態: `src/core/calculator.ts` 単一ファイル
   - → CR-SA-1 に明示的に含める

---

## 総括

- **specs 側の分類構造は既に健全**（3分類×個別ファイル構成は改定ガイドラインに応じた調整余地が少ない）。
- **ガイドライン整理の主戦場は management/handover 系（F-1 High 6ファイル）**。specs は SA にエスカレーションするのが筋。
- SA エスカレーション文書作成前に、**上記 F-4 の4項目は PM#3 のエスカレーション仕様書に明示的に盛り込む必要あり**。
- `docs/archive/` および `docs/specs/BACKUP/` は現行フローに影響しないため、PM#3 整理対象外。ただし `ESCALATION_TO_ARCHITECT_20260208.md` は雛形として活用推奨。
