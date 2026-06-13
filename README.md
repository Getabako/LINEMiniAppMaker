# LINE ミニアプリ Maker

質問に答えるだけで、Codex が **LINE ミニアプリ一式**（React 19 + TypeScript + Vite + Zustand + Tailwind + LIFF）を自動生成。アプリ内の画像も AI で作り、**LINE 審査の申請情報（LINE入力情報.md）**まで一緒に作ります。GitHub へのワンクリック公開つき。

成果物は **そのまま `npm install` → `npm run dev` で動く LINE ミニアプリのプロジェクト一式**。

## 使い方（友達に渡すのはこの 1 行）

### Mac

**ターミナル**を開いて、下を 1 行コピペして Enter:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Getabako/LINEMiniAppMaker/main/install.sh)"
```

### Windows

**PowerShell** を開いて、下を 1 行コピペして Enter:

```
iwr -useb https://raw.githubusercontent.com/Getabako/LINEMiniAppMaker/main/install.ps1 | iex
```

初回は Node / Codex CLI / git / gh を自動で入れます。ChatGPT のログイン画面が出るのでサインインしてください。URL がターミナルに表示されるので、ブラウザに貼って開きます。終了は **Ctrl+C**。

## 機能

- **3 ステップウィザード** — アプリ名・概要・カテゴリ・色・スタイル・搭載機能・申請情報を選ぶだけ
- **よく使う機能を選択で実装** — 会員証 / ポイント / クーポン / モバイルオーダー / 予約 / EC / 診断 など。自由記述でなんとなく伝えるのも OK
- **Codex がプロジェクト一式を自動生成** — React 19 + TS + Vite + Zustand + Tailwind 3.4.17 + LIFF SDK。必要ならバックエンド（Vercel Functions + Prisma + Neon）も
- **画像も AI 生成** — Codex 組み込みの `image_gen` (gpt-image-2) で `public/images/` に保存（ChatGPT サブスク内・API キー不要）
- **LINE 審査の申請情報を自動作成** — `LINE入力情報.md`（チャネル設定・LIFF 設定・事業情報・申請コメント・チェックリスト）を埋めて出力
- **LIFF 認証 / 審査対応** — `access.line.me` への外部遷移をしない、プラポリ／規約はアプリ内モーダル、title 日本語化などのリジェクト対策を反映
- **GitHub にワンクリック公開** — `gh repo create` でリポジトリ作成 → push

## 動作要件

- macOS（Intel / Apple Silicon）または Windows 10/11
- ChatGPT Plus / Pro / Business / Enterprise いずれか
- GitHub 公開を使う場合: `gh auth login` を 1 回

## 生成物の使い方

1. ZIP ダウンロード or GitHub プッシュで取得
2. `npm install` → `npm run dev`（Vite dev server）
3. Vercel にデプロイ（環境変数 `VITE_LIFF_ID` を設定）
4. LINE Developers Console で LIFF を作成 → エンドポイント URL に Vercel の URL を登録
5. 同梱の `LINE入力情報.md` を見ながら審査申請

## 共有について

このツールは **各ユーザーが自分の Mac/Windows で動かす** 設計です。Codex の認証は各人の `~/.codex/auth.json` に縛られています。
