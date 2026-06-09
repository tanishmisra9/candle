from __future__ import annotations

from pydantic import BaseModel


def strict_json_schema(model: type[BaseModel], *, name: str | None = None) -> dict:
    """Build an OpenAI strict json_schema response_format from a Pydantic model."""
    schema = model.model_json_schema()
    schema["additionalProperties"] = False
    schema.pop("title", None)
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name or model.__name__,
            "schema": schema,
            "strict": True,
        },
    }
