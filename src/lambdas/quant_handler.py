"""Lambda handler for the Quant stage."""

from __future__ import annotations

from src.agents.finsight import QuantAgent
from src.lambdas._base import run_stage


def handler(event: dict, context: object) -> dict:
    return run_stage(
        event,
        required=["figures"],
        fn=lambda d: QuantAgent().run(d["figures"], d.get("context", "")),
    )
