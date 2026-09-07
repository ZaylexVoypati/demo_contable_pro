/**
 * PANEL DE BILLETERA DETALLADA — CompanyWallet
 * Movimientos con saldo corriente, saldos por moneda y conciliación bancaria.
 */

import { buildWalletMovements, reconcile, walletTotalsCup } from "../lib/wallet.js";

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function box(title, rows) {
  const width = Math.min(Math.max(title.length, ...rows.map((r) => r.length)) + 4, 118);
  const bar = "─".repeat(width);
  const pad = Math.floor((width - title.length) / 2);
  const out = [`┌${bar}┐`, `│${" ".repeat(pad)}${title}${" ".repeat(width - pad - title.length)}│`, `├${bar}┤`];
  for (const r of rows) out.push(`│ ${r.padEnd(width - 2)} │`);
  out.push(`└${bar}┘`);
  return out.join("\n");
}

export function renderWalletDetail(cashMovs, opening = { cup: 0, usd: 0 }, usd_to_cup = 250) {
  const w = buildWalletMovements(cashMovs, opening, usd_to_cup);
  const rec = reconcile(w);
  const tot = walletTotalsCup(w);

  const rows = [];
  rows.push(` Tipo de cambio usado: 1 USD = ${usd_to_cup} CUP`);
  rows.push(` `);
  rows.push(` ── SALDOS ──`);
  rows.push(`   Apertura        ${fmt(w.opening.cup).padStart(12)} CUP   ${fmt(w.opening.usd).padStart(8)} USD`);
  rows.push(`   Entradas        ${fmt(w.total_in.cup).padStart(12)} CUP   ${fmt(w.total_in.usd).padStart(8)} USD`);
  rows.push(`   Salidas         ${fmt(w.total_out.cup).padStart(12)} CUP   ${fmt(w.total_out.usd).padStart(8)} USD`);
  rows.push(`   CIERRE          ${fmt(w.closing.cup).padStart(12)} CUP   ${fmt(w.closing.usd).padStart(8)} USD`);
  rows.push(`   Cierre (CUP)    ${fmt(tot.closing_cup).padStart(12)} CUP   (CUP + USD convertido)`);
  rows.push(` `);
  rows.push(` ── CONCILIACIÓN (ReconciliationReport) ──`);
  for (const c of [rec.cup, rec.usd]) {
    rows.push(`   ${c.currency.padEnd(3)} esperado=${fmt(c.expected).padStart(10)} real=${fmt(c.actual).padStart(10)} dif=${fmt(c.difference).padStart(8)} ${c.reconciled ? "✔" : "✘"}`);
  }
  rows.push(` `);
  rows.push(` ── MOVIMIENTOS CUP (${w.movements.cup.length}) con saldo corriente ──`);
  rows.push(`   Fecha       Ref              Tipo   Monto       Saldo después`);
  for (const m of w.movements.cup) {
    rows.push(
      `   ${m.date} ${m.ref.padEnd(14)} ${m.kind === "in" ? "ENTRADA" : "SALIDA "} ${fmt(m.amount).padStart(9)} ${fmt(m.balance_after).padStart(13)} CUP`
    );
  }
  rows.push(` `);
  rows.push(` ── MOVIMIENTOS USD (${w.movements.usd.length}) ──`);
  for (const m of w.movements.usd) {
    rows.push(
      `   ${m.date} ${m.ref.padEnd(14)} ${m.kind === "in" ? "ENTRADA" : "SALIDA "} ${fmt(m.amount).padStart(9)} ${fmt(m.balance_after).padStart(13)} USD`
    );
  }
  return box("BILLETERA DETALLADA — CompanyWallet", rows);
}