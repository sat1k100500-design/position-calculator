import { useEffect, useMemo, useRef, useState } from "react";
import { DistortionWave } from "distortion-waves";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { Liquid } from "liquid-gooey";
import { MetalFx } from "metal-fx";
import { useMarkPrice, useSymbols } from "./binance.js";
import { calculate, fmtPct, fmtPrice, fmtQty, fmtUsd, TAKER_FEE, DEFAULT_MMR } from "./calc.js";

export default function App() {
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const button = useRef(null);

  return (
    <main className="page">
      <DistortionWave
        className="shell"
        revealed={open}
        source={button}
        type="vertical"
        palette="colorful"
        onFinish={(revealed) => setSettled(revealed)}
        revealedContent={<Calculator onClose={() => { setSettled(false); setOpen(false); }} />}
        overlay={
          !settled && (
            <div className={"launch" + (open ? " launch--gone" : "")}>
              <MetalFx variant="button" preset="chromatic" theme="dark">
                <button ref={button} className="launch-btn" onClick={() => setOpen(true)}>
                  Открыть калькулятор
                </button>
              </MetalFx>
            </div>
          )
        }
      >
        <Intro />
      </DistortionWave>
    </main>
  );
}

function Intro() {
  return (
    <section className="view intro">
      <div className="intro-orb">
        <ThinkingOrb state="weaving" size={64} theme="dark" />
      </div>
      <p className="eyebrow">Binance · USDT-M фьючерсы</p>
      <h1 className="intro-title">
        Калькулятор
        <br />
        позиции
      </h1>
      <p className="intro-text">
        Выбери монету, плечо и маржу — посчитаю объём, ликвидацию, прибыль и убыток по живой цене с Binance.
      </p>
      <ul className="intro-list">
        <li><span>01</span> Живая mark-цена каждую секунду</li>
        <li><span>02</span> Расчёт от маржи или от риска на сделку</li>
        <li><span>03</span> Ликвидация, комиссии, ROE и риск/прибыль</li>
      </ul>
    </section>
  );
}

const LEV_CHIPS = [2, 5, 10, 20, 50, 100];

