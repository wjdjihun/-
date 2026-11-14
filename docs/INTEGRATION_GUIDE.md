# API·AI 연동 안내

## 현재 상태

화면 5개, 장바구니 계산, 브라우저 저장, CSV 내보내기, FastAPI 경로, 로컬 SQLite 저장소, XGBoost 학습·평가·추론 코드는 구현되어 있습니다.
게시된 사이트는 합성 가격·가상 뉴스·시연 가격 비율을 쓰는 정적 데모입니다. 실제 API 수집부터 정규화·실제 학습·운영 추론까지의 연결은 남아 있습니다.

이 문서는 작업 표시를 설명합니다. 실제 코드 위치는 [CODE_MAP.md](CODE_MAP.md)에 줄 번호로 정리되어 있습니다.

## 작업 번호와 담당자

| 표시      | 담당     | 현재 구현                              | 다음 작업 / 완료 기준                                                   |
| --------- | -------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `ENV-01`  | A/D      | 환경변수 로더와 예제 파일              | 루트 `.env`에 키·경로 설정. 키를 서버에서 읽는지 확인                   |
| `DATA-01` | A        | 10개 데모 품목 ID                      | 실제 품목·품종·등급·지역·단위 코드로 기준표 확정                        |
| `API-01`  | A        | KAMIS 소매 원본 수집 클라이언트        | 실제 발급 키로 응답 확인, 과거 조회·할당량·오류 처리 검증               |
| `API-02`  | A        | ECOS 공식 콘솔 URL 어댑터              | 공식 요청 URL·통계표·항목 확정, 환율·지표 응답 정규화                   |
| `API-03`  | A        | KOSIS 원본 수집 클라이언트             | 기관·통계표·항목·분류 코드 확정, 실제 인증 호출 검증                    |
| `API-04`  | A        | 기상청 공식 콘솔 URL 어댑터            | 서비스·관측소·조회 변수 확정. 모델 피처 확장은 C와 합의                 |
| `API-05`  | B        | 뉴스 공급자 설정 어댑터                | 이용 권한이 있는 공급자, 인증 방식, 기사 필드와 과거 이력 확보          |
| `DATA-02` | A/C      | 수집 원본 JSON 저장                    | 날짜·규격·등급·지역 정규화, 가격·경제지표·뉴스의 공개 시점 기준 결합    |
| `DATA-03` | A/D      | 데모/실제 파일 DataProvider            | 검증된 실제 웹용 JSON 작성. 데모 자료의 모드만 바꾸지 않기              |
| `AI-01`   | B        | 키워드 규칙·중복 제거·7일 집계         | NLP/LLM 연결, 품목별 영향 구조화, 정답셋 평가, 결과 재사용 경로 연결    |
| `AI-02`   | C        | +27~+33일 평균 목표값                  | 휴일·결측 시 최소 관측 수 등 목표 규칙 확정, 미래 입력 차단 유지        |
| `AI-03`   | C        | 공통 필수 열·피처 검사                 | 모델 A와 B의 필수 입력 분리. 수집 실패와 기사 0건 구분                  |
| `AI-04`   | C        | 기준 모델/A/B 학습·평가·저장           | 실제 CSV로 학습, 동일 기간 테스트 지표·학습 설정·모델 산출물 제출       |
| `AI-05`   | C/D      | 모델 B 로딩·실제 모드 추론             | 모델 A 우선 연결 시 모델 선택·미학습 상태·캐시·API 설명 일치            |
| `AI-06`   | C        | 검증 잔차 범위·테스트 포함률           | 실제 자료의 품목별 오차와 범위 포함률 평가, 보장된 확률로 안내하지 않기 |
| `APP-01`  | D        | 프론트엔드 REST 호출·오류 시 데모 전환 | 실제 FastAPI 주소·CORS 설정, 재빌드 후 연결 확인                        |
| `APP-02`  | A/D      | 데모 상단 경제지표                     | 실제 지표 응답 및 화면 연결. 실제 모드에서는 현재 빈 목록               |
| `APP-03`  | D        | 품목·뉴스·장바구니·모델 REST 경로      | 실제 값의 화면/서버 일치, 수량·단가 수정, 저장·오류 흐름 통합 검증      |
| `OPS-01`  | D        | 로컬 실행·Docker 설정·정적 사이트      | Python 운영 서버 배포, HTTPS와 CORS 설정. Docker 자체 실행도 검증 필요  |
| `OPS-02`  | A/D      | 수동 수집 CLI                          | 정기 수집·재시도·수집 이력·예측 갱신 스케줄 연결                        |
| `AUTH-01` | D/후순위 | 단일 사용자 SQLite                     | 공유 운영이 필요할 때 인증·사용자별 저장소·권한 추가                    |

## API 키를 넣는 위치

프로젝트 루트의 `.env.example`을 `.env`로 복사합니다. 실제 키가 없으면 빈 값으로 두고 데모부터 실행하세요.

