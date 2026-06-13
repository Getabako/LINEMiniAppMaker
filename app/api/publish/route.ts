import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { NextRequest } from "next/server";
import { paths } from "@/lib/paths";
import { slugifyBrand } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id: string; repoName?: string };

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (c) => (stdout += c.toString()));
    p.stderr.on("data", (c) => (stderr += c.toString()));
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    p.on("error", (err) =>
      resolve({ code: -1, stdout, stderr: stderr + (err as Error).message }),
    );
  });
}

export async function POST(req: NextRequest) {
  const { id, repoName: rawName } = (await req.json()) as Body;
  if (!id || !/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const projectDir = paths.projectDir(id);
  if (!fs.existsSync(path.join(projectDir, "index.html"))) {
    return new Response("index.html not found in project", { status: 404 });
  }

  // Derive repo name from brief if not given
  let repoName = rawName?.trim();
  if (!repoName) {
    try {
      const brief = JSON.parse(
        fs.readFileSync(path.join(projectDir, "_brief.json"), "utf8"),
      ) as { appName?: string };
      repoName = slugifyBrand(brief.appName ?? "", id);
    } catch {
      repoName = slugifyBrand("", id);
    }
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(repoName)) {
    return new Response("repoName has invalid characters", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {}
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      const fail = (msg: string) => {
        send("error", { message: msg });
        close();
      };

      // 1. gh CLI 存在チェック
      send("step", { text: "gh CLI を確認中…" });
      const ghCheck = spawnSync("gh", ["--version"], { stdio: "ignore" });
      if (ghCheck.status !== 0) {
        fail(
          "gh コマンドが見つかりません。https://cli.github.com/ からインストール後、`gh auth login` してください。",
        );
        return;
      }

      // 2. gh auth status
      const auth = await runCommand("gh", ["auth", "status"], projectDir);
      if (auth.code !== 0) {
        fail(
          "GitHub に未ログインです。ターミナルで `gh auth login` を 1 回実行してから再試行してください。",
        );
        return;
      }
      send("step", { text: "[OK] gh 認証 OK" });

      // 3. owner を取得
      const userRes = await runCommand("gh", ["api", "user", "--jq", ".login"], projectDir);
      if (userRes.code !== 0) {
        fail(`gh api user 失敗: ${userRes.stderr.slice(0, 300)}`);
        return;
      }
      const owner = userRes.stdout.trim();
      send("step", { text: `[OK] owner: ${owner}` });

      const fullRepo = `${owner}/${repoName}`;

      // 4. リポジトリ衝突チェック
      const exists = await runCommand("gh", ["repo", "view", fullRepo, "--json", "name"], projectDir);
      if (exists.code === 0) {
        fail(`リポジトリ ${fullRepo} はすでに存在します。別の名前を指定するか、UI で名前を変えてください。`);
        return;
      }

      // 5. git init / add / commit（プロジェクト一式を push）
      send("step", { text: "[push] git init + commit…" });
      // Clean any stale .git
      const gitDir = path.join(projectDir, ".git");
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
      // 生成プロジェクトに .gitignore が無ければ最低限のものを用意（node_modules 等を除外）
      const giPath = path.join(projectDir, ".gitignore");
      if (!fs.existsSync(giPath)) {
        fs.writeFileSync(
          giPath,
          ["node_modules", "dist", ".env", ".env.local", ".DS_Store", "_brief.json"].join("\n") + "\n",
        );
      } else {
        // _brief.json（内部メタ）は確実に除外
        try {
          const cur = fs.readFileSync(giPath, "utf8");
          if (!cur.includes("_brief.json")) {
            fs.appendFileSync(giPath, "\n_brief.json\n");
          }
        } catch {}
      }
      const steps: Array<{ desc: string; cmd: string; args: string[]; fatal?: boolean }> = [
        { desc: "git init", cmd: "git", args: ["init", "-b", "main"] },
        { desc: "git add", cmd: "git", args: ["add", "-A"] },
        {
          desc: "git commit",
          cmd: "git",
          args: ["-c", "user.name=LINE MiniApp Maker", "-c", "user.email=lineminiappmaker@local", "commit", "-m", `Initial LINE mini app: ${repoName}`],
          fatal: true,
        },
      ];
      for (const s of steps) {
        const r = await runCommand(s.cmd, s.args, projectDir);
        if (r.code !== 0 && s.fatal) {
          fail(`${s.desc} 失敗: ${r.stderr.slice(0, 300)}`);
          return;
        }
      }
      send("step", { text: "[OK] ローカルコミット完了" });

      // 6. gh repo create + push
      send("step", { text: `GitHub にリポジトリ作成中: ${fullRepo}` });
      const create = await runCommand(
        "gh",
        ["repo", "create", repoName, "--public", "--source", ".", "--push", "--description", "Generated by LINE MiniApp Maker"],
        projectDir,
      );
      if (create.code !== 0) {
        fail(`gh repo create 失敗: ${create.stderr.slice(0, 500)}`);
        return;
      }
      send("step", { text: `[OK] push 完了: https://github.com/${fullRepo}` });

      send("done", {
        repo: `https://github.com/${fullRepo}`,
        note: "次の手順: ① Vercel で本リポジトリを import → デプロイ（VITE_LIFF_ID を環境変数に設定）。② LINE Developers Console で LIFF を作成し、エンドポイント URL に Vercel の URL を登録。詳しくは生成された LINE入力情報.md を参照。",
      });
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
