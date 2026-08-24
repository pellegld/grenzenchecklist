# ASCII-only. Zoekt sleutels en adressen in alles wat git zou meesturen.
# Draai dit voor een push:  powershell -File tools\check-geheimen.ps1
# Exitcode 1 als er iets gevonden is, zodat je hem in een hook kunt hangen.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$bestanden = git ls-files 2>$null
if (-not $bestanden) {
  Write-Output 'Geen git-repo of geen bestanden onder versiebeheer.'
  exit 0
}

# Patronen die op een sleutel of persoonsgegeven wijzen. Bewust ruim: liever een
# vals alarm dat je wegwuift dan een sleutel die je pas op GitHub terugvindt.
$patronen = @(
  @{ naam = 'API-sleutel in toewijzing'; re = '(?i)(api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*["'']?[A-Za-z0-9_\-]{16,}' },
  @{ naam = 'ORS-sleutel';               re = '5b3ce[0-9a-f]{30,}' },
  @{ naam = 'Google-sleutel';            re = 'AIza[0-9A-Za-z_\-]{30,}' },
  @{ naam = 'Mapbox-token';              re = '\bpk\.eyJ[A-Za-z0-9_\-\.]{20,}' },
  @{ naam = 'AWS-sleutel';               re = 'AKIA[0-9A-Z]{16}' },
  @{ naam = 'Prive-sleutel';             re = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ naam = 'E-mailadres';               re = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' }
)

# Deze horen er juist wel in te staan.
$uitzonderingen = @(
  'jouw@contactadres.nl',
  'noreply@anthropic.com',
  'zet-hier-je-sleutel'
)

$gevonden = 0
foreach ($f in $bestanden) {
  if (-not (Test-Path $f -PathType Leaf)) { continue }
  # Binaire bestanden overslaan
  if ($f -match '\.(woff2|png|jpg|jpeg|gif|ico|pdf|zip)$') { continue }

  $regels = Get-Content -LiteralPath $f -ErrorAction SilentlyContinue
  if (-not $regels) { continue }

  for ($i = 0; $i -lt $regels.Count; $i++) {
    $regel = $regels[$i]
    foreach ($p in $patronen) {
      $m = [regex]::Match($regel, $p.re)
      if (-not $m.Success) { continue }
      $treffer = $m.Value
      $skip = $false
      foreach ($u in $uitzonderingen) { if ($treffer -like "*$u*") { $skip = $true } }
      if ($skip) { continue }

      $kort = $treffer
      if ($kort.Length -gt 60) { $kort = $kort.Substring(0, 60) + '...' }
      Write-Output ("{0}:{1}  [{2}]  {3}" -f $f, ($i + 1), $p.naam, $kort)
      $gevonden++
    }
  }
}

Write-Output ''
if ($gevonden -gt 0) {
  Write-Output ("GEVONDEN: {0} mogelijke geheimen in bestanden onder versiebeheer." -f $gevonden)
  Write-Output 'Haal ze eruit en zet ze bij je host in een omgevingsvariabele.'
  exit 1
}
Write-Output 'Schoon: geen sleutels of adressen in bestanden onder versiebeheer.'
exit 0