| 환경변수                          | 넣을 값                               | 관련 표시 |
| --------------------------------- | ------------------------------------- | --------- |
| `KAMIS_CERT_ID`, `KAMIS_CERT_KEY` | KAMIS에서 발급받은 인증 ID·키         | `API-01`  |
| `ECOS_API_KEY`                    | 한국은행 ECOS 발급 키                 | `API-02`  |
| `KOSIS_API_KEY`                   | KOSIS 발급 키                         | `API-03`  |
| `WEATHER_API_KEY`                 | 승인받은 기상청 공공데이터 서비스 키  | `API-04`  |
| `NEWS_API_KEY`                    | 팀이 선택한 뉴스 API 공급자의 키      | `API-05`  |
| `NEXT_PUBLIC_API_URL`             | 예: 로컬 서버 `http://localhost:8001` | `APP-01`  |
| `CORS_ORIGINS`                    | 백엔드가 허용할 프론트엔드 주소 목록  | `APP-01`  |

`NEXT_PUBLIC_API_URL`은 브라우저에 공개되는 서버 주소입니다. 실제 외부 API 키는 `NEXT_PUBLIC_` 변수에 넣지 않습니다.
이 압축 파일에는 실제 `.env`가 없으며, 키나 배포용 인증 토큰을 넣어 배포하지 않습니다.
`NEWS_API_KEY`는 뉴스 수집 공급자용입니다. NLP/LLM 공급자는 아직 선택·연결하지 않았으므로 B 담당이 분석 모델을 정한 뒤 별도 서버용 키 변수와 `Settings` 로딩·호출 코드를 추가해야 합니다.

## 외부 API를 연결하는 순서

1. 공식 제공 사이트에서 이용 신청·조회 조건·인증 방식을 확인합니다.
2. [backend/config_examples/README.md](../backend/config_examples/README.md)의 해당 양식을 복사해 실제 조회 조건을 채웁니다.
3. 루트 `.env`에 키를 설정합니다.
4. `backend/`에서 아래 수집 CLI를 실행합니다.

```bash
# backend/에서 실행. 가상환경을 활성화했거나 ../.venv/bin/python을 사용하세요.
python -m app.providers.collect --source kamis --config data/raw/kamis-request.json --output data/raw/kamis-response.json
```

`--source`는 `kamis`, `ecos`, `kosis`, `weather`, `news`를 지원합니다.
요청 양식에는 미확인 값을 나타내는 자리표시자가 있습니다. 공식 콘솔·실제 응답으로 값을 채운 다음 실행하세요.
수집 파일은 `mode=live_raw_unvalidated` 원본입니다. 이 파일을 그대로 모델에 넣거나 웹용 `live_dataset.json`으로 쓰면 안 됩니다.

공식 참고 문서:

- KAMIS: https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=1
- ECOS: https://ecos.bok.or.kr/api/
- KOSIS: https://sso.kosis.kr/openapi/devGuide/devGuide_0201List.do
- 기상청 공공데이터: https://www.data.go.kr/
- 뉴스: 팀이 이용 권한을 확보한 공급자의 공식 API 문서

KAMIS/KOSIS의 클라이언트는 작성되어 있지만 실제 인증 키를 사용한 호출은 검증 전입니다.
ECOS·기상청·뉴스는 공식 콘솔 URL·인증 계약을 받아 넣는 어댑터 형태이며 특정 조회 코드나 서비스 경로를 완성된 연동으로 제공하지 않습니다.

## A → C: 가격·경제 데이터 전달

먼저 [product_mapping.template.csv](product_mapping.template.csv)를 완성하세요.
한 `product_id`에는 같은 규격·등급·지역·단위를 사용합니다. 출처의 단위를 유지하는 것으로 시작하고, 변환 시 근거를 기록합니다.
이 기준표는 현재 코드에서 자동으로 읽지 않습니다. `DATA-02`의 정규화 단계에서 적용할 명세입니다.

모델용 CSV는 [training_data.template.csv](training_data.template.csv)의 열 이름을 사용합니다.
이 파일은 헤더만 있는 양식이며 학습 자료가 아닙니다.

```text
date,product_id,price,usd_krw,commodity_index,news_count,news_up,news_down,
news_supply,news_demand,data_mode,available_at,spec,grade,region,source
```

- `date`: 해당 입력을 이용해 예측하는 기준일.
- `available_at`: 그 행의 가격·경제지표·뉴스 입력 중 가장 늦게 공개된 시점. 시간대까지 기록.
- 뉴스 5개 열: 기준일까지 최근 7일의 품목별 집계. 원본 기사 행을 직접 넣지 않음.
- `data_mode`: 검증된 실제 자료는 `live`, 합성 자료는 `demo`. 한 파일에 혼합하지 않음.
- 월별 통계의 대상 월과 공개일을 구분하고, 기준일 뒤 공개된 값이나 미래 값으로 입력을 채우지 않음.

현재 코드는 모델 A에도 뉴스 열을 요구합니다. 뉴스 없이 A를 시작하려면 `AI-03` 두 위치의 검사를 먼저 분리해야 합니다.
정상 수집 후 실제 기사가 0건인 경우와 수집에 실패해 알 수 없는 경우를 구분하세요.

