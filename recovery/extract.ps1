<#
.SYNOPSIS
  Extract usable video files from a recovered disc (or mounted ISO/ISO mount)
  into the masters folder, based on the format reported by probe.ps1.

.DESCRIPTION
  VCD/SVCD : copy MPEGAV\*.DAT to <label>_NN.mpg
  DVD      : copy VIDEO_TS (VOB set) as-is
  Data CD  : copy recognized video files
  Always writes <label>.extract.json describing what was produced.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File recovery\extract.ps1 -Source D: -Label DOC001
  powershell -ExecutionPolicy Bypass -File recovery\extract.ps1 -Source X: -Label DOC001 -Masters storage\masters
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Label,
  [string]$Masters = "storage\masters",
  [string]$OutDir = "recovery\out"
)

$ErrorActionPreference = "Stop"
$Source = $Source.TrimEnd('\')
$destRoot = Join-Path $Masters $Label
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
$videoExts = @('.avi', '.mp4', '.mov', '.mpg', '.mpeg', '.mkv', '.wmv', '.flv', '.m4v', '.dat', '.vob', '.ts')

$produced = @()
$action = "unknown"

# ---- VCD / SVCD: MPEGAV *.DAT ----
$mpegav = Get-ChildItem -LiteralPath $Source -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ieq 'MPEGAV' } | Select-Object -First 1
if ($mpegav) {
  $action = "vcd_svcd"
  $n = 0
  Get-ChildItem -LiteralPath $mpegav.FullName -Filter '*.DAT' -File | Sort-Object Name | ForEach-Object {
    $n++
    $target = Join-Path $destRoot ("{0}_{1:D2}.mpg" -f $Label, $n)
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    $produced += $target
  }
}

# ---- DVD: VIDEO_TS ----
if ($produced.Count -eq 0) {
  $vts = Get-ChildItem -LiteralPath $Source -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ieq 'VIDEO_TS' } | Select-Object -First 1
  if ($vts) {
    $action = "dvd_video"
    $target = Join-Path $destRoot 'VIDEO_TS'
    robocopy $vts.FullName $target /E /R:1 /W:1 /NFL /NDL /NP | Out-Null
    $produced += Get-ChildItem -LiteralPath $target -File | ForEach-Object { $_.FullName }
  }
}

# ---- Data CD: direct video files ----
if ($produced.Count -eq 0) {
  $action = "data_cd"
  $vids = Get-ChildItem -LiteralPath $Source -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $videoExts -contains $_.Extension.ToLower() }
  $i = 0
  foreach ($v in $vids) {
    $i++
    $ext = $v.Extension.ToLower()
    $target = Join-Path $destRoot ("{0}_{1:D2}{2}" -f $Label, $i, $ext)
    Copy-Item -LiteralPath $v.FullName -Destination $target -Force
    $produced += $target
  }
}

$manifest = [ordered]@{
  label = $Label
  source = $Source
  action = $action
  file_count = $produced.Count
  files = $produced
  extracted_at = (Get-Date).ToString("o")
}
$manifestPath = Join-Path $OutDir "$Label.extract.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath

Write-Host "Extract mode : $action"
Write-Host "Files found  : $($produced.Count)"
$produced | ForEach-Object { Write-Host "  $_" }
Write-Host "Manifest     : $manifestPath"
Write-Host ""
Write-Host "Next: upload the master file(s) to YouTube (Unlisted), then register the video in the app."
if ($action -eq "dvd_video") {
  Write-Host "NOTE: DVD VIDEO_TS needs MakeMKV to join VOBs into one file before upload." -ForegroundColor Yellow
}