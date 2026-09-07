/**
 * MOTOR DE PARTIDA DOBLE (DOBLE ENTRADA)
 * ======================================
 * Cada operación contable genera un ASIENTO con líneas de Debe y Haber.
 * La suma de débitos siempre es igual a la suma de créditos (ecuación contable:
 * Activos = Pasivos + Patrimonio).
 *
 * El catálogo replica las cuentas reales del ecosistema VoyPati (billeteras,
 * comisiones, fondos de negocio) y se expone en data/core-schema-pro.json.
 */

import { randomUUID } from "node:crypto";

export const ACCOUNTS = {
  // ——— Activos ———
  "1001": { name: "Caja / Banco (CUP)", type: "asset", detail: "CompanyWallet balance_cup (vpt_express accounting/models.py)" },
  "1002": { name: "Caja / Banco (USD)", type: "asset", detail: "CompanyWallet balance_usd" },
  "1100": { name: "Cuentas por Cobrar (clientes)", type: "asset", detail: "Orders is_paid=false / pendientes de cobro" },
  "1200": { name: "Comisiones por Cobrar (negocios)", type: "asset", detail: "PlatformCommissionConfig → comisión 10% a cobrar a negocios" },
  "1300": { name: "Inventario de Productos", type: "asset", detail: "OrderItem.cost (inversión en stock)" },
  // ——— Pasivos ———
  "2001": { name: "Impuestos por Pagar (IVA/ITBMS)", type: "liability", detail: "tax_percentage de Invoice (finance/models.py)" },
  "2100": { name: "Salarios por Pagar", type: "liability", detail: "PayrollMessenger closed/paid (vpt_mercado)" },
  "2200": { name: "Deuda con Mensajeros", type: "liability", detail: "FoundType.messenger_debt / MessengerType.pending_payment" },
  // ——— Patrimonio ———
  "3001": { name: "Capital del Socio", type: "equity", detail: "Aporte inicial de fondos" },
  "3002": { name: "Utilidades Retenidas", type: "equity", detail: "Resultado acumulado del ejercicio" },
  // ——— Ingresos ———
  "4001": { name: "Ingresos por Ventas", type: "revenue", detail: "order.total_price − shipping (getMetricsAll income_executed)" },
  "4002": { name: "Ingresos por Mensajería", type: "revenue", detail: "order.shipping_price cobrado al cliente" },
  "4003": { name: "Ingresos por Comisiones", type: "revenue", detail: "client_commission 10% VoyPati (finance/models.py:197)" },
  "4004": { name: "Otros Ingresos", type: "revenue", detail: "ajustes y abonos" },
  // ——— Gastos ———
  "5001": { name: "Costo de Mercancía (COGS)", type: "expense", detail: "Σ items[].cost (inversión)" },
  "5002": { name: "Gasto de Mensajería (Entregas)", type: "expense", detail: "order.messenger_profit (pago por entrega)" },
  "5003": { name: "Gasto de Marketing (Cupones)", type: "expense", detail: "coupon_subsidy (CompanyTransaction)" },
  "5004": { name: "Comisiones de Promotores", type: "expense", detail: "promoter_commission (CompanyTransaction)" },
  "5005": { name: "Gastos de Nómina", type: "expense", detail: "payroll_messenger (CompanyTransaction)" },
  "5006": { name: "Gastos Operativos", type: "expense", detail: "arriendo, servicios, leyendas de gasto (ExpenseLegend)" },
  "5007": { name: "Gastos por Impuestos", type: "expense", detail: "impuesto sobre ventas (Invoice.tax)" },
  "5008": { name: "Otros Gastos / Ajustes", type: "expense", detail: "manual_adjustment, refund, other" },
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function createLedger() {
  return { entries: [], accounts: {} };
}

export function postEntry(ledger, { date, ref, description, lines }) {
  const clean = lines
    .filter((l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0)
    .map((l) => ({
      account: l.account,
      debit: round2(l.debit ?? 0),
      credit: round2(l.credit ?? 0),
    }));

  const totalDebit = round2(clean.reduce((a, l) => a + l.debit, 0));
  const totalCredit = round2(clean.reduce((a, l) => a + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Asiento desbalanceado en "${description}": Debe ${totalDebit} ≠ Haber ${totalCredit}`
    );
  }

  const entry = {
    id: randomUUID(),
    date,
    ref,
    description,
    total: totalDebit,
    lines: clean,
  };
  ledger.entries.push(entry);

  for (const l of clean) {
    const acc = ledger.accounts[l.account] || (ledger.accounts[l.account] = { debit: 0, credit: 0, count: 0 });
    acc.debit = round2(acc.debit + l.debit);
    acc.credit = round2(acc.credit + l.credit);
    acc.count += 1;
  }
  return entry;
}

/** Movimientos de Caja derivados del libro diario (para la billetera). */
export function cashMovements(ledger, cashAccounts = ["1001", "1002"]) {
  return ledger.entries
    .flatMap((e) =>
      e.lines
        .filter((l) => cashAccounts.includes(l.account))
        .map((l) => ({
          date: e.date,
          ref: e.ref,
          description: e.description,
          currency: l.account === "1002" ? "USD" : "CUP",
          kind: l.debit > 0 ? "in" : "out",
          amount: l.debit > 0 ? l.debit : l.credit,
          account: l.account,
        }))
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Saldos por cuenta: débito total, crédito total y saldo. */
export function accountBalances(ledger) {
  const out = {};
  for (const [code, acc] of Object.entries(ledger.accounts)) {
    const meta = ACCOUNTS[code] || { name: code, type: "asset" };
    // normal: activos y gastos son débito; pasivos, patrimonio e ingresos son crédito
    const natural =
      meta.type === "asset" || meta.type === "expense"
        ? "debit"
        : "credit";
    const balance = round2(acc.debit - acc.credit);
    out[code] = {
      code,
      name: meta.name,
      type: meta.type,
      debit: round2(acc.debit),
      credit: round2(acc.credit),
      balance,
      natural_balance: round2(natural === "debit" ? acc.debit - acc.credit : acc.credit - acc.debit),
      count: acc.count,
    };
  }
  return out;
}

/** Balance de comprobación: totales deben cuadrar. */
export function trialBalance(ledger) {
  const balances = accountBalances(ledger);
  const totalDebit = round2(Object.values(balances).reduce((a, b) => a + b.debit, 0));
  const totalCredit = round2(Object.values(balances).reduce((a, b) => a + b.credit, 0));
  return { balances, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

/** Estado de Resultados (P&L): ingresos − gastos. */
export function incomeStatement(ledger) {
  const balances = accountBalances(ledger);
  const byRevenue = Object.values(balances).filter((b) => ACCOUNTS[b.code]?.type === "revenue");
  const byExpense = Object.values(balances).filter((b) => ACCOUNTS[b.code]?.type === "expense");
  const revenue = round2(byRevenue.reduce((a, b) => a + b.natural_balance, 0));
  const expenses = round2(byExpense.reduce((a, b) => a + b.natural_balance, 0));
  return {
    revenue,
    expenses,
    net_income: round2(revenue - expenses),
    byRevenue,
    byExpense,
    margin: revenue > 0 ? round2(((revenue - expenses) / revenue) * 100) : 0,
  };
}

/** Balance General: activos = pasivos + patrimonio (incluye resultado del ejercicio). */
export function balanceSheet(ledger) {
  const balances = accountBalances(ledger);
  const sum = (types) => round2(Object.values(balances).filter((b) => types.includes(b.type)).reduce((a, b) => a + b.natural_balance, 0));
  const netIncome = incomeStatement(ledger).net_income;
  const assets = sum(["asset"]);
  const liabilities = sum(["liability"]);
  const equity = round2(sum(["equity"]) + netIncome);
  return {
    assets,
    liabilities,
    equity,
    net_income: netIncome,
    balanced: Math.abs(assets - (liabilities + equity)) < 0.01,
  };
}