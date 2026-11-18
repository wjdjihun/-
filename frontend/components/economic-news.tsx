"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import styles from "./observed-prices.module.css";

const feedUrl = "https://www.newsis.com/RSS/economy.xml";
const refreshInterval = 5 * 60 * 1000;
const newsDate = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type FeedArticle = { title: string; url: string; published: number };

function readFeed(xml: string): FeedArticle[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror") || !document.querySelector("rss > channel")) {
    throw new Error("Invalid news feed");
  }

  const articles = new Map<string, FeedArticle>();
  for (const item of document.querySelectorAll("channel > item")) {
    const title = item.querySelector("title")?.textContent?.trim();
    const link = item.querySelector("link")?.textContent?.trim();
    const published = Date.parse(item.querySelector("pubDate")?.textContent ?? "");
    if (!title || !link || !Number.isFinite(published) || !URL.canParse(link)) continue;
    const url = new URL(link);
    if (url.origin !== "https://www.newsis.com" || !url.pathname.startsWith("/view/")) continue;
    articles.set(url.href, { title, url: url.href, published });
  }
  return [...articles.values()].sort((left, right) => right.published - left.published).slice(0, 8);
}

export default function EconomicNews() {
  const [latest, setLatest] = useState<FeedArticle[]>([]);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;

    async function loadLatest() {
      if (fetching || document.hidden) return;
      fetching = true;
      setLoading(true);
      try {
        const response = await fetch(feedUrl, {
          cache: "no-cache",
          credentials: "omit",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error("News request failed");
        const news = readFeed(await response.text());
        if (controller.signal.aborted) return;
        setLatest(news);
        setLastChecked(Date.now());
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLatest();
    const timer = window.setInterval(loadLatest, refreshInterval);
    document.addEventListener("visibilitychange", loadLatest);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", loadLatest);
    };
  }, [refresh]);

  return (
    <section className="panel" aria-labelledby="latest-news-title">
      <div className={`panel-heading ${styles.newsHeading}`}>
        <div>
          <h2 id="latest-news-title">최신 경제뉴스</h2>
          <p>뉴시스 경제 RSS · 이 탭에서 5분마다 확인합니다.</p>
        </div>
        <button type="button" className={styles.yearButton} disabled={loading} onClick={() => setRefresh((count) => count + 1)}>
          <RefreshCw size={14} aria-hidden="true" /> 새로고침
        </button>
      </div>
      <p className={styles.feedStatus} role="status">
        {loading ? "최신 기사를 확인 중입니다." : failed ? "최신 기사를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : ""}
        {lastChecked && ` 마지막 수신 ${newsDate.format(lastChecked)} (한국시간)`}
        {!loading && !failed && latest.length === 0 && " 현재 피드에 표시할 기사가 없습니다."}
      </p>
      {latest.length > 0 && (
        <ul className={styles.newsList}>
          {latest.map(({ title, url, published }) => (
            <li key={url}>
              <span>뉴시스 · <time dateTime={new Date(published).toISOString()}>{newsDate.format(published)}</time></span>
              <h3><a className={styles.demoLink} href={url}>{title} <ArrowUpRight size={14} aria-hidden="true" /></a></h3>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
