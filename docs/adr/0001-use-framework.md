# ADR-0001: Use MS Agent Framework 1.0 as the primary agent framework

## Status: Accepted

## Context

FinSight is a multi-agent system. We need:
- Easy multi-agent orchestration
- Tool-calling
- AWS-native integration
- Cost-effective

## Decision

Use **MS Agent Framework 1.0** as the primary orchestration framework, with Strands Agents / Bedrock AgentCore for AWS-native integration.

## Consequences

- Best multi-agent patterns in the industry
- AWS-native via Bedrock
- Easy to swap models
- Tool-calling built-in

## References

- [MS Agent Framework 1.0 docs](https://docs.MS Agent Framework 1.0.com/)
- [Strands Agents](https://strandsagents.com/)
