#!/usr/bin/env bash
# Machine-wide FIFO lock for memory-heavy steps, so parallel agents never run two at once.
#   bash bench/heavyq.sh <label> <command...>
# Heavy = an agent run (`bench/cli.mjs run`), a grade with a browser or judge batch, `claude -p`, pandas/duckdb on
# full data, anything > ~2 GB. Claude Code's low-memory reaper kills parallel jobs on a ~10 GB-free laptop.
# Exception (agreed 2026-10-02): a step that peaks <= 2 GB and lasts <= 10 min may skip the lock if free RAM >= 5 GB.
# Lock dir: $VBENCH_LOCK_DIR, default <repo>/.bench-cache/lock (gitignored). Same dir = same lock for every caller.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${VBENCH_LOCK_DIR:-$ROOT/.bench-cache/lock}"
LOCK="$DIR/heavy.lock"
QUEUE="$DIR/heavy.queue"
mkdir -p "$QUEUE"
label="$1"; shift
ticket="$QUEUE/$(date +%s%N)-$$"
echo "$label" > "$ticket"
cleanup() { rm -f "$ticket"; [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"; }
trap cleanup EXIT INT TERM
waited=0
while :; do
  # drop tickets whose waiter died (its pid is the ticket suffix)
  for t in "$QUEUE"/*; do
    [ -e "$t" ] || continue
    kill -0 "${t##*-}" 2>/dev/null || rm -f "$t"
  done
  # a lock older than 3 h is stale (the longest agent run is capped at 2 h)
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ]; then rm -rf "$LOCK"; fi
  # so is a lock whose owner died (a killed session or crash leaves it behind; 2026-10-08 one blocked a batch for ~40 min).
  # Skip a lock without a pid yet: the owner writes it right after taking the lock.
  owner="$(cat "$LOCK/pid" 2>/dev/null)"
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then echo "[heavy] removing stale lock of dead pid $owner ($(cat "$LOCK/owner" 2>/dev/null))" >&2; rm -rf "$LOCK"; fi
  first="$(ls "$QUEUE" | sort | head -1)"
  if [ "$QUEUE/$first" = "$ticket" ] && mkdir "$LOCK" 2>/dev/null; then break; fi
  sleep 5; waited=$((waited+5))
  [ $((waited % 300)) -eq 0 ] && echo "[heavy] $label waiting ${waited}s; held by: $(cat "$LOCK/owner" 2>/dev/null); queue: $(cat "$QUEUE"/* 2>/dev/null | tr '\n' ' ')" >&2
done
echo "$$" > "$LOCK/pid"
echo "$label pid=$$ $(date +%H:%M:%S)" > "$LOCK/owner"
rm -f "$ticket"
"$@"
