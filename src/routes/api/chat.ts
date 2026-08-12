import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AGENTS, type AgentId } from "@/lib/agents";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = {
  messages?: unknown;
  agentId?: AgentId;
  knowledge?: unknown;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;
        const agentId: AgentId = (body.agentId ?? "kollektiv") as AgentId;
        const knowledge =
          typeof body.knowledge === "string" ? body.knowledge.trim() : "";

        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const agent = AGENTS[agentId] ?? AGENTS.kollektiv;

        const peers = Object.values(AGENTS)
          .filter((a) => a.id !== agent.id)
          .map((a) => `${a.emoji} ${a.name} (${a.role}) — ${a.tagline}`)
          .join("\n");

        const council = `
INTERNE EXPERTEN-RUNDE (Pflicht bei JEDER Antwort):
Bevor du antwortest, denken deine Kollegen still mit:
${peers}
Ablauf:
1. Du entwirfst die Lösung aus DEINER Perspektive (${agent.role}).
2. Jeder Kollege prüft sie aus seiner Sicht und ergänzt/korrigiert intern.
3. Du lieferst EINE fusionierte, präzisere Antwort — in DEINER Stimme und deinem Format.
4. Am Ende der Antwort ein kurzer Block:
### 🤝 Kollegen-Input
- <Emoji Name>: <max. 1 Satz Ergänzung oder Warnung>
Widersprüche nicht verschweigen — nenne sie als "schnell vs. robust".`.trim();

        const memory = knowledge
          ? `
WISSENSSPEICHER (bereits erarbeitetes Wissen des Nutzers — LIES ALLES und nutze es):
Nutze vorhandene Module/Erkenntnisse wieder statt sie neu zu erfinden, verweise auf sie beim Namen und verbessere sie bei Bedarf.
<<<WISSENSSPEICHER
${knowledge}
WISSENSSPEICHER>>>`.trim()
          : "";

        const system = [agent.systemPrompt, council, memory]
          .filter(Boolean)
          .join("\n\n");

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
