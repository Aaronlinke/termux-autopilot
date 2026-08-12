import type { AgentId } from "./agents";

export type KnowledgeKind = "module" | "insight" | "note";

export interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  lang?: string;
  agentId?: AgentId | "user";
  createdAt: number;
  pinned?: boolean;
}

const KEY = "termux-copilot:knowledge:v1";
const BUDGET_KEY = "termux-copilot:knowledge:budget";

/** Wie viele Wörter maximal in den Kontext injiziert werden. */
export const DEFAULT_WORD_BUDGET = 60_000;
export const MAX_WORD_BUDGET = 200_000;

/** Harte Obergrenze für den lokalen Speicher (Wörter über alle Einträge). */
const STORE_WORD_CAP = 250_000;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function getWordBudget(): number {
  if (typeof window === "undefined") return DEFAULT_WORD_BUDGET;
  const raw = Number(window.localStorage.getItem(BUDGET_KEY));
  if (!raw || Number.isNaN(raw)) return DEFAULT_WORD_BUDGET;
  return Math.min(Math.max(raw, 1_000), MAX_WORD_BUDGET);
}

export function setWordBudget(words: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BUDGET_KEY,
    String(Math.min(Math.max(words, 1_000), MAX_WORD_BUDGET)),
  );
}

export function loadKnowledge(): KnowledgeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnowledgeEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: KnowledgeEntry[]) {
  if (typeof window === "undefined") return;
  // Speicher-Cap: älteste, nicht gepinnte Einträge fallen zuerst raus.
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const kept: KnowledgeEntry[] = [];
  let words = 0;
  for (const e of sorted) {
    const w = countWords(e.content);
    if (!e.pinned && words + w > STORE_WORD_CAP) continue;
    words += w;
    kept.push(e);
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Quota voll — die Hälfte der ältesten wegwerfen und nochmal probieren.
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify(kept.slice(0, Math.ceil(kept.length / 2))),
      );
    } catch {
      /* aufgeben */
    }
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeKnowledge(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function fingerprint(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

export function addEntries(newOnes: Omit<KnowledgeEntry, "id" | "createdAt">[]) {
  const existing = loadKnowledge();
  const seen = new Set(existing.map((e) => fingerprint(e.content)));
  const added: KnowledgeEntry[] = [];
  for (const e of newOnes) {
    if (countWords(e.content) < 4) continue;
    const fp = fingerprint(e.content);
    if (seen.has(fp)) continue;
    seen.add(fp);
    added.push({
      ...e,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    });
  }
  if (added.length === 0) return [];
  persist([...added, ...existing]);
  return added;
}

export function deleteEntry(id: string) {
  persist(loadKnowledge().filter((e) => e.id !== id));
}

export function togglePin(id: string) {
  persist(
    loadKnowledge().map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)),
  );
}

export function clearKnowledge() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  notify();
}

/* ---------- Auto-Extraktion ---------- */

const FILENAME_RE = /([A-Za-z0-9_.-]+\.(sh|py|js|ts|rs|c|cpp|go|json|yml|yaml|toml|conf))/;

/**
 * Zieht aus einer KI-Antwort alle Code-Blöcke (= Tools/Module) plus eine
 * kompakte Kurz-Erkenntnis heraus.
 */
export function extractFromAnswer(
  answer: string,
  question: string,
  agentId: AgentId,
): Omit<KnowledgeEntry, "id" | "createdAt">[] {
  const out: Omit<KnowledgeEntry, "id" | "createdAt">[] = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let i = 1;
  while ((m = fence.exec(answer))) {
    const lang = (m[1] || "text").toLowerCase();
    const code = m[2].trim();
    if (countWords(code) < 8) continue;
    const before = answer.slice(Math.max(0, m.index - 300), m.index);
    const nameHit = FILENAME_RE.exec(code) ?? FILENAME_RE.exec(before);
    const title = nameHit
      ? nameHit[1]
      : `${question.slice(0, 48).trim() || "Modul"} — Block ${i}`;
    out.push({ kind: "module", title, content: code, lang, agentId });
    i++;
  }

  const prose = answer
    .replace(fence, "")
    .replace(/^#+\s*/gm, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  if (countWords(prose) >= 10) {
    out.push({
      kind: "insight",
      title: question.slice(0, 80) || "Erkenntnis",
      content: `FRAGE: ${question}\nANTWORT-KERN: ${prose.slice(0, 4000)}`,
      agentId,
    });
  }
  return out;
}

/** Baut den Kontext-Block, der bei jeder Anfrage mitgeschickt wird. */
export function buildContextBlock(budget = getWordBudget()): string {
  const entries = loadKnowledge();
  if (entries.length === 0) return "";
  const ordered = [
    ...entries.filter((e) => e.pinned),
    ...entries.filter((e) => !e.pinned),
  ];
  const parts: string[] = [];
  let words = 0;
  for (const e of ordered) {
    const block = `--- [${e.kind}${e.lang ? "/" + e.lang : ""}] ${e.title}${
      e.pinned ? " (GEPINNT)" : ""
    } ---\n${e.content}`;
    const w = countWords(block);
    if (words + w > budget) continue;
    words += w;
    parts.push(block);
  }
  if (parts.length === 0) return "";
  return parts.join("\n\n");
}

export function knowledgeStats() {
  const entries = loadKnowledge();
  const words = entries.reduce((s, e) => s + countWords(e.content), 0);
  return {
    count: entries.length,
    modules: entries.filter((e) => e.kind === "module").length,
    words,
    budget: getWordBudget(),
  };
}
