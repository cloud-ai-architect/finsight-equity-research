"""Lambda handler for the Memo stage."""

from __future__ import annotations

from typing import Any

from src.agents.finsight import MemoAgent
from src.lambdas._base import run_stage


def handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    return run_stage(
        event,
        required=["ticker"],
        fn=lambda d: MemoAgent().run(d["ticker"], d.get("filings"), d.get("quant"), d.get("risk")),
    )
