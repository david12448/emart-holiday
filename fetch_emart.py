import json
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo
from pathlib import Path

import requests


MAIN_URL = "https://store.emart.com/main/holiday.do"
API_URL = "https://store.emart.com/branch/holidayList.do"

ARCHIVE_FILE = Path("holiday_archive.json")
OUTPUT_FILE = Path("holidays.json")

KST = ZoneInfo("Asia/Seoul")


def korea_today():
    return datetime.now(KST).date()


# 이마트 공식 지역 코드
# 충북+충남 → 충청
# 경북+경남 → 경상
# 전북+전남 → 전라
AREA_CODES = {
    "A": "서울",
    "C": "인천",
    "I": "경기",
    "F": "대전",
    "Q": "세종",
    "O": "충청",
    "N": "충청",
    "D": "대구",
    "K": "경상",
    "J": "경상",
    "G": "울산",
    "B": "부산",
    "M": "전라",
    "L": "전라",
    "E": "광주",
    "H": "강원",
    "P": "제주",
}


REGION_ORDER = [
    "서울",
    "인천",
    "경기",
    "대전",
    "세종",
    "충청",
    "대구",
    "경상",
    "울산",
    "부산",
    "전라",
    "광주",
    "강원",
    "제주",
]


def next_month(year, month):

    if month == 12:
        return year + 1, 1

    return year, month + 1


def ymd_to_iso(value):

    if not value:
        return None

    value = str(value).strip()

    if len(value) != 8:
        return None

    try:
        return datetime.strptime(
            value,
            "%Y%m%d"
        ).date().isoformat()

    except ValueError:
        return None


def load_archive():

    if not ARCHIVE_FILE.exists():
        return {}

    try:

        data = json.loads(
            ARCHIVE_FILE.read_text(
                encoding="utf-8"
            )
        )

    except Exception as error:

        print(
            "기존 archive 읽기 실패:",
            error
        )

        return {}

    archive = {}

    for item in data:

        store_id = str(
            item.get("id", "")
        ).strip()

        if not store_id:
            continue

        archive[store_id] = item

    return archive


def make_session():

    session = requests.Session()

    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/153.0 Safari/537.36"
        ),
        "Referer": MAIN_URL,
        "Accept": (
            "application/json, "
            "text/javascript, */*; q=0.01"
        ),
        "X-Requested-With": "XMLHttpRequest",
    })

    # 쿠키 등을 먼저 받아둠
    response = session.get(
        MAIN_URL,
        timeout=30
    )

    response.raise_for_status()

    return session


def fetch_area(
    session,
    area_code,
    year,
    month
):

    response = session.post(
        API_URL,
        data={
            "areaCd": area_code,
            "year": str(year),
            "month": f"{month:02d}",
            "keyword": "",
        },
        timeout=30
    )

    response.raise_for_status()

    payload = response.json()

    result = []

    for row in payload.get(
        "dateList",
        []
    ):

        name = str(
            row.get("NAME", "")
        ).strip()

        # 노브랜드 / 에브리데이 / 트레이더스 제외
        # "이마트 "로 시작하는 점포만 사용
        if not name.startswith("이마트 "):
            continue

        store_id = str(
            row.get("JIJUM_ID", "")
        ).strip()

        if not store_id:
            continue

        holidays = []

        for field in (
            "HOLIDAY_DAY1_YMD",
            "HOLIDAY_DAY2_YMD",
            "HOLIDAY_DAY3_YMD"
        ):

            holiday = ymd_to_iso(
                row.get(field)
            )

            if holiday:
                holidays.append(holiday)

        holidays = sorted(
            set(holidays)
        )

        result.append({
            "id": store_id,
            "area_code": area_code,
            "region": AREA_CODES[area_code],
            "source_region": str(
                row.get("AREA", "")
            ).strip(),
            "store": name,
            "phone": str(
                row.get("TEL", "")
            ).strip(),
            "holidays": holidays,
        })

    return result


