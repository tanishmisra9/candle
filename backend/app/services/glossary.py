from __future__ import annotations

import re

CHM_GLOSSARY: dict[str, list[str]] = {
    "CHM": ["choroideremia"],
    "choroideremia": ["CHM"],
    "REP1": ["Rab escort protein 1", "Rab escort protein"],
    "Rab escort protein": ["REP1"],
    "AAV2": ["adeno-associated virus serotype 2"],
    "voretigene": ["Luxturna", "voretigene neparvovec"],
    "timrepigene": ["BIIB111", "timrepigene emparvovec"],
}


def expand_query(question: str) -> str:
    """Append glossary expansions to the query string for embedding only."""
    expansions: list[str] = []
    for term, synonyms in CHM_GLOSSARY.items():
        if re.search(rf"\b{re.escape(term)}\b", question, re.IGNORECASE):
            expansions.extend(synonyms)

    if not expansions:
        return question

    return f"{question} {' '.join(expansions)}"
