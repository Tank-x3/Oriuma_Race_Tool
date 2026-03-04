# Image Generation Strategy（画像生成戦略）

> **管轄:** System Architect
> **出典:** `REQUIREMENTS.md` §3-C-2 Image Generation Strategy より切り出し
> **横断的制約:** `REQUIREMENTS.md` を併読のこと
> **関連:** UI仕様は `specs/ui/scene4-result.md` を参照

---

## 概要

最終結果を掲示板投稿用に画像化する機能。

---

## Technology

`html2canvas` を使用する。

### Off-screen Rendering（画面外レンダリング）

- **技術制約:** `html2canvas` は `display: none` や `visibility: hidden` が適用されている要素を描画できない仕様がある。
- **実装手法:** したがって、画像生成用コンテナは **「ブラウザのビューポート外（画面外）に絶対配置する」** 手法を採用する。
    - *CSS Example:* `position: fixed; top: 0; left: -9999px; width: 1200px;`
- これにより、ユーザーの画面（スマホ等）には表示させず、かつDOM上ではレンダリング可能な状態を維持する。

### Pagination（分割生成）

- **制限:** `html2canvas` のCanvasサイズ制限（特にモバイル端末）を回避し、可読性を維持するため、1画像あたりの最大行数を **25行** に制限する。
- **実装:** データが26件以上ある場合、事前にデータを25件ごとのチャンクに分割し、それぞれのチャンクに対して個別にレンダリング→画像生成のプロセスを実行するループ処理を実装する。

---

## Design & Extensibility（デザインと拡張性）

- **Phase 1 (MVP):** 開発速度を優先し、Tailwind CSSを用いたシンプルな標準テーブルスタイルで実装する。
- **Future Proofing:** 将来的に「電光掲示板風」等のテーマ切り替えを容易にするため、画像生成コンポーネント（`src/components/hidden/ResultImage.tsx` 等）は、データ構造とデザイン定義（CSS/ClassName）を分離した設計とする。

---

## Content Control（情報制御）

画像生成用テンプレートにおいては、**「判定(Judgment)」列などのGM管理用情報は自動的に除外（非表示化）** し、純粋な順位と着差のみを出力するデザインとする。
