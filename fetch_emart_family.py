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


def korea_today():
    return datetime.now(KST).date()


def month_pair(year, month):
    if month == 12:
        return year + 1, 1
    return year, month + 1


def normalize_date(value):
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    digits = "".join(ch for ch in text if ch.isdigit())

    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"

    return None


def classify_brand(name):
    for key, cfg in BRANDS.items():
        if name.startswith(cfg["prefix"]):
            return key
    return None


def fetch_month(session, year, month):
    result = {key: {} for key in BRANDS}

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
        rows = payload.get("dateList") or []

        for row in rows:
            name = str(row.get("NAME") or "").strip()
            brand = classify_brand(name)

            if not brand:
                continue

            store_id = str(row.get("JIJUM_ID") or "").strip()
            if not store_id:
                continue

            holidays = []
            for field in (
                "HOLIDAY_DAY1_YMD",
                "HOLIDAY_DAY2_YMD",
                "HOLIDAY_DAY3_YMD",
            ):
                date_value = normalize_date(row.get(field))
                if date_value:
                    holidays.append(date_value)

            holidays = sorted(set(holidays))

            if store_id not in result[brand]:
                result[brand][store_id] = {
                    "id": store_id,
                    "store": name,
                    "region": region,
                    "holidays": [],
                }

            store = result[brand][store_id]
            store["holidays"] = sorted(
                set(store["holidays"]) | set(holidays)
            )

    return result


def read_json(path):
    if not path.exists():
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def merge_archive(old_items, fresh_items, today):
    old_map = {
        str(item.get("id")): item
        for item in old_items
        if item.get("id") is not None
    }

    fresh_map = {
        str(item.get("id")): item
        for item in fresh_items
        if item.get("id") is not None
    }

    all_ids = set(old_map) | set(fresh_map)
    merged = []

    for store_id in all_ids:
        old = old_map.get(store_id, {})
        fresh = fresh_map.get(store_id, {})

        base = fresh or old

        old_past = {
            d for d in (old.get("holidays") or [])
            if isinstance(d, str) and d < today.isoformat()
        }

        fresh_dates = {
            d for d in (fresh.get("holidays") or [])
            if isinstance(d, str)
        }

        dates = sorted(old_past | fresh_dates)

        merged.append({
            "id": str(base.get("id") or store_id),
            "store": base.get("store") or old.get("store") or "",
            "region": base.get("region") or old.get("region") or "",
            "holidays": dates,
        })

    merged.sort(key=lambda x: (x["region"], x["store"]))
    return merged


def filter_month(items, year, month):
    prefix = f"{year:04d}-{month:02d}-"
    output = []

    for item in items:
        dates = [
            d for d in item.get("holidays", [])
            if d.startswith(prefix)
        ]

        if dates:
            copy = dict(item)
            copy["holidays"] = dates
            output.append(copy)

    return output


def main():
    today = korea_today()
    year = today.year
    month = today.month
    next_year, next_month = month_pair(year, month)

    print("=== 이마트 계열 휴점일 자동 수집 시작 ===")
    print("오늘:", today.isoformat())

    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/140 Safari/537.36"
        )
    })

    current = fetch_month(session, year, month)
    following = fetch_month(session, next_year, next_month)

    for brand_key, cfg in BRANDS.items():
        brand_dir = DATA_ROOT / brand_key
        brand_dir.mkdir(parents=True, exist_ok=True)

        archive_path = brand_dir / "holiday_archive.json"
        current_path = brand_dir / "holidays.json"

        old_archive = read_json(archive_path)

        fresh_map = {}

        for source in (current[brand_key], following[brand_key]):
            for store_id, item in source.items():
                if store_id not in fresh_map:
                    fresh_map[store_id] = dict(item)
                else:
                    fresh_map[store_id]["holidays"] = sorted(
                        set(fresh_map[store_id]["holidays"])
                        | set(item["holidays"])
                    )

        fresh_items = list(fresh_map.values())

        archive = merge_archive(
            old_archive,
            fresh_items,
            today,
        )

        current_month_items = filter_month(
            archive,
            year,
            month,
        )

        archive_path.write_text(
            json.dumps(
                archive,
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )

        current_path.write_text(
            json.dumps(
                current_month_items,
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )

        print(
            f"{cfg['label']}: "
            f"현재달 {len(current_month_items)}개 점포 / "
            f"archive {len(archive)}개 점포"
        )

    # 기존 루트 페이지와의 호환용:
    # 이마트 데이터는 기존 파일명에도 복사합니다.
    emart_current = DATA_ROOT / "emart" / "holidays.json"
    emart_archive = DATA_ROOT / "emart" / "holiday_archive.json"

    Path("holidays.json").write_text(
        emart_current.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    Path("holiday_archive.json").write_text(
        emart_archive.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    print("=== 수집 완료 ===")


if __name__ == "__main__":
    main()
