"use client";

import { useEffect, useRef, useState } from "react";
import { RefImagePicker } from "./components/RefImagePicker";

type Brief = {
  appName: string;
  tagline: string;
  description: string;
  audience: string;
  category: string;
  primaryColor: string;
  accentColor: string;
  style: string;
  styleCustom: string;
  features: string[];
  featuresCustom: string;
  provider: string;
  providerKind: string;
  privacyUrl: string;
  termsUrl: string;
  contactEmail: string;
  needBackend: boolean;
  generateImages: boolean;
  customInstructions: string;
  characterRefPaths: string[];
};

type StyleSpec = { name: string; texture: string; textTone: "light" | "dark" };
const STYLES: StyleSpec[] = [
  { name: "モダン", texture: "modern", textTone: "light" },
  { name: "ポップ", texture: "pop", textTone: "light" },
  { name: "ミニマル", texture: "minimal", textTone: "dark" },
  { name: "ナチュラル", texture: "natural", textTone: "light" },
  { name: "ラグジュアリー", texture: "luxury", textTone: "light" },
  { name: "サイバー", texture: "cyber", textTone: "light" },
  { name: "和風", texture: "japanese", textTone: "light" },
  { name: "パステル", texture: "pastel", textTone: "dark" },
  { name: "ダークモード", texture: "dark", textTone: "light" },
  { name: "コーポレート", texture: "corporate", textTone: "light" },
  { name: "グラスモーフィズム", texture: "glass", textTone: "dark" },
  { name: "ニューモーフィズム", texture: "neumorphism", textTone: "dark" },
];

const CATEGORIES = [
  "会員証 / ポイント",
  "モバイルオーダー",
  "予約 / 受付",
  "EC / ショップ",
  "エンタメ / ゲーム",
  "メディア / 動画",
  "診断 / クイズ",
  "イベント",
  "その他",
];

const FEATURE_OPTIONS = [
  "LINEログイン（プロフィール表示）",
  "デジタル会員証（QR / バーコード）",
  "ポイント管理・履歴",
  "スタンプカード",
  "クーポン配布・利用",
  "モバイルオーダー（メニュー・カート・注文）",
  "テーブルオーダー",
  "予約・受付（カレンダー）",
  "順番待ち・整理券",
  "ショップ / EC（商品一覧・購入）",
  "ニュース / お知らせ配信",
  "動画 / ギャラリー閲覧",
  "イベント情報・申込",
  "診断 / クイズ",
  "ガチャ / 抽選",
  "アンケート / フォーム",
  "チャット相談 / 問い合わせ",
  "スタッフ・講師紹介",
  "店舗情報 / アクセス地図",
  "LINE Pay 決済",
  "シェア機能（友だちに送る）",
  "プッシュ通知連携",
  "多言語対応",
  "FAQ / ヘルプ",
];

const INITIAL: Brief = {
  appName: "",
  tagline: "",
  description: "",
  audience: "",
  category: "会員証 / ポイント",
  primaryColor: "#06C755",
  accentColor: "#00B900",
  style: "モダン",
  styleCustom: "",
  features: ["LINEログイン（プロフィール表示）", "ニュース / お知らせ配信"],
  featuresCustom: "",
  provider: "",
  providerKind: "法人",
  privacyUrl: "",
  termsUrl: "",
  contactEmail: "",
  needBackend: true,
  generateImages: true,
  customInstructions: "",
  characterRefPaths: [],
};

type Log = { kind: string; text: string; ts: number };
type Phase = "wizard" | "generating" | "done";

