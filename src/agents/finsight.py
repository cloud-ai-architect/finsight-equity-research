"""FinSight equity research agents.

Four specialists behind an orchestrator:

    Filings   extract the reportable facts from a filing   (standard tier)
    Quant     compute and interpret ratios from figures    (standard tier)
    Risk      surface regulatory and disclosure risk        (standard tier)
    Memo      assemble a research memo from the above       (standard tier)

Routing runs on the cheapest tier; analysis does not.

The hard requirement across all four is that no figure or claim may be
produced that is not present in the supplied source. An equity memo whose
numbers cannot be traced back to a filing is worse than no memo, so each
agent carries citations and reports gaps rather than estimating.

Nothing here is investment advice; output is analyst-support material.
"""

from __future__ import annotations

from typing import Any

from src.common import MODEL_FAST, MODEL_STANDARD, BaseAgent

DISCLAIMER = (
    "Analyst-support material generated from the supplied sources. "
    "Not investment advice and not a recommendation to buy or sell."
)


class FilingsAgent(BaseAgent):
    """Extract reportable facts and figures from a filing excerpt."""

    NAME = "filings"
    MODEL = MODEL_STANDARD
    SYSTEM_PROMPT = (
        "You extract facts from SEC filings for an equity analyst.\n"
        "Extract only what the excerpt states. Never infer, annualise, or "
        "estimate a figure that is not written down. If a metric an analyst "
        "would expect is absent, list it under not_disclosed.\n"
        "Quote the supporting phrase for every figure so it can be checked.\n"
        "Respond with JSON only:\n"
        '{"period": "...", "segment_results": [{"name": "...", "metric": "...",'
        ' "value": "...", "quote": "..."}],\n'
        ' "key_figures": [{"metric": "...", "value": "...", "quote": "..."}],\n'
        ' "management_commentary": ["..."],\n'
        ' "not_disclosed": ["..."]}'
    )

    def handle(self, ticker: str, excerpt: str) -> dict[str, Any]:
        result = self.invoke_json(
            f"Ticker: {ticker}\n\nFiling excerpt:\n{excerpt}", max_tokens=3000
        )
        result["disclaimer"] = DISCLAIMER
        return result


class QuantAgent(BaseAgent):
    """Compute and interpret ratios from supplied figures."""

    NAME = "quant"
    MODEL = MODEL_STANDARD
    SYSTEM_PROMPT = (
        "You compute financial ratios for an equity analyst.\n"
        "Use only the figures supplied. Show the arithmetic for each ratio so "
        "it can be verified. If an input for a ratio is missing, do not "
        "approximate it -- list the ratio under not_computable with the "
        "input that was missing.\n"
        "Respond with JSON only:\n"
        '{"ratios": [{"name": "...", "value": "...", "workings": "...",'
        ' "interpretation": "one sentence"}],\n'
        ' "not_computable": [{"name": "...", "missing_input": "..."}],\n'
        ' "observations": ["..."]}'
    )

    def handle(self, figures: dict[str, Any], context: str = "") -> dict[str, Any]:
        rendered = "\n".join(f"  {k}: {v}" for k, v in figures.items())
        prompt = f"Reported figures:\n{rendered}"
        if context:
            prompt += f"\n\nContext:\n{context}"
        result = self.invoke_json(prompt, max_tokens=3000)
        result["disclaimer"] = DISCLAIMER
        return result


class RiskAgent(BaseAgent):
    """Surface regulatory, disclosure and concentration risk."""

    NAME = "risk"
    MODEL = MODEL_STANDARD
    SYSTEM_PROMPT = (
        "You identify risks in a filing for an equity analyst.\n"
        "Ground every risk in the text: quote the language that evidences it. "
        "Do not import generic sector risks that the filing does not raise.\n"
        "Rate severity as high, medium or low, and say what would change your "
        "assessment.\n"
        "Respond with JSON only:\n"
        '{"risks": [{"category": "regulatory|disclosure|concentration|'
        'liquidity|litigation|other",\n'
        '            "description": "...", "severity": "high|medium|low",\n'
        '            "evidence": "quoted from the filing",\n'
        '            "what_would_change_this": "..."}],\n'
        ' "disclosure_gaps": ["..."]}'
    )

    def handle(self, ticker: str, excerpt: str) -> dict[str, Any]:
        result = self.invoke_json(
            f"Ticker: {ticker}\n\nFiling excerpt:\n{excerpt}", max_tokens=3000
        )
        result["disclaimer"] = DISCLAIMER
        return result


class MemoAgent(BaseAgent):
    """Assemble a research memo from the other agents' output."""

    NAME = "memo"
    MODEL = MODEL_STANDARD
    SYSTEM_PROMPT = (
        "You draft an equity research memo from analysis another agent has "
        "already produced.\n"
        "Introduce no new facts or figures: everything in the memo must come "
        "from the supplied analysis. Lead with the conclusion, then the "
        "evidence. State explicitly what the analysis could not establish.\n"
        "Do not issue a buy/sell/hold rating or a price target.\n"
        "Respond with JSON only:\n"
        '{"headline": "one sentence",\n'
        ' "summary": "short paragraph",\n'
        ' "supporting_points": ["..."],\n'
        ' "risks": ["..."],\n'
        ' "open_questions": ["what the analysis could not answer"],\n'
        ' "memo": "the full memo text"}'
    )

    def handle(
        self,
        ticker: str,
        filings: dict[str, Any] | None = None,
        quant: dict[str, Any] | None = None,
        risk: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        import json

        parts = [f"Ticker: {ticker}"]
        for label, payload in (("Filings", filings), ("Quant", quant), ("Risk", risk)):
            if payload:
                parts.append(f"{label} analysis:\n{json.dumps(payload, indent=1)[:4000]}")
        result = self.invoke_json("\n\n".join(parts), max_tokens=4000)
        result["disclaimer"] = DISCLAIMER
        return result


class OrchestratorAgent(BaseAgent):
    """Route an inbound research request to the right specialist."""

    NAME = "orchestrator"
    MODEL = MODEL_FAST
    SYSTEM_PROMPT = (
        "You route equity research requests to one specialist agent.\n"
        "Options:\n"
        "  filings - extracting facts and figures from a filing\n"
        "  quant   - computing ratios from supplied figures\n"
        "  risk    - identifying risks in a filing\n"
        "  memo    - assembling a research memo from prior analysis\n"
        "Respond with JSON only:\n"
        '{"agent": "filings|quant|risk|memo", "reason": "one sentence"}'
    )

    VALID = {"filings", "quant", "risk", "memo"}

    def handle(self, request: str) -> dict[str, Any]:
        result = self.invoke_json(f"Request:\n{request}")
        if result.get("agent") not in self.VALID:
            # Filings is the safe default: it is the only agent that reads a
            # source document rather than depending on prior analysis.
            result = {
                "agent": "filings",
                "reason": "router returned an unknown agent; defaulting to filings",
            }
        return result


AGENTS: dict[str, type[BaseAgent]] = {
    "filings": FilingsAgent,
    "quant": QuantAgent,
    "risk": RiskAgent,
    "memo": MemoAgent,
    "orchestrator": OrchestratorAgent,
}

__all__ = ["AGENTS", "FilingsAgent", "MemoAgent", "OrchestratorAgent", "QuantAgent", "RiskAgent"]
