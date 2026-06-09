from app.schemas import StructuredAskOutput
from app.services.intent import IntentClassification
from app.services.openai_schema import strict_json_schema


def test_strict_json_schema_sets_additional_properties_false() -> None:
    for model in (IntentClassification, StructuredAskOutput):
        fmt = strict_json_schema(model)
        schema = fmt["json_schema"]["schema"]
        assert schema["additionalProperties"] is False
        assert fmt["json_schema"]["strict"] is True
        assert "title" not in schema
