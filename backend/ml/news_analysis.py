"""Auditable economic-event rules; this module does not claim to be a trained NLP model."""

import re
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

SEOUL = timezone(timedelta(hours=9))
PRODUCTS = {
    "rice": "쌀",
    "eggs": "계란",
    "cabbage": "배추",
    "onion": "양파",
    "potato": "감자",
    "apple": "사과",
    "pork": "돼지고기",
    "milk": "우유",
    "scallion": "대파",
    "mackerel": "고등어",
}
RULES = [
    (
        "공급량 감소",
        "up",
        (
            "생산량 감소",
            "출하 지연",
            "출하량 감소",
            "공급 부족",
            "어획량 감소",
            "작황 악화",
            "물량 감소",
        ),
    ),
    (
        "공급량 증가",
        "down",
        (
            "생산량 증가",
            "출하 확대",
            "반입량 증가",
            "공급 증가",
            "어획량 회복",
            "풍작",
            "출하량 증가",
        ),
    ),
    ("수요 증가", "up", ("수요 증가", "수요 확대", "소비 증가", "김장철")),
    ("수요 감소", "down", ("수요 감소", "소비 감소", "수요 위축")),
    ("환율 상승", "up", ("환율 상승", "원화 약세")),
    ("환율 하락", "down", ("환율 하락", "원화 강세")),
    (
        "원자재 가격 상승",
        "up",
        ("사료 원가 부담", "사료 가격 상승", "원자재 가격 상승", "곡물 가격 상승"),
    ),
    (
        "원자재 가격 하락",
        "down",
        ("사료 가격 하락", "원자재 가격 하락", "곡물 가격 하락"),
    ),
    ("물류비 변화", "up", ("물류비 상승", "운임 상승", "운송비 증가")),
    ("물류비 변화", "down", ("물류비 하락", "운임 하락", "운송비 감소")),
    ("정부 정책 변화", "down", ("관세 인하", "할인 지원", "비축 물량 방출")),
    ("정부 정책 변화", "up", ("관세 인상", "수입 제한")),
    ("기후 및 자연재해", "up", ("폭우", "가뭄", "한파", "태풍", "폭염")),
]


def timestamp(value: str):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return (dt if dt.tzinfo else dt.replace(tzinfo=SEOUL)).astimezone(SEOUL)


def analyze_news(article: dict):
    # TODO[AI-01] [B] 현재는 키워드 규칙입니다. NLP/LLM 구조화 분석과 수작업 정답셋 평가를 연결하세요.
    # 품목별 영향 방향이 다를 수 있으므로 기사 전체에 하나의 방향만 부여하는 한계도 개선하세요.
    text = article["title"] + " " + article.get("summary", article.get("body", ""))
    products = article.get("product_ids") or [
        id for id, name in PRODUCTS.items() if name in text
    ]
    event, direction = "분류 보류", "neutral"
    for e, d, keywords in RULES:
        if any(word in text for word in keywords):
            event, direction = e, d
            break
    return {
        **article,
        "product_ids": products,
        "event": event,
        "direction": direction,
        "strength": "높음"
        if any(w in text for w in ("폭우", "급감", "폭등", "태풍"))
        else "중간",
        "lag_days": 21 if event.startswith("원자재") else 7,
        "analysis_method": "rule_based_not_trained",
        "needs_review": direction == "neutral" or not products,
    }


def deduplicate(articles: list[dict]):
    """Near-duplicate titles for the same products/event within 3 days, keep first publication."""
    kept = []
    for article in sorted(articles, key=lambda a: timestamp(a["published_at"])):
        title = re.sub(r"[^가-힣a-zA-Z0-9]", "", article["title"])
        duplicate = False
        for prior in kept:
            same_url = article.get("original_url") and article.get(
                "original_url"
            ) == prior.get("original_url")
            same_context = set(article.get("product_ids", [])) == set(
                prior.get("product_ids", [])
            ) and article.get("event") == prior.get("event")
            close = (
                abs(
                    (
                        timestamp(article["published_at"])
                        - timestamp(prior["published_at"])
                    ).total_seconds()
                )
                <= 3 * 86400
            )
            similar = (
                SequenceMatcher(
                    None, title, re.sub(r"[^가-힣a-zA-Z0-9]", "", prior["title"])
                ).ratio()
                >= 0.78
            )
            if same_url or (same_context and close and similar):
                duplicate = True
                break
        if not duplicate:
            kept.append(article)
    return kept


def aggregate_news(articles: list[dict], as_of: str, product_ids=None):
    cutoff = timestamp(as_of + "T23:59:59+09:00" if len(as_of) == 10 else as_of)
    start = cutoff - timedelta(days=7)
    allowed = [
        a
        for a in articles
        if start < timestamp(a["published_at"]) <= cutoff
        and timestamp(a.get("available_at", a["published_at"])) <= cutoff
    ]
    # TODO[AI-01] [B] LLM 분석 결과를 저장했다면 여기서 규칙으로 다시 덮어쓰지 않도록 캐시/분석 경로도 수정하세요.
    unique = deduplicate([analyze_news(a) for a in allowed])
    ids = product_ids or list(PRODUCTS)
    result = {
        id: {
            "news_count": 0,
            "news_up": 0.0,
            "news_down": 0.0,
            "news_supply": 0.0,
            "news_demand": 0.0,
        }
        for id in ids
    }
    for a in unique:
        strength = {"높음": 2.0, "중간": 1.0, "낮음": 0.5}.get(a["strength"], 0.0)
        for id in a["product_ids"]:
            if id not in result:
                continue
            r = result[id]
            r["news_count"] += 1
            if a["direction"] in ("up", "down"):
                r["news_" + a["direction"]] += strength
            signed = (
                strength
                if a["direction"] == "up"
                else -strength
                if a["direction"] == "down"
                else 0
            )
            if a["event"].startswith("공급"):
                r["news_supply"] += signed
            if a["event"].startswith("수요"):
                r["news_demand"] += signed
    return result
