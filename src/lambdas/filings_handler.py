"""Lambda handler for the Filings stage."""

from __future__ import annotations

from src.agents.finsight import FilingsAgent
from src.lambdas._base import run_stage


def handler(event: dict, context: object) -> dict:
    return run_stage(
        event,
        required=["ticker", "excerpt"],
        fn=lambda d: FilingsAgent().run(d["ticker"], d["excerpt"]),
    )
