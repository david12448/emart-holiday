import json
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests


API_URL = "https://www.costco.co.kr/rest/v2/korea/stores?fields=FULL"
SITE_URL = "https://www.costco.co.kr/"
KST = ZoneInfo("Asia/Seoul")

DATA_DIR = Path("data/costco")
CURRENT_PATH = DATA_DIR / "stores.json"
ARCHIVE_PATH = DATA_DIR / "holiday_archive.json"
SNAPSHOT_PATH = DATA_DIR / "latest_snapshot.json"
CHANGE_STATUS_PATH = DATA_DIR / "change_status.json"

CHANGE_NOTICE_DAYS = 7
MIN_EXPECTED_STORES = 20

REGION_PREFIXES = (
    ("서울특별시", "서울특별시"),
    ("부산광역시", "부산광역시"),
    ("대구광역시", "대구광역시"),
    ("인천광역시", "인천광역시"),
    ("인천 ", "인천광역시"),
    ("광주광역시", "광주광역시"),
    ("대전광역시", "대전광역시"),
    ("울산광역시", "울산광역시"),
    ("세종특별자치시", "세종특별자치시"),
    ("경기도", "경기도"),
    ("강원특별자치도", "강원특별자치도"),
    ("충청북도", "충청북도"),
    ("충청남도", "충청남도"),
    ("전북특별자치도", "전북특별자치도"),
    ("전라남도", "전라남도"),
    ("경상북도", "경상북도"),
    ("경상남도", "경상남도"),
    ("제주특별자치도", "제주특별자치도"),
)


def korea_now():
    return datetime.now(KST)


def read_json(path, default):
    if not path.exists():
        return default

    try:
        return json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )
    except Exception:
        return default


def write_json(path, data):
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def clean_detail_url(value):
    if not value:
        return ""

    absolute = urljoin(
        SITE_URL,
        str(value).strip(),
    )

    parts = urlsplit(
        absolute
    )

    path = parts.path

    if path.startswith(
        "/store/"
    ):
        path = (
            "/store-finder/"
            +
            path[len("/store/"):]
        )

    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            path,
            "",
            "",
        )
    )


def normalize_address(address):
    line1 = " ".join(
        str(
            address.get("line1")
            or ""
        ).split()
    )

    line2 = " ".join(
        str(
            address.get("line2")
            or ""
        ).split()
    )

    return " ".join(
        part
        for part in (
            line1,
            line2,
        )
        if part
    )


def get_region(line1):
    text = str(
        line1
        or ""
    ).strip()

    for prefix, region in REGION_PREFIXES:
        if text.startswith(prefix):
            return region

    return ""


def get_sigungu(line1, region):
    text = str(
        line1
        or ""
    ).strip()

    if not text:
        return ""

    if region == "세종특별자치시":
        return "세종시"

    if text.startswith("인천 "):
        remainder = text[len("인천 "):]
    else:
        remainder = text

        for prefix, canonical in REGION_PREFIXES:
            if canonical == region and remainder.startswith(prefix):
                remainder = remainder[len(prefix):].strip()
                break

    return (
        remainder.split()[0]
        if remainder
        else ""
    )


def extract_named_closed_dates(store):
    opening_hours = (
        store.get("openingHours")
        or {}
    )

    special_days = (
        opening_hours.get(
            "specialDayOpeningList"
        )
        or []
    )

    dates = set()
    ignored_unnamed = []

    for item in special_days:
        if not isinstance(
            item,
            dict,
        ):
            continue

        if item.get("closed") is not True:
            continue

        date_value = str(
            item.get("date")
            or ""
        ).strip()

        if len(date_value) < 10:
            continue

        date_key = date_value[:10]

        label = str(
            item.get("name")
            or ""
        ).strip()

        # Costco OCC에는 일부 내부 운영용으로 보이는
        # 이름 없는 closed=true 항목이 들어올 수 있습니다.
        # 공식 휴무일 이미지와 대조한 결과 실제 공지 휴무일은
        # name(예: 10/11)이 있는 항목과 일치하므로,
        # 이름 없는 항목은 공개 휴무일로 확정하지 않습니다.
        if not label:
            ignored_unnamed.append(
                date_key
            )
            continue

        dates.add(
            date_key
        )

    return (
        sorted(dates),
        sorted(
            set(
                ignored_unnamed
            )
        ),
    )


