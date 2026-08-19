import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { type AgentId } from "@/lib/agents";
import { buildSystemPrompt } from "@/lib/system-prompt";
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

        const system = buildSystemPrompt(agentId, knowledge);


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
