#!/data/data/com.termux/files/usr/bin/bash
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
