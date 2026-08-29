"""Lambda handler for the Risk stage."""

from __future__ import annotations

from typing import Any

from src.agents.finsight import RiskAgent
from src.lambdas._base import run_stage


def handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    return run_stage(
        event,
        required=["ticker", "excerpt"],
        fn=lambda d: RiskAgent().run(d["ticker"], d["excerpt"]),
    )
