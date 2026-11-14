# 수집 요청 설정 양식

이 폴더는 API 요청의 **형식**을 보여줍니다. 미확인 코드·날짜·URL을 공식 콘솔에서 확정한 뒤 사용하세요.
키는 프로젝트 루트 `.env`에 넣습니다. 이 JSON 파일에 실제 키를 넣지 않습니다.

`backend/`에서 `cp config_examples/kamis.example.json data/raw/kamis-request.json`으로 복사한 뒤 편집하세요.
현재 수집 CLI는 예제 파일을 자동으로 선택하지 않으므로 `--config`로 채운 파일을 지정합니다.

| 파일                   | 확인해서 채울 내용                                                                |
| ---------------------- | --------------------------------------------------------------------------------- |
| `kamis.example.json`   | 조사일, 공식 부류 코드, 지역 코드. 수집 후 품목·품종·등급·단위를 기준표와 대조    |
| `kosis.example.json`   | 공식 기관·통계표·분류·항목 코드, 주기, 조회 시작·종료 시점                        |
| `ecos.example.json`    | 공식 콘솔에서 생성한 요청 URL 전체. 키 자리만 `{API_KEY}`로 치환                  |
| `weather.example.json` | 승인받은 기상청 서비스 URL, 문서의 조회 변수·관측소. `serviceKey`는 서버에서 주입 |
| `news.example.json`    | 이용 권한이 있는 뉴스 API URL, 인증 헤더 또는 쿼리 계약, 요청 변수                |

ECOS·기상청·뉴스의 `REPLACE_...` URL은 동작하는 실제 엔드포인트가 아닙니다.
뉴스를 쿼리 키로 인증하는 공급자라면 `auth_header`를 제거하고 문서의 키 이름으로 `auth_query`를 설정합니다.
헤더 인증이라면 문서에 필요한 경우 `auth_prefix`를 설정합니다. 이용 권한을 확인한 뒤 `license_confirmed`를 `true`로 바꿉니다.

```bash
# 가상환경을 활성화한 backend/에서 실행
python -m app.providers.collect --source kamis --config data/raw/kamis-request.json --output data/raw/kamis-response.json
```

반환 파일은 정규화 전 원본입니다. 이후 작업은 루트 `docs/INTEGRATION_GUIDE.md`의 `DATA-02`를 확인하세요.
