# Private Source → Public Site 마이그레이션 설계

## 목표

현재 공개 저장소에는 수집기, 원본 점포 ID, 공식 외부 URL이 함께 존재합니다.
최종 구조에서는 공개 저장소를 **배포 결과물 전용**으로 만들고 다음 정보를 비공개 영역으로 이동합니다.

- 공식 사이트 수집기
- 공식 API/엔드포인트 조사 코드
- 원본 점포 ID
- `detailUrl` 전체 목록
- 변경 감지용 원본 스냅샷
- redirect ID ↔ 실제 공식 URL 매핑
- 배포 토큰 및 Cloudflare 계정 관련 secret

공개 저장소에는 페이지 렌더링에 필요한 최소 정보만 둡니다.

## 권장 최종 구조

```text
mart-holiday-source (Private)
├─ collectors/
├─ source-data/
├─ build/
├─ worker/
├─ tests/
└─ .github/workflows/
        │
        │ sanitize + validate + deploy
        ▼
emart-holiday (Public)
├─ index.html
├─ lotte/
├─ costco/
├─ assets/
└─ data-public/
        │
        │ 공식 점포 버튼
        ▼
redirect gateway /r/<opaque sid>
        │
        ▼
마트 공식 점포 페이지
```

## 공개 점포 ID

공식 점포 ID를 그대로 노출하지 않습니다.

Private build에서 다음과 같이 HMAC 기반 공개 ID를 만듭니다.

```text
HMAC-SHA256(
  PUBLIC_ID_SECRET,
  "<brand>:<source_store_id>"
)[:16]
```

예:

```text
원본:
brand = costco
source id = costcoKoreaWarehouse063

공개:
sid = 16자리 hex opaque id
```

중요:

- `PUBLIC_ID_SECRET`은 Private repository Actions secret에만 저장합니다.
- 공개 repository나 JS에 secret을 넣지 않습니다.
- 단순 SHA256(source_id)은 사용하지 않습니다. 원본 ID를 알고 있는 사람이 사전을 만들어 역대응하기 쉽기 때문입니다.

## Public JSON 허용 정보

예:

```json
{
  "sid": "0123456789abcdef",
  "store": "청라점",
  "storeType": "warehouse",
  "region": "인천",
  "sido": "인천광역시",
  "sigungu": "서구",
  "address": "...",
  "phone": "...",
  "holidays": [
    "2026-10-11",
    "2026-10-25"
  ]
}
```

공개 JSON에서 제거할 정보:

- `id`
- `storeId`
- `warehouseCode`
- `officialName`
- `detailUrl`
- `detail_url`
- 기타 공식 API 내부 식별자

현재 추가된 `scripts/verify_public_payload.py`는 공개 JSON에 위 필드나 `http://`, `https://` 문자열이 남으면 실패합니다.

## 실제 공식 링크 처리

공개 JSON에 공식 URL을 넣지 않습니다.

단일 점포 화면에서:

```text
https://go.example.com/r/0123456789abcdef
```

형식으로 gateway를 호출합니다.

공통 JS는 이미 다음 설정을 지원하도록 준비합니다.

```js
officialStoreRedirectBase:
  "https://go.example.com/r"
```

점포 데이터에 `detailUrl`이 없고 `sid`만 있으면:

```text
<officialStoreRedirectBase>/<sid>
```

를 자동 생성합니다.

실제 URL은 gateway 서버의 private KV/D1/환경 변수 등에서 해석합니다.

## Redirect gateway 권장 동작

입력:

```text
GET /r/<sid>
```

서버 내부:

1. sid 형식 검증
2. private map에서 sid 조회
3. 없는 sid는 404
4. 요청 속도 제한 / 악성 반복 요청 검사
5. 정상 요청은 공식 URL로 302/307 redirect

브라우저에 전체 URL 매핑을 전송해서는 안 됩니다.

최종 목적 URL은 사용자가 실제 링크를 클릭한 요청에서는 Network 탭에 보일 수 있습니다.
이 구조의 목표는 **한 번의 JSON/HTML 다운로드로 전체 공식 URL 목록을 대량 추출하기 어렵게 만드는 것**입니다.

