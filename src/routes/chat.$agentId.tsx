import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AGENTS, type AgentId } from "@/lib/agents";
import { EXAMPLE_SCRIPTS, buildImproveRequest } from "@/lib/example-scripts";
import {
  addEntries,
  buildContextBlock,
  extractFromAnswer,
  knowledgeStats,
  subscribeKnowledge,
} from "@/lib/knowledge";
import { useChat } from "@ai-sdk/react";
import {
  createFileRoute,
  Link,
  notFound,
  useParams,
} from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Brain, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$agentId")({
  head: ({ params }) => {
    const agent = AGENTS[params.agentId as AgentId];
    const name = agent?.name ?? "Chat";
    return {
      meta: [
        { title: `${name} — Termux Copilot` },
        {
          name: "description",
          content: agent?.tagline ?? "KI-Chat für Termux und Android.",
        },
      ],
    };
  },
  component: ChatPage,
});

const STORAGE_PREFIX = "termux-copilot:chat:";

function loadMessages(agentId: AgentId): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + agentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(agentId: AgentId, messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + agentId,
      JSON.stringify(messages),
    );
  } catch {
    // quota / access denied — ignore
  }
}

function ChatPage() {
  const { agentId } = useParams({ from: "/chat/$agentId" });
  const agent = AGENTS[agentId as AgentId];
  if (!agent) throw notFound();

  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInitial(loadMessages(agentId as AgentId));
    setHydrated(true);
  }, [agentId]);

  if (!hydrated) return null;
  return (
    <ChatShell
      key={agentId}
      agentId={agentId as AgentId}
      agent={agent}
      initial={initial}
    />
  );
}

