#!/usr/bin/env bash
# Pilot / new-model queue: one agent run (+ grade) per lock hold, attempt-major, so validators and builds can slot in
# between runs (bench/overnight.mjs holds one process for the whole batch).
#   bash bench/pilot-queue.sh <task> <n> <harness:model:profile> [...]
#   bash bench/pilot-queue.sh 25b-monday-inbox-traps 2 claude:claude-sonnet-5-5:clean-room-medium claude:claude-opus-5-5:clean-room-medium
# Log: .bench-cache/logs/pilot-queue.log. Uses bench/keepawake.ps1 on Windows (it can NOT stop a lid-close sleep).
# Long queues outlive a Claude Code background command's 2 h tracking limit: poll the log, don't trust the tracker.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
task="$1"; n="$2"; shift 2
mkdir -p .bench-cache/logs
LOG=.bench-cache/logs/pilot-queue.log
awake=()
command -v powershell >/dev/null 2>&1 && awake=(powershell -NoProfile -ExecutionPolicy Bypass -File bench/keepawake.ps1)
for a in $(seq 1 "$n"); do
  for arm in "$@"; do
    IFS=: read -r h m p <<< "$arm"
    echo "$(date -Is) START $task $h $m $p attempt $a" >> "$LOG"
    bash bench/heavyq.sh "pilot-$task-$m-$a" "${awake[@]}" \
      node bench/cli.mjs run --task "$task" --harness "$h" --model "$m" --profile "$p" --grade >> "$LOG" 2>&1
    echo "$(date -Is) END $task $h $m $p attempt $a exit=$?" >> "$LOG"
  done
done
