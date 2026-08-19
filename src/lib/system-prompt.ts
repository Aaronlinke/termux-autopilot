import { AGENTS, type AgentId } from "./agents";

/**
 * Baut den kompletten System-Prompt (Agent + interne Experten-Runde + Wissensspeicher).
 * Wird sowohl serverseitig (Lovable AI) als auch clientseitig (Puter.js) genutzt.
 */
export function buildSystemPrompt(agentId: AgentId, knowledge = ""): string {
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

  const trimmed = knowledge.trim();
  const memory = trimmed
    ? `
WISSENSSPEICHER (bereits erarbeitetes Wissen des Nutzers — LIES ALLES und nutze es):
Nutze vorhandene Module/Erkenntnisse wieder statt sie neu zu erfinden, verweise auf sie beim Namen und verbessere sie bei Bedarf.
<<<WISSENSSPEICHER
${trimmed}
WISSENSSPEICHER>>>`.trim()
    : "";

  return [agent.systemPrompt, council, memory].filter(Boolean).join("\n\n");
}
