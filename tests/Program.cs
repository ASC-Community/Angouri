using System.Text.Json.Nodes;
using System.Numerics;
using Angouri.Kernel;

static class ContractTests
{
    private static int assertions;

    private static readonly Dictionary<int, Dictionary<string, int>> Inventories = new()
    {
        [1] = new() { ["H"] = 1, ["A"] = 1 },
        [2] = new() { ["H"] = 1, ["A"] = 1, ["N"] = 1 },
        [3] = new() { ["H"] = 1, ["A"] = 1 },
        [4] = new() { ["H"] = 2, ["A"] = 1, ["N"] = 1, ["Q"] = 1 },
        [5] = new() { ["D"] = 1, ["H"] = 1, ["A"] = 1 },
        [6] = new() { ["H"] = 1, ["A"] = 1, ["N"] = 1 },
        [7] = new() { ["Q"] = 1, ["N"] = 1 },
        [8] = new() { ["N"] = 1, ["A"] = 1 },
        [9] = new() { ["H"] = 1, ["N"] = 1, ["A"] = 1 },
        [10] = new() { ["H"] = 1, ["Q"] = 1 },
        [11] = new() { ["H"] = 2, ["A"] = 3, ["N"] = 2, ["Q"] = 3 },
        [12] = new() { ["Q"] = 1, ["H"] = 1 },
        [13] = new() { ["Q"] = 1, ["N"] = 1, ["A"] = 1, ["H"] = 1 },
        [14] = new() { ["D"] = 1, ["H"] = 1, ["N"] = 1 },
        [15] = new() { ["D"] = 1, ["H"] = 2, ["N"] = 1, ["A"] = 1, ["Q"] = 1 },
        [16] = new() { ["I"] = 1, ["H"] = 1, ["A"] = 1 },
        [17] = new() { ["I"] = 1, ["H"] = 1, ["N"] = 1, ["A"] = 1 },
        [18] = new() { ["I"] = 1, ["H"] = 1, ["N"] = 1, ["A"] = 1, ["D"] = 1 },
        [19] = new() { ["I"] = 1, ["N"] = 1, ["D"] = 1 },
        [20] = new() { ["I"] = 1, ["A"] = 1, ["H"] = 1 },
        [21] = new() { ["D"] = 1, ["I"] = 1, ["A"] = 1, ["N"] = 1, ["H"] = 1 },
        [22] = new() { ["H"] = 3, ["A"] = 3, ["N"] = 2, ["Q"] = 2, ["D"] = 1 },
        [23] = new() { ["H"] = 2, ["A"] = 3, ["N"] = 2, ["Q"] = 1, ["D"] = 1, ["I"] = 2 },
        [24] = new() { ["H"] = 2, ["A"] = 2 },
        [25] = new() { ["H"] = 5, ["A"] = 6 },
        [26] = new() { ["H"] = 4, ["A"] = 4, ["N"] = 2 },
        [27] = new() { ["A"] = 1, ["Q"] = 1, ["N"] = 1 },
        [28] = new() { ["H"] = 3, ["A"] = 3, ["N"] = 2, ["Q"] = 1 }
    };

    private static readonly int[] Limits = [1, 1, 2, 5, 3, 1, 1, 2, 3, 2, 8, 1, 3, 1, 5, 1, 2, 4, 1, 2, 2, 9, 8, 4, 10, 8, 2, 8];

    private static readonly Dictionary<string, int> LegacyRemixInventory = new()
    {
        ["H"] = 3, ["A"] = 2, ["N"] = 1, ["Q"] = 1, ["D"] = 1
    };

