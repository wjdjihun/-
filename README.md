# PriceRadar AI · 물가레이더

**다음 달, 장바구니에 얼마가 필요할까요?**

현재 웹앱은 사용자가 연·월과 구매 수량을 고르면 식자재 6품목의 예상 지출을 계산합니다. 양파·대파·애호박·다다기오이·국산 깐마늘·팽이버섯의 KAMIS 경동시장 상품 소매가격을 사용합니다.

- **공개 시연**의 첫 화면은 2026년 7월 예측을 보여줍니다. 선택한 연·월의 예상 식자재비를 같은 품목·수량 기준으로 전월 가격과 비교할 수 있습니다. 전월 실측값이 없는 품목에는 전월 예측값을 사용합니다. 휴대폰에서는 브라우저 메뉴에서 홈 화면에 추가할 수 있습니다.
- **서비스 예측**은 KAMIS 가격의 가변 가중치 모델에 직전 달 기사 신호를 자동 반영합니다. 참고한 기사는 대시보드에서 펼쳐볼 수 있습니다.
- **과거 검증**은 대상 월 이전 자료로 계산한 가격을 해당 월 실측과 비교합니다. [검증 기록](VALIDATION.md), [가격 모델과 학습 자료](frontend/public/downloads/kamis-adaptive-model.zip), [뉴스 보정 재현 안내](experiments/news-prices/README.md)를 저장소에서 확인할 수 있습니다.
- **정적 웹앱**은 예측값과 월평균 그래프를 함께 배포하고 장바구니를 방문자의 브라우저에 저장합니다. 별도의 최신 경제뉴스 탭은 뉴시스 RSS를 사용합니다. 가격 API 자동 수집과 재학습은 후속 연동 범위입니다.

