from playwright.sync_api import sync_playwright

URL = "https://store.emart.com/main/holiday.do"


def main():

    print("=== 이마트 Playwright 진단 시작 ===")

    with sync_playwright() as p:

        browser = p.chromium.launch(
            headless=True
        )

        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1200
            }
        )

        # 이마트 페이지가 백그라운드에서 호출하는
        # XHR / fetch 주소를 확인하기 위한 로그
        def log_response(response):

            resource_type = response.request.resource_type

            if resource_type in ("xhr", "fetch"):

                print(
                    "[XHR/FETCH]",
                    response.status,
                    response.url
                )

        page.on(
            "response",
            log_response
        )

        print("페이지 접속 중...")

        page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=60000
        )

        # 자바스크립트가 데이터를 불러올 시간을 줌
        page.wait_for_timeout(10000)

        print()
        print("페이지 제목:", page.title())
        print("현재 주소:", page.url)

        print()
        print("=== TABLE 검사 ===")

        tables = page.locator("table")

        table_count = tables.count()

        print("전체 table 개수:", table_count)

        for i in range(table_count):

            table = tables.nth(i)

            try:
                text = table.inner_text().strip()
            except Exception:
                text = ""

            print()
            print(f"[TABLE {i}]")

            if text:
                print(text[:1000])
            else:
                print("(내용 없음)")

        print()
        print("=== 휴점일 주변 화면 텍스트 ===")

        body_text = page.locator("body").inner_text()

        position = body_text.find("휴점일 안내")

        if position >= 0:

            start = max(
                0,
                position - 500
            )

            end = min(
                len(body_text),
                position + 5000
            )

            print(
                body_text[start:end]
            )

        else:

            print(
                "'휴점일 안내' 문구를 찾지 못했습니다."
            )

        print()
        print("=== 행(tr) 검사 ===")

        rows = page.locator("table tr")

        print(
            "전체 table tr 개수:",
            rows.count()
        )

        for i in range(
            min(rows.count(), 20)
        ):

            try:

                row_text = (
                    rows
                    .nth(i)
                    .inner_text()
                    .strip()
                )

                if row_text:
                    print(
                        f"ROW {i}:",
                        row_text
                    )

            except Exception:
                pass

        browser.close()

    print()
    print("=== 진단 완료 ===")


if __name__ == "__main__":
    main()
