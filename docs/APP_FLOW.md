# APP_FLOW.md — アプリケーションフロー図

> **管轄:** System Architect
> **役割:** アプリ全体のScene遷移・データフロー・状態管理の俯瞰図。各specファイルの詳細に入る前に全体像を掴むための地図。

---

## 1. アーキテクチャ概要

### 状態管理

**Zustand 一元管理** — 単一の `useRaceStore`（`src/store/useRaceStore.ts`）が全Sceneの状態を保持する。Context API やローカル state への分散は行わない。

### Scene レンダリング

`App.tsx` が `uiState.scene` の値に基づいて、対応する Scene コンポーネントを条件付きレンダリングする。ルーティングライブラリは使用しない。

```
App.tsx
  └─ Layout
     ├─ SetupScene      (scene === 'setup')
     ├─ GateScene        (scene === 'gate')
     ├─ RaceScene        (scene === 'race')
     ├─ JudgmentScene    (scene === 'judgment')
     └─ ResultScene      (scene === 'result')
```

---

## 2. Scene 遷移フロー図

### 正方向フロー（メインルート）

```
┌─────────────┐     moveToGate()     ┌─────────────┐     startRace()     ┌─────────────────┐
│  Scene 1    │ ──────────────────> │  Scene 2    │ ──────────────────> │   Scene 3       │
│   SETUP     │                     │    GATE     │                     │    RACE         │
│ レース設定  │ <────────────────── │  枠順抽選   │ <────────────────── │  レース進行     │
│ エントリー  │     moveToSetup()   │             │     moveToGate()    │  (フェーズループ)│
└─────────────┘                     └─────────────┘                     └────────┬────────┘
       ▲                                                                         │
       │                                                              detectJudgmentNeeds()
       │                                                                    │         │
       │                                                              判定必要    判定不要
       │                                                                    │         │
       │                                                                    ▼         │
       │                            moveToResult()                ┌──────────────┐    │
       │                          ┌────────────────────────────── │  Scene 4-A   │    │
       │                          │                               │  JUDGMENT    │    │
       │                          │                               │  判定割込    │    │
       │                          ▼                               └──────────────┘    │
       │                  ┌──────────────┐                                            │
       │   resetRace()    │  Scene 4-B   │ <──────────────────────────────────────────┘
       └───────────────── │   RESULT     │              moveToResult()
                          │  最終結果    │
                          └──────────────┘
```

### Scene 3 内部のフェーズシーケンス

`config.midPhaseCount` の値に応じて、レースループの長さが可変する。

```
midPhaseCount = 0:  Start → Pace → End
midPhaseCount = 1:  Start → Pace → Mid → End
midPhaseCount = 2:  Start → Pace → Mid1 → Mid2 → End
midPhaseCount = 3:  Start → Pace → Mid1 → Mid2 → Mid3 → End
midPhaseCount = 4:  Start → Pace → Mid1 → Mid2 → Mid3 → Mid4 → End
```

フェーズ遷移は `useRaceEngine`（`src/hooks/useRaceEngine.ts`）が管理する。

### 遷移条件テーブル

| From | To | アクション | 条件 |
|------|----|-----------|------|
| Scene 1 | Scene 2 | `moveToGate()` | 全参加者の名前・脚質・固有スキル・発動位置が入力済み |
| Scene 2 | Scene 3 | `startRace()` | dice1d100 結果を Parser で解析し枠順確定後 |
| Scene 2 | Scene 1 | `moveToSetup()` | 「戻る」ボタン（任意） |
| Scene 3 | Scene 2 | `moveToGate()` | 「戻る」ボタン（任意、エントリー誤り修正用） |
| Scene 3 内 | 次フェーズ | `nextPhase()` | 現フェーズのダイス結果入力済み（Pace はペース値取得済み） |
| Scene 3 内 | 前フェーズ | `prevPhase()` | 「戻る」ボタン（任意） |
| Scene 3 (End) | Scene 4-A | `moveToJudgment()` | `detectJudgmentNeeds()` で判定対象あり |
| Scene 3 (End) | Scene 4-B | `moveToResult()` | `detectJudgmentNeeds()` で判定対象なし |
| Scene 4-A | Scene 4-B | `moveToResult()` | 判定ダイス入力完了 |
| Scene 4-B | Scene 1 | `resetRace()` | 「新規レース」ボタン |

---

## 3. データモデル概要

> 型定義の完全版: `src/types/index.ts`

### RaceState（グローバル状態）

| フィールド | 型 | 説明 |
|-----------|------|------|
| `config.midPhaseCount` | `number` | 中盤ダイスの回数（0-4） |
| `config.fullGateSize` | `number \| null` | フルゲート人数（1-100） |
| `config.houseRules` | `object` | ハウスルール有効/無効フラグ群 |
| `participants` | `Umamusume[]` | 全参加者のデータ配列 |
| `currentPhaseId` | `string` | 現在のフェーズID（'Start', 'Pace', 'Mid', 'End' 等） |
| `paceResult` | `{ face, label }` | ペース判定結果（dice1d9の出目とラベル） |
| `strategies` | `Strategy[]` | 脚質定義（固定値・ダイス・ペース補正テーブル） |
| `uiState.scene` | `string` | 表示中のScene識別子 |

### Umamusume（参加者データ）

