import autonomousScript from "./scripts/termux-autonomous.sh?raw";
import runnerScript from "./scripts/universal-runner.sh?raw";
import bootstrapScript from "./scripts/termux-bootstrap.sh?raw";

export interface ExampleScript {
  id: string;
  title: string;
  description: string;
  tags: string[];
  filename: string;
  code: string;
}

export const EXAMPLE_SCRIPTS: ExampleScript[] = [
  {
    id: "autonomous-framework",
    title: "Autonomes Bot-Framework",
    description:
      "Idempotentes Setup: proot-distro (Ubuntu), cronie via termux-services, Log-Rotation, Termux:API-Feedback.",
    tags: ["proot", "cron", "Termux:API"],
    filename: "termux-autonomous.sh",
    code: autonomousScript,
  },
  {
    id: "universal-runner",
    title: "Universal Projekt-Runner",
    description:
      "Erkennt Node / Python / Rust / Go / C++ / Bash automatisch, installiert Deps und startet.",
    tags: ["Node", "Python", "Rust", "Go", "C++"],
    filename: "run.sh",
    code: runnerScript,
  },
  {
    id: "termux-bootstrap",
    title: "Termux Grundinstallation",
    description:
      "Frisches Termux: Repos, Kernpakete, Storage, SSHd auf 8022, tmux-Autoattach.",
    tags: ["Setup", "SSH", "tmux"],
    filename: "bootstrap.sh",
    code: bootstrapScript,
  },
];

export function buildImproveRequest(script: ExampleScript): string {
  return [
    "Analysiere und verbessere dieses Skript. Prüfe Idempotenz, Fehlerbehandlung,",
    "fehlende Abhängigkeiten, Termux-spezifische Fallstricke und Sicherheit.",
    "Liste am Ende ALLE nötigen Pakete (pkg / pip / npm / cargo) explizit auf.",
    "",
    "Datei: `" + script.filename + "`",
    "",
    "```bash",
    script.code.trimEnd(),
    "```",
    "",
  ].join("\n");
}
