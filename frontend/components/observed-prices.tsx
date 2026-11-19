"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Layers3, Newspaper, Radar, ShoppingBasket, TrendingUp } from "lucide-react";
import AnnualPriceCharts from "./annual-price-charts";
import EconomicNews from "./economic-news";
import snapshot from "@/lib/kamis-prices.json";
import backtest from "@/lib/kamis-backtest.json";
import monthlyForecasts from "@/lib/kamis-selectable-months.json";
import { percent, won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

type PriceForecast = {
  estimate: number | null;
  method: "xgboost" | "seasonal" | "unavailable";
  actual: number | null;
  observations: number;
  seasonalYears: number[];
};

type ForecastMonth = {
  asOf: string;
  trainingCount: number;
  products: Record<string, PriceForecast>;
};

const forecasts: Record<string, ForecastMonth> = monthlyForecasts as Record<string, ForecastMonth>;
const availableMonths = Object.keys(forecasts);
const years = [...new Set(availableMonths.map((month) => month.slice(0, 4)))];
const products = snapshot.products;
const initialQuantities = products.map(() => 1);
const storageKey = "priceradar.observed.quantities.v1";
const currency = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const priceText = (price: number | null) => price === null ? "자료 부족" : `${currency.format(price)}원`;
const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const methodLabel = {
  xgboost: "XGBoost",
  seasonal: "과거 동월 평균",
  unavailable: "예측 자료 부족",
};

const tabs = [
  { id: "dashboard", label: "대시보드", icon: Activity },
  { id: "basket", label: "내 장바구니", icon: ShoppingBasket },
  { id: "news", label: "경제뉴스", icon: Newspaper },
  { id: "outlook", label: "물가 전망", icon: TrendingUp },
  { id: "model", label: "AI 모델 분석", icon: Layers3 },
] as const;

function yearOverYear(current: number, previous: number) {
  const change = current - previous;
  if (Math.abs(change) < 0.005) return "변동 없음";
  return `${currency.format(Math.abs(change))}원 ${change > 0 ? "증가" : "감소"} (${percent(change / previous * 100)})`;
}

export default function ObservedPrices({ tabbed = false }: { tabbed?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const display = (id: typeof tab) => !tabbed || tab === id;

  const [quantities, setQuantities] = useState(initialQuantities);
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState("2026-06");
  const result = forecasts[month];
  const title = monthLabel(month);
  const year = month.slice(0, 4);
  const monthsForYear = availableMonths.filter((value) => value.startsWith(year));
  const previousMonth = `${Number(year) - 1}${month.slice(4)}`;
  const rows = products.map((product, index) => {
    const prior = product.history.filter(({ date }) => date.startsWith(previousMonth));
    return {
      ...product,
      ...result.products[product.id],
      quantity: quantities[index],
      priorActual: prior.length >= 3 ? prior.reduce((sum, point) => sum + point.price, 0) / prior.length : null,
    };
  });
  const unpriced = rows.filter(({ estimate, quantity }) => estimate === null && quantity > 0);
  const forecastTotal = rows.reduce((sum, { estimate, quantity }) => sum + (estimate ?? 0) * quantity, 0);
  const priorTotal = rows.some(({ priorActual, quantity }) => priorActual === null && quantity > 0)
    ? null
    : rows.reduce((sum, { priorActual, quantity }) => sum + (priorActual ?? 0) * quantity, 0);

  function updateYear(nextYear: string) {
    const matchingMonth = `${nextYear}${month.slice(4)}`;
    setMonth(forecasts[matchingMonth] ? matchingMonth : availableMonths.find((value) => value.startsWith(nextYear))!);
  }

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

  useEffect(() => {
    if (!tabbed) return;
    const syncTab = () => {
      const hash = window.location.hash.slice(1);
      setTab(tabs.find(({ id }) => id === hash)?.id ?? "dashboard");
    };
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, [tabbed]);

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
          <Link className={styles.demoLink} href={tabbed ? "/" : "/demo/"}>
            {tabbed ? "가격 요약" : "예측 데모"} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main className="main">
        {tabbed && (
          <nav className={styles.serviceNav} aria-label="예측 서비스 메뉴">
            {tabs.map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />{label}
              </a>
            ))}
          </nav>
        )}
        {(!tabbed || tab !== "news") && (
          <section className={`panel ${styles.monthPicker}`} aria-label="예측 대상 월 선택">
            <div>
              <h1>월별 식자재 가격 예측</h1>
              <p>{snapshot.market} · {snapshot.grade} 등급 · {result.asOf}까지의 자료로 예측</p>
            </div>
            <div className={styles.monthControls}>
              <label>
                연도
                <select value={year} onChange={(event) => updateYear(event.target.value)}>
                  {years.map((value) => <option key={value} value={value}>{value}년</option>)}
                </select>
              </label>
              <label>
                월
                <select value={month} onChange={(event) => setMonth(event.target.value)}>
                  {monthsForYear.map((value) => <option key={value} value={value}>{Number(value.slice(5))}월</option>)}
                </select>
              </label>
            </div>
          </section>
        )}
        {display("dashboard") && (
          <>
            <div className={styles.cards} aria-label={`${title} 품목별 예상 단가`}>
              {rows.map(({ id, name, unit, variety, estimate, method }) => (
                <a href={tabbed ? "#outlook" : `#price-${id}`} key={id} className={`stat-card ${styles.card}`}>
                  <span className="stat-label">{name} <span>{unit}</span></span>
                  <span className={`stat-value ${styles.cardValue}`}>{priceText(estimate)}</span>
                  <span className={styles.cardSpec}>{variety} · {methodLabel[method]}</span>
                </a>
              ))}
            </div>
            {tabbed && (
              <section className={`panel ${styles.dashboardBasket}`} aria-label="예상 식자재비">
                <div>
                  <p>{title} {unpriced.length ? "단가 확인 품목 소계" : "예상 식자재비"}</p>
                  <strong aria-live="polite">{priceText(forecastTotal)}</strong>
                  <p>{unpriced.length
                    ? `${unpriced.map(({ name }) => name).join("·")} 단가 자료 부족`
                    : `같은 구매량으로 작년 대비 ${priorTotal === null ? "비교 자료 부족" : yearOverYear(forecastTotal, priorTotal)}`}</p>
                </div>
                <a className={styles.serviceAction} href="#basket">월 구매량 입력 <ArrowUpRight size={16} aria-hidden="true" /></a>
              </section>
            )}
          </>
        )}
        {display("basket") && (
          <section className="panel" id="july-basket" aria-labelledby="basket-title">
            <div className="panel-heading">
              <div>
                <h2 id="basket-title"><ShoppingBasket size={17} /> {title} 장바구니</h2>
                <p>한 달에 살 수량을 입력하면 작년 같은 달과 같은 수량 기준으로 비교합니다.</p>
              </div>
            </div>
            <div className={styles.basket}>
              <div className={styles.validationScroll}>
                <table className={styles.validationTable} aria-label="품목별 예상 단가와 작년 대비 증감">
                  <thead>
                    <tr><th scope="col">품목</th><th scope="col">{monthLabel(previousMonth)} 실제</th><th scope="col">{title} 예상</th><th scope="col">작년 대비</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(({ id, name, unit, priorActual, estimate }) => (
                      <tr key={id}>
                        <th scope="row">{name} · {unit}</th>
                        <td>{priceText(priorActual)}</td><td>{priceText(estimate)}</td>
                        <td>{estimate !== null && priorActual !== null ? yearOverYear(estimate, priorActual) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.map(({ id, name, unit, quantity, estimate }, index) => (
                <div className={styles.basketRow} key={id}>
                  <label htmlFor={`quantity-${id}`}>
                    <strong>{name}</strong><span>월 구매량 · {unit} 단위</span>
                  </label>
                  <input id={`quantity-${id}`} aria-label={`${name} 월 구매량 (${unit} 단위)`}
                    type="number" min="0" max="999" step="1" value={quantity}
                    onChange={(event) => updateQuantity(index, event.currentTarget.value)} />
                  <strong>{priceText(estimate === null && quantity ? null : (estimate ?? 0) * quantity)}</strong>
                </div>
              ))}
              <div className={styles.total} aria-live="polite">
                <span>{monthLabel(previousMonth)} 가격 기준</span><strong>{priceText(priorTotal)}</strong>
              </div>
              <div className={`${styles.total} ${styles.forecastPrice}`} aria-live="polite">
                <span>{title} {unpriced.length ? "단가 확인 품목 소계" : "예상 식자재비"}</span><strong>{priceText(forecastTotal)}</strong>
              </div>
              {unpriced.length > 0 ? (
                <p className={styles.forecastNote} aria-live="polite">{unpriced.map(({ name }) => name).join("·")}의 단가 자료가 없어 소계에서 제외했습니다.</p>
              ) : priorTotal !== null && (
                <p className={styles.forecastNote} aria-live="polite">작년 같은 달 대비 {yearOverYear(forecastTotal, priorTotal)}</p>
              )}
            </div>
          </section>
        )}
        {tabbed && tab === "news" && <EconomicNews />}
        {display("outlook") && <AnnualPriceCharts products={products} showJulyForecast={month === "2026-07"} />}

        {display("model") && (
          <>
            <section className={`panel ${styles.validation}`} id="july-validation" aria-labelledby="july-validation-title">
              <div className="panel-heading">
                <div>
                  <h2 id="july-validation-title">{title} 예측 검증</h2>
                  <p>선택한 달의 실측은 오차 계산에 사용합니다. 예측에는 {result.asOf}까지의 자료를 사용합니다.</p>
                </div>
              </div>
              <div className={styles.validationBody}>
                <div className={styles.validationScroll}>
                  <table className={styles.validationTable}>
                    <thead>
                      <tr><th scope="col">품목</th><th scope="col">예측 방식</th><th scope="col">예상 평균</th><th scope="col">실제 평균</th><th scope="col">절대오차</th></tr>
                    </thead>
                    <tbody>
                      {rows.map(({ id, name, estimate, method, seasonalYears, actual, observations }) => {
                        const error = estimate !== null && actual !== null && observations >= 3 ? Math.abs(estimate - actual) : null;
                        return (
                          <tr key={id}>
                            <th scope="row">{name}</th>
                            <td>{methodLabel[method]}{seasonalYears.length ? ` (${[...seasonalYears].reverse().join("·")}년)` : ""}</td>
                            <td>{priceText(estimate)}</td>
                            <td>{actual === null ? "실측 자료 없음" : `${priceText(actual)} (${observations}일)`}</td>
                            <td>{error === null || actual === null ? "—" : `${priceText(error)} (${(100 * error / actual).toFixed(2)}%)`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p>전월 관측이 3일 이상이면 XGBoost를 사용합니다. 전월 자료가 부족하면 최근 4개년 중 관측이 3일 이상인 같은 달의 연도별 평균을 같은 비중으로 합산합니다.</p>
                <p>실측이 3일 이상인 품목의 오차를 표시합니다. {result.trainingCount > 0 && `이 달의 XGBoost 학습 사례는 ${result.trainingCount}건입니다.`}</p>
              </div>
            </section>
            <section className={`panel ${styles.validation}`} id="forecast-validation" aria-labelledby="validation-title">
              <div className="panel-heading">
                <div>
                  <h2 id="validation-title">가격 추이 그래프의 30일 예측 검증</h2>
                  <p>데이터 범위 {backtest.sourceStart} ~ {backtest.sourceEnd} · 실제 관측 {won(backtest.observationCount)}건</p>
                </div>
              </div>
              <div className={styles.validationBody}>
                <p>
                  검증 기준일 {backtest.start} ~ {backtest.end} · 평가 {backtest.overall.count}건
                </p>
                <p>
                  기준 날짜의 가격이 유지된다고 가정하면 평균 절대 백분율 오차(MAPE)가 {backtest.overall.baseline.toFixed(2)}%,
                  가격·환율·식품지수를 학습한 XGBoost 모델은 {backtest.overall.model.toFixed(2)}%였습니다.
                  이번 검증에서 가격 유지 기준의 오차가 더 낮았습니다. 가격 추이 그래프의 7월 곡선은 이 XGBoost 모델의 결과입니다.
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
                  평가 대상은 {backtest.basis}입니다. {backtest.minimumObservations}회 이상 관측된 경우를 평가했습니다.
                  {backtest.missingMonth && ` ${backtest.missingMonth} 소매가격에는 자료 공백이 있습니다.`}
                </p>
                <p>
                  전체 기간 재학습 {won(backtest.refitRows)}건 ·{" "}
                  <a className={styles.demoLink} href="/downloads/kamis-five-year-model.zip" download>30일 모델과 학습 데이터 다운로드</a>
                </p>
              </div>
            </section>
          </>
        )}
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
