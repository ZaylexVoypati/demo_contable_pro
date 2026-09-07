/**
 * CICLO DE VIDA DE ÓRDENES → ASIENTOS DE PARTIDA DOBLE
 * =====================================================
 * Cada evento del ciclo de una orden genera asientos (Debe/Haber):
 *
 *  1. Aporte inicial / compra de inventario (apertura)
 *  2. Venta liquidada:
 *       DR Caja            total_price
 *         CR Ingresos Ventas    subtotal − descuento
 *         CR Ingresos Mensajería shipping
 *       DR COGS            inversión
 *         CR Inventario         inversión
 *  3. Comisión VoyPati (10%):
 *       DR Comisiones por Cobrar   client_commission
 *         CR Ingresos por Comisiones client_commission
 *  4. Cobro de comisiones:
 *       DR Caja   client_commission × %cobrado
 *         CR Comisiones por Cobrar
 *  5. Pago al mensajero:
 *       DR Gasto Mensajería   messenger_profit
 *         CR Caja             messenger_profit
 */

import { postEntry } from "../lib/ledger.js";

/** Asiento de apertura: capital + compra de inventario inicial. */
export function openDay(ledger, { date, capital_cup = 0, inventory_cup = 0, capital_usd = 0 }) {
  if (capital_cup > 0) {
    postEntry(ledger, {
      date, ref: "APERTURA", description: "Aporte de capital del socio",
      lines: [
        { account: "1001", debit: capital_cup },
        { account: "3001", credit: capital_cup },
      ],
    });
  }
  if (capital_usd > 0) {
    postEntry(ledger, {
      date, ref: "APERTURA", description: "Aporte de capital del socio (USD)",
      lines: [
        { account: "1002", debit: capital_usd },
        { account: "3001", credit: capital_usd },
      ],
    });
  }
  if (inventory_cup > 0) {
    postEntry(ledger, {
      date, ref: "APERTURA", description: "Compra inicial de inventario",
      lines: [
        { account: "1300", debit: inventory_cup },
        { account: "1001", credit: inventory_cup },
      ],
    });
  }
}

/**
 * Procesa una orden completa. Devuelve los asientos generados.
 * collection_pct = % de comisiones cobradas el mismo día (0..1).
 */
export function processOrder(ledger, order, { date, collection_pct = 0.6 } = {}) {
  const entries = [];
  if (order.status === "cancelled" || order.status === "rejected") {
    if (order.is_paid) {
      // Reembolso
      entries.push(postEntry(ledger, {
        date, ref: `REFUND:${order.number}`, description: `Reembolso orden cancelada ${order.number}`,
        lines: [
          { account: "5008", debit: order.total_price },
          { account: "1001", credit: order.total_price },
        ],
      }));
    }
    return entries; // las canceladas no generan venta
  }

  // 2) Venta liquidada (clientes pagan el total: producto + mensajería)
  const saleLines = [
    { account: "1001", debit: order.total_price },
    { account: "4001", credit: order.subtotal - order.discount },
    { account: "4002", credit: order.shipping_price },
  ];
  if (order.tax > 0) saleLines.push({ account: "2001", credit: order.tax });
  entries.push(postEntry(ledger, {
    date, ref: `SALE:${order.number}`, description: `Venta liquidada ${order.number} (pago ${order.payment_method})`,
    lines: saleLines,
  }));

  // COGS vs Inventario
  entries.push(postEntry(ledger, {
    date, ref: `COGS:${order.number}`, description: `Costo de mercancía ${order.number}`,
    lines: [
      { account: "5001", debit: order.investment },
      { account: "1300", credit: order.investment },
    ],
  }));

  // 3) Comisión VoyPati por cobrar (10% del total)
  entries.push(postEntry(ledger, {
    date, ref: `COMM:${order.number}`, description: `Comisión VoyPati 10% ${order.number}`,
    lines: [
      { account: "1200", debit: order.client_commission },
      { account: "4003", credit: order.client_commission },
    ],
  }));

  // 4) Cobro parcial de comisiones
  const collected = Math.round(order.client_commission * collection_pct * 100) / 100;
  if (collected > 0) {
    entries.push(postEntry(ledger, {
      date, ref: `COLL:${order.number}`, description: `Cobro de comisión ${order.number} (${collection_pct * 100}%)`,
      lines: [
        { account: "1001", debit: collected },
        { account: "1200", credit: collected },
      ],
    }));
  }

  // 5) Pago al mensajero
  entries.push(postEntry(ledger, {
    date, ref: `DELIV:${order.number}`, description: `Pago mensajero por entrega ${order.number}`,
    lines: [
      { account: "5002", debit: order.messenger_profit },
      { account: "1001", credit: order.messenger_profit },
    ],
  }));

  return entries;
}