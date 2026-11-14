"use client";
import {
  Activity,
  CalendarDays,
  Database,
  FileText,
  FlaskConical,
  Info,
  Layers3,
  Newspaper,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  ShoppingBasket,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Dataset, ModelMetrics } from "@/types";
import { cn } from "@/lib/utils";
import { BacktestChart } from "./charts";
export default function ModelPage({
  metrics,
  data,
}: {
  metrics: ModelMetrics | null;
  data: Dataset;
}) {
  const trained = metrics?.status === "trained";
  return (
    <>
      <div className="model-status">
        <span className="model-status-icon">
          <FlaskConical size={25} />
        </span>
        <div>
          <h2>
            {trained ? "학습된 모델의 평가 결과" : "현재 모델은 학습 전입니다"}
          </h2>
          <p>
            {trained
              ? "학습 산출물에서 불러온 지표입니다. 학습 데이터 출처와 기간을 함께 확인하세요."
              : "웹앱의 가격 전망은 합성 데이터의 시연 비율을 사용합니다. 실제 모델 성능을 의미하지 않습니다."}
          </p>
        </div>
        <span className="tag-neutral">{trained ? "평가 완료" : "미학습"}</span>
      </div>
      <div className="model-flow panel">
        <div className="panel-heading">
          <div>
            <h2>가격 예측 파이프라인</h2>
            <p>현재의 경제 신호를 30일 후 품목 가격으로 연결합니다.</p>
          </div>
        </div>
        <div className="pipeline">
          <div>
            <span>
              <Database size={23} />
            </span>
            <b>데이터 수집</b>
            <small>가격 · 환율 · 원자재</small>
          </div>
          <ChevronRight size={20} />
          <div>
            <span>
              <Newspaper size={23} />
            </span>
            <b>뉴스 구조화</b>
            <small>품목 · 이벤트 · 시차</small>
          </div>
          <ChevronRight size={20} />
          <div>
            <span>
              <Layers3 size={23} />
            </span>
            <b>시계열 피처</b>
            <small>과거 값 · 계절 · 뉴스</small>
          </div>
          <ChevronRight size={20} />
          <div>
            <span>
              <Sparkles size={23} />
            </span>
            <b>XGBoost 회귀</b>
            <small>30일 후 가격 · 범위</small>
          </div>
        </div>
      </div>
      <div className="news-stat-grid model-stats">
        <MiniStat
          icon={CalendarDays}
          label="학습 데이터 기간"
          value={trained ? metrics.period || "산출물 참조" : "미등록"}
        />
        <MiniStat
          icon={Database}
          label="학습 데이터 수"
          value={trained ? `${metrics.rows || 0}건` : "0건"}
        />
        <MiniStat
          icon={FileText}
          label={data.mode === "demo" ? "시연 관측 데이터" : "화면 관측 데이터"}
          value={`${Object.values(data.history).reduce((s, h) => s + h.length, 0)}건`}
        />
        <MiniStat icon={ShieldCheck} label="검증 방식" value="시계열 분리" />
      </div>
      <div className="panel model-comparison">
        <div className="panel-heading">
          <div>
            <h2>모델 성능 비교</h2>
            <p>동일한 테스트 기간에서 뉴스 피처의 추가 효과를 검증합니다.</p>
          </div>
          <span className="tag-neutral">낮을수록 좋은 지표</span>
        </div>
        <div className="table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                <th>모델</th>
                <th>입력 데이터</th>
                <th>MAE (원)</th>
                <th>RMSE (원)</th>
                <th>MAPE (%)</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: "baseline", name: "기준 모델", input: "현재 가격 유지" },
                {
                  id: "model_a",
                  name: "모델 A",
                  input: "과거 가격 + 경제지표",
                },
                {
                  id: "model_b",
                  name: "모델 B",
                  input: "과거 가격 + 경제지표 + 뉴스",
                },
              ].map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.name}</b>
                    {m.id === "model_b" && (
                      <span className="model-badge">뉴스 포함</span>
                    )}
                  </td>
                  <td>{m.input}</td>
                  {(["MAE", "RMSE", "MAPE"] as const).map((k) => (
                    <td key={k}>
                      {trained && metrics.models[m.id]
                        ? metrics.models[m.id][k].toFixed(2)
                        : "—"}
                    </td>
                  ))}
                  <td>
                    <span className="tag-neutral">
                      {trained ? "평가 완료" : "미평가"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart-bottom">
          <Info size={14} />
          {trained
            ? `뉴스 피처 추가에 따른 MAPE 변화: ${metrics.news_improvement_mape?.toFixed(2) ?? "—"}%p (A − B). 음수이면 성능 저하입니다.`
            : "실제 학습·평가 결과가 없어 성능 수치를 표시하지 않습니다."}
        </div>
      </div>
      <div className="panel model-backtest">
        <div className="panel-heading">
          <div>
            <h2>실제 가격과 예측 가격 비교</h2>
            <p>
              {trained && metrics.backtest?.length
                ? `${data.products.find((p) => p.id === metrics.backtest![0].product_id)?.name || metrics.backtest[0].product_id} · 독립 테스트 기간`
                : "실제 학습·평가 자료가 등록되면 그래프를 표시합니다."}
            </p>
          </div>
        </div>
        {trained && metrics.backtest?.length ? (
          <>
            <div className="chart-legend">
              <span>
                <i className="legend-line" /> 실제 가격
              </span>
              <span>
                <i className="legend-line dashed" /> 모델 예측
              </span>
            </div>
            <BacktestChart points={metrics.backtest} />
          </>
        ) : (
          <div className="empty">
            <Activity size={30} />
            <h3>아직 비교할 평가 결과가 없어요</h3>
            <p>
              모델 학습 전에는 임의의 실제값·예측값 그래프를 만들지 않습니다.
            </p>
          </div>
        )}
      </div>
      <div className="model-details-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>주요 입력 피처</h2>
              <p>모델 학습 시 사용하는 피처 그룹</p>
            </div>
          </div>
          <div className="feature-list">
            {[
              {
                label: "과거 가격",
                desc: "현재·7·14·30일 전 가격, 이동평균",
                icon: Activity,
              },
              {
                label: "경제·계절 지표",
                desc: "환율, 원자재, 월·계절",
                icon: TrendingUp,
              },
              {
                label: "경제뉴스 신호",
                desc: "품목별 상승·하락, 공급·수요 신호",
                icon: Newspaper,
              },
            ].map((f) => (
              <div key={f.label}>
                <span className="icon-soft">
                  <f.icon size={18} />
                </span>
                <div>
                  <b>{f.label}</b>
                  <small>{f.desc}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="muted model-note">
            {trained && metrics.feature_importance
              ? Object.entries(metrics.feature_importance)
                  .slice(0, 5)
                  .map(([k, v]) => (
                    <div className="importance-row" key={k}>
                      <span>{k}</span>
                      <meter min={0} max={1} value={v} />
                      <b>{(v * 100).toFixed(1)}%</b>
                    </div>
                  ))
              : "피처 중요도는 모델 학습 후 실제 산출물로 표시됩니다."}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>평가 원칙과 데이터 관리</h2>
              <p>미래 데이터를 보지 않는 예측을 위해</p>
            </div>
          </div>
          <ul className="principles">
            <li>
              <ShieldCheck size={18} />
              <div>
                <b>시간 순서를 지키는 검증</b>
                <p>
                  학습·검증·테스트의 예측 목표 기간이 겹치지 않도록 분리합니다.
                </p>
              </div>
            </li>
            <li>
              <ShieldCheck size={18} />
              <div>
                <b>기준일 이후 정보 차단</b>
                <p>
                  뉴스 발행일과 경제지표 관측일이 예측 기준일을 넘지 않도록
                  제한합니다.
                </p>
              </div>
            </li>
            <li>
              <ShieldCheck size={18} />
              <div>
                <b>불확실성을 함께 제공</b>
                <p>
                  검증 잔차로 산출한 범위를 사용하며, 보장된 가격으로 안내하지
                  않습니다.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
      {!trained && (
        <div className="info-box">
          <Info size={20} />
          <div>
            <b>다음 개발 단계</b>
            <p>
              공식 데이터 수집 → 날짜·규격 정합성 확인 → 모델 학습 → 테스트 지표
              확인 → API 추론을 연결하세요. 설치 및 학습 명령은 프로젝트
              README에 정리되어 있습니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="mini-stat">
      <span className={cn("icon-soft", color)}>
        <Icon size={20} />
      </span>
      <div>
        <span>{label}</span>
        <b className={color}>{value}</b>
      </div>
    </div>
  );
}
