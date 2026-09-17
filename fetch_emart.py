from playwright.sync_api import sync_playwright

URL = "https://store.emart.com/main/holiday.do"


def main():

    print("=== 휴점일 API 요청 정보 확인 ===")

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)

        page = browser.new_page(
            viewport={
                "width": 1440,
                "height": 1200
            }
        )

        def inspect_request(request):

            if "holidayList.do" in request.url:

                print()
                print("=== HOLIDAY REQUEST 발견 ===")
                print("URL:", request.url)
                print("METHOD:", request.method)
                print("POST DATA:", request.post_data)

                try:
                    print(
                        "HEADERS:",
                        request.headers
                    )
                except Exception as e:
                    print(
                        "HEADER 확인 오류:",
                        e
                    )

        def inspect_response(response):

            if "holidayList.do" in response.url:

                print()
                print("=== HOLIDAY RESPONSE 발견 ===")
                print("STATUS:", response.status)
                print("URL:", response.url)

                try:

                    text = response.text()

                    print()
                    print("응답 내용 앞부분:")
                    print(text[:5000])

                except Exception as e:

                    print(
                        "응답 본문 확인 오류:",
                        e
                    )

        page.on(
            "request",
            inspect_request
        )

        page.on(
            "response",
            inspect_response
        )

        print("이마트 페이지 접속 중...")

        page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=60000
        )

        page.wait_for_timeout(10000)

        print()
        print("=== 확인 완료 ===")

        browser.close()


if __name__ == "__main__":
    main()
