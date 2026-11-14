# PriceRadar AI · 여기부터 읽어주세요

이 압축 파일은 지금까지 구현한 전체 소스와 API·AI 연동 작업 표시를 포함합니다.
실제 API 키나 실제 데이터로 학습한 모델은 포함하지 않습니다. 기본 데모는 키 없이 실행됩니다.

## 먼저 열 파일

| 파일                                | 용도                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `README.md`                         | 설치·실행·프로젝트 구조·전체 API 설명                     |
| `.env.example`                      | API 키, FastAPI 주소, 데이터·모델 경로 설정 위치          |
| `docs/INTEGRATION_GUIDE.md`         | 무엇이 구현됐고 어떤 연동이 필요한지, A/B/C/D 담당별 작업 |
| `docs/CODE_MAP.md`                  | 실제 소스의 작업 표시와 줄 번호 목록                      |
| `docs/product_mapping.template.csv` | 배추·양파·감자 품목 기준표 양식                           |
| `docs/training_data.template.csv`   | 현재 학습 코드가 요구하는 CSV 열 이름                     |
| `backend/config_examples/README.md` | 수집 API별 요청 설정 양식 사용법                          |
| `VALIDATION.md`                     | 기존 테스트 결과와 확인하지 못한 항목                     |

## 표시를 찾는 방법

편집기의 전체 검색에서 `TODO[`를 검색하세요. 예:

```python
# TODO[API-01] [A] 클라이언트는 작성됨. 실제 발급 키로 인증·응답·할당량을 검증하세요.
```

`API-01`은 작업 번호, `[A]`는 담당자입니다. 표시가 있는 함수도 상당 부분 구현되어 있습니다.
주석에 적힌 실제 연결·검증 작업이 남았다는 의미입니다. 표시를 추가하는 과정에서 앱의 계산이나 예측 동작은 바꾸지 않았습니다.

| 담당 | 맡을 영역                   | 처음 볼 표시                       |
| ---- | --------------------------- | ---------------------------------- |
| A    | 가격·경제 API와 데이터 정제 | `DATA-01`, `API-01`, `DATA-02`     |
| B    | 뉴스 수집·NLP/LLM 분석      | `API-05`, `AI-01`                  |
| C    | 가격 모델 학습·평가         | `AI-02`, `AI-03`, `AI-04`, `AI-05` |
| D    | FastAPI·화면 연결·배포      | `APP-01`, `APP-03`, `OPS-01`       |

## 데모를 먼저 실행하기

Node.js 22+, Python 3.12+를 준비하고 압축을 푼 `price-radar-ai/`에서 실행합니다.

```bash
cp .env.example .env
npm --prefix frontend ci
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

터미널 1: 프로젝트 루트에서 프론트엔드 실행.

```bash
npm run dev
```

터미널 2: 같은 프로젝트 루트에서 백엔드 실행.

```bash
cd backend
../.venv/bin/uvicorn app.main:app --reload --port 8001
```

- 웹앱: http://localhost:3000
- API 문서: http://localhost:8001/docs
- 서버 확인: http://localhost:8001/api/health
- Windows에서는 `.venv\Scripts\activate`로 가상환경을 활성화하고 `backend/`에서 `python -m uvicorn app.main:app --reload --port 8001`을 실행합니다.

백엔드 없이 화면만 보려면 `.env`의 `NEXT_PUBLIC_API_URL=`을 비우고 프론트엔드를 다시 실행합니다.
기존 게시 사이트는 이 독립 정적 데모 방식이며, FastAPI 서버는 별도 실행이 필요합니다.

## 실제 연동을 시작할 순서

1. `docs/product_mapping.template.csv`의 배추 한 행을 실제 API 응답으로 확정합니다.
2. 루트 `.env`에 KAMIS 인증 ID·키를 설정합니다. 공개 저장소에는 `.env`를 올리지 않습니다.
3. 공식 조회 조건으로 요청 설정 파일을 채워 원본 응답을 수집합니다.
4. `DATA-02`에 따라 원본을 정제해 실제 가격 CSV와 웹용 JSON을 만듭니다.
5. C 담당이 목표값·결측·모델별 입력 검사를 검토하고 실제 자료로 모델을 학습합니다.
6. D 담당이 선택한 모델과 웹용 JSON을 연결한 뒤 실제 모드로 전환합니다.

현재 코드는 실제 모드에서 모델 B를 요구하며 모델 A도 뉴스 열을 검사합니다.
모델 A부터 연결하려면 `AI-03`, `AI-05`의 개선이 먼저 필요합니다. 키 설정만으로 전체 수집·학습·예측이 자동으로 완성되지는 않습니다.