def normalize_store(raw_store):
    address = (
        raw_store.get("address")
        or {}
    )

    line1 = str(
        address.get("line1")
        or ""
    ).strip()

    region = get_region(
        line1
    )

    holidays, ignored_unnamed = (
        extract_named_closed_dates(
            raw_store
        )
    )

    geo = (
        raw_store.get("geoPoint")
        or {}
    )

    store_id = str(
        raw_store.get(
            "warehouseCode"
        )
        or ""
    ).strip()

    display_name = str(
        raw_store.get(
            "displayName"
        )
        or ""
    ).strip()

    if not store_id:
        raise RuntimeError(
            "warehouseCode가 없는 코스트코 점포가 있습니다."
        )

    if not display_name:
        raise RuntimeError(
            f"{store_id}: displayName이 없습니다."
        )

    if not region:
        raise RuntimeError(
            f"{display_name}: 지역을 판별할 수 없습니다: {line1!r}"
        )

    if not holidays:
        raise RuntimeError(
            f"{display_name}: 이름이 있는 공식 휴무일이 없습니다."
        )

    item = {
        "storeId": store_id,
        "store": display_name,
        "storeType": "warehouse",
        "sido": region,
        "sigungu": get_sigungu(
            line1,
            region,
        ),
        "address": normalize_address(
            address
        ),
        "phone": str(
            address.get("phone")
            or ""
        ).strip(),
        "latitude": geo.get(
            "latitude"
        ),
        "longitude": geo.get(
            "longitude"
        ),
        "holidays": holidays,
        "holidayStatus": "정상",
        "detailUrl": clean_detail_url(
            raw_store.get("url")
        ),
        "officialName": str(
            raw_store.get("name")
            or ""
        ).strip(),
    }

    return item, ignored_unnamed


def fetch_official_stores():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 "
                "(compatible; emart-holiday/1.0; "
                "+https://github.com/david12448/emart-holiday)"
            )
        }
    )

    response = session.get(
        API_URL,
        timeout=30,
    )
    response.raise_for_status()

    payload = response.json()
    raw_stores = (
        payload.get("stores")
        or []
    )

    if len(raw_stores) < MIN_EXPECTED_STORES:
        raise RuntimeError(
            "코스트코 공식 API 점포 수가 예상보다 적습니다: "
            f"{len(raw_stores)}"
        )

    normalized = []
    ignored = {}

    seen_ids = set()
    seen_names = set()

    for raw_store in raw_stores:
        item, ignored_unnamed = (
            normalize_store(
                raw_store
            )
        )

        store_id = item["storeId"]
        store_name = item["store"]

        if store_id in seen_ids:
            raise RuntimeError(
                f"중복 storeId: {store_id}"
            )

        if store_name in seen_names:
            raise RuntimeError(
                f"중복 점포명: {store_name}"
            )

        seen_ids.add(
            store_id
        )
        seen_names.add(
            store_name
        )

        normalized.append(
            item
        )

        if ignored_unnamed:
            ignored[
                store_name
            ] = ignored_unnamed

    normalized.sort(
        key=lambda item: (
            item["sido"],
            item["store"],
        )
    )

    return normalized, ignored


def item_id(item):
    return str(
        item.get("storeId")
        or item.get("id")
        or ""
    )


