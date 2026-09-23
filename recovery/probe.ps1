<#
.SYNOPSIS
  Phase 0 - Probe one CD/DVD to determine its format before batch recovery.

.DESCRIPTION
  Read-only inspection. Inserts nothing, copies nothing. It reports what kind
  of disc is in the drive so we know which recovery path to use:
    VCD / SVCD      -> MPEGAV\*.DAT      (extract with vcdimager / copy)
    DVD-Video       -> VIDEO_TS\*.VOB    (extract with libdvdcss/makemkv)
    Data CD         -> AVI/MP4/MOV/etc   (copy files directly)
    Audio CD        -> *.CDA / no filesystem
    Unknown/blank

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File recovery\probe.ps1
  powershell -ExecutionPolicy Bypass -File recovery\probe.ps1 -Drive D:
  powershell -ExecutionPolicy Bypass -File recovery\probe.ps1 -Json > probe.json
#>
[CmdletBinding()]
param(
  [string]$Drive,
  [switch]$Json
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { if (-not $Json) { Write-Host $msg } }

# ---- locate a CD/DVD drive with media ----
function Get-OpticalDrives {
  Get-CimInstance Win32_LogicalDisk -Filter "DriveType=5" -ErrorAction SilentlyContinue
}

if (-not $Drive) {
  $optical = Get-OpticalDrives
  if (-not $optical) {
    Write-Error "No CD/DVD drive found on this machine."
    exit 2
  }
  $withMedia = $optical | Where-Object { $_.Size -gt 0 -or (Test-Path "$($_.DeviceID)\") }
  if (-not $withMedia) {
    Write-Error "Optical drive(s) found but no disc with readable media is inserted. Insert the sample CD and retry."
    exit 2
  }
  $Drive = ($withMedia | Select-Object -First 1).DeviceID
}
$Drive = $Drive.TrimEnd('\')
$root = "$Drive\"

if (-not (Test-Path $root)) {
  Write-Error "Drive $Drive is not accessible. Insert the disc and retry."
  exit 2
}

$report = [ordered]@{
  probe_version = "1.0"
  timestamp      = (Get-Date).ToString("o")
  drive          = $Drive
  volume         = $null
  detected_format = "unknown"
  evidence       = @()
  file_count     = 0
  total_bytes    = 0
  extensions     = @{}
  top_level      = @()
  sample_files   = @()
  recommendation = ""
}

# ---- volume info ----
try {
  $vol = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$Drive'" -ErrorAction SilentlyContinue
  if ($vol) {
    $report.volume = [ordered]@{
      label = $vol.VolumeName
      filesystem = $vol.FileSystem
      size_bytes = $vol.Size
      free_bytes = $vol.FreeSpace
    }
  }
} catch {}

# ---- enumerate files (recursive, safe) ----
$files = @()
try {
  $files = Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue
} catch {
  $report.evidence += "Filesystem read error: $($_.Exception.Message)"
}

$exts = @{}
$samples = @()
foreach ($f in $files) {
  $ext = $f.Extension.ToLower()
  if ($ext) { $exts[$ext] = 1 + ($exts[$ext] -as [int]) }
  if ($samples.Count -lt 40) {
    $samples += [ordered]@{
      path  = $f.FullName.Substring($root.Length)
      bytes = $f.Length
    }
  }
}
$report.file_count  = $files.Count
$report.total_bytes = ($files | Measure-Object -Property Length -Sum).Sum
$report.extensions  = $exts
$report.sample_files = $samples

# ---- top-level entries ----
$report.top_level = @(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue |
  ForEach-Object { if ($_.PSIsContainer) { "[DIR] " + $_.Name } else { $_.Name } })

# ---- detect format ----
$paths = @($files | ForEach-Object { $_.FullName.ToLower() })
$hasVcdDir    = ($report.top_level | Where-Object { $_ -match '^\[DIR\]\s*vcd$' }).Count -gt 0
$hasSvdDir    = ($report.top_level | Where-Object { $_ -match '^\[DIR\]\s*svcd$' }).Count -gt 0
$hasVideoTs   = ($report.top_level | Where-Object { $_ -match '^\[DIR\]\s*video_ts$' }).Count -gt 0
$hasMpegavDat = ($paths | Where-Object { $_ -match '\\mpegav\\.+\.dat$' }).Count -gt 0
$hasVob       = ($paths | Where-Object { $_ -match '\\video_ts\\.+\.vob$' }).Count -gt 0
$hasCda       = ($paths | Where-Object { $_ -match '\.cda$' }).Count -gt 0
$videoExts    = @('.avi', '.mp4', '.mov', '.mpg', '.mpeg', '.mkv', '.wmv', '.flv', '.m4v', '.dat', '.vob', '.ts')

if ($hasVideoTs -or $hasVob) {
  $report.detected_format = "dvd_video"
  $report.evidence += "VIDEO_TS folder / .VOB files present"
  $report.recommendation = "DVD-Video. Rip with MakeMKV (free) or ddrescue ISO then libdvdcss. Preserve VIDEO_TS."
}
elseif ($hasVcdDir -and $hasMpegavDat) {
  $report.detected_format = "vcd"
  $report.evidence += "VCD folder + MPEGAV\\*.DAT present"
  $report.recommendation = "VCD (MPEG-1). Extract MPEGAV\*.DAT directly; optionally rebuild with vcdxrip."
}
elseif ($hasSvdDir) {
  $report.detected_format = "svcd"
  $report.evidence += "SVCD folder present"
  $report.recommendation = "SVCD (MPEG-2). Extract via vcdxrip / copy MPEGAV\*.DAT."
}
elseif ($hasCda) {
  $report.detected_format = "audio_cd"
  $report.evidence += ".CDA files present (audio CD filesystem)"
  $report.recommendation = "Audio CD. Use cdparanoia / Exact Audio Copy to WAV. Not a video documentary."
}
elseif ($files.Count -gt 0) {
  $vidFiles = @($files | Where-Object { $videoExts -contains $_.Extension.ToLower() })
  if ($vidFiles.Count -gt 0) {
    $report.detected_format = "data_cd_video"
    $report.evidence += "$($vidFiles.Count) video file(s) found on a data CD"
    $report.recommendation = "Data CD with video files. Copy the video files directly with the rip script."
  } else {
    $report.detected_format = "data_cd"
    $report.evidence += "$($files.Count) files, none recognized as video"
    $report.recommendation = "Data CD (non-video). Copy files and inspect manually."
  }
} else {
  $report.detected_format = "unknown"
  $report.evidence += "No readable files (blank, damaged, or unsupported filesystem)"
  $report.recommendation = "Attempt raw ISO with ddrescue, then re-probe the ISO."
}

# ---- output ----
if ($Json) {
  $report | ConvertTo-Json -Depth 6
} else {
  Write-Host ""
  Write-Host "==== CD PROBE REPORT ====" -ForegroundColor Cyan
  Write-Host "Drive        : $Drive"
  if ($report.volume) {
    Write-Host "Volume       : $($report.volume.label) [$($report.volume.filesystem)]"
    $gb = [math]::Round($report.total_bytes / 1GB, 2)
    Write-Host "Used         : $gb GB ($($report.file_count) files)"
  }
  Write-Host "Format       : $($report.detected_format.ToUpper())" -ForegroundColor Yellow
  Write-Host "Evidence     : $($report.evidence -join '; ')"
  Write-Host "Recommend    : $($report.recommendation)" -ForegroundColor Green
  Write-Host ""
  Write-Host "Top-level entries:"
  $report.top_level | ForEach-Object { Write-Host "  $_" }
  Write-Host ""
  Write-Host "Extensions:" (($report.extensions.GetEnumerator() | Sort-Object Value -Descending |
    ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "  ")
  Write-Host ""
  Write-Host "Next: choose a recovery path in recovery\rip.ps1 based on the format above." -ForegroundColor Cyan
}