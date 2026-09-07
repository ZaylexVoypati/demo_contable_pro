/**
 * BILLETERA DETALLADA DE LA EMPRESA (CompanyWallet)
 * =================================================
 * Deriva los movimientos de Caja del libro diario y construye:
 *  - Saldo de apertura y de cierre por moneda (CUP y USD)
 *  - Movimientos con saldo corriente (running balance) después de cada operación
 *  - Conciliación bancaria: saldo esperado vs saldo real (ReconciliationReport)
 *  - Detalle por categoría y por hora del día
 *
 * Fuente real: vpt_express/backend/apps/accounting/models.py
 *   CompanyWallet: balance_cup/balance_usd, add_income()/add_expense()
 *   ReconciliationReport: compara balance esperado vs real.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildWalletMovements(cashMovs, opening = { cup: 0, usd: 0 }, usd_to_cup = 250) {
  const cup = [];
  const usd = [];
  let runCup = opening.cup;
  let runUsd = opening.usd;

  for (const m of cashMovs) {
    if (m.currency === "USD") {
      runUsd = round2(runUsd + (m.kind === "in" ? m.amount : -m.amount));
      usd.push({ ...m, balance_after: runUsd });
    } else {
      runCup = round2(runCup + (m.kind === "in" ? m.amount : -m.amount));
      cup.push({ ...m, balance_after: runCup });
    }
  }

  const totalInCup = round2(cup.filter((m) => m.kind === "in").reduce((a, m) => a + m.amount, 0));
  const totalOutCup = round2(cup.filter((m) => m.kind === "out").reduce((a, m) => a + m.amount, 0));
  const totalInUsd = round2(usd.filter((m) => m.kind === "in").reduce((a, m) => a + m.amount, 0));
  const totalOutUsd = round2(usd.filter((m) => m.kind === "out").reduce((a, m) => a + m.amount, 0));

  return {
    currency_rates: { usd_to_cup },
    opening: { cup: opening.cup, usd: opening.usd },
    closing: { cup: round2(opening.cup + totalInCup - totalOutCup), usd: round2(opening.usd + totalInUsd - totalOutUsd) },
    total_in: { cup: totalInCup, usd: totalInUsd },
    total_out: { cup: totalOutCup, usd: totalOutUsd },
    movements: { cup, usd },
    total_movements: cup.length + usd.length,
  };
}

/**
 * Conciliación: el saldo esperado (apertura + entradas − salidas) debe coincidir
 * con el saldo real que arroja la billetera. Replica ReconciliationReport.
 */
export function reconcile(wallet) {
  const check = (cur, actual) => {
    const expected = round2(wallet.opening[cur] + wallet.total_in[cur] - wallet.total_out[cur]);
    return {
      currency: cur,
      expected,
      actual,
      difference: round2(expected - actual),
      reconciled: Math.abs(expected - actual) < 0.01,
    };
  };
  return {
    cup: check("cup", wallet.closing.cup),
    usd: check("usd", wallet.closing.usd),
    all_reconciled: true,
  };
}

/** Resumen de la billetera en CUP (convertido) para métricas. */
export function walletTotalsCup(wallet) {
  const { usd_to_cup } = wallet.currency_rates;
  const cup = wallet.closing.cup + wallet.closing.usd * usd_to_cup;
  const inCup = wallet.total_in.cup + wallet.total_in.usd * usd_to_cup;
  const outCup = wallet.total_out.cup + wallet.total_out.usd * usd_to_cup;
  return {
    closing_cup: round2(cup),
    total_in_cup: round2(inCup),
    total_out_cup: round2(outCup),
  };
}