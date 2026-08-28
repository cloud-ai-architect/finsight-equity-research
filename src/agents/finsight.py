"""Main agent for FinSight."""

from src.common import BaseAgent, FinsightTask


SYSTEM_PROMPT = """You are FinSight, an expert agent.

Your job: handle the task at hand using the tools available to you.
Be specific, accurate, and concise.
"""


class FinsightAgent(BaseAgent):
    NAME = "pydantic-ai"

    def handle(self, task: FinsightTask, message: str = "") -> str:
        return self.invoke_claude(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message or "Begin."}],
        )
