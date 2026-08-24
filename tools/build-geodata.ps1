# Bouwt borders.json en cities.json opnieuw op uit Natural Earth (publiek domein).
#
#   powershell -ExecutionPolicy Bypass -File tools\build-geodata.ps1
#
# De brondata wordt eenmalig gedownload naar tools\_cache (ruim 30 MB) en daarna
# hergebruikt. Verwijder die map om verse data op te halen.
#
# LET OP: dit bestand bevat bewust geen niet-ASCII tekens. PowerShell 5.1 leest
# een .ps1 zonder BOM als ANSI, waardoor letterlijke accenten dubbel geencodeerd
# in de uitvoer belanden. Diakrieten worden daarom met [char]-codes opgebouwd.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root  = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $PSScriptRoot '_cache'
if (-not (Test-Path $cache)) { New-Item -ItemType Directory -Path $cache | Out-Null }
$inv = [System.Globalization.CultureInfo]::InvariantCulture

# ---------------------------------------------------------------- instellingen
# De 16 landen uit countries.json krijgen fijne polygonen. De rest zit erin om
# te kunnen melden "je route raakt dit land, maar het staat nog niet in de data".
$covered = 'BE','NL','DE','FR','LU','AT','CH','IT','ES','PT','HR','SI','CZ','DK','SE','GB'
$TOL_FINE        = 0.002   # ~220 m
$TOL_COARSE      = 0.03    # ~3,3 km
$MIN_RING_FINE   = 0.12    # bbox-diagonaal in graden; kleinere eilanden vervallen
$MIN_RING_COARSE = 0.5
$MIN_POP         = 0       # 0 = alle plaatsen die Natural Earth in Europa kent
$W = -11.0; $E = 32.5; $S = 34.0; $N = 71.5   # rijdbaar Europa

$e = [char]0xEB   # e-trema
$map = @{
  BEL='BE'; NLD='NL'; DEU='DE'; FRA='FR'; LUX='LU'; AUT='AT'; CHE='CH'; ITA='IT'
  ESP='ES'; PRT='PT'; HRV='HR'; SVN='SI'; CZE='CZ'; DNK='DK'; SWE='SE'; GBR='GB'
  POL='PL'; SVK='SK'; HUN='HU'; NOR='NO'; FIN='FI'; IRL='IE'; SRB='RS'; BIH='BA'
  MNE='ME'; ALB='AL'; GRC='GR'; ROU='RO'; BGR='BG'; MKD='MK'; LIE='LI'; MCO='MC'
  AND='AD'; SMR='SM'; KOS='XK'
}
$names = @{
  BE=('Belgi'+$e); NL='Nederland'; DE='Duitsland'; FR='Frankrijk'; LU='Luxemburg'
  AT='Oostenrijk'; CH='Zwitserland'; IT=('Itali'+$e); ES='Spanje'; PT='Portugal'
  HR=('Kroati'+$e); SI=('Sloveni'+$e); CZ=('Tsjechi'+$e); DK='Denemarken'; SE='Zweden'
  GB='Verenigd Koninkrijk'; PL='Polen'; SK='Slowakije'; HU='Hongarije'; NO='Noorwegen'
  FI='Finland'; IE='Ierland'; RS=('Servi'+$e); BA=('Bosni'+$e+' en Herzegovina')
  ME='Montenegro'; AL=('Albani'+$e); GR='Griekenland'; RO=('Roemeni'+$e); BG='Bulgarije'
  MK=('Noord-Macedoni'+$e); LI='Liechtenstein'; MC='Monaco'; AD='Andorra'
  SM='San Marino'; XK='Kosovo'
}

function Get-Source([string]$name, [string]$url) {
  $p = Join-Path $cache $name
  if (-not (Test-Path $p)) {
    Write-Host ("downloaden: " + $name)
    Invoke-WebRequest -Uri $url -OutFile $p -UseBasicParsing -TimeoutSec 900
  }
  return $p
}

