#!/usr/bin/env python3
"""Self-test the public/private split without touching production data."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        temp = Path(tmp)
        source = temp / "source.json"
        public = temp / "public.json"
        private_map = temp / "redirect-map.json"

        source.write_text(
            json.dumps(
                [
                    {
                        "id": "2014",
                        "store": "트레이더스 홀세일 클럽 동탄점",
                        "region": "경기",
                        "storeType": "standard",
                        "holidays": ["2026-10-11"],
                        "detailUrl": "https://store.example.invalid/branch?id=2014",
                    }
                ],
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        env = dict(os.environ)
        env["PUBLIC_ID_SECRET"] = (
            "test-only-secret-not-for-production-1234567890"
        )

        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "build_public_payload.py"),
                "--brand",
                "traders",
                "--input",
                str(source),
                "--public-output",
                str(public),
                "--private-redirect-map",
                str(private_map),
                "--store-type-override",
                "traders",
            ],
            check=True,
            env=env,
        )

        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "verify_public_payload.py"),
                str(public),
            ],
            check=True,
        )

        public_text = public.read_text(encoding="utf-8")
        private_text = private_map.read_text(encoding="utf-8")

        if "https://" in public_text or '"detailUrl"' in public_text:
            raise SystemExit("public payload leaked the detail URL")

        if "2014" in public_text:
            raise SystemExit("public payload leaked the source store id")

        if "https://store.example.invalid/branch?id=2014" not in private_text:
            raise SystemExit("private redirect map lost the official URL")

        if '"storeType": "traders"' not in public_text:
            raise SystemExit("store type override was not preserved")

    print("Public/private build split self-test OK")


if __name__ == "__main__":
    main()