function ChatShell({
  agentId,
  agent,
  initial,
}: {
  agentId: AgentId;
  agent: (typeof AGENTS)[AgentId];
  initial: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { agentId },
      }),
    [agentId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: agentId,
    messages: initial,
    transport,
    onError: (err) => {
      console.error(err);
      const msg = err?.message ?? "";
      if (msg.includes("429")) {
        toast.error("Zu viele Anfragen — kurz warten und nochmal probieren.");
      } else if (msg.includes("402")) {
        toast.error(
          "AI-Credits aufgebraucht. In Lovable → Billing aufladen.",
        );
      } else {
        toast.error("Fehler beim Chat. Prüf die Konsole.");
      }
    },
  });

  // Persist to localStorage whenever messages change (after streaming settles too)
  useEffect(() => {
    saveMessages(agentId, messages);
  }, [agentId, messages, status]);

  // Wissensspeicher: Stats + automatisches Abspeichern fertiger Antworten
  const [stats, setStats] = useState(() => ({
    count: 0,
    modules: 0,
    words: 0,
    budget: 0,
  }));
  useEffect(() => {
    const sync = () => setStats(knowledgeStats());
    sync();
    return subscribeKnowledge(sync);
  }, []);

  const savedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (savedRef.current.has(last.id)) return;
    savedRef.current.add(last.id);

    const answer = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    const question =
      [...messages]
        .reverse()
        .find((m) => m.role === "user")
        ?.parts.map((p) => (p.type === "text" ? p.text : ""))
        .join("") ?? "";
    const added = addEntries(extractFromAnswer(answer, question, agentId));
    const mods = added.filter((e) => e.kind === "module").length;
    if (added.length > 0) {
      toast.success(
        mods > 0
          ? `${mods} Modul(e) + Erkenntnis im Wissensspeicher gesichert.`
          : "Erkenntnis im Wissensspeicher gesichert.",
      );
    }
  }, [status, messages, agentId]);

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [agentId]);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text }, { body: { knowledge: buildContextBlock() } });
  };

  const clear = () => {
    setMessages([]);
    saveMessages(agentId, []);
    toast.success("Chat geleert.");
    textareaRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Zurück"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg"
            style={{
              backgroundColor: `color-mix(in oklch, ${agent.accent} 18%, transparent)`,
              color: agent.accent,
            }}
          >
            {agent.emoji}
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="truncate font-mono text-base font-semibold sm:text-lg"
              style={{ color: agent.accent }}
            >
              {agent.name}
            </h1>
            <p className="truncate font-mono text-[11px] text-muted-foreground sm:text-xs">
              {agent.role}
            </p>
          </div>

          <Link
            to="/wissen"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Wissensspeicher"
          >
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span>{stats.count}</span>
          </Link>

          <button
            onClick={clear}
            disabled={messages.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-mono text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">leeren</span>
          </button>
        </div>
      </header>

      {/* Chat body */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-2 sm:px-4">
        <Conversation className="flex-1">
          <ConversationContent className="py-6">
            {messages.length === 0 ? (
              <EmptyState agent={agent} onPick={(s) => setInput(s)} />
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                  {m.role === "assistant" ? (
                    <div className="w-full">
                      <MessageResponse>
                        {m.parts
                          .map((p) => (p.type === "text" ? p.text : ""))
                          .join("")}
                      </MessageResponse>
                    </div>
                  ) : (
                    <MessageContent>
                      {m.parts
                        .map((p) => (p.type === "text" ? p.text : ""))
                        .join("")}
                    </MessageContent>
                  )}
                </Message>
              ))
            )}

            {status === "submitted" && (
              <div className="mt-2 px-2 font-mono text-sm">
                <Shimmer>{`${agent.emoji} ${agent.name} denkt nach…`}</Shimmer>
              </div>
            )}

          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Composer */}
        <div className="sticky bottom-0 border-t border-border bg-background/85 py-3 backdrop-blur">
          <PromptInput
            onSubmit={() => {
              void submit();
            }}
          >

            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Frag ${agent.name}… (z.B. "${agent.suggestions[0]}")`}
              disabled={isLoading}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || isLoading}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 px-1 font-mono text-[10px] text-muted-foreground">
            Verlauf + Wissensspeicher liegen nur in deinem Browser ·{" "}
            {stats.words.toLocaleString("de-DE")} / {stats.budget.toLocaleString("de-DE")} Wörter
            Kontext · Powered by Lovable AI
          </p>
        </div>
      </main>
    </div>
  );
}

function EmptyState({
  agent,
  onPick,
}: {
  agent: (typeof AGENTS)[AgentId];
  onPick: (s: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{
          backgroundColor: `color-mix(in oklch, ${agent.accent} 18%, transparent)`,
          color: agent.accent,
        }}
      >
        {agent.emoji}
      </div>
      <h2 className="font-mono text-2xl font-semibold" style={{ color: agent.accent }}>
        {agent.name}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{agent.tagline}</p>

      <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
        {agent.suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group rounded-lg border border-border bg-card/50 p-3 text-sm text-foreground/85 transition-all hover:border-primary/50 hover:bg-card"
          >
            <span className="mr-2 font-mono text-xs text-primary group-hover:terminal-glow">
              &gt;
            </span>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-10 text-left">
        <h3 className="mb-1 font-mono text-sm font-semibold text-foreground">
          📜 Deine Vorlagen — Klick = an KI zum Verbessern schicken
        </h3>
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">
          Aus deinen Uploads bereinigt (Bugs raus, idempotent, mit Termux:API).
          Klick füllt die Eingabe mit „Analysiere &amp; verbessere dieses Skript…".
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {EXAMPLE_SCRIPTS.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onPick(buildImproveRequest(tpl))}
              className="group flex flex-col gap-1.5 rounded-lg border border-border bg-card/50 p-3 text-left transition-all hover:border-primary/50 hover:bg-card"
            >
              <span className="font-mono text-sm font-semibold text-foreground">
                {tpl.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {tpl.description}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {tpl.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </span>
              <span className="mt-1 font-mono text-[10px] text-primary opacity-60 group-hover:opacity-100">
                {tpl.filename} · {tpl.code.split("\n").length} Zeilen
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

