import pytest
from app.providers.collectors import KamisClient, KosisClient, ConsoleURLClient
from app.providers.base import ProviderError


def test_kamis_retail_request_contract(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.providers.collectors.fetch_json",
        lambda url, params: calls.append((url, params)) or {"data": []},
    )
    KamisClient("test-id", "test-key").daily_retail("2026-11-14", "200", "1101")
    assert calls[0][1]["p_product_cls_code"] == "01"
    assert calls[0][1]["p_convert_kg_yn"] == "N"
    assert calls[0][1]["p_cert_id"] == "test-id"


def test_kosis_auth_and_no_guessed_statistical_codes(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.providers.collectors.fetch_json",
        lambda url, params: calls.append(params) or [],
    )
    KosisClient("test-key").statistics(
        orgId="user-org",
        tblId="user-table",
        objL1="user-category",
        itmId="user-item",
        prdSe="M",
        startPrdDe="202601",
        endPrdDe="202610",
    )
    assert calls[0]["apiKey"] == "test-key" and calls[0]["tblId"] == "user-table"


def test_missing_credentials_and_unverified_url_fail_explicitly():
    with pytest.raises(ProviderError):
        KamisClient("", "")
    with pytest.raises(ProviderError):
        ConsoleURLClient("ecos", "key").collect(
            {"url": "https://example.org/not-official"}
        )
    with pytest.raises(ProviderError):
        ConsoleURLClient("news", "key").collect({"url": "https://example.org/news"})
