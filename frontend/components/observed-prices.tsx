"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Radar, ShoppingBasket } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import snapshot from "@/lib/kamis-prices.json";
import backtest from "@/lib/kamis-backtest.json";
import { won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

const products = snapshot.products.map((product) => ({
  ...product,
  latest: product.history[product.history.length - 1],
}));
const initialQuantities = products.map(() => 1);
const storageKey = "priceradar.observed.quantities.v1";
const sourceDate = products.map(({ latest }) => latest.date).sort().at(-1);
const toTime = (date: string) => Date.parse(date + "T00:00:00Z");
const formatDay = (time: number) =>
  new Date(time).toISOString().slice(0, 10);

export default function ObservedPrices() {
  const [selected, setSelected] = useState(0);
  const [quantities, setQuantities] = useState(initialQuantities);
  const [ready, setReady] = useState(false);
  const product = products[selected];
  const total = products.reduce(
    (sum, item, i) => sum + item.latest.price * quantities[i],
    0,
  );

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        Array.isArray(value) &&
        value.length === products.length &&
        value.every((n) => Number.isInteger(n) && n >= 0 && n <= 999)
      ) setQuantities(value);
    } catch {
      // The basket also works with browser storage disabled.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(quantities));
    } catch {
      // The current session still retains the quantities.
    }
  }, [quantities, ready]);

  function updateQuantity(index: number, value: string) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) return;
    setQuantities((previous) => previous.map((n, i) => i === index ? quantity : n));
  }

  return (
    <>
      <header className="header">
        <div className={`header-inner ${styles.header}`}>
          <div className="brand">
            <span className="brand-icon"><Radar size={22} aria-hidden="true" /></span>
            <span>PriceRadar <b>AI</b></span>
          </div>
          <Link className={styles.demoLink} href="/demo/">
            예측 데모 <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main className="main">
        <section className="dashboard-hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" /> KAMIS 소매 조사
            </div>
            <h1>우리 장바구니 <span>소매가격</span></h1>
            <p>{snapshot.market} · {snapshot.grade} 등급 · 최근 조사일 {sourceDate}</p>
          </div>
        </section>

        <div className={styles.cards} aria-label="품목별 최근 조사 가격">
          {products.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`stat-card ${styles.card}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
            >
              <span className="stat-label">{item.name} <span>{item.unit}</span></span>
              <span className={`stat-value ${styles.cardValue}`}>
                {won(item.latest.price)}<span>원</span>
              </span>
              <span className={styles.cardSpec}>{item.variety} · {item.latest.date}</span>
            </button>
          ))}
        </div>

        <div className="main-grid">
          <section className="panel" aria-labelledby="history-title">
            <div className="panel-heading">
              <div>
                <h2 id="history-title">{product.name} 가격 추이</h2>
                <p>{product.variety} · {product.unit} · {product.history.length}회 관측</p>
              </div>
            </div>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart
                  data={product.history.map(({ date, price }) => ({ time: toTime(date), price }))}
                  margin={{ top: 16, right: 23, left: 0, bottom: 6 }}
                >
                  <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(n) => formatDay(n).slice(5).replace("-", "/")}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 11, fill: "#66768a" }}
                  />
                  <YAxis
                    width={60}
                    domain={["auto", "auto"]}
                    tickFormatter={won}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#66768a" }}
                  />
                  <Tooltip
                    labelFormatter={(n) => formatDay(Number(n))}
                    formatter={(n) => [`${won(Number(n))}원 / ${product.unit}`, "관측 가격"]}
                  />
                  <Line
                    dataKey="price"
                    type="linear"
                    stroke="#3067e9"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={styles.chartNote}>
              {product.history[0].date} ~ {product.latest.date}
            </p>
          </section>

          <section className="panel" aria-labelledby="basket-title">
            <div className="panel-heading">
              <div>
                <h2 id="basket-title"><ShoppingBasket size={17} /> 내 장바구니</h2>
                <p>최근 조사 단가로 계산합니다.</p>
              </div>
            </div>
            <div className={styles.basket}>
              {products.map((item, index) => (
                <div className={styles.basketRow} key={item.id}>
                  <label htmlFor={`quantity-${item.id}`}>
                    <strong>{item.name}</strong>
                    <span>{won(item.latest.price)}원 / {item.unit}</span>
                  </label>
                  <input
                    id={`quantity-${item.id}`}
                    aria-label={`${item.name} 수량 (${item.unit} 단위)`}
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    value={quantities[index]}
                    onChange={(event) => updateQuantity(index, event.currentTarget.value)}
                  />
                  <strong>{won(item.latest.price * quantities[index])}원</strong>
                </div>
              ))}
              <div className={styles.total} aria-live="polite">
                <span>장바구니 합계</span><strong>{won(total)}원</strong>
              </div>
            </div>
          </section>
        </div>
        <section className={`panel ${styles.validation}`} id="forecast-validation" aria-labelledby="validation-title">
          <div className="panel-heading">
            <div>
              <h2 id="validation-title">30일 가격 예측 검증</h2>
              <p>검증 기준일 {backtest.start} ~ {backtest.end} · 평가 {backtest.overall.count}건</p>
            </div>
          </div>
          <div className={styles.validationBody}>
            <p>
              기준 날짜의 가격이 유지된다고 가정하면 평균 오차가 {backtest.overall.baseline.toFixed(2)}%,
              가격·환율·식품지수를 학습한 XGBoost 모델은 {backtest.overall.model.toFixed(2)}%였습니다.
              이 검증에서는 가격 유지 기준의 오차가 낮아 장바구니에는 조사 단가를 표시합니다.
            </p>
            <div className={styles.validationScroll}>
              <table className={styles.validationTable}>
                <thead>
                  <tr><th>품목</th><th>평가 건수</th><th>가격 유지 오차</th><th>모델 오차</th></tr>
                </thead>
                <tbody>
                  {products.map(({ id, name }) => {
                    const metric = backtest.products[id as keyof typeof backtest.products];
                    if (!metric) return null;
                    return (
                      <tr key={id}>
                        <th scope="row">{name}</th><td>{metric.count}</td>
                        <td>{metric.baseline.toFixed(2)}%</td><td>{metric.model.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.chartNote}>
              평가 대상은 {backtest.basis}입니다. 실제 가격이 {backtest.minimumObservations}회 이상 관측된 경우를 평가했습니다.
            </p>
          </div>
        </section>
        <footer className={styles.source}>
          출처 <a href={snapshot.sourceUrl}>{snapshot.source}</a> ·{" "}
          <a href="https://data.mafra.go.kr/opendata/data/indexOpenDataDetail.do?data_id=20251017000000002761">과거 소매가격</a> ·{" "}
          <a href="https://fred.stlouisfed.org/series/DEXKOUS">원/달러 환율</a> ·{" "}
          <a href="https://www.worldbank.org/en/research/commodity-markets">세계은행 식품지수</a>
        </footer>
      </main>
    </>
  );
}
