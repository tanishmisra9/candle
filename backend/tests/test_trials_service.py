from app.services.trials import derive_outcomes


def test_derive_outcomes_extracts_all_supported_types():
    raw_json = {
        "protocolSection": {
            "outcomesModule": {
                "primaryOutcomes": [
                    {
                        "measure": "Primary measure",
                        "description": "Primary description",
                        "timeFrame": "12 months",
                    }
                ],
                "secondaryOutcomes": [
                    {
                        "measure": "Secondary measure",
                        "description": "Secondary description",
                        "timeFrame": "6 months",
                    }
                ],
                "otherOutcomes": [
                    {
                        "measure": "Other measure",
                        "description": "Other description",
                        "timeFrame": "3 months",
                    }
                ],
            }
        }
    }

    outcomes = derive_outcomes(raw_json)

    assert [outcome.model_dump() for outcome in outcomes] == [
        {
            "outcome_type": "primary",
            "measure": "Primary measure",
            "description": "Primary description",
            "timeframe": "12 months",
        },
        {
            "outcome_type": "secondary",
            "measure": "Secondary measure",
            "description": "Secondary description",
            "timeframe": "6 months",
        },
        {
            "outcome_type": "other",
            "measure": "Other measure",
            "description": "Other description",
            "timeframe": "3 months",
        },
    ]


def test_derive_outcomes_skips_items_without_measure():
    raw_json = {
        "protocolSection": {
            "outcomesModule": {
                "primaryOutcomes": [
                    {"description": "Missing measure", "timeFrame": "12 months"}
                ]
            }
        }
    }

    assert derive_outcomes(raw_json) == []
