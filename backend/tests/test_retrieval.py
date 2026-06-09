from __future__ import annotations

from app.services.retrieval import RetrievedChunk, _fuse_rankings


def make_chunk(source_id: str) -> RetrievedChunk:
    return RetrievedChunk(
        source_type="trial",
        source_id=source_id,
        content=f"content {source_id}",
        title=source_id,
        url=None,
        metadata={},
        distance=0.5,
    )


def test_rrf_rewards_agreement_across_rankings():
    a, b, c = make_chunk("A"), make_chunk("B"), make_chunk("C")
    dense = [a, b, c]
    bm25 = [b, c, a]

    fused = _fuse_rankings([dense, bm25], limit=3)

    # B is rank 1 in dense and rank 0 in bm25 -> highest fused score
    assert fused[0].source_id == "B"
    assert {chunk.source_id for chunk in fused} == {"A", "B", "C"}


def test_rrf_normalizes_distance_to_unit_range():
    a, b, c = make_chunk("A"), make_chunk("B"), make_chunk("C")
    fused = _fuse_rankings([[a, b, c], [a, b, c]], limit=3)

    distances = [chunk.distance for chunk in fused]
    assert min(distances) == 0.0
    assert max(distances) == 1.0
    for distance in distances:
        assert 0.0 <= distance <= 1.0


def test_rrf_deduplicates_by_source_key():
    a1 = make_chunk("A")
    a2 = make_chunk("A")
    b = make_chunk("B")

    fused = _fuse_rankings([[a1, b], [a2, b]], limit=10)

    assert len(fused) == 2


def test_rrf_single_candidate_distance_zero():
    fused = _fuse_rankings([[make_chunk("A")]], limit=5)

    assert len(fused) == 1
    assert fused[0].distance == 0.0


def test_rrf_empty_returns_empty():
    assert _fuse_rankings([[], []], limit=5) == []


def test_rrf_cross_ranked_lists_beat_mid_ranked_in_both():
    x = make_chunk("X")
    y = make_chunk("Y")
    m = make_chunk("M")
    dense_fillers = [make_chunk(f"D{i}") for i in range(48)]
    bm25_fillers = [make_chunk(f"B{i}") for i in range(48)]

    dense = [y, *dense_fillers[:24], m, *dense_fillers[24:], x]
    bm25 = [x, *bm25_fillers[:24], m, *bm25_fillers[24:], y]

    fused = _fuse_rankings([dense, bm25], limit=10)

    top_ids = [chunk.source_id for chunk in fused]
    assert "X" in top_ids
    assert "Y" in top_ids
    assert top_ids.index("X") < top_ids.index("M")
    assert top_ids.index("Y") < top_ids.index("M")


def test_rrf_returns_non_decreasing_distance():
    chunks = [make_chunk(f"C{i}") for i in range(10)]
    dense = list(chunks)
    bm25 = list(reversed(chunks))

    fused = _fuse_rankings([dense, bm25], limit=10)

    distances = [chunk.distance for chunk in fused]
    assert distances == sorted(distances)
