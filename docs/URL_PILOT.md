# 읽기 쉬운 URL 파일럿

검토 중인 정적 경로: /emart/, /emart/seoul/, /emart/seoul/garden5/, /emart/seoul/wangsimni/.

각 경로 뒤 calendar/를 붙이면 블로그 iframe용 달력 화면이다. 이번 달/다음 달 선택을 제공하고 미확인 일정은 정상 영업으로 표시하지 않는다.

기존 region/storeId/date 쿼리 주소는 그대로 사용할 수 있다. 신규 점포 주소의 canonical을 제공하며 달력 전용 주소는 검색 중복을 줄이기 위해 noindex,follow를 사용한다. 날짜 선택·전체 보기·점포 상세·목록 복귀는 공통 UI를 사용한다.

실제 배포 호스트에서는 저장소 base 경로를 포함한다. 현재 설정의 예: https://david12448.github.io/emart-holiday/emart/seoul/garden5/. 이 PR이 검토·병합·배포되기 전에는 새 경로가 운영 사이트에 존재한다고 간주하지 않는다.

mart.evococoons.com은 미래 예시이며 이번 변경은 도메인이나 DNS를 설정하지 않는다. 수집 코드·원본 URL 매핑·생성 registry는 공개 저장소에 포함하지 않는다.

브라우저 회귀 검사는 Actions의 Test Public URL Pilot에서 직접 접속/새로고침, 데스크톱/모바일, 기존 링크, 날짜 필터/전체 보기, 목록 복귀와 달력 임베드를 확인한다.
