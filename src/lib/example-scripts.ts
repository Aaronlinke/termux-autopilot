// Vom Nutzer hochgeladene Termux-Skripte, aufgeräumt & bugfixed.
// Werden in der App als klickbare Vorlagen angezeigt und können mit einem
// Klick an eine KI zur Analyse/Verbesserung geschickt werden.

export interface ExampleScript {
  id: string;
  title: string;
  description: string;
  tags: string[];
  filename: string;
  code: string;
}

// --- Vorlage 1: Autonomes Bot-Framework v2.1 (idempotent, mit Termux:API) ---
const AUTONOMOUS_FRAMEWORK = String.raw`#!/data/data/com.termux/files/usr/bin/bash
# TERMUX AUTONOMOUS BOT FRAMEWORK v2.1.3 (bereinigt)
# Idempotentes Setup: Pakete, proot-distro (Ubuntu), cronie via termux-services,
# Log-Rotation, Termux:API-Feedback.

set -euo pipefail
IFS=$'\n\t'

LOG_DIR="$HOME/.log"
SCRIPT_NAME=$(basename "$0" .sh)
LOG_FILE="$LOG_DIR/$SCRIPT_NAME.log"
DISTRO_NAME="ubuntu"
TERMUX_BIN_DIR="$HOME/.local/bin"
TERMUX_CONFIG_DIR="$HOME/.config"
PROOT_ALIASES_DIR="$TERMUX_CONFIG_DIR/proot-distro"
CRONIE_CONF_DIR="$TERMUX_CONFIG_DIR/cronie/crontabs"
SETUP_DONE_FLAG="$HOME/.setup_done"
TERMUX_API_OK=false

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"
chmod 600 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2)

printf '--- %s gestartet %s ---\n' "$SCRIPT_NAME" "$(date --iso-8601=seconds)"

has() { command -v "$1" >/dev/null 2>&1; }

check_api() {
  if has termux-toast; then
    TERMUX_API_OK=true
    printf 'Termux:API verfügbar.\n'
  else
    printf 'WARNUNG: Termux:API fehlt. pkg install termux-api + F-Droid App.\n'
  fi
}

# --- Pakete ---
REQUIRED=(git python nodejs proot proot-distro cronie termux-services termux-api jq rsync tmux ripgrep fzf)
MISSING=()
for p in "${REQUIRED[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 || MISSING+=("$p")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  printf 'Installiere: %s\n' "${MISSING[*]}"
  pkg update -y
  pkg install -y "${MISSING[@]}"
fi

check_api

if [ ! -f "$SETUP_DONE_FLAG" ]; then
  printf '=== Erst-Setup ===\n'
  $TERMUX_API_OK && termux-toast "Termux Setup startet…" || true

  mkdir -p "$TERMUX_BIN_DIR" "$PROOT_ALIASES_DIR" "$CRONIE_CONF_DIR"
  chmod 700 "$TERMUX_BIN_DIR" "$PROOT_ALIASES_DIR" "$CRONIE_CONF_DIR"

  if ! proot-distro list --installed 2>/dev/null | grep -q "^$DISTRO_NAME\$"; then
    printf 'Installiere proot-distro %s …\n' "$DISTRO_NAME"
    proot-distro install "$DISTRO_NAME"
    proot-distro login "$DISTRO_NAME" --no-termux-login -- true
  fi

  ALIAS_FILE="$PROOT_ALIASES_DIR/aliases"
  grep -q "run_${DISTRO_NAME}" "$ALIAS_FILE" 2>/dev/null || \
    printf "alias run_%s='proot-distro login %s'\n" "$DISTRO_NAME" "$DISTRO_NAME" >> "$ALIAS_FILE"
  chmod 600 "$ALIAS_FILE"

  CRON_FILE="$CRONIE_CONF_DIR/root"
  TICK_SCRIPT="$TERMUX_BIN_DIR/heartbeat.sh"
  if [ ! -f "$TICK_SCRIPT" ]; then
    cat > "$TICK_SCRIPT" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
printf '[%s] heartbeat\n' "\$(date --iso-8601=seconds)" >> "$LOG_DIR/heartbeat.log"
EOF
    chmod 700 "$TICK_SCRIPT"
  fi
  mkdir -p "$(dirname "$CRON_FILE")"
  touch "$CRON_FILE"
  grep -q "$TICK_SCRIPT" "$CRON_FILE" || \
    printf '*/5 * * * * env HOME=%q PREFIX=%q PATH=%q/bin bash %q\n' \
      "$HOME" "$PREFIX" "$PREFIX" "$TICK_SCRIPT" >> "$CRON_FILE"
  chmod 600 "$CRON_FILE"

  if has termux-services; then
    sv-enable cronie 2>/dev/null || true
    sv up cronie 2>/dev/null || true
  fi

  find "$LOG_DIR" -type f -name '*.log' -mtime +7 -delete
  touch "$SETUP_DONE_FLAG"
  $TERMUX_API_OK && termux-notification --id setup_ok --title "Termux" --content "Framework bereit" || true
else
  printf 'Setup bereits erledigt (%s).\n' "$SETUP_DONE_FLAG"
  $TERMUX_API_OK && termux-toast "Framework bereit." || true
fi

printf '--- %s beendet %s ---\n' "$SCRIPT_NAME" "$(date --iso-8601=seconds)"
`;

