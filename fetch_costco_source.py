import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup


PAGE_URL = "https://www.costco.co.kr/closedSchedule"
OUTPUT_PATH = Path("data/costco/source_state.json")
KST = ZoneInfo("Asia/Seoul")


def korea_now_iso():
    return datetime.now(KST).isoformat(timespec="seconds")


def read_json(path):
    if not path.exists():
        return {}

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def source_month_from_url(url):
    decoded = unquote(url)

    match = re.search(
        r"(20\d{2})\s*년\s*(\d{1,2})\s*월",
        decoded,
    )

    if not match:
        return None

    year = int(match.group(1))
    month = int(match.group(2))

    if not 1 <= month <= 12:
        return None

    return f"{year:04d}-{month:02d}"


def schedule_image_score(img, page_url):
    src = img.get("src") or img.get("data-src") or ""
    alt = img.get("alt") or ""

    if not src:
        return -1, ""

    absolute_url = urljoin(page_url, src)
    decoded_url = unquote(absolute_url)

    score = 0

    if "휴무" in decoded_url:
        score += 20

    if "휴무" in alt:
        score += 10

    if "contentstack" in absolute_url:
        score += 4

    if re.search(
        r"20\d{2}\s*년\s*\d{1,2}\s*월",
        decoded_url,
    ):
        score += 5

    return score, absolute_url


def find_schedule_image(html, page_url):
    soup = BeautifulSoup(html, "html.parser")

    candidates = []

    for img in soup.find_all("img"):
        score, url = schedule_image_score(
            img,
            page_url,
        )

        if score >= 0 and url:
            candidates.append(
                (score, url)
            )

    if not candidates:
        raise RuntimeError(
            "공식 휴무일 페이지에서 이미지 후보를 찾지 못했습니다."
        )

    candidates.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    best_score, best_url = candidates[0]

    if best_score < 10:
        raise RuntimeError(
            "휴무일 이미지로 확신할 수 있는 후보를 찾지 못했습니다."
        )

    return best_url


def main():
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
        PAGE_URL,
        timeout=30,
    )
    response.raise_for_status()

    image_url = find_schedule_image(
        response.text,
        PAGE_URL,
    )

    image_response = session.get(
        image_url,
        timeout=30,
    )
    image_response.raise_for_status()

    image_hash = hashlib.sha256(
        image_response.content
    ).hexdigest()

    previous = read_json(
        OUTPUT_PATH
    )

    previous_hash = (
        previous.get("imageSha256")
        if isinstance(previous, dict)
        else None
    )

    payload = {
        "checkedAt": korea_now_iso(),
        "pageUrl": PAGE_URL,
        "imageUrl": image_url,
        "imageSha256": image_hash,
        "sourceMonth": source_month_from_url(
            image_url
        ),
        "sourceKind": "official_schedule_image",
        "changed": (
            bool(previous_hash)
            and previous_hash != image_hash
        ),
        "requiresStructuredReview": True,
        "note": (
            "코스트코 공식 휴무일 페이지는 휴무 정보를 이미지로 제공합니다. "
            "이 파일은 공식 원본 이미지 변경을 감지하기 위한 상태 파일이며, "
            "휴무 날짜 자체를 OCR로 자동 확정하지 않습니다."
        ),
    }

    write_json(
        OUTPUT_PATH,
        payload,
    )

    print(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
