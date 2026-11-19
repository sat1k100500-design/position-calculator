import { useEffect, useState } from "react";

const REST = "https://fapi.binance.com";
// Рыночные потоки фьючерсов теперь живут под /market (старый /ws молчит).
const WS = "wss://fstream.binance.com/market/ws";

// Список USDT-фьючерсов, отсортированный по объёму за 24 часа.
export function useSymbols() {
  const [state, setState] = useState({ list: [], error: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    fetch(`${REST}/fapi/v1/ticker/24hr`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows) => {
        if (cancelled) return;
        const list = rows
          .filter((r) => r.symbol.endsWith("USDT") && parseFloat(r.quoteVolume) > 0)
          .map((r) => ({
            symbol: r.symbol,
            base: r.symbol.slice(0, -4),
            price: parseFloat(r.lastPrice),
            change: parseFloat(r.priceChangePercent),
            volume: parseFloat(r.quoteVolume),
          }))
          .sort((a, b) => b.volume - a.volume);
        setState({ list, error: null, loading: false });
      })
      .catch((e) => !cancelled && setState({ list: [], error: e.message, loading: false }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// Живая mark-цена монеты через WebSocket (обновляется раз в секунду).
export function useMarkPrice(symbol, fallback) {
  const [price, setPrice] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setPrice(null);
    setLive(false);
    if (!symbol) return;
    let ws;
    let retry;
    let closed = false;
    let lastMsg = 0;
    // Запасной вариант: если поток молчит, спрашиваем цену через REST.
    const poll = setInterval(() => {
      if (Date.now() - lastMsg < 5000) return;
      fetch(`${REST}/fapi/v1/premiumIndex?symbol=${symbol}`)
        .then((r) => r.json())
        .then((d) => {
          const p = parseFloat(d.markPrice);
          if (!closed && p > 0) setPrice(p);
        })
        .catch(() => {});
    }, 3000);
    const connect = () => {
      ws = new WebSocket(`${WS}/${symbol.toLowerCase()}@markPrice@1s`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const p = parseFloat(d.p);
        if (p > 0) {
          lastMsg = Date.now();
          setPrice(p);
          setLive(true);
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(poll);
      ws && ws.close();
    };
  }, [symbol]);

  return { price: price ?? fallback ?? null, live };
}
