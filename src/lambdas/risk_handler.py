"""Lambda handler for the Risk stage."""

from __future__ import annotations

from src.agents.finsight import RiskAgent
from src.lambdas._base import run_stage


def handler(event: dict, context: object) -> dict:
    return run_stage(
        event,
        required=["ticker", "excerpt"],
        fn=lambda d: RiskAgent().run(d["ticker"], d["excerpt"]),
    )
