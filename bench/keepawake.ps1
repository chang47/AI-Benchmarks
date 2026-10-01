# Runs a command while holding the system awake (ES_CONTINUOUS | ES_SYSTEM_REQUIRED), then releases it.
# A laptop that sleeps mid-run gets the run logged as a timeout (2026-09-27).
#   powershell -NoProfile -ExecutionPolicy Bypass -File bench/keepawake.ps1 node bench/overnight.mjs --plan "..."
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Cmd)

Add-Type -Namespace Bench -Name Power -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);
'@
$ES_CONTINUOUS = [uint32]2147483648
$ES_SYSTEM_REQUIRED = [uint32]1
[void][Bench.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
try {
  & $Cmd[0] $Cmd[1..($Cmd.Length - 1)]
  exit $LASTEXITCODE
} finally {
  [void][Bench.Power]::SetThreadExecutionState($ES_CONTINUOUS)
}
