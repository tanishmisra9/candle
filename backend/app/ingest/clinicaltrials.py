from __future__ import annotations

from datetime import date
from typing import Any

import httpx
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Trial


settings = get_settings()
CHM_TERM = "choroideremia"


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def extract_text(value: Any, key: str | None = None) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and key:
        nested = value.get(key)
        return nested if isinstance(nested, str) else None
    return None


def parse_normalized_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    try:
        return date.fromisoformat(value)
    except ValueError:
        parts = value.split("-")
        if len(parts) == 2:
            return date(int(parts[0]), int(parts[1]), 1)
        if len(parts) == 1 and parts[0].isdigit():
            return date(int(parts[0]), 1, 1)
    return None


def raw_study_is_chm_related(study: dict[str, Any]) -> bool:
    protocol = as_dict(study.get("protocolSection"))
    identification = as_dict(protocol.get("identificationModule"))
    conditions_module = as_dict(protocol.get("conditionsModule"))
    description_module = as_dict(protocol.get("descriptionModule"))

    for field_name in ("conditions", "keywords"):
        for value in conditions_module.get(field_name) or []:
            if isinstance(value, str) and CHM_TERM in value.lower():
                return True

    for value in (
        identification.get("briefTitle"),
        identification.get("officialTitle"),
        description_module.get("briefSummary"),
        description_module.get("detailedDescription"),
    ):
        if isinstance(value, str) and CHM_TERM in value.lower():
            return True

    return False


def study_to_row(study: dict[str, Any]) -> dict[str, Any] | None:
    protocol = as_dict(study.get("protocolSection"))
    identification = as_dict(protocol.get("identificationModule"))
    status_module = as_dict(protocol.get("statusModule"))
    design_module = as_dict(protocol.get("designModule"))
    sponsor_module = as_dict(protocol.get("sponsorCollaboratorsModule"))
    arms_module = as_dict(protocol.get("armsInterventionsModule"))
    outcomes_module = as_dict(protocol.get("outcomesModule"))
    locations_module = as_dict(protocol.get("contactsLocationsModule"))

    nct_id = identification.get("nctId")
    title = identification.get("briefTitle")
    if not nct_id or not title:
        return None

    interventions = [
        item for item in (arms_module.get("interventions") or []) if isinstance(item, dict)
    ]
    intervention_names = [item.get("name") for item in interventions if item.get("name")]
    intervention_types = []
    for item in interventions:
        value = item.get("type")
        if value and value not in intervention_types:
            intervention_types.append(value)

    locations = []
    for raw_location in locations_module.get("locations", []) or []:
        location = as_dict(raw_location)
        facility = extract_text(location.get("facility"), "name")
        status = extract_text(location.get("status")) or location.get("status")
        location_data = as_dict(location.get("location"))
        locations.append(
            {
                "facility": facility or extract_text(location.get("facility")) or extract_text(location.get("name")),
                "city": extract_text(location_data.get("city"))
                or extract_text(location.get("city")),
                "country": extract_text(location_data.get("country"))
                or extract_text(location.get("country")),
                "status": status,
            }
        )

    central_contacts = locations_module.get("centralContacts") or []
    contact_email = None
    for raw_contact in central_contacts:
        contact = as_dict(raw_contact)
        contact_email = extract_text(contact.get("email")) or contact.get("email")
        if contact_email:
            break

    enrollment_value = (design_module.get("enrollmentInfo") or {}).get("count")
    enrollment = int(enrollment_value) if str(enrollment_value).isdigit() else None
    primary_outcomes = outcomes_module.get("primaryOutcomes") or []
    primary_endpoint = None
    if primary_outcomes:
        primary_endpoint = primary_outcomes[0].get("measure")

    return {
        "id": nct_id,
        "title": title,
        "status": status_module.get("overallStatus"),
        "phase": "/".join(design_module.get("phases") or []) or None,
        "start_date": parse_normalized_date(
            (status_module.get("startDateStruct") or {}).get("date")
        ),
        "completion_date": parse_normalized_date(
            (status_module.get("completionDateStruct") or {}).get("date")
        ),
        "sponsor": extract_text(sponsor_module.get("leadSponsor"), "name"),
        "intervention": " / ".join(intervention_names) or None,
        "intervention_type": " / ".join(intervention_types) or None,
        "enrollment": enrollment,
        "primary_endpoint": primary_endpoint,
        "locations": locations,
        "contact_email": contact_email,
        "url": f"https://clinicaltrials.gov/study/{nct_id}",
        "raw_json": study,
    }


async def ingest_trials(session: AsyncSession) -> int:
    rows: list[dict[str, Any]] = []
    page_token: str | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params: dict[str, Any] = {
                "query.cond": "choroideremia",
                "pageSize": 100,
            }
            if page_token:
                params["pageToken"] = page_token

            response = await client.get(settings.clinical_trials_base_url, params=params)
            response.raise_for_status()
            payload = response.json()
            studies = payload.get("studies") or []

            for study in studies:
                if not raw_study_is_chm_related(study):
                    continue
                row = study_to_row(study)
                if row:
                    rows.append(row)

            page_token = payload.get("nextPageToken")
            if not page_token:
                break

    if not rows:
        return 0

    stmt = insert(Trial).values(rows)
    upsert = stmt.on_conflict_do_update(
        index_elements=[Trial.id],
        set_={
            "title": stmt.excluded.title,
            "status": stmt.excluded.status,
            "phase": stmt.excluded.phase,
            "start_date": stmt.excluded.start_date,
            "completion_date": stmt.excluded.completion_date,
            "sponsor": stmt.excluded.sponsor,
            "intervention": stmt.excluded.intervention,
            "intervention_type": stmt.excluded.intervention_type,
            "enrollment": stmt.excluded.enrollment,
            "primary_endpoint": stmt.excluded.primary_endpoint,
            "locations": stmt.excluded.locations,
            "contact_email": stmt.excluded.contact_email,
            "url": stmt.excluded.url,
            "raw_json": stmt.excluded.raw_json,
            "updated_at": func.now(),
        },
    )
    await session.execute(upsert)
    await session.commit()
    return len(rows)
