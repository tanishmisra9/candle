from app.services.glossary import expand_query


def test_expand_query_adds_synonyms_for_known_terms():
    question = "Tell me about REP1"
    expanded = expand_query(question)

    assert expanded.startswith(question)
    assert "Rab escort protein 1" in expanded
    assert "Rab escort protein" in expanded


def test_expand_query_is_noop_for_unknown_terms():
    question = "What trials are recruiting?"
    assert expand_query(question) == question


def test_expand_query_does_not_mutate_input():
    question = "CHM patients"
    original = question
    expand_query(question)
    assert question == original
