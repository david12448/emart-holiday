#!/usr/bin/env python3
"""Build a sanitized public store payload from private/source data.

The public payload intentionally removes:
- source store IDs
- official external detail URLs
- collector-only/internal fields

A stable opaque public ID (sid) is generated with HMAC-SHA256 using a secret
that must live only in the private build environment.

The redirect map is a PRIVATE artifact and must never be committed to the
public repository.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
from typing import Any


PUBLIC_FIELDS = (
    "store",
    "storeType",
    "region",
    "sido",
    "sigungu",
    "address",
    "phone",
    "holidays",
    "holidayStatus",
    "updatedAt",
)

SOURCE_ID_FIELDS = (
    "storeId",
    "id",
    "warehouseCode",
)

DETAIL_URL_FIELDS = (
    "detailUrl",
    "detail_url",
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def first_nonempty(item: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = item.get(key)
        if value is None:
            continue

        text = str(value).strip()
        if text:
            return text

    return ""


def make_sid(secret: str, brand: str, source_id: str) -> str:
    message = f"{brand}:{source_id}".encode("utf-8")
    digest = hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()

    # 64 bits of visible identifier space is plenty for this dataset while
    # keeping URLs short. The HMAC secret prevents deriving source IDs.
    return digest[:16]


def sanitize_store(
    item: dict[str, Any],
    *,
    brand: str,
    secret: str,
    store_type_override: str | None,
) -> tuple[dict[str, Any], tuple[str, str] | None]:
    source_id = first_nonempty(item, SOURCE_ID_FIELDS)

    if not source_id:
        raise ValueError(
            f"source store id missing for {item.get('store')!r}"
        )

    sid = make_sid(secret, brand, source_id)

    public_item: dict[str, Any] = {
        "sid": sid,
    }

    for field in PUBLIC_FIELDS:
        if field in item:
            public_item[field] = item[field]

    if store_type_override:
        public_item["storeType"] = store_type_override

    detail_url = first_nonempty(item, DETAIL_URL_FIELDS)

    redirect_entry = (
        (sid, detail_url)
        if detail_url
        else None
    )

    return public_item, redirect_entry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--brand", required=True)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--public-output", required=True, type=Path)
    parser.add_argument("--private-redirect-map", required=True, type=Path)
    parser.add_argument("--store-type-override")
    parser.add_argument(
        "--secret-env",
        default="PUBLIC_ID_SECRET",
        help="Environment variable containing the HMAC secret.",
    )
    args = parser.parse_args()

    secret = os.environ.get(args.secret_env, "").strip()

    if len(secret) < 24:
        raise SystemExit(
            f"{args.secret_env} must be set to a private secret of at least 24 characters"
        )

    payload = load_json(args.input)

    if not isinstance(payload, list):
        raise SystemExit("input payload must be a JSON array")

    public_items: list[dict[str, Any]] = []
    redirect_map: dict[str, str] = {}
    seen_sids: set[str] = set()

    for raw_item in payload:
        if not isinstance(raw_item, dict):
            raise SystemExit("every store item must be a JSON object")

        public_item, redirect_entry = sanitize_store(
            raw_item,
            brand=args.brand,
            secret=secret,
            store_type_override=args.store_type_override,
        )

        sid = public_item["sid"]

        if sid in seen_sids:
            raise SystemExit(f"duplicate generated sid: {sid}")

        seen_sids.add(sid)
        public_items.append(public_item)

        if redirect_entry:
            key, url = redirect_entry
            redirect_map[key] = url

    write_json(args.public_output, public_items)
    write_json(args.private_redirect_map, redirect_map)

    print(
        f"public stores: {len(public_items)} | "
        f"private redirect entries: {len(redirect_map)}"
    )


if __name__ == "__main__":
    main()
