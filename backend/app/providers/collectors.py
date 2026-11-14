"""Official API clients. Raw collection is separate from normalized model inputs.

KAMIS/KOSIS contracts were checked against official published documentation.
Other services require a URL exported from the owner's official API console;
this module deliberately does not invent undocumented endpoints or dataset codes.
Authenticated live requests have not been verified without the user's API keys.
"""

from urllib.parse import urlsplit
import httpx
from app.providers.base import ProviderError


def fetch_json(url, params=None, headers=None):
    try:
        response = httpx.get(
            url, params=params, headers=headers, timeout=25, follow_redirects=False
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Exceptions often contain the credential-bearing URL: never log or return it.
        raise ProviderError(
            "공식 API 응답을 받지 못했습니다. 인증·할당량·응답 형식을 확인하세요."
        ) from None
    if isinstance(data, dict) and (
        data.get("err")
        or data.get("errCd")
        or data.get("RESULT", {}).get("CODE", "INFO-000") != "INFO-000"
    ):
        raise ProviderError(
            "공식 API가 오류 응답을 반환했습니다. 콘솔에서 요청 조건을 확인하세요."
        )
    return data


class KamisClient:
    # TODO[API-01] [A] 클라이언트는 작성됨. 실제 발급 키로 인증·응답·할당량을 검증하세요.
    # TODO[DATA-01] [A] 품목/품종/등급/지역/단위를 확인해 docs/product_mapping.template.csv를 완성하세요.
    DOCS = "https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=1"
    ENDPOINT = "https://www.kamis.or.kr/service/price/xml.do"

    def __init__(self, cert_id, cert_key):
        if not cert_id or not cert_key:
            raise ProviderError("KAMIS_CERT_ID와 KAMIS_CERT_KEY가 필요합니다.")
        self.cert_id, self.cert_key = cert_id, cert_key

    def daily_retail(self, day, category_code, country_code):
        # 01 = retail; preserve quoted unit, rank and region before normalization.
        return fetch_json(
            self.ENDPOINT,
            {
                "action": "dailyPriceByCategoryList",
                "p_product_cls_code": "01",
                "p_country_code": country_code,
                "p_regday": day,
                "p_convert_kg_yn": "N",
                "p_item_category_code": category_code,
                "p_cert_key": self.cert_key,
                "p_cert_id": self.cert_id,
                "p_returntype": "json",
            },
        )


class KosisClient:
    # TODO[API-03] [A] 공식 콘솔의 통계표·기관·분류·항목 코드를 입력하고 실제 응답을 검증하세요.
    DOCS = "https://sso.kosis.kr/openapi/devGuide/devGuide_0201List.do"
    ENDPOINT = "https://kosis.kr/openapi/Param/statisticsParameterData.do"

    def __init__(self, key):
        if not key:
            raise ProviderError("KOSIS_API_KEY가 필요합니다.")
        self.key = key

    def statistics(
        self,
        *,
        orgId,
        tblId,
        objL1,
        itmId,
        prdSe,
        startPrdDe,
        endPrdDe,
        **classifications,
    ):
        if any(k not in {f"objL{i}" for i in range(2, 9)} for k in classifications):
            raise ProviderError("지원하지 않는 KOSIS 분류 변수입니다.")
        return fetch_json(
            self.ENDPOINT,
            dict(
                method="getList",
                apiKey=self.key,
                format="json",
                orgId=orgId,
                tblId=tblId,
                objL1=objL1,
                itmId=itmId,
                prdSe=prdSe,
                startPrdDe=startPrdDe,
                endPrdDe=endPrdDe,
                **classifications,
            ),
        )


class ConsoleURLClient:
    """Use an exact, official-console-generated URL; credentials stay in .env."""

    def __init__(self, source, key):
        self.source, self.key = source, key
        if source not in ("ecos", "weather", "news"):
            raise ProviderError("지원하지 않는 소스입니다.")
        if not key:
            raise ProviderError(f"{source} API 키가 필요합니다.")

    def collect(self, config):
        url = config.get("url", "")
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.username or parsed.password:
            raise ProviderError("공식 콘솔에서 생성한 HTTPS URL을 사용하세요.")
        if self.source == "ecos":
            # TODO[API-02] [A] 공식 콘솔 URL에서 키를 {API_KEY}로 치환해 설정하세요. 고정 조회 코드는 미확정입니다.
            if (
                parsed.hostname != "ecos.bok.or.kr"
                or not parsed.path.startswith("/api/")
                or "{API_KEY}" not in url
            ):
                raise ProviderError(
                    "ECOS 공식 콘솔 URL에서 인증키를 {API_KEY}로 바꿔 설정하세요."
                )
            return fetch_json(url.replace("{API_KEY}", self.key))
        if self.source == "weather":
            # TODO[API-04] [A] 승인된 기상청 서비스 URL·관측소를 설정하고 응답을 정규화하세요.
            # 기상 피처는 현재 가격 모델 입력에 포함되지 않으므로 추가 시 C 담당과 계약을 맞추세요.
            if parsed.hostname != "apis.data.go.kr":
                raise ProviderError("공공데이터포털의 기상청 공식 URL을 사용하세요.")
            return fetch_json(url, {**config.get("params", {}), "serviceKey": self.key})
        # TODO[API-05] [B] 뉴스 공급자·이용 권한·문서의 인증 방식·원문 필드 매핑을 확정하세요.
        # Choose a licensed news provider and enter its documented auth contract explicitly.
        if not config.get("license_confirmed"):
            raise ProviderError(
                "뉴스 제공사의 API 이용 권한과 약관을 확인하고 license_confirmed를 설정하세요."
            )
        header = config.get("auth_header")
        query = config.get("auth_query")
        if bool(header) == bool(query):
            raise ProviderError(
                "문서에 확인된 인증 헤더 또는 쿼리 중 하나를 설정하세요."
            )
        return fetch_json(
            url,
            {**config.get("params", {}), **({query: self.key} if query else {})},
            {header: config.get("auth_prefix", "") + self.key} if header else None,
        )
