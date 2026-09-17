import requests
from bs4 import BeautifulSoup


URL = "https://store.emart.com/main/holiday.do"


def main():
    print("이마트 휴점일 페이지 접속 시작")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "Chrome/140.0 Safari/537.36"
        )
    }

    response = requests.get(
        URL,
        headers=headers,
        timeout=30
    )

    print("HTTP 상태 코드:", response.status_code)
    print("받은 HTML 크기:", len(response.text))

    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    tables = soup.select(
        'table[id^="d-store-"]'
    )

    print()
    print("발견된 휴점일 테이블 수:", len(tables))

    if not tables:
        print()
        print("휴점일 테이블을 찾지 못했습니다.")
        print("다음 단계에서 브라우저 방식으로 전환해야 합니다.")
        return

    print()
    print("발견된 테이블 ID:")

    for table in tables:
        print("-", table.get("id"))

    print()
    print("첫 번째 테이블 테스트")

    first_table = tables[0]

    rows = first_table.select("tbody tr")

    print("행 개수:", len(rows))

    for row in rows[:5]:

        cells = [
            cell.get_text(
                " ",
                strip=True
            )
            for cell in row.select("td")
        ]

        print(cells)


if __name__ == "__main__":
    main()
