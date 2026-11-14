"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  Layers3,
  Lightbulb,
  LoaderCircle,
  Minus,
  Newspaper,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  BasketItem,
  Dataset,
  News,
  Page,
  Product,
  ModelMetrics,
} from "@/types";
import {
  API_URL,
  demo,
  getBasketAPI,
  loadData,
  saveBasketAPI,
} from "@/lib/api";
import {
  defaultBasket,
  parseBasket,
  predictedPrice,
  totals,
} from "@/lib/basket";
import { cn, dateLabel, percent, won } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { ForecastChart, NewsVolumeChart } from "./charts";
import ModelPage from "./model-page";

const nav: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "대시보드", icon: Activity },
  { id: "basket", label: "내 장바구니", icon: ShoppingBasket },
  { id: "news", label: "경제뉴스", icon: Newspaper },
  { id: "outlook", label: "물가 전망", icon: TrendingUp },
  { id: "model", label: "AI 모델 분석", icon: Layers3 },
];
const categories = [
  "전체",
  "곡류",
  "채소",
  "과일",
  "축산물",
  "유제품",
  "수산물",
];
const STORAGE_KEY = "priceradar.basket.v1";
function Change({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "change",
        value >= 0 ? "up" : "down",
        large && "change-large",
      )}
    >
      {value >= 0 ? (
        <ArrowUpRight size={large ? 18 : 14} />
      ) : (
        <ArrowDownRight size={large ? 18 : 14} />
      )}{" "}
      {percent(value)}
    </span>
  );
}
function ProductIcon({
  product,
  small = false,
}: {
  product: Product;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "product-icon",
        `product-${product.id}`,
        small && "product-small",
      )}
    >
      {product.emoji}
    </span>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default function PriceRadar() {
  const [data, setData] = useState<Dataset>(demo);
  const [page, setPage] = useState<Page>("dashboard");
  const [items, setItems] = useState<BasketItem[]>(
    defaultBasket(demo.products),
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [newsProduct, setNewsProduct] = useState("all");
  const [signal, setSignal] = useState("all");
  const [event, setEvent] = useState("all");
  const [since, setSince] = useState("");
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [selectedId, setSelectedId] = useState("cabbage");
  const [ranking, setRanking] = useState("up");
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const total = useMemo(
    () => totals(items, data.products),
    [items, data.products],
  );
  const forecastWord = data.mode === "demo" ? "시연" : "모델";
  const selected =
    data.products.find((p) => p.id === selectedId) || data.products[0];
  const basketProducts = data.products.filter((p) =>
    items.some((i) => i.product_id === p.id),
  );
  const filteredNews = data.news.filter(
    (n) =>
      (newsProduct === "all" || n.product_ids.includes(newsProduct)) &&
      (signal === "all" || n.direction === signal) &&
      (event === "all" || n.event === event) &&
      (!since || n.published_at.slice(0, 10) >= since),
  );
  const activeProducts = data.products.filter((p) =>
    items.some((i) => i.product_id === p.id),
  );
  const rising = [...activeProducts].sort((a, b) => b.change - a.change)[0];
  const falling = [...activeProducts].sort((a, b) => a.change - b.change)[0];
  useEffect(() => {
    let alive = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseBasket(JSON.parse(stored), demo.products);
        if (parsed) setItems(parsed);
        else
          setError(
            "저장된 장바구니 형식을 확인할 수 없어 기본 장바구니를 불러왔습니다.",
          );
      }
    } catch {
      setError("이 브라우저에서는 장바구니 저장소를 사용할 수 없습니다.");
    }
    const syncHash = () => {
      const id = location.hash.replace("#", "") as Page;
      if (nav.some((n) => n.id === id)) setPage(id);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    if (API_URL) {
      setLoading(true);
      loadData()
        .then(async (result) => {
          if (!alive) return;
          setData(result);
          try {
            const savedBasket = await getBasketAPI();
            const valid = parseBasket(savedBasket.items, result.products);
            if (alive && valid) setItems(valid);
          } catch {
            if (alive)
              setError(
                "API 장바구니를 불러오지 못했습니다. 현재 브라우저의 장바구니를 사용합니다.",
              );
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "API 연결에 실패해 시연 데이터로 전환했습니다. 서버 주소와 연결 상태를 확인해 주세요.",
            );
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (page === "model" && API_URL) {
      fetch(`${API_URL}/api/model/metrics`)
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then(setMetrics)
        .catch(() =>
          setError(
            "모델 지표를 불러오지 못했습니다. 평가 상태를 확인할 수 없습니다.",
          ),
        );
    }
  }, [page]);
  function go(id: Page) {
    setPage(id);
    location.hash = id;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function update(id: string, patch: Partial<BasketItem>) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, ...patch } : i)),
    );
    setSaved(false);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== id));
    setSaved(false);
    setNotice(
      "장바구니에서 품목을 삭제했습니다. 품목 추가로 다시 담을 수 있어요.",
    );
  }
  function add(p: Product) {
    setItems((prev) =>
      prev.some((i) => i.product_id === p.id)
        ? prev
        : [...prev, { product_id: p.id, quantity: 1, current_price: p.price }],
    );
    setSaved(false);
    setNotice(`${p.name}을(를) 장바구니에 담았습니다.`);
  }
  async function save() {
    setSaving(true);
    try {
      if (API_URL) await saveBasketAPI(items);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setSaved(true);
      setNotice(
        API_URL
          ? "장바구니를 서버와 이 브라우저에 저장했습니다."
          : "장바구니를 이 브라우저에 저장했습니다.",
      );
    } catch {
      setError(
        "장바구니를 저장하지 못했습니다. 서버 또는 브라우저 저장 권한을 확인해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function refresh() {
    setLoading(true);
    try {
      setData(await loadData());
      setNotice(
        API_URL
          ? "서버에서 데이터를 다시 불러왔습니다."
          : `${data.reference_date} 기준 시연 데이터를 다시 불러왔습니다. 실시간 데이터가 아닙니다.`,
      );
    } catch {
      setError("데이터를 새로 불러오지 못했습니다. 이전 데이터를 표시합니다.");
    } finally {
      setLoading(false);
    }
  }
  function exportReport() {
    const rows = [
      [
        "PriceRadar AI · " +
          (data.mode === "demo" ? "데모" : "실제 데이터") +
          " · " +
          data.reference_date,
      ],
      [
        "품목",
        "규격",
        "지역",
        "수량",
        "현재 단가",
        "시연 예상 단가",
        "현재 총액",
        "시연 예상 총액",
      ],
    ];
    for (const item of items) {
      const p = data.products.find((p) => p.id === item.product_id);
      if (p)
        rows.push([
          p.name,
          p.spec,
          p.region,
          String(item.quantity),
          String(item.current_price),
          String(predictedPrice(p, item.current_price)),
          String(item.current_price * item.quantity),
          String(predictedPrice(p, item.current_price) * item.quantity),
        ]);
    }
    rows.push(
      ["합계", "", "", "", "", "", String(total.current), String(total.future)],
      ["시연 예측값은 합성 데이터이며 확정된 미래 가격이 아닙니다."],
    );
    const csv =
      "\uFEFF" +
      rows
        .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `물가레이더_장바구니_${data.reference_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("장바구니 리포트를 CSV 파일로 내보냈습니다.");
  }

  function NewsCard({
    article,
    compact = false,
  }: {
    article: News;
    compact?: boolean;
  }) {
    const p = data.products.find((p) => p.id === article.product_ids[0]);
    return (
      <button
        className={cn("news-card", compact && "news-compact")}
        onClick={() => setSelectedNews(article)}
      >
        <div className="news-card-top">
          <span className="news-category">{article.tag}</span>
          <span
            className={cn(
              "signal-pill",
              article.direction === "up"
                ? "signal-up"
                : article.direction === "down"
                  ? "signal-down"
                  : "signal-neutral",
            )}
          >
            {article.direction === "up" ? (
              <TrendingUp size={12} />
            ) : article.direction === "down" ? (
              <TrendingDown size={12} />
            ) : (
              <Info size={12} />
            )}{" "}
            {article.direction === "up"
              ? "상승"
              : article.direction === "down"
                ? "하락"
                : "보류"}{" "}
            신호
          </span>
        </div>
        <h3>{article.title}</h3>
        {!compact && <p>{article.summary}</p>}
        <div className="news-card-footer">
          <span>
            {p?.emoji} {p?.name}
          </span>
          <span>
            {dateLabel(article.published_at)} ·{" "}
            {article.mode === "demo" ? "예시 뉴스" : article.publisher}
          </span>
          <ArrowUpRight size={15} />
        </div>
      </button>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => go("dashboard")}
            aria-label="물가레이더 대시보드"
          >
            <span className="brand-icon">
              <Radar size={25} strokeWidth={1.8} />
            </span>
            <span>
              PriceRadar <b>AI</b>
            </span>
          </button>
          <nav aria-label="주요 메뉴">
            {nav.map((n) => (
              <button
                key={n.id}
                className={cn("nav-item", page === n.id && "nav-active")}
                aria-current={page === n.id ? "page" : undefined}
                onClick={() => go(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="header-status">
            <span className="status-dot" />
            {data.mode === "demo" ? "데모 워크스페이스" : "데이터 연결됨"}
            <span className="avatar">나</span>
          </div>
        </div>
      </header>
      <div className="market-strip">
        <div className="market-inner">
          <span className="market-label">
            <Activity size={14} /> 경제 신호
          </span>
          {data.indicators.map((v) => (
            <div className="market-item" key={v.name}>
              <span>{v.name}</span>
              <b>
                {v.value}
                <small> {v.unit}</small>
              </b>
              <span className={v.direction === "up" ? "up" : "down"}>
                {v.change}
              </span>
            </div>
          ))}
          <span className="market-demo">
            {data.mode === "demo"
              ? "시연용 지표 · 실제 시세 아님"
              : "관측 데이터"}
          </span>
        </div>
      </div>
      <main id="main" className="main">
        {error && (
          <div className="error-banner" role="alert">
            <Info size={17} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="오류 알림 닫기">
              <X size={16} />
            </button>
          </div>
        )}
        {page === "dashboard" ? (
          <>
            <section className="dashboard-hero">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> 내일의 물가, 오늘의 준비
                </div>
                <h1>
                  다음 달, 똑같은 장바구니에
                  <br />
                  <span>얼마가 필요할까요?</span>
                </h1>
                <p>
                  경제의 변화를 읽고, 우리 집 생활비를 한발 먼저 준비하세요.
                </p>
              </div>
              <div className="hero-right">
                <div className="date-chip">
                  <CalendarDays size={15} />
                  {data.reference_date.replaceAll("-", ".")} 기준
                  <ChevronDown size={13} />
                </div>
                <div className="hero-data">
                  <span className="radar-art">
                    <Radar size={75} strokeWidth={0.7} />
                    <i />
                    <em />
                  </span>
                  <div>
                    <b>{items.length}개 품목을 살펴보고 있어요</b>
                    <span>같은 수량, 달라지는 가격을 예측해요</span>
                    <button onClick={() => go("basket")}>
                      내 장바구니 관리 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <div className="demo-notice">
              <FlaskConical size={15} />
              <span>
                <b>{data.mode === "demo" ? "데모 모드" : "실제 데이터 모드"}</b>{" "}
                {data.mode === "demo"
                  ? "합성 가격과 예시 뉴스로 체험 중입니다. 예측값은 실제 AI 분석 결과가 아닙니다."
                  : "검증된 데이터와 연결된 모델의 예측을 표시합니다. 미래 가격은 확정된 값이 아닙니다."}
              </span>
              <button onClick={() => go("model")}>
                데이터 안내 <ChevronRight size={14} />
              </button>
            </div>
            <section className="stats-grid" aria-label="장바구니 비용 요약">
              <Stat
                label="현재 장바구니 비용"
                value={won(total.current)}
                unit="원"
                icon={ShoppingBag}
                footer={
                  <span>
                    총 {items.reduce((s, i) => s + i.quantity, 0)}단위 ·{" "}
                    {items.length}개 품목 기준
                  </span>
                }
              />
              <Stat
                label="30일 후 예상 비용"
                value={won(total.future)}
                unit="원"
                icon={Sparkles}
                featured
                footer={
                  <>
                    <span className="featured-tag">{forecastWord} 예측</span>
                    <span>동일 수량으로 계산했어요</span>
                  </>
                }
              />
              <Stat
                label="예상 변동 금액"
                value={`${total.difference >= 0 ? "+" : ""}${won(total.difference)}`}
                unit="원"
                icon={Wallet}
                color={total.difference >= 0 ? "up" : "down"}
                footer={
                  <span>
                    지금과 비교해{" "}
                    {total.difference >= 0 ? "더 필요해요" : "절약돼요"}
                  </span>
                }
              />
              <Stat
                label="장바구니 물가 변동률"
                value={`${total.change >= 0 ? "+" : ""}${total.change.toFixed(2)}`}
                unit="%"
                icon={TrendingUp}
                color={total.change >= 0 ? "up" : "down"}
                footer={
                  <>
                    <span className="tiny-dot" />
                    <span>소비량 변화 없이 가격만 반영</span>
                  </>
                }
              />
            </section>
            <section className="main-grid">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      내 장바구니 물가 전망{" "}
                      <span className="tag-neutral">{forecastWord}</span>
                    </h2>
                    <p>같은 장바구니, 앞으로의 가격 흐름을 확인하세요.</p>
                  </div>
                  <div className="segmented" aria-label="전망 기간">
                    {[7, 14, 30].map((n) => (
                      <button
                        key={n}
                        className={days === n ? "selected" : ""}
                        onClick={() => setDays(n)}
                      >
                        {n}일
                      </button>
                    ))}
                  </div>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-line" />{" "}
                    {data.mode === "demo" ? "합성" : "실제"} 관측값
                  </span>
                  <span>
                    <i className="legend-line dashed" /> {forecastWord} 예측값
                  </span>
                  <span>
                    <i className="legend-area" /> {forecastWord} 예측 범위
                  </span>
                </div>
                {items.length ? (
                  <ForecastChart data={data} items={items} days={days} />
                ) : (
                  <Empty
                    title="장바구니가 비어 있어요"
                    description="품목을 담으면 비용 전망을 확인할 수 있어요."
                    action={
                      <Button size="sm" onClick={() => go("basket")}>
                        품목 담기
                      </Button>
                    }
                  />
                )}
                <div className="chart-bottom">
                  <Info size={14} />
                  <span>
                    30일 후 {forecastWord} 범위{" "}
                    <b>
                      {won(total.lower)} ~ {won(total.upper)}원
                    </b>
                  </span>
                  <span className="chart-bottom-right">
                    예측은 미래 가격을 보장하지 않아요
                  </span>
                </div>
              </div>
              <aside className="panel ranking-panel">
                <div className="panel-heading">
                  <div>
                    <h2>눈여겨볼 품목</h2>
                    <p>내 장바구니의 예상 가격 변동</p>
                  </div>
                  <span className="icon-soft">
                    <TrendingUp size={17} />
                  </span>
                </div>
                <div className="ranking-tabs">
                  <button
                    className={ranking === "up" ? "active-up" : ""}
                    onClick={() => setRanking("up")}
                  >
                    <TrendingUp size={14} /> 상승 품목
                  </button>
                  <button
                    className={ranking === "down" ? "active-down" : ""}
                    onClick={() => setRanking("down")}
                  >
                    <TrendingDown size={14} /> 하락 품목
                  </button>
                </div>
                <div className="ranking-list">
                  {basketProducts
                    .filter((p) =>
                      ranking === "up" ? p.change > 0 : p.change < 0,
                    )
                    .sort((a, b) =>
                      ranking === "up"
                        ? b.change - a.change
                        : a.change - b.change,
                    )
                    .slice(0, 4)
                    .map((p, i) => (
                      <button
                        key={p.id}
                        className="rank-row"
                        onClick={() => {
                          setSelectedId(p.id);
                          go("outlook");
                        }}
                      >
                        <span className="rank-number">{i + 1}</span>
                        <ProductIcon product={p} small />
                        <span className="rank-name">
                          <b>{p.name}</b>
                          <small>{p.unit} 기준</small>
                        </span>
                        <Change value={p.change} />
                      </button>
                    ))}
                  {!basketProducts.filter((p) =>
                    ranking === "up" ? p.change > 0 : p.change < 0,
                  ).length && (
                    <p className="muted rank-empty">
                      해당하는 품목이 없습니다.
                    </p>
                  )}
                </div>
                <button className="ranking-more" onClick={() => go("outlook")}>
                  전체 품목 전망 보기 <ArrowRight size={14} />
                </button>
              </aside>
            </section>
            <section className="news-section">
              <div className="section-heading">
                <div>
                  <h2>
                    <span className="section-icon">
                      <Newspaper size={18} />
                    </span>
                    경제뉴스로 읽는 물가
                  </h2>
                  <p>뉴스 속 변화가 장바구니에 미치는 영향을 살펴보세요.</p>
                </div>
                <button className="text-link" onClick={() => go("news")}>
                  전체 뉴스 보기 <ArrowRight size={15} />
                </button>
              </div>
              <div className="news-grid">
                {data.news.slice(0, 3).map((n) => (
                  <NewsCard key={n.id} article={n} compact />
                ))}
              </div>
            </section>
            <section className="insight-grid">
              <div className="insight-card">
                <span className="insight-icon blue">
                  <Sparkles size={19} />
                </span>
                <div>
                  <div className="insight-label">
                    이번 장바구니의 핵심 신호 <span>{forecastWord}</span>
                  </div>
                  <p>
                    {rising ? (
                      <>
                        <b>{rising.name}</b>의 {rising.reason}에 주목하세요.
                      </>
                    ) : (
                      "품목을 담아 장바구니의 가격 변화를 확인하세요."
                    )}
                  </p>
                </div>
              </div>
              <div className="insight-card saving-tip">
                <span className="insight-icon green">
                  <Lightbulb size={20} />
                </span>
                <div>
                  <div className="insight-label">조금 더 현명한 장보기</div>
                  <p>
                    {falling && falling.change < 0 ? (
                      <>
                        <b>{falling.name}</b>처럼 하락이 예상되는 품목을
                        대체재로 살펴보세요.
                      </>
                    ) : (
                      "가격 비교와 제철 식재료 선택으로 지출을 준비해 보세요."
                    )}
                  </p>
                </div>
                <button
                  aria-label="장바구니에서 절약 계획 세우기"
                  onClick={() => go("basket")}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">나의 생활비 인사이트</div>
                <h1>{nav.find((n) => n.id === page)?.label}</h1>
                <p>
                  {page === "basket"
                    ? "내가 사는 품목 그대로, 다음 달 생활비를 계산해 보세요."
                    : page === "news"
                      ? "경제 이벤트가 품목 가격에 전하는 신호를 살펴보세요."
                      : page === "outlook"
                        ? "과거의 흐름부터 다음 달의 가능성까지, 품목별로 자세히 살펴보세요."
                        : "예측의 근거와 모델 검증 상태를 투명하게 확인하세요."}
                </p>
              </div>
              <span className="date-chip">
                <CalendarDays size={15} />
                {data.reference_date.replaceAll("-", ".")} 기준
              </span>
            </div>
            <div className="demo-notice">
              <FlaskConical size={15} />
              <span>
                <b>{data.mode === "demo" ? "데모 데이터" : "연결 데이터"}</b>{" "}
                {data.mode === "demo"
                  ? "가격·뉴스·예측 범위는 시연용입니다. XGBoost는 아직 학습하지 않았습니다."
                  : "데이터 출처와 모델 상태를 개별 항목에서 확인하세요."}
              </span>
            </div>
            {page === "basket" && (
              <>
                <div className="basket-summary">
                  <div>
                    <span>현재 총비용</span>
                    <strong>
                      {won(total.current)}
                      <small>원</small>
                    </strong>
                  </div>
                  <ArrowRight className="summary-arrow" size={22} />
                  <div>
                    <span>30일 후 {forecastWord} 예상</span>
                    <strong className="text-blue">
                      {won(total.future)}
                      <small>원</small>
                    </strong>
                  </div>
                  <div className="summary-change">
                    <Change value={total.change} large />
                    <span>
                      {total.difference >= 0 ? "+" : ""}
                      {won(total.difference)}원 변동
                    </span>
                  </div>
                  <div className="summary-actions">
                    <Button variant="outline" size="sm" onClick={exportReport}>
                      <Download size={15} /> 내보내기
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Check size={16} />
                      )}{" "}
                      장바구니 저장
                    </Button>
                  </div>
                </div>
                <div className="panel basket-panel">
                  <div className="basket-toolbar">
                    <div className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="장바구니 품목 검색"
                        placeholder="품목명으로 검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          aria-label="검색어 지우기"
                          onClick={() => setQuery("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <select
                      aria-label="카테고리 필터"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <span className="basket-count">
                      총 {items.length}개 품목{" "}
                      <span className={saved ? "saved-label" : "dirty-label"}>
                        {saved ? "저장됨" : "변경 사항 있음"}
                      </span>
                    </span>
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      <Plus size={16} /> 품목 추가
                    </Button>
                  </div>
                  <div className="table-scroll">
                    <table className="basket-table">
                      <thead>
                        <tr>
                          <th>품목 / 구매 단위</th>
                          <th>구매 수량</th>
                          <th>현재 단가</th>
                          <th>30일 후 {forecastWord} 단가</th>
                          <th>변동률</th>
                          <th>{forecastWord} 예상 총비용</th>
                          <th>
                            <span className="sr-only">삭제</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items
                          .filter((i) => {
                            const p = data.products.find(
                              (p) => p.id === i.product_id,
                            );
                            return (
                              p &&
                              p.name.includes(query) &&
                              (category === "전체" || p.category === category)
                            );
                          })
                          .map((i) => {
                            const p = data.products.find(
                              (p) => p.id === i.product_id,
                            )!;
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div className="table-product">
                                    <ProductIcon product={p} />
                                    <div>
                                      <b>{p.name}</b>
                                      <small>
                                        {p.unit} · {p.category}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="quantity-control">
                                    <button
                                      aria-label={`${p.name} 수량 줄이기`}
                                      disabled={i.quantity <= 1}
                                      onClick={() =>
                                        update(p.id, {
                                          quantity: i.quantity - 1,
                                        })
                                      }
                                    >
                                      <Minus size={13} />
                                    </button>
                                    <input
                                      aria-label={`${p.name} 수량`}
                                      type="number"
                                      min={1}
                                      max={999}
                                      value={i.quantity}
                                      onChange={(e) =>
                                        update(p.id, {
                                          quantity: Math.min(
                                            999,
                                            Math.max(
                                              1,
                                              Math.floor(
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          ),
                                        })
                                      }
                                    />
                                    <button
                                      aria-label={`${p.name} 수량 늘리기`}
                                      disabled={i.quantity >= 999}
                                      onClick={() =>
                                        update(p.id, {
                                          quantity: i.quantity + 1,
                                        })
                                      }
                                    >
                                      <Plus size={13} />
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  <div className="price-input">
                                    <input
                                      aria-label={`${p.name} 현재 단가`}
                                      type="number"
                                      min={1}
                                      max={10000000}
                                      value={i.current_price}
                                      onChange={(e) =>
                                        update(p.id, {
                                          current_price: Math.min(
                                            10000000,
                                            Math.max(
                                              1,
                                              Math.floor(
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          ),
                                        })
                                      }
                                    />
                                    <span>원</span>
                                  </div>
                                </td>
                                <td className="numeric">
                                  {won(predictedPrice(p, i.current_price))}
                                  <small>원</small>
                                </td>
                                <td>
                                  <Change value={p.change} />
                                </td>
                                <td className="numeric total-cell">
                                  {won(
                                    predictedPrice(p, i.current_price) *
                                      i.quantity,
                                  )}
                                  <small>원</small>
                                </td>
                                <td>
                                  <button
                                    className="delete-button"
                                    aria-label={`${p.name} 삭제`}
                                    onClick={() => remove(p.id)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {!items.length ? (
                    <Empty
                      title="장바구니가 비어 있어요"
                      description="평소 구매하는 품목을 담아 미래 생활비를 확인하세요."
                      action={
                        <Button onClick={() => setAddOpen(true)}>
                          <Plus size={15} /> 첫 품목 담기
                        </Button>
                      }
                    />
                  ) : (
                    !items.some((i) => {
                      const p = data.products.find(
                        (p) => p.id === i.product_id,
                      );
                      return (
                        p?.name.includes(query) &&
                        (category === "전체" || p?.category === category)
                      );
                    }) && (
                      <Empty
                        title="검색 결과가 없어요"
                        description="다른 품목명이나 카테고리를 선택해 주세요."
                      />
                    )
                  )}
                  <div className="table-footer">
                    <span>
                      <Info size={14} /> 현재 단가를 수정하면 같은 예측 변동
                      비율을 적용해 다시 계산합니다.
                    </span>
                    <button onClick={() => setResetOpen(true)}>
                      <RefreshCw size={13} /> 기본 장바구니로 초기화
                    </button>
                  </div>
                </div>
                <div className="info-box">
                  <ShieldCheck size={20} />
                  <div>
                    <b>같은 수량으로 비교하는 생활비</b>
                    <p>
                      예상 비용은 소비량 변화가 아닌 품목 가격 변화만
                      반영합니다. 장바구니는{" "}
                      {API_URL
                        ? "연결된 로컬 서버와 현재 브라우저"
                        : "현재 브라우저"}
                      에 저장됩니다.
                    </p>
                  </div>
                </div>
              </>
            )}
            {page === "news" && (
              <>
                <div className="news-stat-grid">
                  <MiniStat
                    label={
                      data.mode === "demo"
                        ? "분석할 예시 뉴스"
                        : "분석한 경제뉴스"
                    }
                    value={`${data.news.length}건`}
                    icon={Newspaper}
                  />
                  <MiniStat
                    label="상승 신호"
                    value={`${data.news.filter((n) => n.direction === "up").length}건`}
                    icon={TrendingUp}
                    color="up"
                  />
                  <MiniStat
                    label="하락 신호"
                    value={`${data.news.filter((n) => n.direction === "down").length}건`}
                    icon={TrendingDown}
                    color="down"
                  />
                  <MiniStat
                    label="관련 품목"
                    value={`${new Set(data.news.flatMap((n) => n.product_ids)).size}개`}
                    icon={ShoppingBasket}
                  />
                </div>
                <div className="filter-bar panel">
                  <select
                    aria-label="뉴스 품목 필터"
                    value={newsProduct}
                    onChange={(e) => setNewsProduct(e.target.value)}
                  >
                    <option value="all">모든 품목</option>
                    {data.products.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="가격 영향 방향"
                    value={signal}
                    onChange={(e) => setSignal(e.target.value)}
                  >
                    <option value="all">모든 가격 신호</option>
                    <option value="up">가격 상승 신호</option>
                    <option value="down">가격 하락 신호</option>
                  </select>
                  <select
                    aria-label="경제 이벤트 유형"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                  >
                    <option value="all">모든 경제 이벤트</option>
                    {[...new Set(data.news.map((n) => n.event))].map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                  <label className="date-filter">
                    <span>이 날짜부터</span>
                    <input
                      type="date"
                      aria-label="뉴스 시작 날짜"
                      max={data.reference_date}
                      value={since}
                      onChange={(e) => setSince(e.target.value)}
                    />
                  </label>
                  <button
                    className="text-link"
                    onClick={() => {
                      setNewsProduct("all");
                      setSignal("all");
                      setEvent("all");
                      setSince("");
                    }}
                  >
                    <RefreshCw size={14} /> 초기화
                  </button>
                </div>
                <div className="results-label">
                  조건에 맞는 {data.mode === "demo" ? "예시 뉴스" : "경제뉴스"}{" "}
                  <b>{filteredNews.length}건</b>
                  <span>발행일 최신순</span>
                </div>
                <div className="news-grid news-full">
                  {filteredNews.map((n) => (
                    <NewsCard article={n} key={n.id} />
                  ))}
                </div>
                {!filteredNews.length && (
                  <Empty
                    title="조건에 맞는 뉴스가 없어요"
                    description="품목, 이벤트 또는 날짜 조건을 바꿔보세요."
                  />
                )}
                <div className="main-grid news-bottom">
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>품목별 뉴스 언급량</h2>
                        <p>
                          {data.mode === "demo"
                            ? "예시 데이터에 포함된 기사 수 · 실제 보도량 아님"
                            : "연결된 데이터에 포함된 기사 수"}
                        </p>
                      </div>
                    </div>
                    <NewsVolumeChart data={data} />
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>경제 이벤트 타임라인</h2>
                        <p>
                          발행일 기준 주요 {data.mode === "demo" ? "예시 " : ""}
                          이벤트
                        </p>
                      </div>
                    </div>
                    <div className="timeline">
                      {data.news.slice(0, 4).map((n) => (
                        <button key={n.id} onClick={() => setSelectedNews(n)}>
                          <span className={cn("timeline-dot", n.direction)} />
                          <small>{dateLabel(n.published_at)}</small>
                          <div>
                            <b>{n.event}</b>
                            <p>
                              {
                                data.products.find(
                                  (p) => p.id === n.product_ids[0],
                                )?.name
                              }{" "}
                              · 영향 시차 약 {n.lag_days}일
                            </p>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            {page === "outlook" && selected && (
              <>
                <div className="product-selector">
                  {data.products.map((p) => (
                    <button
                      key={p.id}
                      className={selectedId === p.id ? "selected" : ""}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <span>{p.emoji}</span>
                      {p.name}
                    </button>
                  ))}
                </div>
                <section className="outlook-summary">
                  <div className="outlook-product">
                    <ProductIcon product={selected} />
                    <div>
                      <h2>
                        {selected.name}
                        <span className="tag-neutral">{selected.category}</span>
                      </h2>
                      <p>
                        {selected.spec} · {selected.region}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span>현재 기준 가격</span>
                    <b>
                      {won(selected.price)}
                      <small>원</small>
                    </b>
                  </div>
                  <ArrowRight size={21} className="muted" />
                  <div>
                    <span>30일 후 {forecastWord} 가격</span>
                    <b className="text-blue">
                      {won(selected.forecast)}
                      <small>원</small>
                    </b>
                  </div>
                  <Change value={selected.change} large />
                </section>
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{selected.name}의 가격 흐름과 전망</h2>
                      <p>
                        최근 90일 {data.mode === "demo" ? "합성" : "실제"}{" "}
                        관측값과 향후 30일 {forecastWord} 예측
                      </p>
                    </div>
                    <span className="tag-neutral">
                      단위: 원 / {selected.unit}
                    </span>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-line" />{" "}
                      {data.mode === "demo" ? "합성" : "실제"} 관측값
                    </span>
                    <span>
                      <i className="legend-line dashed" /> {forecastWord} 예측값
                    </span>
                    <span>
                      <i className="legend-area" /> {forecastWord} 범위
                    </span>
                  </div>
                  <ForecastChart data={data} items={items} product={selected} />
                  <div className="chart-bottom">
                    <Info size={14} />
                    <span>
                      30일 후 {forecastWord} 범위{" "}
                      <b>
                        {won(selected.lower)} ~ {won(selected.upper)}원
                      </b>{" "}
                      ·{" "}
                      {data.mode === "demo"
                        ? "통계적으로 검증된 신뢰구간이 아닙니다."
                        : "검증 잔차에 기반한 범위이며 미래 가격을 보장하지 않습니다."}
                    </span>
                  </div>
                </div>
                <div className="outlook-bottom">
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>가격에 영향을 주는 요인</h2>
                        <p>
                          {data.mode === "demo"
                            ? "경제적 인과관계를 가정한 시연 설명"
                            : "데이터에 연결된 주요 경제 신호"}
                        </p>
                      </div>
                      <Sparkles size={18} className="text-blue" />
                    </div>
                    <div className="factor-main">
                      <span
                        className={cn(
                          "factor-icon",
                          selected.change > 0 ? "red" : "blue",
                        )}
                      >
                        {selected.change > 0 ? (
                          <TrendingUp size={22} />
                        ) : (
                          <TrendingDown size={22} />
                        )}
                      </span>
                      <div>
                        <b>{selected.reason}</b>
                        <p>
                          품목의 공급·수요 및 비용 변화가 소매가격으로 전달되는
                          상황을 가정한 예시입니다.
                        </p>
                      </div>
                    </div>
                    <div className="source-meta">
                      <div>
                        <span>데이터 출처</span>
                        <b>{selected.source}</b>
                      </div>
                      <div>
                        <span>예측 기준일</span>
                        <b>{data.reference_date}</b>
                      </div>
                      <div>
                        <span>지역 / 등급</span>
                        <b>
                          {selected.region} / {selected.grade}
                        </b>
                      </div>
                      <div>
                        <span>예측 방법</span>
                        <b>
                          {data.mode === "demo"
                            ? "시연 비율 적용 · 미학습"
                            : "XGBoost · 검증 잔차 범위"}
                        </b>
                      </div>
                    </div>
                  </div>
                  <div className="panel related-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>함께 읽을 경제뉴스</h2>
                        <p>{selected.name}에 연결된 가격 신호</p>
                      </div>
                    </div>
                    {data.news
                      .filter((n) => n.product_ids.includes(selected.id))
                      .map((n) => (
                        <NewsCard key={n.id} article={n} compact />
                      ))}
                    {!data.news.some((n) =>
                      n.product_ids.includes(selected.id),
                    ) && (
                      <Empty
                        title="연결된 예시 뉴스가 없어요"
                        description="다른 품목이나 전체 뉴스에서 경제 신호를 살펴보세요."
                      />
                    )}
                  </div>
                </div>
              </>
            )}
            {page === "model" && <ModelPage metrics={metrics} data={data} />}
          </>
        )}
        <footer className="footer">
          <div>
            <span className="footer-brand">
              <Radar size={16} /> PriceRadar AI
            </span>
            <span>생활비의 내일을 읽다</span>
          </div>
          <div>
            <Clock3 size={13} /> 데이터 기준{" "}
            {data.reference_date.replaceAll("-", ".")}{" "}
            <span className="footer-divider" />{" "}
            {data.mode === "demo" ? "데모 데이터셋" : "연결된 데이터셋"}
            <button
              onClick={refresh}
              disabled={loading}
              aria-label="데이터 새로 불러오기"
            >
              <RefreshCw size={13} className={loading ? "spin" : ""} />
            </button>
          </div>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {notice}
        </div>
      )}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="장바구니에 품목 추가"
        description="평소 구매하는 품목을 골라 담으세요. 수량과 가격은 장바구니에서 바꿀 수 있어요."
      >
        <div className="search-input modal-search">
          <Search size={17} />
          <input
            autoFocus
            placeholder="품목 검색"
            aria-label="추가할 품목 검색"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
          />
        </div>
        <div className="add-products">
          {data.products
            .filter((p) => p.name.includes(addQuery))
            .map((p) => {
              const exists = items.some((i) => i.product_id === p.id);
              return (
                <div className="add-product" key={p.id}>
                  <ProductIcon product={p} />
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.unit} · {won(p.price)}원
                    </small>
                  </div>
                  <Button
                    variant={exists ? "ghost" : "outline"}
                    size="sm"
                    disabled={exists}
                    onClick={() => add(p)}
                  >
                    {exists ? (
                      <>
                        <Check size={14} /> 담김
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> 담기
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
        </div>
        <Button className="modal-done" onClick={() => setAddOpen(false)}>
          장바구니 확인하기 <ArrowRight size={15} />
        </Button>
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="기본 장바구니로 돌아갈까요?"
        description="직접 수정한 수량과 단가를 10개 기본 품목으로 되돌립니다. 저장 전까지 서버의 장바구니는 바뀌지 않습니다."
      >
        <div className="modal-actions">
          <Button variant="outline" onClick={() => setResetOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => {
              setItems(defaultBasket(data.products));
              setSaved(false);
              setResetOpen(false);
              setNotice("기본 장바구니로 초기화했습니다.");
            }}
          >
            초기화
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!selectedNews}
        onOpenChange={(open) => {
          if (!open) setSelectedNews(null);
        }}
        title={selectedNews?.title || "뉴스 분석"}
        description="경제 이벤트가 품목 가격에 미치는 방향을 살펴보세요."
      >
        {selectedNews && (
          <>
            <div className="article-meta">
              <span className="tag-neutral">
                {selectedNews.mode === "demo"
                  ? "예시 기사 · 실제 보도 아님"
                  : "원문 제공 기사"}
              </span>
              <span>
                {selectedNews.publisher} ·{" "}
                {selectedNews.published_at.slice(0, 10)}
              </span>
            </div>
            <div className="article-analysis">
              <div className="analysis-label">
                <Sparkles size={17} /> 경제 이벤트 분석 ·{" "}
                {selectedNews.mode === "demo" ? "시연" : "규칙 기반"}
              </div>
              <p>{selectedNews.summary}</p>
            </div>
            <dl className="analysis-details">
              <div>
                <dt>관련 품목</dt>
                <dd>
                  {selectedNews.product_ids
                    .map((id) => data.products.find((p) => p.id === id)?.name)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>경제 이벤트</dt>
                <dd>{selectedNews.event}</dd>
              </div>
              <div>
                <dt>가격 영향 방향</dt>
                <dd
                  className={
                    selectedNews.direction === "up"
                      ? "up"
                      : selectedNews.direction === "down"
                        ? "down"
                        : "muted"
                  }
                >
                  {selectedNews.direction === "up"
                    ? "상승 압력"
                    : selectedNews.direction === "down"
                      ? "하락 압력"
                      : "분류 보류"}
                </dd>
              </div>
              <div>
                <dt>영향 강도 / 시차</dt>
                <dd>
                  {selectedNews.strength} / 약 {selectedNews.lag_days}일
                </dd>
              </div>
            </dl>
            {selectedNews.original_url ? (
              <a
                className="button button-outline"
                href={selectedNews.original_url}
                target="_blank"
                rel="noreferrer"
              >
                원문 보기 <ExternalLink size={15} />
              </a>
            ) : (
              <p className="article-disclaimer">
                <Info size={15} /> 시연을 위해 작성한 예시 뉴스로, 원문 링크가
                없습니다. 경제 신호는 학습된 언어 모델의 출력이 아닙니다.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  icon: Icon,
  footer,
  featured = false,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  footer: React.ReactNode;
  featured?: boolean;
  color?: string;
}) {
  return (
    <article className={cn("stat-card", featured && "stat-featured")}>
      <div className="stat-label">
        {label}
        <Icon size={18} />
      </div>
      <div className={cn("stat-value", color)}>
        {value}
        <span>{unit}</span>
        {featured && (
          <span className="stat-sparkle">
            <Sparkles size={30} />
          </span>
        )}
      </div>
      <div className="stat-footer">{footer}</div>
    </article>
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