    private static readonly string[][] GoalXs =
    [
        ["0", "2", "4"], ["0", "2", "4"], ["0", "2", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2"],
        ["0", "2", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "2", "4"], ["0", "1", "2", "3", "4"],
        ["0", "2", "4"], ["0", "2", "4"], ["0", "1", "2", "3", "4"],
        ["0", "2", "4"], ["0", "2", "4"], ["0", "2", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "2", "4"], ["0", "2", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"]
    ];

    private static readonly string[][] GoalYs =
    [
        ["0", "2", "0"], ["1", "3", "1"], ["1/2", "5/2", "1/2"],
        ["0", "3/4", "1", "3/4", "0"], ["1", "5/2", "7"],
        ["0", "2", "0"], ["4", "1", "0", "1", "4"],
        ["0", "3/4", "1", "3/4", "0"], ["-1", "1/2", "1", "1/2", "-1"],
        ["1", "1/4", "0", "1/4", "1"], ["-2", "7/4", "2", "7/4", "-2"],
        ["1", "1/16", "0", "1/16", "1"], ["0", "15/16", "1", "15/16", "0"],
        ["-1", "0", "1"], ["0", "3/4", "1", "3/4", "0"],
        ["0", "2", "4"], ["0", "1", "0"], ["1", "31/16", "2", "31/16", "1"],
        ["0", "2", "0"], ["1", "3", "5"], ["0", "2", "0"],
        ["0", "255/256", "1", "255/256", "0"], ["0", "63/64", "1", "63/64", "0"],
        ["3/4", "7/4", "3/4"], ["13/8", "17/8", "13/8"],
        ["1/4", "5/8", "3/4", "5/8", "1/4"], ["1", "0", "1", "4", "9"],
        ["3/8", "1/2", "3/8", "0", "-5/8"]
    ];

    public static int Main()
    {
        try
        {
            ExhaustivePuzzleContract();
            HeightGuideContract();
            RoundRoofContract();
            DerivativeChapterContract();
            IntegrationChapterContract();
            EarlierChapterExtensionsContract();
            LaterChapterCapstonesContract();
            CapstoneContract();
            CommandAndIdentityContract();
            InvalidInputContract();
            ReusableRemixContract();
            SourceSelectionContract();
            PreviewLimitContract();
            ExportImportContract();
            Console.WriteLine($"PASS: {assertions} contract assertions");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("FAIL: " + ex.Message);
            Console.Error.WriteLine(ex.StackTrace);
            return 1;
        }
    }

    private static void ExhaustivePuzzleContract()
    {
        int total = 0;
        int[] exhaustiveLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 24, 27];
        int[] expectedSequences = [3, 4, 5, 171, 16, 4, 3, 5, 16, 5, 3, 41, 19, 10];
        int[] expectedSolvedCounts = [1, 1, 1, 4, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1];
        var expectedNewRecipes = new Dictionary<int, string[]>
        {
            [6] = ["N"], [7] = ["Q"], [8] = ["NA"], [9] = ["HNA", "NHA"], [10] = ["HQ"],
            [12] = ["Q"], [13] = ["QNA"], [24] = ["AHAH"], [27] = ["AQ"]
        };

        for (int puzzleIndex = 0; puzzleIndex < exhaustiveLevels.Length; puzzleIndex++)
        {
            int level = exhaustiveLevels[puzzleIndex];
            var sequences = Enumerate(Inventories[level], Limits[level - 1]).ToList();
            Equal(expectedSequences[puzzleIndex], sequences.Count, $"level {level} legal sequence count");
            total += sequences.Count;
            int solved = 0, independentlySolved = 0;
            var solvedLengths = new List<int>();
            var independentlySolvedRecipes = new List<string>();

            foreach (var ops in sequences)
            {
                JsonObject response = Level(level);
                for (int i = 0; i < ops.Count; i++)
                    response = Ok(new JsonObject
                    {
                        ["state"] = Clone(response["state"]!),
                        ["action"] = new JsonObject { ["type"] = "insert", ["id"] = $"n{i}", ["op"] = ops[i], ["index"] = i }
                    });

                var result = response["result"]!.AsObject();
                CheckResultShape(level, result, ops);
                bool expectedSolution = IsIndependentSolution(level, ops);
                bool kernelSolution = result["solved"]!.GetValue<bool>();
                Equal(expectedSolution, kernelSolution,
                    $"level {level} independent solved result after [{string.Join(',', ops)}]");
                if (expectedSolution)
                {
                    independentlySolved++;
                    independentlySolvedRecipes.Add(string.Concat(ops));
                }
                if (kernelSolution)
                {
                    solved++;
                    solvedLengths.Add(ops.Count);
                }
            }

            Equal(expectedSolvedCounts[puzzleIndex], independentlySolved, $"level {level} independent solved sequence count");
            Equal(independentlySolved, solved, $"level {level} kernel solved sequence count");
            if (level == 4)
            {
                Equal(1, solvedLengths.Count(n => n == 4), "level 4 four-part solutions");
                Equal(3, solvedLengths.Count(n => n == 5), "level 4 five-part solutions");
            }
            if (expectedNewRecipes.TryGetValue(level, out string[]? expectedRecipes))
                Equal(string.Join(',', expectedRecipes.Order(StringComparer.Ordinal)),
                    string.Join(',', independentlySolvedRecipes.Order(StringComparer.Ordinal)),
                    $"level {level} independent successful recipes");
        }

        Equal(305, total, "small-puzzle legal sequence count");
    }

    private static void HeightGuideContract()
    {
        var guideSolutions = new Dictionary<int, string[]>
        {
            [3] = ["A", "H"], [4] = ["Q", "H", "H", "N", "A"], [5] = ["D", "H", "A"],
            [6] = ["N"], [7] = ["Q"], [8] = ["N", "A"], [9] = ["H", "N", "A"],
            [10] = ["H", "Q"], [11] = ["Q", "H", "Q", "N", "A", "A"], [12] = ["Q"],
            [13] = ["Q", "N", "A"], [14] = ["D"], [15] = ["D", "H", "H", "N", "A"],
            [16] = ["I"], [17] = ["I", "H"], [18] = ["I", "H", "N", "A"], [19] = ["I"],
            [20] = ["I", "A"], [21] = ["D", "I"],
            [22] = ["D", "H", "H", "Q", "Q", "N", "A"],
            [23] = ["I", "N", "A", "Q", "N", "A"], [24] = ["A", "H", "A", "H"],
            [25] = ["A", "H", "H", "A", "H", "A"], [26] = ["A", "H", "H", "H", "N", "A"],
            [27] = ["A", "Q"], [28] = ["A", "H", "Q", "N", "A", "H"]
        };
        Equal(26, guideSolutions.Count, "height guide covers every authored puzzle after the introductions");
        foreach (var (level, ops) in guideSolutions)
        {
            True(IsIndependentSolution(level, ops), $"level {level} height-guide recipe solves independently");
            var solved = PlayPuzzle(level, ops);
            CheckHeightGuide(level, solved["result"]!.AsObject(), ops);
            Equal(true, solved["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
                $"level {level} solved recipe matches its guide gap");
            Equal(true, solved["result"]!["solved"]!.GetValue<bool>(),
                $"level {level} known guide recipe solves in kernel");
        }

        var derivativeGuide = PlayPuzzle(5, guideSolutions[5]);
        Equal("0", derivativeGuide["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "derivative guide starts at its minimum target");
        Equal("2", derivativeGuide["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "derivative guide ends at its maximum target");
        Equal("6", derivativeGuide["result"]!["heightGuide"]!["target"]!.GetValue<string>(),
            "derivative guide exposes the full target range");
        var derivativeStages = derivativeGuide["result"]!["heightGuide"]!["stages"]!.AsArray();
        Equal("8", derivativeStages[0]!["gap"]!.GetValue<string>(),
            "derivative guide checks the source stage independently");
        Equal("12", derivativeStages[1]!["gap"]!.GetValue<string>(),
            "derivative guide checks the differentiated stage independently");

        var integrationGuide = PlayPuzzle(17, guideSolutions[17]);
        var integrationStages = integrationGuide["result"]!["heightGuide"]!["stages"]!.AsArray();
        Equal("-2", integrationStages[0]!["gap"]!.GetValue<string>(),
            "integration guide retains the signed source gap");
        Equal("2", integrationStages[1]!["gap"]!.GetValue<string>(),
            "integration guide evaluates accumulated area exactly");

        var areaIntroduction = PlayPuzzle(16, guideSolutions[16]);
        Equal("0", areaIntroduction["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "area introduction starts at its minimum target");
        Equal("4", areaIntroduction["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "area introduction ends at its maximum target");
        Equal("4", areaIntroduction["result"]!["heightGuide"]!["target"]!.GetValue<string>(),
            "area introduction exposes its full target range");

        var zeroGap = PlayPuzzle(4, ["A", "Q"]);
        CheckHeightGuide(4, zeroGap["result"]!.AsObject(), ["A", "Q"]);
        Equal("0", zeroGap["result"]!["heightGuide"]!["actual"]!.GetValue<string>(),
            "squaring can expose an exact zero stage gap");
        Equal(false, zeroGap["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "zero gap remains distinct from the authored target gap");

        var level27Guide = PlayPuzzle(27, guideSolutions[27]);
        Equal("1", level27Guide["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "shifted-square guide uses its minimum target position");
        Equal("4", level27Guide["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "shifted-square guide uses its maximum target position");
        Equal("9", level27Guide["result"]!["heightGuide"]!["target"]!.GetValue<string>(),
            "shifted-square guide exposes its full target range");

        var level28Guide = PlayPuzzle(28, guideSolutions[28]);
        Equal("4", level28Guide["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "squaring capstone guide uses its minimum target position");
        Equal("1", level28Guide["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "squaring capstone guide uses its maximum target position");
        Equal("9/8", level28Guide["result"]!["heightGuide"]!["target"]!.GetValue<string>(),
            "squaring capstone guide exposes its exact target range");
        var level28Start = Level(28);
        CheckHeightGuide(28, level28Start["result"]!.AsObject(), []);
        var level28Edited = PlayPuzzle(28, ["A"]);
        CheckHeightGuide(28, level28Edited["result"]!.AsObject(), ["A"]);
        Equal(level28Start["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            level28Edited["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "guide minimum position stays fixed after an edit");
        Equal(level28Start["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            level28Edited["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "guide maximum position stays fixed after an edit");

        var level3Start = Level(3);
        CheckHeightGuide(3, level3Start["result"]!.AsObject(), []);
        Equal("0", level3Start["result"]!["heightGuide"]!["fromX"]!.GetValue<string>(),
            "equal minima choose the leftmost authored target");
        Equal(false, level3Start["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "order puzzle source gap does not yet match target");

        var level7Start = Level(7);
        CheckHeightGuide(7, level7Start["result"]!.AsObject(), []);
        Equal("0", level7Start["result"]!["heightGuide"]!["toX"]!.GetValue<string>(),
            "equal maxima choose the leftmost authored target");

        string[] liftThenHalf = ["A", "H"];
        var level3Solved = PlayPuzzle(3, liftThenHalf);
        CheckHeightGuide(3, level3Solved["result"]!.AsObject(), liftThenHalf);
        Equal(true, level3Solved["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "lift-then-half gap matches target");
        Equal(true, level3Solved["result"]!["solved"]!.GetValue<bool>(),
            "lift-then-half also places the order puzzle baseline");

        string[] halfThenLift = ["H", "A"];
        var level3WrongBaseline = PlayPuzzle(3, halfThenLift);
        CheckHeightGuide(3, level3WrongBaseline["result"]!.AsObject(), halfThenLift);
        Equal(true, level3WrongBaseline["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "half-then-lift preserves the target gap");
        Equal(false, level3WrongBaseline["result"]!["solved"]!.GetValue<bool>(),
            "matching the gap alone does not award completion");

        string[] quarterLiftExample = ["A", "H", "H"];
        var level24Example = PlayPuzzle(24, quarterLiftExample);
        CheckHeightGuide(24, level24Example["result"]!.AsObject(), quarterLiftExample);
        Equal(true, level24Example["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "quarter-lift example reaches the authored gap");
        Equal(false, level24Example["result"]!["solved"]!.GetValue<bool>(),
            "quarter-lift example leaves baseline work for the player");

        string[] level24Intended = ["A", "H", "A", "H"];
        var level24Solved = PlayPuzzle(24, level24Intended);
        CheckHeightGuide(24, level24Solved["result"]!.AsObject(), level24Intended);
        Equal(true, level24Solved["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "fractional-lift puzzle final gap matches");

        string[] level25Intended = ["A", "H", "H", "A", "H", "A"];
        var level25Solved = PlayPuzzle(25, level25Intended);
        CheckHeightGuide(25, level25Solved["result"]!.AsObject(), level25Intended);
        Equal("1/2", level25Solved["result"]!["heightGuide"]!["target"]!.GetValue<string>(),
            "height capstone exposes its exact half-unit gap");

        var level6Start = Level(6);
        CheckHeightGuide(6, level6Start["result"]!.AsObject(), []);
        Equal("-2", level6Start["result"]!["heightGuide"]!["actual"]!.GetValue<string>(),
            "reflection introduction exposes the negative source gap");
        var level6Reflected = PlayPuzzle(6, ["N"]);
        CheckHeightGuide(6, level6Reflected["result"]!.AsObject(), ["N"]);
        Equal("2", level6Reflected["result"]!["heightGuide"]!["stages"]![1]!["gap"]!.GetValue<string>(),
            "reflection reverses the signed gap");

        string[] level8Intended = ["N", "A"];
        var level8Solved = PlayPuzzle(8, level8Intended);
        CheckHeightGuide(8, level8Solved["result"]!.AsObject(), level8Intended);
        Equal("-1", level8Solved["result"]!["heightGuide"]!["stages"]![0]!["gap"]!.GetValue<string>(),
            "provided bowl begins with a negative gap");
        Equal("1", level8Solved["result"]!["heightGuide"]!["stages"]![1]!["gap"]!.GetValue<string>(),
            "provided bowl reflection reverses its gap");
        Equal("1", level8Solved["result"]!["heightGuide"]!["stages"]![2]!["gap"]!.GetValue<string>(),
            "lift leaves the provided bowl gap invariant");

        string[] level9Intended = ["H", "N", "A"];
        var level9Solved = PlayPuzzle(9, level9Intended);
        CheckHeightGuide(9, level9Solved["result"]!.AsObject(), level9Intended);
        var level9Stages = level9Solved["result"]!["heightGuide"]!["stages"]!.AsArray();
        Equal("-4", level9Stages[0]!["gap"]!.GetValue<string>(),
            "large bowl begins with its exact negative gap");
        Equal("-2", level9Stages[1]!["gap"]!.GetValue<string>(),
            "halve shrinks signed gap magnitude");
        Equal("2", level9Stages[2]!["gap"]!.GetValue<string>(),
            "reflection reverses the halved gap");
        Equal("2", level9Stages[3]!["gap"]!.GetValue<string>(),
            "final lift preserves the reflected gap");

        string[] level26GapOnly = ["N", "H", "H", "H"];
        var level26GapMatch = PlayPuzzle(26, level26GapOnly);
        CheckHeightGuide(26, level26GapMatch["result"]!.AsObject(), level26GapOnly);
        Equal(true, level26GapMatch["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "reflection capstone can match the gap before placing its baseline");
        Equal(false, level26GapMatch["result"]!["solved"]!.GetValue<bool>(),
            "reflection capstone gap match alone does not award completion");
        var level26GapStages = level26GapMatch["result"]!["heightGuide"]!["stages"]!.AsArray();
        Equal("-4", level26GapStages[0]!["gap"]!.GetValue<string>(),
            "raised bowl source retains its negative gap");
        Equal("4", level26GapStages[1]!["gap"]!.GetValue<string>(),
            "capstone reflection reverses the raised bowl gap");
        Equal("1/2", level26GapStages[4]!["gap"]!.GetValue<string>(),
            "three halves fit the capstone gap magnitude");

        string[] level26SolvedOps = ["A", "H", "H", "H", "N", "A"];
        var level26Solved = PlayPuzzle(26, level26SolvedOps);
        CheckHeightGuide(26, level26Solved["result"]!.AsObject(), level26SolvedOps);
        Equal(true, level26Solved["result"]!["heightGuide"]!["hit"]!.GetValue<bool>(),
            "placed reflection capstone keeps its exact fitted gap");
        Equal(true, level26Solved["result"]!["solved"]!.GetValue<bool>(),
            "placed reflection capstone solves after fitting gap and baseline");

        True(!Level(1)["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide is absent from unrelated authored puzzles");
        True(!Level(2)["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide is absent from the second introductory puzzle");
        True(!Remix(3)["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide is absent from reusable creation mode");
        var importedCreation = ImportCreation(24, quarterLiftExample);
        True(!importedCreation["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide is absent from imported creations");
        var challengeExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeExport["artifact"]!) }
        });
        True(!challengeImport["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide is absent from shared challenges");
        var challengeEdit = Act(challengeImport["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "shared-lift", ["op"] = "A", ["index"] = 0
        });
        True(!challengeEdit["result"]!.AsObject().ContainsKey("heightGuide"),
            "height guide stays absent while editing a shared challenge");
    }

    private static void CheckHeightGuide(int level, JsonObject result, IReadOnlyList<string> ops)
    {
        True(result.ContainsKey("heightGuide"), $"level {level} authored puzzle exposes height guide");
        var guide = result["heightGuide"]!.AsObject();
        int fromIndex = 0, toIndex = 0;
        for (int index = 1; index < GoalYs[level - 1].Length; index++)
        {
            if (CompareFractions(Fraction.Parse(GoalYs[level - 1][index]), Fraction.Parse(GoalYs[level - 1][fromIndex])) < 0)
                fromIndex = index;
            if (CompareFractions(Fraction.Parse(GoalYs[level - 1][index]), Fraction.Parse(GoalYs[level - 1][toIndex])) > 0)
                toIndex = index;
        }
        string fromXText = GoalXs[level - 1][fromIndex];
        string toXText = GoalXs[level - 1][toIndex];
        Equal(fromXText, guide["fromX"]!.GetValue<string>(), "height guide start position");
        Equal(toXText, guide["toX"]!.GetValue<string>(), "height guide comparison position");
        Fraction targetGap = Fraction.Parse(GoalYs[level - 1][toIndex]) + -Fraction.Parse(GoalYs[level - 1][fromIndex]);
        Equal(targetGap.ToString(), guide["target"]!.GetValue<string>(), "height guide exact target gap");

        Fraction[] finalPolynomial = BuildPolynomial(level, ops);
        Fraction fromX = Fraction.Parse(fromXText);
        Fraction toX = Fraction.Parse(toXText);
        Fraction actualFrom = EvaluatePolynomial(finalPolynomial, fromX);
        Fraction actualTo = EvaluatePolynomial(finalPolynomial, toX);
        Fraction actualGap = actualTo + -actualFrom;
        Equal(actualGap.ToString(), guide["actual"]!.GetValue<string>(), "height guide exact actual gap");
        Equal(actualGap.ToString() == targetGap.ToString(), guide["hit"]!.GetValue<bool>(),
            "height guide exact hit flag");

        var guideStages = guide["stages"]!.AsArray();
        Equal(ops.Count + 1, guideStages.Count, "height guide stage count");
        for (int index = 0; index < guideStages.Count; index++)
        {
            Fraction[] polynomial = BuildPolynomial(level, ops.Take(index));
            Fraction from = EvaluatePolynomial(polynomial, fromX);
            Fraction to = EvaluatePolynomial(polynomial, toX);
            var stage = guideStages[index]!.AsObject();
            Equal(from.ToString(), stage["from"]!.GetValue<string>(), $"height guide stage {index} exact start");
            Equal(to.ToString(), stage["to"]!.GetValue<string>(), $"height guide stage {index} exact peak");
            Equal((to + -from).ToString(), stage["gap"]!.GetValue<string>(), $"height guide stage {index} exact gap");
        }
    }

    private static int CompareFractions(Fraction left, Fraction right) =>
        (left.Numerator * right.Denominator).CompareTo(right.Numerator * left.Denominator);

    private static void RoundRoofContract()
    {
        var initial = Level(13);
        Equal(13, initial["state"]!["sourceId"]!.GetValue<int>(), "round-roof stable source id");
        Equal(3, initial["state"]!["limit"]!.GetValue<int>(), "round-roof part limit");
        Equal(4, initial["state"]!["inventory"]!.AsObject().Count, "round-roof inventory kinds");
        foreach (string op in new[] { "Q", "N", "A", "H" })
            Equal(1, initial["state"]!["inventory"]![op]!.GetValue<int>(),
                $"round-roof inventory includes one {op}");

        string[] intendedOps = ["Q", "N", "A"];
        var intended = PlayPuzzle(13, intendedOps);
        CheckResultShape(13, intended["result"]!.AsObject(), intendedOps);
        Equal(true, intended["result"]!["solved"]!.GetValue<bool>(), "round-roof intended recipe solves");
        Equal("0", intended["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "round-roof intended endpoint");
        Equal("15/16", intended["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "round-roof intended shoulder");
        Equal("1", intended["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "round-roof intended center");

        string[] liftBeforeTurnOps = ["Q", "A", "N"];
        var liftBeforeTurn = PlayPuzzle(13, liftBeforeTurnOps);
        CheckResultShape(13, liftBeforeTurn["result"]!.AsObject(), liftBeforeTurnOps);
        Equal(false, liftBeforeTurn["result"]!["solved"]!.GetValue<bool>(),
            "round-roof lift-before-turn near miss");
        Equal("-2", liftBeforeTurn["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "round-roof endpoint distinguishes lift before turn");
        Equal("-17/16", liftBeforeTurn["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "round-roof shoulder distinguishes lift before turn");

        string[] turnBeforeSquareOps = ["N", "Q", "A"];
        var turnBeforeSquare = PlayPuzzle(13, turnBeforeSquareOps);
        CheckResultShape(13, turnBeforeSquare["result"]!.AsObject(), turnBeforeSquareOps);
        Equal(false, turnBeforeSquare["result"]!["solved"]!.GetValue<bool>(),
            "round-roof turn-before-square near miss");
        Equal("2", turnBeforeSquare["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "round-roof endpoint distinguishes turn before square");
        Equal("17/16", turnBeforeSquare["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "round-roof shoulder distinguishes turn before square");
        Equal(true, turnBeforeSquare["result"]!["checkpoints"]![2]!["hit"]!.GetValue<bool>(),
            "round-roof center alone does not distinguish turn before square");

        var importedCreation = ImportCreation(13, intendedOps);
        Equal(13, importedCreation["state"]!["sourceId"]!.GetValue<int>(),
            "round-roof creation import source compatibility");
        Equal(false, importedCreation["result"]!["solved"]!.GetValue<bool>(),
            "round-roof creation remains unsolved by contract");
        var creationExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "flight" });
        var creationArtifact = creationExport["artifact"]!.AsObject();
        Equal(13, creationArtifact["sourceId"]!.GetValue<int>(), "round-roof creation export source");
        Equal("part-0", creationArtifact["nodes"]![0]!["id"]!.GetValue<string>(),
            "round-roof creation export preserves identity");
        var creationRoundTrip = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationArtifact) }
        });
        Equal(13, creationRoundTrip["state"]!["sourceId"]!.GetValue<int>(),
            "round-roof creation round-trip source");
        Equal("Q", creationRoundTrip["state"]!["nodes"]![0]!["op"]!.GetValue<string>(),
            "round-roof creation round-trip first operation");
        Equal("N", creationRoundTrip["state"]!["nodes"]![1]!["op"]!.GetValue<string>(),
            "round-roof creation round-trip second operation");
        Equal("A", creationRoundTrip["state"]!["nodes"]![2]!["op"]!.GetValue<string>(),
            "round-roof creation round-trip third operation");

        var challengeExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var challengeArtifact = challengeExport["artifact"]!.AsObject();
        Equal(13, challengeArtifact["sourceId"]!.GetValue<int>(), "round-roof challenge export source");
        True(!challengeArtifact.ContainsKey("nodes"), "round-roof challenge export hides witness nodes");
        Equal(3, challengeArtifact["inventory"]!.AsObject().Count,
            "round-roof challenge export grants only witness operations");
        True(!challengeArtifact["inventory"]!.AsObject().ContainsKey("H"),
            "round-roof challenge export excludes unused half operation");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeArtifact) }
        });
        Equal(13, challengeImport["state"]!["sourceId"]!.GetValue<int>(),
            "round-roof challenge round-trip source");
        Equal(0, challengeImport["state"]!["nodes"]!.AsArray().Count,
            "round-roof challenge round-trip hides witness");
        JsonObject challengeSolved = challengeImport;
        for (int index = 0; index < intendedOps.Length; index++)
            challengeSolved = Act(challengeSolved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"round-roof-{index}",
                ["op"] = intendedOps[index], ["index"] = index
            });
        Equal(true, challengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "round-roof challenge round-trip admits hidden witness");
    }

    private static void DerivativeChapterContract()
    {
        var expectedSequenceCounts = new Dictionary<int, int> { [14] = 4, [15] = 651 };
        var expectedSolutionCounts = new Dictionary<int, int> { [14] = 1, [15] = 12 };
        var solutionsByLevel = new Dictionary<int, List<string>>();

        foreach (int level in new[] { 14, 15 })
        {
            var sequences = Enumerate(Inventories[level], Limits[level - 1]).ToList();
            Equal(expectedSequenceCounts[level], sequences.Count,
                $"derivative level {level} legal sequence count");
            var solutions = new List<string>();
            double maximumSampleMagnitude = 0;
            string maximumRecipe = "";
            Fraction maximumValue = Fraction.Zero;
            int maximumSampleIndex = 0;

            foreach (var ops in sequences)
            {
                Fraction[] polynomial = BuildPolynomial(level, ops);
                True(polynomial.Length - 1 <= 6,
                    $"derivative level {level} degree guard after [{string.Join(',', ops)}]");
                for (int sampleIndex = 0; sampleIndex <= 80; sampleIndex++)
                {
                    Fraction value = EvaluatePolynomial(polynomial, new Fraction(sampleIndex, 20));
                    double magnitude = Math.Abs(value.ToDouble());
                    if (magnitude > maximumSampleMagnitude)
                    {
                        maximumSampleMagnitude = magnitude;
                        maximumRecipe = string.Concat(ops);
                        maximumValue = value;
                        maximumSampleIndex = sampleIndex;
                    }
                }

                bool expectedSolution = IsIndependentSolution(level, ops);
                if (expectedSolution) solutions.Add(string.Concat(ops));
                JsonObject played = PlayPuzzle(level, ops);
                JsonObject result = played["result"]!.AsObject();
                CheckResultShape(level, result, ops);
                Equal(expectedSolution, result["solved"]!.GetValue<bool>(),
                    $"derivative level {level} independent solved result after [{string.Join(',', ops)}]");
            }

            Equal(expectedSolutionCounts[level], solutions.Count,
                $"derivative level {level} independent solved sequence count");
            True(maximumSampleMagnitude <= 10_000_000.0,
                $"all derivative level {level} samples stay within the preview guard; max {maximumValue} after {maximumRecipe} at x={maximumSampleIndex}/20");
            solutionsByLevel[level] = solutions;
            Console.WriteLine($"DERIVATIVE {level}: {sequences.Count} legal recipes, {solutions.Count} exact solutions; " +
                $"maximum guarded sample |h(x)|={maximumSampleMagnitude:R} ({maximumRecipe} at x={maximumSampleIndex}/20)");
        }

        Equal("D", string.Join(',', solutionsByLevel[14]),
            "intro derivative has only the intended solution");
        string[] expectedFinalSolutions =
        [
            "DHHNA", "DHNHA", "DNHHA", "HDHNA", "HDNHA", "HHDNA",
            "HHNDA", "HNDHA", "HNHDA", "NDHHA", "NHDHA", "NHHDA"
        ];
        Equal(string.Join(',', expectedFinalSolutions),
            string.Join(',', solutionsByLevel[15].Order(StringComparer.Ordinal)),
            "final derivative exact solution set");

        string[] introOps = ["D"];
        var intro = PlayPuzzle(14, introOps);
        CheckResultShape(14, intro["result"]!.AsObject(), introOps);
        Equal(true, intro["result"]!["solved"]!.GetValue<bool>(),
            "intro derivative intended recipe solves");
        Equal("-1", intro["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "intro derivative left slope");
        Equal("0", intro["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "intro derivative center slope");
        Equal("1", intro["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "intro derivative right slope");

        string[] intendedOps = ["D", "H", "H", "N", "A"];
        var intended = PlayPuzzle(15, intendedOps);
        CheckResultShape(15, intended["result"]!.AsObject(), intendedOps);
        Equal(true, intended["result"]!["solved"]!.GetValue<bool>(),
            "final derivative intended recipe solves");

        string[] missingScaleOps = ["D", "H", "N", "A"];
        var missingScale = PlayPuzzle(15, missingScaleOps);
        CheckResultShape(15, missingScale["result"]!.AsObject(), missingScaleOps);
        Equal(false, missingScale["result"]!["solved"]!.GetValue<bool>(),
            "final derivative missing scale is a near miss");
        Equal("-1", missingScale["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "final derivative endpoint distinguishes missing scale");
        Equal("1", missingScale["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "final derivative missing scale still reaches the summit");

        string[] liftBeforeTurnOps = ["D", "H", "H", "A", "N"];
        var liftBeforeTurn = PlayPuzzle(15, liftBeforeTurnOps);
        CheckResultShape(15, liftBeforeTurn["result"]!.AsObject(), liftBeforeTurnOps);
        Equal(false, liftBeforeTurn["result"]!["solved"]!.GetValue<bool>(),
            "final derivative lift-before-turn is a near miss");
        Equal("-2", liftBeforeTurn["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "final derivative endpoint distinguishes lift before turn");
        Equal("-1", liftBeforeTurn["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "final derivative summit distinguishes lift before turn");

        var importedCreation = ImportCreation(15, intendedOps);
        Equal(15, importedCreation["state"]!["sourceId"]!.GetValue<int>(),
            "final derivative creation import source");
        var creationExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "function" });
        var creationArtifact = creationExport["artifact"]!.AsObject();
        Equal("function", creationArtifact["view"]!.GetValue<string>(),
            "final derivative creation preserves function view identifier");
        var creationRoundTrip = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationArtifact) }
        });
        Equal(15, creationRoundTrip["state"]!["sourceId"]!.GetValue<int>(),
            "final derivative creation round-trip source");
        Equal("part-4", creationRoundTrip["state"]!["nodes"]![4]!["id"]!.GetValue<string>(),
            "final derivative creation round-trip preserves identity");

        var challengeExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var challengeArtifact = challengeExport["artifact"]!.AsObject();
        Equal(5, challengeArtifact["limit"]!.GetValue<int>(),
            "final derivative challenge witness limit");
        Equal(2, challengeArtifact["inventory"]!["H"]!.GetValue<int>(),
            "final derivative challenge witness half inventory");
        True(!challengeArtifact["inventory"]!.AsObject().ContainsKey("Q"),
            "final derivative challenge excludes unused square operation");
        True(!challengeArtifact.ContainsKey("nodes"),
            "final derivative challenge hides witness nodes");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeArtifact) }
        });
        JsonObject challengeSolved = challengeImport;
        for (int index = 0; index < intendedOps.Length; index++)
            challengeSolved = Act(challengeSolved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"final-derivative-{index}",
                ["op"] = intendedOps[index], ["index"] = index
            });
        Equal(true, challengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "final derivative challenge round-trip admits hidden witness");
    }

    private static void IntegrationChapterContract()
    {
        var expectedSequenceCounts = new Dictionary<int, int>
        {
            [16] = 4, [19] = 4, [17] = 17, [20] = 10, [21] = 26, [18] = 206
        };
        var expectedSolutionCounts = new Dictionary<int, int>
        {
            [16] = 1, [19] = 1, [17] = 2, [20] = 1, [21] = 1, [18] = 6
        };
        var solutionsByLevel = new Dictionary<int, List<string>>();

        int[] chapterOrder = [16, 19, 17, 20, 21, 18];
        foreach (int level in chapterOrder)
        {
            var sequences = Enumerate(Inventories[level], Limits[level - 1]).ToList();
            Equal(expectedSequenceCounts[level], sequences.Count,
                $"integration level {level} legal sequence count");
            var solutions = new List<string>();
            double maximumSampleMagnitude = 0;
            string maximumRecipe = "";
            Fraction maximumValue = Fraction.Zero;
            int maximumSampleIndex = 0;

            foreach (var ops in sequences)
            {
                Fraction[] polynomial = BuildPolynomial(level, ops);
                True(polynomial.Length - 1 <= 4,
                    $"integration level {level} degree guard after [{string.Join(',', ops)}]");
                for (int sampleIndex = 0; sampleIndex <= 80; sampleIndex++)
                {
                    Fraction value = EvaluatePolynomial(polynomial, new Fraction(sampleIndex, 20));
                    double magnitude = Math.Abs(value.ToDouble());
                    if (magnitude > maximumSampleMagnitude)
                    {
                        maximumSampleMagnitude = magnitude;
                        maximumRecipe = string.Concat(ops);
                        maximumValue = value;
                        maximumSampleIndex = sampleIndex;
                    }
                }

                bool expectedSolution = IsIndependentSolution(level, ops);
                if (expectedSolution) solutions.Add(string.Concat(ops));
                JsonObject played;
                try
                {
                    played = PlayPuzzle(level, ops);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException(
                        $"integration level {level} kernel rejected [{string.Join(',', ops)}]: {ex.Message}", ex);
                }
                JsonObject result = played["result"]!.AsObject();
                CheckResultShape(level, result, ops);
                Equal(expectedSolution, result["solved"]!.GetValue<bool>(),
                    $"integration level {level} independent solved result after [{string.Join(',', ops)}]");
            }

            Equal(expectedSolutionCounts[level], solutions.Count,
                $"integration level {level} independent solved sequence count");
            True(maximumSampleMagnitude <= 10_000_000.0,
                $"all integration level {level} samples stay within the preview guard; max {maximumValue} after {maximumRecipe} at x={maximumSampleIndex}/20");
            solutionsByLevel[level] = solutions;
            Console.WriteLine($"INTEGRATION {level}: {sequences.Count} legal recipes, {solutions.Count} exact solutions; " +
                $"maximum guarded sample |h(x)|={maximumSampleMagnitude:R} ({maximumRecipe} at x={maximumSampleIndex}/20)");
        }

        Equal("I", string.Join(',', solutionsByLevel[16]),
            "constant integration has only the intended solution");
        Equal("HI,IH", string.Join(',', solutionsByLevel[17].Order(StringComparer.Ordinal)),
            "signed-area puzzle exact solution set");
        Equal("I", string.Join(',', solutionsByLevel[19]),
            "signed-cancellation bridge has only the intended solution");
        Equal("IA", string.Join(',', solutionsByLevel[20]),
            "integration lift bridge has only the intended solution");
        Equal("DI", string.Join(',', solutionsByLevel[21]),
            "slope recovery bridge has only the intended solution");
        Equal("HINA,HNIA,IHNA,INHA,NHIA,NIHA",
            string.Join(',', solutionsByLevel[18].Order(StringComparer.Ordinal)),
            "integration transfer exact solution set");

        string[] constantOps = ["I"];
        var constant = PlayPuzzle(16, constantOps);
        CheckResultShape(16, constant["result"]!.AsObject(), constantOps);
        Equal(true, constant["result"]!["solved"]!.GetValue<bool>(),
            "constant integration intended recipe solves");
        Equal("0", constant["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "integral is anchored at zero");
        Equal("4", constant["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "constant accumulates to endpoint area");
        Equal(0.0, Level(16)["result"]!["startSlope"]!.GetValue<double>(),
            "constant source has a flat start slope");
        Equal(1.0, constant["result"]!["startSlope"]!.GetValue<double>(),
            "integrated constant reports its exact start slope");
        Equal(-1.0, Level(17)["result"]!["startSlope"]!.GetValue<double>(),
            "descending source reports a negative start slope");
        var largeSlope = ImportCreation(11, ["Q", "Q", "Q"]);
        Equal(-1024.0, largeSlope["result"]!["startSlope"]!.GetValue<double>(),
            "steep construction reports a finite large start slope");

        var signedArea = PlayPuzzle(17, ["I"]);
        Equal("0", signedArea["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "signed area starts at zero");
        Equal("2", signedArea["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "signed area reaches its midpoint maximum");
        Equal("0", signedArea["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "positive and negative endpoint areas cancel");
        var cancellationBridge = PlayPuzzle(19, ["I"]);
        Equal(true, cancellationBridge["result"]!["solved"]!.GetValue<bool>(),
            "signed-cancellation bridge intended recipe solves");
        var signedIntended = PlayPuzzle(17, ["I", "H"]);
        Equal(true, signedIntended["result"]!["solved"]!.GetValue<bool>(),
            "signed-area intended recipe solves");
        var signedAlternate = PlayPuzzle(17, ["H", "I"]);
        Equal(true, signedAlternate["result"]!["solved"]!.GetValue<bool>(),
            "signed-area scaling alternative solves");

        var liftedIntegral = PlayPuzzle(20, ["I", "A"]);
        Equal(true, liftedIntegral["result"]!["solved"]!.GetValue<bool>(),
            "post-integration lift bridge intended recipe solves");
        var integratedLift = PlayPuzzle(20, ["A", "I"]);
        Equal(false, integratedLift["result"]!["solved"]!.GetValue<bool>(),
            "pre-integration lift changes accumulated slope");
        Equal("0", integratedLift["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "pre-integration lift remains anchored at zero");
        Equal("4", integratedLift["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "pre-integration lift differs at the midpoint");

        var recoveredChanges = PlayPuzzle(21, ["D", "I"]);
        Equal(true, recoveredChanges["result"]!["solved"]!.GetValue<bool>(),
            "slope recovery bridge intended recipe solves");
        var recoveredOriginal = PlayPuzzle(21, ["I", "D"]);
        Equal(false, recoveredOriginal["result"]!["solved"]!.GetValue<bool>(),
            "integrate-then-derive retains the original offset and misses");
        Equal("1", recoveredOriginal["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "integrate-then-derive exposes the original offset");

        string[] intendedOps = ["I", "H", "N", "A"];
        var intended = PlayPuzzle(18, intendedOps);
        CheckResultShape(18, intended["result"]!.AsObject(), intendedOps);
        Equal(true, intended["result"]!["solved"]!.GetValue<bool>(),
            "integration transfer intended recipe solves");

        var derivativeOfIntegral = ImportCreation(18, ["I", "D"]);
        string[] originalValues = ["-4", "-1/2", "0", "1/2", "4"];
        for (int index = 0; index < originalValues.Length; index++)
            Equal(originalValues[index],
                derivativeOfIntegral["result"]!["checkpoints"]![index]!["actual"]!.GetValue<string>(),
                $"D(Ih)=h at checkpoint {index}");

        var integralOfDerivative = ImportCreation(18, ["D", "I"]);
        string[] offsetValues = ["0", "7/2", "4", "9/2", "8"];
        for (int index = 0; index < offsetValues.Length; index++)
            Equal(offsetValues[index],
                integralOfDerivative["result"]!["checkpoints"]![index]!["actual"]!.GetValue<string>(),
                $"I(Dh)=h-h(0) at checkpoint {index}");

        var importedCreation = ImportCreation(18, intendedOps);
        var creationExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "function" });
        var creationArtifact = creationExport["artifact"]!.AsObject();
        Equal("I", creationArtifact["nodes"]![0]!["op"]!.GetValue<string>(),
            "integration creation exports integral operation");
        var creationRoundTrip = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationArtifact) }
        });
        Equal("I", creationRoundTrip["state"]!["nodes"]![0]!["op"]!.GetValue<string>(),
            "integration creation round-trip preserves integral operation");

        var challengeExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var challengeArtifact = challengeExport["artifact"]!.AsObject();
        Equal(1, challengeArtifact["inventory"]!["I"]!.GetValue<int>(),
            "integration challenge grants integral operation");
        True(!challengeArtifact["inventory"]!.AsObject().ContainsKey("D"),
            "integration challenge excludes unused derivative operation");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeArtifact) }
        });
        JsonObject challengeSolved = challengeImport;
        for (int index = 0; index < intendedOps.Length; index++)
            challengeSolved = Act(challengeSolved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"integration-{index}",
                ["op"] = intendedOps[index], ["index"] = index
            });
        Equal(true, challengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "integration challenge round-trip admits hidden witness");

        var maximumDegree = ImportCreation(16, Enumerable.Repeat("I", 32));
        Equal(32, maximumDegree["state"]!["nodes"]!.AsArray().Count,
            "anchored integration accepts the maximum polynomial degree");
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject
            {
                ["type"] = "import",
                ["artifact"] = CreationArtifact(16, Enumerable.Repeat("I", 33))
            }
        }, "degree limit of 32", "anchored integration degree guard");
    }

    private sealed class BoundedOracleAnalysis
    {
        public int RawCount;
        public int PlayableCount;
        public int MaxDegree;
        public double MaxPreviewMagnitude;
        public double MaxStartSlopeMagnitude;
        public int[] RawByLength = [];
        public int[] PlayableByLength = [];
        public List<string> RawSolutions = [];
        public List<string> PlayableSolutions = [];
    }

    private static BoundedOracleAnalysis AnalyzeBoundedCapstone(int level)
    {
        int limit = Limits[level - 1];
        var analysis = new BoundedOracleAnalysis
        {
            RawByLength = new int[limit + 1],
            PlayableByLength = new int[limit + 1]
        };
        var remaining = new Dictionary<string, int>(Inventories[level]);
        string[] operations = remaining.Keys.Order(StringComparer.Ordinal).ToArray();
        var prefix = new List<string>();
        Walk(BuildPolynomial(level, []), true);
        return analysis;

        void Walk(Fraction[] polynomial, bool ancestorsPlayable)
        {
            int length = prefix.Count;
            analysis.RawCount++;
            analysis.RawByLength[length]++;
            int degree = polynomial.Length - 1;
            analysis.MaxDegree = Math.Max(analysis.MaxDegree, degree);

            double startSlope = polynomial.Length > 1 ? Math.Abs(polynomial[1].ToDouble()) : 0.0;
            if (double.IsFinite(startSlope))
                analysis.MaxStartSlopeMagnitude = Math.Max(analysis.MaxStartSlopeMagnitude, startSlope);
            bool guarded = ancestorsPlayable && degree <= 32 && double.IsFinite(startSlope);
            for (int sampleIndex = 0; sampleIndex <= 80; sampleIndex++)
            {
                double x = sampleIndex / 20.0;
                double value = 0.0;
                for (int coefficient = polynomial.Length - 1; coefficient >= 0; coefficient--)
                    value = value * x + polynomial[coefficient].ToDouble();
                double magnitude = Math.Abs(value);
                if (double.IsFinite(magnitude))
                    analysis.MaxPreviewMagnitude = Math.Max(analysis.MaxPreviewMagnitude, magnitude);
                if (!double.IsFinite(magnitude) || magnitude > 10_000_000.0) guarded = false;
            }

            bool exactSolution = GoalXs[level - 1]
                .Select((x, index) => EvaluatePolynomial(polynomial, Fraction.Parse(x)))
                .SequenceEqual(GoalYs[level - 1].Select(Fraction.Parse));
            string recipe = string.Concat(prefix);
            if (exactSolution) analysis.RawSolutions.Add(recipe);
            if (guarded)
            {
                analysis.PlayableCount++;
                analysis.PlayableByLength[length]++;
                if (exactSolution) analysis.PlayableSolutions.Add(recipe);
            }

            if (length == limit) return;
            foreach (string op in operations)
            {
                if (remaining[op] == 0) continue;
                remaining[op]--;
                prefix.Add(op);
                Walk(ApplyPolynomial(polynomial, op), guarded);
                prefix.RemoveAt(prefix.Count - 1);
                remaining[op]++;
            }
        }
    }

    private static void EarlierChapterExtensionsContract()
    {
        var level24 = AnalyzeBoundedCapstone(24);
        CheckAuthoredOracle(level24, 19, 1, 2, 4, "AHAH", "height bridge");
        var level24Kernel = PlayPuzzle(24, ["A", "H", "A", "H"]);
        CheckResultShape(24, level24Kernel["result"]!.AsObject(), ["A", "H", "A", "H"]);
        Equal(true, level24Kernel["result"]!["solved"]!.GetValue<bool>(),
            "height bridge intended recipe solves in kernel");

        var level25 = AnalyzeBoundedCapstone(25);
        CheckAuthoredOracle(level25, 1253, 8, 2, 6, "AHHAHA", "height capstone");
        Equal("AAAAAHHHA,AAAHAHAAH,AAAHAHHA,AHAAAAHAH,AHAAHAAH,AHAAHHA,AHHAAAH,AHHAHA",
            string.Join(',', level25.PlayableSolutions.Order(StringComparer.Ordinal)),
            "height capstone complete exact solution set");
        string[] level25Intended = ["A", "H", "H", "A", "H", "A"];
        var level25Kernel = PlayPuzzle(25, level25Intended);
        CheckResultShape(25, level25Kernel["result"]!.AsObject(), level25Intended);
        Equal(true, level25Kernel["result"]!["solved"]!.GetValue<bool>(),
            "height capstone intended recipe solves in kernel");
        string[] level25NearMiss = ["A", "H", "H", "A", "A", "H"];
        var level25NearMissKernel = PlayPuzzle(25, level25NearMiss);
        CheckResultShape(25, level25NearMissKernel["result"]!.AsObject(), level25NearMiss);
        Equal(false, level25NearMissKernel["result"]!["solved"]!.GetValue<bool>(),
            "height capstone final lift placement is a near miss");
        Equal("9/8", level25NearMissKernel["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "height capstone near miss exposes the fractional baseline");

        var level26 = AnalyzeBoundedCapstone(26);
        CheckAuthoredOracle(level26, 3851, 16, 2, 6,
            "AHHHNA,AHHNHA,AHNHHA,ANHHHA", "reflection capstone");
        Equal("AANAHHHA,AHANAHHA,AHHANAHA,AHHHANAA,AHHHNA,AHHNAAH,AHHNHA,AHNAAHAH,AHNHAAH,AHNHHA,ANHAAHAH,ANHHAAH,ANHHHA,NAAAHHAH,NAHAAAHH,NAHAHAH",
            string.Join(',', level26.PlayableSolutions.Order(StringComparer.Ordinal)),
            "reflection capstone complete exact solution set");
        True(level26.PlayableSolutions.All(recipe => recipe.Contains('N')),
            "every reflection capstone solution uses reflection");
        True(level26.PlayableSolutions.Contains("NAHAHAH", StringComparer.Ordinal),
            "reflection capstone intended recipe solves independently");
        string[] level26Intended = ["N", "A", "H", "A", "H", "A", "H"];
        var level26Kernel = PlayPuzzle(26, level26Intended);
        CheckResultShape(26, level26Kernel["result"]!.AsObject(), level26Intended);
        Equal(true, level26Kernel["result"]!["solved"]!.GetValue<bool>(),
            "reflection capstone intended recipe solves in kernel");
        string[] level26Shortest = ["A", "H", "H", "H", "N", "A"];
        var level26ShortestKernel = PlayPuzzle(26, level26Shortest);
        CheckResultShape(26, level26ShortestKernel["result"]!.AsObject(), level26Shortest);
        Equal(true, level26ShortestKernel["result"]!["solved"]!.GetValue<bool>(),
            "reflection capstone shortest alternative solves in kernel");
        string[] level26NearMiss = ["A", "N", "H", "A", "H", "A", "H"];
        var level26NearMissKernel = PlayPuzzle(26, level26NearMiss);
        CheckResultShape(26, level26NearMissKernel["result"]!.AsObject(), level26NearMiss);
        Equal(false, level26NearMissKernel["result"]!["solved"]!.GetValue<bool>(),
            "reflection capstone baseline-before-reflection is a near miss");

        var level27 = AnalyzeBoundedCapstone(27);
        CheckAuthoredOracle(level27, 10, 1, 2, 2, "AQ", "squaring bridge");
        var squareBeforeLift = PlayPuzzle(27, ["Q", "A"]);
        CheckResultShape(27, squareBeforeLift["result"]!.AsObject(), ["Q", "A"]);
        Equal(false, squareBeforeLift["result"]!["solved"]!.GetValue<bool>(),
            "squaring bridge square-before-lift misses");

        var level28 = AnalyzeBoundedCapstone(28);
        CheckAuthoredOracle(level28, 10187, 19, 2, 6, "AHQNAH", "squaring capstone");
        Equal("AHNQAHNA,AHNQANHA,AHNQNAH,AHQAHNA,AHQANHA,AHQNAH,ANHQAHNA,ANHQANHA,ANHQNAH,ANQHHNAH,ANQHNHAH,ANQNHHAH,AQHHAHNA,AQHHANHA,AQHHNAH,AQHNAAHH,AQHNHAH,AQNHAAHH,AQNHHAH",
            string.Join(',', level28.PlayableSolutions.Order(StringComparer.Ordinal)),
            "squaring capstone complete exact solution set");
        True(level28.PlayableSolutions.All(recipe => recipe.Contains('Q')),
            "every squaring capstone solution uses square");
        string[] level28Intended = ["A", "H", "Q", "N", "A", "H"];
        var level28Kernel = PlayPuzzle(28, level28Intended);
        CheckResultShape(28, level28Kernel["result"]!.AsObject(), level28Intended);
        Equal(true, level28Kernel["result"]!["solved"]!.GetValue<bool>(),
            "squaring capstone intended recipe solves in kernel");
        string[] formerCenterNearMiss = ["H", "Q", "N", "A", "H"];
        var formerCenterKernel = PlayPuzzle(28, formerCenterNearMiss);
        CheckResultShape(28, formerCenterKernel["result"]!.AsObject(), formerCenterNearMiss);
        Equal(false, formerCenterKernel["result"]!["solved"]!.GetValue<bool>(),
            "squaring capstone unshifted fold is a near miss");
        Equal("1/2", formerCenterKernel["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "squaring capstone near miss remains centered at x=2");

        CheckCapstoneArtifactRoundTrip(25, level25Intended, "height capstone");
        CheckCapstoneArtifactRoundTrip(26, level26Intended, "reflection capstone");
        CheckCapstoneArtifactRoundTrip(28, level28Intended, "squaring capstone");

        PrintBoundedOracle(24, level24);
        PrintBoundedOracle(25, level25);
        PrintBoundedOracle(26, level26);
        PrintBoundedOracle(27, level27);
        PrintBoundedOracle(28, level28);
    }

    private static void CheckAuthoredOracle(BoundedOracleAnalysis analysis, int rawCount,
        int solutionCount, int maxDegree, int minimumLength, string shortestRecipes, string label)
    {
        Equal(rawCount, analysis.RawCount, $"{label} raw legal sequence count");
        Equal(analysis.RawCount, analysis.PlayableCount, $"{label} playable guarded sequence count");
        Equal(maxDegree, analysis.MaxDegree, $"{label} maximum polynomial degree");
        True(analysis.MaxPreviewMagnitude <= 10_000_000.0,
            $"{label} raw previews stay bounded; max {analysis.MaxPreviewMagnitude:R}");
        True(double.IsFinite(analysis.MaxStartSlopeMagnitude),
            $"{label} start slopes remain finite without a magnitude cap");
        Equal(solutionCount, analysis.RawSolutions.Count, $"{label} raw exact solution count");
        Equal(analysis.RawSolutions.Count, analysis.PlayableSolutions.Count,
            $"{label} exact solutions all pass guards");
        int actualMinimum = analysis.PlayableSolutions.Min(recipe => recipe.Length);
        Equal(minimumLength, actualMinimum, $"{label} minimum solution length");
        Equal(shortestRecipes,
            string.Join(',', analysis.PlayableSolutions.Where(recipe => recipe.Length == actualMinimum).Order(StringComparer.Ordinal)),
            $"{label} shortest solution set");
    }

    private static void PrintBoundedOracle(int level, BoundedOracleAnalysis analysis)
    {
        int minimum = analysis.PlayableSolutions.Min(recipe => recipe.Length);
        Console.WriteLine($"AUTHORED {level}: raw={analysis.RawCount}, playable={analysis.PlayableCount}, " +
            $"solutions={analysis.PlayableSolutions.Count}, min={minimum}, " +
            $"shortest={string.Join(',', analysis.PlayableSolutions.Where(recipe => recipe.Length == minimum).Order(StringComparer.Ordinal))}, " +
            $"by-length={string.Join(',', analysis.RawByLength)}, max degree={analysis.MaxDegree}, " +
            $"max |h(x)|={analysis.MaxPreviewMagnitude:R}, max |start slope|={analysis.MaxStartSlopeMagnitude:R}");
    }

    private static void LaterChapterCapstonesContract()
    {
        var level22 = AnalyzeBoundedCapstone(22);
        Equal(259396, level22.RawCount, "slopes capstone raw legal sequence count");
        Equal(level22.RawCount, level22.PlayableCount, "slopes capstone playable guarded sequence count");
        Equal(12, level22.MaxDegree, "slopes capstone maximum polynomial degree");
        True(level22.MaxPreviewMagnitude <= 10_000_000.0,
            $"slopes capstone raw previews stay bounded; max {level22.MaxPreviewMagnitude:R}");
        True(double.IsFinite(level22.MaxStartSlopeMagnitude),
            "slopes capstone start slopes remain finite without a magnitude cap");
        Equal(90, level22.RawSolutions.Count, "slopes capstone raw exact solution count");
        Equal(level22.RawSolutions.Count, level22.PlayableSolutions.Count,
            "slopes capstone exact solutions all pass guards");
        True(level22.PlayableSolutions.All(recipe => recipe.Contains('D')),
            "every slopes capstone solution uses differentiation");
        int level22Minimum = level22.PlayableSolutions.Min(recipe => recipe.Length);
        Equal(7, level22Minimum, "slopes capstone minimum solution length");
        Equal("DHHQQNA,HDHQQNA,HHDQQNA",
            string.Join(',', level22.PlayableSolutions.Where(recipe => recipe.Length == level22Minimum).Order(StringComparer.Ordinal)),
            "slopes capstone shortest solution set");
        True(level22.PlayableSolutions.Contains("DHHQQNA", StringComparer.Ordinal),
            "slopes capstone intended recipe solves independently");
        True(level22.PlayableSolutions.Contains("HHDQQNA", StringComparer.Ordinal),
            "slopes capstone derivative and scaling alternative solves independently");

        var level23 = AnalyzeBoundedCapstone(23);
        Equal(267778, level23.RawCount, "area capstone raw legal sequence count");
        Equal(level23.RawCount, level23.PlayableCount, "area capstone playable guarded sequence count");
        Equal(8, level23.MaxDegree, "area capstone maximum polynomial degree");
        True(level23.MaxPreviewMagnitude <= 10_000_000.0,
            $"area capstone raw previews stay bounded; max {level23.MaxPreviewMagnitude:R}");
        True(double.IsFinite(level23.MaxStartSlopeMagnitude),
            "area capstone start slopes remain finite without a magnitude cap");
        Equal(34, level23.RawSolutions.Count, "area capstone raw exact solution count");
        Equal(level23.RawSolutions.Count, level23.PlayableSolutions.Count,
            "area capstone exact solutions all pass guards");
        int level23Minimum = level23.PlayableSolutions.Min(recipe => recipe.Length);
        Equal(6, level23Minimum, "area capstone minimum solution length");
        Equal("INAQNA,NIAQNA",
            string.Join(',', level23.PlayableSolutions.Where(recipe => recipe.Length == level23Minimum).Order(StringComparer.Ordinal)),
            "area capstone shortest solution set");
        True(level23.PlayableSolutions.All(recipe => recipe.Contains('I')),
            "every area capstone solution uses integration");
        True(level23.PlayableSolutions.All(recipe => recipe.Contains('Q')),
            "every area capstone solution folds the accumulated shape");
        True(level23.PlayableSolutions.Contains("INAQNA", StringComparer.Ordinal),
            "area capstone intended recipe solves independently");
        True(level23.PlayableSolutions.Contains("INAQDIN", StringComparer.Ordinal),
            "area capstone derivative-then-integral alternative solves independently");
        True(level23.PlayableSolutions.Contains("INAQIDNA", StringComparer.Ordinal),
            "area capstone integral-then-derivative alternative solves independently");

        string[] level22Intended = ["D", "H", "H", "Q", "Q", "N", "A"];
        var level22Kernel = PlayPuzzle(22, level22Intended);
        CheckResultShape(22, level22Kernel["result"]!.AsObject(), level22Intended);
        Equal(true, level22Kernel["result"]!["solved"]!.GetValue<bool>(),
            "slopes capstone intended recipe solves in kernel");
        string[] level22Alternate = ["H", "H", "D", "Q", "Q", "N", "A"];
        var level22AlternateKernel = PlayPuzzle(22, level22Alternate);
        CheckResultShape(22, level22AlternateKernel["result"]!.AsObject(), level22Alternate);
        Equal(true, level22AlternateKernel["result"]!["solved"]!.GetValue<bool>(),
            "slopes capstone derivative placement alternative solves in kernel");
        string[] derivativeAfterSquare = ["H", "H", "Q", "D", "Q", "N", "A"];
        var derivativeAfterSquareKernel = PlayPuzzle(22, derivativeAfterSquare);
        CheckResultShape(22, derivativeAfterSquareKernel["result"]!.AsObject(), derivativeAfterSquare);
        Equal(false, derivativeAfterSquareKernel["result"]!["solved"]!.GetValue<bool>(),
            "slopes capstone derivative after square is a near miss");
        string[] wrongScaleOrder = ["D", "H", "Q", "H", "Q", "N", "A"];
        var wrongScaleKernel = PlayPuzzle(22, wrongScaleOrder);
        CheckResultShape(22, wrongScaleKernel["result"]!.AsObject(), wrongScaleOrder);
        Equal(false, wrongScaleKernel["result"]!["solved"]!.GetValue<bool>(),
            "slopes capstone scale between squares is a near miss");

        string[] level23Intended = ["I", "N", "A", "Q", "N", "A"];
        var level23Kernel = PlayPuzzle(23, level23Intended);
        CheckResultShape(23, level23Kernel["result"]!.AsObject(), level23Intended);
        Equal(true, level23Kernel["result"]!["solved"]!.GetValue<bool>(),
            "area capstone intended recipe solves in kernel");
        string[] level23Alternate = ["N", "I", "A", "Q", "N", "A"];
        var level23AlternateKernel = PlayPuzzle(23, level23Alternate);
        CheckResultShape(23, level23AlternateKernel["result"]!.AsObject(), level23Alternate);
        Equal(true, level23AlternateKernel["result"]!["solved"]!.GetValue<bool>(),
            "area capstone integration and reflection alternative solves in kernel");
        string[] derivativeThenIntegral = ["I", "N", "A", "Q", "D", "I", "N"];
        var derivativeThenIntegralKernel = PlayPuzzle(23, derivativeThenIntegral);
        CheckResultShape(23, derivativeThenIntegralKernel["result"]!.AsObject(), derivativeThenIntegral);
        Equal(true, derivativeThenIntegralKernel["result"]!["solved"]!.GetValue<bool>(),
            "area capstone derivative-then-integral alternative solves in kernel");
        string[] integralThenDerivative = ["I", "N", "A", "Q", "I", "D", "N", "A"];
        var integralThenDerivativeKernel = PlayPuzzle(23, integralThenDerivative);
        CheckResultShape(23, integralThenDerivativeKernel["result"]!.AsObject(), integralThenDerivative);
        Equal(true, integralThenDerivativeKernel["result"]!["solved"]!.GetValue<bool>(),
            "area capstone integral-then-derivative alternative solves in kernel");
        string[] centeredInWrongOrder = ["I", "A", "N", "Q", "N", "A"];
        var centeredInWrongOrderKernel = PlayPuzzle(23, centeredInWrongOrder);
        CheckResultShape(23, centeredInWrongOrderKernel["result"]!.AsObject(), centeredInWrongOrder);
        Equal(false, centeredInWrongOrderKernel["result"]!["solved"]!.GetValue<bool>(),
            "area capstone centering order is a near miss");

        CheckCapstoneArtifactRoundTrip(22, level22Intended, "slopes capstone");
        CheckCapstoneArtifactRoundTrip(23, level23Intended, "area capstone");

        Console.WriteLine($"LATE CAPSTONE 22: raw={level22.RawCount}, playable={level22.PlayableCount}, " +
            $"solutions={level22.PlayableSolutions.Count}, min={level22Minimum}, by-length={string.Join(',', level22.RawByLength)}, " +
            $"max degree={level22.MaxDegree}, max |h(x)|={level22.MaxPreviewMagnitude:R}, max |start slope|={level22.MaxStartSlopeMagnitude:R}");
        Console.WriteLine($"LATE CAPSTONE 23: raw={level23.RawCount}, playable={level23.PlayableCount}, " +
            $"solutions={level23.PlayableSolutions.Count}, min={level23Minimum}, by-length={string.Join(',', level23.RawByLength)}, " +
            $"max degree={level23.MaxDegree}, max |h(x)|={level23.MaxPreviewMagnitude:R}, max |start slope|={level23.MaxStartSlopeMagnitude:R}");
    }

    private static void CheckCapstoneArtifactRoundTrip(int level, string[] witness, string label)
    {
        var importedCreation = ImportCreation(level, witness);
        var creationExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "function" });
        var creationRoundTrip = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationExport["artifact"]!) }
        });
        Equal(level, creationRoundTrip["state"]!["sourceId"]!.GetValue<int>(), $"{label} creation round-trip source");
        Equal(witness[0], creationRoundTrip["state"]!["nodes"]![0]!["op"]!.GetValue<string>(),
            $"{label} creation round-trip first operation");

        var challengeExport = Act(importedCreation["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        True(!challengeExport["artifact"]!.AsObject().ContainsKey("nodes"), $"{label} challenge hides witness");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeExport["artifact"]!) }
        });
        JsonObject solved = challengeImport;
        for (int index = 0; index < witness.Length; index++)
            solved = Act(solved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"capstone-{level}-{index}",
                ["op"] = witness[index], ["index"] = index
            });
        Equal(true, solved["result"]!["solved"]!.GetValue<bool>(), $"{label} challenge round-trip admits witness");
    }

    private static void CapstoneContract()
    {
        var sequences = Enumerate(Inventories[11], Limits[10]).ToList();
        int[] expectedByLength = [1, 4, 16, 62, 228, 780, 2420, 6580, 14840];
        Equal(24931, sequences.Count, "capstone legal sequence count");
        for (int length = 0; length < expectedByLength.Length; length++)
            Equal(expectedByLength[length], sequences.Count(ops => ops.Count == length),
                $"capstone legal sequence count at length {length}");

        var solutions = new List<string>();
        double maximumSampleMagnitude = 0;
        string maximumRecipe = "";
        Fraction maximumValue = Fraction.Zero;
        int maximumSampleIndex = 0;
        foreach (var ops in sequences)
        {
            Fraction[] polynomial = BuildPolynomial(11, ops);
            True(polynomial.Length - 1 <= 8,
                $"capstone degree bound after [{string.Join(',', ops)}]");
            if (IsIndependentSolution(11, ops)) solutions.Add(string.Concat(ops));

            for (int sampleIndex = 0; sampleIndex <= 80; sampleIndex++)
            {
                Fraction value = EvaluatePolynomial(polynomial, new Fraction(sampleIndex, 20));
                double magnitude = Math.Abs(value.ToDouble());
                if (magnitude > maximumSampleMagnitude)
                {
                    maximumSampleMagnitude = magnitude;
                    maximumRecipe = string.Concat(ops);
                    maximumValue = value;
                    maximumSampleIndex = sampleIndex;
                }
            }
        }
        True(maximumSampleMagnitude <= 10_000_000.0,
            $"all capstone recipe samples stay within the preview guard; max {maximumValue} after {maximumRecipe} at x={maximumSampleIndex}/20");
        Equal(15, solutions.Count, "capstone independent solved sequence count");
        True(solutions.Contains("QHQNAA", StringComparer.Ordinal), "capstone intended recipe solves independently");
        True(solutions.Contains("QQHHNAA", StringComparer.Ordinal), "capstone alternate scaling recipe solves independently");

        string[] intendedOps = ["Q", "H", "Q", "N", "A", "A"];
        var intended = PlayPuzzle(11, intendedOps);
        CheckResultShape(11, intended["result"]!.AsObject(), intendedOps);
        Equal(true, intended["result"]!["solved"]!.GetValue<bool>(), "capstone intended recipe solves in kernel");
        Equal("-2", intended["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "capstone intended endpoint");
        Equal("7/4", intended["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "capstone intended shoulder");
        Equal("2", intended["result"]!["checkpoints"]![2]!["actual"]!.GetValue<string>(),
            "capstone intended center");

        string[] alternateOps = ["Q", "Q", "H", "H", "N", "A", "A"];
        var alternate = PlayPuzzle(11, alternateOps);
        CheckResultShape(11, alternate["result"]!.AsObject(), alternateOps);
        Equal(true, alternate["result"]!["solved"]!.GetValue<bool>(), "capstone alternate recipe solves in kernel");

        string[] wrongScaleOps = ["H", "Q", "Q", "N", "A", "A"];
        var wrongScale = PlayPuzzle(11, wrongScaleOps);
        CheckResultShape(11, wrongScale["result"]!.AsObject(), wrongScaleOps);
        Equal(false, wrongScale["result"]!["solved"]!.GetValue<bool>(), "capstone wrong scaling misses");
        Equal("1", wrongScale["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "capstone endpoint distinguishes wrong scaling");
        Equal("31/16", wrongScale["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "capstone shoulder distinguishes wrong scaling");

        string[] wrongOrderOps = ["Q", "H", "N", "Q", "A", "A"];
        var wrongOrder = PlayPuzzle(11, wrongOrderOps);
        CheckResultShape(11, wrongOrder["result"]!.AsObject(), wrongOrderOps);
        Equal(false, wrongOrder["result"]!["solved"]!.GetValue<bool>(), "capstone wrong operation order misses");
        Equal("6", wrongOrder["result"]!["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "capstone endpoint distinguishes wrong order");
        Equal("9/4", wrongOrder["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "capstone shoulder distinguishes wrong order");

        string[] highButSafeOps = ["A", "A", "A", "Q", "Q", "Q"];
        var highButSafe = PlayPuzzle(11, highButSafeOps);
        CheckResultShape(11, highButSafe["result"]!.AsObject(), highButSafeOps);
        Equal("390625", highButSafe["result"]!["checkpoints"]![4]!["actual"]!.GetValue<string>(),
            "capstone three-square preview stays inside numeric guard");

        var exhaustedHalves = PlayPuzzle(11, ["H", "H"]);
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(exhaustedHalves["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "third-half", ["op"] = "H", ["index"] = 2 }
        }, "not available", "capstone inventory guard");

        var fullRecipe = PlayPuzzle(11, ["H", "H", "A", "A", "A", "N", "N", "Q"]);
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(fullRecipe["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "ninth-part", ["op"] = "Q", ["index"] = 8 }
        }, "part limit", "capstone length guard");

        Console.WriteLine($"CAPSTONE: {sequences.Count} legal recipes, {solutions.Count} exact solutions; " +
            $"maximum guarded sample |h(x)|={maximumSampleMagnitude:R} ({maximumRecipe} at x={maximumSampleIndex}/20)");
    }

    private static void CheckResultShape(int level, JsonObject result, IReadOnlyList<string> ops)
    {
        var checkpoints = result["checkpoints"]!.AsArray();
        Equal(GoalXs[level - 1].Length, checkpoints.Count, $"level {level} checkpoint count");
        for (int checkpointIndex = 0; checkpointIndex < checkpoints.Count; checkpointIndex++)
        {
            var checkpoint = checkpoints[checkpointIndex]!.AsObject();
            string actual = checkpoint["actual"]!.GetValue<string>();
            string target = checkpoint["target"]!.GetValue<string>();
            Equal(GoalXs[level - 1][checkpointIndex], checkpoint["x"]!.GetValue<string>(),
                $"level {level} checkpoint position {checkpointIndex}");
            Equal(GoalYs[level - 1][checkpointIndex], target,
                $"level {level} authored target {checkpointIndex}");
            Equal(actual == GoalYs[level - 1][checkpointIndex], checkpoint["hit"]!.GetValue<bool>(),
                "exact rational hit flag");
            True(IsExactRational(actual), $"checkpoint actual is exact rational: {actual}");
            Equal(ExpectedAt(level, ops, GoalXs[level - 1][checkpointIndex]).ToString(), actual,
                $"level {level} exact checkpoint value after [{string.Join(',', ops)}]");
        }

        var stages = result["stages"]!.AsArray();
        Equal(ops.Count + 1, stages.Count, "stage count");
        Equal("source", stages[0]!["id"]!.GetValue<string>(), "source stage identity");
        for (int i = 0; i < stages.Count; i++)
        {
            True(!string.IsNullOrWhiteSpace(stages[i]!["expression"]!.GetValue<string>()), "stage expression nonempty");
            True(!string.IsNullOrWhiteSpace(stages[i]!["latex"]!.GetValue<string>()), "stage LaTeX nonempty");
            var stageValues = stages[i]!["values"]!.AsArray();
            Equal(GoalXs[level - 1].Length, stageValues.Count, "stage checkpoint values");
            for (int checkpointIndex = 0; checkpointIndex < stageValues.Count; checkpointIndex++)
                Equal(ExpectedAt(level, ops.Take(i).ToArray(), GoalXs[level - 1][checkpointIndex]).ToString(),
                    stageValues[checkpointIndex]!.GetValue<string>(),
                    $"level {level} stage {i} exact checkpoint {checkpointIndex}");
            CheckPreviewPoints(stages[i]!["points"]!.AsArray(), BuildPolynomial(level, ops.Take(i)),
                $"level {level} stage {i} preview after [{string.Join(',', ops)}]");
        }

        var resultPoints = result["points"]!.AsArray();
        CheckPreviewPoints(resultPoints, BuildPolynomial(level, ops),
            $"level {level} final preview after [{string.Join(',', ops)}]");
        Fraction[] finalPolynomial = BuildPolynomial(level, ops);
        double expectedStartSlope = finalPolynomial.Length > 1 ? finalPolynomial[1].ToDouble() : 0.0;
        double actualStartSlope = result["startSlope"]!.GetValue<double>();
        double slopeTolerance = 1e-12 * Math.Max(1.0, Math.Abs(expectedStartSlope));
        True(double.IsFinite(actualStartSlope) && Math.Abs(actualStartSlope - expectedStartSlope) <= slopeTolerance,
            $"level {level} exact-function start slope after [{string.Join(',', ops)}]: expected {expectedStartSlope:R}, got {actualStartSlope:R}");
        var pointXs = resultPoints
            .Select(p => p!.AsArray()[0]!.GetValue<double>()).ToList();
        Equal(0.0, pointXs.First(), $"level {level} preview domain start");
        Equal(level == 5 ? 2.0 : 4.0, pointXs.Last(), $"level {level} preview domain end");
        foreach (string x in GoalXs[level - 1])
            True(pointXs.Any(v => Math.Abs(v - RationalDouble(x)) < 1e-12), $"samples contain checkpoint x={x}");

        if (level == 5 && ops.SequenceEqual(new[] { "D" }))
        {
            Equal("3 * x ^ 2", stages[1]!["expression"]!.GetValue<string>(), "differentiation expression");
            Equal("0", checkpoints[0]!["actual"]!.GetValue<string>(), "derivative at zero");
            Equal("3", checkpoints[1]!["actual"]!.GetValue<string>(), "derivative at one");
            Equal("12", checkpoints[2]!["actual"]!.GetValue<string>(), "derivative at two");
        }
    }

    private static void CommandAndIdentityContract()
    {
        var state = Level(3)["state"]!;
        var first = Act(state, new JsonObject { ["type"] = "insert", ["id"] = "alpha_1", ["op"] = "A", ["index"] = 0 });
        var second = Act(first["state"]!, new JsonObject { ["type"] = "insert", ["id"] = "half-2", ["op"] = "H", ["index"] = 1 });
        var evaluated = Act(second["state"]!, new JsonObject { ["type"] = "evaluate" });
        Equal("alpha_1", evaluated["state"]!["nodes"]![0]!["id"]!.GetValue<string>(), "first identity survives evaluate");
        Equal("half-2", evaluated["state"]!["nodes"]![1]!["id"]!.GetValue<string>(), "second identity survives evaluate");

        var moved = Act(evaluated["state"]!, new JsonObject { ["type"] = "move", ["id"] = "half-2", ["index"] = 0 });
        Equal("half-2", moved["state"]!["nodes"]![0]!["id"]!.GetValue<string>(), "move reorders by identity");
        Equal("alpha_1", moved["state"]!["nodes"]![1]!["id"]!.GetValue<string>(), "move retains other identity");
        var removed = Act(moved["state"]!, new JsonObject { ["type"] = "remove", ["id"] = "alpha_1" });
        Equal(1, removed["state"]!["nodes"]!.AsArray().Count, "remove count");
        Equal("half-2", removed["state"]!["nodes"]![0]!["id"]!.GetValue<string>(), "remove targets identity");
        var reset = Act(removed["state"]!, new JsonObject { ["type"] = "reset" });
        Equal(0, reset["state"]!["nodes"]!.AsArray().Count, "reset clears nodes");
    }

    private static void InvalidInputContract()
    {
        Equal("invalid", Status("{"), "malformed JSON classification");
        Equal("invalid", Status(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "level", ["sourceId"] = "one", ["mode"] = "puzzle" }
        }.ToJsonString()), "wrong scalar field type classification");

        var level1 = Level(1)["state"]!;
        Invalid(new JsonObject { ["state"] = Clone(level1), ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "bad id", ["op"] = "H", ["index"] = 0 } }, "unsafe id");
        Invalid(new JsonObject { ["state"] = Clone(level1), ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "x", ["op"] = "D", ["index"] = 0 } }, "unavailable inventory");

        var once = Act(level1, new JsonObject { ["type"] = "insert", ["id"] = "same", ["op"] = "H", ["index"] = 0 });
        Invalid(new JsonObject { ["state"] = Clone(once["state"]!), ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "same", ["op"] = "A", ["index"] = 1 } }, "duplicate identity");

        var badVersion = Clone(level1).AsObject();
        badVersion["schema"] = 2;
        Invalid(new JsonObject { ["state"] = badVersion, ["action"] = new JsonObject { ["type"] = "evaluate" } }, "unsupported version");

        var badGoal = Clone(level1).AsObject();
        badGoal["goals"]![0]!["y"] = "1";
        Invalid(new JsonObject { ["state"] = badGoal, ["action"] = new JsonObject { ["type"] = "evaluate" } }, "authored goal tampering");

        var badInventory = Clone(level1).AsObject();
        badInventory["inventory"]!["H"] = 2;
        Invalid(new JsonObject { ["state"] = badInventory, ["action"] = new JsonObject { ["type"] = "evaluate" } }, "authored inventory tampering");

        Equal("invalid", Status(new string('x', 65537)), "64 KiB character request cap");
        Equal("invalid", Status(new string('\u00e9', 40000)), "64 KiB UTF-8 request cap");
    }

    private static void ReusableRemixContract()
    {
        var remix = Remix(1);
        Equal(0, remix["state"]!["inventory"]!.AsObject().Count, "new remix has reusable inventory sentinel");
        Equal(0, remix["state"]!["limit"]!.GetValue<int>(), "new remix has unlimited limit sentinel");
        Equal(false, remix["result"]!["solved"]!.GetValue<bool>(), "remix never reports puzzle solved");

        JsonObject repeatedHalves = remix;
        var halves = Enumerable.Repeat("H", 8).ToArray();
        for (int i = 0; i < halves.Length; i++)
            repeatedHalves = Act(repeatedHalves["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"half-{i}", ["op"] = "H", ["index"] = i
            });
        Equal(8, repeatedHalves["state"]!["nodes"]!.AsArray().Count, "remix accepts more than six repeated operations");
        Equal(ExpectedAt(1, halves, "2").ToString(),
            repeatedHalves["result"]!["checkpoints"]![1]!["actual"]!.GetValue<string>(),
            "repeated remix operation remains exact");
        Equal(false, repeatedHalves["result"]!["solved"]!.GetValue<bool>(), "built remix remains unsolved by contract");

        var puzzleHalf = Act(Level(1)["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "puzzle-half", ["op"] = "H", ["index"] = 0
        });
        var converted = Act(puzzleHalf["state"]!, new JsonObject { ["type"] = "remix" });
        Equal(1, converted["state"]!["nodes"]!.AsArray().Count, "remix command preserves construction");
        Equal(0, converted["state"]!["inventory"]!.AsObject().Count, "remix command enables reusable inventory sentinel");
        Equal(0, converted["state"]!["limit"]!.GetValue<int>(), "remix command enables unlimited limit sentinel");
        converted = Act(converted["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "reused-half", ["op"] = "H", ["index"] = 1
        });
        Equal(2, converted["state"]!["nodes"]!.AsArray().Count, "remix command can reuse an authored operation");

        string[] allRepeated = ["H", "H", "A", "A", "N", "N", "Q", "Q", "D", "D", "I", "I"];
        var repeatedKinds = ImportCreation(4, allRepeated);
        CheckResultShape(4, repeatedKinds["result"]!.AsObject(), allRepeated);
        Equal(false, repeatedKinds["result"]!["solved"]!.GetValue<bool>(), "all reusable operation result stays remix");

        var legacy = Clone(remix["state"]!).AsObject();
        legacy["inventory"] = InventoryNode(LegacyRemixInventory);
        legacy["limit"] = 6;
        legacy["nodes"] = NodeArray(["H", "H", "H"]);
        var upgraded = Ok(new JsonObject
        {
            ["state"] = legacy, ["action"] = new JsonObject { ["type"] = "evaluate" }
        });
        Equal(3, upgraded["state"]!["nodes"]!.AsArray().Count, "legacy remix nodes survive upgrade");
        Equal(0, upgraded["state"]!["inventory"]!.AsObject().Count, "legacy remix inventory normalizes");
        Equal(0, upgraded["state"]!["limit"]!.GetValue<int>(), "legacy remix limit normalizes");
        var extendedUpgrade = Act(upgraded["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "post-upgrade-integral", ["op"] = "I", ["index"] = 3
        });
        Equal("I", extendedUpgrade["state"]!["nodes"]![3]!["op"]!.GetValue<string>(),
            "legacy remix upgrade accepts the new operation without changing its old inventory payload");

        var overusedLegacy = Clone(remix["state"]!).AsObject();
        overusedLegacy["inventory"] = InventoryNode(LegacyRemixInventory);
        overusedLegacy["limit"] = 6;
        overusedLegacy["nodes"] = NodeArray(["H", "H", "H", "H"]);
        InvalidContains(new JsonObject
        {
            ["state"] = overusedLegacy, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "not available", "legacy remix constraints validate before upgrade");

        var alteredRules = Clone(remix["state"]!).AsObject();
        alteredRules["inventory"] = new JsonObject { ["H"] = 64 };
        Invalid(new JsonObject
        {
            ["state"] = alteredRules, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "noncanonical reusable remix state");
    }

    private static void SourceSelectionContract()
    {
        var built = Act(Remix(1)["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "kept-half", ["op"] = "H", ["index"] = 0
        });
        built = Act(built["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "kept-negate", ["op"] = "N", ["index"] = 1
        });

        string[] preservedOps = ["H", "N"];
        var changed = Act(built["state"]!, new JsonObject { ["type"] = "source", ["sourceId"] = 8 });
        var changedState = changed["state"]!.AsObject();
        Equal(8, changedState["sourceId"]!.GetValue<int>(), "source command changes the starting curve");
        Equal("remix", changedState["mode"]!.GetValue<string>(), "source command remains in creation mode");
        Equal(2, changedState["nodes"]!.AsArray().Count, "source command preserves operation count");
        Equal("kept-half", changedState["nodes"]![0]!["id"]!.GetValue<string>(), "source command preserves first identity");
        Equal("H", changedState["nodes"]![0]!["op"]!.GetValue<string>(), "source command preserves first operation");
        Equal("kept-negate", changedState["nodes"]![1]!["id"]!.GetValue<string>(), "source command preserves second identity");
        Equal("N", changedState["nodes"]![1]!["op"]!.GetValue<string>(), "source command preserves second operation");
        Equal(0, changedState["goals"]!.AsArray().Count, "source command clears inherited goals");
        Equal(0, changedState["inventory"]!.AsObject().Count, "source command keeps reusable inventory sentinel");
        Equal(0, changedState["limit"]!.GetValue<int>(), "source command keeps unlimited limit sentinel");
        var fallbackCheckpoints = changed["result"]!["checkpoints"]!.AsArray();
        Equal(GoalXs[7].Length, fallbackCheckpoints.Count, "source result has canonical presentation samples");
        for (int checkpointIndex = 0; checkpointIndex < fallbackCheckpoints.Count; checkpointIndex++)
        {
            var checkpoint = fallbackCheckpoints[checkpointIndex]!;
            string expectedActual = ExpectedAt(8, preservedOps, GoalXs[7][checkpointIndex]).ToString();
            Equal(GoalXs[7][checkpointIndex], checkpoint["x"]!.GetValue<string>(),
                $"source presentation sample position {checkpointIndex}");
            Equal("0", checkpoint["target"]!.GetValue<string>(),
                $"source presentation sample neutral target {checkpointIndex}");
            Equal(expectedActual, checkpoint["actual"]!.GetValue<string>(),
                $"source presentation sample value {checkpointIndex}");
            Equal(expectedActual == "0", checkpoint["hit"]!.GetValue<bool>(),
                $"source presentation sample neutral match {checkpointIndex}");
        }
        Equal(false, changed["result"]!["solved"]!.GetValue<bool>(), "source result stays unsolved in creation mode");

        var stages = changed["result"]!["stages"]!.AsArray();
        Equal(preservedOps.Length + 1, stages.Count, "source result stage count");
        Equal("kept-half", stages[1]!["id"]!.GetValue<string>(), "source result keeps first stage identity");
        Equal("kept-negate", stages[2]!["id"]!.GetValue<string>(), "source result keeps second stage identity");
        for (int i = 0; i < stages.Count; i++)
        {
            var stageValues = stages[i]!["values"]!.AsArray();
            Equal(GoalXs[7].Length, stageValues.Count, $"changed source stage {i} presentation values");
            for (int checkpointIndex = 0; checkpointIndex < stageValues.Count; checkpointIndex++)
                Equal(ExpectedAt(8, preservedOps.Take(i).ToArray(), GoalXs[7][checkpointIndex]).ToString(),
                    stageValues[checkpointIndex]!.GetValue<string>(),
                    $"changed source stage {i} exact presentation value {checkpointIndex}");
            CheckPreviewPoints(stages[i]!["points"]!.AsArray(), BuildPolynomial(8, preservedOps.Take(i)),
                $"changed source stage {i}");
        }
        CheckPreviewPoints(changed["result"]!["points"]!.AsArray(), BuildPolynomial(8, preservedOps),
            "changed source final preview");
        Equal(4.0, changed["result"]!["points"]!.AsArray()[^1]![0]!.GetValue<double>(),
            "new authored source uses the four-unit domain");

        var creationExport = Act(changedState,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "flow" });
        var creationArtifact = creationExport["artifact"]!.AsObject();
        Equal(8, creationArtifact["sourceId"]!.GetValue<int>(), "changed source creation export source");
        Equal(2, creationArtifact["nodes"]!.AsArray().Count, "changed source creation export node count");
        Equal("kept-half", creationArtifact["nodes"]![0]!["id"]!.GetValue<string>(),
            "changed source creation export first identity");
        Equal("kept-negate", creationArtifact["nodes"]![1]!["id"]!.GetValue<string>(),
            "changed source creation export second identity");
        var creationImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationArtifact) }
        });
        Equal(8, creationImport["state"]!["sourceId"]!.GetValue<int>(), "changed source creation import source");
        Equal("kept-half", creationImport["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "changed source creation import preserves first identity");
        Equal("kept-negate", creationImport["state"]!["nodes"]![1]!["id"]!.GetValue<string>(),
            "changed source creation import preserves second identity");

        var challengeExport = Act(changedState,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var challengeArtifact = challengeExport["artifact"]!.AsObject();
        True(!challengeArtifact.ContainsKey("nodes"), "changed source challenge export hides solution nodes");
        Equal(preservedOps.Length, challengeArtifact["limit"]!.GetValue<int>(),
            "changed source challenge export derives witness limit");
        Equal(1, challengeArtifact["inventory"]!["H"]!.GetValue<int>(),
            "changed source challenge export derives half inventory");
        Equal(1, challengeArtifact["inventory"]!["N"]!.GetValue<int>(),
            "changed source challenge export derives negate inventory");
        var challengeGoals = challengeArtifact["goals"]!.AsArray();
        Equal(GoalXs[7].Length, challengeGoals.Count, "changed source challenge uses canonical positions");
        for (int checkpointIndex = 0; checkpointIndex < challengeGoals.Count; checkpointIndex++)
        {
            Equal(GoalXs[7][checkpointIndex], challengeGoals[checkpointIndex]!["x"]!.GetValue<string>(),
                $"changed source challenge position {checkpointIndex}");
            Equal(ExpectedAt(8, preservedOps, GoalXs[7][checkpointIndex]).ToString(),
                challengeGoals[checkpointIndex]!["y"]!.GetValue<string>(),
                $"changed source challenge exact target {checkpointIndex}");
        }
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeArtifact) }
        });
        Equal("challenge", challengeImport["state"]!["mode"]!.GetValue<string>(),
            "changed source challenge import mode");
        Equal(8, challengeImport["state"]!["sourceId"]!.GetValue<int>(),
            "changed source challenge import source");
        Equal(0, challengeImport["state"]!["nodes"]!.AsArray().Count,
            "changed source challenge import hides witness");
        Equal(4.0, challengeImport["result"]!["points"]!.AsArray()[^1]![0]!.GetValue<double>(),
            "changed source challenge import domain");
        var challengeSolved = Act(challengeImport["state"]!,
            new JsonObject { ["type"] = "insert", ["id"] = "challenge-half", ["op"] = "H", ["index"] = 0 });
        challengeSolved = Act(challengeSolved["state"]!,
            new JsonObject { ["type"] = "insert", ["id"] = "challenge-negate", ["op"] = "N", ["index"] = 1 });
        Equal(true, challengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "changed source challenge admits preserved witness");

        var capstoneSource = Act(changedState,
            new JsonObject { ["type"] = "source", ["sourceId"] = 11 });
        Equal(11, capstoneSource["state"]!["sourceId"]!.GetValue<int>(),
            "source command accepts the capstone source id");
        Equal("kept-half", capstoneSource["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "capstone source change preserves recipe identity");
        Equal(0, capstoneSource["state"]!["goals"]!.AsArray().Count,
            "capstone source change keeps creation goals empty");
        Equal(GoalXs[10].Length, capstoneSource["result"]!["checkpoints"]!.AsArray().Count,
            "capstone source change uses canonical presentation positions");
        CheckPreviewPoints(capstoneSource["result"]!["points"]!.AsArray(), BuildPolynomial(11, preservedOps),
            "capstone source-change preview");

        var roundRoofSource = Act(changedState,
            new JsonObject { ["type"] = "source", ["sourceId"] = 13 });
        Equal(13, roundRoofSource["state"]!["sourceId"]!.GetValue<int>(),
            "source command accepts the round-roof source id");
        Equal("kept-half", roundRoofSource["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "round-roof source change preserves recipe identity");
        Equal(0, roundRoofSource["state"]!["goals"]!.AsArray().Count,
            "round-roof source change keeps creation goals empty");
        Equal(GoalXs[12].Length, roundRoofSource["result"]!["checkpoints"]!.AsArray().Count,
            "round-roof source change uses canonical presentation positions");
        CheckPreviewPoints(roundRoofSource["result"]!["points"]!.AsArray(), BuildPolynomial(13, preservedOps),
            "round-roof source-change preview");

        var extended = Act(changedState, new JsonObject
        {
            ["type"] = "insert", ["id"] = "after-source", ["op"] = "A", ["index"] = 2
        });
        Equal(0, extended["state"]!["goals"]!.AsArray().Count, "empty creation goals survive the next edit");
        Equal("after-source", extended["state"]!["nodes"]![2]!["id"]!.GetValue<string>(),
            "editing continues after a source change");
        CheckPreviewPoints(extended["result"]!["points"]!.AsArray(), BuildPolynomial(8, ["H", "N", "A"]),
            "edited changed-source preview");

        foreach (int invalidSource in new[] { 0, GoalXs.Length + 1 })
            Invalid(new JsonObject
            {
                ["state"] = Clone(changedState),
                ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = invalidSource }
            }, $"invalid source command id {invalidSource}");

        var puzzleFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(Level(1)["state"]!),
            ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = 6 }
        }, "puzzle source change rejection");
        True(!puzzleFailure.ContainsKey("state"), "rejected puzzle source change returns no state");

        var challengeState = Clone(Level(1)["state"]!).AsObject();
        challengeState["mode"] = "challenge";
        var challengeFailure = InvalidResponse(new JsonObject
        {
            ["state"] = challengeState,
            ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = 6 }
        }, "challenge source change rejection");
        True(!challengeFailure.ContainsKey("state"), "rejected challenge source change returns no state");

        string[] derivativeSafeAtDegreeBoundary = ["D", "Q", "Q", "Q", "Q", "Q"];
        var degreeSafeSource = ImportCreation(4, derivativeSafeAtDegreeBoundary);
        var degreeFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(degreeSafeSource["state"]!),
            ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = 5 }
        }, "source change degree rejection");
        Contains(degreeFailure["message"]!.GetValue<string>(), "degree limit of 32", "source change degree wording");
        True(!degreeFailure.ContainsKey("state"), "rejected degree-changing source returns no state");
        Equal(4, degreeSafeSource["state"]!["sourceId"]!.GetValue<int>(), "acknowledged source survives rejected degree change");

        var numericSafeSource = ImportCreation(4, ["D", "Q", "Q", "Q"]);
        var numericFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(numericSafeSource["state"]!),
            ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = 5 }
        }, "source change numeric rejection");
        Contains(numericFailure["message"]!.GetValue<string>(), "preview range", "source change numeric wording");
        True(!numericFailure.ContainsKey("state"), "rejected numeric source change returns no state");
    }

    private static void PreviewLimitContract()
    {
        string[] degreeBoundary = Enumerable.Repeat("H", 8).Concat(Enumerable.Repeat("Q", 4)).ToArray();
        JsonObject degreeState = ImportCreation(1, degreeBoundary);
        var degreeFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(degreeState["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "square-4", ["op"] = "Q", ["index"] = 12 }
        }, "polynomial degree rejection");
        Contains(degreeFailure["message"]!.GetValue<string>(), "degree limit of 32", "polynomial degree rejection wording");
        True(!degreeFailure.ContainsKey("state"), "invalid degree move returns no unacknowledged state");
        Equal(12, degreeState["state"]!["nodes"]!.AsArray().Count, "acknowledged degree state remains intact");

        string[] sixtyFourHalves = Enumerable.Repeat("H", 64).ToArray();
        var full = ImportCreation(1, sixtyFourHalves);
        Equal(64, full["state"]!["nodes"]!.AsArray().Count, "64-part preview guard admits boundary");
        var lengthFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(full["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "part-64", ["op"] = "H", ["index"] = 64 }
        }, "65th part rejection");
        Contains(lengthFailure["message"]!.GetValue<string>(), "at most 64 parts", "part guard wording");
        True(!lengthFailure.ContainsKey("state"), "invalid length move returns no unacknowledged state");

        string[] highButFinite = ["A", "A", "A", "A", "Q", "Q", "Q"];
        var high = ImportCreation(4, highButFinite);
        var rangeFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(high["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "range-square", ["op"] = "Q", ["index"] = 7 }
        }, "preview numeric range rejection");
        Contains(rangeFailure["message"]!.GetValue<string>(), "preview range", "preview numeric range wording");
        Equal("invalid", rangeFailure["status"]!.GetValue<string>(), "preview overflow is not an opaque engine error");

        var challengeRangeFailure = InvalidResponse(new JsonObject
        {
            ["state"] = Clone(high["state"]!),
            ["action"] = new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" }
        }, "challenge target export range rejection");
        Equal("This construction's checkpoint values exceed the supported challenge target range.", challengeRangeFailure["message"]!.GetValue<string>(), "challenge export explanation has no runtime diagnostics");
    }

    private static void ExportImportContract()
    {
        var remix = Remix(5);
        var built = Act(remix["state"]!, new JsonObject { ["type"] = "insert", ["id"] = "derivative", ["op"] = "D", ["index"] = 0 });
        built = Act(built["state"]!, new JsonObject { ["type"] = "insert", ["id"] = "plus", ["op"] = "A", ["index"] = 1 });

        var creationExport = Act(built["state"]!, new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "flight" });
        var creation = creationExport["artifact"]!.AsObject();
        Equal("creation", creation["type"]!.GetValue<string>(), "creation artifact type");
        Equal(2, creation["nodes"]!.AsArray().Count, "creation exports construction");
        True(!creation.ContainsKey("goals") && !creation.ContainsKey("result") && !creation.ContainsKey("solution"), "creation has no goal or solution leakage");
        var creationImport = Ok(new JsonObject { ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creation) } });
        Equal("remix", creationImport["state"]!["mode"]!.GetValue<string>(), "creation imports as remix");
        Equal("derivative", creationImport["state"]!["nodes"]![0]!["id"]!.GetValue<string>(), "creation import preserves node identity");
        Equal("plus", creationImport["state"]!["nodes"]![1]!["id"]!.GetValue<string>(), "creation import preserves node order");

        var challengeExport = Act(built["state"]!, new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" });
        var challenge = challengeExport["artifact"]!.AsObject();
        Equal("challenge", challenge["type"]!.GetValue<string>(), "challenge artifact type");
        True(!challenge.ContainsKey("nodes") && !challenge.ContainsKey("result") && !challenge.ContainsKey("solution"), "challenge has no construction or solution leakage");
        var challengeImport = Ok(new JsonObject { ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challenge) } });
        Equal("challenge", challengeImport["state"]!["mode"]!.GetValue<string>(), "challenge import mode");
        Equal(0, challengeImport["state"]!["nodes"]!.AsArray().Count, "challenge import starts without nodes");
        Equal(2, challengeImport["state"]!["limit"]!.GetValue<int>(), "challenge limit derives from witness length");
        Equal(1, challengeImport["state"]!["inventory"]!["D"]!.GetValue<int>(), "challenge derives derivative inventory");
        Equal(1, challengeImport["state"]!["inventory"]!["A"]!.GetValue<int>(), "challenge derives add inventory");
        Equal(2, challengeImport["state"]!["inventory"]!.AsObject().Count, "challenge does not grant unused operations");

        JsonObject solvedSmall = challengeImport;
        foreach ((string op, int index) in new[] { "D", "A" }.Select((op, index) => (op, index)))
            solvedSmall = Act(solvedSmall["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"solution-{index}", ["op"] = op, ["index"] = index
            });
        Equal(true, solvedSmall["result"]!["solved"]!.GetValue<bool>(), "derived challenge constraints admit hidden witness");

        string[] longWitness = Enumerable.Repeat("H", 32).ToArray();
        var longBuild = ImportCreation(1, longWitness);
        var longCreationExport = Act(longBuild["state"]!, new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "flow" });
        Equal(32, longCreationExport["artifact"]!["nodes"]!.AsArray().Count, "creation exports more than six repeated operations");
        var longCreationImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(longCreationExport["artifact"]!) }
        });
        Equal(32, longCreationImport["state"]!["nodes"]!.AsArray().Count, "larger creation roundtrip");
        Equal(0, longCreationImport["state"]!["inventory"]!.AsObject().Count, "larger creation imports with reusable operations");

        var largeExport = Act(longCreationImport["state"]!, new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "function" });
        var largeChallenge = largeExport["artifact"]!.AsObject();
        Equal(32, largeChallenge["limit"]!.GetValue<int>(), "larger challenge witness limit");
        Equal(32, largeChallenge["inventory"]!["H"]!.GetValue<int>(), "larger challenge witness inventory");
        Equal(1, largeChallenge["inventory"]!.AsObject().Count, "larger challenge inventory is exact");
        Equal(ExpectedAt(1, longWitness, "2").ToString(), largeChallenge["goals"]![1]!["y"]!.GetValue<string>(),
            "larger challenge keeps long exact denominator");
        var largeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(largeChallenge) }
        });
        var largeSolutionState = Clone(largeImport["state"]!).AsObject();
        largeSolutionState["nodes"] = NodeArray(longWitness);
        var largeSolved = Ok(new JsonObject
        {
            ["state"] = largeSolutionState, ["action"] = new JsonObject { ["type"] = "evaluate" }
        });
        Equal(true, largeSolved["result"]!["solved"]!.GetValue<bool>(), "larger challenge roundtrip remains solvable");

        var emptyExport = Act(Remix(2)["state"]!, new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" });
        Equal(0, emptyExport["artifact"]!["limit"]!.GetValue<int>(), "empty challenge has zero witness limit");
        Equal(0, emptyExport["artifact"]!["inventory"]!.AsObject().Count, "empty challenge has empty inventory");
        var emptyImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(emptyExport["artifact"]!) }
        });
        Equal(true, emptyImport["result"]!["solved"]!.GetValue<bool>(), "zero-node challenge is immediately solvable");

        var legacyChallenge = Clone(challenge).AsObject();
        legacyChallenge["inventory"] = InventoryNode(LegacyRemixInventory);
        legacyChallenge["limit"] = 6;
        var legacyChallengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = legacyChallenge }
        });
        Equal(6, legacyChallengeImport["state"]!["limit"]!.GetValue<int>(), "legacy challenge limit remains compatible");
        Equal(3, legacyChallengeImport["state"]!["inventory"]!["H"]!.GetValue<int>(), "legacy challenge inventory remains compatible");

        string longDenominator = "1" + new string('0', 99);
        var boundedRational = Clone(emptyExport["artifact"]!).AsObject();
        boundedRational["goals"]![0]!["y"] = "1/" + longDenominator;
        var boundedRationalImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = boundedRational }
        });
        Equal("1/" + longDenominator, boundedRationalImport["state"]!["goals"]![0]!["y"]!.GetValue<string>(),
            "bounded 100-digit exact challenge value imports");

        var oversizedRational = Clone(emptyExport["artifact"]!).AsObject();
        oversizedRational["goals"]![0]!["y"] = "1/" + new string('9', 129);
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = oversizedRational }
        }, "bounded exact fractions", "oversized exact challenge value rejection");

        var oversizedInventory = Clone(largeChallenge).AsObject();
        oversizedInventory["inventory"]!["H"] = 65;
        Invalid(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = oversizedInventory }
        }, "oversized challenge inventory rejection");

        var oversizedLimit = Clone(largeChallenge).AsObject();
        oversizedLimit["limit"] = 65;
        Invalid(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = oversizedLimit }
        }, "oversized challenge limit rejection");

        var oversizedCreation = CreationArtifact(1, Enumerable.Repeat("H", 65));
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = oversizedCreation }
        }, "at most 64 parts", "oversized creation rejection");

        var badViewArtifact = Clone(creation).AsObject();
        badViewArtifact["view"] = "unsupported";
        Invalid(new JsonObject { ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = badViewArtifact } },
            "unsupported imported artifact view");
    }

    private static JsonObject Remix(int sourceId) => Ok(new JsonObject
    {
        ["action"] = new JsonObject { ["type"] = "level", ["sourceId"] = sourceId, ["mode"] = "remix" }
    });

    private static JsonObject ImportCreation(int sourceId, IEnumerable<string> ops) => Ok(new JsonObject
    {
        ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = CreationArtifact(sourceId, ops) }
    });

    private static JsonObject CreationArtifact(int sourceId, IEnumerable<string> ops) => new()
    {
        ["schema"] = 1,
        ["rules"] = "vine-1",
        ["engine"] = "AngouriMath-2.5.0",
        ["type"] = "creation",
        ["sourceId"] = sourceId,
        ["view"] = "flight",
        ["nodes"] = NodeArray(ops)
    };

    private static JsonArray NodeArray(IEnumerable<string> ops)
    {
        var nodes = new JsonArray();
        int index = 0;
        foreach (string op in ops)
        {
            nodes.Add(new JsonObject { ["id"] = $"part-{index}", ["op"] = op });
            index++;
        }
        return nodes;
    }

    private static JsonObject InventoryNode(IReadOnlyDictionary<string, int> inventory)
    {
        var result = new JsonObject();
        foreach ((string op, int count) in inventory) result[op] = count;
        return result;
    }

    private static IEnumerable<List<string>> Enumerate(Dictionary<string, int> inventory, int limit)
    {
        var remaining = new Dictionary<string, int>(inventory);
        var prefix = new List<string>();
        foreach (var sequence in Walk()) yield return sequence;

        IEnumerable<List<string>> Walk()
        {
            yield return new List<string>(prefix);
            if (prefix.Count == limit) yield break;
            foreach (string op in inventory.Keys.OrderBy(x => x, StringComparer.Ordinal))
            {
                if (remaining[op] == 0) continue;
                remaining[op]--;
                prefix.Add(op);
                foreach (var sequence in Walk()) yield return sequence;
                prefix.RemoveAt(prefix.Count - 1);
                remaining[op]++;
            }
        }
    }

    private static JsonObject Level(int sourceId) => Ok(new JsonObject
    {
        ["action"] = new JsonObject { ["type"] = "level", ["sourceId"] = sourceId, ["mode"] = "puzzle" }
    });

    private static JsonObject PlayPuzzle(int sourceId, IReadOnlyList<string> ops)
    {
        JsonObject response = Level(sourceId);
        for (int index = 0; index < ops.Count; index++)
            response = Act(response["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"played-{index}", ["op"] = ops[index], ["index"] = index
            });
        return response;
    }

    private static JsonObject Act(JsonNode state, JsonObject action) => Ok(new JsonObject
    {
        ["state"] = Clone(state), ["action"] = action
    });

    private static JsonObject Ok(JsonObject request)
    {
        var response = Response(request);
        string detail = response["message"]?.GetValue<string>() ?? "";
        Equal("ok", response["status"]!.GetValue<string>(),
            string.IsNullOrEmpty(detail) ? "request status" : $"request status ({detail})");
        True(response.ContainsKey("state") && response.ContainsKey("result"), "successful response shape");
        return response;
    }

    private static void Invalid(JsonObject request, string label)
    {
        InvalidResponse(request, label);
    }

    private static JsonObject InvalidResponse(JsonObject request, string label)
    {
        var response = Response(request);
        Equal("invalid", response["status"]!.GetValue<string>(), label);
        return response;
    }

    private static void InvalidContains(JsonObject request, string fragment, string label)
    {
        var response = InvalidResponse(request, label);
        Contains(response["message"]!.GetValue<string>(), fragment, label + " wording");
    }

    private static JsonObject Response(JsonObject request) =>
        JsonNode.Parse(Game.Run(request.ToJsonString()))!.AsObject();

    private static void Contains(string value, string fragment, string label) =>
        True(value.Contains(fragment, StringComparison.OrdinalIgnoreCase), $"{label}: expected '{fragment}' in '{value}'");

    private static JsonNode Clone(JsonNode node) => JsonNode.Parse(node.ToJsonString())!;

    private static bool IsExactRational(string value)
    {
        int slash = value.IndexOf('/');
        return slash < 0 ? BigInteger.TryParse(value, out _) :
            BigInteger.TryParse(value[..slash], out _) && BigInteger.TryParse(value[(slash + 1)..], out BigInteger d) && d != 0;
    }

    private static double RationalDouble(string value)
    {
        var parts = value.Split('/');
        return parts.Length == 1 ? double.Parse(parts[0]) : double.Parse(parts[0]) / double.Parse(parts[1]);
    }

    private static Fraction ExpectedAt(int level, IReadOnlyList<string> ops, string x)
    {
        Fraction[] polynomial = BuildPolynomial(level, ops);
        return EvaluatePolynomial(polynomial, Fraction.Parse(x));
    }

    private static bool IsIndependentSolution(int level, IReadOnlyList<string> ops) =>
        GoalXs[level - 1].Select((x, index) => ExpectedAt(level, ops, x))
            .SequenceEqual(GoalYs[level - 1].Select(Fraction.Parse));

    private static Fraction EvaluatePolynomial(Fraction[] polynomial, Fraction input)
    {
        Fraction result = Fraction.Zero;
        for (int i = polynomial.Length - 1; i >= 0; i--) result = result * input + polynomial[i];
        return result;
    }

    private static Fraction[] BuildPolynomial(int level, IEnumerable<string> ops)
    {
        Fraction[] polynomial = level switch
        {
            1 or 3 or 24 or 25 => [0, 4, -1],
            2 => [0, 2, new Fraction(-1, 2)],
            4 => [-2, 1],
            5 => [0, 0, 0, 1],
            6 => [0, -2, new Fraction(1, 2)],
            7 or 10 or 11 or 27 or 28 => [-2, 1],
            8 or 12 or 13 or 14 => [1, -1, new Fraction(1, 4)],
            9 => [4, -4, 1],
            15 or 22 => [new Fraction(-2, 3), 4, -2, new Fraction(1, 3)],
            16 or 20 => [1],
            17 or 19 => [2, -1],
            18 => [-4, 6, -3, new Fraction(1, 2)],
            21 => [1, 2, new Fraction(-1, 2)],
            23 => [new Fraction(3, 2), new Fraction(-3, 2), new Fraction(3, 8)],
            26 => [5, -4, 1],
            _ => throw new ArgumentOutOfRangeException(nameof(level))
        };
        foreach (string op in ops)
            polynomial = ApplyPolynomial(polynomial, op);
        return polynomial;
    }

    private static Fraction[] ApplyPolynomial(Fraction[] polynomial, string op) => op switch
    {
        "H" => polynomial.Select(c => c / 2).ToArray(),
        "A" => AddOne(polynomial),
        "N" => polynomial.Select(c => -c).ToArray(),
        "Q" => Square(polynomial),
        "D" => polynomial.Skip(1).Select((c, i) => c * (i + 1)).DefaultIfEmpty(Fraction.Zero).ToArray(),
        "I" => IntegrateAnchored(polynomial),
        _ => throw new InvalidOperationException("unknown operation in test")
    };

    private static Fraction[] IntegrateAnchored(Fraction[] polynomial) =>
        [Fraction.Zero, .. polynomial.Select((coefficient, index) => coefficient / (index + 1))];

    private static void CheckPreviewPoints(JsonArray points, Fraction[] polynomial, string label)
    {
        True(points.Count > 0, label + " is nonempty");
        foreach (var pointNode in points)
        {
            var point = pointNode!.AsArray();
            Equal(2, point.Count, label + " coordinate count");
            double x = point[0]!.GetValue<double>();
            double actual = point[1]!.GetValue<double>();
            double expected = 0;
            for (int i = polynomial.Length - 1; i >= 0; i--)
                expected = expected * x + polynomial[i].ToDouble();
            double tolerance = 1e-10 * Math.Max(1.0, Math.Abs(expected));
            True(double.IsFinite(actual) && Math.Abs(actual - expected) <= tolerance,
                $"{label} at x={x:R}: expected {expected:R}, got {actual:R}");
        }
    }

    private static Fraction[] AddOne(Fraction[] polynomial)
    {
        var result = polynomial.ToArray();
        result[0] += 1;
        return result;
    }

    private static Fraction[] Square(Fraction[] polynomial)
    {
        var result = Enumerable.Repeat(Fraction.Zero, polynomial.Length * 2 - 1).ToArray();
        for (int i = 0; i < polynomial.Length; i++)
            for (int j = 0; j < polynomial.Length; j++)
                result[i + j] += polynomial[i] * polynomial[j];
        return result;
    }

    private readonly record struct Fraction
    {
        public static readonly Fraction Zero = new(0, 1);
        public BigInteger Numerator { get; }
        public BigInteger Denominator { get; }

        public Fraction(BigInteger numerator, BigInteger denominator)
        {
            if (denominator == 0) throw new DivideByZeroException();
            if (denominator < 0) { numerator = -numerator; denominator = -denominator; }
            BigInteger gcd = BigInteger.GreatestCommonDivisor(BigInteger.Abs(numerator), denominator);
            Numerator = numerator / gcd;
            Denominator = denominator / gcd;
        }

        public static Fraction Parse(string value)
        {
            string[] parts = value.Split('/');
            return parts.Length == 1
                ? new Fraction(BigInteger.Parse(parts[0]), 1)
                : new Fraction(BigInteger.Parse(parts[0]), BigInteger.Parse(parts[1]));
        }

        public static implicit operator Fraction(int value) => new(value, 1);
        public static Fraction operator +(Fraction a, Fraction b) => new(a.Numerator * b.Denominator + b.Numerator * a.Denominator, a.Denominator * b.Denominator);
        public static Fraction operator -(Fraction a) => new(-a.Numerator, a.Denominator);
        public static Fraction operator *(Fraction a, Fraction b) => new(a.Numerator * b.Numerator, a.Denominator * b.Denominator);
        public static Fraction operator /(Fraction a, int b) => new(a.Numerator, a.Denominator * b);
        public double ToDouble() => (double)Numerator / (double)Denominator;
        public override string ToString() => Denominator == 1 ? Numerator.ToString() : $"{Numerator}/{Denominator}";
    }

    private static void True(bool condition, string label)
    {
        assertions++;
        if (!condition) throw new InvalidOperationException(label);
    }

    private static void Equal<T>(T expected, T actual, string label) where T : notnull
    {
        assertions++;
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
            throw new InvalidOperationException($"{label}: expected {expected}, got {actual}");
    }

    private static string Status(string request) =>
        JsonNode.Parse(Game.Run(request))!["status"]!.GetValue<string>();
}
