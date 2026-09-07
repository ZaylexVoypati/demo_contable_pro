/**
 * DÍA CONTABLE COMPLETO — PARTIDA DOBLE + BILLETERA DETALLADA
 * ===========================================================
 * 1) Carga el esquema profundo del core
 * 2) Lee TODOS los repos reales de voypati-tech (GitHub org-wide)
 * 3) Apertura (capital + inventario)
 * 4) Ciclo de vida de 30 órdenes con asientos de partida doble
 * 5) Operaciones: facturas, retiros, nómina, impuestos, cupones, promotores
 * 6) Paneles: catálogo, libro diario, trial balance, P&L, balance general,
 *    billetera detallada con conciliación y resumen final
 */

import { createLedger, postEntry, cashMovements } from "./lib/ledger.js";
import { buildWalletMovements } from "./lib/wallet.js";
import { loadCoreSchema, coreConstant } from "./lib/coreData.js";
import { fetchOrgSnapshot, projectDomains } from "./lib/github.js";
import { createDetailedOrder, transition, markPaid } from "./lib/orders.js";
import { openDay, processOrder } from "./flow/lifecycle.js";
import { issueInvoice, processWithdrawal, registerCoupon, registerPromoter, registerPayroll, registerOperating, registerTax } from "./flow/operations.js";
import { renderChartOfAccounts, renderTrialBalance, renderIncomeStatement, renderBalanceSheet, renderJournal } from "./modules/ledgerPanel.js";
import { renderWalletDetail } from "./modules/walletDetail.js";
import { buildSummary, renderSummary } from "./modules/summary.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "output");

// PRNG determinista
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  { name: "Arroz 5kg", price: 220, cost: 155 },
  { name: "Aceite 1L", price: 90, cost: 64 },
  { name: "Detergente", price: 65, cost: 46 },
  { name: "Café 250g", price: 120, cost: 85 },
  { name: "Pan de molde", price: 45, cost: 30 },
  { name: "Jabón de baño", price: 38, cost: 26 },
  { name: "Azúcar 1kg", price: 55, cost: 38 },
  { name: "Leche en polvo", price: 180, cost: 128 },
];

const COUPONS = [
  { code: "VOY10", discount_percentage: 10 },
  { code: "BIENVENIDO", discount_percentage: 5 },
];

function buildDay(rnd, n) {
  const orders = [];
  const now = new Date("2026-09-04T09:00:00");
  for (let i = 1; i <= n; i++) {
    now.setMinutes(now.getMinutes() + 9 + Math.floor(rnd() * 20));
    const qty = 1 + Math.floor(rnd() * 3);
    const p = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)];
    const shipping = 25 + Math.floor(rnd() * 5) * 5;
    const coupon = rnd() < 0.2 ? COUPONS[Math.floor(rnd() * COUPONS.length)] : null;
    const cancelled = rnd() < 0.08;
    const order = createDetailedOrder({
      number: `ORD-${String(i).padStart(4, "0")}`,
      items: [{ name: p.name, price: p.price, cost: p.cost, quantity: qty }],
      shipping_price: shipping,
      coupon,
      payment_method: ["payment_on_delivery", "wallet", "troypay", "qvapay"][Math.floor(rnd() * 4)],
      status: "pending",
    });
    order.created_at = now.toISOString();
    order.events[0].at = now.toISOString();
    orders.push({ order, cancelled, date: now.toISOString() });
  }
  return orders;
}

