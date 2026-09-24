import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests


API_URL = "https://store.emart.com/branch/holidayList.do"

KST = ZoneInfo("Asia/Seoul")

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

BRANDS = {
    "emart": {
        "prefix": "이마트 ",
        "label": "이마트",
    },
    "traders": {
        "prefix": "트레이더스 홀세일 클럽 ",
        "label": "트레이더스",
    },
    "everyday": {
        "prefix": "에브리데이 ",
        "label": "에브리데이",
    },
    "nobrand": {
        "prefix": "노브랜드 ",
        "label": "노브랜드",
    },
}

DATA_ROOT = Path("data")

# 변경 감지 알림을 며칠 동안 유지할지
CHANGE_NOTICE_DAYS = 7


def korea_now():
    return datetime.now(KST)


def korea_today():
    return korea_now().date()


def month_pair(year, month):
    if month == 12:
        return year + 1, 1
    return year, month + 1


def month_key(year, month):
    return f"{year:04d}-{month:02d}"


def normalize_date(value):
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    digits = "".join(
        ch for ch in text
        if ch.isdigit()
    )

    if len(digits) == 8:
        return (
            f"{digits[:4]}-"
            f"{digits[4:6]}-"
            f"{digits[6:8]}"
        )

    return None


def classify_brand(name):
    for key, cfg in BRANDS.items():
        if name.startswith(
            cfg["prefix"]
        ):
            return key

    return None


def fetch_month(
    session,
    year,
    month,
):
    result = {
        key: {}
        for key in BRANDS
    }

    for area_code, region in AREA_CODES.items():
        response = session.post(
            API_URL,
            data={
                "areaCd": area_code,
                "year": str(year),
                "month": f"{month:02d}",
                "keyword": "",
            },
            timeout=30,
        )

        response.raise_for_status()

        payload = response.json()

        rows = (
            payload.get("dateList")
            or []
        )

        for row in rows:
            name = str(
                row.get("NAME")
                or ""
            ).strip()

            brand = classify_brand(
                name
            )

            if not brand:
                continue

            store_id = str(
                row.get("JIJUM_ID")
                or ""
            ).strip()

            if not store_id:
                continue

            holidays = []

            for field in (
                "HOLIDAY_DAY1_YMD",
                "HOLIDAY_DAY2_YMD",
                "HOLIDAY_DAY3_YMD",
            ):
                date_value = (
                    normalize_date(
                        row.get(field)
                    )
                )

                if date_value:
                    holidays.append(
                        date_value
                    )

            holidays = sorted(
                set(holidays)
            )

            if (
                store_id
                not in result[brand]
            ):
                result[brand][
                    store_id
                ] = {
                    "id": store_id,
                    "store": name,
                    "region": region,
                    "holidays": [],
                }

            store = (
                result[brand][
                    store_id
                ]
            )

            store["holidays"] = (
                sorted(
                    set(
                        store["holidays"]
                    )
                    |
                    set(holidays)
                )
            )

    return result


def read_json(
    path,
    default=None,
):
    if default is None:
        default = []

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


def write_json(
    path,
    data,
):
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


