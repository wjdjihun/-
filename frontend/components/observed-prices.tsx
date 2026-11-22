"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Minus, Newspaper, Plus, Radar, ShoppingBasket, TrendingUp } from "lucide-react";
import AnnualPriceCharts from "./annual-price-charts";
import EconomicNews from "./economic-news";
import snapshot from "@/lib/kamis-grocery-prices.json";
import adaptiveForecasts from "@/lib/kamis-adaptive-months.json";
import newsAdjustments from "@/lib/kamis-news-adjustments.json";
import { percent } from "@/lib/utils";
import styles from "./observed-prices.module.css";

type NewsAdjustment = {
  factor: number;
  sources: { date: string; publisher: string; url: string; evidence: string }[];
};

const adaptive: Record<string, { products: Record<string, { estimate: number | null }> }> = adaptiveForecasts.months;
const adjustments: Record<string, Record<string, NewsAdjustment>> = newsAdjustments.months;
const availableMonths = Object.keys(adaptive);
const years = [...new Set(availableMonths.map((month) => month.slice(0, 4)))];
const products = snapshot.products;
const initialQuantities = Object.fromEntries(products.map(({ id }) => [id, 1]));
const storageKey = "priceradar.observed.quantities.v2";
const validQuantity = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 999;
const currency = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const priceText = (price: number | null) => price === null ? "자료 부족" : `${currency.format(price)}원`;
const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const adjustPrice = (price: number | null, factor: number) => price === null ? null : Math.round(price * factor * 100) / 100;
const tabs = [
  { id: "dashboard", label: "대시보드", icon: Activity },
  { id: "basket", label: "내 장바구니", icon: ShoppingBasket },
  { id: "news", label: "최신 경제뉴스", icon: Newspaper },
  { id: "outlook", label: "물가 전망", icon: TrendingUp },
] as const;

function NewsSourceList({ sources }: { sources: NewsAdjustment["sources"] }) {
  return (
    <ul>
      {sources.map(({ date, publisher, url, evidence }) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noreferrer">{date} {publisher}</a> · {evidence}
        </li>
      ))}
    </ul>
  );
}

function yearOverYear(current: number, previous: number) {
  const change = current - previous;
  if (Math.abs(change) < 0.005) return "변동 없음";
  return `${currency.format(Math.abs(change))}원 ${change > 0 ? "증가" : "감소"} (${percent(change / previous * 100)})`;
}