function Calculator({ onClose }) {
  const { list, error, loading } = useSymbols();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const info = list.find((s) => s.symbol === symbol);
  const { price, live } = useMarkPrice(symbol, info?.price);

  const [side, setSide] = useState("long");
  const [mode, setMode] = useState("margin");
  const [leverage, setLeverage] = useState(10);
  const [margin, setMargin] = useState("100");
  const [deposit, setDeposit] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  // Новая монета — сбрасываем цены, чтобы не тащить чужие уровни.
  useEffect(() => {
    setEntry("");
    setStopLoss("");
    setTakeProfit("");
  }, [symbol]);

  const entryValue = entry === "" ? price : entry;
  const r = useMemo(
    () => calculate({ side, mode, leverage, margin, deposit, riskPct, entry: entryValue, stopLoss, takeProfit }),
    [side, mode, leverage, margin, deposit, riskPct, entryValue, stopLoss, takeProfit]
  );

  const unrealized = r && !r.incomplete && price && entry !== "" ? (side === "long" ? 1 : -1) * (price - r.entry) * r.qty : null;

  return (
    <section className="view calc">
      <header className="calc-head">
        <CoinPicker list={list} loading={loading} error={error} value={symbol} onChange={setSymbol} />
        <div className="price-box">
          <div className="price-label">
            {live ? <span className="dot" /> : <ThinkingOrb state="connecting" size={20} theme="dark" />}
            {live ? "Mark-цена" : "Подключаюсь…"}
          </div>
          <div className="price-value">{price ? fmtPrice(price) : "—"}</div>
          {info && (
            <div className={"price-change " + (info.change >= 0 ? "up" : "down")}>{fmtPct(info.change)} за 24ч</div>
          )}
        </div>
      </header>

      <SideToggle side={side} onChange={setSide} />

      <div className="tabs">
        <button className={mode === "margin" ? "on" : ""} onClick={() => setMode("margin")}>От маржи</button>
        <button className={mode === "risk" ? "on" : ""} onClick={() => setMode("risk")}>От риска</button>
      </div>

      <div className="field">
        <div className="field-top">
          <label>Плечо</label>
          <span className="lev-value">{leverage}×</span>
        </div>
        <input
          type="range" min="1" max="125" step="1" value={leverage}
          onChange={(e) => setLeverage(+e.target.value)}
          style={{ "--fill": `${((leverage - 1) / 124) * 100}%` }}
        />
        <div className="chips">
          {LEV_CHIPS.map((l) => (
            <button key={l} className={leverage === l ? "on" : ""} onClick={() => setLeverage(l)}>{l}×</button>
          ))}
        </div>
      </div>

      <div className="grid">
        {mode === "margin" ? (
          <NumField label="Маржа" suffix="USDT" value={margin} onChange={setMargin} />
        ) : (
          <>
            <NumField label="Депозит" suffix="USDT" value={deposit} onChange={setDeposit} />
            <NumField label="Риск на сделку" suffix="%" value={riskPct} onChange={setRiskPct} />
          </>
        )}
        <NumField
          label="Цена входа"
          suffix={entry === "" ? "рынок" : "USDT"}
          value={entry}
          placeholder={price ? String(+price.toFixed(8)) : ""}
          onChange={setEntry}
          action={entry !== "" ? { label: "по рынку", onClick: () => setEntry("") } : null}
        />
        <NumField label="Стоп-лосс" suffix="USDT" value={stopLoss} onChange={setStopLoss} placeholder="необязательно" tone="down" />
        <NumField label="Тейк-профит" suffix="USDT" value={takeProfit} onChange={setTakeProfit} placeholder="необязательно" tone="up" />
      </div>

      <BorderBeam size="md" colorVariant={side === "long" ? "ocean" : "sunset"} theme="dark" strength={0.85}>
        <div className="result">
          {!r ? (
            <p className="muted">Жду цену…</p>
          ) : r.incomplete ? (
            <p className="muted">{r.incomplete}</p>
          ) : (
            <>
              <div className="result-main">
                <Stat label="Объём позиции" value={fmtUsd(r.notional)} big />
                <Stat label={`Кол-во ${info?.base ?? ""}`} value={fmtQty(r.qty)} big />
              </div>
              <div className="result-grid">
                <Stat label="Маржа" value={fmtUsd(r.margin)} />
                <Stat label="Ликвидация ≈" value={fmtPrice(r.liq, r.entry)} sub={fmtPct(r.liqDistance)} tone="warn" />
                <Stat label="Комиссия вход+выход" value={fmtUsd(r.roundTripFee)} />
                {mode === "risk" && <Stat label="Риск" value={fmtUsd(r.riskUsd)} tone="down" />}
                {r.atTp && <Stat label="Прибыль на тейке" value={fmtUsd(r.atTp.net)} sub={`ROE ${fmtPct(r.atTp.roe)}`} tone={r.atTp.net >= 0 ? "up" : "down"} />}
                {r.atSl && <Stat label="Убыток на стопе" value={fmtUsd(r.atSl.net)} sub={`ROE ${fmtPct(r.atSl.roe)}`} tone={r.atSl.net >= 0 ? "up" : "down"} />}
                {r.rr != null && <Stat label="Риск : прибыль" value={`1 : ${r.rr.toFixed(2)}`} />}
                {unrealized != null && <Stat label="PnL сейчас" value={fmtUsd(unrealized)} tone={unrealized >= 0 ? "up" : "down"} />}
              </div>
              {r.warnings.length > 0 && (
                <ul className="warnings">
                  {r.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      </BorderBeam>

      <footer className="calc-foot">
        <p>
          Изолированная маржа, комиссия тейкера {TAKER_FEE * 100}% за сторону, поддерживающая маржа ≈ {DEFAULT_MMR * 100}%.
          Ликвидация на бирже может немного отличаться.
        </p>
        <button className="back" onClick={onClose}>← Назад</button>
      </footer>
    </section>
  );
}

function SideToggle({ side, onChange }) {
  return (
    <Liquid className="side" blur={8} contrast={20} fill={side === "long" ? "#1fc77e" : "#f0475c"}
      shadow="0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)">
      <Liquid.Item effect="move" move={{ springiness: 0.45, trail: 0.6 }}>
        <div className="side-thumb" style={{ transform: side === "long" ? "translateX(0)" : "translateX(100%)" }} />
      </Liquid.Item>
      <button className={"side-btn" + (side === "long" ? " on" : "")} onClick={() => onChange("long")}>Лонг ↑</button>
      <button className={"side-btn" + (side === "short" ? " on" : "")} onClick={() => onChange("short")}>Шорт ↓</button>
    </Liquid>
  );
}

function CoinPicker({ list, loading, error, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toUpperCase();
    return (s ? list.filter((c) => c.base.includes(s)) : list).slice(0, 150);
  }, [list, q]);

  const base = value.replace(/USDT$/, "");

  return (
    <div className="picker" ref={box}>
      <button className="picker-btn" onClick={() => setOpen((o) => !o)}>
        <span className="coin-badge">{base.slice(0, 1)}</span>
        <span className="picker-name">
          {base}<small>/USDT</small>
        </span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="picker-pop">
          <input autoFocus className="picker-search" placeholder="Поиск: BTC, SOL, PEPE…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker-list">
            {loading && <div className="picker-empty"><ThinkingOrb state="searching" size={20} theme="dark" /> Загружаю монеты…</div>}
            {error && <div className="picker-empty">Не удалось загрузить список: {error}</div>}
            {!loading && !error && filtered.length === 0 && <div className="picker-empty">Ничего не нашлось</div>}
            {filtered.map((c) => (
              <button key={c.symbol} className={"picker-row" + (c.symbol === value ? " on" : "")}
                onClick={() => { onChange(c.symbol); setOpen(false); setQ(""); }}>
                <span className="picker-row-name">{c.base}<small>/USDT</small></span>
                <span className="picker-row-price">{fmtPrice(c.price)}</span>
                <span className={"picker-row-chg " + (c.change >= 0 ? "up" : "down")}>{fmtPct(c.change)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({ label, suffix, value, onChange, placeholder, action, tone }) {
  return (
    <label className={"field num" + (tone ? " tone-" + tone : "")}>
      <div className="field-top">
        <span>{label}</span>
        {action && <button type="button" className="mini" onClick={action.onClick}>{action.label}</button>}
      </div>
      <div className="input-wrap">
        <input inputMode="decimal" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} />
        <span className="suffix">{suffix}</span>
      </div>
    </label>
  );
}

function Stat({ label, value, sub, big, tone }) {
  return (
    <div className={"stat" + (big ? " big" : "") + (tone ? " tone-" + tone : "")}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