# ------------------------------------------------------- Douglas-Peucker
function Simplify([double[]]$xs, [double[]]$ys, [int]$cnt, [double]$tol, [double]$xscale) {
  $keep = New-Object 'bool[]' $cnt
  if ($cnt -le 3) { for ($z=0; $z -lt $cnt; $z++) { $keep[$z] = $true } }
  else {
    $keep[0] = $true; $keep[$cnt-1] = $true
    $stack = New-Object 'System.Collections.Generic.Stack[int[]]'
    $stack.Push([int[]]@(0, ($cnt-1)))
    $tol2 = $tol * $tol
    while ($stack.Count -gt 0) {
      $seg = $stack.Pop(); $i = $seg[0]; $j = $seg[1]
      if ($j -le $i + 1) { continue }
      $ax = $xs[$i] * $xscale; $ay = $ys[$i]
      $bx = $xs[$j] * $xscale; $by = $ys[$j]
      $dx = $bx - $ax; $dy = $by - $ay
      $len2 = $dx*$dx + $dy*$dy
      $best = -1.0; $bestk = -1
      for ($k = $i + 1; $k -lt $j; $k++) {
        $px = $xs[$k] * $xscale; $py = $ys[$k]
        if ($len2 -eq 0.0) { $ex = $px - $ax; $ey = $py - $ay }
        else {
          $t = (($px-$ax)*$dx + ($py-$ay)*$dy) / $len2
          if ($t -lt 0.0) { $t = 0.0 } elseif ($t -gt 1.0) { $t = 1.0 }
          $ex = $px - ($ax + $t*$dx); $ey = $py - ($ay + $t*$dy)
        }
        $d2 = $ex*$ex + $ey*$ey
        if ($d2 -gt $best) { $best = $d2; $bestk = $k }
      }
      if ($best -gt $tol2 -and $bestk -ge 0) {
        $keep[$bestk] = $true
        $stack.Push([int[]]@($i, $bestk))
        $stack.Push([int[]]@($bestk, $j))
      }
    }
  }
  $res = New-Object 'System.Collections.Generic.List[int]'
  for ($k = 0; $k -lt $cnt; $k++) { if ($keep[$k]) { [void]$res.Add($k) } }
  return ,$res
}

# ============================================================ borders.json
$srcCountries = Get-Source 'ne10m_countries.geojson' `
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'

Write-Host "landsgrenzen verwerken..."
$g = Get-Content -Raw -Encoding utf8 $srcCountries | ConvertFrom-Json

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('{"_meta":{"source":"Natural Earth 10m admin_0 countries (public domain)",')
[void]$sb.Append('"tolerance_deg":{"covered":').Append($TOL_FINE.ToString($inv))
[void]$sb.Append(',"other":').Append($TOL_COARSE.ToString($inv)).Append('}}')

$totalPts = 0
$byIso = @{}
foreach ($f in $g.features) {
  $a3 = [string]$f.properties.ADM0_A3
  if ($map.ContainsKey($a3)) { $byIso[$map[$a3]] = $f }
}

foreach ($iso in ($byIso.Keys | Sort-Object)) {
  $f = $byIso[$iso]
  $isFine   = $covered -contains $iso
  $tol      = if ($isFine) { $TOL_FINE } else { $TOL_COARSE }
  $fmt      = if ($isFine) { '0.###' } else { '0.##' }
  $minRing  = if ($isFine) { $MIN_RING_FINE } else { $MIN_RING_COARSE }

  # Let op: `$x = if (..) { ,$a } else { $b }` rolt de enkelvoudige array weer uit,
  # waardoor een Polygon als lijst coordinaten wordt gelezen in plaats van als
  # lijst ringen. Daarom expliciet toewijzen in plaats van via een if-expressie.
  if ($f.geometry.type -eq 'Polygon') { $polys = @(,$f.geometry.coordinates) }
  else { $polys = $f.geometry.coordinates }

  # ringen buiten Europa weg, en grootte per polygoon bepalen
  $keep = New-Object 'System.Collections.Generic.List[object]'
  $sizes = New-Object 'System.Collections.Generic.List[double]'
  foreach ($poly in $polys) {
    $r0 = $poly[0]
    $minx=1e9;$maxx=-1e9;$miny=1e9;$maxy=-1e9
    foreach ($pt in $r0) {
      $x=[double]$pt[0]; $y=[double]$pt[1]
      if($x -lt $minx){$minx=$x}; if($x -gt $maxx){$maxx=$x}
      if($y -lt $miny){$miny=$y}; if($y -gt $maxy){$maxy=$y}
    }
    if ($maxx -lt $W -or $minx -gt $E -or $maxy -lt $S -or $miny -gt $N) { continue }
    [void]$keep.Add($poly)
    [void]$sizes.Add([math]::Sqrt(($maxx-$minx)*($maxx-$minx) + ($maxy-$miny)*($maxy-$miny)))
  }
  if ($keep.Count -eq 0) { continue }
  $biggest = 0
  for ($p=1; $p -lt $sizes.Count; $p++) { if ($sizes[$p] -gt $sizes[$biggest]) { $biggest = $p } }

  $cMinx=1e9;$cMaxx=-1e9;$cMiny=1e9;$cMaxy=-1e9
  $polyStrings = New-Object 'System.Collections.Generic.List[string]'
  $ptsHere = 0

  for ($p = 0; $p -lt $keep.Count; $p++) {
    if ($p -ne $biggest -and $sizes[$p] -lt $minRing) { continue }
    $ringStrings = New-Object 'System.Collections.Generic.List[string]'
    foreach ($ring in $keep[$p]) {
      $cnt = $ring.Count
      if ($cnt -lt 4) { continue }
      $xs = New-Object 'double[]' $cnt
      $ys = New-Object 'double[]' $cnt
      $latSum = 0.0
      for ($k = 0; $k -lt $cnt; $k++) {
        $xs[$k] = [double]$ring[$k][0]; $ys[$k] = [double]$ring[$k][1]; $latSum += $ys[$k]
      }
      $xscale = [math]::Cos(($latSum/$cnt) * [math]::PI / 180.0)
      if ($xscale -lt 0.2) { $xscale = 0.2 }
      $idx = Simplify $xs $ys $cnt $tol $xscale
      if ($idx.Count -lt 4) { continue }
      $parts = New-Object 'System.Collections.Generic.List[string]'
      $prev = ''
      foreach ($k in $idx) {
        $cur = $xs[$k].ToString($fmt,$inv) + ',' + $ys[$k].ToString($fmt,$inv)
        if ($cur -eq $prev) { continue }
        $prev = $cur
        [void]$parts.Add($cur)
        if ($xs[$k] -lt $cMinx){$cMinx=$xs[$k]}; if ($xs[$k] -gt $cMaxx){$cMaxx=$xs[$k]}
        if ($ys[$k] -lt $cMiny){$cMiny=$ys[$k]}; if ($ys[$k] -gt $cMaxy){$cMaxy=$ys[$k]}
      }
      if ($parts.Count -lt 4) { continue }
      $ptsHere += $parts.Count
      [void]$ringStrings.Add('[' + ($parts -join ',') + ']')
    }
    if ($ringStrings.Count -gt 0) { [void]$polyStrings.Add('[' + ($ringStrings -join ',') + ']') }
  }
  if ($polyStrings.Count -eq 0) { continue }

  $bb = @($cMinx,$cMiny,$cMaxx,$cMaxy) | ForEach-Object { $_.ToString('0.###',$inv) }
  [void]$sb.Append(',"').Append($iso).Append('":{"n":"').Append($names[$iso]).Append('"')
  [void]$sb.Append(',"b":[').Append($bb -join ',').Append(']')
  [void]$sb.Append(',"p":[').Append($polyStrings -join ',').Append(']}')
  $totalPts += $ptsHere
}
[void]$sb.Append('}')
$outB = Join-Path $root 'borders.json'
[System.IO.File]::WriteAllText($outB, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("borders.json: " + [math]::Round((Get-Item $outB).Length/1KB,1) + " KB, " + $totalPts + " punten")

# ============================================================= cities.json
$srcPlaces = Get-Source 'ne10m_places.geojson' `
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson'

