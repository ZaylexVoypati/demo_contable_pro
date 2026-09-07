/**
 * RESUMEN FINAL — DOBLE DE MÉTRICAS
 * Ingresos, gastos, balance, P&L, márgenes, ROI, órdenes procesadas y
 * actividad real de GitHub proyectada por dominio contable.
 */

import { incomeStatement, trialBalance } from "../lib/ledger.js";
import { walletTotalsCup } from "../lib/wallet.js";

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildSummary({ ledger, wallet, orders, invoices, withdrawals, githubDomains, githubSnapshot }) {
  const pl = incomeStatement(ledger);
  const tot = walletTotalsCup(wallet);
  const tb = trialBalance(ledger);

  const processed = orders.filter((o) => o.status === "completed").length;
  const cancelled = orders.filter((o) => ["cancelled", "rejected"].includes(o.status)).length;
  const gmv = orders.reduce((a, o) => a + (o.status === "completed" ? o.total_price : 0), 0);
  const investment = orders.reduce((a, o) => a + (o.status === "completed" ? o.investment : 0), 0);
  const roi = investment > 0 ? (pl.net_income / investment) * 100 : 0;
  const gross_profit = pl.byRevenue.reduce((a, r) => a + (r.code === "4001" ? r.natural_balance : 0), 0) - (pl.byExpense.find((e) => e.code === "5001")?.natural_balance ?? 0);

  return {
    gmv: Math.round(gmv * 100) / 100,
    investment,
    orders_processed: processed,
    orders_cancelled: cancelled,
    orders_total: orders.length,
    net_income: pl.net_income,
    revenue: pl.revenue,
    expenses: pl.expenses,
    margin: pl.margin,
    roi: Math.round(roi * 100) / 100,
    gross_profit: Math.round(gross_profit * 100) / 100,
    wallet: tot,
    trial_balanced: tb.balanced,
    invoices_count: invoices.length,
    invoices_total: Math.round(invoices.reduce((a, i) => a + i.total, 0) * 100) / 100,
    withdrawals_count: withdrawals.length,
    withdrawals_total: Math.round(withdrawals.reduce((a, w) => a + w.amount, 0) * 100) / 100,
    github: githubDomains,
    github_repos: githubSnapshot?.repo_count ?? 0,
  };
}

export function renderSummary(s) {
  const rows = [];
  const R = (label, value) => rows.push(`   ${label.padEnd(38)} ${String(value).padStart(14)}`);

  rows.push(` ── VOLUMEN ──`);
  R("Órdenes del día", `${s.orders_total} (procesadas ${s.orders_processed}, canceladas ${s.orders_cancelled})`);
  R("Volumen vendido (GMV)", `${fmt(s.gmv)} CUP`);
  R("Inversión (costo mercancía)", `${fmt(s.investment)} CUP`);
  rows.push(` ── RESULTADO (P&L) ──`);
  R("Ingresos totales", `${fmt(s.revenue)} CUP`);
  R("Gastos totales", `${fmt(s.expenses)} CUP`);
  R("Resultado neto", `${fmt(s.net_income)} CUP`);
  R("Margen neto", `${fmt(s.margin)} %`);
  R("Ganancia bruta", `${fmt(s.gross_profit)} CUP`);
  rows.push(` ── RENTABILIDAD ──`);
  R("ROI (neto / inversión)", `${fmt(s.roi)} %`);
  R("Balance de caja (CUP eq.)", `${fmt(s.wallet.closing_cup)} CUP`);
  R("Entradas / Salidas", `${fmt(s.wallet.total_in_cup)} / ${fmt(s.wallet.total_out_cup)} CUP`);
  R("Trial balance cuadra", s.trial_balanced ? "✔ sí" : "✘ no");
  rows.push(` ── DOCUMENTOS ──`);
  R("Facturas emitidas", `${s.invoices_count} (total ${fmt(s.invoices_total)} CUP)`);
  R("Retiros del socio", `${s.withdrawals_count} (total ${fmt(s.withdrawals_total)} CUP)`);
  rows.push(` ── GITHUB REAL (${s.github_repos} repos de voypati-tech) ──`);
  for (const d of s.github) {
    R(d.domain, `${d.repos} repos · ${d.prs} PRs · ${d.merged} mergeados · ${d.commits} commits`);
  }
  rows.push(` `);
  rows.push(`   ${"─".repeat(70)}`);
  rows.push(`   ROI = (${fmt(s.net_income)} / ${fmt(s.investment)}) × 100 = ${fmt(s.roi)} %`);

  const width = Math.min(Math.max("RESUMEN FINAL — CONTABILIDAD EN PARTIDA DOBLE".length, ...rows.map((r) => r.length)) + 4, 118);
  const bar = "─".repeat(width);
  const title = " RESUMEN FINAL — CONTABILIDAD EN PARTIDA DOBLE ";
  const pad = Math.floor((width - title.length) / 2);
  const out = [`┌${bar}┐`, `│${" ".repeat(pad)}${title}${" ".repeat(width - pad - title.length)}│`, `├${bar}┤`];
  for (const r of rows) out.push(`│ ${r.padEnd(width - 2)} │`);
  out.push(`└${bar}┘`);
  return out.join("\n");
}