// --- Vorlage 2: Universeller Projekt-Runner ---
const UNIVERSAL_RUNNER = String.raw`#!/data/data/com.termux/files/usr/bin/bash
# UNIVERSAL PROJECT RUNNER
# Erkennt Sprache/Framework in $1 (oder $PWD), installiert Abhängigkeiten,
# startet das Projekt. Python / Node / Rust / Go / C++ / Bash.

set -euo pipefail
IFS=$'\n\t'

TARGET="${1:-$PWD}"
cd "$TARGET" || { echo "Pfad $TARGET fehlt" >&2; exit 1; }

log()  { printf '\033[1;34m[RUN]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n'   "$*"; }
die()  { printf '\033[1;31m[X]\033[0m %s\n' "$*" >&2; exit 1; }

ensure_pkg() { dpkg -s "$1" >/dev/null 2>&1 || pkg install -y "$1"; }

if [ -f package.json ]; then
  log "Node.js-Projekt erkannt."
  ensure_pkg nodejs
  [ -d node_modules ] || npm install
  if jq -e '.scripts.start' package.json >/dev/null 2>&1; then npm start
  elif jq -e '.scripts.dev' package.json >/dev/null 2>&1;   then npm run dev
  else node "$(jq -r '.main // "index.js"' package.json)"
  fi
elif [ -f pyproject.toml ] || [ -f requirements.txt ] || compgen -G "*.py" >/dev/null; then
  log "Python-Projekt erkannt."
  ensure_pkg python
  [ -d .venv ] || python -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  [ -f requirements.txt ] && pip install -q -r requirements.txt
  [ -f pyproject.toml ]   && pip install -q -e . || true
  if   [ -f main.py ]; then python main.py
  elif [ -f app.py ];  then python app.py
  else python "$(ls -1 *.py | head -n1)"
  fi
elif [ -f Cargo.toml ]; then
  log "Rust-Projekt erkannt."
  ensure_pkg rust
  cargo run
elif [ -f go.mod ]; then
  log "Go-Projekt erkannt."
  ensure_pkg golang
  go run ./...
elif compgen -G "*.cpp" >/dev/null || compgen -G "*.cc" >/dev/null; then
  log "C++-Projekt erkannt."
  ensure_pkg clang
  clang++ -std=c++20 -O2 -o /tmp/app.out ./*.cpp && /tmp/app.out
elif compgen -G "*.sh" >/dev/null; then
  log "Shell-Projekt erkannt."
  chmod +x ./*.sh
  bash "$(ls -1 *.sh | head -n1)"
else
  die "Kein bekannter Projekttyp in $TARGET"
fi
`;

