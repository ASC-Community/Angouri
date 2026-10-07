#!/usr/bin/env python3
"""Exact, bounded shortcut audit for the changing-phase lesson and finale.

No game kernel, floating-point comparisons or AngouriMath calls. This imports
the independent Fraction/expression model used by the earlier oracle. Unknown
integrals and values outside that small model stay explicitly unsupported.
"""
from collections import Counter
from itertools import permutations
import json
from pathlib import Path

from extended_puzzles_oracle import Exact, build, evaluate, one_edit_neighborhood, q, sine_half_pi
from learning_path_oracle import legal_candidates, target_goal

ROOT = Path(__file__).resolve().parents[1]
PUZZLES = {item["id"]: item for item in json.loads((ROOT / "content/extended-puzzles.json").read_text(encoding="utf-8"))}


def sine_squared(phase):
    return (Exact.rational(1) - sine_half_pi(2 * phase + 1)).scale(q("1/2"))


def signed_square(recipe, position):
    """An exact sine's sign and square determine its unique real value."""
    expression = build("x", recipe)
    if expression[0] == "square":
        value = evaluate(expression, position)
        return (0 if value == Exact.rational(0) else 1), value.square()
    assert expression[0] == "sin"
    phase = evaluate(expression[1], position).as_rational()
    quadrant = phase % 4
    sign = 0 if quadrant in (0, 2) else (1 if quadrant < 2 else -1)
    return sign, sine_squared(phase)


def discovery_proof():
    item = PUZZLES[84]
    assert item["source"] == "x" and legal_candidates(item) == ["S", "QS", "SQ"]
    expected = []
    for target in item["targets"]:
        if target["y"] == "-sqrt(2-sqrt(2))/2":
            sign, square = -1, Exact(q("1/2"), q("-1/4"))
        else:
            rational = q(target["y"])
            sign, square = (rational > 0) - (rational < 0), Exact.rational(rational * rational)
        expected.append((q(target["x"]), (sign, square)))
    hits = [recipe for recipe in legal_candidates(item)
            if all(signed_square(recipe, position) == wanted for position, wanted in expected)]
    assert hits == ["QS"]
    assert signed_square("S", q(3))[0] == -1
    assert signed_square("QS", q("3/2")) == (-1, Exact(q("1/2"), q("-1/4")))
    print("84: all three legal constructions checked; only QS fits. Output folding misses the negative shoulder; unchanged phase misses x=3.")


def phase_landmark_proof():
    item = PUZZLES[64]
    expected = next(target["y"] for target in item["targets"] if target["x"] == "1/2")
    assert expected == "(10+sqrt(2))/8"
    wanted = Exact(q("5/4"), q("1/8"))
    assert evaluate(build(item["source"], "DSQHA"), q("1/2")) == wanted
    ordinary = evaluate(build("x", "SQHA"), q("1/2"))
    assert ordinary == Exact.rational(q("5/4")) and ordinary != wanted
    print("64: x=1/2 gives (10+sqrt(2))/8; the evenly spaced alias gives 5/4 and misses.")


def finale_audit():
    item, witness = PUZZLES[85], "DAHFISQ"
    positions, goals = target_goal(item)
    inventory = dict(item["inventory"])
    inventory["I"] = 1
    assert item["station"] == {"id": "station", "op": "I", "before": 5, "after": 3}

    def legal(recipe):
        counts = Counter(recipe)
        return recipe.count("I") == 1 and recipe.index("I") <= 5 \
            and len(recipe) - recipe.index("I") - 1 <= 3 and len(recipe) <= item["limit"] \
            and all(count <= inventory.get(op, 0) for op, count in counts.items())

    def status(recipe):
        try:
            expression = build(item["source"], recipe)
        except (ValueError, ZeroDivisionError):
            return "unsupported"
        unknown = False
        for position, wanted in zip(positions, goals):
            try:
                if evaluate(expression, position) != wanted:
                    return "miss"
            except (ValueError, ZeroDivisionError):
                unknown = True
        return "unsupported" if unknown else "hit"

    assert legal(witness) and status(witness) == "hit"
    assert legal("DAHFSIQ") and status("DAHFSIQ") == "miss"
    # A pre-station alternative supplied by the independent critic. Its miss
    # demonstrates why the rational shoulder was needed, not its legal status.
    assert status("FHSQ") == "miss"
    phase = build(item["source"], "DAHFI")
    for position in map(q, ["0", "1/2", "1", "4/3", "2", "3", "7/2", "4"]):
        expected = 0 if position <= 1 else position - 1 if position <= 3 else 2 * position - 4
        assert evaluate(phase, position) == Exact.rational(expected)
    print("85: exact accumulated phase is 0, x-1, then 2x-4; equal-height lobes have widths 2 and 1. The 4/3 shoulder rejects FHSQ.")

    insertions = {witness[:index] + op + witness[index:] for index in range(len(witness) + 1) for op in inventory}
    spaces = {
        "witness permutations": {"".join(recipe) for recipe in permutations(witness)},
        "ceiling permutations": {"".join(recipe) for recipe in permutations(witness.replace("F", "C"))},
        "local deletions/swaps/substitutions": one_edit_neighborhood(witness, inventory),
        "single insertions": insertions,
    }
    for name, candidates in spaces.items():
        candidates = sorted(recipe for recipe in candidates if legal(recipe))
        counts, hits = Counter(), []
        for recipe in candidates:
            outcome = status(recipe)
            counts[outcome] += 1
            if outcome == "hit":
                hits.append(recipe)
                assert recipe.index("I") < recipe.index("S"), f"Review newly found order shortcut: {recipe}"
        print(f"85 {name}: {len(candidates)} candidates; {dict(counts)}; proved hits={hits}")
    print("Scope: bounded exact audit, not full-inventory enumeration. An exact mismatch proves a miss even if another checkpoint is unsupported. A found identity remains a valid solution.")


if __name__ == "__main__":
    discovery_proof()
    phase_landmark_proof()
    finale_audit()
