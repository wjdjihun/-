"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Layers3, Newspaper, Radar, ShoppingBasket, TrendingUp } from "lucide-react";
import AnnualPriceCharts from "./annual-price-charts";
import EconomicNews from "./economic-news";
import snapshot from "@/lib/kamis-prices.json";
import backtest from "@/lib/kamis-backtest.json";
import monthly from "@/lib/kamis-monthly.json";
import { percent, won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

const products = snapshot.products.map((product) => ({
  ...product,
  nextPrice: monthly.prices[product.id as keyof typeof monthly.prices],
  priorJuly: monthly.priorJuly[product.id as keyof typeof monthly.priorJuly],
  latest: product.history[product.history.length - 1],
}));
const initialQuantities = products.map(() => 1);
const storageKey = "priceradar.observed.quantities.v1";
const sourceDate = products.map(({ latest }) => latest.date).sort().at(-1);

const tabs = [
  { id: "dashboard", label: "대시보드", icon: Activity },
  { id: "basket", label: "내 장바구니", icon: ShoppingBasket },
  { id: "news", label: "경제뉴스", icon: Newspaper },
  { id: "outlook", label: "물가 전망", icon: TrendingUp },
  { id: "model", label: "AI 모델 분석", icon: Layers3 },
] as const;

function yearOverYear(current: number, previous: number) {
  const change = current - previous;
  if (!change) return "변동 없음";
  return `${won(Math.abs(change))}원 ${change > 0 ? "증가" : "감소"} (${percent(change / previous * 100)})`;
}

export default function ObservedPrices({ tabbed = false }: { tabbed?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const display = (id: typeof tab) => !tabbed || tab === id;

  const [quantities, setQuantities] = useState(initialQuantities);
  const [ready, setReady] = useState(false);
  const priorTotal = products.reduce(
    (sum, item, i) => sum + item.priorJuly.actual * quantities[i],
    0,
  );

  const forecastTotal = products.reduce(
    (sum, item, i) => sum + item.nextPrice * quantities[i],
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
        {display("dashboard") && (
          <>
            <section className="dashboard-hero">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> KAMIS 소매 조사
                </div>
                <h1>우리 장바구니 <span>2026년 7월 예상 가격</span></h1>
                <p>{snapshot.market} · {snapshot.grade} 등급 · 예측 기준일 {sourceDate}</p>
              </div>
            </section>

            <div className={styles.cards} aria-label="품목별 최근 조사 가격">
              {products.map((item) => (
                <a
                  href={tabbed ? "#outlook" : `#price-${item.id}`}
                  key={item.id}
                  className={`stat-card ${styles.card}`}
                >
                  <span className="stat-label">{item.name} <span>{item.unit}</span></span>
                  <span className={`stat-value ${styles.cardValue}`}>
                    {won(tabbed ? item.nextPrice : item.latest.price)}<span>원</span>
                  </span>
                  {tabbed ? (
                    <>
                      <span className={styles.cardSpec}>{item.variety} · 7월 AI 예상 평균</span>
                      <span className={styles.forecastPrice}>{yearOverYear(item.nextPrice, item.priorJuly.actual)}</span>
                </>
              ) : (
                <>
                  <span className={styles.cardSpec}>{item.variety} · {item.latest.date} 관측</span>
                  <span className={styles.forecastPrice}>7월 평균 예상 <strong>{won(item.nextPrice)}원</strong></span>
                </>
              )}
            </a>
          ))}
        </div>

        {tabbed && (
          <section className={`panel ${styles.dashboardBasket}`} aria-label="예상 생필품비">
            <div>
              <p>2026년 7월 예상 생필품비</p>
              <strong aria-live="polite">{won(forecastTotal)}원</strong>
              <p>같은 구매량으로 작년 대비 {yearOverYear(forecastTotal, priorTotal)}</p>
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
                <h2 id="basket-title"><ShoppingBasket size={17} /> 7월 장바구니</h2>
                <p>7월 한 달에 살 수량을 입력하면 작년 7월과 같은 수량 기준으로 비교합니다.</p>
              </div>
            </div>
            <div className={styles.basket}>
              <div className={styles.validationScroll}>
                <table className={styles.validationTable} aria-label="품목별 7월 평균 단가와 작년 대비 증감">
                  <thead>
                    <tr><th scope="col">품목</th><th scope="col">2025년 7월 실제</th><th scope="col">2026년 7월 AI 예상</th><th scope="col">작년 대비</th></tr>
                  </thead>
                  <tbody>
                    {products.map(({ id, name, unit, priorJuly, nextPrice }) => (
                      <tr key={id}>
                        <th scope="row">{name} · {unit}</th>
                        <td>{won(priorJuly.actual)}원</td><td>{won(nextPrice)}원</td>
                        <td>{yearOverYear(nextPrice, priorJuly.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {products.map((item, index) => (
                <div className={styles.basketRow} key={item.id}>
                  <label htmlFor={`quantity-${item.id}`}>
                    <strong>{item.name}</strong>
                    <span>월 구매량 · {item.unit} 단위</span>
                  </label>
                  <input
                    id={`quantity-${item.id}`}
                    aria-label={`${item.name} 월 구매량 (${item.unit} 단위)`}
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    value={quantities[index]}
                    onChange={(event) => updateQuantity(index, event.currentTarget.value)}
                  />
                  <strong>{won(item.nextPrice * quantities[index])}원</strong>
                </div>
              ))}
              <div className={styles.total} aria-live="polite">
                <span>2025년 7월 가격으로 계산</span><strong>{won(priorTotal)}원</strong>
              </div>
              <div className={`${styles.total} ${styles.forecastPrice}`} aria-live="polite">
                <span>2026년 7월 예상 생필품비</span><strong>{won(forecastTotal)}원</strong>
              </div>
              <p className={styles.forecastNote} aria-live="polite">
                작년 7월 대비 {yearOverYear(forecastTotal, priorTotal)}
              </p>
            </div>
          </section>
        )}
        {tabbed && tab === "news" && <EconomicNews />}
        {display("outlook") && <AnnualPriceCharts products={products} />}

        {display("model") && (
          <>
            <section className={`panel ${styles.validation}`} id="july-validation" aria-labelledby="july-validation-title">
              <div className="panel-heading">
                <div>
                  <h2 id="july-validation-title">작년 7월 예측 검증</h2>
                  <p>2025년 6월까지 확보한 자료로 모델을 학습하고, 2025년 7월 실제 평균과 비교했습니다.</p>
                </div>
              </div>
              <div className={styles.validationBody}>
                <div className={styles.validationScroll}>
                  <table className={styles.validationTable}>
                    <thead>
                      <tr><th scope="col">품목</th><th scope="col">7월 실제 평균</th><th scope="col">7월 AI 예측</th><th scope="col">AI 오차</th><th scope="col">6월 평균 기준 오차</th></tr>
                    </thead>
                    <tbody>
                      {products.map(({ id, name, priorJuly }) => (
                        <tr key={id}>
                          <th scope="row">{name}</th>
                          <td>{won(priorJuly.actual)}원 ({priorJuly.count}일)</td>
                          <td>{won(priorJuly.forecast)}원</td>
                          <td>{percent(Math.abs(priorJuly.forecast - priorJuly.actual) / priorJuly.actual * 100).replace("+", "")}</td>
                          <td>{percent(Math.abs(priorJuly.previousMonth - priorJuly.actual) / priorJuly.actual * 100).replace("+", "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>월평균은 KAMIS 조사일 가격의 평균입니다. 2026년 7월 단가는 월평균을 목표로 학습한 XGBoost 모델로 계산했습니다.</p>
                <p>학습 기간 {backtest.sourceStart}~{sourceDate} · 월 학습 사례 {monthly.trainingCount}건 · 전년도 검증 학습 사례 {monthly.validationCount}건</p>
                <p>모델 입력은 최근 가격, 작년 같은 달 평균, 계절, 원·달러 환율, 세계은행 식품지수입니다.</p>
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
