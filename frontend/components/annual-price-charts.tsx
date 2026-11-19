"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { won } from "@/lib/utils";
import styles from "./observed-prices.module.css";

type Product = {
  id: string;
  name: string;
  variety: string;
  unit: string;
  estimate: number | null;
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
const forecastColor = "#bd5f18";
const comparisonDate = (date: string) => Date.parse(`2000${date.slice(4)}T00:00:00Z`);
const months = [0, 2, 4, 6, 8, 10].map((month) => Date.UTC(2000, month, 1));
const maxGap = 14 * 86_400_000;

function yearlySeries(product: Product) {
  const points = new Map<number, Record<string, number>>();
  const series: { key: string; year: string; count: number }[] = [];
  let previous = -Infinity;
  let currentYear = "";
  let key = "";

  for (const { date, price } of product.history) {
    const year = date.slice(0, 4);
    const time = comparisonDate(date);

    // Keep holidays within a line and break it across longer gaps in observations.
    if (year !== currentYear || time - previous > maxGap) {
      key = `observed-${series.length}`;
      series.push({ key, year, count: 0 });
      currentYear = year;
    }
    series[series.length - 1].count += 1;
    previous = time;
    points.set(time, { ...points.get(time), time, [key]: price });
  }

  return { series, data: [...points.values()].sort((left, right) => left.time - right.time) };
}

export default function AnnualPriceCharts({ products, forecastMonth }: { products: Product[]; forecastMonth: string }) {
  const [charts] = useState(() => products.map((product) => ({ id: product.id, ...yearlySeries(product) })));
  const years = [...new Set(charts.flatMap(({ series }) => series.map(({ year }) => year)))].sort();
  const [shownYears, setShownYears] = useState(() => years.slice(-2));
  const forecastTime = comparisonDate(`${forecastMonth}-15`);

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
        <span><i className={styles.forecastSwatch} aria-hidden="true" /> {forecastMonth} 예상 월평균 · 주황색 점</span>
      </div>
      <div className={styles.yearlyGrid}>
        {charts.map(({ id, series, data }) => {
          const { name, unit, variety, estimate } = products.find((product) => product.id === id)!;
          const activeSeries = series.filter(({ year }) => shownYears.includes(year));
          const activeData = data.filter(
            (point) => activeSeries.some(({ key }) => point[key] !== undefined),
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
                      {activeSeries.map(({ key, year, count }) => (
                        <Line
                          key={key}
                          dataKey={key}
                          type="linear"
                          name={`${year}년 관측`}
                          stroke={yearColors[year]}
                          strokeWidth={2.25}
                          connectNulls
                          dot={count === 1}
                          isAnimationActive={false}
                        />
                      ))}
                      {estimate !== null && (
                        <ReferenceDot
                          x={forecastTime}
                          y={estimate}
                          ifOverflow="extendDomain"
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
      <p className={styles.yearlyNote}>2025년 9월처럼 조사 자료가 없는 구간은 공백으로 표시합니다.</p>
    </section>
  );
}
