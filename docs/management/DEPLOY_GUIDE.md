# 自動デプロイガイド

## 概要
このプロジェクトはGitHub Actionsによる自動デプロイが設定済みです。
`main` または `master` ブランチにソースコード（`src/`等）の変更をpushすると、自動的にビルド＆GitHub Pagesへデプロイされます。

> **Note:** `docs/`, `work_logs/`, `.agent/`, `*.md` への変更のみの場合はデプロイはトリガーされません。

---

## 基本コマンド（コピペ用）

### 1. 変更をコミット
```powershell
cd c:\u_temp\race
git add .
git commit -m "変更内容の説明"
```

### 2. リモートへpush（デプロイ開始）
```powershell
git push origin main
```
> pushが完了すると、GitHub Actionsが自動的にビルド＆デプロイを実行します。

### 3. デプロイ状況の確認
ブラウザで以下のURLを開いてActionsタブを確認：
- https://github.com/[ユーザー名]/[リポジトリ名]/actions

---

## ワンライナー（まとめてコミット＆push）
```powershell
cd c:\u_temp\race && git add . && git commit -m "Update" && git push origin main
```

---

## トラブルシューティング

### pushが拒否された場合
```powershell
git pull origin main --rebase
git push origin main
```

### 強制push（注意：履歴を上書き）
```powershell
git push origin main --force
```

---

## 仕組み（内部動作）

pushすると `.github/workflows/deploy.yml` が自動実行され、以下の処理が行われます:

1. GitHub上の仮想環境で `npm run build` を実行し、公開用ファイル（`dist/`）を生成
2. 生成されたファイルを `gh-pages` ブランチにアップロード
3. GitHub Pages が `gh-pages` ブランチの内容をWebサイトとして公開

`main` ブランチは「ソースコード」、`gh-pages` ブランチは「公開用ファイル」として分離されています。

---

## 公開URL
デプロイ完了後、以下のURLでアクセス可能：
- `https://[ユーザー名].github.io/[リポジトリ名]/`
