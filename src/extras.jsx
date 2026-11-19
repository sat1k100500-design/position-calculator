import { useEffect, useId, useRef, useState } from "react";
import { BotAvatar } from "bot-avatars";
import { fmtPct, fmtPrice } from "./calc.js";

// Мини-график цены за 24 часа с градиентной заливкой и пульсирующей точкой.
export function Sparkline({ points, price, up }) {
  const id = useId().replace(/:/g, "");
  const data = points.length ? [...points.slice(0, -1), price ?? points[points.length - 1]] : [];
  if (data.length < 2) return <div className="spark spark--empty" />;
  const W = 600, H = 84, pad = 6;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const xy = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    pad + (1 - (v - min) / span) * (H - pad * 2),
  ]);
  const line = xy.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const [lx, ly] = xy[xy.length - 1];
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div className="spark">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="spark-dot" style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%`, "--c": color }} />
      <div className="spark-labels">
        <span>24ч</span>
        <span>макс {fmtPrice(max)}</span>
        <span>мин {fmtPrice(min)}</span>
      </div>
    </div>
  );
}

// Цена, которая вспыхивает зелёным/красным на каждом тике.
export function FlashPrice({ value }) {
  const prev = useRef(value);
  const [dir, setDir] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (value && prev.current && value !== prev.current) {
      setDir(value > prev.current ? "up" : "down");
      setTick((t) => t + 1);
    }
    prev.current = value;
  }, [value]);
  return (
    <div key={tick} className={"price-value" + (dir ? " flash-" + dir : "")}>
      {value ? fmtPrice(value) : "—"}
    </div>
  );
}

// Шкала уровней: ликвидация, стоп, вход, текущая цена, тейк.
export function PriceLadder({ r, price, side }) {
  const marks = [
    { key: "liq", label: "Ликвидация", value: r.liq },
    r.atSl && { key: "sl", label: "Стоп", value: r.atSl.price },
    { key: "entry", label: "Вход", value: r.entry },
    r.atTp && { key: "tp", label: "Тейк", value: r.atTp.price },
  ].filter(Boolean);
  const values = marks.map((m) => m.value).concat(price ? [price] : []);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  // Для шорта прибыль внизу, поэтому разворачиваем шкалу: тейк всегда справа.
  const pos = (v) => {
    const t = (v - min) / span;
    return 4 + (side === "short" ? 1 - t : t) * 92;
  };
  const entryX = pos(r.entry);
  const tpX = r.atTp ? pos(r.atTp.price) : null;
  const slX = r.atSl ? pos(r.atSl.price) : pos(r.liq);
  return (
    <div className="ladder">
      <div className="ladder-track">
        <div className="ladder-zone loss" style={{ left: `${Math.min(slX, entryX)}%`, width: `${Math.abs(entryX - slX)}%` }} />
        {tpX != null && (
          <div className="ladder-zone gain" style={{ left: `${Math.min(tpX, entryX)}%`, width: `${Math.abs(tpX - entryX)}%` }} />
        )}
        {marks.map((m) => (
          <div key={m.key} className={"ladder-mark mark-" + m.key} style={{ left: `${pos(m.value)}%` }}>
            <span className="ladder-pin" />
            <span className="ladder-label">
              {m.label}
              <b>{fmtPrice(m.value, r.entry)}</b>
            </span>
          </div>
        ))}
        {price && (
          <div className="ladder-now" style={{ left: `${pos(price)}%` }} title="Текущая цена" />
        )}
      </div>
    </div>
  );
}

// Бот-помощник: реагирует на расчёт короткой фразой.
export function Assistant({ r, loading }) {
  let state = "default";
  let mood = "calm";
  let text;
  if (loading) {
    state = "working";
    text = "Подключаюсь к Binance…";
  } else if (!r || r.incomplete) {
    state = "sleeping";
    text = r?.incomplete ?? "Жду данные…";
  } else if (r.warnings.length) {
    mood = "alert";
    text = r.warnings.join(" · ");
  } else if (r.rr != null) {
    mood = r.rr >= 2 ? "good" : r.rr >= 1 ? "calm" : "alert";
    text = `Риск к прибыли 1 : ${r.rr.toFixed(2)}. До ликвидации ${fmtPct(Math.abs(r.liqDistance), false)} от входа.`;
  } else {
    text = `До ликвидации ${fmtPct(Math.abs(r.liqDistance), false)}. Добавь стоп и тейк — посчитаю прибыль и убыток.`;
  }
  const color = mood === "alert" ? "#ff8a5c" : mood === "good" ? "#3fe0a0" : undefined;
  return (
    <div className={"assistant mood-" + mood}>
      <BotAvatar type="droid" state={state} face="mouth" size={52} color={color} />
      <p className="bubble" key={text}>{text}</p>
    </div>
  );
}
