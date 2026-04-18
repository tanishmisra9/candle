from __future__ import annotations

from collections import OrderedDict
import re

from sqlalchemy import case, select

from app.models import Publication, Trial
from app.config import get_settings
from app.schemas import AskResponse, AskSource
from app.services.embeddings import embed_query, get_openai_client
from app.services.retrieval import RetrievedChunk, retrieve_similar_chunks


SYSTEM_PROMPT = (
    "You are Candle, a calm and knowledgeable research guide for Choroideremia (CHM), "
    "a rare inherited retinal disease. Your readers are patients, family members, and "
    "advocates — not clinicians. Write the way a brilliant, empathetic friend with deep "
    "medical knowledge would speak: clear, warm, and direct. Never dump data. Never repeat "
    "structured fields (NCT ID, Status, Phase, Sponsor, Enrollment) as a list of labeled "
    "lines for every trial — that reads like a database export, not an answer.\n\n"
    "Rules:\n"
    "- Lead with the most useful insight. Put the conclusion first.\n"
    "- When listing trials or papers, name them naturally in prose or in a compact list "
    "with one line each. One line per item means: name, one-clause description, and the "
    "NCT ID in parentheses if relevant. Nothing more per item unless the question "
    "specifically asks for detail on a single trial.\n"
    "- Reserve structured facts (NCT ID, phase, sponsor, enrollment) for when the "
    "question asks about a specific single trial, or when precision materially changes "
    "the answer.\n"
    "- For ranking questions ('most promising', 'best', 'most advanced'), name the "
    "criterion, give the answer in one to two sentences, then briefly note the strongest "
    "alternative.\n"
    "- For questions about what is available to enroll in, describe what the trial is "
    "testing in one plain sentence and note the NCT ID. Do not list all metadata fields.\n"
    "- Never say 'the provided context'. Never use the phrase 'based on the context'. "
    "Speak as if you simply know this.\n"
    "- Use markdown sparingly. A short bulleted list is fine when there are multiple "
    "items. Bold a name or NCT ID only when it adds clarity. Never use headers. "
    "Never use nested bullets.\n"
    "- If the context genuinely does not support an answer, say so in one sentence "
    "and suggest what to search for instead.\n"
    "- Responses should feel complete but concise. Aim for the length of a "
    "thoughtful text message, not a report."
)

ACTIVE_TRIAL_STATUSES = {
    "RECRUITING",
    "NOT_YET_RECRUITING",
    "ENROLLING_BY_INVITATION",
    "ACTIVE_NOT_RECRUITING",
}

TRIAL_ID_PATTERN = re.compile(r"\bNCT\d{8}\b", re.IGNORECASE)
PMID_PATTERN = re.compile(r"\bPMID\s*:?\s*(\d+)\b", re.IGNORECASE)


def should_prioritize_trials(question: str) -> bool:
    normalized = question.lower()
    return any(
        phrase in normalized
        for phrase in (
            "trial",
            "recruit",
            "ongoing",
            "active",
            "current",
            "right now",
            "going on",
            "promising",
        )
    )


def asks_about_current_trials(question: str) -> bool:
    normalized = question.lower()
    return any(
        phrase in normalized
        for phrase in ("current", "recruit", "ongoing", "active", "right now", "going on")
    )


