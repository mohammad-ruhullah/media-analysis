<#
.SYNOPSIS
  Rip an optical disc to an ISO image using ddrescue (via WSL), with logging.

.DESCRIPTION
  Recovery-first: ddrescue retries bad/scratched sectors and keeps a map file so
  a second pass can retry only failed areas. Falls back to a file-level copy for
  data CDs when WSL/ddrescue is unavailable.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File recovery\rip.ps1 -Drive D: -Label DOC001
  powershell -ExecutionPolicy Bypass -File recovery\rip.ps1 -Drive D: -Label DOC001 -Passes 2
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Drive,
  [Parameter(Mandatory = $true)][string]$Label,
  [string]$OutDir = "recovery\out",
  [int]$Passes = 2,
  [switch]$FileCopy
)

$ErrorActionPreference = "Stop"
$Drive = $Drive.TrimEnd('\')
$OutDir = (New-Item -ItemType Directory -Force -Path $OutDir).FullName
$isoPath = Join-Path $OutDir "$Label.iso"
$mapPath = Join-Path $OutDir "$Label.map"
$logPath = Join-Path $OutDir "$Label.rip.log"

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date).ToString("s"), $m
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line
}

Log "Rip started for disc '$Label' from $Drive -> $isoPath"

if ($FileCopy) {
  $dest = Join-Path $OutDir "$Label.files"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Log "File-level copy mode -> $dest"
  robocopy "$Drive\" "$dest" /E /R:2 /W:2 /NFL /NDL /NP | Out-Null
  Log "File copy exit code: $LASTEXITCODE"
} else {
  # ---- ddrescue via WSL ----
  $wslOk = $false
  try {
    wsl -e bash -lc "command -v ddrescue" *> $null
    $wslOk = ($LASTEXITCODE -eq 0)
  } catch { $wslOk = $false }

  if (-not $wslOk) {
    Log "ddrescue not found in WSL. Install: wsl -e bash -lc 'sudo apt-get install -y gddrescue'"
    Log "Alternatively re-run with -FileCopy for a plain file copy."
    exit 3
  }

  # Detect the block device for the optical drive inside WSL.
  $dev = (wsl -e bash -lc "for d in /dev/sr*; do [ -e \`$d ] && echo \`$d && break; done").Trim()
  if (-not $dev) {
    Log "No /dev/sr* device visible inside WSL. Ensure the disc is mounted in Windows and WSL has the drive."
    exit 3
  }
  Log "Using WSL device: $dev"

  $wslOut = (wsl -e bash -lc "wslpath -a '$isoPath'").Trim()
  $wslMap = (wsl -e bash -lc "wslpath -a '$mapPath'").Trim()

  for ($p = 1; $p -le $Passes; $p++) {
    $passArgs = if ($p -eq 1) { "-b 2048 -n" } else { "-b 2048 -r 3" }
    Log "ddrescue pass $p : ddrescue $passArgs $dev '$wslOut' '$wslMap'"
    wsl -e bash -lc "ddrescue $passArgs '$dev' '$wslOut' '$wslMap' 2>&1" |
      Tee-Object -FilePath $logPath -Append
  }
  Log "ddrescue finished."
}

# ---- hash + size ----
if (Test-Path -LiteralPath $isoPath) {
  Log "Computing SHA-256 (this can take a while for large discs)..."
  $hash = (Get-FileHash -LiteralPath $isoPath -Algorithm SHA256).Hash
  $size = (Get-Item -LiteralPath $isoPath).Length
  Log "ISO size: $size bytes"
  Log "SHA256: $hash"
  $meta = [ordered]@{
    label = $Label; iso = $isoPath; sha256 = $hash; bytes = $size
    rip_log = $logPath; completed_at = (Get-Date).ToString("o")
  }
  $meta | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutDir "$Label.meta.json")
  Log "Wrote $Label.meta.json"
} else {
  Log "No ISO produced (file-copy mode or failure)."
}

Log "Done."