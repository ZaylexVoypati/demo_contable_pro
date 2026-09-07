/**
 * MODELO DETALLADO DE ÓRDENES (MERCADO)
 * =====================================
 * Replica OrderType real (vpt_panel_mercado/src/types/OrderType.ts) y los estados
 * de OrderStatus (vpt_proveedores/orders/models.py):
 *   pending → accepted → processing → ready → delivering → completed
 *   cancelado: cancelled | rejected
 *
 * Campos financieros calculados con las reglas reales:
 *  - client_commission = 10% del total (finance/models.py:197)
 *  - messenger_profit  = pago al mensajero por la entrega
 *  - discount / coupon / tax: como en el panel (CouponType, Invoice.tax)
 */

import { randomUUID } from "node:crypto";

export const ORDER_STATUSES = ["pending", "accepted", "processing", "ready", "delivering", "completed", "cancelled", "rejected"];
export const PAYMENT_METHODS = ["payment_on_delivery", "wallet", "troypay", "qvapay"];
export const ORDER_TYPES = ["made_to_order", "pre_sale", "in_stock"];
export const SHIPPING_TYPES = ["delivery", "in_warehouse"];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function createDetailedOrder({
  number,
  items = [],
  shipping_price = 0,
  payment_method = "payment_on_delivery",
  shipping_type = "delivery",
  order_type = "in_stock",
  coupon = null,             // { code, discount_percentage }
  allow_commission = true,
  currency = "CUP",
  status = "pending",
}) {
  const subtotal = round2(items.reduce((a, it) => a + it.price * it.quantity, 0));
  const investment = round2(items.reduce((a, it) => a + (it.cost ?? 0) * it.quantity, 0));
  const discount = coupon?.discount_percentage ? round2((subtotal * coupon.discount_percentage) / 100) : 0;
  const taxable = round2(subtotal - discount);
  const tax_rate = 0; // 0% en este modelo (los negocios pagan comisión, no IVA al cliente)
  const tax = round2((taxable * tax_rate) / 100);
  const total_price = round2(taxable + tax + shipping_price);
  const client_commission = allow_commission ? round2(total_price * 0.1) : 0;

  return {
    id: randomUUID(),
    number,
    status,
    order_type,
    payment_method,
    shipping_type,
    currency,
    items: items.map((it) => ({ ...it, line_subtotal: round2(it.price * it.quantity), line_cost: round2(it.cost * it.quantity) })),
    coupon,
    // montos
    subtotal,
    discount,
    tax_rate,
    tax,
    shipping_price: round2(shipping_price),
    total_price,
    client_commission,
    messenger_profit: round2(shipping_price * 0.8),
    investment,
    expected_income: subtotal,
    is_paid: false,
    // trazabilidad
    events: [{ at: new Date().toISOString(), status: "pending", note: "Orden creada" }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function transition(order, status, note = "") {
  order.status = status;
  order.events.push({ at: new Date().toISOString(), status, note });
  order.updated_at = new Date().toISOString();
  return order;
}

export function markPaid(order, method = order.payment_method) {
  order.is_paid = true;
  order.payment_method = method;
  transition(order, order.status, `Pagada vía ${method}`);
  return order;
}