def merge_archive(
    old_items,
    fresh_items,
    today,
):
    old_map = {
        str(item.get("id")):
            item
        for item in old_items
        if item.get("id")
        is not None
    }

    fresh_map = {
        str(item.get("id")):
            item
        for item in fresh_items
        if item.get("id")
        is not None
    }

    all_ids = (
        set(old_map)
        |
        set(fresh_map)
    )

    merged = []

    for store_id in all_ids:
        old = old_map.get(
            store_id,
            {},
        )

        fresh = fresh_map.get(
            store_id,
            {},
        )

        base = (
            fresh
            or old
        )

        # 공식 사이트에서 날짜가 지나면
        # 과거 휴무일이 빠질 수 있으므로
        # 이미 저장된 과거 날짜는 보존합니다.
        old_past = {
            d
            for d in (
                old.get(
                    "holidays"
                )
                or []
            )
            if (
                isinstance(d, str)
                and
                d < today.isoformat()
            )
        }

        fresh_dates = {
            d
            for d in (
                fresh.get(
                    "holidays"
                )
                or []
            )
            if isinstance(
                d,
                str,
            )
        }

        dates = sorted(
            old_past
            |
            fresh_dates
        )

        merged.append({
            "id":
                str(
                    base.get("id")
                    or store_id
                ),
            "store":
                base.get("store")
                or old.get("store")
                or "",
            "region":
                base.get("region")
                or old.get("region")
                or "",
            "holidays":
                dates,
        })

    merged.sort(
        key=lambda x: (
            x["region"],
            x["store"],
        )
    )

    return merged


def filter_month(
    items,
    year,
    month,
):
    prefix = (
        f"{year:04d}-"
        f"{month:02d}-"
    )

    output = []

    for item in items:
        dates = [
            d
            for d in item.get(
                "holidays",
                [],
            )
            if d.startswith(
                prefix
            )
        ]

        if dates:
            copy = dict(
                item
            )

            copy[
                "holidays"
            ] = dates

            output.append(
                copy
            )

    return output


def make_snapshot(
    items,
    months,
    checked_at,
):
    stores = []

    for item in items:
        stores.append({
            "id":
                str(
                    item.get("id")
                    or ""
                ),
            "store":
                item.get("store")
                or "",
            "region":
                item.get("region")
                or "",
            "holidays":
                sorted(
                    set(
                        item.get(
                            "holidays",
                            [],
                        )
                    )
                ),
        })

    stores.sort(
        key=lambda x: (
            x["region"],
            x["store"],
            x["id"],
        )
    )

    return {
        "checked_at":
            checked_at,
        "months":
            months,
        "stores":
            stores,
    }


def snapshot_store_map(
    snapshot,
):
    return {
        str(item.get("id")):
            item
        for item in (
            snapshot.get(
                "stores"
            )
            or []
        )
        if item.get("id")
        is not None
    }


def compare_snapshots(
    old_snapshot,
    new_snapshot,
    today,
):
    """
    이전 공식 데이터와
    이번 공식 데이터를 비교합니다.

    중요:
    1) 두 스냅샷에 공통으로 들어 있는 월만 비교
       → 월이 바뀌면서 새로 수집하기 시작한
         다음 달 전체가 '변경'으로 잡히는 것을 방지

    2) 오늘 이전 날짜는 비교하지 않음
       → 공식 사이트가 지난 휴무일을 지워도
         '변경'으로 오인하지 않도록 함
    """

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

    old_map = (
        snapshot_store_map(
            old_snapshot
        )
    )

    new_map = (
        snapshot_store_map(
            new_snapshot
        )
    )

    store_ids = (
        set(old_map)
        |
        set(new_map)
    )

    changes = []

    def comparable_dates(
        item,
    ):
        return {
            d
            for d in (
                item.get(
                    "holidays"
                )
                or []
            )
            if (
                isinstance(
                    d,
                    str,
                )
                and
                d >= today_key
                and
                d[:7]
                in compare_months
            )
        }

    for store_id in sorted(
        store_ids
    ):
        old = old_map.get(
            store_id,
            {},
        )

        new = new_map.get(
            store_id,
            {},
        )

        old_dates = (
            comparable_dates(
                old
            )
        )

        new_dates = (
            comparable_dates(
                new
            )
        )

        added_dates = (
            sorted(
                new_dates
                -
                old_dates
            )
        )

        removed_dates = (
            sorted(
                old_dates
                -
                new_dates
            )
        )

        # 비교 대상 기간에
        # 실제 휴무 날짜 변화가 없으면
        # 알림 대상에서 제외
        if (
            not added_dates
            and
            not removed_dates
        ):
            continue

        base = (
            new
            or old
        )

        changes.append({
            "id":
                str(
                    base.get("id")
                    or store_id
                ),
            "store":
                base.get("store")
                or "",
            "region":
                base.get("region")
                or "",
            "added_holidays":
                added_dates,
            "removed_holidays":
                removed_dates,
        })

    return changes


