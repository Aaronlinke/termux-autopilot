#!/data/data/com.termux/files/usr/bin/bash
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
