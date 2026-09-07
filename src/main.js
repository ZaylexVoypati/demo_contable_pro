#!/usr/bin/env node
/**
 * DEMO CONTABLE PRO — CLI
 *   node src/main.js            → día completo en partida doble
 *   node src/main.js extract    → regenera data/core-schema-pro.json (core profundo)
 *   node src/main.js github     → regenera data/github-org-snapshot.json (todos los repos)
 *   node src/main.js wallet     → solo billetera detallada
 *   node src/main.js accounts   → catálogo de cuentas
 */

import { runFullAccountingDay } from "./simulate.js";

const cmd = process.argv[2] ?? "demo";

console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  DEMO CONTABLE PRO — PARTIDA DOBLE · BILLETERA DETALLADA  ║
  ║  Todos los repos GitHub + esquema profundo del core       ║
  ╚═══════════════════════════════════════════════════════════╝`);

switch (cmd) {
  case "extract":
    await import("../scripts/extract-core-pro.js");
    break;
  case "github":
    await import("../scripts/github-org-snapshot.js");
    break;
  case "demo":
  case "day":
    await runFullAccountingDay();
    break;
  default:
    console.log(`Comando desconocido: "${cmd}"`);
    console.log("Usa: demo | day | extract | github");
}