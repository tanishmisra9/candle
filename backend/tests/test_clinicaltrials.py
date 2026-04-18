from app.ingest.clinicaltrials import study_to_row


def test_study_to_row_handles_flat_location_shape():
    study = {
        "protocolSection": {
            "identificationModule": {
                "nctId": "NCT12345678",
                "briefTitle": "Example CHM Trial",
            },
            "statusModule": {
                "overallStatus": "RECRUITING",
                "startDateStruct": {"date": "2024-01-15"},
                "completionDateStruct": {"date": "2025-12"},
            },
            "designModule": {
                "phases": ["PHASE2"],
                "enrollmentInfo": {"count": 12},
            },
            "sponsorCollaboratorsModule": {"leadSponsor": {"name": "Example Sponsor"}},
            "armsInterventionsModule": {
                "interventions": [{"type": "GENETIC", "name": "Example Therapy"}]
            },
            "outcomesModule": {"primaryOutcomes": [{"measure": "BCVA"}]},
            "contactsLocationsModule": {
                "centralContacts": [{"email": "contact@example.com"}],
                "locations": [
                    {
                        "facility": "Vision Institute",
                        "status": "RECRUITING",
                        "city": "Boston",
                        "country": "United States",
                    }
                ],
            },
        }
    }

    row = study_to_row(study)

    assert row is not None
    assert row["id"] == "NCT12345678"
    assert row["locations"] == [
        {
            "facility": "Vision Institute",
            "city": "Boston",
            "country": "United States",
            "status": "RECRUITING",
        }
    ]
    assert row["contact_email"] == "contact@example.com"
