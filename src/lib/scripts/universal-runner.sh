#!/data/data/com.termux/files/usr/bin/bash
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