export async function runFullAccountingDay({ seed = 20260904, nOrders = 30, github = true, usd_to_cup = 250 } = {}) {
  const rnd = mulberry32(seed);
  console.log("\n╔════════════════════════════════════════════════════════════════════╗");
  console.log("║  DÍA CONTABLE EN PARTIDA DOBLE — Ecosistema VoyPati                ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");

  // 1) Core
  const schema = loadCoreSchema();
  if (schema.warning) console.warn(`\n⚠ ${schema.warning}`);
  const commissionPct = coreConstant(schema, "default_commission_percent");
  const profitPct = coreConstant(schema, "driver_profit_percent");
  console.log(`\n[1/7] Esquema profundo del core:`);
  console.log(`   · Comisión VoyPati ${commissionPct}%  (${schema.constants?.default_commission_percent?.source ?? "—"})`);
  console.log(`   · Profit conductor ${profitPct * 100}%  (${schema.constants?.driver_profit_percent?.source ?? "—"})`);
  console.log(`   · Modelos extraídos: ${Object.keys(schema.models ?? {}).join(", ") || "—"}`);

  // 2) GitHub org-wide
  let githubSnapshot = null;
  let githubDomains = [];
  if (github) {
    try {
      console.log(`\n[2/7] Conectando a GitHub (MCP) — TODOS los repos de voypati-tech...`);
      githubSnapshot = await fetchOrgSnapshot({ save: true });
      githubDomains = projectDomains(githubSnapshot);
      console.log(`   · ${githubSnapshot.repo_count} repositorios reales leídos`);
      console.log(`   · Dominios: ${githubDomains.map((d) => `${d.domain}(${d.merged} PRs)`).join(", ")}`);
    } catch (err) {
      console.warn(`   · GitHub no disponible (${err.message}). Continúo con datos locales.`);
    }
  }

  // 3) Apertura
  console.log(`\n[3/7] Apertura del día (capital + inventario)...`);
  const ledger = createLedger();
  openDay(ledger, { date: "2026-09-04T08:30:00", capital_cup: 15000, inventory_cup: 6000, capital_usd: 200 });

  // 4) Órdenes
  console.log(`\n[4/7] Ciclo de vida de ${nOrders} órdenes (partida doble)...`);
  const items = buildDay(rnd, nOrders);
  const orders = [];
  const invoices = [];
  const withdrawals = [];
  let couponTotal = 0;

  for (const { order, cancelled, date } of items) {
    orders.push(order);
    // avanza el ciclo: pending → accepted → processing → ready → delivering → completed
    if (cancelled) {
      transition(order, "cancelled", "Cancelada por el cliente");
      order.is_paid = false;
      processOrder(ledger, order, { date });
      console.log(`   ✘ ${order.number} CANCELADA — sin venta ni comisión`);
      continue;
    }
    markPaid(order);
    for (const st of ["accepted", "processing", "ready", "delivering"]) transition(order, st);
    transition(order, "completed", "Entregada");
    processOrder(ledger, order, { date, collection_pct: 0.6 });
    if (order.discount > 0) couponTotal += order.discount;
    console.log(`   ✓ ${order.number} liquidada — total ${order.total_price} CUP, comisión ${order.client_commission}, mensajero ${order.messenger_profit}, cupón ${order.coupon?.code ?? "—"}`);
  }

  // 5) Operaciones
  console.log(`\n[5/7] Operaciones corporativas...`);
  const day = "2026-09-04";
  // Cupones: 1 gasto agregado de marketing (suma de descuentos reales aplicados)
  const couponSubsidy = Math.round(couponTotal * 100) / 100;
  if (couponSubsidy > 0) registerCoupon(ledger, { date: `${day}T14:00:00`, amount: couponSubsidy });
  registerPromoter(ledger, { date: `${day}T14:05:00`, amount: 34.2, note: "5% sobre comisiones de referidos" });
  registerPayroll(ledger, { date: `${day}T18:00:00`, amount: 900, paid_pct: 1 });
  registerOperating(ledger, { date: `${day}T09:00:00`, amount: 250, concept: "Alquiler local" });
  registerOperating(ledger, { date: `${day}T09:30:00`, amount: 120, concept: "Servicios (luz/internet)" });
  registerTax(ledger, { date: `${day}T16:00:00`, amount: 85, paid_pct: 0.5 });

  // Facturas de comisiones a negocios (modelo Invoice real FAC-2026-XXXXX)
  const commissionTotal = orders.filter((o) => o.status === "completed").reduce((a, o) => a + o.client_commission, 0);
  invoices.push(issueInvoice(ledger, { date: `${day}T17:00:00`, business: "Tienda Mercado Central", commission_subtotal: Math.round(commissionTotal * 0.5 * 100) / 100, tax_percentage: 5 }));
  invoices.push(issueInvoice(ledger, { date: `${day}T17:05:00`, business: "Minimercado La Esquina", commission_subtotal: Math.round(commissionTotal * 0.3 * 100) / 100, tax_percentage: 5 }));

  // Retiro del socio (modelo Withdrawal real)
  withdrawals.push(processWithdrawal(ledger, { date: `${day}T19:00:00`, amount: 400, currency: "CUP", payment_method: "transfer" }));

  // Transacciones en USD para mostrar la billetera multicurrency
  postEntry(ledger, {
    date: `${day}T15:00:00`, ref: "USD-COMM", description: "Cobro de comisión en USD (cliente express)",
    lines: [
      { account: "1002", debit: 12 },
      { account: "4003", credit: 12 },
    ],
  });
  postEntry(ledger, {
    date: `${day}T15:30:00`, ref: "USD-OPEX", description: "Gasto en USD (pago de dominio/servidor)",
    lines: [
      { account: "5006", debit: 8 },
      { account: "1002", credit: 8 },
    ],
  });

  // 6) Paneles
  console.log(`\n[6/7] Paneles contables...`);
  console.log(renderChartOfAccounts());
  console.log("\n" + renderTrialBalance(ledger));
  console.log("\n" + renderIncomeStatement(ledger));
  console.log("\n" + renderBalanceSheet(ledger));
  console.log("\n" + renderJournal(ledger, 18));

  const cash = cashMovements(ledger);
  console.log("\n" + renderWalletDetail(cash, { cup: 15000, usd: 200 }, usd_to_cup));

  // 7) Resumen
  console.log(`\n[7/7] Resumen final con métricas:`);
  const wallet = buildWalletMovements(cash, { cup: 15000, usd: 200 }, usd_to_cup);
  const summary = buildSummary({ ledger, wallet, orders, invoices, withdrawals, githubDomains, githubSnapshot });
  console.log(renderSummary(summary));

  // Persistir
  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    seed,
    nOrders,
    usd_to_cup,
    core_schema: schema,
    github: githubSnapshot,
    entries: ledger.entries,
    orders,
    invoices,
    withdrawals,
    summary,
  };
  writeFileSync(join(OUT_DIR, "dia-contable-partida-doble.json"), JSON.stringify(report, null, 2));
  console.log(`\nReporte completo: output/dia-contable-partida-doble.json`);
  return report;
}

// Ejecución directa
import { pathToFileURL } from "node:url";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runFullAccountingDay().catch((err) => { console.error(err); process.exit(1); });
}