def build_change_status(
    brand_key,
    brand_label,
    old_snapshot,
    changes,
    existing_status,
    checked_at,
    today,
):
    """
    change_status.json 생성.

    has_changes:
      이번 실행에서 실제 변경이 있었는지

    notice_active:
      페이지에 변경 안내를 띄워야 하는지

    변경이 발견되면
    CHANGE_NOTICE_DAYS 동안
    안내를 유지합니다.
    """

    previous_checked_at = (
        old_snapshot.get(
            "checked_at"
        )
        if old_snapshot
        else None
    )

    if changes:
        notice_until_date = (
            today
            +
            timedelta(
                days=CHANGE_NOTICE_DAYS
            )
        )

        return {
            "brand":
                brand_key,
            "brand_label":
                brand_label,
            "checked_at":
                checked_at,
            "previous_checked_at":
                previous_checked_at,
            "has_changes":
                True,
            "notice_active":
                True,
            "last_change_at":
                checked_at,
            "notice_until":
                notice_until_date.isoformat(),
            "change_count":
                len(changes),
            "changes":
                changes,
            "message":
                (
                    "공식 홈페이지의 휴무 일정이 "
                    "이전 확인 때와 달라졌습니다."
                ),
        }

    # 이번 실행에서는 변경 없음.
    # 단, 이전 변경 안내의 표시 기간이
    # 아직 남아 있으면 그대로 유지합니다.
    old_notice_until = (
        existing_status.get(
            "notice_until"
        )
        if isinstance(
            existing_status,
            dict,
        )
        else None
    )

    notice_active = False

    if old_notice_until:
        try:
            notice_active = (
                today.isoformat()
                <=
                old_notice_until
            )
        except Exception:
            notice_active = False

    if notice_active:
        return {
            "brand":
                brand_key,
            "brand_label":
                brand_label,
            "checked_at":
                checked_at,
            "previous_checked_at":
                previous_checked_at,
            "has_changes":
                False,
            "notice_active":
                True,
            "last_change_at":
                existing_status.get(
                    "last_change_at"
                ),
            "notice_until":
                old_notice_until,
            "change_count":
                existing_status.get(
                    "change_count",
                    0,
                ),
            "changes":
                existing_status.get(
                    "changes",
                    [],
                ),
            "message":
                existing_status.get(
                    "message",
                    (
                        "최근 공식 홈페이지의 "
                        "휴무 일정 변경이 "
                        "확인되었습니다."
                    ),
                ),
        }

    return {
        "brand":
            brand_key,
        "brand_label":
            brand_label,
        "checked_at":
            checked_at,
        "previous_checked_at":
            previous_checked_at,
        "has_changes":
            False,
        "notice_active":
            False,
        "last_change_at":
            existing_status.get(
                "last_change_at"
            )
            if isinstance(
                existing_status,
                dict,
            )
            else None,
        "notice_until":
            None,
        "change_count":
            0,
        "changes":
            [],
        "message":
            "",
    }


