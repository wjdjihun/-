"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import forecast from "@/lib/kamis-forecast.json";
import { won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

type Product = {
  id: string;
  name: string;
  variety: string;
  unit: string;
  history: { date: string; price: number }[];
  nextPrice: number;
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
const months = [0, 2, 4, 6, 8, 10].map((month) => Date.UTC(2000, month, 1));
const maxGap = 14 * 86_400_000;

function yearlySeries(product: Product) {
  const points = new Map<number, Record<string, number>>();
  const series: { key: string; year: string }[] = [];
  let previous = -Infinity;
  let currentYear = "";
  let key = "";

  for (const { date, price } of product.history) {
    const year = date.slice(0, 4);
    const time = comparisonDate(date);

    // Keep holidays within a line and break it across longer gaps in observations.
    if (year !== currentYear || time - previous > maxGap) {
      key = `observed-${series.length}`;
      series.push({ key, year });
      currentYear = year;
    }
    previous = time;
    points.set(time, { ...points.get(time), time, [key]: price });
  }

  const time = comparisonDate(forecast.targetDate);
  points.set(time, { ...points.get(time), time, predicted: product.nextPrice });
  return { series, data: [...points.values()].sort((left, right) => left.time - right.time) };
}

export default function AnnualPriceCharts({ products }: { products: Product[] }) {
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
      {shownYears.includes(forecastYear) && (
        <p className={styles.forecastLegend}>
          <span className={styles.forecastSwatch} aria-hidden="true" />
          2026년 7월 30일 기준 AI 예측 · 7월 27일~8월 2일 평균 예상
        </p>
      )}
      <div className={styles.yearlyGrid}>
        {charts.map(({ id, name, variety, unit, series, data }) => {
          const activeSeries = series.filter(({ year }) => shownYears.includes(year));
          const showForecast = shownYears.includes(forecastYear);
          const activeData = data.filter(
            (point) => (showForecast && point.predicted !== undefined) ||
              activeSeries.some(({ key }) => point[key] !== undefined),
          );
          return (
            <section key={id} id={`price-${id}`} className={`panel ${styles.yearlyCard}`} aria-labelledby={`price-title-${id}`}>
              <div className="panel-heading">
                <div>
                  <h2 id={`price-title-${id}`}>{name} 가격 추이</h2>
                  <p>{variety} · 원 / {unit}</p>
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
                      {activeSeries.map(({ key, year }) => (
                        <Line
                          key={key}
                          dataKey={key}
                          name={`${year}년 관측`}
                          stroke={yearColors[year]}
                          strokeWidth={2.25}
                          connectNulls
                          dot={activeData.filter((point) => point[key] !== undefined).length === 1}
                          isAnimationActive={false}
                        />
                      ))}
                      {showForecast && (
                        <Line
                          dataKey="predicted"
                          name={`${forecastYear}년 AI 예측`}
                          stroke={forecastColor}
                          strokeWidth={0}
                          dot={{ r: 5, fill: forecastColor, stroke: "#fff", strokeWidth: 1.5 }}
                          isAnimationActive={false}
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
      <p className={styles.yearlyNote}>품목별 조사 시기가 다릅니다. 2025년 9월에는 소매가격 자료가 비어 있습니다.</p>
    </section>
  );
}