def merge_archive(
    old_items,
    fresh_items,
    today,
):
    old_by_id = {
        item_id(item): item
        for item in old_items
        if item_id(item)
    }

    old_by_name = {
        str(
            item.get("store")
            or ""
        ): item
        for item in old_items
        if str(
            item.get("store")
            or ""
        ).strip()
    }

    merged = []
    today_key = today.isoformat()
    matched_old_ids = set()

    for fresh in fresh_items:
        store_id = item_id(
            fresh
        )

        store_name = str(
            fresh.get("store")
            or ""
        )

        old = old_by_id.get(
            store_id
        )

        if old is None:
            old = old_by_name.get(
                store_name
            )

        old = (
            old
            or {}
        )

        if item_id(old):
            matched_old_ids.add(
                item_id(old)
            )

        old_past = {
            value
            for value in (
                old.get(
                    "holidays"
                )
                or []
            )
            if (
                isinstance(
                    value,
                    str,
                )
                and
                value < today_key
            )
        }

        fresh_dates = {
            value
            for value in (
                fresh.get(
                    "holidays"
                )
                or []
            )
            if isinstance(
                value,
                str,
            )
        }

        item = dict(
            fresh
        )

        item[
            "holidays"
        ] = sorted(
            old_past
            |
            fresh_dates
        )

        merged.append(
            item
        )

    # 공식 API에서 점포가 사라진 경우에도
    # 이미 보관한 과거 이력은 바로 버리지 않습니다.
    for old in old_items:
        old_id = item_id(
            old
        )

        if (
            not old_id
            or
            old_id in matched_old_ids
        ):
            continue

        old_name = str(
            old.get("store")
            or ""
        )

        if any(
            str(
                item.get("store")
                or ""
            )
            == old_name
            for item in fresh_items
        ):
            continue

        past_dates = sorted(
            {
                value
                for value in (
                    old.get(
                        "holidays"
                    )
                    or []
                )
                if (
                    isinstance(
                        value,
                        str,
                    )
                    and
                    value < today_key
                )
            }
        )

        if not past_dates:
            continue

        item = dict(
            old
        )

        item[
            "holidays"
        ] = past_dates

        merged.append(
            item
        )

    merged.sort(
        key=lambda item: (
            item.get(
                "sido",
                "",
            ),
            item.get(
                "store",
                "",
            ),
        )
    )

    return merged


def make_snapshot(
    items,
    checked_at,
):
    months = sorted(
        {
            value[:7]
            for item in items
            for value in (
                item.get(
                    "holidays"
                )
                or []
            )
            if (
                isinstance(
                    value,
                    str,
                )
                and
                len(value) >= 7
            )
        }
    )

    stores = []

    for item in items:
        stores.append(
            {
                "storeId": item_id(
                    item
                ),
                "store": item.get(
                    "store",
                    "",
                ),
                "sido": item.get(
                    "sido",
                    "",
                ),
                "holidays": sorted(
                    set(
                        item.get(
                            "holidays",
                            [],
                        )
                    )
                ),
            }
        )

    stores.sort(
        key=lambda item: (
            item["sido"],
            item["store"],
            item["storeId"],
        )
    )

    return {
        "checked_at": checked_at,
        "source": API_URL,
        "months": months,
        "stores": stores,
    }


def snapshot_map(
    snapshot,
):
    return {
        str(
            item.get("storeId")
            or item.get("id")
            or ""
        ): item
        for item in (
            snapshot.get(
                "stores"
            )
            or []
        )
        if (
            item.get("storeId")
            or item.get("id")
        )
    }


def compare_snapshots(
    old_snapshot,
    new_snapshot,
    today,
):
    old_months = set(
        old_snapshot.get(
            "months"
        )
        or []
    )

    new_months = set(
        new_snapshot.get(
            "months"
        )
        or []
    )

    compare_months = (
        old_months
        &
        new_months
    )

    if not compare_months:
        return []

    today_key = (
        today.isoformat()
    )

    def snapshot_name_map(
        snapshot,
    ):
        result = {}

        for item in (
            snapshot.get(
                "stores"
            )
            or []
        ):
            store_name = str(
                item.get("store")
                or ""
            ).strip()

            key = (
                store_name
                or
                str(
                    item.get("storeId")
                    or item.get("id")
                    or ""
                )
            )

            if key:
                result[
                    key
                ] = item

        return result

    # 코스트코 최초 구현 과정에서 임시 ID에서
    # 공식 warehouseCode로 전환될 수 있으므로
    # 휴무일 변경 비교는 점포명을 우선 키로 사용합니다.
    old_map = snapshot_name_map(
        old_snapshot
    )

    new_map = snapshot_name_map(
        new_snapshot
    )

    def comparable_dates(item):
        return {
            value
            for value in (
                item.get(
                    "holidays"
                )
                or []
            )
            if (
                isinstance(
                    value,
                    str,
                )
                and
                value >= today_key
                and
                value[:7]
                in compare_months
            )
        }

    changes = []

    for store_key in sorted(
        set(old_map)
        |
        set(new_map)
    ):
        old = old_map.get(
            store_key,
            {},
        )

        new = new_map.get(
            store_key,
            {},
        )

        old_dates = comparable_dates(
            old
        )

        new_dates = comparable_dates(
            new
        )

        added = sorted(
            new_dates
            -
            old_dates
        )

        removed = sorted(
            old_dates
            -
            new_dates
        )

        if (
            not added
            and
            not removed
        ):
            continue

        base = (
            new
            or old
        )

        changes.append(
            {
                "storeId": str(
                    base.get("storeId")
                    or base.get("id")
                    or store_key
                ),
                "store": base.get(
                    "store",
                    "",
                ),
                "region": base.get(
                    "sido",
                    "",
                ),
                "added_holidays": added,
                "removed_holidays": removed,
            }
        )

    return changes


