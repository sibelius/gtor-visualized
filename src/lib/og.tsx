import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DESCRIPTIONS, NAV } from "@/components/shell/nav";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

const C = {
  bg: "#0a0c11",
  panel: "#11141b",
  panel2: "#171b24",
  line: "#242a38",
  ink: "#e7e9f0",
  muted: "#8a93a8",
  faint: "#5a6275",
  accent: "#a78bfa",
  space: "#38bdf8",
  time: "#f472b6",
  getter: "#34d399",
  setter: "#fbbf24",
};

type CellKey = "value" | "array" | "deferred" | "stream";

/** Which quadrant of the theory each page lives in. */
const CELL_FOR: Record<string, CellKey[]> = {
  "/iterators": ["array"],
  "/generators": ["array"],
  "/promises": ["deferred"],
  "/tasks": ["deferred"],
  "/async-functions": ["deferred"],
  "/queues": ["stream"],
  "/streams": ["stream"],
  "/async-generators": ["stream"],
  "/signals": ["stream"],
  "/behaviors": ["stream"],
  "/progress": ["stream", "deferred"],
};

const CELLS: { key: CellKey; label: string; pair: [string, string]; temporal: boolean; plural: boolean }[] = [
  { key: "value", label: "Value", pair: ["Setter", "Getter"], temporal: false, plural: false },
  { key: "array", label: "Array", pair: ["Generator", "Iterator"], temporal: false, plural: true },
  { key: "deferred", label: "Deferred", pair: ["Resolver", "Promise"], temporal: true, plural: false },
  { key: "stream", label: "Stream", pair: ["Writer", "Reader"], temporal: true, plural: true },
];

// Bundled (OFL) so image generation never depends on the network at build time.
const font = (file: string) => readFile(join(process.cwd(), "src/lib/fonts", file));

export function ogAlt(href: string) {
  const item = NAV.find((n) => n.href === href)!;
  return href === "/" ? "GTOR, visualized: A General Theory of Reactivity" : `${item.label}: GTOR, visualized`;
}

export async function renderOg(href: string) {
  const item = NAV.find((n) => n.href === href)!;
  const home = href === "/";
  const title = home ? "Promises, streams, signals and behaviors, all on one map." : item.label;
  const kicker = home ? "a general theory of reactivity, visualized" : `${item.n} · ${item.group.toLowerCase()}`;
  const description = DESCRIPTIONS[href];
  const lit = CELL_FOR[href] ?? CELLS.map((c) => c.key);

  const [regular, semibold, mono] = await Promise.all([
    font("Inter-Regular.ttf"),
    font("Inter-SemiBold.ttf"),
    font("JetBrainsMono-Regular.ttf"),
  ]);
  const fonts = [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg, color: C.ink, fontFamily: "Inter", padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo size={52} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 24, fontWeight: 600 }}>GTOR, visualized</div>
              <div style={{ fontSize: 18, color: C.muted }}>A General Theory of Reactivity</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ fontFamily: "Mono", fontSize: 22, color: C.accent }}>{kicker}</div>
            <div style={{ fontSize: home ? 58 : 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, marginTop: 14 }}>{title}</div>
            <div style={{ fontSize: 24, lineHeight: 1.4, color: C.muted, marginTop: 20, maxWidth: 640 }}>{description}</div>
          </div>

          <div style={{ fontFamily: "Mono", fontSize: 18, color: C.faint, marginTop: 36 }}>gtor-visualized.vercel.app</div>
        </div>

        <Grid lit={lit} />
      </div>
    ),
    { ...ogSize, fonts },
  );
}

function Grid({ lit }: { lit: CellKey[] }) {
  const cellW = 178;
  const cellH = 150;
  const row = (cells: typeof CELLS, label: string, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 22, display: "flex", justifyContent: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 3, color, fontWeight: 600, transform: "rotate(-90deg)", whiteSpace: "nowrap" }}>{label}</div>
      </div>
      {cells.map((c) => {
        const on = lit.includes(c.key);
        const color = c.temporal ? C.time : C.space;
        return (
          <div
            key={c.key}
            style={{
              width: cellW,
              height: cellH,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 18,
              borderRadius: 18,
              border: `2px solid ${on ? color : C.line}`,
              background: on ? `${color}14` : C.panel,
              opacity: on ? 1 : 0.55,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{c.label}</div>
              <Glyph temporal={c.temporal} plural={c.plural} color={color} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "Mono", fontSize: 14 }}>
              <div style={{ display: "flex", color: C.setter }}>{c.pair[0]}</div>
              <div style={{ display: "flex", color: C.getter }}>→ {c.pair[1]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, paddingLeft: 34, fontSize: 13, letterSpacing: 3, color: C.faint, fontWeight: 600 }}>
        <div style={{ width: cellW, display: "flex", justifyContent: "center" }}>SINGULAR</div>
        <div style={{ width: cellW, display: "flex", justifyContent: "center" }}>PLURAL</div>
      </div>
      {row(CELLS.slice(0, 2), "SPATIAL", C.space)}
      {row(CELLS.slice(2), "TEMPORAL", C.time)}
    </div>
  );
}

function Glyph({ temporal, plural, color }: { temporal: boolean; plural: boolean; color: string }) {
  const n = plural ? 3 : 1;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ width: 14, height: 14, borderRadius: temporal ? 7 : 3, background: color, opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  );
}

export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#171b24" />
      <rect x="6" y="6" width="9" height="9" rx="2" fill="#38bdf8" />
      <rect x="17" y="6" width="9" height="9" rx="2" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
      <circle cx="10.5" cy="21.5" r="4.5" fill="#f472b6" />
      <circle cx="21.5" cy="21.5" r="4.5" fill="none" stroke="#f472b6" strokeWidth="1.6" />
    </svg>
  );
}
