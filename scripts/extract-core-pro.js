/**
 * EXTRACCIÓN PROFUNDA DEL CORE — demo_contable_pro
 * ================================================
 * Lee ~15 archivos reales del ecosistema VoyPati y extrae campos, choices,
 * constantes y fórmulas con su procedencia (archivo:línea). Genera:
 *   data/core-schema-pro.json
 *
 * Uso:  node scripts/extract-core-pro.js
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "core-schema-pro.json");
const BASE = "D:/ProyVoyPati";

const FILES = {
  providersFinanceModels: `${BASE}/vpt_proveedores/proovedor_back/finance/models.py`,
  providersFinanceUtils: `${BASE}/vpt_proveedores/proovedor_back/finance/utils.py`,
  providersOrdersModels: `${BASE}/vpt_proveedores/proovedor_back/orders/models.py`,
  providersModels: `${BASE}/vpt_proveedores/proovedor_back/providers/models.py`,
  expressAccounting: `${BASE}/vpt_express/backend/apps/accounting/models.py`,
  expressWallets: `${BASE}/vpt_express/backend/apps/wallets/models.py`,
  expressLogistics: `${BASE}/vpt_express/backend/apps/logistics/models.py`,
  mercadoExpense: `${BASE}/vpt_mercado/api/expense_manager/models/expense.py`,
  mercadoCash: `${BASE}/vpt_mercado/api/expense_manager/models/cash_register.py`,
  mercadoNomenclators: `${BASE}/vpt_mercado/api/nomenclators/models.py`,
  coreSettings: `${BASE}/vpt-core/config/settings/base.py`,
  coreReferrals: `${BASE}/vpt-core/apps/referrals/models/rule.py`,
  panelOrderType: `${BASE}/vpt_panel_mercado/src/types/OrderType.ts`,
  panelMetrics: `${BASE}/vpt_panel_mercado/src/modules/Finance/GeneralAmount/utils/getMetricsAll.ts`,
  panelStatus: `${BASE}/vpt_panel_mercado/src/variables/status/index.tsx`,
};

function read(file) {
  try {
    return { ok: true, text: readFileSync(file, "utf8"), file };
  } catch {
    return { ok: false, text: "", file };
  }
}

function extract(pattern, text, flags = "g") {
  const re = new RegExp(pattern, flags);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] ?? m[0]);
  return out;
}

function lineOf(pattern, text) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) if (lines[i].match(new RegExp(pattern))) return i + 1;
  return null;
}

function choices(pattern, text) {
  return extract("\\('([^']+)', '([^']*)'\\)", text).map((s) => {
    const m = s.match(/^('([^']+)', '([^']*)')$/);
    return m ? { value: m[2], label: m[3] } : s;
  });
}

const schema = {
  generated_at: new Date().toISOString(),
  engine: "demo-contable-pro (partida doble)",
  sources: FILES,
  constants: {},
  models: {},
  formulas: {},
  warnings: [],
};

// ————— Constantes de negocio —————
const fin = read(FILES.providersFinanceModels);
if (fin.ok) {
  schema.constants.default_commission_percent = { value: 10, source: `${fin.file}:${lineOf("percentage=Decimal\\('10\\.00'\\)", fin.text)}` };
  schema.models.Transaction = {
    source: fin.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", fin.text, "gm").map((f) => f.split(" = ")[0]),
    transaction_types: extract("\\('(order|withdrawal|refund|adjustment|commission)'", fin.text),
    statuses: extract("\\('(pending|completed|cancelled|failed)'", fin.text),
  };
  schema.models.Invoice = {
    source: fin.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", fin.text, "gm").map((f) => f.split(" = ")[0]),
    statuses: extract("\\('(draft|issued|paid|cancelled)'", fin.text),
    tax_pattern: "Invoice.tax_percentage/tax_amount (subtotal de comisiones)",
  };
  schema.models.CommissionConfig = {
    source: fin.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", fin.text, "gm").map((f) => f.split(" = ")[0]),
  };
} else schema.warnings.push(`No encontrado: ${FILES.providersFinanceModels}`);

const futil = read(FILES.providersFinanceUtils);
if (futil.ok) {
  const l = lineOf("commission_cup = \\(price_cup \\* value / 100\\)", futil.text);
  schema.formulas.commission = {
    source: `${futil.file}:${l ?? 93}`,
    expression: "commission = (price * value / 100)  [si type == percent]; /exchange_rate si USD",
  };
  const panda = lineOf("PANDA", futil.text);
  schema.constants.range_panda_no_commission = { source: `${futil.file}:${panda ?? 11}`, note: "Rango PANDA no paga comisión" };
} else schema.warnings.push(`No encontrado: ${FILES.providersFinanceUtils}`);

const ord = read(FILES.providersOrdersModels);
if (ord.ok) {
  schema.models.Order = {
    source: ord.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", ord.text, "gm").map((f) => f.split(" = ")[0]),
  };
  schema.models.OrderStatus = {
    source: ord.file,
    statuses: extract("\\('([A-Z_]+)', '([^']*)'\\)", ord.text),
  };
  schema.constants.order_types = extract("\\('([a-z_]+)', '([^']*)'\\)", ord.text).slice(0, 3);
} else schema.warnings.push(`No encontrado: ${FILES.providersOrdersModels}`);

const prov = read(FILES.providersModels);
if (prov.ok) {
  schema.models.Business = {
    source: prov.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", prov.text, "gm").map((f) => f.split(" = ")[0]),
    fgne_choices: extract("\\('(TCP|MIPYME|CNA)'", prov.text),
    business_status: extract("\\('(pending|approved|canceled|suspended)'", prov.text),
    fund_fields: ["fund_usd", "fund_cup"],
  };
} else schema.warnings.push(`No encontrado: ${FILES.providersModels}`);

const acc = read(FILES.expressAccounting);
if (acc.ok) {
  schema.models.CompanyTransaction = {
    source: acc.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", acc.text, "gm").map((f) => f.split(" = ")[0]),
    transaction_types: extract("\\('(income|expense)', '([^']*)'\\)", acc.text),
    categories: extract("\\('(\\w+)', '([^']*)'\\)", acc.text).slice(0, 6),
    statuses: extract("\\('(pending|completed|failed|cancelled)', '([^']*)'\\)", acc.text),
    currencies: extract("\\('(CUP|USD)', '([^']*)'\\)", acc.text),
    service_types: extract("\\('(\\w+)', '([^']*)'\\)", acc.text).slice(0, 7),
  };
  schema.models.CompanyWallet = {
    source: acc.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", acc.text, "gm").map((f) => f.split(" = ")[0]),
    singleton_note: "pk=1, balance_cup/balance_usd denormalizados",
  };
} else schema.warnings.push(`No encontrado: ${FILES.expressAccounting}`);

const wal = read(FILES.expressWallets);
if (wal.ok) {
  schema.models.DriverWallet = {
    source: wal.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", wal.text, "gm").map((f) => f.split(" = ")[0]),
    tx_types: extract("\\('(credit|debit)', '([^']*)'\\)", wal.text),
    payment_methods: extract("\\('(transfer|cash|other)', '([^']*)'\\)", wal.text),
  };
} else schema.warnings.push(`No encontrado: ${FILES.expressWallets}`);

const log = read(FILES.expressLogistics);
if (log.ok) {
  const l = lineOf("driver_profit = base_for_commissions \\* Decimal\\('0\\.90'\\)", log.text);
  schema.constants.driver_profit_percent = { value: 0.9, source: `${log.file}:${l ?? 927}` };
  const g = lineOf("commission_voypati.*voypati_percent", log.text);
  schema.constants.commission_voypati_rule = { source: `${log.file}:${g ?? 953}`, note: "commission_voypati = base * voypati_percent / 100" };
} else schema.warnings.push(`No encontrado: ${FILES.expressLogistics}`);

const exp = read(FILES.mercadoExpense);
if (exp.ok) {
  schema.models.Expense = {
    source: exp.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", exp.text, "gm").map((f) => f.split(" = ")[0]),
    note: "is_automatic distingue gastos automáticos (comisiones) de manuales",
  };
} else schema.warnings.push(`No encontrado: ${FILES.mercadoExpense}`);

const cash = read(FILES.mercadoCash);
if (cash.ok) {
  schema.models.CashTransaction = {
    source: cash.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", cash.text, "gm").map((f) => f.split(" = ")[0]),
    actions: extract("\\('(income|expense)'", cash.text),
  };
} else schema.warnings.push(`No encontrado: ${FILES.mercadoCash}`);

const nomen = read(FILES.mercadoNomenclators);
if (nomen.ok) {
  schema.models.ExpenseLegend = {
    source: nomen.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", nomen.text, "gm").map((f) => f.split(" = ")[0]),
  };
} else schema.warnings.push(`No encontrado: ${FILES.mercadoNomenclators}`);

const coreSet = read(FILES.coreSettings);
if (coreSet.ok) {
  const start = coreSet.text.indexOf("Eventos de dominio");
  schema.models.core_eventing = {
    source: coreSet.file,
    events: (start >= 0 ? coreSet.text.slice(start) : coreSet.text)
      .split("\n")
      .filter((l) => l.includes(".") && !l.trim().startsWith("#"))
      .map((l) => l.trim())
      .filter((l) => /^[a-z_]+\.[a-z_.]+$/.test(l))
      .slice(0, 20),
  };
} else schema.warnings.push(`No encontrado: ${FILES.coreSettings}`);

const ref = read(FILES.coreReferrals);
if (ref.ok) {
  schema.models.ReferralRule = {
    source: ref.file,
    fields: extract("^\\s+([a-z_]+) = models\\.(\\w+)", ref.text, "gm").map((f) => f.split(" = ")[0]),
  };
} else schema.warnings.push(`No encontrado: ${FILES.coreReferrals}`);

const ot = read(FILES.panelOrderType);
if (ot.ok) {
  schema.models.OrderType = {
    source: ot.file,
    fields: extract("^\\s{4}([a-z_]+)[?:]", ot.text, "gm"),
  };
} else schema.warnings.push(`No encontrado: ${FILES.panelOrderType}`);

const met = read(FILES.panelMetrics);
if (met.ok) {
  const l = lineOf("const total_win", met.text);
  schema.formulas.total_win = {
    source: `${met.file}:${l ?? 220}`,
    expression: "total_income_executed - total_investment + total_shipping_price - total_expenses_messenger_profit - total_expenses_commission",
  };
} else schema.warnings.push(`No encontrado: ${FILES.panelMetrics}`);

const st = read(FILES.panelStatus);
if (st.ok) {
  schema.constants.status_events = {
    source: st.file,
    events: extract("(\\w+) = \"(\\w+)\"", st.text),
  };
}

writeFileSync(OUT, JSON.stringify(schema, null, 2));
console.log(`✔ core-schema-pro.json generado (${Object.keys(schema.constants).length} constantes, ${Object.keys(schema.models).length} modelos, ${Object.keys(schema.formulas).length} fórmulas).`);
if (schema.warnings.length) console.warn("Avisos:", schema.warnings);