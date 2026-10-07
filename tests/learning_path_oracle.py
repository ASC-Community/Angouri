#!/usr/bin/env python3
"""Independent exact checks for the learning-path additions.

The oracle enumerates every legal recipe for sources 78-83, including fixed
station boundaries. It imports only the small Fraction/Exact expression model
from extended_puzzles_oracle.py and never calls the game kernel.
"""

from __future__ import annotations

from collections import Counter
from fractions import Fraction
import json
from pathlib import Path

from extended_puzzles_oracle import Exact, X, affine, apply, evaluate, q, source_expr


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "content" / "extended-puzzles.json"
WITNESSES = {78: "AQNA", 79: "AHS", 80: "Q", 81: "AAHS", 82: "H", 83: "Q"}
EXPECTED_SOLUTIONS = {78: ["AQNA"], 79: ["AHS"], 80: ["Q"], 81: ["HAS", "AAHS"], 82: ["H"], 83: ["Q"]}


def exact(text: str) -> Exact:
    normalized = text.replace(" ", "")
    if normalized == "sqrt(2)/2":
        return Exact(b=q("1/2"))
    if normalized == "-sqrt(2)/2":
        return Exact(b=q("-1/2"))
    if normalized == "(2+sqrt(2))/4":
        return Exact(a=q("1/2"), b=q("1/4"))
    return Exact.rational(q(normalized))


def starting_expression(source: str):
    if source == "sin(pi*x/2)^2":
        return ("square", ("sin", X))
    return source_expr(source)


def target_goal(item: dict) -> tuple[list[Fraction], tuple[Exact, ...]]:
    positions: list[Fraction] = []
    expected: dict[Fraction, Exact] = {}
    for target in item["targets"]:
        position = q(target["x"])
        value = exact(target["y"])
        if item.get("relation") == "height-squared":
            value = value.square()
        if position in expected:
            assert expected[position] == value, f"source {item['id']} has inconsistent duplicate target at {position}"
        else:
            positions.append(position)
            expected[position] = value
    return positions, tuple(expected[position] for position in positions)


def bounded_sequences(inventory: dict[str, int], maximum: int):
    remaining = dict(inventory)
    prefix: list[str] = []

    def walk():
        yield "".join(prefix)
        if len(prefix) == maximum:
            return
        for operation in sorted(remaining):
            if remaining[operation] == 0:
                continue
            remaining[operation] -= 1
            prefix.append(operation)
            yield from walk()
            prefix.pop()
            remaining[operation] += 1

    yield from walk()


def legal_candidates(item: dict) -> list[str]:
    station = item.get("station")
    if not station:
        return list(bounded_sequences(item["inventory"], item["limit"]))

    candidates: set[str] = set()
    for before in bounded_sequences(item["inventory"], station["before"]):
        remaining = Counter(item["inventory"])
        remaining.subtract(before)
        available = {operation: count for operation, count in remaining.items() if count > 0}
        for after in bounded_sequences(available, station["after"]):
            recipe = before + station["op"] + after
            assert len(before) <= station["before"] and len(after) <= station["after"]
            assert len(recipe) <= item["limit"]
            candidates.add(recipe)
    return sorted(candidates, key=lambda recipe: (len(recipe), recipe))


def recipe_values(item: dict, recipe: str, positions: list[Fraction]) -> tuple[Exact, ...]:
    expression = starting_expression(item["source"])
    # Evaluate each accepted prefix. Any unsupported or illegal intermediate is
    # counted by the caller rather than disappearing from the search.
    for operation in recipe:
        expression = apply(expression, operation)
        for position in positions:
            evaluate(expression, position)
    return tuple(evaluate(expression, position) for position in positions)


def recipe_expression(item: dict, recipe: str):
    expression = starting_expression(item["source"])
    for operation in recipe:
        expression = apply(expression, operation)
    return expression


def enumerate_puzzle(item: dict) -> dict:
    positions, goal = target_goal(item)
    candidates = legal_candidates(item)
    invalid: list[tuple[str, str]] = []
    solutions: list[str] = []
    for recipe in candidates:
        try:
            if recipe_values(item, recipe, positions) == goal:
                solutions.append(recipe)
        except (ValueError, ZeroDivisionError) as error:
            invalid.append((recipe, str(error)))
    return {"candidates": candidates, "invalid": invalid,
            "solutions": sorted(solutions,key=lambda recipe:(len(recipe),recipe))}


def prove_source_80(item: dict) -> str:
    positions, goal = target_goal(item)
    initial = recipe_values(item, "", positions)
    squared = recipe_values(item, "Q", positions)
    misses = [position for position, actual, wanted in zip(positions, initial, goal) if actual != wanted]
    assert misses == [q("1/3")]
    shoulder = positions.index(q("1/3"))
    assert initial[shoulder] == exact("1/4") and goal[shoulder] == exact("1/16")
    assert squared == goal
    for index, position in enumerate(positions):
        if position != q("1/3"):
            assert squared[index] == initial[index] == goal[index]
    return "80: initial matches 5/6 landmarks; only x=1/3 differs (1/4 vs 1/16); Q fixes it and preserves the other five"


def compare_source_76(item: dict) -> str:
    positions, goal = target_goal(item)
    correct = recipe_values(item, "ASAH", positions)
    near = recipe_values(item, "QHNA", positions)
    assert correct == goal
    mismatches = [position for position, actual, wanted in zip(positions, near, goal) if actual != wanted]
    assert mismatches == [q("3/2")]
    shoulder = positions.index(q("3/2"))
    assert near[shoulder] == exact("7/8")
    assert goal[shoulder] == exact("(2+sqrt(2))/4")
    return "76: ASAH matches 4/4; QHNA matches 3/4 and misses only x=3/2 (7/8 vs (2+sqrt(2))/4)"


def main() -> None:
    loaded = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in loaded}
    reports: list[str] = []
    for source_id, witness in WITNESSES.items():
        result = enumerate_puzzle(by_id[source_id])
        assert not result["invalid"], f"source {source_id} has unaccounted illegal candidates: {result['invalid']}"
        assert witness in result["solutions"], f"source {source_id} witness does not solve"
        shortest = min(map(len, result["solutions"]))
        assert result["solutions"] == EXPECTED_SOLUTIONS[source_id], \
            f"source {source_id} solution set changed: {result['solutions']}"
        if source_id != 81:
            assert shortest == len(witness), f"source {source_id} has shorter bypass: {result['solutions']}"
        else:
            assert shortest == 3
            for solution in result["solutions"]:
                sine = solution.index("S")
                assert solution.index("H") < sine, f"source 81 solution does not halve before Sine: {solution}"
                assert affine(recipe_expression(by_id[81], solution[:sine])) == (q("1/2"), q(0)), \
                    f"source 81 solution does not centre input to x/2 before Sine: {solution}"
        reports.append(
            f"{source_id}: exhaustive {len(result['candidates'])} legal recipes; "
            f"illegal/unsupported=0; shortest={shortest}; solutions={result['solutions']}")

    reports.append(prove_source_80(by_id[80]))
    reports.append(compare_source_76(by_id[76]))
    print(f"manifest: {MANIFEST}")
    for report in reports:
        print(report)
    print("scope: exhaustive for sources 78-83 under authored inventories, limits and station boundaries; exact Fraction/radical arithmetic; no kernel calls")


if __name__ == "__main__":
    main()
