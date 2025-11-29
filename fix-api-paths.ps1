# PowerShell Script zum Entfernen von /api/ Prefix aus allen Frontend-Dateien
# Da axios.defaults.baseURL bereits auf https://dojo.tda-intl.org/api gesetzt ist,
# darf KEIN /api/ Prefix in den fetch/axios Calls sein!

Write-Host "Starte /api/ Prefix Entfernung..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "frontend\src" -Recurse -Include *.js,*.jsx

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content

    # Ersetze alle '/api/XXX' mit '/XXX'
    # WICHTIG: Wir ersetzen NUR wenn es in Quotes steht (fetch/axios calls)
    $content = $content -replace "(['`"])\/api\/", '$1/'

    if ($content -ne $originalContent) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "✅ Gefixt: $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host "`n✅ $count Dateien wurden aktualisiert!" -ForegroundColor Green
Write-Host "Bitte prüfe die Änderungen mit 'git diff' bevor du commitest!" -ForegroundColor Yellow