## Public build 도구

현재 migration 준비용으로 다음 파일을 둡니다.

- `scripts/build_public_payload.py`
- `scripts/verify_public_payload.py`
- `scripts/test_public_build.py`

빌드 예시:

```bash
export PUBLIC_ID_SECRET="<private secret>"

python scripts/build_public_payload.py \
  --brand costco \
  --input source-data/costco/holiday_archive.json \
  --public-output dist-public/data/costco/stores.json \
  --private-redirect-map .build-private/costco.redirect-map.json

python scripts/verify_public_payload.py \
  dist-public/data/costco/stores.json
```

`.build-private/`와 redirect-map 파일은 `.gitignore`에 포함합니다.

## Private → Public GitHub 배포

Private repo Actions에 공개 저장소 전용 fine-grained token을 secret으로 저장합니다.

권장 권한:

- 대상 repository: `david12448/emart-holiday` 하나만 선택
- Contents: Read and write
- 필요하지 않은 다른 권한은 부여하지 않음

Private Actions:

1. 공식 데이터 수집
2. 원본 검증
3. 변경 감지
4. 공개 payload 생성
5. 공개 payload leakage 검사
6. JS/CSS 빌드 및 minify
7. Public repo의 deploy branch 업데이트
8. 검증 후 main 반영 또는 자동 배포

## JavaScript 공개본

Private repo:

```text
src/
  holiday-app.js
```

Public repo:

```text
assets/
  app.<content-hash>.min.js
```

권장:

- minify
- 주석 제거
- 변수명 축약
- source map 공개 금지
- content hash 파일명
- build 결과에 공식 링크 문자열이 없는지 grep/validator 검사

권장하지 않음:

- F12 키 강제 차단
- 무한 `debugger`
- 우클릭 전면 차단
- 정상 브라우저를 방해하는 anti-debug 루프

이런 장치는 쉽게 우회되면서 페이지 성능, 접근성, 광고/검색 동작을 해칠 수 있습니다.

## 마이그레이션 단계

### Phase A — 현재 완료 중

- 공통 UI의 내부 1개 점포 화면
- opaque `sid` 지원
- redirect gateway URL 지원
- 공개 payload builder
- public leakage validator
- private build artifact gitignore

### Phase B — Private repo 생성 후

현재 연결 이름 기준 권장:

`david12448/mart-holiday-source`

Private로 생성 후 GitHub connector에서 접근 가능하도록 합니다.

옮길 파일:

- `fetch_emart_family.py`
- `fetch_emart.py`
- `fetch_costco.py`
- `fetch_costco_source.py`
- 데이터 수집/검증 workflow
- 원본 snapshot / source_state
- `docs/IMPLEMENTATION_NOTES.md`의 수집기 내부 상세 기록

Public repo에 남길 파일:

- 화면 HTML
- 공개 빌드 CSS/JS
- sanitized public JSON
- Pages 관련 최소 workflow

### Phase C — Gateway 연결

- Cloudflare Worker 생성
- KV/D1 등에 private redirect map 저장
- `officialStoreRedirectBase` 활성화
- Public JSON의 `detailUrl` 제거
- 실제 공식 링크 문자열 leakage 검사

### Phase D — 공개 코드 축소

- Private repo에서 JS/CSS build
- Public에는 minified artifact만 배포
- source map 비공개
- 수집 스크립트 제거
- raw snapshot 제거

### Phase E — 크롤링 방어 강화

실제 대량 요청이 확인될 때만 추가합니다.

- gateway rate limiting
- 비정상 User-Agent / 요청 패턴 필터링
- 필요 시 Turnstile
- 로그 기반 threshold 조정

정상 방문자의 링크 클릭에는 가능한 한 마찰을 주지 않습니다.

## 절대 공개하지 않을 것

- GitHub fine-grained token
- Cloudflare API token
- `PUBLIC_ID_SECRET`
- Worker KV 원본 URL map
- private source repository deploy key
- 전체 점포 공식 URL 매핑 파일