Write-Host "plaatsen verwerken..."
$gp = Get-Content -Raw -Encoding utf8 $srcPlaces | ConvertFrom-Json
$rows = New-Object 'System.Collections.Generic.List[object]'
$seen = @{}
foreach ($f in $gp.features) {
  $a3 = [string]$f.properties.ADM0_A3
  if (-not $map.ContainsKey($a3)) { continue }
  $lon = [double]$f.geometry.coordinates[0]
  $lat = [double]$f.geometry.coordinates[1]
  if ($lon -lt $W -or $lon -gt $E -or $lat -lt $S -or $lat -gt $N) { continue }
  $pop = 0
  if ($null -ne $f.properties.POP_MAX) { $pop = [int]$f.properties.POP_MAX }
  if ($pop -lt $MIN_POP -and $f.properties.ADM0CAP -ne 1) { continue }

  $local = [string]$f.properties.NAMEASCII
  if ([string]::IsNullOrWhiteSpace($local)) { $local = [string]$f.properties.NAME }
  $nl = [string]$f.properties.NAME_NL
  if ([string]::IsNullOrWhiteSpace($nl)) { $nl = [string]$f.properties.NAME }
  if ([string]::IsNullOrWhiteSpace($nl)) { $nl = $local }

  $cc = $map[$a3]
  $key = ($nl + '|' + $cc).ToLowerInvariant()
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true
  $alias = if ($local -eq $nl) { '' } else { $local }
  [void]$rows.Add([pscustomobject]@{ nl=$nl; alias=$alias; cc=$cc; lat=$lat; lon=$lon; pop=$pop })
}
$sorted = $rows | Sort-Object -Property @{Expression='pop';Descending=$true}

$sc = New-Object System.Text.StringBuilder
[void]$sc.Append('{"_meta":{"source":"Natural Earth 10m populated places (public domain)",')
[void]$sc.Append('"schema":["naam","alias","landcode","lat","lon"]},')
[void]$sc.Append('"cities":[')
$i = 0
foreach ($r in $sorted) {
  if ($i -gt 0) { [void]$sc.Append(',') }
  $i++
  $n = $r.nl.Replace('\','\\').Replace('"','\"')
  $al = $r.alias.Replace('\','\\').Replace('"','\"')
  [void]$sc.Append("`n[""").Append($n).Append('","').Append($al).Append('","').Append($r.cc).Append('",')
  [void]$sc.Append($r.lat.ToString('0.###',$inv)).Append(',').Append($r.lon.ToString('0.###',$inv)).Append(']')
}
[void]$sc.Append("`n]}")
$outC = Join-Path $root 'cities.json'
[System.IO.File]::WriteAllText($outC, $sc.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("cities.json: " + [math]::Round((Get-Item $outC).Length/1KB,1) + " KB, " + $sorted.Count + " plaatsen")
Write-Host "klaar."