[공개 웹앱 열기](https://price-radar-ai-lab.auralarrow8.chatgpt.site/demo/)

## 빠른 실행

Node.js 22 이상을 준비하고 프로젝트 루트에서 실행하세요.

```bash
npm --prefix frontend ci
npm run dev
```

브라우저에서 [공개 시연과 같은 화면](http://localhost:3000/demo/)을 열 수 있습니다. API 키와 Python 서버가 없어도 실행됩니다.

### 별도 로컬 FastAPI 실험

Python 3.12 이상을 권장합니다. API와 예시 데이터를 실행할 때는 프로젝트 루트에서 환경을 준비하세요. 자세한 설정은 [연동 안내](docs/INTEGRATION_GUIDE.md)에 있습니다.

```bash
cp .env.example .env
npm --prefix frontend ci
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

터미널 1에서:

```bash
cd backend
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

터미널 2에서 프로젝트 루트로 이동하여:

```bash
npm run dev
```

- 웹앱: http://localhost:3000
- API 문서: http://localhost:8001/docs
- 서버 상태: http://localhost:8001/api/health

Windows에서는 가상환경 활성화에 `.venv\Scripts\activate`를 사용하고 Python 명령을 해당 환경에서 실행합니다.

현재 웹앱은 FastAPI 없이도 실행됩니다. 장바구니 저장은 현재 브라우저에 적용됩니다. 루트의 `npm run dev`는 루트 `.env`가 있을 때 읽습니다.

Docker가 설치되어 있다면:

```bash
cp .env.example .env
docker compose up --build
```

Docker 구성 파일은 제공했으며 이 실행 환경에서는 Docker 빌드를 검증하지 않았습니다.

## 파일 구조와 협업

```text
price-radar-ai/
├── frontend/
│   ├── app/                     # Next.js 진입점, 전역 디자인
│   ├── components/              # 화면 컨테이너, Recharts 그래프
│   │   └── ui/                  # shadcn/ui 패턴의 Radix 버튼·다이얼로그
│   ├── lib/                     # 데이터 어댑터, 계산, 데모 데이터
│   ├── types/                   # 공유 화면 타입
│   └── tests/                   # 브라우저 계산 로직 테스트
├── backend/
│   ├── app/
│   │   ├── api/routes.py        # REST 경로
│   │   ├── database/basket.py   # SQLite 저장소
│   │   ├── providers/           # DataProvider·공식 원본 수집
│   │   ├── schemas/basket.py    # 입력 검증
│   │   └── services/            # 데이터 조회·장바구니 계산
│   ├── ml/                     # 전처리·뉴스·학습·평가·추론
│   ├── data/demo/              # 합성 JSON과 학습 파이프라인용 CSV
│   └── tests/                  # API·수집 계약·시간 누수 테스트
├── scripts/package-static.mjs  # 정적 결과물 및 소스 ZIP 생성
├── .env.example
└── docker-compose.yml
```

4인 팀은 화면·장바구니, API·저장소, 데이터 수집·뉴스, 모델·평가로 나누어 개발할 수 있습니다. 계산 로직은 화면 JSX에서 분리되어 있습니다. 다음 프론트엔드 확장 시에는 화면별 컴포넌트를 별도 파일로 분리하면 병렬 변경 충돌을 줄일 수 있습니다.

## 로컬 FastAPI 실험 경로

| 메서드 | 경로                                 | 기능                                                |
| ------ | ------------------------------------ | --------------------------------------------------- |
| GET    | `/api/products`                      | 지원 품목                                           |
| GET    | `/api/products/{id}`                 | 품목 상세·규격·지역                                 |
| GET    | `/api/products/{id}/history?days=90` | 과거 가격                                           |
| GET    | `/api/products/{id}/forecast`        | 30일 후 가격·범위·방법                              |
| GET    | `/api/news`                          | 뉴스; product_id, direction, event, start_date 필터 |
| GET    | `/api/news/analysis`                 | 품목별 기사 수·방향 집계                            |
| GET    | `/api/news/{id}`                     | 경제 이벤트 상세                                    |
| GET    | `/api/basket`                        | 저장된 장바구니                                     |
| POST   | `/api/basket`                        | 저장·수정                                           |
| POST   | `/api/basket/forecast`               | 고정 수량의 전체 비용 계산                          |
| GET    | `/api/model/metrics`                 | 실제 학습 산출물 또는 미학습 상태                   |
| GET    | `/api/health`                        | 데이터 모드·기준일·상태                             |

장바구니 POST 본문:

```json
{ "items": [{ "product_id": "cabbage", "quantity": 2, "current_price": 4280 }] }
```

현재 비용은 `Σ(현재 단가 × 수량)`, 미래 비용은 `Σ(예상 단가 × 동일 수량)`입니다. 사용자가 단가를 수정하면 원본 데이터의 예측 가격 비율을 적용해 원 단위로 반올림한 뒤 수량을 곱합니다. 빈 장바구니의 변동률은 0입니다. 중복 품목, 음수·소수 수량, 잘못된 ID는 422, 없는 자료는 404, 실제 데이터나 모델 부재는 503을 반환합니다.

로컬 백엔드는 **한 사용자용 장바구니** 하나를 저장합니다. 공개 다중 사용자 서비스로 확장하려면 인증 및 사용자별 저장소가 필요합니다. CORS에는 허용할 프론트엔드 주소만 설정하세요. 기본 설정은 로컬 주소입니다.

## 로컬 FastAPI 데이터 수집과 교체

키는 루트 `.env`에만 넣습니다. `NEXT_PUBLIC_` 접두사는 브라우저에 공개되므로 API 키에는 사용하지 않습니다. 실제 데이터에 합성 데이터를 자동으로 섞지 않습니다. 공식 API 응답의 자격증명 URL은 로그에 출력하지 않습니다.

공식 참고 문서와 확인 상태:

- KAMIS: https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=1 — 공식 검색 색인에서 `dailyPriceByCategoryList`, 쿼리 인증 방식 확인. 소매 `01`, `p_cert_id`, `p_cert_key` 사용. 직접 원문 및 실제 호출은 환경의 연결 실패와 키 부재로 검증하지 못했습니다.
- KOSIS: https://sso.kosis.kr/openapi/devGuide/devGuide_0201List.do — 공식 문서에서 `statisticsParameterData.do`, `apiKey`, 필수 조회 변수 확인. 통계표·기관·분류 코드는 임의로 고정하지 않았습니다.
- ECOS: https://ecos.bok.or.kr/api/ — 문서가 동적으로 표시되어 이 환경에서 세부 계약을 확인하지 못했습니다. 공식 콘솔이 생성한 URL에서 키 부분을 `{API_KEY}`로 바꾸어 URL 어댑터에 전달합니다.
- 기상청: https://www.data.go.kr/ — 승인받은 기상청 API의 공식 콘솔 URL과 문서의 쿼리 변수를 설정합니다. `serviceKey`는 서버 환경변수에서 주입합니다. 특정 서비스 경로·관측소를 임의로 설정하지 않았습니다.
- 뉴스: https://www.bigkinds.or.kr/ 또는 팀이 이용 권한을 확보한 뉴스 API. 공급자별 URL·인증 계약·라이선스를 직접 설정해야 합니다. 무단 크롤러나 임의의 빅카인즈 엔드포인트는 제공하지 않습니다.

예를 들어 `backend/data/raw/kamis-request.json`에 아래 내용을 저장합니다(수집 모듈 실행 경로는 backend):

```json
{ "day": "2026-11-14", "category_code": "200", "country_code": "1101" }
```

```bash
python -m app.providers.collect --source kamis --config data/raw/kamis-request.json --output data/raw/kamis-response.json
```

KOSIS 설정 파일은 `orgId`, `tblId`, `objL1`, `itmId`, `prdSe`, `startPrdDe`, `endPrdDe`를 공식 콘솔의 코드로 채웁니다. ECOS·기상청은 `{"url":"공식 콘솔에서 생성한 URL","params":{}}` 형식입니다. ECOS URL은 키를 `{API_KEY}`로 치환합니다. 뉴스는 공급자의 문서에 따라 `auth_header`와 `auth_prefix`, 또는 `auth_query` 중 하나와 `license_confirmed: true`를 설정합니다. 키 자체를 설정 JSON에 넣지 마세요.

수집 결과는 **원본 JSON**입니다. 아직 웹앱이나 모델에 자동 투입하지 않습니다. 먼저 다음 작업이 필요합니다.

1. 품목·규격·등급·지역·단위를 정규화하고, 서로 다른 규격을 같은 ID에 섞지 않습니다. KAMIS 기본 단위가 이 앱의 단위와 다를 수 있으므로 실제 변환 또는 별도 품목 ID가 필요합니다. 우유 등은 다른 합법적 가격 데이터가 필요할 수 있습니다.
2. 뉴스의 제목·요약·발행일·공개시점·원문 링크를 정규화합니다. 규칙 기반 분석은 분류 보류 상태를 지원하지만 학습된 한국어 NLP 모델이나 LLM은 아닙니다.
3. `python -m ml.build_news_features --input data/raw/news.json --start 2025-01-01 --end 2026-11-14 --output data/processed/news.csv`로 품목별 최근 7일 뉴스 신호를 생성합니다. 발행일·공개일이 기준일 이후인 뉴스는 제외하고 유사 제목의 동일 사건을 제거합니다.
4. 경제지표는 **공개된 시점 기준**으로 과거 값만 결합합니다. 미래 값으로 빈 날짜를 보간하거나, 월말 통계를 월초의 입력으로 사용하거나, 현재 개정치를 당시 이용 가능한 통계인 것처럼 사용하지 않습니다. 수집 스케줄·전체 정규화 ETL·통계 개정 이력 보관은 후속 작업입니다.

웹앱용 정규화 JSON의 구조는 `backend/data/demo/dataset.json`을 참고하되, 모든 `mode`를 실제 검증된 자료에 한해 `live`로 설정하고 원문·출처를 채웁니다. 모델용 CSV는 아래 구조를 따릅니다. `.env`에서 `DATA_PROVIDER=file`, `DATASET_PATH`, `TRAINING_DATA_PATH`, `MODEL_DIR`를 지정하면 FileDataProvider로 전환합니다. 실제 데이터 모드에는 **실제 데이터로 학습한 모델이 반드시 필요**하며, 데모 모델로 조용히 대체하지 않습니다.

## 로컬 30일 모델 학습·평가·추론

모델용 CSV 필수 열:

```text
date,product_id,price,usd_krw,commodity_index,news_count,news_up,news_down,
news_supply,news_demand,data_mode,available_at,spec,grade,region,source
```

`available_at`은 가격·경제·뉴스 입력 중 가장 늦게 공개된 시점입니다. 과거 수정 통계를 쓰려면 당시 공개 버전을 복원해야 합니다. 뉴스 수치 열에는 기준일까지 최근 7일을 집계한 피처를 넣습니다. 서로 다른 데이터 모드를 하나의 학습 파일에 혼합할 수 없습니다.

```bash
cd backend
# 실제 정규화 자료로 학습
../.venv/bin/python -m ml.train --data data/raw/prices.csv --output ml/artifacts

# 합성 자료로 실행 흐름만 검증 (실제 성능 주장 불가)
../.venv/bin/python -m ml.generate_demo
../.venv/bin/python -m ml.train --data data/demo/training.csv --allow-demo --output ml/artifacts-demo
```

실제 데이터는 최소 180개의 **유효 피처 기준일**이 필요합니다. 최초 30일의 이력과 마지막 33일의 목표 구간이 추가로 필요합니다. 구현은 단일 날짜의 잡음을 줄이기 위해 기준일 +27~+33일의 7일 평균 소매가격을 목표로 사용합니다. 학습·검증·테스트는 날짜 순 60/20/20 경계로 분리하며, 다음 구간 시작일과 학습 레이블의 마지막 날짜(+33일)가 겹치지 않도록 경계 구간을 제외합니다. 누락일에는 행 번호 대신 달력 날짜로 7·14·30일 지연값을 연결합니다.

기준 모델은 현재 가격 유지, 모델 A는 가격·경제지표, 모델 B는 A에 뉴스 신호를 추가한 XGBoost입니다. 같은 테스트 기간에서 MAE·RMSE·MAPE를 계산합니다. `뉴스 개선치 = A의 MAPE − B의 MAPE`로, 음수이면 뉴스 추가 후 성능이 나빠졌다는 의미입니다. 개선을 가정하지 않습니다.

검증 구간의 절대 잔차 90백분위로 품목별 예측 범위를 산출하며 별도로 테스트 포함률을 기록합니다. 시계열 의존성·분포 변화가 있어 90% 포함을 보장하지 않습니다. 테스트 실제값은 학습·튜닝·범위 산정에 사용하지 않습니다. 저장된 `metrics.json`과 `model_a.joblib`, `model_b.joblib`를 API가 읽습니다. 신뢰할 수 없는 외부 joblib 파일은 로드하지 마세요.

실제 데이터 모드에서는 웹용 JSON의 규격·등급·지역·현재 가격과 모델 입력이 일치하는지 검사하고 XGBoost 추론을 수행합니다. API는 수정된 데이터·모델 파일의 시각이 바뀌면 캐시를 갱신합니다. 미학습 상태의 지표는 빈 값으로 반환하고, 합성 학습 결과는 `demo_trained`로 구분합니다. **합성 학습 결과를 실제 평가 화면의 지표로 표시하지 않습니다.**

## 검증과 빌드

```bash
# 프로젝트 루트
npm --prefix frontend test
npm run typecheck
npm run build

cd backend
../.venv/bin/python -m pytest -q
```

최종 검증 기록은 `VALIDATION.md`를 참고하세요. 브라우저 제어 도구가 없는 환경에서는 화면 클릭·모바일 실기기 검증을 수행하지 않았습니다. 프론트엔드 정적 빌드 결과는 `frontend/out/`, Sites 게시용 결과는 `dist/`에 생성됩니다. `dist/downloads/price-radar-ai-source.zip`에는 소스와 공개용 학습 산출물이 포함됩니다. 로컬 환경변수·DB·가상환경은 제외됩니다.

## 로컬 API 운영 연동 작업

1. 공식 API 발급·품목 코드 및 규격 매핑을 확정하고 수집 클라이언트를 실제 키로 계약 테스트합니다.
2. 가격·경제지표·뉴스의 공개 시점과 개정 이력을 관리하는 정규화 ETL을 완성합니다.
3. 규칙 기반 뉴스 분석을 수작업 정답셋으로 평가하고, 한국어 모델/LLM 구조화 분석을 교체 구현합니다.
4. 실제 충분한 이력으로 모델 A/B를 학습하고 테스트 성능·범위 포함률·뉴스의 증분 효과를 검토합니다.
5. 별도 Python 서버와 인증·사용자별 저장소를 배포하고 프론트엔드를 해당 HTTPS API에 연결합니다. 운영 연동 전에 인증과 데이터 기준을 확인합니다.
6. 데스크톱·모바일 브라우저에서 접근성·차트·필터·저장·새로고침을 직접 확인합니다.
