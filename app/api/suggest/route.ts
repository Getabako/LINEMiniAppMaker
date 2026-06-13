import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { getCodex } from "@/lib/codex/client";
import { ensureDir } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Field =
  | "appName"
  | "tagline"
  | "description"
  | "audience"
  | "customInstructions";

type Body = {
  field: Field;
  brief: Record<string, unknown>;
  hint?: string;
  current?: string;
};

const FIELD_SPEC: Record<Field, { label: string; guide: string; count: number }> = {
  appName: {
    label: "アプリ名（LINE チャネル名）",
    guide:
      "LINE ミニアプリらしい、短く覚えやすい名前。日本語/英語/造語どれでも可。サービス内容が伝わると尚良い。12 文字以内推奨。",
    count: 5,
  },
  tagline: {
    label: "一言キャッチ",
    guide:
      "アプリのトップやストア説明に出る 1 行（15〜25 文字）。ベネフィットが伝わる言い切り・問いかけなどバリエーション豊かに。",
    count: 5,
  },
  description: {
    label: "サービス概要",
    guide:
      "2〜4 行（120〜200 文字）。誰の・どんな課題を・このミニアプリでどう解決するかを具体に。LINE 上で使う前提。",
    count: 3,
  },
  audience: {
    label: "想定ユーザー",
    guide:
      "年齢層・職業・状況・利用シーン が一目で分かる 1 行（30〜60 文字）。具体的なペルソナ。",
    count: 5,
  },
  customInstructions: {
    label: "追加カスタム指示",
    guide:
      "ミニアプリ生成 AI に渡すデザイン/機能要件のメモ。1 行ずつ箇条書きで、画面構成/動き/実装したい機能/トーンなどを 4〜8 個。",
    count: 3,
  },
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const spec = FIELD_SPEC[body.field];
  if (!spec) return new Response("invalid field", { status: 400 });

  const brief = body.brief || {};
  const ctx = [
    `アプリ名: ${str(brief.appName)}`,
    `一言キャッチ: ${str(brief.tagline)}`,
    `サービス概要: ${str(brief.description)}`,
    `想定ユーザー: ${str(brief.audience)}`,
    `カテゴリ: ${str(brief.category)}`,
    `デザインスタイル: ${str(brief.style)}`,
  ].join("\n");

  const userHint = (body.hint || body.current || "").trim();
  const hintLine = userHint
    ? `ユーザーの叩き台 / メモ:\n${userHint}\n（このニュアンス・キーワードを尊重して言い換える）`
    : `ユーザーの叩き台は空。文脈から最も妥当な案を作る。`;

  const prompt = [
    `あなたは熟練の日本語コピーライター兼 LINE ミニアプリ プランナー。`,
    `今から「${spec.label}」のフィールドに入れる候補を ${spec.count} 個提案する。`,
    ``,
    `# 入力されている他のフィールド`,
    ctx,
    ``,
    `# このフィールドの方針`,
    spec.guide,
    ``,
    `# このフィールドへのヒント`,
    hintLine,
    ``,
    `# 出力ルール（厳守）`,
    `- 出力は JSON のみ。前後に文章・コードブロック記号・思考メモを一切付けない。`,
    `- 形式: {"suggestions": ["候補1", "候補2", ...]}`,
    `- ${spec.count} 個。各候補は重複せず、切り口を変える。`,
    `- 候補に番号や記号を付けない。鍵括弧で囲まない。`,
    `- ファイルの作成・読み書き・シェル実行は一切しない。最終 agentMessage に JSON だけを出力する。`,
  ].join("\n");

  const cwd = path.join(os.tmpdir(), "lineminiappmaker-suggest");
  ensureDir(cwd);

  const srv = await getCodex();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {}
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      let threadId: string | null = null;
      let turnId: string | null = null;
      let turnDone = false;
      let finalText = "";

      const onNotif = (notif: any) => {
        const { method, params } = notif;
        if (!params) return;
        if (method === "item/agentMessage/delta") {
          send("delta", { text: params.delta ?? "" });
          finalText += params.delta ?? "";
        } else if (method === "item/completed" && params.item?.type === "agentMessage") {
          if (params.item.text) finalText = params.item.text;
        } else if (method === "turn/completed") {
          turnDone = true;
        } else if (method === "thread/status/changed" && params.status?.type === "systemError") {
          turnDone = true;
        }
      };
      srv.on("notification", onNotif);

      try {
        const model = process.env.LINEMAKER_MODEL || "gpt-5.5";
        const started: any = await srv.send("thread/start", {
          cwd,
          model,
          effort: "low",
          sandbox: "read-only",
          approvalPolicy: "never",
          serviceName: "lineminiappmaker-suggest",
        });
        threadId = started.thread.id;
        const turn: any = await srv.send("turn/start", {
          threadId,
          input: [{ type: "text", text: prompt }],
          cwd,
          model,
          effort: "low",
          sandboxPolicy: { type: "readOnly" },
          approvalPolicy: "never",
        });
        turnId = turn.turn.id;

        await new Promise<void>((resolve) => {
          const tick = setInterval(() => {
            if (turnDone) {
              clearInterval(tick);
              resolve();
            }
          }, 200);
          req.signal.addEventListener("abort", () => {
            clearInterval(tick);
            resolve();
          });
        });

        const suggestions = parseSuggestions(finalText);
        send("done", { suggestions });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        srv.off("notification", onNotif);
        if (threadId && turnId) {
          srv.send("turn/interrupt", { threadId, turnId }).catch(() => {});
        }
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function str(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return "（未入力）";
}

function parseSuggestions(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return cleaned
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-\*\d\.\)）、。「」"']+/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (Array.isArray(obj?.suggestions)) {
      return obj.suggestions.map((s: unknown) => String(s)).filter(Boolean);
    }
  } catch {}
  return [];
}
