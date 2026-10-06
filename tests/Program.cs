using System.Text.Json.Nodes;
using System.Numerics;
using Angouri.Kernel;
using AngouriMath;
using AngouriMath.Core;

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
        [28] = new() { ["H"] = 3, ["A"] = 3, ["N"] = 2, ["Q"] = 1 },
        [29] = new() { ["Q"] = 1, ["H"] = 1 },
        [30] = new() { ["Q"] = 1, ["N"] = 1, ["A"] = 1, ["H"] = 1 },
        [31] = new() { ["H"] = 2, ["A"] = 2, ["N"] = 1, ["Q"] = 2 },
        [32] = new() { ["A"] = 1, ["N"] = 1 },
        [33] = new() { ["Q"] = 1 },
        [34] = new() { ["A"] = 1, ["Q"] = 1 },
        [35] = new() { ["Q"] = 1 },
        [36] = new() { ["H"] = 2, ["A"] = 2, ["N"] = 1, ["Q"] = 1 },
        [37] = new() { ["A"] = 1 },
        [38] = new() { ["A"] = 1 },
        [39] = new() { ["N"] = 1, ["A"] = 1 },
        [40] = new() { ["H"] = 1, ["A"] = 1 },
        [41] = new() { ["D"] = 1, ["A"] = 1 },
        [42] = new() { ["H"] = 2, ["A"] = 2, ["N"] = 2 }
    };

    private static readonly int[] Limits = [1, 1, 2, 5, 3, 1, 1, 2, 3, 2, 8, 1, 3, 1, 5, 1, 2, 4, 1, 2, 2, 9, 8, 4, 10, 8, 2, 8,
        1, 3, 7, 3, 3, 4, 3, 8, 3, 3, 4, 4, 3, 8];

    private static readonly Dictionary<int, (string Op, int Before, int After)> Stations = new()
    {
        [32] = ("D", 1, 1), [33] = ("D", 1, 1), [34] = ("D", 2, 1),
        [35] = ("D", 1, 1), [36] = ("D", 5, 2), [37] = ("I", 1, 1),
        [38] = ("I", 1, 1), [39] = ("I", 2, 1), [40] = ("I", 1, 2),
        [41] = ("I", 1, 1), [42] = ("I", 5, 2)
    };

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
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
        ["0", "1", "2", "3", "4"], ["0", "1", "2", "3", "4"],
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
        ["3/8", "1/2", "3/8", "0", "-5/8"],
        ["1", "1/64", "0", "1/64", "1"],
        ["0", "63/64", "1", "63/64", "0"],
        ["0", "255/256", "1", "255/256", "0"],
        ["0", "1/2", "1", "3/2", "2"],
        ["-4", "-2", "0", "2", "4"],
        ["-2", "0", "2", "4", "6"],
        ["0", "3/4", "0", "-3/4", "0"],
        ["1", "7/4", "1", "1/4", "1"],
        ["0", "2", "4", "6", "8"],
        ["0", "5/2", "4", "9/2", "4"],
        ["0", "-4/3", "-2/3", "0", "-4/3"],
        ["1", "7/4", "2", "7/4", "1"],
        ["0", "3/2", "2", "3/2", "0"],
        ["1", "7/4", "1", "1/4", "1"]
    ];

    public static int Main(string[] args)
    {
        try
        {
            if (args.Contains("--crop-only", StringComparer.Ordinal))
            {
                ExtendedPuzzleContract();
                CropOutlineContract();
                Console.WriteLine($"PASS: {assertions} focused Crop/picture contract assertions");
                return 0;
            }
            if (args.Contains("--import-export-only", StringComparer.Ordinal))
            {
                ExtendedPuzzleContract();
                CropOutlineContract();
                HeightSquaredRelationContract();
                PreviewLimitContract();
                ExportImportContract();
                Console.WriteLine($"PASS: {assertions} focused import/export contract assertions");
                return 0;
            }
            ExhaustivePuzzleContract();
            HeightGuideContract();
            RoundRoofContract();
            DerivativeChapterContract();
            IntegrationChapterContract();
            EarlierChapterExtensionsContract();
            LaterChapterCapstonesContract();
            CapstoneContract();
            FixedStationChapterContract();
            ConstructedEquationContract();
            ExtendedPuzzleContract();
            CropOutlineContract();
            PiecewisePresentationContract();
            ExactEqualityContract();
            HeightSquaredRelationContract();
            CircleContract();
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
            [27] = ["A", "Q"], [28] = ["A", "H", "Q", "N", "A", "H"],
            [29] = ["Q"], [30] = ["Q", "N", "A"], [31] = ["H", "H", "Q", "Q", "N", "A"],
            [32] = ["D", "A"], [33] = ["Q", "D"], [34] = ["A", "Q", "D"],
            [35] = ["Q", "D"], [36] = ["H", "H", "N", "A", "Q", "D", "A"],
            [37] = ["A", "I"], [38] = ["A", "I"], [39] = ["N", "A", "I"],
            [40] = ["H", "I", "A"], [41] = ["D", "I"],
            [42] = ["H", "H", "N", "A", "I", "N", "A"]
        };
        Equal(40, guideSolutions.Count, "height guide covers every authored puzzle after the introductions");
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
        Equal(@"\frac{9}{8}", level28Guide["result"]!["heightGuide"]!["targetLatex"]!.GetValue<string>(),
            "height guide exposes authoritative target LaTeX");
        Equal(1.125d, level28Guide["result"]!["heightGuide"]!["targetNumber"]!.GetValue<double>(),
            "height guide exposes its authoritative numeric target");
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

    private static BoundedOracleAnalysis AnalyzeFixedStation(int level)
    {
        var station = Stations[level];
        var analysis = new BoundedOracleAnalysis
        {
            RawByLength = new int[Limits[level - 1] + 1],
            PlayableByLength = new int[Limits[level - 1] + 1]
        };

        foreach (var movable in Enumerate(Inventories[level], station.Before + station.After))
        {
            for (int stationIndex = 0; stationIndex <= movable.Count; stationIndex++)
            {
                if (stationIndex > station.Before || movable.Count - stationIndex > station.After) continue;
                string[] recipe = [.. movable.Take(stationIndex), station.Op, .. movable.Skip(stationIndex)];
                Analyze(recipe);
            }
        }
        return analysis;

        void Analyze(string[] recipe)
        {
            analysis.RawCount++;
            analysis.RawByLength[recipe.Length]++;
            Fraction[] polynomial = BuildPolynomial(level, []);
            bool guarded = true;
            Measure(polynomial);
            foreach (string op in recipe)
            {
                polynomial = ApplyPolynomial(polynomial, op);
                Measure(polynomial);
            }

            string text = string.Concat(recipe);
            bool exactSolution = GoalXs[level - 1]
                .Select((x, index) => EvaluatePolynomial(polynomial, Fraction.Parse(x)))
                .SequenceEqual(GoalYs[level - 1].Select(Fraction.Parse));
            if (exactSolution) analysis.RawSolutions.Add(text);
            if (guarded)
            {
                analysis.PlayableCount++;
                analysis.PlayableByLength[recipe.Length]++;
                if (exactSolution) analysis.PlayableSolutions.Add(text);
            }

            void Measure(Fraction[] stage)
            {
                int degree = stage.Length - 1;
                analysis.MaxDegree = Math.Max(analysis.MaxDegree, degree);
                double startSlope = stage.Length > 1 ? Math.Abs(stage[1].ToDouble()) : 0.0;
                if (double.IsFinite(startSlope))
                    analysis.MaxStartSlopeMagnitude = Math.Max(analysis.MaxStartSlopeMagnitude, startSlope);
                else guarded = false;
                if (degree > 32) guarded = false;
                for (int sampleIndex = 0; sampleIndex <= 80; sampleIndex++)
                {
                    double x = sampleIndex / 20.0;
                    double value = EvaluatePolynomial(stage, new Fraction(sampleIndex, 20)).ToDouble();
                    double magnitude = Math.Abs(value);
                    if (double.IsFinite(magnitude))
                        analysis.MaxPreviewMagnitude = Math.Max(analysis.MaxPreviewMagnitude, magnitude);
                    if (!double.IsFinite(magnitude) || magnitude > 10_000_000.0) guarded = false;
                }
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

        string[] cachedPresentationOps = "AHAHAAHAHH".Select(character => character.ToString()).ToArray();
        var cachedPresentation = PlayPuzzle(25, cachedPresentationOps)["result"]!.AsObject();
        Entity directPresentation = MathS.FromString("x*(4-x)");
        foreach (string op in cachedPresentationOps)
            directPresentation = op == "A"
                ? (directPresentation + 1).InnerSimplified
                : (directPresentation / 2).InnerSimplified;
        directPresentation = directPresentation.Simplify();
        Equal(directPresentation.ToString(), cachedPresentation["stages"]!.AsArray()[^1]!["expression"]!.GetValue<string>(),
            "long polynomial stage text remains the direct AngouriMath simplification");
        Equal(directPresentation.Latexize(), cachedPresentation["stages"]!.AsArray()[^1]!["latex"]!.GetValue<string>(),
            "long polynomial stage LaTeX remains the direct AngouriMath simplification");

        JsonObject refreshed = Level(25);
        for (int index = 0; index < cachedPresentationOps.Length; index++)
            refreshed = Act(refreshed["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"fresh-presentation-{index}",
                ["op"] = cachedPresentationOps[index], ["index"] = index
            });
        var refreshedResult = refreshed["result"]!.AsObject();
        for (int index = 1; index < refreshedResult["stages"]!.AsArray().Count; index++)
            Equal($"fresh-presentation-{index - 1}", refreshedResult["stages"]![index]!["id"]!.GetValue<string>(),
                "cached formulas retain the current node identity");
        True(JsonNode.DeepEquals(cachedPresentation["checkpoints"], refreshedResult["checkpoints"]),
            "presentation caching leaves exact target readings unchanged");
        True(JsonNode.DeepEquals(cachedPresentation["heightGuide"], refreshedResult["heightGuide"]),
            "presentation caching leaves the exact height guide unchanged");

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

    private static void FixedStationChapterContract()
    {
        Equal(42, GoalXs.Length, "authoritative checkpoint-position catalogue size");
        Equal(42, GoalYs.Length, "authoritative checkpoint-height catalogue size");
        Equal(42, Inventories.Count, "authoritative inventory catalogue size");
        Equal(42, Limits.Length, "authoritative part-limit catalogue size");
        True(!Level(1)["state"]!.AsObject().ContainsKey("station"),
            "original authored state shape has no station field");
        True(!Level(31)["state"]!.AsObject().ContainsKey("station"),
            "new ordinary puzzle state has no station field");

        var intended = new Dictionary<int, string[]>
        {
            [29] = ["Q"], [30] = ["Q", "N", "A"], [31] = ["H", "H", "Q", "Q", "N", "A"],
            [32] = ["D", "A"], [33] = ["Q", "D"], [34] = ["A", "Q", "D"],
            [35] = ["Q", "D"], [36] = ["H", "H", "N", "A", "Q", "D", "A"],
            [37] = ["A", "I"], [38] = ["A", "I"], [39] = ["N", "A", "I"],
            [40] = ["H", "I", "A"], [41] = ["D", "I"],
            [42] = ["H", "H", "N", "A", "I", "N", "A"]
        };

        foreach ((int level, string[] recipe) in intended)
        {
            True(IsIndependentSolution(level, recipe), $"level {level} intended recipe solves in independent oracle");
            var played = PlayPuzzle(level, recipe);
            CheckResultShape(level, played["result"]!.AsObject(), recipe);
            CheckHeightGuide(level, played["result"]!.AsObject(), recipe);
            Equal(true, played["result"]!["solved"]!.GetValue<bool>(), $"level {level} intended recipe solves in kernel");
        }

        var ordinaryAnalyses = new Dictionary<int, BoundedOracleAnalysis>
        {
            [29] = AnalyzeBoundedCapstone(29),
            [30] = AnalyzeBoundedCapstone(30),
            [31] = AnalyzeBoundedCapstone(31)
        };
        CheckAuthoredOracle(ordinaryAnalyses[29], 3, 1, 6, 1, "Q", "flatter-top power discovery");
        CheckAuthoredOracle(ordinaryAnalyses[30], 41, 1, 6, 3, "QNA", "flatter-top power reflection");
        CheckAuthoredOracle(ordinaryAnalyses[31], 1841, 1, 8, 6, "HHQQNA", "flatter-top power capstone");

        var stationAnalyses = Stations.Keys.ToDictionary(level => level, AnalyzeFixedStation);
        CheckAuthoredOracle(stationAnalyses[32], 7, 1, 2, 2, "DA", "fixed derivative discovery");
        CheckAuthoredOracle(stationAnalyses[33], 3, 1, 2, 2, "QD", "fixed derivative input square");
        CheckAuthoredOracle(stationAnalyses[34], 9, 1, 2, 3, "AQD", "fixed derivative input lift");
        CheckAuthoredOracle(stationAnalyses[35], 3, 1, 4, 2, "QD", "fixed derivative flat spots");
        CheckAuthoredOracle(stationAnalyses[36], 1383, 3, 4, 7,
            "HHNAQDA,HNHAQDA,NHHAQDA", "fixed derivative capstone");
        CheckAuthoredOracle(stationAnalyses[37], 3, 1, 1, 2, "AI", "fixed integral scaling");
        CheckAuthoredOracle(stationAnalyses[38], 3, 1, 2, 2, "AI", "fixed integral peak shift");
        CheckAuthoredOracle(stationAnalyses[39], 9, 1, 3, 3, "NAI", "fixed integral input shape");
        CheckAuthoredOracle(stationAnalyses[40], 9, 2, 2, 3, "HIA,IHA", "fixed integral scale relation");
        CheckAuthoredOracle(stationAnalyses[41], 7, 1, 3, 2, "DI", "fixed integral rebuild");
        CheckAuthoredOracle(stationAnalyses[42], 718, 6, 3, 7,
            "HHNAINA,HHNANIA,HNHAINA,HNHANIA,NHHAINA,NHHANIA", "fixed integral capstone");
        Equal(2154, stationAnalyses.Values.Sum(analysis => analysis.RawCount),
            "complete fixed-station legal recipe enumeration count");
        Equal(19, stationAnalyses.Values.Sum(analysis => analysis.RawSolutions.Count),
            "complete fixed-station exact solution count");

        foreach (int level in new[] { 33, 34, 35, 36, 37, 38, 39, 42 })
        {
            string stationOp = Stations[level].Op;
            True(stationAnalyses[level].PlayableSolutions.All(recipe => recipe[0].ToString() != stationOp),
                $"level {level} has no all-output fixed-station solution");
        }

        foreach ((int level, var specification) in Stations.OrderBy(pair => pair.Key))
        {
            var initial = Level(level);
            var state = initial["state"]!.AsObject();
            var station = state["station"]!.AsObject();
            Equal("station", station["id"]!.GetValue<string>(), $"level {level} canonical station identity");
            Equal(specification.Op, station["op"]!.GetValue<string>(), $"level {level} fixed station operation");
            Equal(specification.Before, station["before"]!.GetValue<int>(), $"level {level} input slot capacity");
            Equal(specification.After, station["after"]!.GetValue<int>(), $"level {level} output slot capacity");
            Equal(specification.Before + specification.After + 1, state["limit"]!.GetValue<int>(),
                $"level {level} part limit includes the fixed station");
            Equal(1, state["nodes"]!.AsArray().Count, $"level {level} starts with one fixed node");
            Equal("station", state["nodes"]![0]!["id"]!.GetValue<string>(),
                $"level {level} starts with canonical station node identity");
            Equal(specification.Op, state["nodes"]![0]!["op"]!.GetValue<string>(),
                $"level {level} starts with canonical station node operation");
            True(!state["inventory"]!.AsObject().ContainsKey(specification.Op),
                $"level {level} inventory excludes its fixed operation");
            Equal(2, initial["result"]!["stages"]!.AsArray().Count,
                $"level {level} initial evaluation includes the fixed station stage");
            Equal("station", initial["result"]!["stages"]![1]!["id"]!.GetValue<string>(),
                $"level {level} fixed station has a canonical stage identity");
        }

        var level32State = Level(32)["state"]!;
        var legacyStationState = Clone(level32State).AsObject();
        legacyStationState.Remove("station");
        var derivedStation = Act(legacyStationState, new JsonObject { ["type"] = "evaluate" });
        Equal("D", derivedStation["state"]!["station"]!["op"]!.GetValue<string>(),
            "missing authored station metadata is derived from source configuration");

        foreach ((string field, JsonNode value) in new (string, JsonNode)[]
        {
            ("id", JsonValue.Create("other")!), ("op", JsonValue.Create("I")!),
            ("before", JsonValue.Create(2)!), ("after", JsonValue.Create(0)!)
        })
        {
            var tampered = Clone(level32State).AsObject();
            tampered["station"]![field] = value;
            InvalidContains(new JsonObject
            {
                ["state"] = tampered, ["action"] = new JsonObject { ["type"] = "evaluate" }
            }, "station", $"tampered fixed-station {field} rejection");
        }
        var nullStation = Clone(level32State).AsObject();
        nullStation["station"] = null;
        InvalidContains(new JsonObject
        {
            ["state"] = nullStation, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "station", "null fixed-station metadata rejection");
        var unexpectedStation = Clone(Level(31)["state"]!).AsObject();
        unexpectedStation["station"] = new JsonObject
        {
            ["id"] = "station", ["op"] = "D", ["before"] = 1, ["after"] = 1
        };
        InvalidContains(new JsonObject
        {
            ["state"] = unexpectedStation, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "station", "station metadata on an ordinary puzzle rejection");

        var missingStationNode = Clone(level32State).AsObject();
        missingStationNode["nodes"] = new JsonArray();
        InvalidContains(new JsonObject
        {
            ["state"] = missingStationNode, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "station", "missing fixed station node rejection");
        var wrongStationOperation = Clone(level32State).AsObject();
        wrongStationOperation["nodes"]![0]!["op"] = "I";
        InvalidContains(new JsonObject
        {
            ["state"] = wrongStationOperation, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "station", "wrong fixed station node operation rejection");
        var duplicateStationNode = Clone(level32State).AsObject();
        duplicateStationNode["nodes"]!.AsArray().Add(new JsonObject { ["id"] = "station", ["op"] = "D" });
        Invalid(new JsonObject
        {
            ["state"] = duplicateStationNode, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "duplicate fixed station node rejection");

        var inputOverflow = Clone(level32State).AsObject();
        inputOverflow["nodes"] = new JsonArray
        {
            new JsonObject { ["id"] = "input-a", ["op"] = "A" },
            new JsonObject { ["id"] = "input-n", ["op"] = "N" },
            new JsonObject { ["id"] = "station", ["op"] = "D" }
        };
        InvalidContains(new JsonObject
        {
            ["state"] = inputOverflow, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "slot capacity", "fixed station input capacity rejection");
        var outputOverflow = Clone(level32State).AsObject();
        outputOverflow["nodes"] = new JsonArray
        {
            new JsonObject { ["id"] = "station", ["op"] = "D" },
            new JsonObject { ["id"] = "output-a", ["op"] = "A" },
            new JsonObject { ["id"] = "output-n", ["op"] = "N" }
        };
        InvalidContains(new JsonObject
        {
            ["state"] = outputOverflow, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "slot capacity", "fixed station output capacity rejection");

        InvalidContains(new JsonObject
        {
            ["state"] = Clone(level32State),
            ["action"] = new JsonObject { ["type"] = "remove", ["id"] = "station" }
        }, "cannot be removed", "fixed station remove rejection");
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(level32State),
            ["action"] = new JsonObject { ["type"] = "move", ["id"] = "station", ["index"] = 0 }
        }, "cannot be moved", "fixed station move rejection");
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(level32State),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "regular-d", ["op"] = "D", ["index"] = 0 }
        }, "not available", "fixed operation is excluded from movable inventory");

        var crossing = Act(Level(34)["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "crossing-a", ["op"] = "A", ["index"] = 0
        });
        crossing = Act(crossing["state"]!, new JsonObject
        {
            ["type"] = "move", ["id"] = "crossing-a", ["index"] = 1
        });
        Equal("station", crossing["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "ordinary node can move from input to output side");
        crossing = Act(crossing["state"]!, new JsonObject
        {
            ["type"] = "move", ["id"] = "crossing-a", ["index"] = 0
        });
        Equal("station", crossing["state"]!["nodes"]![1]!["id"]!.GetValue<string>(),
            "ordinary node can move back across the fixed station");
        var fullOutput = Act(Level(34)["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "output-a", ["op"] = "A", ["index"] = 1
        });
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(fullOutput["state"]!),
            ["action"] = new JsonObject { ["type"] = "insert", ["id"] = "output-q", ["op"] = "Q", ["index"] = 2 }
        }, "slot capacity", "fixed station edit cannot overflow one side");

        var built34 = PlayPuzzle(34, intended[34]);
        var roundTrip34 = Act(built34["state"]!, new JsonObject { ["type"] = "evaluate" });
        Equal("played-0", roundTrip34["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "state round-trip preserves first input identity");
        Equal("played-1", roundTrip34["state"]!["nodes"]![1]!["id"]!.GetValue<string>(),
            "state round-trip preserves second input identity");
        Equal("station", roundTrip34["state"]!["nodes"]![2]!["id"]!.GetValue<string>(),
            "state round-trip preserves authored station position");
        var reset34 = Act(roundTrip34["state"]!, new JsonObject { ["type"] = "reset" });
        Equal(1, reset34["state"]!["nodes"]!.AsArray().Count, "reset clears movable nodes only");
        Equal("station", reset34["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "reset retains the fixed station");
        Equal("D", reset34["state"]!["station"]!["op"]!.GetValue<string>(),
            "reset retains fixed station metadata");

        var built36 = PlayPuzzle(36, intended[36]);
        Equal("station", built36["result"]!["stages"]![6]!["id"]!.GetValue<string>(),
            "derivative station participates in ordered expression stages");
        Equal(8, built36["result"]!["heightGuide"]!["stages"]!.AsArray().Count,
            "derivative station participates in height-guide stages");
        var built42 = PlayPuzzle(42, intended[42]);
        Equal("station", built42["result"]!["stages"]![5]!["id"]!.GetValue<string>(),
            "integral station participates in ordered expression stages");
        Equal(8, built42["result"]!["heightGuide"]!["stages"]!.AsArray().Count,
            "integral station participates in height-guide stages");

        var level40Alternative = PlayPuzzle(40, ["I", "H", "A"]);
        Equal(true, level40Alternative["result"]!["solved"]!.GetValue<bool>(),
            "integration and halving legitimately commute in level 40");

        var built33 = PlayPuzzle(33, intended[33]);
        var remixed33 = Act(built33["state"]!, new JsonObject { ["type"] = "remix" });
        True(!remixed33["state"]!.AsObject().ContainsKey("station"),
            "remix removes fixed-station semantics");
        Equal(0, remixed33["state"]!["inventory"]!.AsObject().Count,
            "remixed station construction uses reusable inventory");
        Equal(0, remixed33["state"]!["limit"]!.GetValue<int>(),
            "remixed station construction uses unlimited limit sentinel");
        var movedRemixedStation = Act(remixed33["state"]!, new JsonObject
        {
            ["type"] = "move", ["id"] = "station", ["index"] = 0
        });
        var removedRemixedStation = Act(movedRemixedStation["state"]!, new JsonObject
        {
            ["type"] = "remove", ["id"] = "station"
        });
        Equal(1, removedRemixedStation["state"]!["nodes"]!.AsArray().Count,
            "remixed fixed node is an ordinary removable operation");
        var directRemix = Remix(32);
        True(!directRemix["state"]!.AsObject().ContainsKey("station"),
            "creation on a station source has no fixed station");
        Equal(0, directRemix["state"]!["nodes"]!.AsArray().Count,
            "creation on a station source starts without a fixed node");

        var creationExport = Act(built33["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "creation", ["view"] = "flow"
        });
        True(!creationExport["artifact"]!.AsObject().ContainsKey("station"),
            "creation artifact regularizes the fixed station");
        Equal(2, creationExport["artifact"]!["nodes"]!.AsArray().Count,
            "creation artifact preserves every operation including the former station");
        var creationImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationExport["artifact"]!) }
        });
        True(!creationImport["state"]!.AsObject().ContainsKey("station"),
            "imported creation keeps the former station movable");
        var movedCreationStation = Act(creationImport["state"]!, new JsonObject
        {
            ["type"] = "move", ["id"] = "station", ["index"] = 0
        });
        Equal("station", movedCreationStation["state"]!["nodes"]![0]!["id"]!.GetValue<string>(),
            "former station moves normally in an imported creation");

        var derivativeChallengeExport = Act(built33["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "function"
        });
        var derivativeChallenge = derivativeChallengeExport["artifact"]!.AsObject();
        Equal(2, derivativeChallenge["limit"]!.GetValue<int>(),
            "fixed derivative challenge counts every witness node");
        Equal(1, derivativeChallenge["inventory"]!["D"]!.GetValue<int>(),
            "fixed derivative exports as regular challenge inventory");
        Equal(1, derivativeChallenge["inventory"]!["Q"]!.GetValue<int>(),
            "fixed derivative challenge preserves movable witness stock");
        var derivativeChallengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(derivativeChallenge) }
        });
        True(!derivativeChallengeImport["state"]!.AsObject().ContainsKey("station"),
            "shared derivative challenge has no fixed station");
        var derivativeChallengeSolved = derivativeChallengeImport;
        foreach ((string op, int index) in new[] { "Q", "D" }.Select((op, index) => (op, index)))
            derivativeChallengeSolved = Act(derivativeChallengeSolved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"shared-derivative-{index}", ["op"] = op, ["index"] = index
            });
        Equal(true, derivativeChallengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "shared derivative challenge admits its regularized witness");

        var integralChallengeExport = Act(built42["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight"
        });
        var integralChallenge = integralChallengeExport["artifact"]!.AsObject();
        Equal(7, integralChallenge["limit"]!.GetValue<int>(),
            "fixed integral challenge counts every witness node");
        Equal(1, integralChallenge["inventory"]!["I"]!.GetValue<int>(),
            "fixed integral exports as regular challenge inventory");
        Equal(2, integralChallenge["inventory"]!["H"]!.GetValue<int>(),
            "fixed integral challenge preserves all half blocks");
        Equal(2, integralChallenge["inventory"]!["A"]!.GetValue<int>(),
            "fixed integral challenge preserves all lift blocks");
        Equal(2, integralChallenge["inventory"]!["N"]!.GetValue<int>(),
            "fixed integral challenge preserves all reflect blocks");
        var integralChallengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(integralChallenge) }
        });
        True(!integralChallengeImport["state"]!.AsObject().ContainsKey("station"),
            "shared integral challenge has no fixed station");
        var integralChallengeSolved = integralChallengeImport;
        for (int index = 0; index < intended[42].Length; index++)
            integralChallengeSolved = Act(integralChallengeSolved["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"shared-integral-{index}",
                ["op"] = intended[42][index], ["index"] = index
            });
        Equal(true, integralChallengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "shared integral challenge admits its regularized witness");

        foreach ((int level, BoundedOracleAnalysis analysis) in ordinaryAnalyses.Concat(stationAnalyses).OrderBy(pair => pair.Key))
            PrintBoundedOracle(level, analysis);
    }

    private static void CircleContract()
    {
        var specifications = new Dictionary<int, (
            string InitialX, string InitialY, string InitialRadius,
            string SolutionX, string SolutionY, string SolutionRadius,
            string[] Editable, (string X, string Y)[] Goals)>
        {
            [43] = ("2", "0", "1/2", "2", "0", "1", ["radius"],
                [("3", "0"), ("2", "1"), ("1", "0"), ("2", "-1")]),
            [44] = ("2", "0", "1", "3/2", "1/2", "1", ["x", "y"],
                [("5/2", "1/2"), ("3/2", "3/2"), ("1/2", "1/2"), ("3/2", "-1/2")]),
            [45] = ("2", "0", "1", "2", "1/2", "5/4", ["y", "radius"],
                [("11/4", "3/2"), ("5/4", "-1/2"), ("13/4", "1/2")]),
            [46] = ("2", "0", "1", "9/4", "1/4", "5/4", ["x", "y", "radius"],
                [("3", "5/4"), ("5/4", "1"), ("3", "-3/4")]),
            [47] = ("2", "0", "1", "5/4", "-1/2", "5/2", ["x", "y", "radius"],
                [("11/4", "3/2"), ("-3/4", "1"), ("5/4", "-3")])
        };

        static Fraction DistanceSquared(string centreX, string centreY, (string X, string Y) goal)
        {
            Fraction dx = Fraction.Parse(goal.X) - Fraction.Parse(centreX);
            Fraction dy = Fraction.Parse(goal.Y) - Fraction.Parse(centreY);
            return dx * dx + dy * dy;
        }

        void CheckCircleResult(int level, JsonObject response, string centreX, string centreY,
            string radiusText, IReadOnlyList<(string X, string Y)> goals)
        {
            var result = response["result"]!.AsObject();
            True(!string.IsNullOrWhiteSpace(result["constructedLatex"]!.GetValue<string>()),
                $"circle {level} constructed equation is nonempty");
            var circle = result["circle"]!.AsObject();
            Fraction radius = Fraction.Parse(radiusText);
            Fraction radiusSquared = radius * radius;
            Equal(radiusSquared.ToString(), circle["radiusSquared"]!.GetValue<string>(),
                $"circle {level} exact radius squared");
            Equal(Fraction.Parse(centreX).ToDouble(), circle["centre"]![0]!.GetValue<double>(),
                $"circle {level} numeric centre x");
            Equal(Fraction.Parse(centreY).ToDouble(), circle["centre"]![1]!.GetValue<double>(),
                $"circle {level} numeric centre y");
            Equal(radius.ToDouble(), circle["radius"]!.GetValue<double>(),
                $"circle {level} numeric radius");
            Equal(0.0, circle["tangent"]![0]!.GetValue<double>(), $"circle {level} initial tangent x");
            Equal(1.0, circle["tangent"]![1]!.GetValue<double>(), $"circle {level} initial tangent y");
            Equal(0.0, result["startSlope"]!.GetValue<double>(), $"circle {level} compatibility start slope");
            True(!result.ContainsKey("heightGuide"), $"circle {level} omits polynomial height guide");
            Contains(circle["equationLatex"]!.GetValue<string>(), "h", $"circle {level} full equation uses h");

            var stages = result["stages"]!.AsArray();
            Equal(1, stages.Count, $"circle {level} has one geometry source stage");
            Equal("source", stages[0]!["id"]!.GetValue<string>(), $"circle {level} source stage identity");
            Equal(circle["equationLatex"]!.GetValue<string>(), stages[0]!["latex"]!.GetValue<string>(),
                $"circle {level} stage repeats the exact equation");
            True(!string.IsNullOrWhiteSpace(stages[0]!["expression"]!.GetValue<string>()),
                $"circle {level} source stage expression");

            var points = result["points"]!.AsArray();
            Equal(161, points.Count, $"circle {level} uniform closed-loop sample count");
            Equal(161, stages[0]!["points"]!.AsArray().Count,
                $"circle {level} source stage uses the circle path");
            double cx = Fraction.Parse(centreX).ToDouble();
            double cy = Fraction.Parse(centreY).ToDouble();
            double r = radius.ToDouble();
            Equal(cx + r, points[0]![0]!.GetValue<double>(), $"circle {level} starts at rightmost x");
            Equal(cy, points[0]![1]!.GetValue<double>(), $"circle {level} starts at rightmost y");
            Equal(points[0]![0]!.GetValue<double>(), points[^1]![0]!.GetValue<double>(),
                $"circle {level} loop closes exactly in x");
            Equal(points[0]![1]!.GetValue<double>(), points[^1]![1]!.GetValue<double>(),
                $"circle {level} loop closes exactly in y");
            True(points[1]![1]!.GetValue<double>() > cy,
                $"circle {level} traversal leaves the rightmost point counterclockwise");
            foreach (var pointNode in points)
            {
                double dx = pointNode![0]!.GetValue<double>() - cx;
                double dy = pointNode[1]!.GetValue<double>() - cy;
                True(Math.Abs(dx * dx + dy * dy - r * r) <= 1e-10 * Math.Max(1.0, r * r),
                    $"circle {level} numeric geometry sample stays on circle");
            }

            var checkpoints = result["checkpoints"]!.AsArray();
            Equal(goals.Count, checkpoints.Count, $"circle {level} checkpoint count");
            Equal(goals.Count, stages[0]!["values"]!.AsArray().Count,
                $"circle {level} source-stage exact values");
            foreach (var checkpointNode in checkpoints)
            {
                var checkpoint = checkpointNode!.AsObject();
                string targetX = checkpoint["x"]!.GetValue<string>();
                string targetY = checkpoint["target"]!.GetValue<string>();
                var goal = goals.Single(candidate => candidate.X == targetX && candidate.Y == targetY);
                Fraction dx = Fraction.Parse(goal.X) - Fraction.Parse(centreX);
                Fraction dy = Fraction.Parse(goal.Y) - Fraction.Parse(centreY);
                Fraction dxSquared = dx * dx;
                Fraction dySquared = dy * dy;
                Fraction lhs = dxSquared + dySquared;
                Equal(dx.ToString(), checkpoint["dx"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact signed dx");
                Equal(dy.ToString(), checkpoint["dy"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact signed dy");
                Equal(dxSquared.ToString(), checkpoint["dxSquared"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact dx squared");
                Equal(dySquared.ToString(), checkpoint["dySquared"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact dy squared");
                Equal(lhs.ToString(), checkpoint["lhs"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact distance squared");
                Equal(lhs.ToString(), checkpoint["actual"]!.GetValue<string>(),
                    $"circle {level} compatibility actual is exact distance squared");
                Equal(radiusSquared.ToString(), checkpoint["rhs"]!.GetValue<string>(),
                    $"circle {level} checkpoint exact radius squared");
                Equal(lhs == radiusSquared, checkpoint["hit"]!.GetValue<bool>(),
                    $"circle {level} independent exact membership");
                Equal(Fraction.Parse(goal.Y).ToDouble(), checkpoint["y"]!.GetValue<double>(),
                    $"circle {level} compatibility y is target ordinate");
                double phase = checkpoint["phase"]!.GetValue<double>();
                True(phase >= 0.0 && phase < 1.0, $"circle {level} phase is normalized");
                double expectedAngle = dx == Fraction.Zero && dy == Fraction.Zero
                    ? 0.0 : Math.Atan2(dy.ToDouble(), dx.ToDouble());
                if (expectedAngle < 0.0) expectedAngle += 2.0 * Math.PI;
                double expectedPhase = expectedAngle / (2.0 * Math.PI);
                True(Math.Abs(phase - expectedPhase) < 1e-12,
                    $"circle {level} checkpoint phase is its counterclockwise passage timestamp");
            }

            var bounds = circle["bounds"]!.AsObject();
            double minX = bounds["minX"]!.GetValue<double>();
            double maxX = bounds["maxX"]!.GetValue<double>();
            double minY = bounds["minY"]!.GetValue<double>();
            double maxY = bounds["maxY"]!.GetValue<double>();
            True(minX < Math.Min(0.0, cx - r) && maxX > Math.Max(0.0, cx + r),
                $"circle {level} horizontal bounds include zero and padded circle");
            True(minY < Math.Min(0.0, cy - r) && maxY > Math.Max(0.0, cy + r),
                $"circle {level} vertical bounds include zero and padded circle");
            foreach (var goal in goals)
                True(Fraction.Parse(goal.X).ToDouble() >= minX && Fraction.Parse(goal.X).ToDouble() <= maxX &&
                     Fraction.Parse(goal.Y).ToDouble() >= minY && Fraction.Parse(goal.Y).ToDouble() <= maxY,
                    $"circle {level} bounds include every target");
        }

        foreach ((int level, var specification) in specifications)
        {
            var initial = Level(level);
            var state = initial["state"]!.AsObject();
            Equal(0, state["nodes"]!.AsArray().Count, $"circle {level} has no operation nodes");
            Equal(0, state["inventory"]!.AsObject().Count, $"circle {level} has empty inventory");
            Equal(0, state["limit"]!.GetValue<int>(), $"circle {level} has zero operation limit");
            True(!state.ContainsKey("station"), $"circle {level} has no fixed station");
            Equal(specification.InitialX, state["circle"]!["x"]!.GetValue<string>(),
                $"circle {level} authored initial centre x");
            Equal(specification.InitialY, state["circle"]!["y"]!.GetValue<string>(),
                $"circle {level} authored initial centre y");
            Equal(specification.InitialRadius, state["circle"]!["radius"]!.GetValue<string>(),
                $"circle {level} authored initial radius");
            True(specification.Editable.SequenceEqual(initial["result"]!["circle"]!["editable"]!.AsArray()
                    .Select(value => value!.GetValue<string>())),
                $"circle {level} exposes only its authored editable parameters");
            Equal(specification.InitialX, initial["result"]!["circle"]!["initial"]!["x"]!.GetValue<string>(),
                $"circle {level} result initial x metadata");
            Equal(specification.InitialY, initial["result"]!["circle"]!["initial"]!["y"]!.GetValue<string>(),
                $"circle {level} result initial y metadata");
            Equal(specification.InitialRadius, initial["result"]!["circle"]!["initial"]!["radius"]!.GetValue<string>(),
                $"circle {level} result initial radius metadata");
            CheckCircleResult(level, initial, specification.InitialX, specification.InitialY,
                specification.InitialRadius, specification.Goals);
            Equal(false, initial["result"]!["solved"]!.GetValue<bool>(),
                $"circle {level} authored default remains a puzzle to solve");

            var solved = SetCircle(state, specification.SolutionX, specification.SolutionY, specification.SolutionRadius);
            CheckCircleResult(level, solved, specification.SolutionX, specification.SolutionY,
                specification.SolutionRadius, specification.Goals);
            Equal(true, solved["result"]!["solved"]!.GetValue<bool>(),
                $"circle {level} intended exact geometry solves");
            True(solved["result"]!["checkpoints"]!.AsArray().All(checkpoint => checkpoint!["hit"]!.GetValue<bool>()),
                $"circle {level} intended geometry hits every target exactly");
        }

        Fraction[] centreGrid = Enumerable.Range(-16, 49).Select(n => new Fraction(n, 4)).ToArray();
        Fraction[] radiusGrid = Enumerable.Range(1, 24).Select(n => new Fraction(n, 4)).ToArray();
        long totalCandidates = 0;
        foreach ((int level, var specification) in specifications)
        {
            Fraction[] xs = specification.Editable.Contains("x") ? centreGrid : [Fraction.Parse(specification.InitialX)];
            Fraction[] ys = specification.Editable.Contains("y") ? centreGrid : [Fraction.Parse(specification.InitialY)];
            Fraction[] radii = specification.Editable.Contains("radius") ? radiusGrid : [Fraction.Parse(specification.InitialRadius)];
            long candidates = 0;
            var solutions = new List<(Fraction X, Fraction Y, Fraction Radius)>();
            foreach (Fraction cx in xs)
            foreach (Fraction cy in ys)
            foreach (Fraction radius in radii)
            {
                candidates++;
                Fraction rhs = radius * radius;
                if (specification.Goals.All(goal =>
                    DistanceSquared(cx.ToString(), cy.ToString(), goal) == rhs))
                    solutions.Add((cx, cy, radius));
            }
            long expectedCandidates = level switch
            {
                43 => 24,
                44 => 2401,
                45 => 1176,
                46 or 47 => 57624,
                _ => throw new InvalidOperationException("unexpected circle source")
            };
            Equal(expectedCandidates, candidates, $"circle {level} bounded exact parameter count");
            Equal(1, solutions.Count, $"circle {level} bounded oracle unique exact fit");
            Equal(Fraction.Parse(specification.SolutionX), solutions[0].X,
                $"circle {level} bounded oracle solution x");
            Equal(Fraction.Parse(specification.SolutionY), solutions[0].Y,
                $"circle {level} bounded oracle solution y");
            Equal(Fraction.Parse(specification.SolutionRadius), solutions[0].Radius,
                $"circle {level} bounded oracle solution radius");
            totalCandidates += candidates;
        }
        Equal(118849L, totalCandidates, "complete bounded exact circle parameter audit count");

        var radiusMiss = SetCircle(Level(43)["state"]!, "2", "0", "5/4");
        Equal(false, radiusMiss["result"]!["solved"]!.GetValue<bool>(), "moved circle radius misses exact targets");
        var centreMiss = SetCircle(Level(44)["state"]!, "7/4", "1/2", "1");
        Equal(false, centreMiss["result"]!["solved"]!.GetValue<bool>(), "moved circle centre misses exact targets");
        var verticalMiss = SetCircle(Level(45)["state"]!, "2", "3/4", "5/4");
        Equal(false, verticalMiss["result"]!["solved"]!.GetValue<bool>(), "moved vertical centre misses exact targets");
        var chordMiss = SetCircle(Level(46)["state"]!, "5/2", "1/4", "5/4");
        Equal(false, chordMiss["result"]!["solved"]!.GetValue<bool>(), "moved chord centre misses exact targets");
        var transferMiss = SetCircle(Level(47)["state"]!, "5/4", "-1/2", "11/4");
        Equal(false, transferMiss["result"]!["solved"]!.GetValue<bool>(), "moved transfer radius misses exact targets");

        var solved43 = SetCircle(Level(43)["state"]!, "2", "0", "1");
        var verticalPair43 = solved43["result"]!["checkpoints"]!.AsArray()
            .Where(checkpoint => checkpoint!["x"]!.GetValue<string>() == "2").ToArray();
        Equal(2, verticalPair43.Length, "circle traversal retains two target heights at one x coordinate");
        True(verticalPair43.Select(checkpoint => checkpoint!["target"]!.GetValue<string>()).ToHashSet()
                .SetEquals(["1", "-1"]),
            "circle traversal distinguishes upper and lower target at one x coordinate");
        var phases43 = solved43["result"]!["checkpoints"]!.AsArray()
            .Select(checkpoint => checkpoint!["phase"]!.GetValue<double>()).ToArray();
        True(phases43.SequenceEqual(new[] { 0.0, 0.25, 0.5, 0.75 }),
            "cardinal circle targets follow right-up-left-down counterclockwise phases");
        var level46TargetOrder = Level(46)["result"]!["checkpoints"]!.AsArray()
            .Select(checkpoint => (checkpoint!["x"]!.GetValue<string>(), checkpoint["target"]!.GetValue<string>())).ToArray();
        var moved46TargetOrder = chordMiss["result"]!["checkpoints"]!.AsArray()
            .Select(checkpoint => (checkpoint!["x"]!.GetValue<string>(), checkpoint["target"]!.GetValue<string>())).ToArray();
        True(level46TargetOrder.SequenceEqual(moved46TargetOrder),
            "circle target identities and order stay stable when the centre moves");
        True(!Level(46)["result"]!["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["phase"]!.GetValue<double>())
                .SequenceEqual(chordMiss["result"]!["checkpoints"]!.AsArray()
                    .Select(checkpoint => checkpoint!["phase"]!.GetValue<double>())),
            "circle passage timestamps update while stable targets move around the centre");
        var solved45 = SetCircle(Level(45)["state"]!, "2", "1/2", "5/4");
        var antipodal = solved45["result"]!["checkpoints"]!.AsArray()
            .Where(checkpoint => checkpoint!["x"]!.GetValue<string>() != "13/4")
            .Select(checkpoint => checkpoint!["phase"]!.GetValue<double>()).OrderBy(value => value).ToArray();
        True(Math.Abs((antipodal[1] - antipodal[0]) - 0.5) < 1e-12,
            "circle midpoint lesson exposes an exact antipodal half-turn");
        var solved47 = SetCircle(Level(47)["state"]!, "5/4", "-1/2", "5/2");
        string transferEquation = solved47["result"]!["circle"]!["equationLatex"]!.GetValue<string>();
        Contains(transferEquation, "h +", "negative vertical centre simplifies to addition in equation");
        True(!transferEquation.Contains("- -", StringComparison.Ordinal),
            "circle equation never prints a double negative");
        string originEquation = solved43["result"]!["circle"]!["equationLatex"]!.GetValue<string>();
        True(!originEquation.Contains("h - 0", StringComparison.Ordinal),
            "zero vertical centre is simplified in equation");

        Equal(@"\left(h + \frac{1}{2}\right)^{2} = \left(\frac{5}{2}\right)^{2} - \left(x - \frac{5}{4}\right)^{2}",
            solved47["result"]!["constructedLatex"]!.GetValue<string>(),
            "circle constructed equation preserves signed rational parameters and visibly squares the radius");
        Equal(@"h^{2} = \left(1\right)^{2} - \left(x - 2\right)^{2}",
            solved43["result"]!["constructedLatex"]!.GetValue<string>(),
            "circle constructed equation groups zero centres without artificial subtraction");
        var signedCreation = SetCircle(Remix(43)["state"]!, "-3/4", "1/2", "5/4");
        Equal(@"\left(h - \frac{1}{2}\right)^{2} = \left(\frac{5}{4}\right)^{2} - \left(x + \frac{3}{4}\right)^{2}",
            signedCreation["result"]!["constructedLatex"]!.GetValue<string>(),
            "circle constructed equation normalizes positive and negative rational centres");

        InvalidContains(CircleRequest(Level(43)["state"]!, "9/4", "0", "1"), "fixed",
            "circle 43 horizontal centre lock");
        InvalidContains(CircleRequest(Level(43)["state"]!, "2", "1/4", "1"), "fixed",
            "circle 43 vertical centre lock");
        InvalidContains(CircleRequest(Level(44)["state"]!, "3/2", "1/2", "5/4"), "fixed",
            "circle 44 radius lock");
        InvalidContains(CircleRequest(Level(45)["state"]!, "9/4", "1/2", "5/4"), "fixed",
            "circle 45 horizontal centre lock");

        var editable46 = Level(46)["state"]!;
        InvalidContains(CircleRequest(editable46, "1/3", "0", "1"), "quarter",
            "circle horizontal centre rejects non-quarter exact fraction");
        InvalidContains(CircleRequest(editable46, "2", "1/3", "1"), "quarter",
            "circle vertical centre rejects non-quarter exact fraction");
        InvalidContains(CircleRequest(editable46, "2", "0", "1/3"), "quarter",
            "circle radius rejects non-quarter exact fraction");
        InvalidContains(CircleRequest(editable46, "-17/4", "0", "1"), "between -4 and 8",
            "circle horizontal centre lower bound");
        InvalidContains(CircleRequest(editable46, "2", "33/4", "1"), "between -4 and 8",
            "circle vertical centre upper bound");
        InvalidContains(CircleRequest(editable46, "2", "0", "0"), "between 1/4 and 6",
            "circle radius positive lower bound");
        InvalidContains(CircleRequest(editable46, "2", "0", "25/4"), "between 1/4 and 6",
            "circle radius upper bound");
        Invalid(CircleRequest(editable46, "2.25", "0", "1"),
            "circle parameters reject decimal approximations");
        var normalized = SetCircle(editable46, "8/4", "0", "4/4");
        Equal("2", normalized["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle exact parameter normalizes equivalent rational centre");
        Equal("1", normalized["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle exact parameter normalizes equivalent rational radius");

        var level43WithoutCircle = Clone(Level(43)["state"]!).AsObject();
        level43WithoutCircle.Remove("circle");
        var derivedCircle = Act(level43WithoutCircle, new JsonObject { ["type"] = "evaluate" });
        Equal("1/2", derivedCircle["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "missing authored circle metadata derives the level default");
        var polynomialWithCircle = Clone(Level(1)["state"]!).AsObject();
        polynomialWithCircle["circle"] = new JsonObject { ["x"] = "2", ["y"] = "0", ["radius"] = "1" };
        InvalidContains(new JsonObject
        {
            ["state"] = polynomialWithCircle, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "Polynomial", "polynomial state rejects forged circle parameters");
        var forgedGoals = Clone(Level(43)["state"]!).AsObject();
        forgedGoals["goals"]![0]!["x"] = "11/4";
        InvalidContains(new JsonObject
        {
            ["state"] = forgedGoals, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "Authored", "authored circle goals cannot be forged");
        var forgedNodes = Clone(Level(46)["state"]!).AsObject();
        forgedNodes["nodes"]!.AsArray().Add(new JsonObject { ["id"] = "forged", ["op"] = "H" });
        InvalidContains(new JsonObject
        {
            ["state"] = forgedNodes, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "Circle", "circle state rejects operation nodes");

        var initial46State = Clone(Level(46)["state"]!);
        var edited46 = SetCircle(initial46State, "9/4", "1/4", "5/4");
        var reset46 = Act(edited46["state"]!, new JsonObject { ["type"] = "reset" });
        Equal("2", reset46["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle reset restores authored centre x");
        Equal("0", reset46["state"]!["circle"]!["y"]!.GetValue<string>(),
            "circle reset restores authored centre y");
        Equal("1", reset46["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle reset restores authored radius");
        var restoredUndoSnapshot = Act(initial46State, new JsonObject { ["type"] = "evaluate" });
        Equal("2", restoredUndoSnapshot["state"]!["circle"]!["x"]!.GetValue<string>(),
            "previous exact circle state remains a valid undo snapshot");
        Equal(false, restoredUndoSnapshot["result"]!["solved"]!.GetValue<bool>(),
            "undo snapshot evaluates independently of later circle edits");

        var remixed47 = Act(solved47["state"]!, new JsonObject { ["type"] = "remix" });
        Equal("remix", remixed47["state"]!["mode"]!.GetValue<string>(), "circle remix enters creation mode");
        Equal("5/4", remixed47["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle remix preserves centre x");
        Equal("-1/2", remixed47["state"]!["circle"]!["y"]!.GetValue<string>(),
            "circle remix preserves centre y");
        Equal("5/2", remixed47["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle remix preserves radius");
        Equal(0, remixed47["state"]!["goals"]!.AsArray().Count, "circle remix removes authored goals");
        True(new[] { "x", "y", "radius" }.SequenceEqual(remixed47["result"]!["circle"]!["editable"]!.AsArray()
                .Select(value => value!.GetValue<string>())),
            "circle remix removes authored parameter locks");
        Equal(false, remixed47["result"]!["solved"]!.GetValue<bool>(), "circle creation never reports solved");
        Equal(3, remixed47["result"]!["checkpoints"]!.AsArray().Count,
            "circle creation exposes three exact rational rim probes");
        True(remixed47["result"]!["checkpoints"]!.AsArray().All(checkpoint => checkpoint!["hit"]!.GetValue<bool>()),
            "circle creation probes lie exactly on its current circle");

        var creationExport = Act(remixed47["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "creation", ["view"] = "flow" });
        var creationArtifact = creationExport["artifact"]!.AsObject();
        Equal("5/4", creationArtifact["circle"]!["x"]!.GetValue<string>(),
            "circle creation artifact preserves centre x");
        Equal("-1/2", creationArtifact["circle"]!["y"]!.GetValue<string>(),
            "circle creation artifact preserves centre y");
        Equal("5/2", creationArtifact["circle"]!["radius"]!.GetValue<string>(),
            "circle creation artifact preserves radius");
        Equal(0, creationArtifact["nodes"]!.AsArray().Count,
            "circle creation artifact explicitly preserves empty operations");
        var creationImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationArtifact) }
        });
        Equal("5/4", creationImport["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle creation import preserves centre x");
        Equal("-1/2", creationImport["state"]!["circle"]!["y"]!.GetValue<string>(),
            "circle creation import preserves centre y");
        Equal("5/2", creationImport["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle creation import preserves radius");
        var missingCreationCircle = Clone(creationArtifact).AsObject();
        missingCreationCircle.Remove("circle");
        Invalid(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = missingCreationCircle }
        }, "circle creation import requires its exact parameters");

        var resetCreation = Act(creationImport["state"]!, new JsonObject { ["type"] = "reset" });
        Equal("2", resetCreation["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle creation reset restores generic default centre x");
        Equal("0", resetCreation["state"]!["circle"]!["y"]!.GetValue<string>(),
            "circle creation reset restores generic default centre y");
        Equal("1", resetCreation["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle creation reset restores generic default radius");

        var circleToPolynomial = Act(creationImport["state"]!,
            new JsonObject { ["type"] = "source", ["sourceId"] = 1 });
        True(!circleToPolynomial["state"]!.AsObject().ContainsKey("circle"),
            "source change from circle to polynomial removes circle metadata");
        Equal(0, circleToPolynomial["state"]!["nodes"]!.AsArray().Count,
            "source change from circle starts polynomial with the empty construction");
        var polynomialBuilt = Act(Remix(1)["state"]!,
            new JsonObject { ["type"] = "insert", ["id"] = "half", ["op"] = "H", ["index"] = 0 });
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(polynomialBuilt["state"]!),
            ["action"] = new JsonObject { ["type"] = "source", ["sourceId"] = 43 }
        }, "empty operation", "polynomial-to-circle source change requires explicitly cleared state nodes");
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(polynomialBuilt["state"]!),
            ["action"] = new JsonObject
            {
                ["type"] = "source", ["sourceId"] = 43,
                ["nodes"] = new JsonArray { new JsonObject { ["id"] = "half", ["op"] = "H" } }
            }
        }, "empty operation", "polynomial-to-circle source change rejects operation nodes");
        var clearedPolynomialState = Clone(polynomialBuilt["state"]!).AsObject();
        clearedPolynomialState["nodes"] = new JsonArray();
        var polynomialToCircle = Act(clearedPolynomialState,
            new JsonObject { ["type"] = "source", ["sourceId"] = 43 });
        Equal(43, polynomialToCircle["state"]!["sourceId"]!.GetValue<int>(),
            "explicitly cleared source change selects circle representation");
        Equal(0, polynomialToCircle["state"]!["nodes"]!.AsArray().Count,
            "explicitly cleared source change drops polynomial operations");
        Equal("1", polynomialToCircle["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "new circle creation uses the generic default circle");

        var challengeExport = Act(creationImport["state"]!,
            new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" });
        var challengeArtifact = challengeExport["artifact"]!.AsObject();
        Equal(43, challengeArtifact["sourceId"]!.GetValue<int>(),
            "circle challenge export uses the canonical circle source");
        True(!challengeArtifact.ContainsKey("circle") && !challengeArtifact.ContainsKey("nodes") &&
             !challengeArtifact.ContainsKey("result") && !challengeArtifact.ContainsKey("solution"),
            "circle challenge artifact does not leak witness parameters or construction");
        Equal(0, challengeArtifact["inventory"]!.AsObject().Count,
            "circle challenge has no operation inventory");
        Equal(0, challengeArtifact["limit"]!.GetValue<int>(),
            "circle challenge has zero operation limit");
        var expectedSharedGoals = new (string X, string Y)[]
        {
            ("11/4", "3/2"), ("-3/4", "1"), ("5/4", "-3")
        };
        var exportedGoals = challengeArtifact["goals"]!.AsArray()
            .Select(goal => (goal!["x"]!.GetValue<string>(), goal["y"]!.GetValue<string>())).ToArray();
        True(expectedSharedGoals.SequenceEqual(exportedGoals),
            "circle challenge targets use the fixed exact rational unit-circle offsets");
        True(expectedSharedGoals.All(goal => DistanceSquared("5/4", "-1/2", goal) == new Fraction(25, 4)),
            "independent exact oracle validates exported circle witness targets");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeArtifact) }
        });
        Equal("challenge", challengeImport["state"]!["mode"]!.GetValue<string>(),
            "circle challenge imports in shared mode");
        Equal("2", challengeImport["state"]!["circle"]!["x"]!.GetValue<string>(),
            "circle challenge starts from generic centre x rather than witness");
        Equal("0", challengeImport["state"]!["circle"]!["y"]!.GetValue<string>(),
            "circle challenge starts from generic centre y rather than witness");
        Equal("1", challengeImport["state"]!["circle"]!["radius"]!.GetValue<string>(),
            "circle challenge starts from generic radius rather than witness");
        Equal(false, challengeImport["result"]!["solved"]!.GetValue<bool>(),
            "circle challenge initial default does not inherit witness completion");
        var challengeSolved = SetCircle(challengeImport["state"]!, "5/4", "-1/2", "5/2");
        Equal(true, challengeSolved["result"]!["solved"]!.GetValue<bool>(),
            "circle challenge admits its hidden exact witness");
        True(new[] { "x", "y", "radius" }.SequenceEqual(challengeSolved["result"]!["circle"]!["editable"]!.AsArray()
                .Select(value => value!.GetValue<string>())),
            "circle challenge has no authored parameter locks");

        foreach ((string x, string y, string label) in new[]
        {
            ("-4", "-4", "minimum"), ("8", "8", "maximum")
        })
        {
            var extremeCreation = SetCircle(Remix(43)["state"]!, x, y, "6");
            var extremeExport = Act(extremeCreation["state"]!,
                new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" });
            var extremeArtifact = extremeExport["artifact"]!.AsObject();
            True(extremeArtifact["goals"]!.AsArray().All(goal =>
                Fraction.Parse(goal!["x"]!.GetValue<string>()).ToDouble() >= -10 &&
                Fraction.Parse(goal["x"]!.GetValue<string>()).ToDouble() <= 14 &&
                Fraction.Parse(goal["y"]!.GetValue<string>()).ToDouble() >= -10 &&
                Fraction.Parse(goal["y"]!.GetValue<string>()).ToDouble() <= 14),
                $"{label} valid circle exports targets inside full geometry bounds");
            var extremeImport = Ok(new JsonObject
            {
                ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(extremeArtifact) }
            });
            var extremeSolved = SetCircle(extremeImport["state"]!, x, y, "6");
            Equal(true, extremeSolved["result"]!["solved"]!.GetValue<bool>(),
                $"{label} centre and maximum radius challenge round-trip admits exact witness");
        }

        var arbitraryGoals = Clone(challengeArtifact).AsObject();
        arbitraryGoals["goals"] = new JsonArray
        {
            new JsonObject { ["x"] = "2", ["y"] = "-1" },
            new JsonObject { ["x"] = "1", ["y"] = "0" },
            new JsonObject { ["x"] = "3", ["y"] = "0" },
            new JsonObject { ["x"] = "2", ["y"] = "1" }
        };
        var arbitraryImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = arbitraryGoals }
        });
        var arbitraryPhases = arbitraryImport["result"]!["checkpoints"]!.AsArray()
            .Select(checkpoint => checkpoint!["phase"]!.GetValue<double>()).ToArray();
        True(arbitraryPhases.SequenceEqual(new[] { 0.75, 0.5, 0.0, 0.25 }),
            "arbitrary challenge goal order stays stable while each target carries its traversal phase");
        Equal(true, arbitraryImport["result"]!["solved"]!.GetValue<bool>(),
            "arbitrary exact cardinal challenge validates against default circle");

        var centreGoalArtifact = Clone(challengeArtifact).AsObject();
        centreGoalArtifact["goals"] = new JsonArray
        {
            new JsonObject { ["x"] = "2", ["y"] = "0" },
            new JsonObject { ["x"] = "3", ["y"] = "0" },
            new JsonObject { ["x"] = "2", ["y"] = "1" }
        };
        var centreGoalImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = centreGoalArtifact }
        });
        var centreCheckpoint = centreGoalImport["result"]!["checkpoints"]!.AsArray()
            .Single(checkpoint => checkpoint!["x"]!.GetValue<string>() == "2" &&
                                  checkpoint["target"]!.GetValue<string>() == "0");
        Equal(0.0, centreCheckpoint!["phase"]!.GetValue<double>(),
            "target at current centre receives deterministic zero phase");
        Equal("0", centreCheckpoint["lhs"]!.GetValue<string>(),
            "target at current centre has exact zero distance squared");

        var fractionalGoalArtifact = Clone(challengeArtifact).AsObject();
        fractionalGoalArtifact["goals"]![0]!["x"] = "1/3";
        var fractionalGoalImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = fractionalGoalArtifact }
        });
        Equal("1/3", fractionalGoalImport["state"]!["goals"]![0]!["x"]!.GetValue<string>(),
            "circle challenges accept arbitrary bounded exact rational target coordinates");

        var tooFewGoals = Clone(challengeArtifact).AsObject();
        while (tooFewGoals["goals"]!.AsArray().Count > 2) tooFewGoals["goals"]!.AsArray().RemoveAt(2);
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = tooFewGoals }
        }, "three and eight", "circle challenge rejects fewer than three goals");
        var tooManyGoals = Clone(challengeArtifact).AsObject();
        while (tooManyGoals["goals"]!.AsArray().Count < 9)
            tooManyGoals["goals"]!.AsArray().Add(new JsonObject { ["x"] = "3", ["y"] = "0" });
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = tooManyGoals }
        }, "three and eight", "circle challenge rejects more than eight goals");
        var outOfRangeGoal = Clone(challengeArtifact).AsObject();
        outOfRangeGoal["goals"]![0]!["x"] = "15";
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = outOfRangeGoal }
        }, "between -10 and 14", "circle challenge rejects out-of-range target coordinates");
        var leakedChallengeCircle = Clone(challengeArtifact).AsObject();
        leakedChallengeCircle["circle"] = new JsonObject { ["x"] = "5/4", ["y"] = "-1/2", ["radius"] = "5/2" };
        Invalid(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = leakedChallengeCircle }
        }, "circle challenge rejects a leaked witness field");

        Console.WriteLine("CIRCLES: 118849 bounded exact parameter candidates across five authored puzzles; one fit each");
    }

    private static void ConstructedEquationContract()
    {
        var ordered = ImportCreation(16, ["H", "A", "N", "Q"]);
        Equal(@"h = {\left(-\left(\frac{1}{2}+1\right)\right)}^{2}",
            ordered["result"]!["constructedLatex"]!.GetValue<string>(),
            "constructed equation retains ordered operations with precedence-aware grouping");

        string derivativeThenIntegral = ImportCreation(5, ["D", "I"])
            ["result"]!["constructedLatex"]!.GetValue<string>();
        Contains(derivativeThenIntegral, @"\int_{0}^{x}",
            "constructed integral uses the current variable as its upper bound");
        Contains(derivativeThenIntegral, @"\frac{\mathrm{d}}{\mathrm{d}u_{2}}",
            "constructed derivative uses upright d and the integral's bound variable");
        Contains(derivativeThenIntegral, @"\,\mathrm{d}u_{2}",
            "constructed integral closes its own dummy-variable scope");
        var derivativeThenIntegralResult = ImportCreation(5, ["D", "I"])["result"]!.AsObject();
        string evaluatedIntegral = derivativeThenIntegralResult["stages"]!.AsArray()[^1]!["latex"]!.GetValue<string>();
        Contains(evaluatedIntegral, "x", "evaluated integral result uses the free output variable x");
        True(!evaluatedIntegral.Contains("u", StringComparison.Ordinal),
            "evaluated integral result does not leak its construction dummy variable");

        string nestedCalculus = ImportCreation(5, ["I", "D", "I"])
            ["result"]!["constructedLatex"]!.GetValue<string>();
        Contains(nestedCalculus, @"\frac{\mathrm{d}}{\mathrm{d}u_{3}}",
            "nested derivative binds to the surrounding integral variable");
        Contains(nestedCalculus, @"\int_{0}^{u_{3}}",
            "nested inner integral uses the surrounding variable as its upper bound");
        Equal(2, CountOccurrences(nestedCalculus, "u_{1}"),
            "nested inner integral dummy appears only in its source and differential");
        Equal(3, CountOccurrences(nestedCalculus, "u_{3}"),
            "nested outer dummy connects derivative, inner upper bound and outer differential");

        string maximumRecipe = ImportCreation(16, Enumerable.Repeat("H", 64))
            ["result"]!["constructedLatex"]!.GetValue<string>();
        Equal(64, CountOccurrences(maximumRecipe, @"\frac{"),
            "constructed equation retains every node in a maximum-length recipe");
        True(maximumRecipe.Length < 4096,
            "maximum-length constructed equation grows linearly");

        string roundingWave = ImportCreation(50, ["A", "H", "F", "C", "S", "Q", "N"])
            ["result"]!["constructedLatex"]!.GetValue<string>();
        Equal(1, CountOccurrences(roundingWave, @"\left\lfloor"),
            "constructed equation keeps the floor node visible");
        Equal(1, CountOccurrences(roundingWave, @"\left\lceil"),
            "constructed equation keeps the ceiling node visible");
        Equal(1, CountOccurrences(roundingWave, @"\sin"),
            "constructed equation keeps the sine node visible");
        True(roundingWave.IndexOf(@"\sin", StringComparison.Ordinal) <
             roundingWave.IndexOf(@"\left\lceil", StringComparison.Ordinal) &&
             roundingWave.IndexOf(@"\left\lceil", StringComparison.Ordinal) <
             roundingWave.IndexOf(@"\left\lfloor", StringComparison.Ordinal),
            "constructed equation nests sine around ceiling around floor in recipe order");
        Equal(1, CountOccurrences(roundingWave, "x"),
            "constructed equation retains one copy of its source through rounding wrappers");
    }

    private static void ExtendedPuzzleContract()
    {
        var witnesses = new Dictionary<int, string>
        {
            [48] = "QNA", [49] = "HAQNAAAA", [50] = "S", [51] = "AS", [52] = "HS",
            [53] = "SQ", [54] = "SQHA", [55] = "ASQHHA", [56] = "F", [57] = "C",
            [58] = "NF", [59] = "HF", [60] = "AHF", [61] = "FS", [62] = "FSI",
            [63] = "AHFSIQNA", [64] = "DSQHA", [65] = "AHFSINAQNA",
            [66] = "Q", [67] = "DAHFSINAQNAQ", [68] = "A", [69] = "HH",
            [70] = "N", [71] = "AHHQNAHQ", [72] = "", [73] = "IH",
            [74] = "NAHH", [75] = "HQNAQ", [76] = "ASAH", [77] = "HQQQNAHH"
        };
        int[] relationSources = [48, 49, 66, 67, 68, 69, 70, 71, 74, 75, 77];

        foreach ((int source, string witness) in witnesses)
        {
            JsonObject played = PlayExtendedPuzzle(source, witness);
            var state = played["state"]!.AsObject();
            var result = played["result"]!.AsObject();
            Equal(source, state["sourceId"]!.GetValue<int>(), $"extended source {source} retains stable id");
            Equal(witness.Length, state["nodes"]!.AsArray().Count,
                $"extended source {source} witness includes every fixed and movable operation");
            Equal(true, result["solved"]!.GetValue<bool>(),
                $"extended source {source} independently authored witness solves exactly");
            True(!string.IsNullOrWhiteSpace(result["constructedLatex"]!.GetValue<string>()),
                $"extended source {source} has a constructed equation");
            if (source is >= 72 and <= 77)
            {
                True(result["picture"]!["paths"]!.AsArray().Count > 0,
                    $"art source {source} supplies its informational reference picture");
                True(!result["picture"]!.AsObject().ContainsKey("hit"),
                    $"art source {source} picture does not add a sampled win condition");
            }

            var checkpoints = result["checkpoints"]!.AsArray();
            Equal(state["goals"]!.AsArray().Count, checkpoints.Count,
                $"extended source {source} checkpoint count");
            foreach (var checkpointNode in checkpoints)
            {
                var checkpoint = checkpointNode!.AsObject();
                True(!string.IsNullOrWhiteSpace(checkpoint["actualLatex"]!.GetValue<string>()),
                    $"extended source {source} checkpoint has exact LaTeX");
                True(!string.IsNullOrWhiteSpace(checkpoint["targetLatex"]!.GetValue<string>()),
                    $"extended source {source} checkpoint has authoritative target LaTeX");
                True(double.IsFinite(checkpoint["targetNumber"]!.GetValue<double>()),
                    $"extended source {source} checkpoint has an authoritative numeric target");
                True(double.IsFinite(checkpoint["actualNumber"]!.GetValue<double>()),
                    $"extended source {source} checkpoint has a finite numeric reading");
                Equal(true, checkpoint["hit"]!.GetValue<bool>(),
                    $"extended source {source} witness hits each checkpoint");
            }

            var stages = result["stages"]!.AsArray();
            Equal(witness.Length + 1, stages.Count, $"extended source {source} stage count");
            var expectedXs = result["points"]!.AsArray()
                .Select(point => point![0]!.GetValue<double>()).ToArray();
            foreach (var stageNode in stages)
            {
                var stage = stageNode!.AsObject();
                Equal(checkpoints.Count, stage["values"]!.AsArray().Count,
                    $"extended source {source} exact stage value count");
                Equal(checkpoints.Count, stage["valueLatex"]!.AsArray().Count,
                    $"extended source {source} exact stage LaTeX count");
                True(stage["valueLatex"]!.AsArray().All(value =>
                        !string.IsNullOrWhiteSpace(value!.GetValue<string>())),
                    $"extended source {source} exact stage LaTeX is nonempty");
                var stageXs = stage["points"]!.AsArray()
                    .Select(point => point![0]!.GetValue<double>()).ToArray();
                if (result.ContainsKey("crop"))
                    True(expectedXs.All(x => stageXs.Contains(x)),
                        $"extended source {source} cropped output samples come from the uncropped stage grid");
                else
                    True(expectedXs.SequenceEqual(stageXs),
                        $"extended source {source} stage samples stay aligned by x");
                True(stage.ContainsKey("paths"),
                    $"extended source {source} segmented stage supplies drawable paths");
            }
            True(result.ContainsKey("paths"), $"extended source {source} mirrors final segmented paths");

            foreach (int index in Enumerable.Range(0, witness.Length).Where(index => witness[index] == 'S'))
            {
                var sineStage = stages[index + 1]!.AsObject();
                Equal(sineStage["points"]!.AsArray().Count, sineStage["projection"]!.AsArray().Count,
                    $"extended source {source} sine projection aligns with stage points");
            }

            if (relationSources.Contains(source))
            {
                True(result.ContainsKey("relation"), $"relation source {source} returns relation metadata");
                True(!result.ContainsKey("heightGuide"), $"relation source {source} omits the explicit-height guide");
                True(result["constructedLatex"]!.GetValue<string>().StartsWith("h^{2} =", StringComparison.Ordinal),
                    $"relation source {source} constructed equation starts with squared height");
            }
            else
            {
                True(result.ContainsKey("heightGuide"), $"extended explicit source {source} keeps the height guide");
                var guide = result["heightGuide"]!.AsObject();
                True(!string.IsNullOrWhiteSpace(guide["actualLatex"]!.GetValue<string>()),
                    $"extended source {source} height guide has exact LaTeX");
                True(!string.IsNullOrWhiteSpace(guide["targetLatex"]!.GetValue<string>()),
                    $"extended source {source} height guide has authoritative target LaTeX");
                True(double.IsFinite(guide["targetNumber"]!.GetValue<double>()),
                    $"extended source {source} height guide has an authoritative numeric target");
                foreach (var stageNode in guide["stages"]!.AsArray())
                {
                    var stage = stageNode!.AsObject();
                    foreach (string field in new[] { "fromLatex", "toLatex", "gapLatex" })
                        True(!string.IsNullOrWhiteSpace(stage[field]!.GetValue<string>()),
                            $"extended source {source} height-guide {field}");
                    foreach (string field in new[] { "fromNumber", "toNumber", "gapNumber" })
                        True(double.IsFinite(stage[field]!.GetValue<double>()),
                            $"extended source {source} height-guide {field}");
                }
            }
        }

        Equal(10, Level(67)["state"]!["goals"]!.AsArray().Count,
            "mixed finale retains all ten relation targets");
        var legacy = Level(3)["result"]!.AsObject();
        True(legacy["checkpoints"]!.AsArray().All(checkpoint =>
                checkpoint!.AsObject().ContainsKey("actualLatex") && checkpoint.AsObject().ContainsKey("actualNumber")),
            "legacy explicit results expose symbolic and numeric checkpoint readings");
        True(legacy["stages"]!.AsArray().All(stage => stage!.AsObject().ContainsKey("valueLatex")),
            "legacy explicit stages expose symbolic checkpoint readings");
        var circle = Level(43)["result"]!.AsObject();
        True(circle["checkpoints"]!.AsArray().All(checkpoint =>
                checkpoint!.AsObject().ContainsKey("actualLatex") && checkpoint.AsObject().ContainsKey("actualNumber")),
            "circle results expose symbolic and numeric checkpoint readings");
        True(circle["stages"]![0]!.AsObject().ContainsKey("valueLatex"),
            "circle stage exposes symbolic checkpoint readings");

        var exactSine = Level(54)["result"]!["checkpoints"]![1]!.AsObject();
        Equal("1/2 * sqrt(2)", exactSine["actual"]!.GetValue<string>(),
            "sine substitution retains its exact radical rather than an evaluated decimal");
        Entity.Variable displayX = "x";
        string exactSineLatex = MathS.FromString("sin(pi*x/2)")
            .Substitute(displayX, MathS.FromString("1/2")).InnerSimplified.Latexize();
        Equal(exactSineLatex, exactSine["actualLatex"]!.GetValue<string>(),
            "sine radical renders its already exact substituted entity without another full simplify pass");
    }

    private static void CropOutlineContract()
    {
        var legacyPictureGoals = new Dictionary<int, (string x, string y)[]>
        {
            [72] = [("0", "0"), ("1", "1"), ("2", "0")],
            [73] = [("1", "7/6"), ("2", "4/3"), ("3", "3/2")],
            [74] = [("3/2", "0"), ("2", "1/2"), ("2", "-1/2"), ("5/2", "0")],
            [75] = [("0", "0"), ("1", "3/4"), ("1", "-3/4"), ("2", "1"),
                    ("2", "-1"), ("3", "3/4"), ("3", "-3/4"), ("4", "0")],
            [76] = [("1", "1/2"), ("2", "1"), ("3", "1/2")],
            [77] = [("0", "0"), ("2", "1/2"), ("2", "-1/2"), ("4", "0")]
        };
        static JsonArray GoalJson(IEnumerable<(string x, string y)> goals) =>
            new(goals.Select(goal => (JsonNode)new JsonObject { ["x"] = goal.x, ["y"] = goal.y }).ToArray());

        var initial = Level(72);
        var initialCrop = initial["result"]!["crop"]!.AsObject();
        Equal("0", initialCrop["from"]!.GetValue<string>(), "authored Crop starts at its initial left bound");
        Equal("4", initialCrop["to"]!.GetValue<string>(), "authored Crop starts at its initial right bound");
        Equal("0", initialCrop["required"]!["from"]!.GetValue<string>(), "authored Crop exposes required left bound");
        Equal("2", initialCrop["required"]!["to"]!.GetValue<string>(), "authored Crop exposes required right bound");
        Equal(false, initialCrop["hit"]!.GetValue<bool>(), "initial full wave has not matched the required crop");
        True(initial["result"]!["picture"]!["paths"]!.AsArray().Count > 0,
            "authored picture supplies an informational reference silhouette");
        True(!initial["result"]!["picture"]!.AsObject().ContainsKey("hit"),
            "informational picture does not impose a second success predicate");
        Equal(false, initial["result"]!["solved"]!.GetValue<bool>(), "landmarks alone do not bypass the Crop goal");

        var cropped = Act(initial["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "0", ["to"] = "2"
        });
        Equal(true, cropped["result"]!["crop"]!["hit"]!.GetValue<bool>(), "exact required Crop bounds match");
        Equal(true, cropped["result"]!["solved"]!.GetValue<bool>(), "matching exact landmarks and Crop solves");
        Contains(cropped["result"]!["equationLatex"]!.GetValue<string>(), @"\text{for}",
            "simplified equation uses native Provided presentation");
        Contains(cropped["result"]!["constructedLatex"]!.GetValue<string>(), @"0 \le x \le 2",
            "ordered construction displays its terminal restriction");
        var croppedXs = cropped["result"]!["points"]!.AsArray().Select(point => point![0]!.GetValue<double>()).ToArray();
        Equal(0d, croppedXs.First(), "cropped sine owns its exact left endpoint");
        Equal(2d, croppedXs.Last(), "cropped sine owns its exact right endpoint");

        var partial = Act(Remix(1)["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1/2", ["to"] = "7/2"
        });
        var partialCheckpoints = partial["result"]!["checkpoints"]!.AsArray();
        foreach (int index in new[] { 0, 2 })
        {
            Equal("undefined", partialCheckpoints[index]!["actual"]!.GetValue<string>(),
                "checkpoint outside Crop is explicitly undefined");
            Equal(@"\varnothing", partialCheckpoints[index]!["actualLatex"]!.GetValue<string>(),
                "checkpoint outside Crop uses empty-set LaTeX");
            Equal(false, partialCheckpoints[index]!["defined"]!.GetValue<bool>(),
                "checkpoint outside Crop is not zero-filled");
            Equal(false, partialCheckpoints[index]!["hit"]!.GetValue<bool>(),
                "checkpoint outside Crop cannot match");
        }
        Equal(.5d, partialCheckpoints[1]!["phase"]!.GetValue<double>(),
            "defined explicit checkpoint phase is normalized across the kept interval");
        Equal(1d, partialCheckpoints[0]!["phase"]!.GetValue<double>(),
            "outside explicit checkpoint confirms as a miss at cropped-flight finish");
        Equal(3d, partial["result"]!["startSlope"]!.GetValue<double>(),
            "explicit launch slope is evaluated at the cropped left endpoint");
        foreach ((string from, string to) in new[] { ("-1", "2"), ("2", "2"), ("0", "5"), ("sqrt(2)", "3") })
            Invalid(new JsonObject
            {
                ["state"] = Clone(partial["state"]!),
                ["action"] = new JsonObject { ["type"] = "crop", ["from"] = from, ["to"] = to }
            }, $"invalid Crop bounds {from}..{to}");
        var cleared = Act(partial["state"]!, new JsonObject { ["type"] = "crop", ["clear"] = true });
        True(!cleared["state"]!.AsObject().ContainsKey("crop"), "Create can remove its terminal Crop");

        var stepped = Remix(56);
        stepped = Act(stepped["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "floor", ["op"] = "F", ["index"] = 0
        });
        stepped = Act(stepped["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1/2", ["to"] = "7/2"
        });
        var stepPaths = stepped["result"]!["paths"]!.AsArray();
        True(stepPaths.Count >= 3, "cropping a step curve preserves its explicit jump gaps");
        True(stepPaths.SelectMany(path => path!["points"]!.AsArray())
                .All(point => point![0]!.GetValue<double>() is >= .5 and <= 3.5),
            "every cropped step path stays inside the exact interval");

        JsonObject CachedRecipe(string prefix)
        {
            var response = Remix(1);
            response = Act(response["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"{prefix}-sine", ["op"] = "S", ["index"] = 0
            });
            response = Act(response["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"{prefix}-floor", ["op"] = "F", ["index"] = 1
            });
            return Act(response["state"]!, new JsonObject
            {
                ["type"] = "crop", ["from"] = "1/2", ["to"] = "7/2"
            });
        }
        var cachedA = CachedRecipe("cached-a");
        var cachedB = CachedRecipe("cached-b");
        Equal("cached-a-sine", cachedA["result"]!["stages"]![1]!["id"]!.GetValue<string>(),
            "cached stages retain the first recipe's node identity");
        Equal("cached-b-sine", cachedB["result"]!["stages"]![1]!["id"]!.GetValue<string>(),
            "equivalent cached math does not reuse a stale node identity");
        var replayedCrop = Act(cachedA["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1", ["to"] = "3"
        });
        replayedCrop = Act(replayedCrop["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1/2", ["to"] = "7/2"
        });
        Equal(cachedA["result"]!["stages"]!.ToJsonString(), replayedCrop["result"]!["stages"]!.ToJsonString(),
            "replaying Crop bounds reuses the same immutable uncropped stage result");
        var slopeCrop = Remix(1);
        slopeCrop = Act(slopeCrop["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1", ["to"] = "3"
        });
        Equal(2d, slopeCrop["result"]!["startSlope"]!.GetValue<double>(),
            "cached derivative is still substituted at the current exact Crop endpoint");
        slopeCrop = Act(slopeCrop["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "3", ["to"] = "7/2"
        });
        Equal(-2d, slopeCrop["result"]!["startSlope"]!.GetValue<double>(),
            "a later Crop endpoint cannot reuse an earlier substituted slope");
        var movedCropLatex = slopeCrop["result"]!["equationLatex"]!.GetValue<string>();
        Contains(movedCropLatex, @"x \geq 3",
            "expression presentation reuse retains the current Provided left endpoint");
        Contains(movedCropLatex, @"x \leq \frac{7}{2}",
            "expression presentation reuse retains the current Provided right endpoint");
        var sfExact = ImportCreation(1, ["S", "F"])["result"]!.AsObject();
        Equal("0,0,0", string.Join(',', sfExact["checkpoints"]!.AsArray()
                .Select(point => point!["actual"]!.GetValue<string>())),
            "cached SF evaluation retains exact checkpoint readings");
        foreach (var checkpoint in sfExact["checkpoints"]!.AsArray())
        {
            double px = double.Parse(checkpoint!["x"]!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture);
            var preview = sfExact["points"]!.AsArray().First(point => Math.Abs(point![0]!.GetValue<double>() - px) < 1e-12);
            Equal(checkpoint["actualNumber"]!.GetValue<double>(), preview![1]!.GetValue<double>(),
                "cached SF drawing preserves its exact checkpoint override");
        }

        foreach ((int source, string recipe) in new[] { (48, "QNA"), (69, "HH"), (70, "Q") })
        {
            var relation = Remix(source);
            for (int index = 0; index < recipe.Length; index++)
                relation = Act(relation["state"]!, new JsonObject
                {
                    ["type"] = "insert", ["id"] = $"crop-relation-{source}-{index}",
                    ["op"] = recipe[index].ToString(), ["index"] = index
                });
            relation = Act(relation["state"]!, new JsonObject
            {
                ["type"] = "crop", ["from"] = "1", ["to"] = "3"
            });
            var relationPaths = relation["result"]!["relation"]!["paths"]!.AsArray();
            True(relationPaths.SelectMany(path => path!["points"]!.AsArray())
                    .All(point => point![0]!.GetValue<double>() is >= 1 and <= 3),
                $"implicit source {source} clips every open, closed, or crossing branch to Crop");
            var playbackCount = relation["result"]!["relation"]!["playback"]!.AsArray().Count;
            foreach (var flight in relation["result"]!["relation"]!["flights"]!.AsArray())
                True(flight![0]!.GetValue<int>() >= 0 && flight[1]!.GetValue<int>() < playbackCount,
                    $"implicit source {source} cropped flight range indexes its clipped playback");
        }

        var emptyGeometry = Remix(74);
        emptyGeometry = Act(emptyGeometry["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "negative", ["op"] = "N", ["index"] = 0
        });
        emptyGeometry = Act(emptyGeometry["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "0", ["to"] = "1"
        });
        Equal(0, emptyGeometry["result"]!["relation"]!["paths"]!.AsArray().Count,
            "a kept interval with no real implicit locus remains a valid empty editing state");
        True(emptyGeometry["result"]!["checkpoints"]!.AsArray()
                .Where(checkpoint => !checkpoint!["defined"]!.GetValue<bool>())
                .All(checkpoint => checkpoint!["phase"]!.GetValue<double>() == 1d),
            "outside-Crop relation misses confirm at the end of playback");
        True(emptyGeometry["result"]!["checkpoints"]!.AsArray()
                .All(checkpoint => checkpoint!.AsObject().ContainsKey("lhs")),
            "outside-Crop relation checkpoints retain their exact expected left side");

        var reset = Act(cropped["state"]!, new JsonObject { ["type"] = "reset" });
        Equal("4", reset["state"]!["crop"]!["to"]!.GetValue<string>(),
            "authored reset restores the initial Crop interval");
        var remixed = Act(cropped["state"]!, new JsonObject { ["type"] = "remix" });
        Equal("2", remixed["state"]!["crop"]!["to"]!.GetValue<string>(),
            "moving an authored construction to Create preserves its Crop");
        True(!remixed["result"]!.AsObject().ContainsKey("picture"),
            "authored reference picture is not inherited into Create");
        remixed = Act(remixed["state"]!, new JsonObject
        {
            ["type"] = "crop", ["from"] = "1", ["to"] = "2"
        });
        Equal(true, remixed["result"]!["crop"]!["hit"]!.GetValue<bool>(),
            "Create crop does not inherit an authored required interval");
        True(!remixed["result"]!["crop"]!.AsObject().ContainsKey("required"),
            "Create omits authored Crop target metadata");
        var differentCropChallengeExport = Act(remixed["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight"
        });
        var differentCropChallenge = Ok(new JsonObject
        {
            ["action"] = new JsonObject
            {
                ["type"] = "import", ["artifact"] = Clone(differentCropChallengeExport["artifact"]!)
            }
        });
        Equal(true, differentCropChallenge["result"]!["crop"]!["hit"]!.GetValue<bool>(),
            "shared challenge with a different valid kept interval has no authored Crop requirement");
        True(!differentCropChallenge["result"]!["crop"]!.AsObject().ContainsKey("required"),
            "shared challenge omits authored Crop target metadata");
        Equal(true, differentCropChallenge["result"]!["solved"]!.GetValue<bool>(),
            "shared challenge solves against its exported kept-interval targets");

        var witnesses = new Dictionary<int, string>
        {
            [72] = "", [73] = "IH", [74] = "NAHH", [75] = "HQNAQ", [76] = "ASAH", [77] = "HQQQNAHH"
        };
        foreach (int source in legacyPictureGoals.Keys)
        {
            var current = PlayExtendedPuzzle(source, witnesses[source]);
            var legacyState = Clone(current["state"]!).AsObject();
            var retainedNodes = legacyState["nodes"]!.ToJsonString();
            var retainedCrop = legacyState["crop"]?.ToJsonString();
            legacyState["goals"] = GoalJson(legacyPictureGoals[source]);
            var migrated = Ok(new JsonObject
            {
                ["state"] = legacyState,
                ["action"] = new JsonObject { ["type"] = "evaluate" }
            });
            Equal(Level(source)["state"]!["goals"]!.ToJsonString(), migrated["state"]!["goals"]!.ToJsonString(),
                $"legacy authored picture goals for source {source} upgrade to current targets");
            Equal(retainedNodes, migrated["state"]!["nodes"]!.ToJsonString(),
                $"legacy authored migration preserves source {source} node identities");
            Equal(retainedCrop ?? "<none>", migrated["state"]!["crop"]?.ToJsonString() ?? "<none>",
                $"legacy authored migration preserves source {source} Crop bounds");
        }
        var forgedLegacyState = Clone(Level(72)["state"]!).AsObject();
        var forgedLegacyGoals = GoalJson(legacyPictureGoals[72]);
        forgedLegacyGoals[1]!["y"] = "999";
        forgedLegacyState["goals"] = forgedLegacyGoals;
        Invalid(new JsonObject
        {
            ["state"] = forgedLegacyState,
            ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "near-legacy authored picture goals remain rejected");

        var legacyChallengeGoals = GoalJson(legacyPictureGoals[77].Select((goal, index) =>
            (goal.x, y: new[] { "1", "2", "-3", "4" }[index])));
        JsonObject PictureChallenge(JsonArray goals) => new()
        {
            ["schema"] = 1, ["rules"] = "vine-1", ["engine"] = "AngouriMath-2.5.0",
            ["type"] = "challenge", ["sourceId"] = 77, ["view"] = "flight",
            ["goals"] = goals, ["inventory"] = new JsonObject(), ["limit"] = 0
        };
        var importedLegacyChallenge = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = PictureChallenge(legacyChallengeGoals) }
        });
        Equal(legacyChallengeGoals.ToJsonString(), importedLegacyChallenge["state"]!["goals"]!.ToJsonString(),
            "legacy picture challenge positions retain their original challenge heights");
        var forgedLegacyChallengeGoals = Clone(legacyChallengeGoals).AsArray();
        forgedLegacyChallengeGoals[1]!["x"] = "5";
        Invalid(new JsonObject
        {
            ["action"] = new JsonObject
            {
                ["type"] = "import", ["artifact"] = PictureChallenge(forgedLegacyChallengeGoals)
            }
        }, "forged near-legacy picture challenge positions remain rejected");

        foreach (int source in new[] { 76, 77 })
        {
            var symbolicPuzzle = PlayExtendedPuzzle(source, witnesses[source]);
            var exported = Act(symbolicPuzzle["state"]!, new JsonObject
            {
                ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight"
            });
            var imported = Ok(new JsonObject
            {
                ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(exported["artifact"]!) }
            });
            True(imported["result"]!["checkpoints"]!.AsArray().All(checkpoint =>
                    !string.IsNullOrWhiteSpace(checkpoint!["targetLatex"]!.GetValue<string>()) &&
                    double.IsFinite(checkpoint["targetNumber"]!.GetValue<double>())),
                $"source {source} symbolic target challenge roundtrip keeps kernel target presentation");
        }

        foreach ((int source, string recipe, string newX) in new[]
                 { (74, "QNAHH", "17/10"), (76, "QHNA", "3/2"), (77, "HQNAHH", "1/2") })
        {
            var collision = PlayExtendedPuzzle(source, recipe);
            var added = collision["result"]!["checkpoints"]!.AsArray()
                .Where(checkpoint => checkpoint!["x"]!.GetValue<string>() == newX).ToArray();
            True(added.Length > 0 && added.All(checkpoint => !checkpoint!["hit"]!.GetValue<bool>()),
                $"source {source} new exact checkpoint rejects its former whole-target collision {recipe}");
            Equal(false, collision["result"]!["solved"]!.GetValue<bool>(),
                $"source {source} former collision cannot solve after checkpoint strengthening");
        }
        var radicalGuide = PlayExtendedPuzzle(76, witnesses[76])["result"]!["heightGuide"]!.AsObject();
        Equal("1", radicalGuide["fromX"]!.GetValue<string>(),
            "certified algebraic ordering retains the first rational minimum around a radical target");
        Equal("2", radicalGuide["toX"]!.GetValue<string>(),
            "certified algebraic ordering identifies the rational maximum above a radical target");
        Equal("1/2", radicalGuide["target"]!.GetValue<string>(),
            "radical target between the extrema leaves the exact guide gap unchanged");
        var source76Radical = PlayExtendedPuzzle(76, witnesses[76])["result"]!["checkpoints"]!.AsArray()
            .Single(checkpoint => checkpoint!["x"]!.GetValue<string>() == "3/2")!.AsObject();
        Contains(source76Radical["targetLatex"]!.GetValue<string>(), @"\sqrt{2}",
            "algebraic checkpoint target LaTeX comes from the kernel exact constant");

        var clamped = Act(partial["state"]!, new JsonObject { ["type"] = "source", ["sourceId"] = 5 });
        Equal("2", clamped["state"]!["crop"]!["to"]!.GetValue<string>(),
            "source changes clamp a retained Crop to the new endpoint");
        var changedSource = Act(partial["state"]!, new JsonObject { ["type"] = "source", ["sourceId"] = 2 });
        True(changedSource["result"]!["stages"]![0]!["expression"]!.GetValue<string>() !=
             partial["result"]!["stages"]![0]!["expression"]!.GetValue<string>(),
            "crop-independent stage cache remains separated by source");

        var creationExport = Act(partial["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "creation", ["view"] = "flight"
        });
        var creationImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(creationExport["artifact"]!) }
        });
        Equal("1/2", creationImport["state"]!["crop"]!["from"]!.GetValue<string>(),
            "creation artifact roundtrip preserves exact Crop bounds");

        var challengeExport = Act(partial["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight"
        });
        Equal(1, challengeExport["artifact"]!["goals"]!.AsArray().Count,
            "cropped challenge exports only kept-interval targets");
        var challengeImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(challengeExport["artifact"]!) }
        });
        Equal(false, challengeImport["result"]!["crop"]!["editable"]!.GetValue<bool>(),
            "shared challenge Crop is fixed");
        var changedGoalArtifact = Clone(challengeExport["artifact"]!).AsObject();
        changedGoalArtifact["goals"]![0]!["y"] = "5";
        var changedGoal = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = changedGoalArtifact }
        });
        Equal("5", changedGoal["result"]!["checkpoints"]![0]!["target"]!.GetValue<string>(),
            "cache key keeps distinct shared-challenge goals current");
        Equal(false, changedGoal["result"]!["solved"]!.GetValue<bool>(),
            "changed shared goal is validated against its own target");
        Invalid(new JsonObject
        {
            ["state"] = Clone(challengeImport["state"]!),
            ["action"] = new JsonObject { ["type"] = "crop", ["from"] = "1", ["to"] = "3" }
        }, "shared challenge Crop edit rejection");

        var forged = Clone(Level(1)["state"]!).AsObject();
        forged["crop"] = new JsonObject { ["from"] = "0", ["to"] = "2" };
        Invalid(new JsonObject
        {
            ["state"] = forged, ["action"] = new JsonObject { ["type"] = "evaluate" }
        }, "old authored puzzle rejects forged Crop state");
        Invalid(new JsonObject
        {
            ["state"] = Clone(Remix(43)["state"]!),
            ["action"] = new JsonObject { ["type"] = "crop", ["from"] = "0", ["to"] = "2" }
        }, "parameter circles reject Crop");
    }

    private static void PiecewisePresentationContract()
    {
        var floor = PlayExtendedPuzzle(56, "F")["result"]!.AsObject();
        var floorPaths = floor["paths"]!.AsArray();
        Equal(5, floorPaths.Count, "floor has four half-open steps and its closed endpoint value");
        for (int index = 0; index < 4; index++)
        {
            Equal(true, floorPaths[index]!["startClosed"]!.GetValue<bool>(), "floor step owns its left endpoint");
            Equal(false, floorPaths[index]!["endClosed"]!.GetValue<bool>(), "floor step releases its right endpoint");
        }
        Equal(true, floorPaths[4]!["startClosed"]!.GetValue<bool>(), "floor domain endpoint is closed");
        Equal(true, floorPaths[4]!["endClosed"]!.GetValue<bool>(), "floor endpoint singleton is closed");
        foreach (int boundary in Enumerable.Range(0, 5))
            Equal((double)boundary, PointY(floor["points"]!.AsArray(), boundary),
                $"floor aligned sample owns exact boundary x={boundary}");

        var ceiling = PlayExtendedPuzzle(57, "C")["result"]!.AsObject();
        var ceilingPaths = ceiling["paths"]!.AsArray();
        Equal(5, ceilingPaths.Count, "ceiling has its closed origin plus four left-open steps");
        Equal(1, ceilingPaths[0]!["points"]!.AsArray().Count, "ceiling origin is an exact singleton path");
        for (int index = 1; index < 5; index++)
        {
            Equal(false, ceilingPaths[index]!["startClosed"]!.GetValue<bool>(), "ceiling step releases its left endpoint");
            Equal(true, ceilingPaths[index]!["endClosed"]!.GetValue<bool>(), "ceiling step owns its right endpoint");
        }
        foreach (int boundary in Enumerable.Range(0, 5))
            Equal((double)boundary, PointY(ceiling["points"]!.AsArray(), boundary),
                $"ceiling aligned sample owns exact boundary x={boundary}");

        var reflectedFloor = PlayExtendedPuzzle(58, "NF")["result"]!.AsObject();
        Equal("2", reflectedFloor["checkpoints"]![0]!["actual"]!.GetValue<string>(),
            "negative affine floor owns the left domain endpoint exactly");
        Equal("-2", reflectedFloor["checkpoints"]!.AsArray()[^1]!["actual"]!.GetValue<string>(),
            "negative affine floor owns the right domain endpoint exactly");

        var accumulated = PlayExtendedPuzzle(62, "FSI")["result"]!.AsObject();
        string[] expectedAccumulated = ["0", "0", "1/2", "1", "1", "1", "1/2", "0"];
        Equal(string.Join(',', expectedAccumulated),
            string.Join(',', accumulated["stages"]!.AsArray()[^1]!["values"]!.AsArray().Select(value => value!.GetValue<string>())),
            "piecewise integral accumulates exact signed widths from zero");
        var accumulatedPaths = accumulated["paths"]!.AsArray();
        for (int index = 0; index + 1 < accumulatedPaths.Count; index++)
        {
            var leftPoints = accumulatedPaths[index]!["points"]!.AsArray();
            var rightPoints = accumulatedPaths[index + 1]!["points"]!.AsArray();
            Equal(leftPoints[^1]![1]!.GetValue<double>(), rightPoints[0]![1]!.GetValue<double>(),
                "piecewise accumulated offsets meet continuously at thresholds");
        }

        var incremental62 = Level(62);
        incremental62 = Act(incremental62["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "floor-first", ["op"] = "F", ["index"] = 0
        });
        incremental62 = Act(incremental62["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "sine-second", ["op"] = "S", ["index"] = 1
        });
        Equal(true, incremental62["result"]!["solved"]!.GetValue<bool>(),
            "source 62 accepts the intended incremental floor-then-sine construction");

        var sineFirst62 = Act(Level(62)["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "sine-first", ["op"] = "S", ["index"] = 0
        });
        var roundedSine62 = Act(sineFirst62["state"]!, new JsonObject
        {
            ["type"] = "insert", ["id"] = "floor-after-sine", ["op"] = "F", ["index"] = 1
        });
        Equal("0,0,0,0,-1/2,-1,-3/2,-2",
            string.Join(',', roundedSine62["result"]!["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "source 62 exactly accumulates floor of quarter-turn sine when sine precedes floor");

        var roundedSine = ImportCreation(50, ["S", "F"])["result"]!.AsObject();
        Equal("0,1,0,-1,0", string.Join(',', roundedSine["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "floor of quarter-turn sine preserves exact integer-phase extrema and zeroes");
        foreach ((double x, double y) in new[] { (0.5, 0.0), (1.5, 0.0), (2.5, -1.0), (3.5, -1.0) })
            Equal(y, PointY(roundedSine["points"]!.AsArray(), x),
                $"floor of quarter-turn sine owns exact lobe interior x={x}");

        var ceilingSine = ImportCreation(50, ["S", "C"])["result"]!.AsObject();
        foreach ((double x, double y) in new[] { (0.5, 1.0), (1.5, 1.0), (2.5, 0.0), (3.5, 0.0) })
            Equal(y, PointY(ceilingSine["points"]!.AsArray(), x),
                $"ceiling of quarter-turn sine owns exact lobe interior x={x}");

        var halfSineFloor = ImportCreation(50, ["S", "H", "F"])["result"]!.AsObject();
        var halfSineCeiling = ImportCreation(50, ["S", "H", "C"])["result"]!.AsObject();
        Equal("0,0,0,-1,0", string.Join(',', halfSineFloor["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "scaled quarter-turn sine floor keeps its rational zero cuts");
        Equal("0,1,0,0,0", string.Join(',', halfSineCeiling["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "scaled quarter-turn sine ceiling keeps its rational zero cuts");

        var squaredSineFloor = ImportCreation(50, ["S", "Q", "F"])["result"]!.AsObject();
        var squaredSineCeiling = ImportCreation(50, ["S", "Q", "C"])["result"]!.AsObject();
        Equal("0,1,0,1,0", string.Join(',', squaredSineFloor["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "squared quarter-turn sine floor preserves isolated unit extrema");
        foreach ((double x, double expectedFloor, double expectedCeiling) in new[]
                 { (0.5, 0.0, 1.0), (1.5, 0.0, 1.0), (2.5, 0.0, 1.0), (3.5, 0.0, 1.0) })
        {
            Equal(expectedFloor, PointY(squaredSineFloor["points"]!.AsArray(), x),
                $"squared sine floor interior is exact at x={x}");
            Equal(expectedCeiling, PointY(squaredSineCeiling["points"]!.AsArray(), x),
                $"squared sine ceiling interior is exact at x={x}");
        }

        var boundedSquaredSine = ImportCreation(50, ["S", "Q", "H", "F"])["result"]!.AsObject();
        True(boundedSquaredSine["checkpoints"]!.AsArray().All(checkpoint =>
                checkpoint!["actual"]!.GetValue<string>() == "0"),
            "range-proven half squared sine floors to exact constant zero");
        var boundedSquaredSlope = ImportCreation(50, ["S", "Q", "H", "F", "D"])["result"]!.AsObject();
        True(boundedSquaredSlope["checkpoints"]!.AsArray().All(checkpoint =>
                checkpoint!["actual"]!.GetValue<string>() == "0"),
            "derivative accepts the exact constant produced by bounded squared-sine rounding");

        var negativePhaseFloor = ImportCreation(50, ["N", "S", "F"])["result"]!.AsObject();
        var reflectedSineFloor = ImportCreation(50, ["S", "N", "F"])["result"]!.AsObject();
        Equal("0,-1,0,1,0", string.Join(',', negativePhaseFloor["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "quarter-turn sine rounding supports a negative affine phase");
        foreach (double x in new[] { 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0 })
            Equal(PointY(negativePhaseFloor["points"]!.AsArray(), x),
                PointY(reflectedSineFloor["points"]!.AsArray(), x),
                $"quarter-turn sine rounding treats reflection as the exact negative phase at x={x}");

        var roundedIntegratedAffine = ImportCreation(56, ["F", "I", "F"])["result"]!.AsObject();
        Equal("0,0,0,0,4,6", string.Join(',', roundedIntegratedAffine["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "rounding accepts every rational affine segment produced by exact integration");

        var rightSlope = ImportCreation(57, ["C", "I"])["result"]!.AsObject();
        Equal(1.0, rightSlope["startSlope"]!.GetValue<double>(),
            "start slope uses the interval immediately to the right of a discontinuous origin");

        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = CreationArtifact(50, ["F", "A", "D"]) }
        }, "jump at x = 1", "derivative after transformed rounding identifies its first exact jump");
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = CreationArtifact(50, ["F", "I", "D"]) }
        }, "corner at x = 1", "derivative after one rounding integral identifies its first exact corner");

        foreach (string round in new[] { "F", "C" })
        {
            var roundedConstantDerivative = ImportCreation(50, ["D", round, "D"])["result"]!.AsObject();
            True(roundedConstantDerivative["checkpoints"]!.AsArray().All(checkpoint =>
                    checkpoint!["actual"]!.GetValue<string>() == "0"),
                $"derivative accepts the smooth constant left by D{round}D");
        }
        var roundedConstantAfterSine = ImportCreation(50, ["D", "S", "F", "D"])["result"]!.AsObject();
        True(roundedConstantAfterSine["checkpoints"]!.AsArray().All(checkpoint =>
                checkpoint!["actual"]!.GetValue<string>() == "0"),
            "derivative accepts the exact constant left by DSFD");
        var firstFloorIntegral = ImportCreation(56, ["F", "I"])["result"]!.AsObject();
        var twiceIntegratedDerivative = ImportCreation(56, ["F", "I", "I", "D"])["result"]!.AsObject();
        Equal(string.Join(',', firstFloorIntegral["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            string.Join(',', twiceIntegratedDerivative["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "a second exact integral smooths rounding corners enough for differentiation");
        var firstSineFloorIntegral = ImportCreation(50, ["S", "F", "I"])["result"]!.AsObject();
        var twiceIntegratedSineDerivative = ImportCreation(50, ["S", "F", "I", "I", "D"])["result"]!.AsObject();
        Equal(string.Join(',', firstSineFloorIntegral["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            string.Join(',', twiceIntegratedSineDerivative["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "a second exact integral also smooths rounded-sine corners for differentiation");
        foreach (var (source, recipe, expected) in new (int, string, string)[]
        {
            (50,"QF","0,1,4,9,16"), (50,"QC","0,1,4,9,16"),
            (50,"IF","0,0,2,4,8"), (50,"IC","0,1,2,5,8"),
            (1,"F","0,4,0"), (1,"C","0,4,0"),
            (1,"SF","0,0,0"), (1,"SC","0,0,0"),
            (1,"QF","0,16,0"), (1,"IF","0,5,10")
        })
        {
            var nonlinear=ImportCreation(source,recipe.Select(ch=>ch.ToString()).ToArray())["result"]!.AsObject();
            Equal(expected,string.Join(',',nonlinear["checkpoints"]!.AsArray().Select(point=>point!["actual"]!.GetValue<string>())),
                $"{source}:{recipe} rounds nonlinear exact checkpoint values");
            True(nonlinear["paths"]!.AsArray().Count>0,$"{source}:{recipe} has compiled preview paths");
            foreach (var point in nonlinear["checkpoints"]!.AsArray())
            {
                double px=double.Parse(point!["x"]!.GetValue<string>(),System.Globalization.CultureInfo.InvariantCulture);
                var preview=nonlinear["points"]!.AsArray().First(value=>Math.Abs(value![0]!.GetValue<double>()-px)<1e-12);
                True(Math.Abs(preview![1]!.GetValue<double>()-point["actualNumber"]!.GetValue<double>())<1e-12,
                    $"{source}:{recipe} drawing retains its known exact target reading");
            }
        }
        var roundedRelation=ImportCreation(48,["Q","F"])["result"]!.AsObject();
        True(roundedRelation["relation"]!["playback"]!.AsArray().Count>0,
            "height-squared recipes compile native rounding children without choosing one branch");
        InvalidContains(new JsonObject
        {
            ["action"]=new JsonObject { ["type"]="import",["artifact"]=CreationArtifact(50,["Q","F","I"]) }
        },"exact supported accumulated form","unevaluated nonlinear rounded integral remains an explicit engine limit");
        InvalidContains(new JsonObject
        {
            ["action"] = new JsonObject
            {
                ["type"] = "import",
                ["artifact"] = CreationArtifact(50, ["Q", "D", "Q", "D", "Q", "D", "Q", "D", "F"])
            }
        }, "more than 128 exact segments", "rounding segment guard");
    }

    private static void ExactEqualityContract()
    {
        var piecewise = typeof(Game).Assembly.GetType("Angouri.Kernel.Piecewise", throwOnError: true)!;
        var exactEqual = piecewise.GetMethod("exactEqual",
            System.Reflection.BindingFlags.Static |
            System.Reflection.BindingFlags.Public |
            System.Reflection.BindingFlags.NonPublic)!;
        bool EqualExactly(string left, string right) =>
            (bool)exactEqual.Invoke(null, [MathS.FromString(left), MathS.FromString(right)])!;

        True(EqualExactly("(sqrt(2)+1)^2", "3+2*sqrt(2)"),
            "exact equality retains full symbolic cancellation for a squared radical identity");
        True(EqualExactly("sqrt(8)/2", "sqrt(2)"),
            "exact equality retains full symbolic cancellation across equivalent radicals");
        True(!EqualExactly("sqrt(2)+1/100000000000000000000000000000000000000000", "sqrt(2)"),
            "exact equality rejects a nonzero rational difference below floating precision");
        True(!EqualExactly("1/100000000000000000000000000000000000000000", "0"),
            "exact rational mismatch is decided without numeric rounding");
    }

    private static void HeightSquaredRelationContract()
    {
        using (MathS.Settings.Codomain.Set(Domain.Real))
        {
            Entity.Variable schemaH = "h";
            Entity.Variable schemaRhs = "z_contract";
            var schemaSet = (Entity.Set.FiniteSet)(schemaH.Pow(2) - schemaRhs).Simplify().SolveEquation(schemaH);
            var schema = schemaSet.Elements
                .Select(branch => branch.Simplify())
                .Select(branch => (Branch: branch, Domain: branch.DomainConditionIn(Domain.Real).Simplify()))
                .ToList();

            List<(Entity Branch, Entity Domain)> InstantiateSchema(Entity rhs) => schema
                .Select(item =>
                {
                    Entity branch = item.Branch.Substitute(schemaRhs, rhs).Simplify();
                    Entity domain = item.Domain.Substitute(schemaRhs, rhs).Simplify();
                    return (Branch: branch, Domain: domain);
                })
                .Where(item => item.Domain.ToString() != "False")
                .DistinctBy(item => (item.Branch.ToString(), item.Domain.ToString()))
                .ToList();

            foreach (string rhsText in new[]
                     {
                         "4", "1/4", "x^2", "(x-1)^2", "sin(pi*x/2)+1",
                         // Representative expressions from separate piecewise intervals.
                         "x-1", "2-x"
                     })
            {
                Entity rhs = MathS.FromString(rhsText);
                var directSet = (Entity.Set.FiniteSet)(schemaH.Pow(2) - rhs).Simplify().SolveEquation(schemaH);
                var direct = directSet.Elements
                    .Select(branch => branch.Simplify())
                    .Select(branch => (Branch: branch, Domain: branch.DomainConditionIn(Domain.Real).Simplify()))
                    .DistinctBy(item => (item.Branch.ToString(), item.Domain.ToString()))
                    .ToList();
                var instantiated = InstantiateSchema(rhs);
                Equal(direct.Count, instantiated.Count,
                    $"generic squared-height schema keeps concrete SolveEquation branch count for {rhsText}");
                foreach (var expected in direct)
                    True(instantiated.Any(actual =>
                            ((actual.Branch - expected.Branch).Simplify().ToString() == "0" ||
                             ((actual.Branch.Pow(2) - expected.Branch.Pow(2)).Simplify().ToString() == "0" &&
                              actual.Branch.ToString().StartsWith('-') == expected.Branch.ToString().StartsWith('-'))) &&
                            (actual.Domain.ToString() == expected.Domain.ToString() ||
                             actual.Domain.Solve("x").Simplify().Equals(expected.Domain.Solve("x").Simplify()))),
                        $"generic squared-height schema matches concrete real branch and domain for {rhsText}");
            }

            var zeroBranches = InstantiateSchema(MathS.FromString("0"));
            Equal(1, zeroBranches.Count, "generic squared-height schema deduplicates the zero branch");
            Equal("0", zeroBranches[0].Branch.ToString(), "generic squared-height zero branch is exact");
            var negativeDirect = (schemaH.Pow(2) + 1).Simplify().SolveEquation(schemaH);
            Equal("{  }", negativeDirect.Intersect(MathS.Sets.R).Simplify().ToString(),
                "concrete squared-height solutions have no real branch for a negative RHS");
            Equal(0, InstantiateSchema(MathS.FromString("-1")).Count,
                "generic squared-height schema filters branches whose real domain is false");
        }

        var openRelation = Level(48)["result"]!["relation"]!.AsObject();
        CheckJoinedOpenFlight(openRelation);

        var shiftedSquare = PlayExtendedPuzzle(48, "AQ")["result"]!.AsObject();
        string expectedShiftedSquare = MathS.FromString("((x - 2) + 1)^2").Simplify().Latexize();
        Equal(expectedShiftedSquare, shiftedSquare["stages"]!.AsArray()[^1]!["latex"]!.GetValue<string>(),
            "implicit AQ stage uses AngouriMath full simplification");
        Equal($"h^{{2}} = {expectedShiftedSquare}", shiftedSquare["relation"]!["equationLatex"]!.GetValue<string>(),
            "implicit AQ final equation reuses the fully simplified stage");
        Equal("4,1,0,1", string.Join(',', shiftedSquare["checkpoints"]!.AsArray()
                .Select(checkpoint => checkpoint!["actual"]!.GetValue<string>())),
            "display simplification leaves AQ exact relation heights unchanged");
        Contains(shiftedSquare["constructedLatex"]!.GetValue<string>(), @"x-2+1",
            "AQ constructed equation retains the unsimplified operation order");

        var multiSegment = ImportCreation(56, ["F", "I", "A", "Q"])["result"]!.AsObject();
        string multiSegmentLatex = multiSegment["stages"]!.AsArray()[^1]!["latex"]!.GetValue<string>();
        foreach (string branch in new[]
                 {
                     "1", "x^2", "(2*x-3+1)^2", "(3*x-6+1)^2"
                 }.Select(expression => MathS.FromString(expression).Simplify().Latexize()))
            Contains(multiSegmentLatex, branch, "every piecewise branch uses AngouriMath full simplification");
        True(!multiSegmentLatex.Contains("-1+1", StringComparison.Ordinal) &&
             !multiSegmentLatex.Contains("-3+1", StringComparison.Ordinal) &&
             !multiSegmentLatex.Contains("-6+1", StringComparison.Ordinal),
            "piecewise display combines constants on every branch");

        var loopResponse = PlayExtendedPuzzle(48, "QNA");
        var loop = loopResponse["result"]!.AsObject();
        var relation = loop["relation"]!.AsObject();
        Equal("height-squared", relation["kind"]!.GetValue<string>(), "implicit relation kind");
        True(relation["equationLatex"]!.GetValue<string>().StartsWith("h^{2} =", StringComparison.Ordinal),
            "implicit simplified equation preserves the squared-height left side");
        string solvedLatex = relation["solvedLatex"]!.GetValue<string>();
        True(solvedLatex.StartsWith(@"\begin{cases}h =", StringComparison.Ordinal),
            "implicit relation supplies explicit solved branches for h");
        var solvedLines = relation["solvedLines"]!.AsArray();
        True(solvedLines.Count >= 2 && solvedLines.All(line =>
                !string.IsNullOrWhiteSpace(line!["heightLatex"]!.GetValue<string>()) &&
                !string.IsNullOrWhiteSpace(line["conditionLatex"]!.GetValue<string>())),
            "implicit relation supplies complete height and condition lines");
        Equal(solvedLatex,
            @"\begin{cases}" + string.Join(@" \\ ", solvedLines.Select(line =>
                $"{line!["heightLatex"]!.GetValue<string>()} & {line["conditionLatex"]!.GetValue<string>()}")) + @"\end{cases}",
            "structured solved lines and compatibility LaTeX share one solver-derived representation");
        using (MathS.Settings.Codomain.Set(Domain.Real))
        {
            Entity.Variable expectedH = "h";
            Entity.Variable expectedRhs = "w";
            Entity rhs = MathS.FromString("1 - (x - 2)^2").Simplify();
            var solverSchema = (Entity.Set.FiniteSet)(expectedH.Pow(2) - expectedRhs).Simplify().SolveEquation(expectedH);
            foreach (Entity schemaBranch in solverSchema.Elements)
            {
                Entity simplifiedSchema = schemaBranch.Simplify();
                Entity simplifiedBranch = simplifiedSchema.Substitute(expectedRhs, rhs).Simplify();
                Contains(solvedLatex, simplifiedBranch.Latexize(),
                    "solved relation instantiates an AngouriMath SolveEquation schema branch");
                Entity realDomain = simplifiedSchema.DomainConditionIn(Domain.Real)
                    .Substitute(expectedRhs, rhs).Simplify();
                if (realDomain.ToString() != "True")
                    Contains(solvedLatex, realDomain.Latexize(),
                        "solved relation includes each solver-schema branch's real-domain condition");
            }
        }
        Contains(solvedLatex, @"0 \le x \le 4", "solved relation includes the authored interval");
        True(!solvedLatex.Contains("q =", StringComparison.Ordinal),
            "solved relation does not introduce an undefined q variable");
        Equal(1.0, PointY(loop["points"]!.AsArray(), 2.0),
            "ordinary result points remain the squared-height right side");
        True(relation["playback"]!.AsArray().Any(point =>
                Math.Abs(point![0]!.GetValue<double>() - 2.0) < 1e-12 &&
                Math.Abs(point[1]!.GetValue<double>() - 1.0) < 1e-12),
            "implicit playback contains the upper square-root branch");
        True(relation["playback"]!.AsArray().Any(point =>
                Math.Abs(point![0]!.GetValue<double>() - 2.0) < 1e-12 &&
                Math.Abs(point[1]!.GetValue<double>() + 1.0) < 1e-12),
            "implicit playback contains the lower square-root branch");
        True(relation["playback"]!.AsArray().Any(point =>
                Math.Abs(point![0]!.GetValue<double>() - 1.0) < 1e-12 && Math.Abs(point[1]!.GetValue<double>()) < 1e-12) &&
             relation["playback"]!.AsArray().Any(point =>
                Math.Abs(point![0]!.GetValue<double>() - 3.0) < 1e-12 && Math.Abs(point[1]!.GetValue<double>()) < 1e-12),
            "implicit quadratic paths include their exact zeroes");
        Equal(0, relation["breaks"]!.AsArray().Count,
            "a closed solved relation has no artificial playback break");
        var loopPlayback = relation["playback"]!.AsArray();
        Equal(3.0, loopPlayback[0]![0]!.GetValue<double>(),
            "closed playback starts at the first authored target position");
        Equal(0.0, loopPlayback[0]![1]!.GetValue<double>(),
            "closed playback starts on the first authored target vertex");
        Equal(loopPlayback[0]![0]!.GetValue<double>(), loopPlayback[^1]![0]!.GetValue<double>(),
            "closed playback ends at its starting x coordinate");
        Equal(loopPlayback[0]![1]!.GetValue<double>(), loopPlayback[^1]![1]!.GetValue<double>(),
            "closed playback finishes its full loop");
        var loopChords = PlaybackChordLengths(relation);
        True(loopChords.All(distance => distance > 1e-9),
            "closed playback removes duplicate interior seam samples");
        True(loopChords.Max() < 0.06 && loopChords.Max() / loopChords.Min() < 1.02,
            "closed playback is densely and uniformly paced by chord length");

        var checkpoints = loop["checkpoints"]!.AsArray();
        Equal("3,2,1,2", string.Join(',', checkpoints.Select(checkpoint => checkpoint!["x"]!.GetValue<string>())),
            "implicit relation preserves authored target order and repeated x positions");
        foreach (var checkpointNode in checkpoints)
        {
            var checkpoint = checkpointNode!.AsObject();
            Equal(checkpoint["lhs"]!.GetValue<string>(), checkpoint["rhs"]!.GetValue<string>(),
                "implicit checkpoint compares authored height squared with q(x)");
            Equal(checkpoint["rhs"]!.GetValue<string>(), checkpoint["actual"]!.GetValue<string>(),
                "implicit checkpoint actual is q(x)");
        }
        True(checkpoints[1]!["phase"]!.GetValue<double>() != checkpoints[3]!["phase"]!.GetValue<double>(),
            "upper and lower targets at one x receive distinct nearest playback phases");

        var shiftedRelation = shiftedSquare["relation"]!.AsObject();
        Equal(1, shiftedRelation["breaks"]!.AsArray().Count,
            "height solutions touching at an interior point retain separate flights");
        CheckSignedSquareFlights(shiftedRelation, x => x - 1, 1, "AQ crossing");
        var shiftedPlayback = shiftedRelation["playback"]!.AsArray();
        Equal(0.0, shiftedPlayback[0]![0]!.GetValue<double>(),
            "an open height solution launches from its left endpoint, not an interior checkpoint");
        True(shiftedPlayback.Any(point =>
                Math.Abs(point![0]!.GetValue<double>() - 1.0) < 1e-12 &&
                Math.Abs(point[1]!.GetValue<double>()) < 1e-12),
            "AQ playback joins both solved branches at the exact zero");
        var shiftedChords = PlaybackChordLengths(shiftedRelation);
        True(shiftedChords.All(distance => distance > 1e-9),
            "AQ playback follows each height solution without duplicate samples");
        True(shiftedChords.Max() / shiftedChords.Min() < 1.02,
            "AQ height solutions remain uniformly paced without retracing");

        var intersectingParabolas = PlayExtendedPuzzle(70, "Q")["result"]!["relation"]!.AsObject();
        CheckSignedSquareFlights(intersectingParabolas, x => (x - 2) * (x - 2) - 1, 2,
            "source 70 Q intersecting parabolas");
        foreach (var flight in intersectingParabolas["flights"]!.AsArray())
        {
            var points = intersectingParabolas["playback"]!.AsArray();
            int start = flight![0]!.GetValue<int>(), end = flight[1]!.GetValue<int>();
            foreach (double rootX in new[] { 1.0, 3.0 })
                True(points.Skip(start).Take(end - start + 1).Any(point =>
                        Math.Abs(point![0]!.GetValue<double>() - rootX) < 1e-12 &&
                        Math.Abs(point[1]!.GetValue<double>()) < 1e-12),
                    $"source 70 Q flight passes through exact crossing x={rootX}");
        }

        var tangentialFourthPower = ImportCreation(48, ["A", "Q", "Q"])["result"]!["relation"]!.AsObject();
        CheckSignedSquareFlights(tangentialFourthPower, x => (x - 1) * (x - 1), 0,
            "fourth-power tangential touch");

        var shiftedOffGrid = ImportCreation(48, ["Q", "H", "N", "A", "Q"])["result"]!["relation"]!.AsObject();
        CheckSignedSquareFlights(shiftedOffGrid, x => 1 - (x - 2) * (x - 2) / 2, 2,
            "off-grid algebraic crossings");

        var sineSquared = ImportCreation(48, ["S", "Q"])["result"]!["relation"]!.AsObject();
        CheckSignedSquareFlights(sineSquared, x => Math.Sin(Math.PI * (x - 2) / 2), 1,
            "sine-squared crossings");

        var scaledSquare = ImportCreation(48, ["A", "Q", "H"])["result"]!["relation"]!.AsObject();
        CheckSignedSquareFlights(scaledSquare, x => (x - 1) / Math.Sqrt(2), 1,
            "positive scaled square");

        var roundedSquare = ImportCreation(48, ["F", "Q"])["result"]!["relation"]!.AsObject();
        CheckHeightFlights(roundedSquare, 2);
        True(roundedSquare["breaks"]!.AsArray().Count > 1,
            "rounded squared height keeps its real jump gaps within each height solution");

        var empty = PlayExtendedPuzzle(48, "QAN")["result"]!.AsObject();
        Equal(0, empty["relation"]!["paths"]!.AsArray().Count,
            "negative squared-height right side is a valid empty locus");
        Equal(0, empty["relation"]!["playback"]!.AsArray().Count,
            "empty locus has no relation playback");
        var emptySolvedLines = empty["relation"]!["solvedLines"]!.AsArray();
        True(emptySolvedLines.All(line =>
                !line!["heightLatex"]!.GetValue<string>().Contains('i') &&
                line["conditionLatex"]!.GetValue<string>().Contains(@"\geq")),
            "negative-locus solved rows remain real branches guarded by exact domain conditions");
        Equal(false, empty["solved"]!.GetValue<bool>(), "empty locus remains an editable unsolved state");

        var zeroRelation = ImportCreation(48, ["D", "D"])["result"]!["relation"]!.AsObject();
        var zeroSolvedLines = zeroRelation["solvedLines"]!.AsArray();
        Equal(1, zeroSolvedLines.Count, "identically zero squared-height relation has one solved row");
        Equal("h = 0", zeroSolvedLines[0]!["heightLatex"]!.GetValue<string>(),
            "identically zero squared-height relation deduplicates its coincident branches");
        var negativeConstantRelation = ImportCreation(48, ["D", "D", "A", "N"])["result"]!["relation"]!.AsObject();
        var negativeConstantLines = negativeConstantRelation["solvedLines"]!.AsArray();
        Equal(1, negativeConstantLines.Count, "negative constant squared-height relation has one empty real solution row");
        Equal(@"h \in \varnothing", negativeConstantLines[0]!["heightLatex"]!.GetValue<string>(),
            "negative constant squared-height relation never displays complex branches as real heights");

        var mixed = PlayExtendedPuzzle(67, "DAHFSINAQNAQ")["result"]!.AsObject();
        Equal(10, mixed["checkpoints"]!.AsArray().Count, "mixed implicit finale checks all ten targets");
        True(mixed["relation"]!["paths"]!.AsArray().Count >= 2,
            "mixed implicit finale retains separated real-locus paths");
        Equal(1, mixed["relation"]!["breaks"]!.AsArray().Count,
            "mixed implicit playback keeps two solutions instead of retracing their shared zero tails");
        CheckHeightFlights(mixed["relation"]!.AsObject(), 2);
        string mixedSolvedLatex = mixed["relation"]!["solvedLatex"]!.GetValue<string>();
        Contains(mixedSolvedLatex, @"0 \le x \le 1", "multi-segment solution includes its first exact interval");
        Contains(mixedSolvedLatex, @"1 \le x \le 3", "multi-segment solution includes its central exact interval");
        True(CountOccurrences(mixedSolvedLatex, "h =") >= 4,
            "multi-segment solution exposes every solver branch");

        var initialMixedRelation = Level(67)["result"]!["relation"]!.AsObject();
        CheckJoinedOpenFlight(initialMixedRelation);

        var disconnected = PlayExtendedPuzzle(49, "HQNAN")["result"]!["relation"]!.AsObject();
        Equal(1, disconnected["breaks"]!.AsArray().Count,
            "two disconnected real components have only the inter-flight break");
        Equal(2, disconnected["flights"]!.AsArray().Count,
            "each disconnected real component gets one complete flight");
        var disconnectedPlayback = disconnected["playback"]!.AsArray();
        var componentOuterXs = new HashSet<double>();
        foreach (var flight in disconnected["flights"]!.AsArray())
        {
            int start = flight![0]!.GetValue<int>(), end = flight[1]!.GetValue<int>();
            double startX = disconnectedPlayback[start]![0]!.GetValue<double>();
            double endX = disconnectedPlayback[end]![0]!.GetValue<double>();
            Equal(startX, endX, "a component launches and lands at its two outer branch endpoints");
            True(disconnectedPlayback[start]![1]!.GetValue<double>() *
                 disconnectedPlayback[end]![1]!.GetValue<double>() < 0,
                "a component traverses both height signs through its shared tip");
            Equal(1, disconnectedPlayback.Skip(start + 1).Take(end - start - 1)
                    .Count(point => Math.Abs(point![1]!.GetValue<double>()) < 1e-12),
                "a disconnected component visits its one shared tip exactly once");
            componentOuterXs.Add(startX);
        }
        True(componentOuterXs.SetEquals([0.0, 4.0]),
            "the two component flights launch from the left and right outer endpoints");
        True(PlaybackChordLengths(disconnected).Max() < 0.08,
            "neither component teleports across the negative squared-height gap");

        var loopExport = Act(loopResponse["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "function"
        });
        var exportedGoals = loopExport["artifact"]!["goals"]!.AsArray();
        Equal("0,1,0,-1", string.Join(',', exportedGoals.Select(goal => goal!["y"]!.GetValue<string>())),
            "implicit challenge export preserves authored upper and lower target signs");
        var loopImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(loopExport["artifact"]!) }
        });
        JsonObject replayedLoop = loopImport;
        for (int index = 0; index < 3; index++)
            replayedLoop = Act(replayedLoop["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"relation-replay-{index}",
                ["op"] = "QNA"[index].ToString(), ["index"] = index
            });
        Equal(true, replayedLoop["result"]!["solved"]!.GetValue<bool>(),
            "implicit challenge export round-trips and accepts the original construction as a witness");

        var mixedResponse = PlayExtendedPuzzle(67, "DAHFSINAQNAQ");
        var mixedExport = Act(mixedResponse["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight"
        });
        Equal(10, mixedExport["artifact"]!["goals"]!.AsArray().Count,
            "mixed implicit challenge export retains all ten authored heights");

        JsonObject initialLoop = Level(48);
        InvalidContains(new JsonObject
        {
            ["state"] = Clone(initialLoop["state"]!),
            ["action"] = new JsonObject { ["type"] = "export", ["kind"] = "challenge", ["view"] = "flight" }
        }, "no real height", "implicit challenge rejects a negative squared height");
        JsonObject radicalWave = Level(54);
        var radicalExport = Act(radicalWave["state"]!, new JsonObject
        {
            ["type"] = "export", ["kind"] = "challenge", ["view"] = "function"
        });
        var radicalImport = Ok(new JsonObject
        {
            ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = Clone(radicalExport["artifact"]!) }
        });
        Equal(radicalExport["artifact"]!["goals"]!.ToJsonString(),
            radicalImport["state"]!["goals"]!.ToJsonString(),
            "explicit challenge artifacts round-trip exact radical checkpoint heights");
        True(radicalImport["state"]!["goals"]!.AsArray().Any(goal =>
                goal!["y"]!.GetValue<string>().Contains("sqrt", StringComparison.Ordinal)),
            "explicit challenge artifact keeps a symbolic radical rather than a numeric approximation");
        True(radicalImport["result"]!["checkpoints"]!.AsArray().All(checkpoint =>
                !string.IsNullOrWhiteSpace(checkpoint!["targetLatex"]!.GetValue<string>()) &&
                double.IsFinite(checkpoint["targetNumber"]!.GetValue<double>())),
            "continuous symbolic challenge checkpoints expose kernel target presentation");
    }

    private static double PointY(JsonArray points, double x) =>
        points.Single(point => Math.Abs(point![0]!.GetValue<double>() - x) < 1e-12)![1]!.GetValue<double>();

    private static void CheckJoinedOpenFlight(JsonObject relation)
    {
        var points=relation["playback"]!.AsArray();
        var flights=relation["flights"]!.AsArray();
        Equal(1,flights.Count,"two height branches with one shared endpoint form one open flight");
        Equal(0,relation["breaks"]!.AsArray().Count,"a joined open flight has no teleport break");
        Equal(0,flights[0]![0]!.GetValue<int>(),"the joined open flight owns the first playback point");
        Equal(points.Count-1,flights[0]![1]!.GetValue<int>(),"the joined open flight owns the last playback point");
        var zeroIndices=points.Select((point,index)=>(point,index))
            .Where(item=>Math.Abs(item.point![1]!.GetValue<double>())<1e-12)
            .Select(item=>item.index).ToArray();
        Equal(1,zeroIndices.Length,"joined branches visit their only shared endpoint once");
        int shared=zeroIndices[0];
        True(shared>0&&shared<points.Count-1,"the shared endpoint lies inside playback, not at its launch");
        double startX=points[0]![0]!.GetValue<double>(),endX=points[^1]![0]!.GetValue<double>();
        Equal(startX,endX,"the joined path starts and ends at the two outer endpoints");
        True(points[0]![1]!.GetValue<double>()*points[^1]![1]!.GetValue<double>()<0,
            "the joined path finishes on the opposite solved height branch");
        for(int index=1;index<=shared;index++)
            True(points[index]![0]!.GetValue<double>()<=points[index-1]![0]!.GetValue<double>()+1e-9,
                "the first half travels from its outer endpoint to the shared endpoint without backtracking");
        for(int index=shared+1;index<points.Count;index++)
            True(points[index]![0]!.GetValue<double>()+1e-9>=points[index-1]![0]!.GetValue<double>(),
                "the second half travels from the shared endpoint to its outer endpoint without backtracking");
        var chords=PlaybackChordLengths(relation);
        True(chords.All(distance=>distance>1e-9),"joined open playback has no duplicate seam or retraced edge");
    }

    private static void CheckHeightFlights(JsonObject relation, int count)
    {
        var points=relation["playback"]!.AsArray();
        var flights=relation["flights"]!.AsArray();
        Equal(count,flights.Count,"kernel groups playback by height solution");
        int next=0;
        foreach(var flight in flights)
        {
            int start=flight![0]!.GetValue<int>(),end=flight[1]!.GetValue<int>();
            Equal(next,start,"height flights partition the shared clock without omissions");
            int sign=0;
            for(int index=start;index<=end;index++)
            {
                double x=points[index]![0]!.GetValue<double>(),height=points[index]![1]!.GetValue<double>();
                if(index>start)True(x+1e-9>=points[index-1]![0]!.GetValue<double>(),"one height solution never bounces back along x");
                if(Math.Abs(height)>1e-9)
                {
                    if(sign==0)sign=Math.Sign(height);
                    Equal(sign,Math.Sign(height),"one cucumber never switches its solved height branch at a zero");
                }
            }
            next=end+1;
        }
        Equal(points.Count,next,"all playback belongs to a height solution");
    }

    private static void CheckSignedSquareFlights(
        JsonObject relation, Func<double, double> signedRoot, int expectedSignChanges, string label)
    {
        var points = relation["playback"]!.AsArray();
        var flights = relation["flights"]!.AsArray();
        Equal(2, flights.Count, $"{label} keeps the two smooth analytic height curves separate");
        Equal(1, relation["breaks"]!.AsArray().Count,
            $"{label} teleports only between its two complete curves");
        var orientations = new HashSet<int>();
        int next = 0;
        foreach (var flight in flights)
        {
            int start = flight![0]!.GetValue<int>(), end = flight[1]!.GetValue<int>();
            Equal(next, start, $"{label} flight ranges partition playback");
            True(end > start, $"{label} flight contains a complete curve");
            int orientation = 0;
            int previousSign = 0, signChanges = 0;
            for (int index = start; index <= end; index++)
            {
                double x = points[index]![0]!.GetValue<double>();
                double actual = points[index]![1]!.GetValue<double>();
                double representative = signedRoot(x);
                if (index > start)
                    True(x + 1e-9 >= points[index - 1]![0]!.GetValue<double>(),
                        $"{label} traces each analytic curve from left to right without retracing");
                if (orientation == 0 && Math.Abs(representative) > 1e-6)
                    orientation = Math.Sign(actual * representative);
                if (orientation != 0)
                {
                    double expected = orientation * representative;
                    True(Math.Abs(actual - expected) < 0.004,
                        $"{label} playback stays on one signed representative at x={x}");
                    True(Math.Abs(actual * actual - representative * representative) < 0.025,
                        $"{label} playback sample satisfies the squared-height equation at x={x}");
                }
                int sign = Math.Abs(actual) < 1e-6 ? 0 : Math.Sign(actual);
                if (sign != 0)
                {
                    if (previousSign != 0 && sign != previousSign) signChanges++;
                    previousSign = sign;
                }
            }
            True(orientation != 0, $"{label} has a nonzero signed representative");
            orientations.Add(orientation);
            Equal(expectedSignChanges, signChanges,
                $"{label} crosses zero according to its analytic representative instead of taking an absolute-value cusp");
            next = end + 1;
        }
        Equal(points.Count, next, $"{label} assigns every playback point to a flight");
        True(orientations.SetEquals([-1, 1]), $"{label} traces both opposite signed representatives");
    }

    private static List<double> PlaybackChordLengths(JsonObject relation)
    {
        var playback = relation["playback"]!.AsArray();
        var breaks = relation["breaks"]!.AsArray()
            .Select(node => node!.GetValue<int>()).ToHashSet();
        var distances = new List<double>();
        for (int index = 1; index < playback.Count; index++)
        {
            if (breaks.Contains(index)) continue;
            double dx = playback[index]![0]!.GetValue<double>() - playback[index - 1]![0]!.GetValue<double>();
            double dy = playback[index]![1]!.GetValue<double>() - playback[index - 1]![1]!.GetValue<double>();
            distances.Add(Math.Sqrt(dx * dx + dy * dy));
        }
        return distances;
    }

    private static void CheckResultShape(int level, JsonObject result, IReadOnlyList<string> ops)
    {
        True(!string.IsNullOrWhiteSpace(result["constructedLatex"]!.GetValue<string>()),
            $"level {level} constructed equation is nonempty");
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
        Contains(challengeRangeFailure["message"]!.GetValue<string>(), "Checkpoint height", "challenge export identifies the checkpoint field");
        Contains(challengeRangeFailure["message"]!.GetValue<string>(), "supported challenge range", "challenge export explains the supported range");
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

        foreach ((string value, string label) in new[]
                 { ("1000001", "oversized rational challenge height"),
                   ("sqrt(1000002000001)", "oversized algebraic challenge height"),
                   ("x", "variable challenge height"),
                   ("sqrt(-1)", "non-real challenge height"),
                   (new string('1', 257), "overlong symbolic challenge height") })
        {
            var invalidGoal = Clone(emptyExport["artifact"]!).AsObject();
            invalidGoal["goals"]![0]!["y"] = value;
            Invalid(new JsonObject
            {
                ["action"] = new JsonObject { ["type"] = "import", ["artifact"] = invalidGoal }
            }, label);
        }

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
        if (Stations.TryGetValue(sourceId, out var station))
        {
            int stationIndex = -1;
            for (int index = 0; index < ops.Count; index++)
                if (ops[index] == station.Op)
                {
                    if (stationIndex >= 0) throw new InvalidOperationException($"ambiguous fixed station recipe for level {sourceId}");
                    stationIndex = index;
                }
            if (stationIndex < 0) throw new InvalidOperationException($"fixed station recipe for level {sourceId} omits {station.Op}");
            for (int index = 0; index < stationIndex; index++)
                response = Act(response["state"]!, new JsonObject
                {
                    ["type"] = "insert", ["id"] = $"played-{index}", ["op"] = ops[index], ["index"] = index
                });
            for (int index = stationIndex + 1; index < ops.Count; index++)
                response = Act(response["state"]!, new JsonObject
                {
                    ["type"] = "insert", ["id"] = $"played-{index}", ["op"] = ops[index],
                    ["index"] = response["state"]!["nodes"]!.AsArray().Count
                });
        }
        else
        {
            for (int index = 0; index < ops.Count; index++)
                response = Act(response["state"]!, new JsonObject
                {
                    ["type"] = "insert", ["id"] = $"played-{index}", ["op"] = ops[index], ["index"] = index
                });
        }
        return response;
    }

    private static JsonObject PlayExtendedPuzzle(int sourceId, string witness)
    {
        JsonObject response = Level(sourceId);
        string? stationOp = response["state"]!["station"]?["op"]?.GetValue<string>();
        bool stationPlaced = false;
        for (int index = 0; index < witness.Length; index++)
        {
            string op = witness[index].ToString();
            if (!stationPlaced && stationOp == op)
            {
                stationPlaced = true;
                continue;
            }
            response = Act(response["state"]!, new JsonObject
            {
                ["type"] = "insert", ["id"] = $"extended-{sourceId}-{index}", ["op"] = op, ["index"] = index
            });
        }
        if (stationOp is not null)
            True(stationPlaced, $"extended source {sourceId} witness contains fixed {stationOp} station");
        if (sourceId is 72 or 73 or 76)
            response = Act(response["state"]!, new JsonObject
            {
                ["type"] = "crop",
                ["from"] = sourceId == 72 ? "0" : "1",
                ["to"] = sourceId == 72 ? "2" : "3"
            });
        return response;
    }

    private static JsonObject CircleRequest(JsonNode state, string x, string y, string radius) => new()
    {
        ["state"] = Clone(state),
        ["action"] = new JsonObject
        {
            ["type"] = "circle", ["x"] = x, ["y"] = y, ["radius"] = radius
        }
    };

    private static JsonObject SetCircle(JsonNode state, string x, string y, string radius) =>
        Ok(CircleRequest(state, x, y, radius));

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

    private static int CountOccurrences(string value, string fragment)
    {
        int count = 0;
        for (int index = 0; (index = value.IndexOf(fragment, index, StringComparison.Ordinal)) >= 0;
             index += fragment.Length)
            count++;
        return count;
    }

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
            29 or 30 => [-1, new Fraction(3, 2), new Fraction(-3, 4), new Fraction(1, 8)],
            31 or 36 or 39 => [4, -4, 1],
            32 => [1, -1, new Fraction(1, 4)],
            33 or 34 => [-2, 1],
            35 => [0, 1, new Fraction(-1, 4)],
            37 => [1],
            38 or 40 => [2, -1],
            41 => [1, 2, new Fraction(-1, 2)],
            42 => [12, -12, 3],
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
        public static Fraction operator -(Fraction a, Fraction b) => a + -b;
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