def build_change_status(
    old_snapshot,
    changes,
    existing_status,
    checked_at,
    today,
):
    previous_checked_at = (
        old_snapshot.get(
            "checked_at"
        )
        if isinstance(
            old_snapshot,
            dict,
        )
        else None
    )

    if changes:
        notice_until = (
            today
            +
            timedelta(
                days=CHANGE_NOTICE_DAYS
            )
        ).isoformat()

        return {
            "checkedAt": checked_at,
            "previousCheckedAt": previous_checked_at,
            "changed": True,
            "notice_active": True,
            "lastChangeAt": checked_at,
            "noticeUntil": notice_until,
            "summary": {
                "updatedStores": len(
                    changes
                ),
                "totalChanges": len(
                    changes
                ),
            },
            "changes": changes,
        }

    old_notice_until = ""

    if isinstance(
        existing_status,
        dict,
    ):
        old_notice_until = str(
            existing_status.get(
                "noticeUntil"
            )
            or existing_status.get(
                "notice_until"
            )
            or ""
        )

    notice_active = (
        bool(
            old_notice_until
        )
        and
        today.isoformat()
        <= old_notice_until[:10]
    )

    return {
        "checkedAt": checked_at,
        "previousCheckedAt": previous_checked_at,
        "changed": False,
        "notice_active": notice_active,
        "lastChangeAt": (
            existing_status.get(
                "lastChangeAt"
            )
            if (
                notice_active
                and
                isinstance(
                    existing_status,
                    dict,
                )
            )
            else None
        ),
        "noticeUntil": (
            old_notice_until
            if notice_active
            else None
        ),
        "summary": {
            "updatedStores": 0,
            "totalChanges": 0,
        },
        "changes": (
            existing_status.get(
                "changes",
                [],
            )
            if (
                notice_active
                and
                isinstance(
                    existing_status,
                    dict,
                )
            )
            else []
        ),
    }


def main():
    now = korea_now()
    today = now.date()
    checked_at = now.isoformat(
        timespec="seconds"
    )

    fresh_items, ignored = (
        fetch_official_stores()
    )

    old_archive = read_json(
        ARCHIVE_PATH,
        [],
    )

    old_snapshot = read_json(
        SNAPSHOT_PATH,
        {},
    )

    existing_status = read_json(
        CHANGE_STATUS_PATH,
        {},
    )

    archive = merge_archive(
        old_archive,
        fresh_items,
        today,
    )

    new_snapshot = make_snapshot(
        fresh_items,
        checked_at,
    )

    changes = compare_snapshots(
        old_snapshot,
        new_snapshot,
        today,
    )

    change_status = (
        build_change_status(
            old_snapshot,
            changes,
            existing_status,
            checked_at,
            today,
        )
    )

    write_json(
        CURRENT_PATH,
        fresh_items,
    )

    write_json(
        ARCHIVE_PATH,
        archive,
    )

    write_json(
        SNAPSHOT_PATH,
        new_snapshot,
    )

    write_json(
        CHANGE_STATUS_PATH,
        change_status,
    )

    print(
        "Costco stores:",
        len(fresh_items),
    )

    print(
        "Official holiday months:",
        ", ".join(
            new_snapshot[
                "months"
            ]
        ),
    )

    print(
        "Holiday changes:",
        len(changes),
    )

    if ignored:
        print(
            "Ignored unnamed closed dates:"
        )

        for store_name, dates in ignored.items():
            print(
                " -",
                store_name,
                ", ".join(
                    dates
                ),
            )


if __name__ == "__main__":
    main()
