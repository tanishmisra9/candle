from app.services.rag import is_advice_request


def test_is_advice_request_matches_clinical_advice_queries():
    assert is_advice_request("Should I enroll in the Biogen trial?") is True
    assert is_advice_request("Is it worth waiting for a better trial?") is True
    assert is_advice_request("What's my prognosis if I have CHM?") is True
    assert is_advice_request("Would you recommend the AAV2-REP1 trial?") is True
    assert is_advice_request("What should I do?") is True


def test_is_advice_request_allows_neutral_factual_questions():
    assert is_advice_request("What is the status of the Biogen trial?") is False
    assert is_advice_request("Which trials use AAV2-REP1?") is False
    assert is_advice_request("How many patients enrolled in NCT03496012?") is False
