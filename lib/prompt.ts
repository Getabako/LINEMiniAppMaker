export type LineBrief = {
  appName: string;
  tagline: string;
  description: string;
  audience: string;
  category: string;
  primaryColor: string;
  accentColor: string;
  style: string;
  styleCustom?: string;
  features: string[];
  featuresCustom?: string;
  provider: string;
  providerKind: string; // "法人" | "個人事業主" | "個人"
  privacyUrl?: string;
  termsUrl?: string;
  contactEmail?: string;
  needBackend: boolean;
  generateImages: boolean;
  customInstructions?: string;
  characterRefPaths?: string[];
};

export function buildCodexPrompt(brief: LineBrief): string {
  const extraFeatures = (brief.featuresCustom || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const allFeatures = [...brief.features, ...extraFeatures];
  const featuresStr = allFeatures.length
    ? allFeatures.map((s) => `- ${s}`).join("\n")
    : "- LINEログイン（LIFF）でプロフィール表示\n- お知らせ一覧";

  const styleStr = [brief.style, brief.styleCustom?.trim()]
    .filter(Boolean)
    .join(" / ");

  const backendBlock = brief.needBackend
    ? `## バックエンド（必要）

このアプリは状態の保存（会員情報・ポイント・予約・注文など）が必要です。**Vercel Serverless Functions** を使ってください。

- \`api/\` ディレクトリに TypeScript の関数を置く（例: \`api/users/me.ts\`, \`api/points/index.ts\`）。
- DB が必要なら **Prisma 5.22.0**（6.x/7.x 非互換なので必ず 5.22.0）+ **Neon PostgreSQL** を想定したスキーマを \`prisma/schema.prisma\` に書く。
- DB 接続文字列は \`process.env.DATABASE_URL\` から読む。\`.env.example\` に \`DATABASE_URL=\` を記載。
- **LIFF の id_token 検証**: フロントは \`liff.getIDToken()\` で取得したトークンを Authorization ヘッダで送り、サーバ側は \`https://api.line.me/oauth2/v2.1/verify\` で検証する方式にする（\`LINE_CHANNEL_ID\` を \`.env.example\` に記載）。
- DB が無くても動くよう、未設定時はメモリ/モックでフォールバックして画面が壊れないようにする。`
    : `## バックエンド（不要）

このアプリはサーバ保存を必要としません。状態は **localStorage** と Zustand で保持し、フロントエンド完結（Vercel 静的ホスティング）で動くようにしてください。\`api/\` は作らなくてよい。`;

  const imageBlock = brief.generateImages
    ? `## 画像（重要）

あなた（Codex）に内蔵されている **\`image_gen\` ツール（gpt-image-2 / ChatGPT サブスク内蔵）** を直接呼んで、アプリ内で使うアイコン・ヒーロー・背景・イラストを生成し、\`public/images/\` 配下に PNG として保存してください。

### 🚨 絶対ルール
- **API キーは使わない**（\`OPENAI_API_KEY\` を読まない、\`openai\` SDK を使わない、\`curl https://api.openai.com\` も叩かない）。
- **スクリプトを書かない**。image_gen ツールを **直接呼び出して** PNG を吐く。
- 透過背景は使えない（不透明 PNG のみ）。解像度は 16 の倍数、最大 3840px。

### 生成する枚数の目安
- アプリのメインビジュアル / ロゴ的アイコン 1〜2 枚
- 主要機能ごとのアイコンやサムネ 2〜6 枚
- 合計 **4〜8 枚**

### ファイル名・参照
- 半角英数 + ハイフン + \`.png\`（例: \`hero.png\`, \`icon-point.png\`）。保存先は \`public/images/\`。
- コードからは \`/images/<filename>\` の絶対パスで参照。
- プロンプトは **英語**で具体的に。アプリのトーン（${styleStr} / 主色 ${brief.primaryColor} / ターゲット ${brief.audience}）に統一感を持たせる。

### 失敗したら
レート制限等でエラーが出たら、**そのまま処理を続けて** アプリ本体は必ず完成させる（API キー利用に逃げない）。`
    : `## 画像

画像生成はしない。アイコンはインライン SVG / 絵文字 / Tailwind の装飾で表現する。`;

  const refs = (brief.characterRefPaths || []).filter(
    (p) => p && p.trim().length > 0,
  );
  const characterBlock = refs.length
    ? `## キャラクター参照画像（アプリに登場させる）

以下の画像をキャラクター参照として、オンボーディングや空状態イラスト等に **同一人物・同一画風** で登場させてください（表情・ポーズは場面に合わせる）。image_gen の image-to-image でリファレンスとして渡す。生成 PNG は \`public/images/\` に保存:

${refs.map((p, i) => `- ref${i + 1}: ${p}`).join("\n")}`
    : "";

  const customBlock = brief.customInstructions?.trim()
    ? `# 追加カスタム指示（ユーザー記述・最優先で反映）

以下はユーザーが自由記述で指定した追加要件です。**他のデフォルト仕様より優先**して反映してください。

${brief.customInstructions.trim()}
`
    : "";

  // 申請情報の差し込み値
  const providerLine = brief.provider?.trim() || "（提供元・要記入）";
  const privacyLine = brief.privacyUrl?.trim() || "（プライバシーポリシー URL・要記入）";
  const termsLine = brief.termsUrl?.trim() || "（利用規約 URL・任意）";
  const contactLine = brief.contactEmail?.trim() || "（サポート用メール・要記入）";

  return `# あなたへの作業指示

あなたは LINE ミニアプリ開発に精通したフルスタックエンジニア兼デザイナーです。
**ファイルに書き込む形** で、**実際に動く LINE ミニアプリ一式**（フロント + 必要ならバックエンド）と、**LINE 審査申請用ドキュメント**を、現在のディレクトリ（cwd）配下に生成してください。

# 🚨 出力ルール（最重要・絶対に守る）
- **コード本文を回答メッセージに書かない**。必ず **ファイルに書く**（\`apply_patch\` ツール or シェルの \`cat > file <<'EOF'\` 等）。
- 最終回答メッセージは「生成したファイル一覧と次の手順」を **10 行程度**にまとめるだけ。
- 生成物は \`npm install && npm run build\` が通る、**そのままビルド・デプロイできる**状態にする。

# 技術スタック（厳守）
- **React 19 + TypeScript + Vite**（\`npm create vite\` 相当の構成を手で作る）
- **状態管理: Zustand**
- **スタイリング: Tailwind CSS 3.4.17**（4.x は使わない / PostCSS 構成が違うため）
- **LINE 連携: LIFF SDK v2**（\`@line/liff\`）
- **ホスティング: Vercel**（\`vercel.json\` を用意）
${brief.needBackend ? "- **バックエンド: Vercel Serverless Functions（api/）+ 必要なら Prisma 5.22.0 + Neon PostgreSQL**" : "- バックエンドなし（フロント完結 / localStorage）"}

# 🚨 LINE ミニアプリ 審査の必須要件（過去のリジェクト事例より・厳守）
1. **認証は必ず LIFF SDK** を使う（\`liff.init({ liffId })\` → \`liff.getProfile()\` / \`liff.getIDToken()\`）。
   - OAuth2 リダイレクト（\`access.line.me\` への遷移）は **絶対 NG**。アプリ内認証で完結させる。
2. **ミニアプリ外への遷移を発生させない**（ボタンで外部 URL に \`window.location.href\` で飛ばさない）。
3. **プライバシーポリシー / 利用規約はアプリ内モーダルで閲覧可能**にする（外部リダイレクトしない導線）。
4. \`index.html\` の \`<title>\` は **日本語のアプリ名**（${brief.appName}）にする。
5. \`index.html\` の \`<head>\` に LIFF SDK を読み込む:
   \`\`\`html
   <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
   \`\`\`
   （npm の \`@line/liff\` を使う場合は import でも可。どちらか一方で確実に init すること）
6. **LIFF ID はビルド時に環境変数 \`VITE_LIFF_ID\` から読む**。未設定でもクラッシュせず「LIFF ID 未設定」のプレースホルダで開発できるようにする（\`.env.example\` に \`VITE_LIFF_ID=\` を記載）。
7. デバッグツール（vConsole 等）は本番ビルドに含めない。

# アプリ情報
- アプリ名（チャネル名）: ${brief.appName}
- 一言キャッチ: ${brief.tagline}
- カテゴリ: ${brief.category}
- 主色: ${brief.primaryColor} / アクセント: ${brief.accentColor}
- デザインスタイル: ${styleStr}
- 想定ユーザー: ${brief.audience}
- 提供元（事業者）: ${providerLine}（${brief.providerKind}）

# サービス概要
${brief.description}

# 実装する機能（選択 + 自由記述）
以下の機能を、LINE ミニアプリとして自然な画面構成（ボトムタブ or ヘッダーナビ）で実装してください。各機能はダミーデータでも良いので **実際に画面遷移して触れる**状態にする。

${featuresStr}

${backendBlock}

# UI / デザイン要件
- **モバイルファースト**（375px 基準。LINE の WebView を想定）。全画面（LIFF size: full）。
- LINE らしい清潔感。グラデーション・角丸・適切な余白・タップしやすいボタン（44px 以上）。
- 主色 ${brief.primaryColor} / アクセント ${brief.accentColor} を基調に、${styleStr} のテイスト。
- ローディング / 空状態 / エラー状態も用意。
- アクセシビリティ（alt、aria-label、コントラスト）。
- 文言はすべて **日本語**。

${imageBlock}

${characterBlock}

${customBlock}

# 生成するファイル構成（目安）
\`\`\`
package.json            # name, scripts(dev/build/preview), deps(react,react-dom,zustand,@line/liff), devDeps(vite,@vitejs/plugin-react,typescript,tailwindcss@3.4.17,postcss,autoprefixer)
index.html              # 日本語 title + LIFF SDK script + #root
vite.config.ts
tsconfig.json
tailwind.config.js      # content 設定
postcss.config.js
.env.example            # VITE_LIFF_ID= など
vercel.json             # SPA rewrites（"/(.*)" -> "/index.html"）
src/
  main.tsx
  App.tsx
  lib/liff.ts           # liff.init ラッパ（VITE_LIFF_ID 使用 / 未設定フォールバック）
  store/                # Zustand ストア
  features/             # 各機能の画面
  components/           # 共通 UI（モーダル含む）
  index.css             # Tailwind ディレクティブ
${brief.needBackend ? "api/                    # Vercel Serverless Functions\nprisma/schema.prisma    # 必要なら（Prisma 5.22.0）\n" : ""}public/images/          # 画像（生成する場合）
README.md               # セットアップ・デプロイ手順
LINE入力情報.md          # ★ LINE 審査申請まとめ（下記テンプレを埋めて必ず生成）
\`\`\`

# ★ LINE入力情報.md（審査申請まとめ）— 必ず生成

\`LINE入力情報.md\` を作り、以下を **このアプリの内容で埋めて** 記載してください（埋められない箇所は「要記入」と明示）。LINE Developers Console での申請にそのまま使えるようにする。

\`\`\`markdown
# LINEミニアプリ 申請情報 — ${brief.appName}

## 1. チャネル基本設定
| 項目 | 値 |
|---|---|
| チャネル名 | ${brief.appName} |
| チャネル説明 | （サービス概要 + 末尾に「提供元：${providerLine}」を必ず記載） |
| カテゴリ | ${brief.category} |
| メールアドレス | ${contactLine} |
| プライバシーポリシーURL | ${privacyLine} |
| サービス利用規約URL | ${termsLine} |
| 権限(Scope) | profile, openid |

## 2. ウェブアプリ設定（LIFF）
| 項目 | 値 |
|---|---|
| エンドポイントURL（審査用） | （Vercel のデプロイ URL を記入） |
| エンドポイントURL（本番用） | （本番 URL を記入） |
| LIFF ID | （チャネル作成後に発行 → .env の VITE_LIFF_ID に設定） |
| サイズ | full |
| Scope | openid, profile |
| 友だち追加オプション | On (normal) |
| シェアターゲットピッカー | （使う場合 ON） |

## 3. 事業情報 / 連絡先
| 項目 | 値 |
|---|---|
| 提供元（事業者） | ${providerLine}（${brief.providerKind}） |
| 担当者氏名 | （要記入） |
| 担当者メール | ${contactLine} |
| 担当者電話 | （要記入） |

## 4. 申請コメント（テンプレ）
「${brief.appName}」は、（サービス概要を1-2文で）。LIFF SDK による LINE 認証を利用し、ミニアプリ外への遷移は発生しません。事業者：${providerLine}。ご審査のほどよろしくお願いいたします。

## 5. 申請前チェックリスト
- [ ] LIFF SDK 認証（access.line.me への遷移なし）
- [ ] title が日本語アプリ名
- [ ] プラポリ・利用規約をアプリ内モーダルで閲覧可能
- [ ] VITE_LIFF_ID を審査用に設定しデプロイ済み
- [ ] PC / スマホ（LINE WebView）両方で動作確認
- [ ] 同プロバイダーの他アプリが審査中でない
\`\`\`

# 作業手順
1. 構成を軽く決める
${brief.generateImages ? "2. **image_gen ツール（gpt-image-2）** で必要画像を生成し `public/images/` に保存（API キー / スクリプト禁止・組み込みツールを直接呼ぶ）" : ""}
${brief.generateImages ? "3" : "2"}. プロジェクト一式を **ファイルとして** 生成（apply_patch / シェル）
${brief.generateImages ? "4" : "3"}. \`LINE入力情報.md\` を生成
${brief.generateImages ? "5" : "4"}. \`package.json\` が \`npm install\` の通る内容か自分で確認する
${brief.generateImages ? "6" : "5"}. 完了報告は 10 行程度（ファイル一覧 + 次の手順）

# 🚨 再強調
- コードは会話に書かない。**ファイルに書く**。
- 認証は **LIFF SDK のみ**。外部リダイレクト禁止。
- \`LINE入力情報.md\` を **必ず**生成する。
${brief.generateImages ? "- 画像は image_gen 内蔵ツールで直接生成。API キー禁止。" : ""}
`;
}
