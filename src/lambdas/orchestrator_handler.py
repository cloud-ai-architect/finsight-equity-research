"""Lambda handler for the Orchestrator.

Routes a free-text research request to a specialist and runs it, so an
unstructured request returns a result in a single round trip.
"""

from __future__ import annotations

from src.agents.finsight import AGENTS, OrchestratorAgent
from src.lambdas._base import run_stage

DISPATCH = {
    "filings": lambda d: (d.get("ticker", ""), d.get("excerpt") or d["request"]),
    "quant": lambda d: (d.get("figures") or {}, d.get("context") or d["request"]),
    "risk": lambda d: (d.get("ticker", ""), d.get("excerpt") or d["request"]),
    "memo": lambda d: (
        d.get("ticker", ""),
        d.get("filings"),
        d.get("quant"),
        d.get("risk"),
    ),
}


def _route_and_run(data: dict) -> dict:
    decision = OrchestratorAgent().run(data["request"])
    name = decision["agent"]
    return {
        "routed_to": name,
        "routing_reason": decision.get("reason"),
        "output": AGENTS[name]().run(*DISPATCH[name](data)),
    }


def handler(event: dict, context: object) -> dict:
    return run_stage(event, required=["request"], fn=_route_and_run)
