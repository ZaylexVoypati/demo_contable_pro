# Demo Contable Pro — Partida Doble + Billetera Detallada (VoyPati)

Segunda demo, **con el doble de detalle contable** que la anterior: **contabilidad de
partida doble** (Debe/Haber), **catálogo de cuentas**, **libro diario**, **trial balance**,
**P&L**, **balance general**, **billetera detallada con saldo corriente y conciliación
bancaria**, facturas (`FAC-2026-XXXXX`), retiros, nómina e impuestos.

Usa **TODOS los repositorios reales de `voypati-tech`** (GitHub MCP, org-wide) y una
**extracción profunda del core** (15 modelos reales con su procedencia `archivo:línea`).

> Requiere Node.js 18+ · **Cero dependencias** · Reproducible (semilla fija).

---

## 1. Qué tiene de más este demo

| Capacidad | demo anterior (`demo_contable`) | este demo (`demo_contable_pro`) |
|---|---|---|
| Registro | transacciones simples (ingreso/gasto) | **asientos de partida doble** (Debe = Haber) |
| Cuentas | categorías sueltas | **catálogo de cuentas** (Activo/Pasivo/Patrimonio/Ingreso/Gasto) |
| Reportes | balances + resumen | **libro diario + trial balance + P&L + balance general** |
| Billetera | saldo total | **movimientos con saldo corriente, CUP y USD, conciliación (ReconciliationReport)** |
| Documentos | — | **facturas de comisión, retiros del socio, nómina, impuestos** |
| Órdenes | creación + liquidación | **ciclo de vida completo** (pending→accepted→processing→ready→delivering→completed) con cupones, descuentos y métodos de pago |
| GitHub | 5 repos fijos | **todos los repos de `voypati-tech`** (org-wide) proyectados por dominio contable |
| Core | 10 archivos | **15 modelos reales** (Invoice, CommissionConfig, Business, DriverWallet, ExpenseLegend, ReferralRule, etc.) |

---

## 2. Reglas reales implementadas (con fuente)

| Regla | Valor | Fuente real |
|---|---|---|
| Comisión VoyPati | **10%** del total | `vpt_proveedores/proovedor_back/finance/models.py:197` |
| Profit del conductor (express) | **90%** de la tarifa | `vpt_express/backend/apps/logistics/models.py:927` |
| Fórmula consolidado | `win = ingreso − inversión + mensajería − profit_mensajeros − comisión` | `vpt_panel_mercado/.../GeneralAmount/utils/getMetricsAll.ts:220` |
| Categorías corporativas | `income/expense`, `coupon_subsidy`, `promoter_commission`, etc. | `vpt_express/backend/apps/accounting/models.py:76-110` |
| Estados de orden | `pending…completed`, `cancelled`, `rejected` | `vpt_proveedores/proovedor_back/orders/models.py` |
| Factura | `FAC-2026-XXXXX`, `subtotal`, `tax_percentage`, `total` | `vpt_proveedores/proovedor_back/finance/models.py` (Invoice) |
| Retiro | `pending→approved→completed`, `payment_method` | `finance/models.py` (Withdrawal) |
| Monederos | `balance_cup` / `balance_usd` | `vpt_express/.../accounting/models.py` (CompanyWallet) |

---

## 3. Flujo contable (partida doble)

### Apertura
- Aporte de capital: `DR Caja / CR Capital`
- Compra de inventario: `DR Inventario / CR Caja`

### Por cada orden completada (5 asientos)
```
1) Venta:         DR Caja (total)             | CR Ingresos Ventas (subtotal−desc) | CR Ingresos Mensajería (envío)
2) COGS:          DR Costo Mercancía          | CR Inventario
3) Comisión 10%:  DR Comisiones por Cobrar    | CR Ingresos por Comisiones
4) Cobro parcial: DR Caja                     | CR Comisiones por Cobrar
5) Pago mensajero:DR Gasto Mensajería         | CR Caja
```
Las órdenes canceladas **no generan venta**; si estaban pagadas se registra reembolso.

### Operaciones corporativas
- **Cupones** → `DR Gasto Marketing / CR Caja`
- **Promotores** → `DR Comisiones Promotores / CR Caja`
- **Nómina** → devengo `DR Gasto Nómina / CR Salarios por Pagar` + pago
- **Impuestos** → `DR Gasto Impuesto / CR Impuestos por Pagar` + pago parcial
- **Facturas de comisión** → `FAC-2026-XXXXX` por negocio
- **Retiro del socio** → `DR Capital / CR Caja`
- **Multi-moneda** → movimientos en CUP y USD con tipo de cambio configurable

### Cierre
- `trialBalance()` → Debe **=** Haber (siempre cuadra)
- `incomeStatement()` → P&L con márgenes
- `balanceSheet()` → Activos **=** Pasivos + Patrimonio (incluye resultado del día)
- `reconcile()` → saldo esperado **=** saldo real en CUP y USD

---

## 4. Cómo ejecutarlo (VS Code)

```bash
# 1) (Opcional) Regenerar esquema profundo del core
node scripts/extract-core-pro.js

# 2) (Opcional) Regenerar snapshot con TODOS los repos de voypati-tech
node scripts/github-org-snapshot.js

# 3) Día contable completo en partida doble
node src/simulate.js          # o:  npm run day

# CLI
node src/main.js              # igual a simulate
node src/main.js extract      # esquema del core
node src/main.js github       # snapshot org-wide
```

O abre `run.ps1` en la terminal de VS Code para el menú.

Salidas:
- `data/core-schema-pro.json` — 15 modelos reales del core.
- `data/github-org-snapshot.json` — todos los repos de `voypati-tech`.
- `output/dia-contable-partida-doble.json` — reporte completo (156 asientos, órdenes, facturas, retiros, resumen).

---

## 5. GitHub org-wide

`src/lib/github.js` obtiene el token de `GITHUB_TOKEN`/`GH_TOKEN` o de las credenciales
de git (`git credential fill`), consulta `GET /orgs/voypati-tech/repos` y lee la actividad
de **cada repo** (PRs abiertos/mergeados, commits recientes). Después clasifica cada repo
por dominio contable (`mercado`, `providers`, `express`, `core`, `panel_mercado`,
`app_conductor`, …) y lo proyecta en el resumen.

---

## 6. Estructura

```
demo_contable_pro/
├─ package.json / README.md / run.ps1
├─ data/
│  ├─ core-schema-pro.json         # esquema profundo del core (generado)
│  └─ github-org-snapshot.json     # todos los repos reales (generado)
├─ scripts/
│  ├─ extract-core-pro.js          # extracción profunda del core
│  └─ github-org-snapshot.js       # snapshot org-wide
├─ src/
│  ├─ main.js / simulate.js        # CLI y día completo
│  ├─ lib/
│  │  ├─ ledger.js                 # partida doble (catálogo, asientos, trial, P&L, balance)
│  │  ├─ wallet.js                 # billetera detallada + conciliación
│  │  ├─ orders.js                 # ciclo de vida de órdenes
│  │  ├─ github.js                 # GitHub org-wide
│  │  └─ coreData.js               # carga del esquema del core
│  ├─ flow/
│  │  ├─ lifecycle.js              # órdenes → asientos
│  │  └─ operations.js             # facturas, retiros, nómina, impuestos
│  └─ modules/
│     ├─ ledgerPanel.js            # libro diario, trial balance, P&L, balance general
│     ├─ walletDetail.js           # billetera detallada
│     └─ summary.js                # resumen final
└─ output/
   └─ dia-contable-partida-doble.json
```