export default function Home() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>(INITIAL);
  const [refPaths, setRefPaths] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("wizard");
  const [logs, setLogs] = useState<Log[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const append = (kind: string, text: string) =>
    setLogs((p) => [...p, { kind, text, ts: Date.now() }]);

  const toggleFeature = (s: string) => {
    setBrief((b) => ({
      ...b,
      features: b.features.includes(s)
        ? b.features.filter((x) => x !== s)
        : [...b.features, s],
    }));
  };

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const startGenerate = async () => {
    setPhase("generating");
    setLogs([]);
    setResultId(null);
    append("info", "Codex に LINE ミニアプリ生成を依頼…");

    const briefToSend: Brief = { ...brief, characterRefPaths: refPaths };

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: briefToSend }),
    });

    if (!res.body) {
      append("error", "通信に失敗しました");
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try {
          handleEvent(ev, JSON.parse(data));
        } catch {
          append("raw", data);
        }
      }
    }
  };

  const handleEvent = (ev: string, data: any) => {
    switch (ev) {
      case "init":
        append(
          "info",
          `生成 ID: ${data.id} ${data.willGenerateImages ? "(画像生成あり / Codex 組み込み image_gen)" : "(画像生成なし)"}`,
        );
        break;
      case "heartbeat":
        setLogs((p) => {
          const idx = p.findIndex((l) => l.kind === "heartbeat");
          const entry: Log = {
            kind: "heartbeat",
            text: `Codex 稼働中… ${data.elapsedSec} 秒経過`,
            ts: Date.now(),
          };
          if (idx >= 0) {
            const c = [...p];
            c[idx] = entry;
            return c;
          }
          return [...p, entry];
        });
        break;
      case "step":
        append(data.kind || "step", data.text);
        break;
      case "agent":
        if (data.text) append("agent", data.text);
        break;
      case "delta":
        setLogs((p) => {
          const last = p[p.length - 1];
          if (last && last.kind === "agent-delta") {
            const c = [...p];
            c[c.length - 1] = { ...last, text: last.text + (data.text ?? "") };
            return c;
          }
          return [...p, { kind: "agent-delta", text: data.text ?? "", ts: Date.now() }];
        });
        break;
      case "reasoning_delta":
        setLogs((p) => {
          const last = p[p.length - 1];
          if (last && last.kind === "reasoning-stream") {
            const c = [...p];
            c[c.length - 1] = { ...last, text: last.text + (data.text ?? "") };
            return c;
          }
          return [...p, { kind: "reasoning-stream", text: data.text ?? "", ts: Date.now() }];
        });
        break;
      case "cmd_output":
        append("cmd-out", data.text ?? "");
        break;
      case "stderr":
        append("stderr", data.text ?? "");
        break;
      case "done":
        setResultId(data.id);
        setPhase("done");
        append("done", "LINE ミニアプリ 完成");
        break;
      case "error":
        append("error", data.message ?? JSON.stringify(data));
        break;
    }
  };

  const reset = () => {
    setPhase("wizard");
    setStep(0);
    setLogs([]);
    setResultId(null);
  };

  if (phase === "done" && resultId) {
    return <ResultView id={resultId} onReset={reset} />;
  }
  if (phase === "generating") {
    return <GeneratingView logs={logs} logEndRef={logEndRef} />;
  }

  return (
    <main className="min-h-screen text-stone-800">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
        <SectionTitle
          title="LINE ミニアプリ Maker"
          subtitle="if(塾) LINE ミニアプリ自動生成室 — 申請情報まで一式作成"
        />

        <Stepper step={step} />

        {step === 0 && (
          <CharacterDialog
            ashura={{ img: "ashura_suggest", text: "ワシは LINE ミニアプリ Maker の案内人じゃ。まずは何を作るか、基本情報を授けてくれぬか。" }}
            mobuta={{ img: "mobuta_present", text: "どんなアプリにしようかな！" }}
          />
        )}
        {step === 1 && (
          <CharacterDialog
            ashura={{ img: "ashura_think", text: "次は見た目と機能じゃ。よく使う機能は選ぶだけで実装される。色も決めてくれ。" }}
            mobuta={{ img: "mobuta_idea", text: "会員証とポイント入れたい！" }}
          />
        )}
        {step === 2 && (
          <CharacterDialog
            ashura={{ img: "ashura_normal", text: "仕上げじゃ。提供元や申請情報を入れておけば、LINE審査用の書類も一緒に作るぞ。" }}
            mobuta={{ img: "mobuta_happy", text: "申請まで楽できるの助かる〜！" }}
          />
        )}

        {step === 0 && <Step1 brief={brief} setBrief={setBrief} />}
        {step === 1 && (
          <Step2 brief={brief} setBrief={setBrief} toggleFeature={toggleFeature} />
        )}
        {step === 2 && (
          <Step3
            brief={brief}
            setBrief={setBrief}
            refPaths={refPaths}
            setRefPaths={setRefPaths}
          />
        )}

        <div className="flex justify-between pt-4">
          <button
            disabled={step === 0}
            onClick={prev}
            className="px-7 py-3.5 rounded-full text-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            戻る
          </button>
          {step < 2 ? (
            <button
              onClick={next}
              disabled={step === 0 && (!brief.appName.trim() || !brief.description.trim())}
              className="px-8 py-3.5 rounded-full text-lg font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
            >
              次へ
            </button>
          ) : (
            <button
              onClick={startGenerate}
              disabled={brief.features.length === 0}
              className="px-8 py-3.5 rounded-full text-lg font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
            >
              LINE ミニアプリを生成する
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="w-full bg-white/80 backdrop-blur border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#06C755] text-white flex items-center justify-center font-bold tracking-wider text-xs">
            LINE
          </div>
          <span className="font-bold tracking-wide text-stone-800">LINE ミニアプリ Maker</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-4 py-1.5 rounded-full text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium shadow-sm">
            Ashura
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-stone-200/70">
      <img
        src="/characters/ashura_normal.png"
        alt="アシュラくん"
        className="w-12 h-12 object-contain"
        draggable={false}
      />
      <div>
        <h1 className="text-3xl font-bold tracking-wide text-green-600">{title}</h1>
        <p className="text-base text-stone-500 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["基本情報", "デザイン・機能", "申請情報・生成"];
  return (
    <div className="flex items-center gap-3 text-sm">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-3 flex-1">
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-base font-bold shadow-sm ${
              i <= step
                ? "bg-gradient-to-br from-green-500 to-emerald-500 border-green-400 text-white"
                : "border-stone-300 text-stone-400 bg-white"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-lg font-medium ${i === step ? "text-stone-800" : "text-stone-400"}`}>
            {l}
          </span>
          {i < labels.length - 1 && <div className="flex-1 h-px bg-stone-300" />}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-lg font-semibold tracking-wide text-stone-800">{label}</span>
      {hint && <span className="block text-base text-stone-500 leading-relaxed">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3.5 text-lg leading-relaxed tracking-wide text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 shadow-sm";

type Accent = "sky" | "rose" | "emerald" | "violet" | "amber" | "indigo" | "teal";

const ACCENT: Record<Accent, { border: string; bg: string; ring: string; ico: string; tag: string; iconBg: string }> = {
  sky:     { border: "border-sky-300",     bg: "bg-sky-50/60",     ring: "focus:ring-sky-300 focus:border-sky-400",     ico: "text-sky-600",     tag: "bg-sky-100 text-sky-700",     iconBg: "bg-sky-100" },
  rose:    { border: "border-rose-300",    bg: "bg-rose-50/60",    ring: "focus:ring-rose-300 focus:border-rose-400",    ico: "text-rose-600",    tag: "bg-rose-100 text-rose-700",    iconBg: "bg-rose-100" },
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50/60", ring: "focus:ring-emerald-300 focus:border-emerald-400", ico: "text-emerald-600", tag: "bg-emerald-100 text-emerald-700", iconBg: "bg-emerald-100" },
  violet:  { border: "border-violet-300",  bg: "bg-violet-50/60",  ring: "focus:ring-violet-300 focus:border-violet-400",  ico: "text-violet-600",  tag: "bg-violet-100 text-violet-700",  iconBg: "bg-violet-100" },
  amber:   { border: "border-amber-300",   bg: "bg-amber-50/60",   ring: "focus:ring-amber-300 focus:border-amber-400",   ico: "text-amber-600",   tag: "bg-amber-100 text-amber-700",   iconBg: "bg-amber-100" },
  indigo:  { border: "border-indigo-300",  bg: "bg-indigo-50/60",  ring: "focus:ring-indigo-300 focus:border-indigo-400",  ico: "text-indigo-600",  tag: "bg-indigo-100 text-indigo-700",  iconBg: "bg-indigo-100" },
  teal:    { border: "border-teal-300",    bg: "bg-teal-50/60",    ring: "focus:ring-teal-300 focus:border-teal-400",    ico: "text-teal-600",    tag: "bg-teal-100 text-teal-700",    iconBg: "bg-teal-100" },
};

function tinted(accent: Accent, mono = false) {
  const a = ACCENT[accent];
  return `w-full bg-white border-2 ${a.border} rounded-xl px-4 py-3.5 text-lg leading-relaxed tracking-wide text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 ${a.ring} shadow-sm ${mono ? "font-mono text-sm" : ""}`;
}

type IconName = "phone" | "chat" | "doc" | "target" | "building";

function FieldIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    className: `w-8 h-8 ${className}`,
    "aria-hidden": true,
  };
  switch (name) {
    case "phone":
      return (
        <svg {...common}>
          <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
          <line x1="10.5" y1="18" x2="13.5" y2="18" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M13.5 3v4.5H18" />
          <line x1="9.5" y1="13" x2="15.5" y2="13" />
          <line x1="9.5" y1="16.5" x2="15.5" y2="16.5" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
          <line x1="9" y1="7.5" x2="9" y2="7.5" />
          <line x1="12" y1="7.5" x2="12" y2="7.5" />
          <line x1="15" y1="7.5" x2="15" y2="7.5" />
          <line x1="9" y1="11" x2="9" y2="11" />
          <line x1="12" y1="11" x2="12" y2="11" />
          <line x1="15" y1="11" x2="15" y2="11" />
          <path d="M10 20.5v-4h4v4" />
        </svg>
      );
  }
}

function ColoredField({
  accent,
  icon,
  label,
  hint,
  badge,
  children,
}: {
  accent: Accent;
  icon: IconName;
  label: string;
  hint?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-2xl ${a.bg} border-2 ${a.border} p-4 md:p-5 space-y-3 shadow-sm`}>
      <div className="flex items-start gap-4">
        <span className={`w-14 h-14 rounded-2xl ${a.iconBg} ${a.ico} flex items-center justify-center shrink-0 shadow-sm`}>
          <FieldIcon name={icon} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold text-stone-800 tracking-wide leading-snug">{label}</span>
            {badge && (
              <span className={`text-sm font-bold tracking-widest uppercase px-3 py-1 rounded-full ${a.tag}`}>
                {badge}
              </span>
            )}
          </div>
          {hint && <p className="text-lg text-stone-600 leading-relaxed mt-1.5">{hint}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

type SuggestField = "appName" | "tagline" | "description" | "audience" | "customInstructions";

function SuggestBox({
  field,
  brief,
  value,
  onPick,
  accent,
}: {
  field: SuggestField;
  brief: Brief;
  value: string;
  onPick: (v: string) => void;
  accent: Accent;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const a = ACCENT[accent];

  const run = async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setOpen(true);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, brief, current: value }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let ev = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) ev = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          try {
            const obj = JSON.parse(data);
            if (ev === "done") setItems(obj.suggestions || []);
            else if (ev === "error") setError(obj.message || "失敗");
          } catch {}
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-lg font-bold ${a.tag} hover:brightness-95 disabled:opacity-50 shadow-sm`}
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              アシュラ思考中…
            </>
          ) : value.trim() ? (
            <>上の「{value.trim().slice(0, 14)}{value.trim().length > 14 ? "…" : ""}」を活かして AI に案を出してもらう</>
          ) : (
            <>他の入力欄も読んで AI に案を出してもらう（空欄でも OK）</>
          )}
        </button>
        {open && !loading && (items.length > 0 || error) && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-stone-500 underline"
          >
            閉じる
          </button>
        )}
      </div>
      {open && (loading || items.length > 0 || error) && (
        <div className={`rounded-xl border-2 border-dashed ${a.border} bg-white/80 p-3 space-y-2`}>
          {error && <div className="text-base text-red-600">エラー: {error}</div>}
          {loading && items.length === 0 && (
            <div className="text-base text-stone-600">候補を考えてもらってます…（10〜30 秒）</div>
          )}
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl bg-white border-2 ${a.border} hover:${a.bg} text-stone-800 text-lg leading-relaxed shadow-sm`}
            >
              {s}
            </button>
          ))}
          {items.length > 0 && (
            <p className="text-sm text-stone-500 leading-relaxed">
              クリックで上の欄に入れます。入れた後そのまま手で書き換え OK。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Card({
  badge,
  title,
  subtitle,
  children,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-3xl bg-white/85 backdrop-blur border border-stone-200 shadow-md overflow-hidden">
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-green-500 to-emerald-500"
      />
      <div className="p-6 md:p-8 pl-7 md:pl-9 space-y-6">
        <SectionHead badge={badge} title={title} subtitle={subtitle} />
        <div className="space-y-5">{children}</div>
      </div>
    </section>
  );
}

function SectionHead({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2 pb-4 border-b-2 border-dashed border-green-200">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-[0.18em] uppercase text-white bg-gradient-to-r from-green-500 to-emerald-500 shadow-sm">
          {badge}
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide text-stone-900 leading-tight">
          <span className="bg-gradient-to-r from-stone-900 via-green-700 to-emerald-600 bg-clip-text text-transparent">
            {title}
          </span>
        </h2>
      </div>
      {subtitle && <p className="text-base text-stone-500 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function Step1({
  brief,
  setBrief,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
}) {
  return (
    <Card
      badge="Step 01"
      title="アプリの基本情報"
      subtitle="ざっくり単語を入れるだけで OK。「AI に案を出してもらう」ボタンでアシュラが複数案を提案します（空欄なら他の項目から推測）。"
    >
      <ColoredField
        accent="emerald"
        icon="phone"
        label="アプリ名（LINE チャネル名）"
        badge="App Name"
        hint="ユーザーに見える名前。LINE 申請のチャネル名にもなります。"
      >
        <input
          className={tinted("emerald")}
          value={brief.appName}
          onChange={(e) => setBrief({ ...brief, appName: e.target.value })}
          placeholder="例: わがショップ会員証（適当な単語でも OK）"
        />
        <div className="pt-2">
          <SuggestBox field="appName" brief={brief} value={brief.appName} accent="emerald" onPick={(v) => setBrief({ ...brief, appName: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="rose"
        icon="chat"
        label="一言キャッチ"
        badge="Tagline"
        hint="トップやストア説明に出る短い 1 行。"
      >
        <input
          className={tinted("rose")}
          value={brief.tagline}
          onChange={(e) => setBrief({ ...brief, tagline: e.target.value })}
          placeholder="例: ピッと提示でポイントが貯まる"
        />
        <div className="pt-2">
          <SuggestBox field="tagline" brief={brief} value={brief.tagline} accent="rose" onPick={(v) => setBrief({ ...brief, tagline: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="sky"
        icon="doc"
        label="サービス概要"
        badge="Description"
        hint="誰の・どんな課題を・このミニアプリでどう解決するか。"
      >
        <textarea
          className={tinted("sky")}
          rows={4}
          value={brief.description}
          onChange={(e) => setBrief({ ...brief, description: e.target.value })}
          placeholder="例: 来店時に LINE で会員証を提示するとポイントが貯まり、クーポンが受け取れる店舗向け会員アプリ。"
        />
        <div className="pt-2">
          <SuggestBox field="description" brief={brief} value={brief.description} accent="sky" onPick={(v) => setBrief({ ...brief, description: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="violet"
        icon="target"
        label="想定ユーザー"
        badge="Audience"
        hint="誰が・どんなシーンで使うか。"
      >
        <input
          className={tinted("violet")}
          value={brief.audience}
          onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
          placeholder="例: 店舗に来店する 20〜40 代のリピーター客"
        />
        <div className="pt-2">
          <SuggestBox field="audience" brief={brief} value={brief.audience} accent="violet" onPick={(v) => setBrief({ ...brief, audience: v })} />
        </div>
      </ColoredField>

      <Field label="カテゴリ" hint="LINE 申請のカテゴリ目安。一番近いものを。">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBrief({ ...brief, category: c })}
              className={`text-base px-4 py-3 rounded-xl border-2 font-medium shadow-sm transition-colors ${
                brief.category === c
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 border-green-400 text-white"
                  : "bg-white border-stone-300 text-stone-700 hover:bg-emerald-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
    </Card>
  );
}

function Step2({
  brief,
  setBrief,
  toggleFeature,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
  toggleFeature: (s: string) => void;
}) {
  return (
    <div className="space-y-8">
      <Card
        badge="Step 02 - A"
        title="カラー & デザインスタイル"
        subtitle="アプリの世界観を決める色と雰囲気を選んでください"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="メインカラー">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brief.primaryColor}
                onChange={(e) => setBrief({ ...brief, primaryColor: e.target.value })}
                className="h-12 w-14 rounded-lg border border-stone-300 bg-white cursor-pointer"
              />
              <input
                className={inputCls}
                value={brief.primaryColor}
                onChange={(e) => setBrief({ ...brief, primaryColor: e.target.value })}
              />
            </div>
          </Field>
          <Field label="アクセントカラー">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brief.accentColor}
                onChange={(e) => setBrief({ ...brief, accentColor: e.target.value })}
                className="h-12 w-14 rounded-lg border border-stone-300 bg-white cursor-pointer"
              />
              <input
                className={inputCls}
                value={brief.accentColor}
                onChange={(e) => setBrief({ ...brief, accentColor: e.target.value })}
              />
            </div>
          </Field>
        </div>

        <Field label="デザインスタイル" hint="近い雰囲気のものを選んでください。複数当てはまる場合は自由記述欄で重ねて指定できます。">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {STYLES.map((s) => {
              const selected = brief.style === s.name;
              const isLight = s.textTone === "light";
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setBrief({ ...brief, style: s.name })}
                  style={{
                    backgroundImage: `url(/textures/${s.texture}.svg)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  className={`relative h-24 px-3 rounded-2xl overflow-hidden border-2 font-bold tracking-wide shadow-md transition-transform hover:scale-[1.02] focus:outline-none ${
                    selected ? "border-green-500 ring-4 ring-green-200" : "border-stone-200"
                  }`}
                >
                  <span
                    className={`absolute inset-0 ${
                      isLight
                        ? "bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                        : "bg-gradient-to-t from-white/55 via-white/10 to-transparent"
                    }`}
                  />
                  <span
                    className={`relative z-10 text-lg drop-shadow-sm ${
                      isLight ? "text-white" : "text-stone-900"
                    }`}
                  >
                    {s.name}
                  </span>
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 z-10 bg-green-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                      選択中
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="スタイルの自由記述" hint="参考アプリ、配色イメージ、フォント雰囲気など何でも">
          <textarea
            className={inputCls}
            rows={3}
            value={brief.styleCustom}
            onChange={(e) => setBrief({ ...brief, styleCustom: e.target.value })}
            placeholder={"例:\n・LINE 公式アプリのような清潔感\n・角丸多め・余白広め\n・参考: スターバックスのモバイルオーダー"}
          />
        </Field>
      </Card>

      <Card
        badge="Step 02 - B"
        title="実装する機能"
        subtitle="よく使う機能はチェックするだけで実装されます。足りないものは自由記述で。"
      >
        <Field label="搭載する機能（複数選択）">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FEATURE_OPTIONS.map((s) => (
              <label
                key={s}
                className={`flex items-center gap-3 text-base leading-relaxed px-4 py-3 rounded-xl border-2 cursor-pointer shadow-sm transition-colors ${
                  brief.features.includes(s)
                    ? "bg-emerald-50 border-green-300 text-stone-800"
                    : "bg-white border-stone-300 text-stone-700 hover:bg-emerald-50/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={brief.features.includes(s)}
                  onChange={() => toggleFeature(s)}
                  className="accent-green-500 scale-125"
                />
                {s}
              </label>
            ))}
          </div>
        </Field>

        <Field label="その他の機能（自由記述）" hint="1 行 1 機能。例:「来店スタンプ 10 個で特典」「順番が来たら通知」など">
          <textarea
            className={inputCls}
            rows={3}
            value={brief.featuresCustom}
            onChange={(e) => setBrief({ ...brief, featuresCustom: e.target.value })}
            placeholder={"例:\n誕生日クーポンの自動配布\nスタッフ用の QR 読み取り画面\n多店舗の在庫横断検索"}
          />
        </Field>

        <Field label="バックエンド（データ保存）" hint="会員情報・ポイント・予約などをサーバに保存する場合は ON。フロント完結で良ければ OFF。">
          <label className="flex items-center gap-3 text-base bg-white border-2 border-stone-300 rounded-xl px-4 py-3 cursor-pointer leading-relaxed text-stone-700 shadow-sm">
            <input
              type="checkbox"
              checked={brief.needBackend}
              onChange={(e) => setBrief({ ...brief, needBackend: e.target.checked })}
              className="accent-emerald-500 scale-125"
            />
            Vercel Serverless + DB（Prisma/Neon）でデータ保存する
          </label>
        </Field>
      </Card>
    </div>
  );
}

function Step3({
  brief,
  setBrief,
  refPaths,
  setRefPaths,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
  refPaths: string[];
  setRefPaths: (v: string[]) => void;
}) {
  return (
    <div className="space-y-8">
      <Card
        badge="Step 03 - A"
        title="申請情報（LINE入力情報.md を自動生成）"
        subtitle="提供元や URL を入れておくと、LINE 審査申請用ドキュメントを一緒に作成します。空欄でも「要記入」で雛形が出ます。"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColoredField accent="teal" icon="building" label="提供元（事業者名）" badge="Provider" hint="チャネル説明の末尾「提供元：〜」に入ります。">
            <input
              className={tinted("teal")}
              value={brief.provider}
              onChange={(e) => setBrief({ ...brief, provider: e.target.value })}
              placeholder="例: 株式会社あおぞら商店"
            />
          </ColoredField>
          <Field label="事業者区分">
            <div className="grid grid-cols-3 gap-2">
              {["法人", "個人事業主", "個人"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBrief({ ...brief, providerKind: k })}
                  className={`text-base px-3 py-3 rounded-xl border-2 font-medium shadow-sm transition-colors ${
                    brief.providerKind === k
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 border-green-400 text-white"
                      : "bg-white border-stone-300 text-stone-700 hover:bg-emerald-50"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="プライバシーポリシー URL" hint="LINE 申請の必須項目。公式サイトのものを流用可。">
            <input
              className={`${inputCls} font-mono text-sm`}
              value={brief.privacyUrl}
              onChange={(e) => setBrief({ ...brief, privacyUrl: e.target.value })}
              placeholder="https://example.com/privacy"
            />
          </Field>
          <Field label="利用規約 URL（任意）">
            <input
              className={`${inputCls} font-mono text-sm`}
              value={brief.termsUrl}
              onChange={(e) => setBrief({ ...brief, termsUrl: e.target.value })}
              placeholder="https://example.com/terms"
            />
          </Field>
        </div>

        <Field label="サポート用メールアドレス" hint="LINE から連絡が来る窓口メール。">
          <input
            className={`${inputCls} font-mono text-sm`}
            value={brief.contactEmail}
            onChange={(e) => setBrief({ ...brief, contactEmail: e.target.value })}
            placeholder="support@example.com"
          />
        </Field>
      </Card>

      <Card
        badge="Step 03 - B"
        title="画像生成と追加指示"
        subtitle="AI 画像と、自由記述による細かい指定"
      >
        <Field
          label="画像生成 (gpt-image-2)"
          hint="Codex 組み込みの image_gen ツールで生成（ChatGPT サブスク内・API キー不要）。失敗してもアプリは完成します。"
        >
          <label className="flex items-center gap-3 text-base bg-white border-2 border-stone-300 rounded-xl px-4 py-3 cursor-pointer leading-relaxed text-stone-700 shadow-sm">
            <input
              type="checkbox"
              checked={brief.generateImages}
              onChange={(e) => setBrief({ ...brief, generateImages: e.target.checked })}
              className="accent-emerald-500 scale-125"
            />
            AI 画像（アイコン・ヒーロー等）を生成してアプリに差し込む
          </label>
        </Field>

        <Field
          label="追加カスタム指示（自由記述）"
          hint="画面構成・テイスト・実装したい機能などを自由に。記述した内容は最優先要件として反映されます。"
        >
          <textarea
            className={inputCls}
            rows={6}
            value={brief.customInstructions}
            onChange={(e) => setBrief({ ...brief, customInstructions: e.target.value })}
            placeholder={"例:\n・ボトムタブは「ホーム / 会員証 / クーポン / 設定」の4つ\n・会員証画面はバーコードと QR を切替表示\n・ポイントは来店ごとに +1、10pt でクーポン\n・全体的に角丸でやわらかい印象に"}
          />
          <div className="pt-2">
            <SuggestBox
              field="customInstructions"
              brief={brief}
              value={brief.customInstructions}
              accent="amber"
              onPick={(v) =>
                setBrief({
                  ...brief,
                  customInstructions: brief.customInstructions
                    ? brief.customInstructions + "\n" + v
                    : v,
                })
              }
            />
          </div>
        </Field>
      </Card>

      <Card
        badge="Step 03 - C"
        title="キャラクター参照（任意）"
        subtitle="オンボーディングや空状態に同じキャラを登場させたい場合は画像を指定"
      >
        <Field
          label="キャラクター参照画像（任意）"
          hint="image_gen の image-to-image 機能で、同じキャラを各画面に登場させたい場合のみ。ドラッグ&ドロップ、またはクリックで選択。"
        >
          <RefImagePicker paths={refPaths} onChange={setRefPaths} />
        </Field>
      </Card>
    </div>
  );
}

function GeneratingView({
  logs,
  logEndRef,
}: {
  logs: Log[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <main className="min-h-screen text-stone-800">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-6">
        <SectionTitle title="生成中" subtitle="Codex が LINE ミニアプリ一式を書いておるところじゃ。2〜5 分ほど待たれよ" />
        <CharacterDialog
          ashura={{ img: "ashura_normal", text: "Codex がプロジェクトを組み、画像を呼び寄せ、申請情報まで書いておる。少し待たれよ。" }}
          mobuta={{ img: "mobuta_think", text: "ドキドキ……どんなアプリになるかな" }}
        />
        <div className="bg-stone-900 border border-stone-300 rounded-2xl p-4 h-[460px] overflow-y-auto font-mono text-xs space-y-1 shadow-inner">
          {logs.map((l, i) => (
            <div key={i} className={kindClass(l.kind)}>
              <span className="text-stone-500">{new Date(l.ts).toLocaleTimeString()}</span> {l.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </main>
  );
}

function ResultView({ id, onReset }: { id: string; onReset: () => void }) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<Log[]>([]);
  const [result, setResult] = useState<{ repo: string; note?: string } | null>(null);
  const [appInfo, setAppInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/preview/${id}/LINE%E5%85%A5%E5%8A%9B%E6%83%85%E5%A0%B1.md`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => setAppInfo(t))
      .catch(() => setAppInfo(null));
  }, [id]);

  const publish = async () => {
    setPublishing(true);
    setPublishLogs([]);
    setResult(null);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, repoName: repoName.trim() || undefined }),
    });
    if (!res.body) {
      setPublishLogs((p) => [...p, { kind: "error", text: "通信失敗", ts: Date.now() }]);
      setPublishing(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = "message";
        let dataStr = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          if (ev === "step") {
            setPublishLogs((p) => [...p, { kind: "step", text: data.text, ts: Date.now() }]);
          } else if (ev === "error") {
            setPublishLogs((p) => [...p, { kind: "error", text: data.message, ts: Date.now() }]);
          } else if (ev === "done") {
            setResult({ repo: data.repo, note: data.note });
            setPublishLogs((p) => [...p, { kind: "done", text: `✓ ${data.repo}`, ts: Date.now() }]);
          }
        } catch {}
      }
    }
    setPublishing(false);
  };

  return (
    <main className="min-h-screen flex flex-col text-stone-800">
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/characters/ashura_happy.png" alt="アシュラくん" className="w-12 h-12 object-contain" draggable={false} />
          <h1 className="font-bold text-lg tracking-wide text-green-600">LINE ミニアプリが完成したぞ</h1>
          <img src="/characters/mobuta_happy.png" alt="モブ太くん" className="w-10 h-10 object-contain" draggable={false} />
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/download/${id}`}
            className="text-sm text-white px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-sm font-medium"
          >
            ZIP ダウンロード
          </a>
          <button
            onClick={() => setPublishOpen((v) => !v)}
            className="text-sm text-white px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-sm font-medium"
          >
            GitHub にリポジトリ作成 & プッシュ
          </button>
          <button
            onClick={onReset}
            className="text-sm bg-white border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-full text-stone-700 shadow-sm"
          >
            もう一度作る
          </button>
        </div>
      </header>

      {publishOpen && (
        <section className="border-b border-stone-200 px-6 py-4 bg-emerald-50/60 space-y-3">
          {!result && !publishing && (
            <div className="flex items-end gap-2 max-w-2xl">
              <label className="flex-1 space-y-1">
                <span className="text-sm text-stone-600">リポジトリ名（空欄でアプリ名から自動）</span>
                <input
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono text-stone-800 shadow-sm"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="例: line-member-card"
                />
              </label>
              <button
                onClick={publish}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-5 py-2 rounded-full text-sm font-medium shadow-sm"
              >
                作成してプッシュ
              </button>
            </div>
          )}
          {(publishing || publishLogs.length > 0) && (
            <div className="bg-stone-900 border border-stone-300 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1 shadow-inner">
              {publishLogs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.kind === "error"
                      ? "text-red-400"
                      : l.kind === "done"
                      ? "text-emerald-400 font-semibold"
                      : "text-stone-200"
                  }
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
          {result && (
            <div className="bg-white border border-green-300 rounded-xl p-4 text-sm space-y-1 shadow-sm">
              <div>
                リポジトリ:{" "}
                <a className="text-violet-600 underline font-medium" href={result.repo} target="_blank" rel="noreferrer">
                  {result.repo}
                </a>
              </div>
              {result.note && <div className="text-xs text-amber-600 leading-relaxed">{result.note}</div>}
            </div>
          )}
        </section>
      )}

      <div className="flex-1 overflow-y-auto bg-stone-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6 space-y-3">
            <h2 className="text-xl font-bold text-stone-800">次の手順</h2>
            <ol className="list-decimal list-inside space-y-2 text-stone-700 leading-relaxed">
              <li>「ZIP ダウンロード」または「GitHub にプッシュ」で成果物を取得</li>
              <li>取得後、フォルダで <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono text-sm">npm install</code> → <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono text-sm">npm run dev</code> で動作確認</li>
              <li>Vercel にデプロイ（環境変数 <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono text-sm">VITE_LIFF_ID</code> を設定）</li>
              <li>LINE Developers Console で LIFF を作成し、エンドポイント URL に Vercel の URL を登録</li>
              <li>下の「LINE入力情報.md」を見ながら審査申請</li>
            </ol>
          </div>

          <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6 space-y-3">
            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
              LINE入力情報.md（審査申請まとめ）
            </h2>
            {appInfo ? (
              <pre className="whitespace-pre-wrap break-words bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm leading-relaxed text-stone-700 max-h-[480px] overflow-y-auto">
                {appInfo}
              </pre>
            ) : (
              <p className="text-stone-500 text-sm">
                LINE入力情報.md を読み込み中… 生成されていない場合は ZIP 内をご確認ください。
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

type CharSpec = { img: string; text: string };

function CharacterDialog({ ashura, mobuta }: { ashura: CharSpec; mobuta: CharSpec }) {
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <img
          src={`/characters/${ashura.img}.png`}
          alt="アシュラくん"
          className="w-16 h-16 md:w-20 md:h-20 object-contain select-none rounded-full bg-emerald-100/40 p-1"
          draggable={false}
        />
        <div className="relative max-w-[80%]">
          <div className="rounded-2xl rounded-bl-sm bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 px-6 py-4 text-lg leading-relaxed text-stone-800 shadow-sm">
            {ashura.text}
          </div>
        </div>
      </div>
      <div className="flex items-end gap-3 flex-row-reverse">
        <img
          src={`/characters/${mobuta.img}.png`}
          alt="モブ太くん"
          className="w-14 h-14 md:w-16 md:h-16 object-contain select-none rounded-full bg-violet-100/40 p-1"
          draggable={false}
        />
        <div className="relative max-w-[70%]">
          <div className="rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-purple-600 px-6 py-3.5 text-lg leading-relaxed text-white shadow-md">
            {mobuta.text}
          </div>
        </div>
      </div>
    </div>
  );
}

function kindClass(k: string) {
  switch (k) {
    case "error":
    case "command-err":
    case "stderr":
      return "text-red-400";
    case "done":
      return "text-emerald-400 font-semibold";
    case "info":
    case "thread":
    case "turn":
    case "status":
      return "text-sky-400";
    case "agent":
    case "agent-delta":
      return "text-zinc-100 whitespace-pre-wrap";
    case "command":
    case "command-ok":
      return "text-zinc-300";
    case "cmd-out":
      return "text-zinc-500 whitespace-pre-wrap";
    case "file":
    case "file-ok":
      return "text-purple-300";
    case "reasoning":
    case "reasoning-stream":
      return "text-amber-200/70 italic";
    case "plan":
      return "text-emerald-300";
    case "web":
    case "tool":
      return "text-cyan-300";
    case "heartbeat":
      return "text-zinc-600";
    default:
      return "text-zinc-500";
  }
}
