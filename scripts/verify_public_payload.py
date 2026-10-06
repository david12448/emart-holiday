#!/usr/bin/env python3
"""Fail if a public JSON payload leaks private/source-only fields or URLs."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


FORBIDDEN_KEYS = {
    "detailUrl",
    "detail_url",
    "id",
    "storeId",
    "warehouseCode",
    "officialName",
}

URL_RE = re.compile(r"https?://", re.IGNORECASE)
SID_RE = re.compile(r"^[0-9a-f]{16}$")


def walk(value: Any, path: str = "$") -> list[str]:
    problems: list[str] = []

    if isinstance(value, dict):
        sid = value.get("sid")

        if sid is None:
            problems.append(f"{path}: missing sid")
        elif not isinstance(sid, str) or not SID_RE.fullmatch(sid):
            problems.append(f"{path}.sid: invalid opaque id")

        for key, child in value.items():
            if key in FORBIDDEN_KEYS:
                problems.append(f"{path}.{key}: forbidden public key")

            problems.extend(walk_child(child, f"{path}.{key}"))

    elif isinstance(value, list):
        for index, child in enumerate(value):
            problems.extend(walk_child(child, f"{path}[{index}]"))

    return problems


def walk_child(value: Any, path: str) -> list[str]:
    problems: list[str] = []

    if isinstance(value, str):
        if URL_RE.search(value):
            problems.append(f"{path}: URL leaked into public payload")
        return problems

    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_KEYS:
                problems.append(f"{path}.{key}: forbidden public key")
            problems.extend(walk_child(child, f"{path}.{key}"))
        return problems

    if isinstance(value, list):
        for index, child in enumerate(value):
            problems.extend(walk_child(child, f"{path}[{index}]"))

    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()

    all_problems: list[str] = []

    for path in args.paths:
        payload = json.loads(path.read_text(encoding="utf-8"))

        if not isinstance(payload, list):
            all_problems.append(f"{path}: top-level JSON must be an array")
            continue

        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                all_problems.append(f"{path}[{index}]: item must be an object")
                continue

            all_problems.extend(
                f"{path}: {problem}"
                for problem in walk(item, f"$[{index}]")
            )

    if all_problems:
        print("PUBLIC PAYLOAD VERIFICATION FAILED")
        for problem in all_problems:
            print(" -", problem)
        raise SystemExit(1)

    print("Public payload verification OK")


if __name__ == "__main__":
    main()
