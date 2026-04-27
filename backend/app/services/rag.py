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
    "You are a research assistant for Choroideremia (CHM). Answer only from the "
    "provided context. If the context is insufficient, say so clearly.\n\n"
    "You are NOT a medical advisor. You must NEVER:\n"
    "- Recommend, suggest, or advise whether a user should enroll in, join, wait for, "
    "or skip any trial.\n"
    "- Evaluate whether a trial, treatment, or intervention is a \"good,\" "
    "\"valuable,\" \"promising,\" or \"best\" option for the user.\n"
    "- Compare trials in terms of which is \"better\" for a patient.\n"
    "- Offer prognosis, timeline predictions, or clinical guidance for the user's "
    "personal situation.\n"
    "- Use evaluative or advisory language such as \"could be valuable,\" \"may offer,\" "
    "\"consider,\" \"worth considering,\" \"promising opportunity,\" or similar.\n\n"
    "If the user asks a question that requests advice, recommendations, comparison for "
    "personal benefit, prognosis, or any clinical decision support, do NOT answer the "
    "question. Instead respond with exactly:\n\n"
    "\"I cannot make recommendations or offer clinical advice. I can only summarize "
    "what is reported in the indexed CHM trials and publications. For decisions about "
    "your care or trial participation, please speak with your healthcare provider or "
    "a CHM specialist.\"\n\n"
    "When summarizing trial or publication data, stick to neutral, factual descriptions: "
    "status, phase, sponsor, intervention, primary endpoint, enrollment, reported outcomes. "
    "Do not characterize trials with positive or negative adjectives."
)

ACTIVE_TRIAL_STATUSES = {
    "RECRUITING",
    "NOT_YET_RECRUITING",
    "ENROLLING_BY_INVITATION",
    "ACTIVE_NOT_RECRUITING",
}

TRIAL_ID_PATTERN = re.compile(r"\bNCT\d{8}\b", re.IGNORECASE)
PMID_PATTERN = re.compile(r"\bPMID\s*:?\s*(\d+)\b", re.IGNORECASE)
ADVICE_PATTERNS = [
    r"\bshould i\b",
    r"\bshould we\b",
    r"\bwould you recommend\b",
    r"\bdo you recommend\b",
    r"\bis it worth\b",
    r"\bworth (it|enrolling|joining|waiting)\b",
    r"\bbetter (option|trial|choice)\b",
    r"\bbest (option|trial|choice|for me)\b",
    r"\bwhat would you do\b",
    r"\bwhat should i do\b",
    r"\bwait for\b",
    r"\benroll or\b",
    r"\bis .* right for me\b",
    r"\bwhat's my prognosis\b",
    r"\bhow long do i have\b",
]

ADVICE_REFUSAL = (
    "I cannot make recommendations or offer clinical advice. I can only "
    "summarize what is reported in the indexed CHM trials and publications. "
    "For decisions about your care or trial participation, please speak with "
    "your healthcare provider or a CHM specialist."
)


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


def is_advice_request(question: str) -> bool:
    lowered = question.lower()
    return any(re.search(pattern, lowered) for pattern in ADVICE_PATTERNS)


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
    if is_advice_request(question):
        return AskResponse(answer=ADVICE_REFUSAL, sources=[])

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
