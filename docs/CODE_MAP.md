# 코드 연동 표시 지도

편집기 전체 검색에서 `TODO[` 또는 아래 작업 번호를 검색하세요. 상세 작업은 [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)를 참고합니다.

현재 21개 작업 번호, 27개 소스 위치가 표시되어 있습니다.

A: 가격·경제 데이터 / B: 뉴스 / C: 가격 모델 / D: 서비스 API·화면·배포.

| 작업 번호 | 담당 | 파일 | 줄 | 필요한 작업 |
|---|---|---|---|---|
| AI-01 | B | [backend/ml/news_analysis.py](../backend/ml/news_analysis.py#L75) | 75 | 현재는 키워드 규칙입니다. NLP/LLM 구조화 분석과 수작업 정답셋 평가를 연결하세요. |
| AI-01 | B | [backend/ml/news_analysis.py](../backend/ml/news_analysis.py#L145) | 145 | LLM 분석 결과를 저장했다면 여기서 규칙으로 다시 덮어쓰지 않도록 캐시/분석 경로도 수정하세요. |
| AI-02 | C | [backend/ml/feature_engineering.py](../backend/ml/feature_engineering.py#L45) | 45 | 현재 +27~+33일 7개 관측값이 모두 있어야 목표값을 만듭니다. |
| AI-03 | C | [backend/ml/feature_engineering.py](../backend/ml/feature_engineering.py#L69) | 69 | 전처리와 함께 이 검사도 모델별로 분리해야 뉴스 없는 모델 A를 학습할 수 있습니다. |
| AI-03 | C | [backend/ml/preprocessing.py](../backend/ml/preprocessing.py#L5) | 5 | 현재 모델 A에도 뉴스 열이 필수입니다. 뉴스 없는 A를 학습하려면 모델별 필수 열 검사를 분리하세요. |
| AI-04 | C | [backend/ml/train.py](../backend/ml/train.py#L19) | 19 | 학습 파이프라인은 구현됨. 실제 정규화 CSV로 학습·평가하고 산출물과 재현 설정을 전달하세요. |
| AI-05 | C/D | [backend/app/services/dataset.py](../backend/app/services/dataset.py#L42) | 42 | 현재 실제 데이터 모드에는 실제 학습 모델 B가 필요합니다. |
| AI-05 | C/D | [backend/ml/predict.py](../backend/ml/predict.py#L11) | 11 | 현재 모델 B 파일을 고정 로드합니다. 모델 A 우선 연결 시 명시적인 모델 선택을 추가하세요. |
| AI-06 | C | [backend/ml/train.py](../backend/ml/train.py#L101) | 101 | 실제 자료로 예측 범위의 테스트 포함률·품목별 지표를 확인하세요. 포함 확률을 보장하지 않습니다. |
| API-01 | A | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L38) | 38 | 클라이언트는 작성됨. 실제 발급 키로 인증·응답·할당량을 검증하세요. |
| API-02 | A | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L124) | 124 | 공식 콘솔 URL에서 키를 {API_KEY}로 치환해 설정하세요. 고정 조회 코드는 미확정입니다. |
| API-03 | A | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L67) | 67 | 공식 콘솔의 통계표·기관·분류·항목 코드를 입력하고 실제 응답을 검증하세요. |
| API-04 | A | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L135) | 135 | 승인된 기상청 서비스 URL·관측소를 설정하고 응답을 정규화하세요. |
| API-05 | B | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L140) | 140 | 뉴스 공급자·이용 권한·문서의 인증 방식·원문 필드 매핑을 확정하세요. |
| APP-01 | D | [.env.example](../.env.example#L5) | 5 | 프론트엔드가 호출할 FastAPI 주소. API 키를 넣는 곳이 아닙니다. |
| APP-01 | D | [frontend/lib/api.ts](../frontend/lib/api.ts#L4) | 4 | 루트 .env의 NEXT_PUBLIC_API_URL을 FastAPI 주소로 설정하고 프론트엔드를 재빌드하세요. |
| APP-02 | A/D | [frontend/lib/api.ts](../frontend/lib/api.ts#L43) | 43 | 실제 모드의 상단 경제지표는 아직 미연결입니다. 공식 지표 응답과 화면을 연결하세요. |
| APP-03 | D | [backend/app/api/routes.py](../backend/app/api/routes.py#L9) | 9 | REST 경로는 구현됨. 실제 데이터·모델을 연결한 뒤 화면 응답과 예측·오류 흐름을 통합 검증하세요. |
| AUTH-01 | D/후순위 | [backend/app/database/basket.py](../backend/app/database/basket.py#L11) | 11 | 현재 id=1인 단일 사용자 저장소입니다. 공유 운영 시 인증·사용자별 키가 필요합니다. |
| DATA-01 | A | [backend/app/providers/collectors.py](../backend/app/providers/collectors.py#L39) | 39 | 품목/품종/등급/지역/단위를 확인해 docs/product_mapping.template.csv를 완성하세요. |
| DATA-02 | A/C | [backend/app/providers/collect.py](../backend/app/providers/collect.py#L35) | 35 | 아래는 원본 응답 저장입니다. 가격/경제/뉴스 정규화와 날짜별 결합은 아직 필요합니다. |
| DATA-03 | A/D | [backend/app/providers/dataset.py](../backend/app/providers/dataset.py#L9) | 9 | 제공 JSON은 합성 가격·가상 뉴스입니다. 실제 데이터 검증이 끝날 때까지 데모 표시를 유지하세요. |
| DATA-03 | A/D | [backend/app/providers/dataset.py](../backend/app/providers/dataset.py#L21) | 21 | 정규화한 실제 JSON을 연결하세요. 이 클래스는 CSV를 자동 변환하지 않습니다. |
| ENV-01 | A/D | [.env.example](../.env.example#L1) | 1 | API 키 설정 위치. 이 파일을 루트 .env로 복사한 뒤 키를 입력하세요. |
| ENV-01 | A/D | [backend/app/config.py](../backend/app/config.py#L8) | 8 | 루트 .env의 서버 전용 키를 읽습니다. 키를 소스에 직접 적지 마세요. |
| OPS-01 | D | [docker-compose.yml](../docker-compose.yml#L1) | 1 | 로컬 Docker 실행 구성입니다. Python 서버의 운영 배포·HTTPS·CORS는 별도 설정하세요. |
| OPS-02 | A/D | [backend/app/providers/collect.py](../backend/app/providers/collect.py#L10) | 10 | 현재 수동 수집 CLI입니다. 반복 실행 스케줄·재시도·수집 이력 저장은 후속 작업입니다. |

줄 번호는 코드 수정 후 달라질 수 있습니다. `node scripts/generate-code-map.mjs`로 다시 생성합니다. 정적 패키징에서도 자동 갱신됩니다.
