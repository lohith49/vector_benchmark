# PowerShell equivalent of port_forward.sh for native Windows users.
# Usage:
#   .\scripts\port_forward.ps1            # foreground (Ctrl-C to stop)
#   .\scripts\port_forward.ps1 -Stop      # stop background forwards
#   .\scripts\port_forward.ps1 -Background

param(
  [switch]$Background,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$Namespace = 'vectorbench'
$PidFile = Join-Path $env:TEMP 'vectorbench-pf.pids'

$Targets = @(
  @{ Local = 6333;  Svc = 'svc/qdrant';           Remote = 6333  },
  @{ Local = 8080;  Svc = 'svc/weaviate';         Remote = 8080  },
  @{ Local = 50051; Svc = 'svc/weaviate';         Remote = 50051 },
  @{ Local = 5433;  Svc = 'svc/pgvector';         Remote = 5432  },
  @{ Local = 5434;  Svc = 'svc/results-postgres'; Remote = 5432  }
)

if ($Stop) {
  if (Test-Path $PidFile) {
    Get-Content $PidFile | ForEach-Object {
      try { Stop-Process -Id ([int]$_) -Force -ErrorAction Stop } catch { }
    }
    Remove-Item $PidFile -Force
    Write-Output 'Stopped background port-forwards.'
  } else {
    Write-Output 'No PID file; nothing to stop.'
  }
  return
}

if ($Background) {
  '' | Out-File -FilePath $PidFile -Encoding ascii
  foreach ($t in $Targets) {
    $args = @('-n', $Namespace, 'port-forward', $t.Svc, "$($t.Local):$($t.Remote)")
    $p = Start-Process -FilePath 'kubectl' -ArgumentList $args -PassThru -WindowStyle Hidden
    Add-Content -Path $PidFile -Value $p.Id
    Write-Output ("  forwarding {0} -> localhost:{1} (pid {2})" -f $t.Svc, $t.Local, $p.Id)
  }
  Write-Output 'Background forwards started. Stop with: .\scripts\port_forward.ps1 -Stop'
  return
}

# Foreground
$jobs = @()
try {
  foreach ($t in $Targets) {
    $args = @('-n', $Namespace, 'port-forward', $t.Svc, "$($t.Local):$($t.Remote)")
    $p = Start-Process -FilePath 'kubectl' -ArgumentList $args -PassThru
    $jobs += $p
    Write-Output ("  forwarding {0} -> localhost:{1} (pid {2})" -f $t.Svc, $t.Local, $p.Id)
  }
  Write-Output 'Foreground forwards running. Ctrl-C to stop.'
  Wait-Process -Id $jobs.Id
} finally {
  foreach ($j in $jobs) { try { Stop-Process -Id $j.Id -Force -ErrorAction Stop } catch { } }
}
