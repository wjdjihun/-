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
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const ticks = months.filter((month) => month % 2 === 1);

function yearlySeries(product: Product) {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const { date, price } of product.history) {
    const key = date.slice(0, 7);
    const total = totals.get(key) ?? { sum: 0, count: 0 };
    total.sum += price;
    total.count += 1;
    totals.set(key, total);
  }

  const years = [...new Set([...totals.keys()].map((key) => key.slice(0, 4)))].sort();
  const data: Record<string, number>[] = months.map((month) => ({ month }));
  const series: { key: string; year: string; gap: boolean }[] = [];

  for (const year of years) {
    let previous: { month: number; value: number } | undefined;
    for (const month of months) {
      const total = totals.get(`${year}-${String(month).padStart(2, "0")}`);
      if (!total || total.count < 3) continue;
      const value = total.sum / total.count;
      const point = data[month - 1];
      if (!previous) series.push({ key: year, year, gap: false });
      point[year] = value;

      if (previous && month - previous.month > 1) {
        // Draw only between measured endpoints. Missing months have no value.
        const key = `${year}-gap-${month}`;
        data[previous.month - 1][key] = previous.value;
        point[key] = value;
        series.push({ key, year, gap: true });
      }
      previous = { month, value };
    }
  }
  return { series, data };
}

export default function AnnualPriceCharts({ products, forecastMonth }: { products: Product[]; forecastMonth: string }) {
  const [charts] = useState(() => products.map((product) => ({ id: product.id, ...yearlySeries(product) })));
  const years = [...new Set(charts.flatMap(({ series }) => series.map(({ year }) => year)))].sort();
  const [shownYears, setShownYears] = useState(() => years.slice(-2));
  const forecastIndex = Number(forecastMonth.slice(5));

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
          <p>같은 달의 평균 소매가격을 연도별로 비교합니다.</p>
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
        <span><i className={styles.gapSwatch} aria-hidden="true" /> 점선 · 실측 자료가 부족한 달</span>
        <span><i className={styles.forecastSwatch} aria-hidden="true" /> {forecastMonth} 예상 월평균</span>
      </div>
      <div className={styles.yearlyGrid}>
        {charts.map(({ id, series, data }) => {
          const { name, unit, variety, estimate } = products.find((product) => product.id === id)!;
          const activeSeries = series.filter(({ year }) => shownYears.includes(year));
          const hasPrice = activeSeries.length > 0 || estimate !== null;
          return (
            <section key={id} id={`price-${id}`} className={`panel ${styles.yearlyCard}`} aria-labelledby={`price-title-${id}`}>
              <div className="panel-heading">
                <div>
                  <h2 id={`price-title-${id}`}>{name} 가격 추이</h2>
                  <p>{variety} · 원 / {unit}</p>
                </div>
              </div>
              <div className={styles.chart}>
                {!hasPrice ? (
                  <p className={styles.emptyChart}>선택한 연도의 관측 가격이 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data} margin={{ top: 12, right: 15, left: 0, bottom: 6 }}>
                      <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="3 4" />
                      <XAxis
                        dataKey="month"
                        type="number"
                        domain={[1, 12]}
                        ticks={ticks}
                        interval={0}
                        tickFormatter={(month) => `${month}월`}
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
                        labelFormatter={(month) => `${month}월 평균`}
                        formatter={(value, label) => [`${won(Number(value))}원 / ${unit}`, label]}
                      />
                      {activeSeries.map(({ key, year, gap }) => (
                        <Line
                          key={key}
                          dataKey={key}
                          type="linear"
                          name={`${year}년 관측`}
                          stroke={yearColors[year]}
                          strokeWidth={2.25}
                          connectNulls={gap}
                          strokeDasharray={gap ? "4 5" : undefined}
                          strokeOpacity={gap ? 0.65 : 1}
                          tooltipType={gap ? "none" : undefined}
                          dot={gap ? false : { r: 2.5 }}
                          isAnimationActive={false}
                        />
                      ))}
                      {estimate !== null && (
                        <ReferenceDot
                          x={forecastIndex}
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
      <p className={styles.yearlyNote}>월평균은 관측일이 3일 이상인 달만 표시합니다. 점선은 앞뒤 관측값을 연결하며, 실제 가격이 없는 달의 값은 표시하지 않습니다.</p>
    </section>
  );
}
