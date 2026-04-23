# TRIAGE — 状況整理モード

> **⚠️ このドキュメントは、CLAUDE.md 冒頭で宣言された TRIAGE モード下における最優先ハンドオーバー文書である。**
> 本ドキュメントが存在し、かつ CLAUDE.md 冒頭に TRIAGE ブロックが残っている間は、通常ワークフロー上の作業を全面停止する。

---

## 0. メタ情報

- **開始日:** 2026-04-22
- **現在のフェーズ:** **Step 4 進行中 — 6-A 項目確定（未決 4 件クローズ）、6-B 順序付け・ロール割付待ち（別セッションで再開予定）**
- **最終更新:** 2026-04-23（未決論点 (l)(m)(n)(e) 全件確定、項目行に反映、2026-04-23 セッション区切り）

### 次セッション再開ポイント（2026-04-23 区切り）

次のセッション開始時は以下から再開すること:

1. CLAUDE.md 冒頭の TRIAGE ブロックが残っていることを確認（TRIAGE モード継続中）
2. 本 TRIAGE.md を読み、§6-A の項目確定内容と §5-1〜§5-4 の Step 3 成果を把握
3. **§6-B（順序付け・ロール割付）に着手**:
   - 対象: ゾーン 1 の 18 件 + ゾーン 2 の CR-38
   - 適用する既決定事項:
     - (i) 優先順: REPO 群 → CR-38 → DEV-1 → その他
     - (j-2) 直列方針: DOC/REPO 整備完了後に Phase 3.5 残へ戻る
     - (k-1) REPO-2 前に未コミット残滓をコミット
     - CR-SA-2 は Phase 4 前提のため据え置き
   - 各項目に実施ロール（CA/SA/PM/Engineer）を割付
4. §7 復帰手順（Step 5）を記入
5. §1 解除条件チェックリストを確認し、ユーザーの TRIAGE 解除宣言を待つ

## 1. TRIAGE 解除条件

以下を全て満たし、**ユーザーが明示的に「TRIAGE 解除」と宣言した**ときのみ、本モードを解除してよい。

- [ ] Step 1: ユーザーが「やるべきと認識していること」の自由記述が一旦完了している
- [ ] Step 2: Claude による整理・構造化（項目化・分類・優先度付け）が完了し、ユーザーがレビュー済み
- [ ] Step 3: 既存ドキュメント（STATE.md / BOARD.md / CODE_REVIEW_BOARD.md / ROADMAP.md 等）とのクロスリファレンスが完了し、齟齬・重複・漏れが洗い出されている
- [ ] Step 4: 整理結果として「今やるべきこと」の確定リストが本ドキュメントに記載され、既存ドキュメント側にも必要な反映（またはポインタ）が完了している
- [ ] Step 5: 通常ワークフロー復帰手順（どのロールで何から着手するか）が明確になっている

## 1.5 Step 1 中の先行合意事項

Step 1（自由記述）段階でユーザーと合意済の方針。Step 2/4 の整理・確定はこれを前提に進める。

| 論点 | 合意内容 | メモ |
|------|---------|------|
| コード／Docs の分離方針 | `.gitignore` で `docs/` 等を除外し、**Docs はローカル git のみで管理**（サブモジュール／別リポジトリは不採用） | 実処理は TRIAGE 解除後の復帰作業で実施 |
| Github 上の Docs 削除の履歴処理 | **最新コミットから削除（履歴は残す）**。`filter-repo` 等の履歴書き換えは行わない | 機密情報を含まない前提。含まれると判明した場合は再協議 |
| 「Docs 整備やり直し」の範囲 | **Step 2/3 の整理結果を見てから Step 4 で確定**（今は決め打たない） | 構造維持 or 再設計の二択を保留 |
| 「追加したいタスク」の扱い | **§3 の自由記述欄に追記してから Step 2 へ進む** | 重複チェックは Step 3 で既存 ROADMAP/BOARD と突合 |

## 2. 進行ステップ

### Step 1: ユーザーが「やるべきと認識していること」の書き出し（現在のフェーズ）
方式: **ユーザーが §3 の自由記述欄に直接記入 → Claude が §4 で整理・構造化 → 不足・欠落・曖昧さを Claude から質問して補完。**

### Step 2: 整理・構造化（未着手）
Claude が §3 を読み、§4 に項目化・分類・優先度付きで再構成する。

### Step 3: 既存ドキュメントとのクロスリファレンス（未着手）
STATE.md / BOARD.md / CODE_REVIEW_BOARD.md / ROADMAP.md / FINDINGS_CONSOLIDATED.md 等と突き合わせ、§5 に齟齬・重複・漏れを記録する。

### Step 4: 確定リスト作成（未着手）
§6 に「今やるべきこと」の確定リストを優先度順で記載し、必要なら既存ドキュメントに反映またはポインタを張る。

### Step 5: 通常ワークフロー復帰手順の確定（未着手）
§7 に、どのロールで何から着手するか、復帰時の最初のアクションを記載。

---

## 3. ユーザー自由記述欄（Step 1 の入力エリア）

> **記入方法（ユーザー向け）:**
> - 以下の区切り線の間に、頭の中にある「やるべきこと」を形式問わず自由に書いてください。
> - 箇条書き／文章／メモ書き／時系列／思いついた順 — どれでも構いません。粒度・順序・正確さは問いません。
> - 重複や矛盾があっても気にせず全部書き出してください（後で Claude が整理します）。
> - 「これはやらなくてよいかもしれないが気になっている」類のもやもやも、カッコ書き等で残してください。
> - 書き終わったら「書き出し終わった」「一旦ここまで」等と Claude に伝えてください。Claude は書き出しが進むまで §4 以降を触りません。

<!-- 以下の区切り線の間に自由記述 ↓ -->

---

- 仕様書を含む既存ドキュメントのリファクタリング作業中に進捗が曖昧なままプロジェクトが放置
  - 「ツールとしてのコードベース」と「ドキュメント類」を明確に分離したうえで、**再度ドキュメント整備をやり直したい**
  - 作業ガイドラインの更新が追いついておらず、ドキュメントの構造が現行ガイドラインと一致していないものがある
  - 通常の開発作業の途中からgit管理が行われているため、「ドキュメントのリファクタリング」の着手前の状態も記録が残っている
- Githubリポジトリ側の「ツールの動作に必要なファイル」以外を削除したい
  - 仕様書などのドキュメントファイルはローカル作業にのみ必要で、Githubリポジトリには含めたくない
  - ローカルgitの管理とGithubリポジトリの管理を区別し、github側に必要ないファイルをpushしないようにしたい
  - すでにgithubリポジトリ上に入ってしまった仕様書などのドキュメントファイルを削除する