## B → C: 뉴스 전달

정규화 기사에는 최소한 ID·제목·이용 가능한 요약·발행일·원문 URL·관련 품목이 필요합니다.
공개 시점이나 수집 시점도 관리해 과거 기준일에 이용 가능한 정보를 구분하세요.

```bash
# backend/에서 실행
python -m ml.build_news_features --input data/raw/news.json --start YYYY-MM-DD --end YYYY-MM-DD --output data/processed/news_features.csv
```

현재 `analyze_news()`는 규칙 기반입니다. `aggregate_news()`도 이 함수를 다시 부릅니다.
LLM 결과를 저장한 뒤 집계하려면 재분류로 결과가 덮어써지지 않도록 두 경로를 함께 연결하세요.
뉴스 자체를 처리한 품목/이벤트/방향 평가와, 뉴스 피처가 가격 예측을 개선하는지 평가하는 작업을 각각 수행합니다.
같은 기사라도 품목별 영향이 다를 수 있고, 근거가 부족한 방향은 보류할 수 있어야 합니다.

## C → D: 모델 전달

학습 코드는 구현되어 있습니다. 실제 정규화 자료가 준비되면 실행합니다.

```bash
# backend/에서 실행
python -m ml.train --data data/raw/prices.csv --output ml/artifacts
```

합성 자료로 동작만 확인할 때에는 실제 산출물 폴더와 분리합니다.

```bash
python -m ml.generate_demo
python -m ml.train --data data/demo/training.csv --allow-demo --output ml/artifacts-demo
```

`--allow-demo`는 합성 자료의 실행 검증을 허용하는 옵션입니다. 실제 정확도 검증이나 실제 모드로 전환하는 옵션이 아닙니다.

D 담당에게는 `model_a.joblib`, `model_b.joblib`, `metrics.json`, 사용한 데이터 기간·버전·품목 매핑·학습 명령·환경을 전달합니다.
현재 목표는 +27~+33일 7개 가격의 평균이며 모든 관측값을 요구합니다. 휴일·결측이 있는 실제 자료의 목표값 규칙을 먼저 확정해야 합니다.
학습·검증·테스트 구간은 목표 관측 기간까지 겹치지 않게 유지합니다. 모델 A/B는 같은 테스트 기간에서 비교하세요.

현재 추론은 모델 B를 고정 로드합니다. 모델 A를 먼저 쓰려면 `AI-05`에 따라 로더·데이터 서비스·캐시·API 설명을 함께 수정해야 합니다.
어떤 모델을 선택했는지와 실제/데모/미학습 상태를 응답 및 화면에 명시하세요.

## D: 실행·배포 연결

1. 데모 상태로 프론트엔드와 FastAPI가 연결되는지 먼저 확인합니다.
2. 실제 웹용 JSON을 만듭니다. 구조는 `backend/data/demo/dataset.json`을 참고하되 내용·출처·규격·기준일은 실제 검증 자료여야 합니다.
3. 실제 학습 산출물과 `TRAINING_DATA_PATH`의 자료를 준비합니다. 웹용 JSON의 규격·등급·지역·현재 가격이 추론 입력과 일치해야 합니다.
4. `.env`에서 `DATA_PROVIDER=file`, `DATASET_PATH`, `TRAINING_DATA_PATH`, `MODEL_DIR`을 맞춥니다.
5. FastAPI를 Python 서버 환경에 배포하고 `CORS_ORIGINS`를 설정합니다.
6. `NEXT_PUBLIC_API_URL`을 해당 HTTPS API 주소로 설정한 뒤 프론트엔드를 다시 빌드·배포합니다.

현재 실제 모드는 모델 B를 요구합니다. 데이터만 있고 모델이 없으면 가격 조회·상태 확인도 실패할 수 있습니다.
모델 없이 가격부터 제공하려면 `AI-05`의 데이터/예측 분리를 먼저 개발해야 합니다.
실제 상단 환율·물가지수 표시도 `APP-02`에서 별도로 연결해야 합니다.

장바구니 합산과 직접 입력 단가의 비율 보정은 프론트엔드에도 구현되어 있습니다.
`APP-03`의 통합 검증에서 서버의 `/api/basket/forecast` 결과와 동일한 수량·단가로 비교하세요.

## 제공 소스에서 아직 하지 않은 일

- 실제 키로 공식 API를 호출하는 검증과 전체 데이터 정규화 작업.
- 실제 뉴스 이력 수집, 학습된 한국어 NLP/LLM 연결 및 평가.
- 실제 데이터로 학습·검증한 모델과 실제 성능·예측 범위 검증.
- Python 운영 서버 연결, 정기 수집·재학습·자동 갱신.
- 다중 사용자 인증·저장소 및 기기 간 동기화.

브라우저 직접 조작과 Docker 실행은 기존 환경에서 검증하지 못했습니다. 테스트 기록은 루트 `VALIDATION.md`를 확인하세요.
