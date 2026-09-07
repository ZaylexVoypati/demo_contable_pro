/**
 * OPERACIONES CORPORATIVAS DEL DÍA
 * =================================
 * Facturas (Invoice FAC-2026-XXXXX), retiros (Withdrawal), nómina, impuestos,
 * cupones y comisiones de promotores — replicando los modelos reales
 * de vpt_proveedores (Invoice, Withdrawal) y vpt_express (CompanyTransaction).
 */

import { postEntry } from "../lib/ledger.js";

let invoiceSeq = 1;

/** Emite una factura de comisiones a un negocio (modelo Invoice real). */
export function issueInvoice(ledger, { date, business, commission_subtotal, tax_percentage = 0 }) {
  const tax_amount = Math.round((commission_subtotal * tax_percentage) / 100 * 100) / 100;
  const number = `FAC-2026-${String(invoiceSeq++).padStart(5, "0")}`;
  // La comisión ya está por cobrar (1200); la factura solo documenta el total a cobrar.
  postEntry(ledger, {
    date,
    ref: `INV:${number}`,
    description: `Factura de comisiones ${number} — ${business}`,
    lines: [
      { account: "2001", debit: tax_amount },
      { account: "5007", credit: tax_amount },
    ],
  });
  return {
    number,
    business,
    subtotal: commission_subtotal,
    tax_percentage,
    tax_amount,
    total: commission_subtotal + tax_amount,
    status: "issued",
    issue_date: date,
  };
}

/** Retiro del socio (modelo Withdrawal real: pending→approved→completed). */
export function processWithdrawal(ledger, { date, amount, currency = "CUP", payment_method = "transfer" }) {
  const cash = currency === "USD" ? "1002" : "1001";
  postEntry(ledger, {
    date,
    ref: `WITHDRAW:${amount}${currency}`,
    description: `Retiro del socio ${amount} ${currency} (${payment_method})`,
    lines: [
      { account: "3001", debit: amount },
      { account: cash, credit: amount },
    ],
  });
  return { amount, currency, payment_method, status: "completed" };
}

/** Subsidio de cupón (coupon_subsidy → gasto de marketing). */
export function registerCoupon(ledger, { date, amount, order }) {
  return postEntry(ledger, {
    date, ref: `COUPON:${order ?? "gral"}`, description: `Subsidio de cupón ${amount} CUP`,
    lines: [
      { account: "5003", debit: amount },
      { account: "1001", credit: amount },
    ],
  });
}

/** Comisión de promotor (promoter_commission). */
export function registerPromoter(ledger, { date, amount, note = "" }) {
  return postEntry(ledger, {
    date, ref: "PROMOTER", description: `Comisión de promotor ${amount} CUP ${note}`.trim(),
    lines: [
      { account: "5004", debit: amount },
      { account: "1001", credit: amount },
    ],
  });
}

/** Nómina: devengo (Salarios por Pagar) y pago (salida de caja). */
export function registerPayroll(ledger, { date, amount, paid_pct = 1 }) {
  postEntry(ledger, {
    date, ref: "PAYROLL", description: `Devengo de nómina ${amount} CUP`,
    lines: [
      { account: "5005", debit: amount },
      { account: "2100", credit: amount },
    ],
  });
  const paid = Math.round(amount * paid_pct * 100) / 100;
  if (paid > 0) {
    postEntry(ledger, {
      date, ref: "PAYROLL-PAY", description: `Pago de nómina ${paid} CUP (${paid_pct * 100}%)`,
      lines: [
        { account: "2100", debit: paid },
        { account: "1001", credit: paid },
      ],
    });
  }
}

/** Gasto operativo (arriendo, servicios) — leyendas reales de ExpenseLegend. */
export function registerOperating(ledger, { date, amount, concept = "Alquiler local" }) {
  return postEntry(ledger, {
    date, ref: "OPEX", description: `Gasto operativo: ${concept} (${amount} CUP)`,
    lines: [
      { account: "5006", debit: amount },
      { account: "1001", credit: amount },
    ],
  });
}

/** Impuesto sobre ventas: devengo y pago parcial. */
export function registerTax(ledger, { date, amount, paid_pct = 0.5 }) {
  postEntry(ledger, {
    date, ref: "TAX", description: `Devengo de impuesto ${amount} CUP`,
    lines: [
      { account: "5007", debit: amount },
      { account: "2001", credit: amount },
    ],
  });
  const paid = Math.round(amount * paid_pct * 100) / 100;
  if (paid > 0) {
    postEntry(ledger, {
      date, ref: "TAX-PAY", description: `Pago de impuesto ${paid} CUP`,
      lines: [
        { account: "2001", debit: paid },
        { account: "1001", credit: paid },
      ],
    });
  }
}