| フィールド | 確定タイミング | 説明 |
|-----------|-------------|------|
| `name`, `strategy`, `uniqueSkill` | Scene 1 | エントリー情報 |
| `gate` | Scene 2 | 枠順（dice1d100で決定） |
| `score` | Scene 3 各フェーズ | 累計スコア（フェーズごとに再計算） |
| `history` | Scene 3 各フェーズ | フェーズ別ダイス入力履歴 |
| `judgment` | Scene 4-A | 写真判定(1d5) / 着差判定(1d2)の結果 |

---

## 4. Scene 別データフロー

### Scene 1: Setup（設定・エントリー）

```
[ユーザー操作]                     [Store 更新]
中盤回数スライダー操作        →  setMidPhaseCount(n)
フルゲート人数入力            →  setFullGateSize(n) → generateParticipants(n)
参加者テーブル編集            →  updateParticipant(id, { name, strategy, uniqueSkill })
「次へ」ボタン                →  moveToGate()  →  scene = 'gate'
```

### Scene 2: Gate（枠順抽選）

```
[表示] エントリー確認テキスト
[表示] ダイス出力テンプレート  →  "[名前] dice1d100=" を全参加者分生成
[貼付] 掲示板結果テキスト     →  StandardParser.parse(text, participants, 'RACE')
[確定] 枠順確定ボタン         →  applyGateAssignments() → startRace()  →  scene = 'race'
```

### Scene 3: Race（レース進行ループ）

各フェーズで以下を繰り返す:

```
[出力] PhaseOutput  →  脚質別ダイステンプレート生成（"大逃げ 30+dice3d8="）
[入力] PhaseInput   →  貼り付けテキストを Parser で解析
                    →  history[phaseId] にダイス結果を保存
                    →  Calculator.calculateTotalScore() でスコア再計算
[表示] Dashboard    →  スコア降順ランキング・着差表示
[遷移] nextPhase()  →  次フェーズへ（End完了時は判定検出へ）
```

**Pace フェーズの特殊性:**
- 全参加者共通の dice1d9 を1回だけ入力
- `setPaceResult(face, label)` でストアに保存
- 以降のフェーズで各脚質の `paceModifiers[face]` がスコアに反映

### Scene 4-A: Judgment（判定割り込み）

```
[検出] RankingCalculator.detectJudgmentNeeds()
       ├─ スコア同点 2名以上  →  写真判定（dice1d5）
       └─ スコア1点差の隣接   →  着差判定（dice1d2）
[出力] 判定対象者のダイステンプレート
[入力] 判定ダイス結果を Parser で解析  →  participant.judgment に保存
[遷移] moveToResult()  →  scene = 'result'
```

### Scene 4-B: Result（最終結果）

```
[計算] RankingCalculator.calculateFinalRanking()
       ソート優先度: Score DESC → Photo DESC → Gate ASC
[表示] 最終順位・着差テーブル
       着差表現: 同着 / ハナ / アタマ / クビ / 帯分数(差/4)
[出力] テキストコピー / 画像保存（html2canvas）
[遷移] resetRace()  →  全データクリア → scene = 'setup'
```

---

## 5. Parser コンテキスト

掲示板テキストの解析は `StandardParser`（`src/core/parser/standardParser.ts`）が担当する。解析コンテキストは3種。

| コンテキスト | 使用Scene | ダイス形式 | 解析対象 |
|------------|----------|-----------|---------|
| `RACE` | Scene 2（枠順）、Scene 3（各フェーズ） | `XdY`（1d100, 3d8 等） | 参加者名 + ダイス結果 |
| `PACE` | Scene 3（Paceフェーズ） | `1d9` | ペース判定の出目のみ |
| `JUDGMENT` | Scene 4-A | `1d5`（写真）/ `1d2`（着差） | 参加者名 + 判定ダイス結果 |

---

## 6. 修正フロー（戻り操作）

### Scene 間の戻り

| 戻り経路 | アクション | データ挙動 |
|---------|-----------|-----------|
| Scene 2 → Scene 1 | `moveToSetup()` | participants のエントリー情報は保持。gate は Scene 2 で再確定。 |
| Scene 3 → Scene 2 | `moveToGate()` | エントリー誤り発覚時に使用。participants・history は保持。Scene 2 で枠順を再抽選。 |
| Scene 4-B → Scene 1 | `resetRace()` | participants・paceResult・config.fullGateSize を全クリア。midPhaseCount は保持。 |

### Scene 3 内のフェーズ戻り

| 戻り経路 | アクション | データ挙動 |
|---------|-----------|-----------|
| 任意フェーズ → 前フェーズ | `prevPhase()` | history は保持。前フェーズのダイス結果を再確認・上書き可能。 |
| Start → Scene 2 | `moveToGate()` | 序盤フェーズからScene 2に戻る（枠順の修正が必要な場合）。 |

### 新規レース

`resetRace()` は以下をクリアする:
- `participants` → `[]`
- `config.fullGateSize` → `null`
- `paceResult` → `{ face: null, label: null }`
- `uiState.scene` → `'setup'`
- `currentPhaseId` → `'setup'`

※ `config.midPhaseCount` と `strategies` は保持される（連続開催時の利便性のため）。

---

## 参照リンク

- [REQUIREMENTS.md](REQUIREMENTS.md) — 横断的制約（CC-1〜CC-6）
- [specs/ui/](specs/ui/) — Scene別UI仕様（6ファイル）
- [specs/logic/](specs/logic/) — ロジック仕様（3ファイル）
- [specs/architecture/](specs/architecture/) — アーキテクチャ仕様（3ファイル）