// --- Vorlage 3: Termux Grundinstallation (frisches Handy) ---
const TERMUX_BOOTSTRAP = String.raw`#!/data/data/com.termux/files/usr/bin/bash
# TERMUX BOOTSTRAP — frisches Termux komplett einrichten.
# Repos, Kernpakete, Storage, SSH auf 8022, tmux-Autoattach, motd.
# Idempotent — beliebig oft ausführbar.

set -euo pipefail
IFS=$'\n\t'

echo "[1/6] Repos auswählen (schnellster Mirror)"
termux-change-repo || true

echo "[2/6] pkg update & Kernpakete"
pkg update -y && pkg upgrade -y
pkg install -y root-repo x11-repo tur-repo || true
pkg install -y \
  git curl wget openssh openssl \
  python nodejs rust golang clang make \
  jq ripgrep fzf tmux nano vim \
  termux-api termux-services proot proot-distro \
  cronie rsync htop

echo "[3/6] Storage-Zugriff freischalten"
termux-setup-storage || true

echo "[4/6] SSHd auf Port 8022 (Passwortlogin)"
passwd || true   # setzt Termux-Passwort falls noch nicht gesetzt
sv-enable sshd 2>/dev/null || true
sv up sshd     2>/dev/null || true
IP=$(ifconfig 2>/dev/null | awk '/inet /{print $2}' | grep -v 127 | head -n1 || echo '?')
printf 'SSH: ssh -p 8022 %s@%s\n' "$(whoami)" "$IP"

echo "[5/6] tmux-Autoattach für neue Termux-Session"
BASHRC="$HOME/.bashrc"
grep -q 'tmux attach' "$BASHRC" 2>/dev/null || cat >> "$BASHRC" <<'EOF'

# Auto-tmux: eine Session pro Termux-Start
if command -v tmux >/dev/null 2>&1 && [ -z "${TMUX:-}" ] && [ -n "${PS1:-}" ]; then
  tmux attach -t main 2>/dev/null || tmux new -s main
fi
EOF

echo "[6/6] MOTD säubern"
: > "$PREFIX/etc/motd"
echo "Fertig. Neue Session öffnen."
`;

export const EXAMPLE_SCRIPTS: ExampleScript[] = [
  {
    id: "autonomous-framework",
    title: "Autonomes Bot-Framework",
    description:
      "Idempotentes Setup mit proot-distro (Ubuntu), cronie via termux-services, Log-Rotation und Termux:API-Feedback.",
    tags: ["proot", "cron", "Termux:API", "idempotent"],
    filename: "termux-autonomous.sh",
    code: AUTONOMOUS_FRAMEWORK,
  },
  {
    id: "universal-runner",
    title: "Universal Projekt-Runner",
    description:
      "Erkennt Node / Python / Rust / Go / C++ / Bash automatisch, installiert Abhängigkeiten und startet.",
    tags: ["Node", "Python", "Rust", "Go", "C++"],
    filename: "run.sh",
    code: UNIVERSAL_RUNNER,
  },
  {
    id: "termux-bootstrap",
    title: "Termux Grundinstallation",
    description:
      "Frisches Termux komplett aufsetzen: Repos, Kernpakete, Storage, SSHd auf 8022, tmux-Autoattach.",
    tags: ["Setup", "SSH", "tmux", "Repos"],
    filename: "bootstrap.sh",
    code: TERMUX_BOOTSTRAP,
  },
];

export function buildImproveRequest(script: ExampleScript): string {
  return `Analysiere und verbessere dieses Skript. Prüfe Idempotenz, Fehlerbehandlung, fehlende Abhängigkeiten, Termux-spezifische Fallstricke und Sicherheit. Liste am Ende ALLE nötigen Pakete (pkg / pip / npm / cargo) explizit auf.

Datei: \`${script.filename}\`

\`\`\`bash
${script.code}\`\`\`
`;
}