def update_month(
    archive,
    area_code,
    year,
    month,
    fresh_stores
):

    today = korea_today()

    prefix = (
        f"{year:04d}-{month:02d}-"
    )

    # API 이상 등으로 이마트 점포가
    # 하나도 안 들어오면 기존 데이터를 삭제하지 않음
    if not fresh_stores:

        print(
            "  경고: 이마트 점포 0개 → "
            "기존 자료 유지"
        )

        return

    # 해당 지역/월의 오늘 이후 기존 날짜는 제거.
    # 이미 지나간 날짜는 보존.
    for store in archive.values():

        if store.get(
            "area_code"
        ) != area_code:
            continue

        old_dates = store.get(
            "holidays",
            []
        )

        kept_dates = []

        for holiday in old_dates:

            if not holiday.startswith(prefix):

                kept_dates.append(
                    holiday
                )

                continue

            try:

                holiday_date = (
                    date.fromisoformat(
                        holiday
                    )
                )

            except ValueError:
                continue

            # 과거 휴무일만 보존
            if holiday_date < today:

                kept_dates.append(
                    holiday
                )

        store["holidays"] = kept_dates


    # 이마트 API 최신 데이터 추가
    for fresh in fresh_stores:

        store_id = fresh["id"]

        if store_id not in archive:

            archive[store_id] = {
                "id": store_id,
                "area_code": fresh[
                    "area_code"
                ],
                "region": fresh[
                    "region"
                ],
                "source_region": fresh[
                    "source_region"
                ],
                "store": fresh[
                    "store"
                ],
                "phone": fresh[
                    "phone"
                ],
                "holidays": [],
            }

        item = archive[store_id]

        # 점포명 / 전화번호 등이 바뀌면 최신값 사용
        item["area_code"] = (
            fresh["area_code"]
        )

        item["region"] = (
            fresh["region"]
        )

        item["source_region"] = (
            fresh["source_region"]
        )

        item["store"] = (
            fresh["store"]
        )

        item["phone"] = (
            fresh["phone"]
        )

        merged = set(
            item.get(
                "holidays",
                []
            )
        )

        merged.update(
            fresh["holidays"]
        )

        item["holidays"] = sorted(
            merged
        )


def save_files(archive):

    region_index = {
        name: index
        for index, name
        in enumerate(REGION_ORDER)
    }

    archive_list = list(
        archive.values()
    )

    archive_list.sort(
        key=lambda item: (
            region_index.get(
                item.get(
                    "region",
                    ""
                ),
                999
            ),
            item.get(
                "store",
                ""
            )
        )
    )

    ARCHIVE_FILE.write_text(
        json.dumps(
            archive_list,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )


    # 웹페이지에는 현재 달만 표시
    today = korea_today()

    current_prefix = (
        f"{today.year:04d}-"
        f"{today.month:02d}-"
    )

    output = []

    for item in archive_list:

        current_holidays = [
            holiday
            for holiday
            in item.get(
                "holidays",
                []
            )
            if holiday.startswith(
                current_prefix
            )
        ]

        if not current_holidays:
            continue

        output.append({
            "id": item["id"],
            "region": item["region"],
            "store": item["store"],
            "phone": item["phone"],
            "holidays": current_holidays,
        })

    OUTPUT_FILE.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print()
    print(
        "archive 점포 수:",
        len(archive_list)
    )

    print(
        "현재 달 표시 점포 수:",
        len(output)
    )


def main():

    today = korea_today()

    current_year = today.year
    current_month = today.month

    next_year, next_month_number = (
        next_month(
            current_year,
            current_month
        )
    )

    targets = [
        (
            current_year,
            current_month
        ),
        (
            next_year,
            next_month_number
        ),
    ]

    print(
        "=== 이마트 휴점일 "
        "자동 수집 시작 ==="
    )

    print(
        "오늘:",
        today.isoformat()
    )

    archive = load_archive()

    session = make_session()

    for year, month in targets:

        print()
        print(
            f"===== "
            f"{year}-{month:02d} "
            f"수집 ====="
        )

        for area_code, region in (
            AREA_CODES.items()
        ):

            print(
                f"{region} "
                f"({area_code}) 수집...",
                end=" "
            )

            try:

                stores = fetch_area(
                    session,
                    area_code,
                    year,
                    month
                )

                print(
                    f"{len(stores)}개"
                )

                update_month(
                    archive,
                    area_code,
                    year,
                    month,
                    stores
                )

            except Exception as error:

                print(
                    "실패:",
                    error
                )

            # 서버에 불필요한 부하를 주지 않도록
            # 요청 사이 잠시 대기
            time.sleep(0.2)

    save_files(archive)

    print()
    print(
        "=== 수집 완료 ==="
    )


if __name__ == "__main__":
    main()