- 緊急の不具合修正を行った際、コードベースが一部ドキュメント整備より先行してしまっている点がある
  - `work_logs`フォルダの作業ログを正としてドキュメントを更新する必要がある
- 追加したいタスクがあるが、すでにロードマップに相当する項目が存在しているかどうかの確認（重複チェック）
  - 他の情報整理が一通り終わってからPMセッションでやるか、PMに引き渡す前にBOARDに追加するかは保留
- `work_logs`フォルダの作業ログを「正式な作業記録」として、コードベースの情報整理のベースと位置づけたい
- 作業ガイドラインの最新化は直近のセッションで割り込みとして実施済み
  - ドキュメント全体の構造整理が作業ガイドラインの基本定義に基づいたものになっているか不明確、再確認したい
- プロジェクト固有指示として「Engineerセッション終了時、またはPMセッションの`Step 3: Verification`でGithubにpush」を追加したい
  - github側のデプロイ漏れを防止するため
  - どちらのタイミングでpushを実行すべきか（規定値）はClaudeの判断に委ねたい

### 追加タスク
- ダークモード時の配色見直し
  - クローズドベータとして複数のユーザーにテストしてもらい、うち1人から「着差判定画面での配色が適切でない」との意見あり
  - 他画面との一貫性がない可能性
  - 適用されているスタイルを詳細に確認し、修正を計画する必要あり

---

<!-- ↑ 自由記述ここまで -->

---

## 4. Claude による整理・構造化（Step 2、初稿）

§3 の自由記述を、1 件 1 タスクの粒度に分解し、分類・優先度候補・曖昧点を付した初稿。
曖昧点（§4-Z）への回答後、必要に応じて本節を改訂し、Step 3 に進む。

### 4-A. ドキュメント整備系

| ID | タスク | 粒度メモ | 優先度候補 |
|----|--------|---------|-----------|
| DOC-1 | 現行「作業ガイドライン」（**`guidelines/*.md` + `CLAUDE.md`**）と Docs 構造の整合再確認。ずれている箇所の洗い出し | 対象範囲は §4-Z-a で確定。差分抽出が主、是正は別タスク | 高（後続作業の基盤） |
| DOC-2 | 中断中の「Docs リファクタリング」を再開 or やり直し判断。構造維持 or 再設計は Step 4 で確定 | 判断タスク。実作業は別 | 中（Step 2/3 依存） |
| DOC-3 | `work_logs/` を正として、コード先行している Docs（仕様書等）を更新 | Step 3 で Claude が **`work_logs/` 全件 × `docs/` を突合し差分候補を抽出**、ユーザーがレビュー確定。反映は TRIAGE 解除後の通常フロー | 中（コードと実態の乖離解消） |
| DOC-4 | `work_logs/` を「正式な作業記録・情報整理のベース」として位置づける旨をガイドライン／CLAUDE.md に明記 | 文書ルール追加 | 中 |

### 4-B. リポジトリ運用系

| ID | タスク | 粒度メモ | 優先度候補 |
|----|--------|---------|-----------|
| REPO-1 | `.gitignore` に **`docs/` + `work_logs/` + `guidelines/` + `CLAUDE.md`** を追加し、ローカル git only 化 | 除外境界確定（§4-Z-c/h 回答）。CLAUDE.md も除外し Github は「ツールのソースコードのみ」に絞る | 高（Docs 削除前に確定） |
| REPO-2 | すでに Github に push 済の除外対象（REPO-1 範囲 ∩ Git 追跡済）を「最新コミットから削除」（履歴残置）。force-push しない | 対象: `docs/**`, `work_logs/**`, `guidelines/**`, `CLAUDE.md` のうち tracked なもの。`git rm -r --cached` + commit + push | 中（REPO-1 確定後） |
| REPO-3 | 「Engineer セッション終了時 / PM セッションの Step 3: Verification で Github push」をプロジェクト固有指示として追加 | Step 4 で Claude が 3〜4 案（Engineer 終了時 / PM Step 3 / 両方 / 条件付き）を提示 → ユーザー選択 | 中（デプロイ漏れ防止） |

### 4-C. 開発タスク系

| ID | タスク | 粒度メモ | 優先度候補 |
|----|--------|---------|-----------|
| DEV-1 | ダークモード時、着差判定画面の配色見直し。他画面との一貫性確認を含む | クローズドベータ 1 名の FB 起点。**Step 3 で Claude が `src/components/` 探索 → 該当 Scene/コンポーネント候補提示 → ユーザー確定**。実修正は TRIAGE 解除後 | 中（UX バグだが TRIAGE 外の通常フロー案件） |

### 4-D. TRIAGE 進行上の内部タスク

| ID | タスク | 粒度メモ | 優先度候補 |
|----|--------|---------|-----------|
| TRI-1 | Step 3 にて、§3 全項目を既存 ROADMAP/BOARD/CODE_REVIEW_BOARD/STATE と突合し、重複・漏れ・齟齬を検出 | Step 3 本体 | — |
| TRI-2 | Step 4 にて優先度・順序・実施ロール割付を確定 | Step 4 本体 | — |

### 4-Z. 曖昧な点・追加確認事項

Step 3 に進む前に、ユーザー回答があると整理精度が上がる項目。ユーザー回答後に §4 各表を改訂する。

全曖昧点クローズ済（2026-04-23）。内容は §4-A/B/C 各行に反映済。

- **✅ (a) DOC-1 ガイドライン範囲:** `guidelines/*.md` + `CLAUDE.md` の 2 系統に限定。`.claude/` や外部テンプレートは今回の整合確認対象外。→ DOC-1 行に反映済
- **✅ (b) DOC-3 差分抽出方法:** Claude が `work_logs/` 全件 × `docs/` を突合して差分候補を抽出。→ DOC-3 行に反映済
- **✅ (c) REPO-1 除外境界:** `docs/` + `work_logs/` + `guidelines/` を一律除外（`guidelines/` はローカル作業時の Claude 用で公開不要）。→ REPO-1/REPO-2 行に反映済
- **✅ (d) REPO-2 削除対象:** (c)(h) 確定により自明化（除外対象 ∩ Git 追跡済 = 削除対象）。→ REPO-2 行に反映済
- **✅ (e) REPO-3 push タイミング:** Step 4 で Claude が 3〜4 案提示 → ユーザー選択。→ REPO-3 行に反映済
- **✅ (f) DEV-1 画面特定:** Step 3 で Claude が `src/components/` を探索して候補提示 → ユーザー確定。→ DEV-1 行に反映済
- **✅ (g) DEV-1 の TRIAGE 内扱い:** TRIAGE では「画面特定」まで。実修正は解除後の通常フロー（PM → Engineer）へ。→ DEV-1 行に反映済
- **✅ (h) CLAUDE.md の Github 扱い:** CLAUDE.md も Github から除外し一元化。Github は「ツールのソースコードのみ」に絞る。→ REPO-1/REPO-2 行に反映済
  - **[派生確認事項]** `docs/` 除外に伴い `docs/CODE_REVIEW_BOARD.md` / `docs/REVIEW_AGENT_GUIDE.md` / `docs/REVIEW_BOARD.md` / `docs/FINDINGS_CONSOLIDATED.md` 等のコードレビュー系特別ドキュメントも Github から消える。これは一元化方針と整合するため意図通りと解釈。Step 3 で事実確認のみ行う。

