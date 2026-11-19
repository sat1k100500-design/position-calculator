// Расчёт позиции для USDT-M фьючерсов (изолированная маржа).
// MMR — ставка поддерживающей маржи. У Binance она зависит от монеты и размера
// позиции (0.4–1% для обычных объёмов), поэтому ликвидация — приблизительная.

export const TAKER_FEE = 0.0005; // 0.05% за вход и столько же за выход
export const DEFAULT_MMR = 0.005;

const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export function calculate(input) {
  const side = input.side === "short" ? -1 : 1;
  const entry = num(input.entry);
  const lev = Math.max(1, num(input.leverage) || 1);
  const sl = num(input.stopLoss);
  const tp = num(input.takeProfit);
  const mmr = DEFAULT_MMR;

  if (!(entry > 0)) return null;

  let qty, notional, margin, riskUsd = NaN;

  if (input.mode === "risk") {
    const deposit = num(input.deposit);
    const riskPct = num(input.riskPct);
    if (!(deposit > 0) || !(riskPct > 0) || !(sl > 0) || sl === entry) {
      return { entry, lev, incomplete: "Для расчёта по риску нужны депозит, % риска и стоп-лосс" };
    }
    riskUsd = (deposit * riskPct) / 100;
    const perCoin = Math.abs(entry - sl) + entry * TAKER_FEE + sl * TAKER_FEE;
    qty = riskUsd / perCoin;
    notional = qty * entry;
    margin = notional / lev;
  } else {
    margin = num(input.margin);
    if (!(margin > 0)) return { entry, lev, incomplete: "Введи сумму маржи" };
    notional = margin * lev;
    qty = notional / entry;
  }

  const liq =
    side === 1
      ? (entry * (1 - 1 / lev)) / (1 - mmr)
      : (entry * (1 + 1 / lev)) / (1 + mmr);

  const openFee = notional * TAKER_FEE;
  const pnlAt = (price) => {
    if (!(price > 0)) return null;
    const gross = side * (price - entry) * qty;
    const fees = openFee + qty * price * TAKER_FEE;
    const net = gross - fees;
    return { price, gross, fees, net, roe: (net / margin) * 100, move: ((price - entry) / entry) * 100 };
  };

  const atTp = pnlAt(tp);
  const atSl = pnlAt(sl);

  const warnings = [];
  if (atTp && side * (tp - entry) <= 0) warnings.push("Тейк-профит стоит не в ту сторону от входа");
  if (atSl && side * (sl - entry) >= 0) warnings.push("Стоп-лосс стоит не в ту сторону от входа");
  if (atSl && side * (sl - liq) <= 0) warnings.push("Ликвидация наступит раньше стоп-лосса — снизь плечо");
  if (input.mode === "risk" && margin > num(input.deposit))
    warnings.push("Маржа больше депозита — увеличь плечо или уменьши риск");

  const rr = atTp && atSl && atSl.net < 0 ? atTp.net / Math.abs(atSl.net) : null;

  return {
    entry, lev, qty, notional, margin, liq, mmr, riskUsd,
    liqDistance: ((liq - entry) / entry) * 100,
    openFee, roundTripFee: openFee * 2,
    atTp, atSl, rr, warnings,
  };
}

export function decimalsFor(price) {
  if (!(price > 0)) return 2;
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 5;
  return 8;
}

export function fmtPrice(p, ref) {
  if (!Number.isFinite(p)) return "—";
  return p.toLocaleString("ru-RU", {
    minimumFractionDigits: decimalsFor(ref ?? p),
    maximumFractionDigits: decimalsFor(ref ?? p),
  });
}

export function fmtUsd(v, digits = 2) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " $";
}

export function fmtQty(q) {
  if (!Number.isFinite(q)) return "—";
  const d = q >= 1000 ? 1 : q >= 1 ? 3 : q >= 0.01 ? 5 : 8;
  return q.toLocaleString("ru-RU", { maximumFractionDigits: d });
}

export function fmtPct(v, sign = true) {
  if (!Number.isFinite(v)) return "—";
  const s = sign && v > 0 ? "+" : "";
  return s + v.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + "%";
}
