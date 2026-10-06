import json
import re
from pathlib import Path


DATA_PATH = Path("data/costco/stores.json")

EXPECTED_STORES = {
    "양평점",
    "대구점",
    "대전점",
    "양재점",
    "상봉점",
    "일산점",
    "부산점",
    "울산점",
    "광명점",
    "천안점",
    "의정부점",
    "공세점",
    "송도점",
    "세종점",
    "대구 혁신도시점",
    "하남점",
    "김해점",
    "고척점",
    "청라점",
    "평택점",
}

DATE_RE = re.compile(
    r"^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$"
)


def fail(message):
    raise SystemExit(
        f"[Costco data validation failed] {message}"
    )


def main():
    if not DATA_PATH.exists():
        fail(
            f"{DATA_PATH} 파일이 없습니다."
        )

    try:
        stores = json.loads(
            DATA_PATH.read_text(
                encoding="utf-8"
            )
        )
    except Exception as exc:
        fail(
            f"JSON을 읽을 수 없습니다: {exc}"
        )

    if not isinstance(stores, list):
        fail(
            "최상위 데이터가 배열이 아닙니다."
        )

    if len(stores) < 20:
        fail(
            f"점포 수가 예상보다 적습니다: {len(stores)}"
        )

    store_ids = set()
    store_names = set()

    for index, store in enumerate(stores):
        if not isinstance(store, dict):
            fail(
                f"{index}번째 점포 데이터가 객체가 아닙니다."
            )

        store_id = str(
            store.get("storeId")
            or store.get("id")
            or ""
        ).strip()

        name = str(
            store.get("store")
            or ""
        ).strip()

        sido = str(
            store.get("sido")
            or store.get("region")
            or ""
        ).strip()

        holidays = store.get(
            "holidays"
        )

        address = str(
            store.get("address")
            or ""
        ).strip()

        phone = str(
            store.get("phone")
            or ""
        ).strip()

        detail_url = str(
            store.get("detailUrl")
            or ""
        ).strip()

        if not store_id:
            fail(
                f"{index}번째 점포의 storeId가 비어 있습니다."
            )

        if store_id in store_ids:
            fail(
                f"중복 storeId: {store_id}"
            )

        store_ids.add(
            store_id
        )

        if not name:
            fail(
                f"{store_id} 점포명이 비어 있습니다."
            )

        if name in store_names:
            fail(
                f"중복 점포명: {name}"
            )

        store_names.add(
            name
        )

        if not sido:
            fail(
                f"{name} 지역 정보가 비어 있습니다."
            )

        if not address:
            fail(
                f"{name} 주소가 비어 있습니다."
            )

        if not phone:
            fail(
                f"{name} 전화번호가 비어 있습니다."
            )

        if not detail_url.startswith(
            "https://www.costco.co.kr/store/"
        ):
            fail(
                f"{name} 공식 상세 URL 형식 오류: {detail_url!r}"
            )

        if not isinstance(
            holidays,
            list,
        ):
            fail(
                f"{name} holidays가 배열이 아닙니다."
            )

        if not holidays:
            fail(
                f"{name} 휴무일이 비어 있습니다."
            )

        if holidays != sorted(
            set(holidays)
        ):
            fail(
                f"{name} 휴무일이 중복되었거나 정렬되지 않았습니다."
            )

        for date_value in holidays:
            if (
                not isinstance(
                    date_value,
                    str,
                )
                or
                not DATE_RE.match(
                    date_value
                )
            ):
                fail(
                    f"{name} 휴무일 형식 오류: {date_value!r}"
                )

    missing = (
        EXPECTED_STORES
        -
        store_names
    )

    unexpected = (
        store_names
        -
        EXPECTED_STORES
    )

    if missing:
        fail(
            "누락 점포: "
            +
            ", ".join(
                sorted(missing)
            )
        )

    if unexpected:
        print(
            "새 점포 후보: "
            +
            ", ".join(
                sorted(unexpected)
            )
        )

    print(
        f"Costco data validation OK: {len(stores)} stores"
    )


if __name__ == "__main__":
    main()
