import {
  DEFAULT_WORD_BUDGET,
  MAX_WORD_BUDGET,
  addEntries,
  clearKnowledge,
  countWords,
  deleteEntry,
  getWordBudget,
  knowledgeStats,
  loadKnowledge,
  setWordBudget,
  subscribeKnowledge,
  togglePin,
  type KnowledgeEntry,
} from "@/lib/knowledge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, Copy, Pin, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/wissen")({
  head: () => ({
    meta: [
      { title: "Wissensspeicher — Termux Copilot" },
      {
        name: "description",
        content:
          "Alle automatisch gesicherten Module, Skripte und Erkenntnisse deiner KI-Runde — als gemeinsamer Kontextspeicher.",
      },
      { property: "og:title", content: "Wissensspeicher — Termux Copilot" },
      {
        property: "og:description",
        content:
          "Gemeinsamer Kontextspeicher: Module, Skripte und Erkenntnisse, die die KI bei jeder Anfrage mitliest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgePage,
});

type Filter = "alle" | "module" | "insight" | "note";

function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [budget, setBudget] = useState(DEFAULT_WORD_BUDGET);
  const [filter, setFilter] = useState<Filter>("alle");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setEntries(loadKnowledge());
      setBudget(getWordBudget());
    };
    sync();
    return subscribeKnowledge(sync);
  }, []);

  const stats = useMemo(
    () => (typeof window === "undefined" ? null : knowledgeStats()),
    [entries, budget],
  );

  const visible = entries.filter((e) => {
    if (filter !== "alle" && e.kind !== filter) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      e.title.toLowerCase().includes(needle) ||
      e.content.toLowerCase().includes(needle)
    );
  });

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const added = addEntries([
      {
        kind: "note",
        title: text.split("\n")[0].slice(0, 70),
        content: text,
        agentId: "user",
        pinned: true,
      },
    ]);
    setDraft("");
    toast[added.length ? "success" : "error"](
      added.length ? "Notiz gespeichert & gepinnt." : "Schon vorhanden.",
    );
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Zurück"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Brain className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-mono text-base font-semibold text-foreground sm:text-lg">
              Wissensspeicher
            </h1>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {stats?.count ?? 0} Einträge · {stats?.modules ?? 0} Module ·{" "}
              {(stats?.words ?? 0).toLocaleString("de-DE")} Wörter
            </p>
          </div>
          <button
            onClick={() => {
              clearKnowledge();
              toast.success("Wissensspeicher geleert.");
            }}
            disabled={entries.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">alles löschen</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Kontext-Budget */}
        <section className="mb-6 rounded-xl border border-border bg-card/50 p-4">
          <label
            htmlFor="budget"
            className="font-mono text-xs text-muted-foreground"
          >
            Kontext-Budget:{" "}
            <span className="text-primary">
              {budget.toLocaleString("de-DE")}
            </span>{" "}
            Wörter pro Anfrage (Rest bleibt gespeichert, wird aber nicht
            mitgeschickt)
          </label>
          <input
            id="budget"
            type="range"
            min={5000}
            max={MAX_WORD_BUDGET}
            step={5000}
            value={budget}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBudget(v);
              setWordBudget(v);
            }}
            className="mt-3 w-full accent-[var(--terminal-green)]"
          />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Gepinnte Einträge kommen immer zuerst rein. 200.000 Wörter gehen
            technisch, machen Antworten aber langsam und teuer — 40k–80k ist der
            Sweet Spot.
          </p>
        </section>

        {/* Eigene Notiz */}
        <section className="mb-6 rounded-xl border border-border bg-card/50 p-4">
          <h2 className="mb-2 font-mono text-sm font-semibold text-foreground">
            Eigenes Wissen hinzufügen
          </h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="z.B. Mein VPS: root@1.2.3.4, SSH-Port 2222, Termux-Key liegt in ~/.ssh/vps"
            className="w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-sm text-foreground outline-none focus:border-primary/60"
          />
          <button
            onClick={addNote}
            disabled={!draft.trim()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> speichern &amp; pinnen
          </button>
        </section>

        {/* Filter */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["alle", "module", "insight", "note"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                filter === f
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="suchen…"
            className="ml-auto w-40 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs outline-none focus:border-primary/60 sm:w-56"
          />
        </div>

        {/* Liste */}
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
            Noch nichts drin. Sobald ein Agent antwortet, landen Skripte,
            Module und Erkenntnisse automatisch hier.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-border bg-card/50 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {e.kind}
                    {e.lang ? `/${e.lang}` : ""}
                  </span>
                  <button
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    className="min-w-0 flex-1 text-left font-mono text-sm text-foreground hover:text-primary"
                  >
                    <span className="line-clamp-2">{e.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {countWords(e.content).toLocaleString("de-DE")} Wörter ·{" "}
                      {new Date(e.createdAt).toLocaleString("de-DE")}
                      {e.agentId ? ` · ${e.agentId}` : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => togglePin(e.id)}
                    aria-label="pinnen"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded border border-border transition-colors hover:bg-accent ${
                      e.pinned ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(e.content);
                      toast.success("Kopiert.");
                    }}
                    aria-label="kopieren"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      deleteEntry(e.id);
                      toast.success("Gelöscht.");
                    }}
                    aria-label="löschen"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {open === e.id && (
                  <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {e.content}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
