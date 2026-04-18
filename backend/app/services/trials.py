from __future__ import annotations

from typing import Any

from app.schemas import OutcomeEntry


def derive_outcomes(raw_json: dict[str, Any]) -> list[OutcomeEntry]:
    protocol = raw_json.get("protocolSection") or {}
    outcomes_module = protocol.get("outcomesModule") or {}
    output: list[OutcomeEntry] = []
    mapping = {
        "primaryOutcomes": "primary",
        "secondaryOutcomes": "secondary",
        "otherOutcomes": "other",
    }

    for field_name, outcome_type in mapping.items():
        for item in outcomes_module.get(field_name, []) or []:
            measure = item.get("measure")
            if not measure:
                continue
            output.append(
                OutcomeEntry(
                    outcome_type=outcome_type,
                    measure=measure,
                    description=item.get("description"),
                    timeframe=item.get("timeFrame"),
                )
            )
    return output
