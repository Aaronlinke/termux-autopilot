/**
 * Puter.js — kostenlose KI direkt aus dem Browser (User-Pays-Modell).
 * Kein API-Key, keine Server-Kosten: der eingeloggte Puter-Nutzer zahlt sein
 * eigenes (großzügiges Free-) Kontingent. Doku: https://docs.puter.com
 */

export const PUTER_MODELS = [
  { id: "gpt-5-nano", label: "GPT-5 nano (schnell)" },
  { id: "gpt-5.1", label: "GPT-5.1 (stark)" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

export const DEFAULT_PUTER_MODEL = "gpt-5-nano";

const MODEL_KEY = "termux-copilot:puter:model";
const PROVIDER_KEY = "termux-copilot:provider";

export type Provider = "lovable" | "puter";

export function getProvider(): Provider {
  if (typeof window === "undefined") return "lovable";
  return window.localStorage.getItem(PROVIDER_KEY) === "puter"
    ? "puter"
    : "lovable";
}

export function setProvider(p: Provider) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROVIDER_KEY, p);
}

export function getPuterModel(): string {
  if (typeof window === "undefined") return DEFAULT_PUTER_MODEL;
  return window.localStorage.getItem(MODEL_KEY) ?? DEFAULT_PUTER_MODEL;
}

export function setPuterModel(model: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODEL_KEY, model);
}

/* ---------- SDK-Laden ---------- */

type PuterChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface PuterGlobal {
  ai: {
    chat: (
      messages: PuterChatMessage[],
      opts?: { model?: string; stream?: boolean },
    ) => Promise<AsyncIterable<{ text?: string }> | { toString(): string }>;
  };
  auth: {
    isSignedIn: () => boolean;
    signIn: () => Promise<unknown>;
    signOut: () => void;
    getUser: () => Promise<{ username?: string }>;
  };
}

declare global {
  interface Window {
    puter?: PuterGlobal;
  }
}

let loading: Promise<PuterGlobal> | null = null;

export function loadPuter(): Promise<PuterGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Puter.js läuft nur im Browser."));
  }
  if (window.puter) return Promise.resolve(window.puter);
  if (loading) return loading;

  loading = new Promise<PuterGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-puter="1"]',
    );
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.puter) resolve(window.puter);
      else reject(new Error("Puter.js geladen, aber window.puter fehlt."));
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", () =>
      reject(new Error("Puter.js konnte nicht geladen werden.")),
    );
    if (!existing) {
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.dataset.puter = "1";
      document.head.appendChild(script);
    }
  });

  return loading;
}

export async function puterSignIn() {
  const puter = await loadPuter();
  if (!puter.auth.isSignedIn()) await puter.auth.signIn();
  return puter.auth.getUser().catch(() => ({}) as { username?: string });
}

export async function puterIsSignedIn(): Promise<boolean> {
  try {
    const puter = await loadPuter();
    return puter.auth.isSignedIn();
  } catch {
    return false;
  }
}

export async function puterSignOut() {
  const puter = await loadPuter();
  puter.auth.signOut();
}

/**
 * Streamt eine Antwort von Puter.js. `onDelta` bekommt jedes Textstück.
 */
export async function puterChatStream(
  messages: PuterChatMessage[],
  model: string,
  onDelta: (text: string) => void,
): Promise<void> {
  const puter = await loadPuter();
  if (!puter.auth.isSignedIn()) {
    await puter.auth.signIn();
  }

  const res = await puter.ai.chat(messages, { model, stream: true });

  if (res && typeof (res as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    for await (const part of res as AsyncIterable<{ text?: string }>) {
      if (part?.text) onDelta(part.text);
    }
    return;
  }

  const text = String(res ?? "");
  if (text) onDelta(text);
}
