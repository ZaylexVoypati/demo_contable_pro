/**
 * PANEL CONTABLE — LIBRO DIARIO, BALANCE DE COMPROBACIÓN, P&L Y BALANCE GENERAL
 */

import { ACCOUNTS, trialBalance, incomeStatement, balanceSheet } from "../lib/ledger.js";

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

export function renderChartOfAccounts() {
  const groups = { asset: "ACTIVOS", liability: "PASIVOS", equity: "PATRIMONIO", revenue: "INGRESOS", expense: "GASTOS" };
  const lines = [];
  for (const type of Object.keys(groups)) {
    lines.push(` ${groups[type]}`);
    for (const [code, meta] of Object.entries(ACCOUNTS)) {
      if (meta.type !== type) continue;
      lines.push(`   ${code}  ${meta.name}`);
    }
  }
  return box("CATÁLOGO DE CUENTAS (CHART OF ACCOUNTS)", lines);
}

export function renderTrialBalance(ledger) {
  const tb = trialBalance(ledger);
  const rows = [` Código  Cuenta                               Debe           Haber      Saldo    Naturaleza`];
  for (const b of Object.values(tb.balances)) {
    const nat = b.type === "asset" || b.type === "expense" ? "deudora " : "acreedora";
    rows.push(
      ` ${b.code}   ${b.name.padEnd(35)} ${fmt(b.debit).padStart(13)} ${fmt(b.credit).padStart(13)} ${fmt(b.natural_balance).padStart(9)}  ${nat}`
    );
  }
  rows.push(` `);
  rows.push(` TOTALES ${"".padEnd(35)} ${fmt(tb.totalDebit).padStart(13)} ${fmt(tb.totalCredit).padStart(13)}   ${tb.balanced ? "✔ CUADRA" : "✘ NO CUADRA"}`);
  return box("BALANCE DE COMPROBACIÓN (TRIAL BALANCE)", rows);
}

export function renderIncomeStatement(ledger) {
  const pl = incomeStatement(ledger);
  const rows = [];
  for (const r of pl.byRevenue) rows.push(`   Ingreso  ${r.name.padEnd(38)} ${fmt(r.natural_balance).padStart(12)} CUP`);
  rows.push(`   ${"".padEnd(50)} ${"────".padStart(9)}`);
  rows.push(`   INGRESOS TOTALES`.padEnd(50) + ` ${fmt(pl.revenue).padStart(9)} CUP`);
  for (const e of pl.byExpense) rows.push(`   Gasto    ${e.name.padEnd(38)} ${fmt(e.natural_balance).padStart(12)} CUP`);
  rows.push(`   GASTOS TOTALES`.padEnd(50) + ` ${fmt(pl.expenses).padStart(9)} CUP`);
  rows.push(` `);
  rows.push(`   RESULTADO NETO`.padEnd(50) + ` ${fmt(pl.net_income).padStart(9)} CUP`);
  rows.push(`   MARGEN NETO`.padEnd(50) + ` ${fmt(pl.margin).padStart(9)} %`);
  return box("ESTADO DE RESULTADOS (P&L)", rows);
}

export function renderBalanceSheet(ledger) {
  const bs = balanceSheet(ledger);
  const rows = [
    `   Activos totales`.padEnd(44) + ` ${fmt(bs.assets).padStart(12)} CUP`,
    `   Pasivos totales`.padEnd(44) + ` ${fmt(bs.liabilities).padStart(12)} CUP`,
    `   Patrimonio total`.padEnd(44) + ` ${fmt(bs.equity).padStart(12)} CUP`,
    ` `,
    `   Activos = Pasivos + Patrimonio  ${bs.balanced ? "✔ ECUACIÓN CUADRA" : "✘ NO CUADRA"}`,
  ];
  return box("BALANCE GENERAL", rows);
}

export function renderJournal(ledger, limit = 30) {
  const rows = [];
  const entries = ledger.entries.slice(-limit);
  for (const e of entries) {
    rows.push(` ${e.date}  ${e.ref.padEnd(16)} ${e.description}`);
    for (const l of e.lines) {
      const d = l.debit > 0 ? ` ${fmt(l.debit)}` : "       ";
      const c = l.credit > 0 ? ` ${fmt(l.credit)}` : "       ";
      rows.push(`   ${l.account} ${ACCOUNTS[l.account]?.name ?? l.account}`.padEnd(52) + `${d.padStart(12)}${c.padStart(13)}`);
    }
    rows.push(`   ${"─".repeat(72)}`);
  }
  return box(`LIBRO DIARIO (últimos ${limit} asientos de ${ledger.entries.length})`, rows);
}