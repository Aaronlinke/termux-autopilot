import { AGENT_LIST } from "@/lib/agents";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Terminal, ArrowRight, Brain } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Termux Copilot — dein KI-Kollektiv fürs Android-Terminal" },
      {
        name: "description",
        content:
          "Wähle deinen KI-Experten: Termux-Guru, Script-Architekt oder das Kollektiv. Alles auf Deutsch, mit vollständigen Abhängigkeiten.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
        {/* Header */}
        <header className="mb-12 sm:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-mono text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary terminal-glow" />
            <span>online · lovable ai gateway</span>
          </div>

          <h1 className="font-mono text-4xl font-bold leading-tight text-foreground sm:text-6xl">
            <span className="text-primary terminal-glow">$</span> termux-copilot
            <span className="animate-pulse text-primary">_</span>
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Dein KI-Kollektiv fürs{" "}
            <span className="text-foreground">Android-Terminal</span>. Mehrere
            Experten, ein Ziel: Scripte, die{" "}
            <span className="font-mono text-primary">wirklich</span> laufen —
            mit allen Abhängigkeiten, ohne Rätselraten.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              Termux
            </span>
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              proot-distro
            </span>
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              Python
            </span>
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              Node
            </span>
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              Rust
            </span>
            <span className="rounded border border-border bg-card/60 px-2 py-1">
              Bash
            </span>
          </div>
        </header>

        {/* Wissensspeicher */}
        <section className="mb-10">
          <Link
            to="/wissen"
            className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 backdrop-blur transition-all hover:border-primary/50 hover:bg-card"
          >
            <Brain className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-foreground">
                Wissensspeicher
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                Jede Antwort wird automatisch gesichert — alle Agenten lesen sie
                bei jeder Anfrage mit.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        {/* Agent grid */}
        <section>
          <h2 className="mb-5 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            &gt; wähle deinen experten
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_LIST.map((agent) => (
              <Link
                key={agent.id}
                to="/chat/$agentId"
                params={{ agentId: agent.id }}
                className="group relative flex flex-col rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition-all hover:border-primary/50 hover:bg-card hover:-translate-y-0.5"
              >
                <div
                  className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${agent.accent} 15%, transparent)`,
                    color: agent.accent,
                  }}
                >
                  {agent.emoji}
                </div>

                <h3
                  className="font-mono text-xl font-semibold"
                  style={{ color: agent.accent }}
                >
                  {agent.name}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {agent.role}
                </p>
                <p className="mt-3 flex-1 text-sm text-foreground/80">
                  {agent.tagline}
                </p>

                <div className="mt-5 flex items-center gap-2 font-mono text-sm text-primary">
                  <span>chat starten</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer terminal snippet */}
        <section className="mt-14 rounded-xl border border-border bg-card/40 p-5 font-mono text-sm backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
            <Terminal className="h-4 w-4" />
            <span>~/asus-rog</span>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            <span className="text-primary">$</span> pkg update && pkg install
            python nodejs-lts rust clang git{"\n"}
            <span className="text-muted-foreground">
              # → Copilot ergänzt fehlende Pakete automatisch, bevor sie
              knallen.
            </span>
          </pre>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-border pt-5 pb-8 font-mono text-[11px] text-muted-foreground">
          Termux Copilot · KI über Lovable AI oder kostenlos über{" "}
          <a
            href="https://developer.puter.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            Powered by Puter
          </a>
        </footer>
      </div>
    </div>
  );
}