def main():
    now = korea_now()
    today = now.date()

    checked_at = (
        now.isoformat(
            timespec="seconds"
        )
    )

    year = today.year
    month = today.month

    next_year, next_month = (
        month_pair(
            year,
            month,
        )
    )

    tracked_months = [
        month_key(
            year,
            month,
        ),
        month_key(
            next_year,
            next_month,
        ),
    ]

    print(
        "=== 이마트 계열 휴점일 자동 수집 시작 ==="
    )

    print(
        "확인 시각:",
        checked_at,
    )

    session = (
        requests.Session()
    )

    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "Chrome/140 Safari/537.36"
        )
    })

    current = fetch_month(
        session,
        year,
        month,
    )

    following = fetch_month(
        session,
        next_year,
        next_month,
    )

    for brand_key, cfg in BRANDS.items():
        brand_dir = (
            DATA_ROOT
            /
            brand_key
        )

        brand_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        archive_path = (
            brand_dir
            /
            "holiday_archive.json"
        )

        current_path = (
            brand_dir
            /
            "holidays.json"
        )

        snapshot_path = (
            brand_dir
            /
            "latest_snapshot.json"
        )

        status_path = (
            brand_dir
            /
            "change_status.json"
        )

        old_archive = read_json(
            archive_path,
            [],
        )

        old_snapshot = read_json(
            snapshot_path,
            {},
        )

        existing_status = read_json(
            status_path,
            {},
        )

        fresh_map = {}

        for source in (
            current[brand_key],
            following[brand_key],
        ):
            for (
                store_id,
                item,
            ) in source.items():

                if (
                    store_id
                    not in fresh_map
                ):
                    fresh_map[
                        store_id
                    ] = dict(
                        item
                    )

                else:
                    fresh_map[
                        store_id
                    ][
                        "holidays"
                    ] = sorted(
                        set(
                            fresh_map[
                                store_id
                            ][
                                "holidays"
                            ]
                        )
                        |
                        set(
                            item[
                                "holidays"
                            ]
                        )
                    )

        fresh_items = list(
            fresh_map.values()
        )

        # 이번 공식 데이터의 스냅샷
        new_snapshot = (
            make_snapshot(
                fresh_items,
                tracked_months,
                checked_at,
            )
        )

        # 첫 실행에는 비교 대상이 없으므로
        # 변경 알림을 만들지 않습니다.
        if (
            old_snapshot
            and
            old_snapshot.get(
                "stores"
            )
        ):
            changes = (
                compare_snapshots(
                    old_snapshot,
                    new_snapshot,
                    today,
                )
            )

        else:
            changes = []

            print(
                f"{cfg['label']}: "
                "최초 스냅샷 생성 "
                "(변경 알림 없음)"
            )

        change_status = (
            build_change_status(
                brand_key,
                cfg["label"],
                old_snapshot,
                changes,
                existing_status,
                checked_at,
                today,
            )
        )

        archive = merge_archive(
            old_archive,
            fresh_items,
            today,
        )

        current_month_items = (
            filter_month(
                archive,
                year,
                month,
            )
        )

        write_json(
            archive_path,
            archive,
        )

        write_json(
            current_path,
            current_month_items,
        )

        write_json(
            snapshot_path,
            new_snapshot,
        )

        write_json(
            status_path,
            change_status,
        )

        print(
            f"{cfg['label']}: "
            f"현재달 {len(current_month_items)}개 점포 / "
            f"archive {len(archive)}개 점포 / "
            f"변경 {len(changes)}개 점포"
        )

        if changes:
            for change in changes:
                print(
                    "  -",
                    change["store"],
                    "| 추가:",
                    (
                        ", ".join(
                            change[
                                "added_holidays"
                            ]
                        )
                        or "-"
                    ),
                    "| 삭제:",
                    (
                        ", ".join(
                            change[
                                "removed_holidays"
                            ]
                        )
                        or "-"
                    ),
                )

    # 기존 루트 파일과의 호환용
    emart_current = (
        DATA_ROOT
        /
        "emart"
        /
        "holidays.json"
    )

    emart_archive = (
        DATA_ROOT
        /
        "emart"
        /
        "holiday_archive.json"
    )

    Path(
        "holidays.json"
    ).write_text(
        emart_current.read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    Path(
        "holiday_archive.json"
    ).write_text(
        emart_archive.read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    print(
        "=== 수집 및 변경 감지 완료 ==="
    )


if __name__ == "__main__":
    main()