export default function ObservedPrices({ tabbed = false }: { tabbed?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const display = (id: typeof tab) => !tabbed || tab === id;

  const [quantities, setQuantities] = useState(initialQuantities);
  const pendingCartFocus = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState("2026-07");
  const result = adaptive[month];
  const title = monthLabel(month);
  const year = month.slice(0, 4);
  const monthsForYear = availableMonths.filter((value) => value.startsWith(year));
  const previousMonth = `${Number(year) - 1}${month.slice(4)}`;
  const rows = products.map((product) => {
    const prior = product.history.filter(({ date }) => date.startsWith(previousMonth));
    const base = result.products[product.id];
    const adjustment = adjustments[month]?.[product.id];
    const factor = adjustment?.factor ?? 1;
    return {
      ...product,
      estimate: adjustPrice(base.estimate, factor),
      sources: factor !== 1 ? adjustment?.sources ?? [] : [],
      quantity: quantities[product.id] ?? 0,
      priorActual: prior.length >= 3 ? prior.reduce((sum, point) => sum + point.price, 0) / prior.length : null,
    };
  });
  const basketRows = rows.filter(({ quantity }) => quantity > 0);
  const unpriced = basketRows.filter(({ estimate, quantity }) => estimate === null && quantity > 0);
  const forecastTotal = rows.reduce((sum, { estimate, quantity }) => sum + (estimate ?? 0) * quantity, 0);
  const priorTotal = rows.some(({ priorActual, quantity }) => priorActual === null && quantity > 0)
    ? null
    : rows.reduce((sum, { priorActual, quantity }) => sum + (priorActual ?? 0) * quantity, 0);

  function updateYear(nextYear: string) {
    const matchingMonth = `${nextYear}${month.slice(4)}`;
    setMonth(adaptive[matchingMonth] ? matchingMonth : availableMonths.find((value) => value.startsWith(nextYear))!);
  }

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (value && typeof value === "object" && !Array.isArray(value)) {
        setQuantities(Object.fromEntries(products.flatMap(({ id }) => {
          const quantity = (value as Record<string, unknown>)[id];
          return validQuantity(quantity) ? [[id, quantity] as const] : [];
        })));
      } else if (value === null) {
        const previous: unknown = JSON.parse(localStorage.getItem("priceradar.observed.quantities.v1") ?? "null");
        if (Array.isArray(previous) && previous.length === 3 && validQuantity(previous[1])) {
          setQuantities({ ...initialQuantities, onion: previous[1] });
        } else if (Array.isArray(previous) && previous.length === 3 && previous[1] === 0) {
          const { onion: _onion, ...rest } = initialQuantities;
          setQuantities(rest);
        }
      }
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

  useLayoutEffect(() => {
    const target = pendingCartFocus.current;
    if (target === null) return;
    pendingCartFocus.current = null;
    document.getElementById(target)?.focus();
  }, [quantities]);

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

  function updateQuantity(id: string, quantity: number) {
    if (validQuantity(quantity)) setQuantities((current) => ({ ...current, [id]: quantity }));
  }

  function removeItem(id: string) {
    setQuantities((current) => {
      const remaining = { ...current };
      delete remaining[id];
      return remaining;
    });
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
              <p>{snapshot.market} · {snapshot.grade} 등급</p>
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
            {tabbed && (
              <section className={`panel ${styles.dashboardBasket}`} aria-label="예상 식자재비">
                <div>
                  <p>{title} {unpriced.length ? "단가 확인 품목 소계" : "예상 식자재비"}</p>
                  <strong aria-live="polite">{priceText(forecastTotal)}</strong>
                  <p>{unpriced.length
                    ? `${unpriced.map(({ name }) => name).join("·")} 단가 자료 부족`
                    : `같은 구매량으로 작년 대비 ${priorTotal === null ? "비교 자료 부족" : yearOverYear(forecastTotal, priorTotal)}`}</p>
                </div>
                <a className={styles.serviceAction} href="#basket">내 장바구니에서 수량 바꾸기</a>
              </section>
            )}
            <div className={styles.cards} aria-label={`${title} 품목별 예상 단가`}>
              {rows.map(({ id, name, unit, variety, estimate, sources }) => (
                <article key={id} className={`stat-card ${styles.card}`}>
                  <a className={`stat-label ${styles.cardTitle}`} href={tabbed ? "#outlook" : `#price-${id}`}>
                    {name} <span>{unit}</span>
                  </a>
                  <span className={`stat-value ${styles.cardValue}`}>{priceText(estimate)}</span>
                  {variety !== name && <span className={styles.cardSpec}>{variety}</span>}
                  {sources.length > 0 && (
                    <details className={`${styles.cardEvidence} ${styles.newsSources}`}>
                      <summary>{name} 예측에 참고한 기사</summary>
                      <NewsSourceList sources={sources} />
                    </details>
                  )}
                </article>
              ))}
            </div>
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
              <div className={styles.addItems} aria-label="장바구니에 담을 수 있는 품목">
                {rows.filter(({ quantity }) => !quantity).map(({ id, name, unit }) => (
                  <button
                    key={id} id={`add-item-${id}`} type="button" className={styles.yearButton}
                    aria-label={`${name} 장바구니에 담기`}
                    onClick={(event) => {
                      if (document.activeElement === event.currentTarget) pendingCartFocus.current = `quantity-${id}`;
                      updateQuantity(id, 1);
                    }}
                  >
                    <Plus size={14} aria-hidden="true" /> {name} · {unit}
                  </button>
                ))}
              </div>
              {basketRows.length === 0 && <p className={styles.forecastNote}>담긴 품목이 없습니다. 위에서 식자재를 담아 주세요.</p>}
              {basketRows.length > 0 && (
                <div className={styles.validationScroll}>
                  <table className={styles.validationTable} aria-label="장바구니 품목별 예상 단가와 작년 대비 증감">
                    <thead>
                      <tr><th scope="col">품목</th><th scope="col">{monthLabel(previousMonth)} 실제</th><th scope="col">{title} 예상</th><th scope="col">작년 대비</th></tr>
                    </thead>
                    <tbody>
                      {basketRows.map(({ id, name, unit, priorActual, estimate }) => (
                        <tr key={id}>
                          <th scope="row">{name} · {unit}</th>
                          <td>{priceText(priorActual)}</td><td>{priceText(estimate)}</td>
                          <td>{estimate !== null && priorActual !== null ? yearOverYear(estimate, priorActual) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {basketRows.map(({ id, name, unit, quantity, estimate }) => (
                <div className={styles.basketRow} key={id}>
                  <label htmlFor={`quantity-${id}`}>
                    <strong>{name}</strong><span>월 구매량 · {unit} 단위</span>
                  </label>
                  <div className={styles.quantityControl}>
                    <button type="button" aria-label={`${name} 수량 줄이기`} disabled={quantity === 1} onClick={() => updateQuantity(id, quantity - 1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <input id={`quantity-${id}`} aria-label={`${name} 월 구매량 (${unit} 단위)`}
                      type="number" min="1" max="999" step="1" value={quantity}
                      onChange={(event) => updateQuantity(id, event.currentTarget.valueAsNumber)} />
                    <button type="button" aria-label={`${name} 수량 늘리기`} disabled={quantity === 999} onClick={() => updateQuantity(id, quantity + 1)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <strong>{priceText(estimate === null ? null : estimate * quantity)}</strong>
                  <button
                    type="button" className={styles.removeItem} aria-label={`${name} 장바구니에서 빼기`}
                    onClick={(event) => {
                      if (document.activeElement === event.currentTarget) pendingCartFocus.current = `add-item-${id}`;
                      removeItem(id);
                    }}
                  >
                    빼기
                  </button>
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
        {display("outlook") && <AnnualPriceCharts products={rows} forecastMonth={month} />}

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