---

## 5. 既存ドキュメントとのクロスリファレンス（Step 3）

### 5-1. ブロック (1) 結果: 既存進捗系 Docs との突合

**参照済ドキュメント:** `docs/handover/STATE.md`, `docs/management/BOARD.md`, `docs/ROADMAP.md`, `docs/CODE_REVIEW_BOARD.md`（grep ベース）

#### §4 各タスクの既存 Docs 上の扱い

| §4 タスク | 既存 Docs 上の対応 | 位置付け |
|----------|-------------------|---------|
| **DOC-1**（ガイドライン↔Docs 構造整合確認） | BOARD.md §155「PM#3（次回）: ガイドライン改定に伴うプロジェクト整理」として**予告のみ**存在 | 部分既知。具体化は TRIAGE 経由で本番化 |
| **DOC-2**（Docs リファク再開／やり直し判断） | 既存 Docs に明示項目なし | **新規**（TRIAGE で発生） |
| **DOC-3**（work_logs を正に Docs 更新） | STATE.md §29-38 **CR-SA-1**（tech-stack.md + parser-system.md 仕様乖離 ~15 件、EmojiParser 減算仕様が spec 未反映など）と密接。ただし CR-SA-1 は「SA 対応待ち」扱い | **部分既知だが SA 待ち滞留中**。DOC-3 を起点に CR-SA-1 を動かす位置付け |
| **DOC-4**（work_logs を正式記録と位置づけ） | 既存 Docs に明示項目なし。`work_logs/` フォルダは既存 | **新規** |
| **REPO-1**（`.gitignore` 除外設定） | 既存 Docs に明示項目なし | **新規** |
| **REPO-2**（push 済 Docs の削除） | 既存 Docs に明示項目なし | **新規** |
| **REPO-3**（push タイミング指示化） | 既存 Docs に明示項目なし | **新規** |
| **DEV-1**（ダークモード着差判定画面配色） | 類似既存項目あり:<br>・CR-20 (#5-1-2): `ThemeToggle.tsx` useEffect 修正（Medium）<br>・CR-34 (#4-2-M): `NotificationArea.tsx` ダークモード対応（Low）<br>しかし **着差判定画面（Scene 4-A = `JudgmentScene.tsx` 近辺）の配色問題は未登録** | 類似系タスク既存、本件は**新規 FB** |

#### 既存 Docs にあるが §3 でユーザーが触れていない項目（忘却・滞留リスク）

**Step 4 で「TRIAGE 後に誰が扱うか」を明示的に決める必要あり**。現時点では Claude 側の発見として列挙のみ。

| 項目 | ソース | 現状 | 滞留度 |
|------|-------|------|-------|
| **CR-SA-1**: tech-stack.md / parser-system.md の仕様乖離（約 15 件） | STATE.md §29-38, BOARD.md §37 | SA 対応待ち（未発行） | 🟡 高。DOC-3 と一部重なるが独立 SA タスク |
| **CR-SA-2**: UI 仕様・複合固有スキル矛盾（約 19 件）+ 双方調整(X)仕様決定 + `validator.ts` 責務設計 | STATE.md §40-48, BOARD.md §38 | SA 対応待ち（未発行） | 🔴 高。TRIAGE ではユーザー未言及。複合固有スキル制約が `modal-houserule.md` ↔ `houserule-features.md` で相反 |
| **CR-38**: history 残存による進行ブロック（致命的） | STATE.md §50-54, BOARD.md §31 | SA 対応待ち | 🔴 高。「致命的・進行ブロック」と記載されているが TRIAGE で未言及 |
| **High Engineer タスク CR-3〜CR-8**（6 件） | BOARD.md §42-49 | SA 完了後着手待ち | 🟡 中。Phase 3.5 進行中 |
| **Medium/Low Engineer タスク CR-9〜CR-37**（約 29 件） | BOARD.md §53-88 | High 完了後着手待ち | 🟢 低。ただし総量が大きい |
| **設計改善 CR-I-1〜5** | BOARD.md §99-103 | Low 優先度 | 🟢 低 |
| **Phase 4 ルート P4-1〜8**（ハウスルール関連 9 件） | BOARD.md §109-118 | Phase 4 以降 | 🟢 今は対象外 |
| **stash / untracked の調査レポート等** | STATE.md §78-79。現 git status に `M docs/CODE_REVIEW_BOARD.md`, `?? docs/FINDINGS_CONSOLIDATED.md` が存在 | 移行時 stash の pop 後と推定される状態。ただし commit されていない | 🟡 中。`docs/` 除外方針（REPO-1）と合わせ「削除 or 保持」を決める必要 |
| **Phase 3.2 Visual Tweaks（Phase 5 へ延期済み）** | ROADMAP.md §93 | 延期確定 | 🟢 低 |
| **Phase 5.3 ドキュメント整備（ユーザー/開発者マニュアル）** | ROADMAP.md §146-148 | 遠い将来 | 🟢 低。TRIAGE 対象外 |

#### ブロック (1) からの追加確認事項

- **✅ (i) CR-SA-2 / CR-38 の扱い（2026-04-23 確定）:**
  - **優先順序:** REPO タスク群 → CR-38 → DEV-1 → …
  - **CR-SA-2:** Phase 4（ハウスルール）タスクの前提であるため、Phase 3 系（基本ルール対応）時点では**優先しない**。Phase 4 着手と同時に動かす前提で据え置き
  - **CR-SA-1:** DOC-3 の work_logs 起点更新と相補関係のため、DOC-3 進行の延長線上で自然に解消される想定（Step 4 で詳細化）
  - **Phase 3.5 残の Engineer タスク（CR-3〜37）:** (j) の方針により組み立て

- **✅ (j) 確定（2026-04-23）: (j-2) 直列——DOC/REPO 整備先行、完了後に Phase 3.5 残へ。** 詳細は下表: TRIAGE 解除後、Phase 3.5 の停滞中タスク群と、新規 DOC/REPO タスク群をどう重ね合わせるか。3 選択肢のメリデメ:

  | 選択肢 | 動き方 | メリット | デメリット |
  |--------|--------|---------|-----------|
  | **(j-1) 並行** | 復帰後、DOC/REPO 系整備と Phase 3.5 Engineer 残タスクを並行管理。PM セッション内で両ラインを見る | ・スループット最大、Engineer タスクが止まらない<br>・Engineer の work_logs がその場で DOC へ還流できる | ・BOARD/ROADMAP の二軸管理で混乱再発リスク<br>・ロール切替・コンテキストスイッチ増加<br>・今回の TRIAGE 原因（進捗管理混乱）の再発懸念 |
  | **(j-2) 直列（DOC 先行）** | DOC/REPO 系（(i) 優先順位含む）を完全に片付けてから Phase 3.5 残タスクに戻る | ・一軸で見通し良好、混乱再発しにくい<br>・仕様準拠の品質が上がってから実装に入れる<br>・TRIAGE の"整理完遂"と相性が良い | ・Phase 3.5 High 残タスク (CR-3〜8) が滞留する期間が長くなる<br>・DEV-1 のような UX バグも DOC 整備完了まで待機 |
  | **(j-3) Phase 再定義** | Phase 3.5 を一旦クローズし、DOC/REPO 整備を Phase 3.6（または新 Phase 名）として独立定義。その後 Phase 3.5 残を別 Phase に再編 | ・ROADMAP 意味論が明確化、"Docs First"が Phase 単位で可視化<br>・新旧 Issue の棲み分けが文書構造で強制される | ・Phase 番号付け替え・既存 BOARD エントリの紐替えコスト<br>・実質的な作業順序は (j-2) 直列とほぼ同等 |

  _Claude 所見:_ 今回の TRIAGE を招いた主要原因が「進捗管理の混乱」である点を踏まえると、再発抑止の観点から **(j-2) 直列**が最も妥当。スループット懸念は DEV-1 を (i) の 3 番手（CR-38 後）に置いた上で DOC-1/2/3/4 を消化していけば、極端な滞留は起きにくい。(j-3) は意味論整理として筋が良いが、Phase 再番号で別種の混乱を生むリスクあり。

- **✅ (k) 確定（2026-04-23）: (k-1) 先にコミット → REPO-2 で tracked 解除。push タイミングは REPO-2 の tracked 解除コミットとまとめて 1 回に集約し Github 露出を最小化。** 詳細は下表: 現在 `M docs/CODE_REVIEW_BOARD.md`（+1924 行の modified、移行時 stash の pop 残）と `?? docs/FINDINGS_CONSOLIDATED.md`（untracked）が存在。REPO-1（`.gitignore` に `docs/` 追加）・REPO-2（tracked 削除）の処理と整合させる必要あり。4 選択肢のメリデメ:

  | 選択肢 | 手順概略 | メリット | デメリット |
  |--------|---------|---------|-----------|
  | **(k-1) 先にコミット → REPO-2 で tracked 解除** | 1. `git add docs/CODE_REVIEW_BOARD.md docs/FINDINGS_CONSOLIDATED.md` → commit<br>2. REPO-1 で `.gitignore` 追加<br>3. REPO-2 で `git rm --cached docs/**` 等 → commit | ・ローカル git に変更履歴が残り、将来"何があったか"が追跡可能<br>・REPO-2 の処理と一貫<br>・移行 STATE.md §78-79 の予告（「pop 後に別軸で扱う」）と整合 | ・一瞬だけ Github に変更が push される可能性（push を REPO-2 まで保留すれば回避可） |
  | **(k-2) コミットせず tracked 解除（ローカル保持）** | 1. `git rm --cached docs/CODE_REVIEW_BOARD.md` 等（未コミット変更を保持するには事前退避必要）<br>2. `.gitignore` 追加 → commit | ・Github に一切上がらない<br>・最短手順 | ・**未コミット変更（+1924 行）の履歴が失われる**<br>・stash や別ブランチへの退避が別途必要 |
  | **(k-3) 破棄** | 1. `git restore docs/CODE_REVIEW_BOARD.md`<br>2. `rm docs/FINDINGS_CONSOLIDATED.md`<br>3. REPO-1/2 へ | ・最もシンプル、手戻りゼロ | ・コードレビュー特別作業の成果物（CODE_REVIEW_BOARD.md +1924 行、FINDINGS_CONSOLIDATED.md）**を完全に失う**<br>・BOARD.md §7 が参照している詳細ソースが消える |
  | **(k-4) 別ブランチに退避してから REPO-2 と同様処理** | 1. `git switch -c archive/pre-gitignore-cleanup` で退避ブランチ<br>2. そこでコミット<br>3. main に戻って REPO-1/2 実施 | ・main 履歴をきれいに保ちつつ履歴は別ブランチに残る<br>・ローカルなら容量コスト微小 | ・運用ブランチが 1 本増える<br>・一人運用では (k-1) との差が薄い |

  _Claude 所見:_ STATE.md §78-79 の「pop 後に別軸で扱う」という当初計画との整合、および将来"この時期に何があったか"を追跡可能にする観点から **(k-1) 先にコミット → REPO-2 で tracked 解除**が妥当。push のタイミングを REPO-1/2 と同じコミットにまとめれば Github 露出も最小化できる。(k-3) は成果物喪失リスクが大きく、(k-2) は履歴消失、(k-4) は一人運用で冗長。

### 5-2. ブロック (2) 結果: work_logs/ × docs/ 差分抽出（DOC-3）

**参照:** `work_logs/*.md`（25 件）/ `docs/specs/**/*.md` / `docs/REQUIREMENTS.md` / `docs/ROADMAP.md` / `docs/management/BOARD.md` / `docs/handover/STATE.md`。最新 3 件の work_log を精読、残 22 件は `ESCALATION` / `REQUIREMENTS` / `specs` キーワードで抽出。

#### 5-2-1. work_logs 起点で docs 未反映が疑われる項目

| 起点 work_log | 内容 | spec 側の影響先 | 既存エスカ対応 | 位置付け |
|--------------|------|----------------|---------------|---------|
| `2026-04-22_emoji-parser-subtraction-fix.md` | `_isSubtractive` フラグ導入、`合計:` 行での符号反映、StandardParser regex 拡張（`Fix-dice` 対応）、`parseRace`/`parseJudgment` 両対応 | `docs/specs/architecture/parser-system.md` | ✅ **CR-SA-1 でカバー済**（STATE.md §35「EmojiParser の減算仕様が spec 側に未反映」） | CR-SA-1 を DOC-3 起点で駆動 |
| 同上（技術的申し送り） | `ParsedLine` 型に `isSubtractive` フィールドがなく、`diceResult` 負数化で吸収。将来検算ロジック含めて再確認推奨 | `docs/specs/architecture/parser-system.md` 設計セクション | 🟡 **CR-SA-1 に明示記載なし** | **DOC-3 独自の追加項目 (A)** |
| `2026-03-06_unique-skill-phase-restriction.md` | `calculator.ts` フェーズチェック追加。`[ESCALATION REQUIRED]` で history 残存問題を報告 | `docs/specs/logic/basic-rules.md` §6「途中修正運用ルール」 | ✅ **CR-SA-1 + CR-38 でカバー済**（STATE.md §53） | CR-38 側で実装方針、CR-SA-1 側で spec 明文化 |
| `2026-02-08_dice-parser-fix.md` | `(N)` を「ダイス出目総和」と明確化、チェックサム検証 3 工程化 | `docs/REQUIREMENTS.md` | ✅ **対応完了**（ROADMAP §83、BOARD §139 で「更新完了」とマーク済み） | 確認のみ |
| `REVIEW_20260121_Scene2.md` | バリデーションメッセージ文言が `REQUIREMENTS.md` L291-294 と不一致 | `docs/specs/ui/scene2-gate.md` もしくは `docs/REQUIREMENTS.md` / 実装側 | 🟡 **Phase 3.5 CR-10（#1-3a-4 バリデーションメッセージ形式修正）と関連するが CR-SA-2 の UI 仕様整合には明示未統合** | **DOC-3 独自の追加項目 (B)** |
| `2026-01-20_localization_feedback.md` | SetupScene が REQUIREMENTS.md と大きく乖離。次の work_log (2026-01-21) でリファクタ実施 | ROADMAP 上 Phase 2.2 完了。ただし現状コードとの再整合は未確認 | 🟢 **既に Scene 1 として実装完了扱い**。再整合確認は DOC-1 Scope で間に合う | DOC-1 で吸収 |

#### 5-2-2. Phase 1〜2 期 work_log（19 件）の扱い

- `phase1_completion.md`, Scene 1/2/3/4 実装ログ群, feedback_fixes_roundN, `20260126_oonige_fix.md`, `20260126_NavigationAndFix.md`, `20260123_deployment_setup.md` 等
- いずれも **ROADMAP で完了マーク済み**。spec との齟齬は CR-SA-1 / CR-SA-2（体系整理済み）に吸収された扱い
- DOC-3 として再スキャンの必要性は **低**。ただし DOC-4（work_logs を正式記録と位置付ける）の観点では全件を対象に扱う

#### 5-2-3. DOC-3 の位置付け明確化

§4-A の DOC-3（work_logs を正として docs を更新）は、実質的に次の内訳で成立する:

1. **CR-SA-1 の駆動（SA 案件のサブセット）**
   - `parser-system.md` 更新（EmojiParser / StandardParser 減算仕様、JUDGMENT コンテキスト）
   - `tech-stack.md` 更新（Zustand、平坦ディレクトリ、docs 実態）
   - `basic-rules.md` §6 追記（history 残存時挙動 ← CR-38 の実装方針確定後）
2. **DOC-3 独自の追加項目（新規）**
   - **(A) `ParsedLine.isSubtractive` の設計議論** — `parser-system.md` に「`diceResult` 負数化吸収の現設計とその代替案（isSubtractive フィールド導入）」を注記、または CR-I-6 として設計改善枠に登録
   - **(B) Scene 2 バリデーションメッセージ文言の現状確認** — 現コードが REVIEW_20260121_Scene2.md で指摘された不一致を解消済みか確認。Phase 3.5 CR-10 に統合 or 独立扱いを Step 4 で判断
3. **確認のみ**
   - `(N)` / チェックサム仕様: 既に REQUIREMENTS.md 反映済と明記されているため差分なし想定（念のため目視確認）

#### 5-2-4. 追加確認事項

- **(l) DOC-3 独自項目 (A) の扱い:** `ParsedLine.isSubtractive` 設計議論を `parser-system.md` への**注記**で済ませるか、**設計改善タスク（CR-I-6 として BOARD 追加）**として独立させるか。
- **(m) DOC-3 独自項目 (B) の扱い:** Phase 3.5 CR-10 との重複を Step 4 で整理するか、本 TRIAGE 内で CR-10 のスコープに明示統合する記述を追加するか。
### 5-3. ブロック (3) 結果: src/components/ 探索 — DEV-1 画面候補抽出

**参照:** `src/components/**/*.tsx`（14 ファイル）。`dark:` クラス数と規模（行数）を指標に「ダークモード整備度」を定量比較。

#### 5-3-1. `dark:` クラス実装状況（Scene 別）

| コンポーネント | 行数 | `dark:` 件数 | 密度 | 位置付け |
|--------------|------|-------------|------|---------|
| `scene/GateScene.tsx`（Scene 2） | 328 | 33 | 高 | 基準の 1 つ |
| `scene/setup/EntryForm.tsx`（Scene 1 子） | — | 21 | 高 | |
| `scene/race/RaceDashboard.tsx`（Scene 3 子） | — | 17 | 高 | |
| `scene/setup/RaceConfigForm.tsx`（Scene 1 子） | — | 14 | 中 | |
| `scene/race/PhaseOutput.tsx` | — | 11 | 中 | |
| `scene/RaceScene.tsx`（Scene 3 親） | — | 7 | 中 | |
| `scene/race/PhaseInput.tsx` | — | 6 | 中 | |
| `layout/Layout.tsx` | — | 4 | — | |
| **`scene/JudgmentScene.tsx`（Scene 4-A）** | **337** | **3** | 🔴 **極低** | **DEV-1 主対象** |
| `scene/SetupScene.tsx`（Scene 1 親） | — | 2 | — | 子に委任、数値上の密度低下は想定内 |
| `ui/ThemeToggle.tsx` | — | 1 | — | 単一要素、対応済み扱い |
| **`scene/ResultScene.tsx`（Scene 4-B）** | **190** | **0** | 🔴 **完全未対応** | **DEV-1 副対象（新規発見）** |
| `ui/NotificationArea.tsx` | 52 | 0 | 🟡 未対応 | CR-34 (#4-2-M) として既に BOARD 登録済（Low） |
| `ui/Notification.tsx` | 67 | 0 | 🟡 未対応 | 既存 BOARD に配色項目無し |

#### 5-3-2. DEV-1 スコープ候補

ユーザー §3 記述:「**着差判定画面での配色が適切でない**」「**他画面との一貫性がない可能性**」を踏まえ:

1. **主対象 🔴 `scene/JudgmentScene.tsx`（Scene 4-A 着差判定画面）**
   - 全 337 行に対し `dark:` は L244 / L277 / L303 の 3 件のみ、いずれも見出し文字色の `dark:!text-slate-200`
   - 背景色（`bg-yellow-50`, `bg-white`, `bg-gray-50`, `bg-blue-50`, `bg-red-50`）
   - 文字色（`text-gray-500`, `text-gray-400`, `text-gray-800`, `text-yellow-700`, `text-yellow-800`, `text-blue-600`）
   - 枠線（`border-gray-200`, `border-gray-100`, `border-yellow-400`, `border-red-200`）
   - 以上すべてに `dark:*` 対応が欠落 → ダークモード時にライトモード色そのまま出現、コントラスト破綻の典型パターン
2. **副対象 🔴 `scene/ResultScene.tsx`（Scene 4-B 結果画面）— 新規発見**
   - `dark:` が 0 件、完全未対応
   - Scene 4-A → 4-B は判定フローとして連続、ユーザー言及の「他画面との一貫性」観点からも一体で修正が自然
3. **関連既存 🟡 `ui/NotificationArea.tsx` / `ui/Notification.tsx`**
   - NotificationArea は CR-34 (Low) で登録済。Notification は配色項目未登録
   - DEV-1 と同一 PR に含めるかは Step 4 で判断
4. **一貫性基準の参照先**
   - `GateScene.tsx` (33 件) の実装パターンが最も整備されており、DEV-1 修正時の基準として利用可能

#### 5-3-3. 追加確認事項

- **(n) DEV-1 スコープ:** `JudgmentScene` のみか、`ResultScene` を同時に含めるか、さらに `NotificationArea`/`Notification` まで束ねるか。Step 4 で確定。
### 5-4. ブロック (4) 結果: guidelines + CLAUDE.md ↔ Docs 構造整合

**参照済:** `guidelines/concept-architect.md`, `guidelines/system-architect.md`, `guidelines/pm.md`, `guidelines/engineer.md`, `CLAUDE.md`、および `docs/**/*.md` 実在ファイル一覧。

#### A 群: ガイドラインで言及されているが CLAUDE.md 構成に無く、かつ実在もしない

| 項目 | ソース | 状態 | 整理 |
|------|-------|------|------|
| `docs/ideas/BOARD.md` | `concept-architect.md` §16 (Step 0: Whiteboard として作成前提) | 未実在 | CA ロールセッション未実施だが、ロール運用上は作成想定。CLAUDE.md 構成も追記要 |
| `docs/ideas/REJECTED.md` | `concept-architect.md` §29 (決定アウトプットとして定義) | 未実在 | 同上 |
| `docs/ARCHITECT_FEEDBACK.md` | `concept-architect.md` §20 / `system-architect.md` §6, §82 (CA↔SA 双方向フィードバック経路) | 未実在 | 必要時に作成する一時ファイル扱い。CLAUDE.md 構成に注記欠落 |

#### B 群: 実在するが CLAUDE.md 構成に記載されていない

| 項目 | 実在 | CLAUDE.md 構成 | 整理 |
|------|------|---------------|------|
| `docs/management/DEPLOY_GUIDE.md` | ✅ 実在 | ❌ 未記載 | PM 管轄フォルダ内のデプロイ手順。CLAUDE.md 構成に追記要 |
| `docs/_archived/migration_reports/` （3 ファイル） | ✅ 実在 | 🟡 `_archived/` は記載ありだが下位構造未記載 | アーカイブ配下の細分は必ずしも記載不要。ただし移行経緯の保全目的を注記すると良い |
| `docs/handover/TRIAGE.md` | ✅ 実在（本作業で新規） | ❌ 未記載 | TRIAGE 解除時に追記 or 削除方針を確定 |

#### C 群: 特別作業ドキュメントの扱いのずれ

| 項目 | CLAUDE.md §87 | ガイドライン側 | 整理 |
|------|--------------|---------------|------|
| `docs/CODE_REVIEW_BOARD.md` / `docs/FINDINGS_CONSOLIDATED.md` / `docs/REVIEW_BOARD.md` / `docs/REVIEW_AGENT_GUIDE.md` | 「特別作業。通常ワークフロー外。通常 PM セッションからは参照のみ」と定義 | 4 ガイドラインのいずれにも言及なし | **ガイドライン側に「通常ロールから特別作業ドキュメントには触らない」の明示が欠落**。DOC-1 是正候補 |

#### D 群: プロジェクト不整合（テンプレ流入・移行残存）

| 項目 | ソース | 問題 |
|------|-------|------|
| `gas_src/` 言及 | `engineer.md` §7 Capabilities | race は React SPA で GAS 不使用。テンプレ由来の残存記述。要削除候補 |
| `C:\Gemini_Temp\Guideline\templates\MIGRATION_GUIDE.md` 参照 | `CLAUDE.md` §28 「移行・セットアップ」 | 移行は 2026-04-22 完了済み（STATE.md §76）。実質不要な指示。要削除 or 「完了」注記 |
| `PROJECT_OVERVIEW.md` 言及 | `system-architect.md` §42 Legacy Analysis | CLAUDE.md 構成に無く実在もしない。テンプレ残存の可能性 |

#### E 群: ルール間の相互参照・一貫性

| 項目 | 状況 |
|------|------|
| 「セッション終了はユーザー主導、AI 側から切替提案禁止」 | CLAUDE.md §23 + 4 ガイドラインの Session Management で一貫 ✅ |
| 「全ドキュメント日本語」 | CLAUDE.md §26 で宣言、各ガイドラインにも個別記述あり ✅ |
| 「Docs First」 | CLAUDE.md §24 で宣言、各ガイドラインで「チャット合意 NG」明記 ✅ |
| `pm.md` の「1 Session = 1 Task」原則 | TRIAGE モード（本作業）は明示的な例外扱いで CLAUDE.md 冒頭ブロックにより上書き ✅ |
| Engineer → PM → SA のエスカレーション経路 | `engineer.md` §100-119 → `pm.md` §53-63 / §100-112 → `system-architect.md` §28-37 で連結 ✅ |

#### DOC-1 整理候補 —— 是正が必要な項目

§4 DOC-1 「ガイドライン↔Docs 構造整合確認」の**是正タスク**として想定される作業（実作業は TRIAGE 解除後）:

1. **CLAUDE.md §43 ディレクトリ構成の更新:**
   - `docs/ideas/BOARD.md` / `docs/ideas/REJECTED.md` を追記（CA ロール用、未作成扱い注記可）
   - `docs/ARCHITECT_FEEDBACK.md` を追記（一時ファイル注記）
   - `docs/management/DEPLOY_GUIDE.md` を追記
2. **CLAUDE.md §28 「移行・セットアップ」の削除 or 完了注記化**
3. **`engineer.md` の `gas_src/` 言及を削除**
4. **`system-architect.md` の `PROJECT_OVERVIEW.md` 言及の削除 or 存在確認注記化**
5. **4 ガイドラインに「特別作業ドキュメント（CLAUDE.md §87 参照）は通常ロールセッションで編集しない」旨を追記**
6. **（TRIAGE 解除時）CLAUDE.md 構成への `docs/handover/TRIAGE.md` 記載追加 or 削除方針の確定**

## 6. 「今やるべきこと」確定リスト（Step 4）

### 6-0. 本セクションの位置付け（2026-04-23 時点: ドラフト / 項目列挙段階）

本セクションは 2 段階で確定する:
- **6-A（本段階）:** §3/§5 由来の全項目を **ID 付きで列挙**。項目の漏れ・粒度・不要項目の有無をユーザー確認。
- **6-B（次段階）:** (i) の優先順序（REPO → CR-38 → DEV-1）と (j-2) 直列方針を軸に順序付け、実施ロール（CA/SA/PM/Engineer）を割付。未決論点 (l)(m)(n) もここで確定。

### 6-A. 全項目リスト（順序付け前・ドラフト）

#### ゾーン 1: TRIAGE 解除直後に実施する新規タスク（§3 由来 + §5-4 DOC-1 派生）

| ID | タスク | 由来 | 備考 |
|----|-------|------|------|
| **REPO-0** | 現在の未コミット残滓（`M docs/CODE_REVIEW_BOARD.md` +1924 行 / `?? docs/FINDINGS_CONSOLIDATED.md`）をコミット | §5-1 (k) | (k-1) 確定。REPO-1/2 実施の前処理 |
| **REPO-1** | `.gitignore` に `docs/` + `work_logs/` + `guidelines/` + `CLAUDE.md` を追加 | §3, §4-B | (c)(h) 確定。除外境界 |
| **REPO-2** | 除外対象 ∩ Git 追跡済ファイルを `git rm -r --cached` → コミット → push で Github から削除（履歴残置・force-push 無し） | §3, §4-B | (c)(d)(h) 確定 |
| **REPO-3** | **PM セッション Step 3 Verification での Github push** を規定値とし、`guidelines/pm.md` Step 3 に明記。`guidelines/engineer.md` Step 3b 側にも「push は PM 側が行う」旨を注記 | §3, §4-B | ✅ (e) 確定：PM Step 3 Verification 時 push |
| **DOC-1a** | CLAUDE.md §43 ディレクトリ構成に `docs/ideas/BOARD.md` / `docs/ideas/REJECTED.md` / `docs/ARCHITECT_FEEDBACK.md` / `docs/management/DEPLOY_GUIDE.md` を追記 | §5-4 A群/B群 | DOC-1 是正候補 #1 |
| **DOC-1b** | CLAUDE.md §28「移行・セットアップ」を削除 or 完了注記化 | §5-4 D群 | DOC-1 是正候補 #2。移行は 2026-04-22 完了済 |
| **DOC-1c** | `guidelines/engineer.md` Capabilities の `gas_src/` 言及を削除 | §5-4 D群 | DOC-1 是正候補 #3。race は React SPA、GAS 不使用 |
| **DOC-1d** | `guidelines/system-architect.md` の `PROJECT_OVERVIEW.md` 言及の削除 or 存在確認注記化 | §5-4 D群 | DOC-1 是正候補 #4。テンプレ残存 |
| **DOC-1e** | 4 ガイドラインに「特別作業ドキュメント（CLAUDE.md §87 参照）は通常ロールセッションで編集しない」旨を追記 | §5-4 C群 | DOC-1 是正候補 #5 |
| **DOC-1f** | TRIAGE 解除時に CLAUDE.md 構成への `docs/handover/TRIAGE.md` 記載方針（追記 or 削除）を確定 | §5-4 B群 | DOC-1 是正候補 #6。TRIAGE 解除手続きと同時実施 |
| **DOC-2** | 中断していた Docs リファクタリングの再開 or やり直し判断（構造維持 or 再設計） | §3, §4-A | §4-Z-a 確定（対象 guidelines + CLAUDE.md）。実作業範囲は §5-1 〜 §5-4 の所見を見て 6-B で確定 |
| **DOC-3a** | `work_logs/` 起点で CR-SA-1 を駆動: `parser-system.md` / `tech-stack.md` 更新、`basic-rules.md` §6 追記（CR-38 との連携要） | §5-2, §5-1 | DOC-3 の主要サブセット。SA ロール案件 |
| **DOC-3b** | `ParsedLine.isSubtractive` 設計議論を **`parser-system.md` に注記のみ**（「現設計は diceResult 負数化で吸収、将来の検算ロジック拡張時に再確認」） | §5-2 独自項目(A) | ✅ (l) 確定：注記のみ、CR-I-6 登録はしない |
| **DOC-3c** | Phase 3.5 **CR-10 のスコープ記述**に「Scene 2 バリデーションメッセージ文言（`REVIEW_20260121_Scene2.md` 指摘）の現状確認」を追記し、DOC-3c 自体はクローズ。実作業は Phase 3.5 再開時に CR-10 として一括実施 | §5-2 独自項目(B) | ✅ (m) 確定：CR-10 に統合しクローズ |
| **DOC-3d** | `(N)`/チェックサム仕様の REQUIREMENTS.md 反映状態の念のための目視確認 | §5-2 | 対応完了済みと記録されているが要確認 |
| **DOC-4** | `work_logs/` を「正式な作業記録・コードベース情報整理のベース」と位置づける旨を guidelines / CLAUDE.md に明記 | §3, §4-A | 新規ルール追加 |
| **DEV-1a** | `scene/JudgmentScene.tsx`（Scene 4-A）のダークモード配色整備（`GateScene.tsx` を参照基準） | §3, §5-3 | ✅ (n) 確定：DEV-1 主対象 |
| **DEV-1b** | `scene/ResultScene.tsx`（Scene 4-B）のダークモード配色整備（dark: 0 件、完全未対応） | §5-3 新規発見 | ✅ (n) 確定：DEV-1 副対象、Scene 4 フロー一体修正 |
| ~~DEV-1c~~ | `ui/NotificationArea.tsx` / `ui/Notification.tsx` の配色整備 | §5-3 関連既存 | ✅ (n) 確定：**ゾーン 1 から除外、既存 CR-34 の枠で扱う**（ゾーン 3 参照） |

#### ゾーン 2: 既存滞留案件のうち TRIAGE 解除直後に動かすもの

| ID | タスク | 由来 | 備考 |
|----|-------|------|------|
| **CR-38** | history 残存問題の SA 対応（`basic-rules.md` §6 追記 + 実装方針確定） | §5-1 | (i) 優先度 2 番手。DOC-3a と連動（basic-rules.md 追記） |

#### ゾーン 3: ゾーン 1+2 完了後に戻る先（参考情報、TRIAGE 内では着手しない）

| ID | 区分 | 内容 | 備考 |
|----|------|------|------|
| CR-SA-1（DOC-3a に吸収） | 既存 SA | tech-stack.md + parser-system.md 仕様更新 約15件 | ゾーン 1 の DOC-3a で実質カバー |
| CR-34（+ Notification.tsx） | 既存 Engineer Low | NotificationArea.tsx ダークモード対応（+ Notification.tsx の配色も同 Issue 枠で扱う） | (n) 確定で DEV-1 から分離。Phase 3.5 Low 枠で実施 |
| CR-SA-2 | 既存 SA | UI 仕様・複合固有スキル矛盾 約19件 + 双方調整(X) + validator 責務 | **Phase 4 前提のため Phase 3 系では優先しない**（(i) 確定） |
| Phase 3.5 High CR-3〜CR-8 | 既存 Engineer | 6 件 | (j-2) 直列：ゾーン 1+2 完了後に再開 |
| Phase 3.5 Medium CR-9〜CR-24 | 既存 Engineer | 16 件 | 同上 |
| Phase 3.5 Low CR-25〜CR-37 | 既存 Engineer | 13 件 | 同上 |
| 設計改善 CR-I-1〜5 | 既存 | Low 据え置き | Phase 3.5 内の最終処理 |
| Phase 4 ルート P4-1〜P4-8 | 既存 | ハウスルール等 9 件 | Phase 4 以降 |

#### ゾーン 4: TRIAGE 内部手続き

| ID | タスク | 備考 |
|----|-------|------|
| **TRI-3** | Step 5（§7）の復帰手順確定 | 6-B で実施 |
| **TRI-4** | ユーザー明示宣言による TRIAGE 解除 → CLAUDE.md 冒頭 TRIAGE ブロック削除 + `docs/handover/TRIAGE.md` のアーカイブ or 削除 | DOC-1f と同時実施 |

### 6-A 時点の未決論点（全件クローズ）

全 4 件が 2026-04-23 に確定済。内容は各項目行に反映済。

| 論点 | 確定内容 |
|------|---------|
| ✅ (l) | DOC-3b: parser-system.md に注記のみ（CR-I-6 独立タスク化はしない） |
| ✅ (m) | DOC-3c: Phase 3.5 CR-10 にスコープ追記、DOC-3c 自体はクローズ |
| ✅ (n) | DEV-1: a + b（JudgmentScene + ResultScene）。DEV-1c は既存 CR-34 枠で扱う |
| ✅ (e) | REPO-3: PM Step 3 Verification で push を規定値 |

### 6-A 項目数サマリ（未決確定後）

- ゾーン 1（新規 TRIAGE 解除直後タスク）: **18 件**（REPO 4, DOC 10, DEV 2, DOC-2 1, その他 1）— DEV-1c 1 件をゾーン 3 側の CR-34 枠へ移送
- ゾーン 2（既存滞留のうち解除直後に動かす）: **1 件**（CR-38）
- ゾーン 3（参考情報、TRIAGE では着手せず）: **8 カテゴリ**（CR-34 追加）
- ゾーン 4（TRIAGE 内部手続き）: **2 件**
- 未決論点: **0 件（全クローズ）**

## 7. 通常ワークフロー復帰手順（Step 5、未着手）

_TRIAGE 解除時点で最初にどのロールが何から着手するかを記載。_

## 7. 通常ワークフロー復帰手順（Step 5、未着手）

_TRIAGE 解除時点で最初にどのロールが何から着手するかを記載。_

---

## 変更履歴
- 2026-04-22: TRIAGE モード開始、本ドキュメント新規作成
- 2026-04-22: Step 1 中の先行合意事項（§1.5）を追加。ユーザー §3 追記後に Step 2 へ進む
- 2026-04-22: §3 追加タスク（ダークモード配色）を受け、Step 2 §4 初稿を記入。曖昧点 (b)(c)(d)(e)(f) に回答を得て反映。新論点 (h) CLAUDE.md 扱いを追加
- 2026-04-23: 残曖昧点 (a)(g)(h) に回答を得て §4-Z 全クローズ。REPO-1/2 除外対象に CLAUDE.md を追加。Step 2 完了、Step 3 着手待ち
- 2026-04-23: Step 3 着手。ブロック (1) 既存進捗系 Docs 突合を §5-1 に記入。新規確認事項 (i)(j)(k) を提起
- 2026-04-23: (i) 優先順位確定（REPO → CR-38 → DEV-1、CR-SA-2 は Phase 4 待ち）。(j)(k) にメリデメ整理と Claude 所見を追記
- 2026-04-23: (j)(k) 確定。Step 3 ブロック (4) guidelines + CLAUDE.md ↔ Docs 構造整合確認を §5-4 に記入（A/B/C/D/E 群で分類、DOC-1 是正候補 6 項目抽出）
- 2026-04-23: Step 3 ブロック (2) work_logs × docs 差分抽出を §5-2 に記入。DOC-3 を「CR-SA-1 駆動 + 独自 (A)(B) + 確認のみ」に分解。新規確認事項 (l)(m) 提起
- 2026-04-23: Step 3 ブロック (3) src/components/ 探索を §5-3 に記入。DEV-1 主対象 `JudgmentScene.tsx`（dark: 3件のみ）+ 副対象 `ResultScene.tsx`（dark: 0件）を特定。Step 3 全 4 ブロック完了。新規確認事項 (n) 提起
- 2026-04-23: Step 4 着手。§6-A に全項目リスト（順序付け前・ドラフト）を記入。ゾーン 1（19 件）+ ゾーン 2（1 件）+ ゾーン 3（参考）+ ゾーン 4（内部手続 2 件）+ 未決論点 4 件
- 2026-04-23: 未決論点 (l)(m)(n)(e) 全件確定。DEV-1c をゾーン 3 CR-34 枠へ移送、DOC-3c を CR-10 統合でクローズ。ゾーン 1 は 18 件に。次段階は 6-B（順序付け・ロール割付）
- 2026-04-23: セッション区切り。次セッションで §6-B から再開。再開ポイントを §0 に明記
