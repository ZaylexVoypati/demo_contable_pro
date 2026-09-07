# Demo contable Pro VoyPati - lanzador para VS Code
Write-Host ""
Write-Host "Demo Contable Pro (Partida Doble + Billetera detallada)" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1) Dia contable completo en partida doble"
Write-Host "  2) Regenerar esquema profundo del core (extract)"
Write-Host "  3) Regenerar snapshot de GitHub (todos los repos)"
Write-Host "  0) Salir"
Write-Host ""
$op = Read-Host "Elige una opcion"

switch ($op) {
  "1" { node src/simulate.js }
  "2" { node scripts/extract-core-pro.js }
  "3" { node scripts/github-org-snapshot.js }
  default { Write-Host "Hasta luego!" }
}
Write-Host ""
Read-Host "Presiona Enter para cerrar..."