def rank_chunks(question: str, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    normalized = question.lower()
    prefers_current = asks_about_current_trials(question)
    asks_for_rank = any(phrase in normalized for phrase in ("most", "best", "promising"))

    def key(chunk: RetrievedChunk) -> tuple[int, int, int, float]:
        status = str(chunk.metadata.get("status") or "").upper()
        phase = str(chunk.metadata.get("phase") or "").upper()
        is_trial = chunk.source_type == "trial"
        active_bonus = 1 if status in ACTIVE_TRIAL_STATUSES else 0
        phase_bonus = 1 if "PHASE3" in phase else 0
        if not phase_bonus and "PHASE2" in phase:
            phase_bonus = 0
        return (
            0 if is_trial else 1,
            0 if prefers_current and active_bonus else 1,
            0 if asks_for_rank and phase_bonus else 1,
            chunk.distance,
        )

    return sorted(chunks, key=key)


def source_reasoning_instruction(question: str) -> str:
    normalized = question.lower()
    if any(phrase in normalized for phrase in ("promising", "best", "most")):
        return (
            "When you compare options, say which item comes out strongest from this context, "
            "name the criterion you used, and mention the strongest alternative if it changes "
            "under a different criterion."
        )
    if asks_about_current_trials(question):
        return (
            "Prioritize trial records over background papers when answering about what is "
            "current or actively recruiting. If there is no active interventional trial in the "
            "context, say that plainly and distinguish it from the most advanced completed program."
        )
    return "Keep the answer concise, direct, and grounded in the retrieved sources."


def trial_context_block(trial: Trial) -> str:
    enrollment = f"{trial.enrollment} patients" if trial.enrollment is not None else "Unknown"
    return (
        f"NCT ID: {trial.id}\n"
        f"Title: {trial.title}\n"
        f"Status: {trial.status or 'Unknown'}\n"
        f"Phase: {trial.phase or 'Unknown'}\n"
        f"Intervention: {trial.intervention or 'Unknown'}\n"
        f"Sponsor: {trial.sponsor or 'Unknown'}\n"
        f"Enrollment: {enrollment}"
    )


def publication_context_block(publication: Publication) -> str:
    lead_authors = [
        author.split(",")[0].strip()
        for author in publication.authors[:5]
        if author.strip()
    ]
    author_line = ", ".join(lead_authors) if lead_authors else "Unknown"
    publication_date = publication.pub_date.isoformat() if publication.pub_date else "Unknown"
    return (
        f"PMID: {publication.pmid}\n"
        f"Title: {publication.title}\n"
        f"Authors: {author_line}\n"
        f"Journal: {publication.journal or 'Unknown'}\n"
        f"Publication Date: {publication_date}\n"
        f"Linked Trial: {publication.trial_id or 'None'}\n"
        f"Abstract: {publication.abstract or 'No abstract available.'}"
    )


def extract_trial_ids(question: str) -> list[str]:
    return list(OrderedDict.fromkeys(match.upper() for match in TRIAL_ID_PATTERN.findall(question)))


def extract_pmids(question: str) -> list[str]:
    return list(OrderedDict.fromkeys(PMID_PATTERN.findall(question)))


def is_chm_related_text(value: str | None) -> bool:
    return "choroideremia" in (value or "").lower()


def trial_is_chm_related(trial: Trial) -> bool:
    raw = trial.raw_json or {}
    protocol = raw.get("protocolSection") or {}
    identification = protocol.get("identificationModule") or {}
    conditions_module = protocol.get("conditionsModule") or {}
    description_module = protocol.get("descriptionModule") or {}

    candidate_texts: list[str] = []
    candidate_texts.extend(conditions_module.get("conditions") or [])
    candidate_texts.extend(conditions_module.get("keywords") or [])
    candidate_texts.extend(
        [
            identification.get("briefTitle") or "",
            identification.get("officialTitle") or "",
            description_module.get("briefSummary") or "",
            description_module.get("detailedDescription") or "",
        ]
    )
    return any(is_chm_related_text(text) for text in candidate_texts if isinstance(text, str))


async def fetch_current_trials(session, limit: int = 4) -> list[Trial]:
    status_order = case(
        (Trial.status == "RECRUITING", 0),
        (Trial.status == "NOT_YET_RECRUITING", 1),
        (Trial.status == "ENROLLING_BY_INVITATION", 2),
        (Trial.status == "ACTIVE_NOT_RECRUITING", 3),
        else_=4,
    )
    stmt = (
        select(Trial)
        .where(Trial.status.in_(ACTIVE_TRIAL_STATUSES))
        .order_by(
            status_order,
            Trial.phase.desc().nullslast(),
            Trial.enrollment.desc().nullslast(),
            Trial.start_date.desc().nullslast(),
        )
        .limit(limit)
    )
    result = await session.scalars(stmt)
    return [trial for trial in result.all() if trial_is_chm_related(trial)][:limit]


async def filter_non_chm_trial_chunks(session, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    trial_ids = [chunk.source_id for chunk in chunks if chunk.source_type == "trial"]
    if not trial_ids:
        return chunks

    trials = await session.scalars(select(Trial).where(Trial.id.in_(trial_ids)))
    trials_by_id = {trial.id: trial for trial in trials.all()}

    filtered: list[RetrievedChunk] = []
    for chunk in chunks:
        if chunk.source_type != "trial":
            filtered.append(chunk)
            continue
        trial = trials_by_id.get(chunk.source_id)
        if trial and trial_is_chm_related(trial):
            filtered.append(chunk)
    return filtered


async def enrich_sources(session, sources: list[AskSource]) -> list[AskSource]:
    if not sources:
        return sources

    trial_ids = [source.source_id for source in sources if source.source_type == "trial"]
    publication_ids = [source.source_id for source in sources if source.source_type == "publication"]

    trials_by_id: dict[str, Trial] = {}
    publications_by_id: dict[str, Publication] = {}

    if trial_ids:
        trials = await session.scalars(select(Trial).where(Trial.id.in_(trial_ids)))
        trials_by_id = {trial.id: trial for trial in trials.all()}
    if publication_ids:
        publications = await session.scalars(
            select(Publication).where(Publication.pmid.in_(publication_ids))
        )
        publications_by_id = {publication.pmid: publication for publication in publications.all()}

    enriched: list[AskSource] = []
    for source in sources:
        if source.source_type == "trial":
            trial = trials_by_id.get(source.source_id)
            detail_parts = [part for part in (trial.status if trial else None, trial.phase if trial else None) if part]
            enriched.append(
                source.model_copy(
                    update={
                        "label": source.source_id,
                        "detail": " · ".join(detail_parts) if detail_parts else "Trial",
                    }
                )
            )
        else:
            publication = publications_by_id.get(source.source_id)
            lead_author = None
            year = None
            if publication:
                if publication.authors:
                    lead_author = publication.authors[0].split(",")[0].strip()
                if publication.pub_date:
                    year = str(publication.pub_date.year)
            label = f"{lead_author} et al., {year}" if lead_author and year else source.title
            enriched.append(
                source.model_copy(
                    update={
                        "label": label,
                        "detail": "PubMed",
                    }
                )
            )
    return enriched


async def answer_question(question: str, session) -> AskResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for /ask.")

    question_embedding = await embed_query(question)
    chunks = await retrieve_similar_chunks(session, question_embedding, limit=8)
    if should_prioritize_trials(question):
        trial_chunks = await retrieve_similar_chunks(
            session, question_embedding, limit=4, source_type="trial"
        )
        merged: OrderedDict[tuple[str, str, str], RetrievedChunk] = OrderedDict()
        for chunk in [*trial_chunks, *chunks]:
            merged[(chunk.source_type, chunk.source_id, chunk.content)] = chunk
        chunks = rank_chunks(question, await filter_non_chm_trial_chunks(session, list(merged.values())))[:6]
    else:
        chunks = rank_chunks(question, await filter_non_chm_trial_chunks(session, chunks))[:6]

    context_lines = []
    sources: OrderedDict[str, AskSource] = OrderedDict()
    explicit_trial_ids = extract_trial_ids(question)
    explicit_pmids = extract_pmids(question)

    explicit_publications: OrderedDict[str, Publication] = OrderedDict()
    if explicit_pmids:
        matched_publications = await session.scalars(
            select(Publication).where(Publication.pmid.in_(explicit_pmids))
        )
        publications_by_pmid = {
            publication.pmid: publication for publication in matched_publications.all()
        }
        for pmid in explicit_pmids:
            publication = publications_by_pmid.get(pmid)
            if publication:
                explicit_publications[pmid] = publication

    combined_explicit_trial_ids = list(
        OrderedDict.fromkeys(
            [
                *explicit_trial_ids,
                *[
                    publication.trial_id
                    for publication in explicit_publications.values()
                    if publication.trial_id
                ],
            ]
        )
    )
    explicit_trials: dict[str, Trial] = {}
    if combined_explicit_trial_ids:
        matched_trials = await session.scalars(
            select(Trial).where(Trial.id.in_(combined_explicit_trial_ids))
        )
        explicit_trials = {trial.id: trial for trial in matched_trials.all()}

    for publication in explicit_publications.values():
        context_lines.append(
            f"[Explicit Publication — publication: {publication.title}]\n"
            f"{publication_context_block(publication)}"
        )
        sources.setdefault(
            f"publication:{publication.pmid}",
            AskSource(
                source_type="publication",
                source_id=publication.pmid,
                title=publication.title,
                url=publication.url,
            ),
        )

        if publication.trial_id:
            trial = explicit_trials.get(publication.trial_id)
            if trial:
                context_lines.append(
                    f"[Linked Trial for PMID {publication.pmid} — trial: {trial.title}]\n"
                    f"{trial_context_block(trial)}"
                )
                sources.setdefault(
                    f"trial:{trial.id}",
                    AskSource(
                        source_type="trial",
                        source_id=trial.id,
                        title=trial.title,
                        url=trial.url,
                    ),
                )

    for trial_id in explicit_trial_ids:
        trial = explicit_trials.get(trial_id)
        if not trial:
            continue
        if f"trial:{trial.id}" in sources:
            continue
        context_lines.append(
            f"[Explicit Trial — trial: {trial.title}]\n{trial_context_block(trial)}"
        )
        sources.setdefault(
            f"trial:{trial.id}",
            AskSource(
                source_type="trial",
                source_id=trial.id,
                title=trial.title,
                url=trial.url,
            ),
        )

    if asks_about_current_trials(question):
        current_trials = await fetch_current_trials(session, limit=4)
        for index, trial in enumerate(current_trials, start=1):
            context_lines.append(
                f"[Current Trial {index} — trial: {trial.title}]\n{trial_context_block(trial)}"
            )
            dedupe_key = f"trial:{trial.id}"
            sources.setdefault(
                dedupe_key,
                AskSource(
                    source_type="trial",
                    source_id=trial.id,
                    title=trial.title,
                    url=trial.url,
                ),
            )

    if not chunks and not context_lines:
        return AskResponse(
            answer=(
                "I do not have enough indexed CHM trial or publication context yet. "
                "Try re-running ingestion, or narrow the question to a specific trial, "
                "intervention, sponsor, author, PMID, or NCT ID."
            ),
            sources=[],
        )

    for index, chunk in enumerate(chunks, start=1):
        context_lines.append(
            f"[Source {index} — {chunk.source_type}: {chunk.title}]\n{chunk.content}"
        )
        dedupe_key = f"{chunk.source_type}:{chunk.source_id}"
        sources.setdefault(
            dedupe_key,
            AskSource(
                source_type=chunk.source_type,  # type: ignore[arg-type]
                source_id=chunk.source_id,
                title=chunk.title,
                url=chunk.url,
            ),
        )

    context_block = "\n\n".join(context_lines)
    response = await get_openai_client().chat.completions.create(
        model=settings.chat_model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n\n{context_block}"},
            {"role": "user", "content": source_reasoning_instruction(question)},
            {"role": "user", "content": question},
        ],
    )
    answer = response.choices[0].message.content or ""
    enriched_sources = await enrich_sources(session, list(sources.values()))
    return AskResponse(answer=answer.strip(), sources=enriched_sources[:5])
