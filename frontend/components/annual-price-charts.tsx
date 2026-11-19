"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import forecast from "@/lib/kamis-forecast.json";
import trends from "@/lib/kamis-trends.json";
import { won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

type Product = {
  id: string;
  name: string;
  variety: string;
  unit: string;
  history: { date: string; price: number }[];
};

const yearColors: Record<string, string> = {
  "2021": "#6b7280",
  "2022": "#087f60",
  "2023": "#a03464",
  "2024": "#655b15",
  "2025": "#3067e9",
  "2026": "#803ac1",
};
const forecastYear = forecast.targetDate.slice(0, 4);
const forecastColor = "#bd5f18";
const comparisonDate = (date: string) => Date.parse(`2000${date.slice(4)}T00:00:00Z`);
const forecastTime = comparisonDate(forecast.targetDate);
const months = [0, 2, 4, 6, 8, 10].map((month) => Date.UTC(2000, month, 1));
const maxGap = 14 * 86_400_000;

function yearlySeries(product: Product) {
  const points = new Map<number, Record<string, number>>();
  const series: { key: string; year: string; kind: "observed" | "gap" | "outlook"; count: number }[] = [];
  let previous = -Infinity;
  let currentYear = "";
  let key = "";

  for (const { date, price } of product.history) {
    const year = date.slice(0, 4);
    const time = comparisonDate(date);

    // Keep holidays within a line and break it across longer gaps in observations.
    if (year !== currentYear || time - previous > maxGap) {
      key = `observed-${series.length}`;
      series.push({ key, year, kind: "observed", count: 0 });
      currentYear = year;
    }
    series[series.length - 1].count += 1;
    previous = time;
    points.set(time, { ...points.get(time), time, [key]: price });
  }

  const { gaps, outlook } = trends[product.id as keyof typeof trends];
  for (const [index, gap] of gaps.entries()) {
    addEstimates(gap, `gap-${index}`, "gap");
  }
  addEstimates(outlook, "outlook", "outlook");

  function addEstimates(
    estimates: Product["history"],
    key: string,
    kind: "gap" | "outlook",
  ) {
    if (!estimates.length) return;
    series.push({ key, year: estimates[0].date.slice(0, 4), kind, count: estimates.length });
    for (const { date, price } of estimates) {
      const time = comparisonDate(date);
      points.set(time, { ...points.get(time), time, [key]: price });
    }
  }

  return { series, data: [...points.values()].sort((left, right) => left.time - right.time) };
}

export default function AnnualPriceCharts({ products, showJulyForecast = true }: { products: Product[]; showJulyForecast?: boolean }) {
  const [charts] = useState(() => products.map((product) => ({ ...product, ...yearlySeries(product) })));
  const years = [...new Set(charts.flatMap(({ series }) => series.map(({ year }) => year)))].sort();
  const [shownYears, setShownYears] = useState(() => years.slice(-2));

  function toggleYear(year: string) {
    setShownYears((shown) => {
      if (!shown.includes(year)) return [...shown, year];
      return shown.length > 1 ? shown.filter((value) => value !== year) : shown;
    });
  }

  return (
    <section className={styles.yearly} id="yearly-prices" aria-labelledby="yearly-title">
      <div className={styles.yearlyHeader}>
        <div>
          <h2 id="yearly-title">생필품 연도별 가격 추이</h2>
          <p>2026년 6월 30일을 기준으로 과거 같은 월·일의 소매가격을 비교합니다.</p>
        </div>
        <div className={styles.yearControls} role="group" aria-label="그래프에 표시할 연도">
          {years.map((year) => (
            <button
              type="button"
              key={year}
              className={styles.yearButton}
              aria-pressed={shownYears.includes(year)}
              disabled={shownYears.length === 1 && shownYears.includes(year)}
              onClick={() => toggleYear(year)}
            >
              <span className={styles.yearSwatch} style={{ backgroundColor: yearColors[year] }} aria-hidden="true" />
              {year}년
            </button>
          ))}
        </div>
      </div>
      <div className={styles.chartLegend}>
        <span><i className={styles.gapSwatch} aria-hidden="true" /> 관측 공백의 AI 추정</span>
        {showJulyForecast && shownYears.includes(forecastYear) && (
          <span><i className={styles.forecastSwatch} aria-hidden="true" /> 2026년 7월 AI 예측 · 각 날짜 전후 7일 평균</span>
        )}
      </div>
      <div className={styles.yearlyGrid}>
        {charts.map(({ id, name, variety, unit, series, data }) => {
          const activeSeries = series.filter(({ year, kind }) => shownYears.includes(year) && (showJulyForecast || kind !== "outlook"));
          const missingYears = years.filter((year) =>
            shownYears.includes(year) && !activeSeries.some((line) => line.year === year),
          );
          const showForecast = showJulyForecast && shownYears.includes(forecastYear);
          const activeData = data.filter(
            (point) => activeSeries.some(({ key }) => point[key] !== undefined),
          );
          return (
            <section key={id} id={`price-${id}`} className={`panel ${styles.yearlyCard}`} aria-labelledby={`price-title-${id}`}>
              <div className="panel-heading">
                <div>
                  <h2 id={`price-title-${id}`}>{name} 가격 추이</h2>
                  <p>{variety} · 원 / {unit}</p>
                  {missingYears.length > 0 && <p>{missingYears.join("·")}년 동일 규격 관측 자료 없음</p>}
                </div>
              </div>
              <div className={styles.chart}>
                {activeData.length === 0 ? (
                  <p className={styles.emptyChart}>선택한 연도의 관측 가격이 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={activeData} margin={{ top: 12, right: 15, left: 0, bottom: 6 }}>
                      <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="3 4" />
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={[Date.UTC(2000, 0, 1), Date.UTC(2000, 11, 31)]}
                        ticks={months}
                        interval={0}
                        tickFormatter={(time) => `${new Date(time).getUTCMonth() + 1}월`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#66768a" }}
                      />
                      <YAxis
                        width={52}
                        domain={["auto", "auto"]}
                        tickFormatter={won}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#66768a" }}
                      />
                      <Tooltip
                        labelFormatter={(time) => {
                          const date = new Date(Number(time));
                          return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
                        }}
                        formatter={(value, label) => [`${won(Number(value))}원 / ${unit}`, label]}
                      />
                      {showForecast && <ReferenceLine x={Date.UTC(2000, 6, 1)} stroke="#a8b3c5" strokeDasharray="4 4" />}
                      {activeSeries.map(({ key, year, kind, count }) => (
                        <Line
                          key={key}
                          dataKey={key}
                          type={kind === "observed" ? "linear" : "monotoneX"}
                          name={`${year}년 ${kind === "observed" ? "관측" : kind === "gap" ? "공백 AI 추정" : "AI 예측 (7일 평균)"}`}
                          stroke={kind === "outlook" ? forecastColor : yearColors[year]}
                          strokeDasharray={kind === "observed" ? undefined : "4 4"}
                          strokeWidth={2.25}
                          connectNulls
                          dot={count === 1}
                          isAnimationActive={false}
                        />
                      ))}
                      {showForecast && (
                        <ReferenceDot
                          x={forecastTime}
                          y={forecast.prices[id as keyof typeof forecast.prices]}
                          r={4.5}
                          fill={forecastColor}
                          stroke="#fff"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className={styles.yearlyNote}>
        2025년 9월 등 일부 공백은 모델 추정치를 앞뒤 관측값에 맞춰 이었습니다. 봄배추처럼 조사 시기가 제한된 품목은 긴 공백을 그대로 표시합니다.
      </p>
      {shownYears.includes("2021") && (
        <p className={styles.yearlyNote}>
          2021년 상반기 관측은 그래프 비교용이며, 모델 학습은 2021년 7월부터입니다.{" "}
          <a className={styles.demoLink} href="https://data.mafra.go.kr/opendata/data/indexOpenDataDetail.do?data_id=20251017000000002761">
            KAMIS 과거 자료
          </a>
        </p>
      )}
    </section>
  );
}
