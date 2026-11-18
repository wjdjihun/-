import { ArrowUpRight } from "lucide-react";
import styles from "./observed-prices.module.css";

const articles = [
  {
    date: "2026-06-23",
    publisher: "농림축산식품부",
    title: "여름 배추 작황과 수급 대응",
    summary: "농식품부는 6월 하순까지 배추 작황이 양호하다고 설명하고, 여름철 공급 안정을 위한 대응을 소개했습니다.",
    url: "https://www.mafra.go.kr/bbs/home/793/598229/download.do",
    linkLabel: "보도 설명자료 PDF",
  },
  {
    date: "2026-06-08",
    publisher: "농림축산식품부",
    title: "여름철 농축산물 수급 점검과 6월 할인지원",
    summary: "농식품부는 양파 등의 가격을 점검하고, 폭염과 집중호우에 대비해 수급 상황을 상시 살피겠다고 밝혔습니다.",
    url: "https://eiec.kdi.re.kr/policy/materialView.do?num=282368",
    linkLabel: "보도자료 보기",
  },
  {
    date: "2026-06-02",
    publisher: "국가데이터처",
    title: "2026년 5월 소비자물가동향",
    summary: "5월 소비자물가지수는 작년 같은 달보다 3.1% 상승했고, 신선채소 지수는 4.9% 하락했습니다.",
    url: "https://mods.go.kr/board.es?act=view&bid=213&list_no=445351&mid=a10301010000",
    linkLabel: "보도자료 보기",
  },
];

export default function EconomicNews() {
  return (
    <section className="panel" aria-labelledby="economic-news-title">
      <div className="panel-heading">
        <div>
          <h2 id="economic-news-title">경제뉴스</h2>
          <p>2026년 6월 30일까지 공개된 물가·수급 자료입니다. AI 예측과 함께 참고할 수 있습니다.</p>
        </div>
      </div>
      <ul className={styles.newsList}>
        {articles.map(({ date, publisher, title, summary, url, linkLabel }) => (
          <li key={url}>
            <article>
              <span>{publisher} · <time dateTime={date}>{date}</time></span>
              <h3>{title}</h3>
              <p>{summary}</p>
              <a className={styles.demoLink} href={url} aria-label={`${title} (${linkLabel})`}>
                {linkLabel} <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
