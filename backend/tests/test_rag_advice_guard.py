from app.services.rag import (
    contains_advice_language,
    is_advice_request,
    is_distress_message,
)


def test_is_advice_request_matches_clinical_advice_queries():
    assert is_advice_request("Should I enroll in the Biogen trial?") is True
    assert is_advice_request("Is it worth waiting for a better trial?") is True
    assert is_advice_request("What's my prognosis if I have CHM?") is True
    assert is_advice_request("Would you recommend the AAV2-REP1 trial?") is True
    assert is_advice_request("What should I do?") is True


def test_advice_guard_catches_most_promising():
    assert is_advice_request("which CHM trial is most promising?") is True


def test_advice_guard_catches_which_trial_should():
    assert is_advice_request("which trial should I look into?") is True


def test_advice_guard_catches_am_i_eligible():
    assert is_advice_request("am I eligible for any of these trials?") is True


def test_advice_guard_catches_recommendation():
    assert is_advice_request("can you recommend a trial for me?") is True


def test_is_advice_request_allows_neutral_factual_questions():
    assert is_advice_request("What is the status of the Biogen trial?") is False
    assert is_advice_request("Which trials use AAV2-REP1?") is False
    assert is_advice_request("How many patients enrolled in NCT03496012?") is False


def test_output_validation_catches_slippage():
    assert (
        contains_advice_language(
            "This trial shows promise and you might benefit from enrolling."
        )
        is True
    )


def test_output_validation_passes_factual():
    assert (
        contains_advice_language(
            "In this study of 12 participants, the reported BCVA change was +0.2 logMAR."
        )
        is False
    )


def test_distress_detection():
    assert is_distress_message("I don't want to live like this anymore") is True
