import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const projectDir = paths.projectDir(id);
  if (!fs.existsSync(projectDir)) {
    return new Response("not found", { status: 404 });
  }

  const zip = new AdmZip();

  // プロジェクト一式を zip 化（node_modules / .git / 内部メタは除外）
  const EXCLUDE = new Set(["node_modules", ".git", "dist", "_brief.json"]);
  for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = path.join(projectDir, entry.name);
    if (entry.isDirectory()) {
      zip.addLocalFolder(full, entry.name);
    } else {
      zip.addLocalFile(full);
    }
  }

  const buf = zip.toBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="line-app-${id}.zip"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  });
}
