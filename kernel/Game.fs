namespace Angouri.Kernel

open System
open System.Text
open System.Text.Json.Nodes
open System.Text.RegularExpressions
open System.Text.Json
open System.Numerics
open System.Collections.Generic
open System.Reflection
open AngouriMath.Core
open AngouriMath.Core.Budgets
open AngouriMath

module Game =
    // Keep field diagnostics on the exception, but send only the authored message to players.
    type private InvalidInput(field: string, message: string) =
        inherit ArgumentException(message, field)
        member _.UserMessage = message
    let private invalidInput field message = raise (InvalidInput(field, message))
    let rules = "vine-1"
    let engine = "AngouriMath-2.5.0"
    let operations = [ "H"; "A"; "N"; "Q"; "D"; "I"; "S"; "F"; "C" ]
    let maxNodes = 64
    let maxDegree = 32
    let maxSegments = 128
    let maxExactDigits = 128
    let maxPreviewMagnitude = 10000000.
    let maxTargetMagnitude = 1000000.
    type Node = { Id: string; Op: string }
    type Station = { Id: string; Op: string; Before: int; After: int }
    type Goal = { X: string; Y: string }
    type Circle = { X: string; Y: string; Radius: string }
    type Crop = { From: string; To: string }
    type CircleDefinition = { Initial: Circle; Editable: string list }
    [<CLIMutable>]
    type ExtendedGoal = { x: string; y: string }
    [<CLIMutable>]
    type ExtendedStation = { id: string; op: string; before: int; after: int }
    [<CLIMutable>]
    type ExtendedCrop = { from: string; ``to``: string; targetFrom: string; targetTo: string }
    [<CLIMutable>]
    type ExtendedPuzzle = {
        id: int
        source: string
        degree: int
        endpoint: int
        targets: ExtendedGoal array
        inventory: Dictionary<string,int>
        limit: int
        station: ExtendedStation
        relation: string
        crop: ExtendedCrop
        outline: string
    }
    type State = {
        Source: int
        Mode: string
        Nodes: Node list
        Goals: Goal list
        Inventory: Map<string,int>
        Limit: int
        Station: Station option
        Circle: Circle option
        Crop: Crop option
    }
    let private baseSources = [|
        "x * (4 - x)"; "x * (4 - x) / 2"; "x * (4 - x)"; "x - 2"; "x^3"
        "-x * (4 - x) / 2"; "x - 2"; "(x - 2)^2 / 4"; "(x - 2)^2"; "x - 2"
        "x - 2"; "(x - 2)^2 / 4"; "(x - 2)^2 / 4"
        "(x - 2)^2 / 4"; "(x - 2)^3 / 3 + 2"
        "1"; "2 - x"; "(x - 2)^3 / 2"
        "2 - x"; "1"; "1 + x * (4 - x) / 2"
        "(x - 2)^3 / 3 + 2"; "3 * (x - 2)^2 / 8"
        "x * (4 - x)"; "x * (4 - x)"; "(x - 2)^2 + 1"; "x - 2"; "x - 2"
        "(x - 2)^3 / 8"; "(x - 2)^3 / 8"; "(x - 2)^2"
        "(x - 2)^2 / 4"; "x - 2"; "x - 2"; "1 - (x - 2)^2 / 4"; "(x - 2)^2"
        "1"; "2 - x"; "(x - 2)^2"; "2 - x"; "1 + x * (4 - x) / 2"; "3 * (x - 2)^2"
        "0"; "0"; "0"; "0"; "0" |]
    let private baseTargets = [|
        [ "0", "0"; "2", "2"; "4", "0" ]
        [ "0", "1"; "2", "3"; "4", "1" ]
        [ "0", "1/2"; "2", "5/2"; "4", "1/2" ]
        [ "0", "0"; "1", "3/4"; "2", "1"; "3", "3/4"; "4", "0" ]
        [ "0", "1"; "1", "5/2"; "2", "7" ]
        [ "0", "0"; "2", "2"; "4", "0" ]
        [ "0", "4"; "1", "1"; "2", "0"; "3", "1"; "4", "4" ]
        [ "0", "0"; "1", "3/4"; "2", "1"; "3", "3/4"; "4", "0" ]
        [ "0", "-1"; "1", "1/2"; "2", "1"; "3", "1/2"; "4", "-1" ]
        [ "0", "1"; "1", "1/4"; "2", "0"; "3", "1/4"; "4", "1" ]
        [ "0", "-2"; "1", "7/4"; "2", "2"; "3", "7/4"; "4", "-2" ]
        [ "0", "1"; "1", "1/16"; "2", "0"; "3", "1/16"; "4", "1" ]
        [ "0", "0"; "1", "15/16"; "2", "1"; "3", "15/16"; "4", "0" ]
        [ "0", "-1"; "2", "0"; "4", "1" ]
        [ "0", "0"; "1", "3/4"; "2", "1"; "3", "3/4"; "4", "0" ]
        [ "0", "0"; "2", "2"; "4", "4" ]
        [ "0", "0"; "2", "1"; "4", "0" ]
        [ "0", "1"; "1", "31/16"; "2", "2"; "3", "31/16"; "4", "1" ]
        [ "0", "0"; "2", "2"; "4", "0" ]
        [ "0", "1"; "2", "3"; "4", "5" ]
        [ "0", "0"; "2", "2"; "4", "0" ]
        [ "0", "0"; "1", "255/256"; "2", "1"; "3", "255/256"; "4", "0" ]
        [ "0", "0"; "1", "63/64"; "2", "1"; "3", "63/64"; "4", "0" ]
        [ "0", "3/4"; "2", "7/4"; "4", "3/4" ]
        [ "0", "13/8"; "2", "17/8"; "4", "13/8" ]
        [ "0", "1/4"; "1", "5/8"; "2", "3/4"; "3", "5/8"; "4", "1/4" ]
        [ "0", "1"; "1", "0"; "2", "1"; "3", "4"; "4", "9" ]
        [ "0", "3/8"; "1", "1/2"; "2", "3/8"; "3", "0"; "4", "-5/8" ]
        [ "0", "1"; "1", "1/64"; "2", "0"; "3", "1/64"; "4", "1" ]
        [ "0", "0"; "1", "63/64"; "2", "1"; "3", "63/64"; "4", "0" ]
        [ "0", "0"; "1", "255/256"; "2", "1"; "3", "255/256"; "4", "0" ]
        [ "0", "0"; "1", "1/2"; "2", "1"; "3", "3/2"; "4", "2" ]
        [ "0", "-4"; "1", "-2"; "2", "0"; "3", "2"; "4", "4" ]
        [ "0", "-2"; "1", "0"; "2", "2"; "3", "4"; "4", "6" ]
        [ "0", "0"; "1", "3/4"; "2", "0"; "3", "-3/4"; "4", "0" ]
        [ "0", "1"; "1", "7/4"; "2", "1"; "3", "1/4"; "4", "1" ]
        [ "0", "0"; "1", "2"; "2", "4"; "3", "6"; "4", "8" ]
        [ "0", "0"; "1", "5/2"; "2", "4"; "3", "9/2"; "4", "4" ]
        [ "0", "0"; "1", "-4/3"; "2", "-2/3"; "3", "0"; "4", "-4/3" ]
        [ "0", "1"; "1", "7/4"; "2", "2"; "3", "7/4"; "4", "1" ]
        [ "0", "0"; "1", "3/2"; "2", "2"; "3", "3/2"; "4", "0" ]
        [ "0", "1"; "1", "7/4"; "2", "1"; "3", "1/4"; "4", "1" ]
        [ "3", "0"; "2", "1"; "1", "0"; "2", "-1" ]
        [ "5/2", "1/2"; "3/2", "3/2"; "1/2", "1/2"; "3/2", "-1/2" ]
        [ "11/4", "3/2"; "5/4", "-1/2"; "13/4", "1/2" ]
        [ "3", "5/4"; "5/4", "1"; "3", "-3/4" ]
        [ "11/4", "3/2"; "-3/4", "1"; "5/4", "-3" ] |]
    let private baseInventories = [|
        Map [ "H",1; "A",1 ]; Map [ "H",1; "A",1; "N",1 ]
        Map [ "H",1; "A",1 ]; Map [ "H",2; "A",1; "N",1; "Q",1 ]
        Map [ "D",1; "H",1; "A",1 ]; Map [ "H",1; "A",1; "N",1 ]
        Map [ "Q",1; "N",1 ]; Map [ "N",1; "A",1 ]
        Map [ "H",1; "N",1; "A",1 ]; Map [ "H",1; "Q",1 ]
        Map [ "H",2; "A",3; "N",2; "Q",3 ]; Map [ "Q",1; "H",1 ]
        Map [ "Q",1; "N",1; "A",1; "H",1 ]
        Map [ "D",1; "H",1; "N",1 ]
        Map [ "D",1; "H",2; "N",1; "A",1; "Q",1 ]
        Map [ "I",1; "H",1; "A",1 ]
        Map [ "I",1; "H",1; "N",1; "A",1 ]
        Map [ "I",1; "H",1; "N",1; "A",1; "D",1 ]
        Map [ "I",1; "N",1; "D",1 ]
        Map [ "I",1; "A",1; "H",1 ]
        Map [ "D",1; "I",1; "A",1; "N",1; "H",1 ]
        Map [ "H",3; "A",3; "N",2; "Q",2; "D",1 ]
        Map [ "H",2; "A",3; "N",2; "Q",1; "D",1; "I",2 ]
        Map [ "H",2; "A",2 ]
        Map [ "H",5; "A",6 ]
        Map [ "H",4; "A",4; "N",2 ]
        Map [ "A",1; "Q",1; "N",1 ]
        Map [ "H",3; "A",3; "N",2; "Q",1 ]
        Map [ "Q",1; "H",1 ]
        Map [ "Q",1; "N",1; "A",1; "H",1 ]
        Map [ "H",2; "A",2; "N",1; "Q",2 ]
        Map [ "A",1; "N",1 ]
        Map [ "Q",1 ]
        Map [ "A",1; "Q",1 ]
        Map [ "Q",1 ]
        Map [ "H",2; "A",2; "N",1; "Q",1 ]
        Map [ "A",1 ]
        Map [ "A",1 ]
        Map [ "N",1; "A",1 ]
        Map [ "H",1; "A",1 ]
        Map [ "D",1; "A",1 ]
        Map [ "H",2; "A",2; "N",2 ]
        Map.empty; Map.empty; Map.empty; Map.empty; Map.empty |]
    let private baseLimits = [| 1; 1; 2; 5; 3; 1; 1; 2; 3; 2; 8; 1; 3; 1; 5; 1; 2; 4; 1; 2; 2; 9; 8; 4; 10; 8; 2; 8;
                    1; 3; 7; 3; 3; 4; 3; 8; 3; 3; 4; 4; 3; 8; 0; 0; 0; 0; 0 |]
    let private baseSourceDegrees = [| 2; 2; 2; 1; 3; 2; 1; 2; 2; 1; 1; 2; 2; 2; 3; 0; 1; 3; 1; 0; 2; 3; 2; 2; 2; 2; 1; 1;
                           3; 3; 2; 2; 1; 1; 2; 2; 0; 1; 2; 1; 2; 2; 0; 0; 0; 0; 0 |]
    let private baseSourceCount = baseSources.Length
    let private extendedPuzzles =
        let assembly = Assembly.GetExecutingAssembly()
        use stream = assembly.GetManifestResourceStream("Angouri.Kernel.extended-puzzles.json")
        if isNull stream then [||]
        else
            use document = JsonDocument.Parse(stream)
            let required (element: JsonElement) (name: string) =
                let mutable value = Unchecked.defaultof<JsonElement>
                if element.TryGetProperty(name,&value) then value
                else invalidOp (sprintf "Embedded puzzle is missing %s." name)
            document.RootElement.EnumerateArray()
            |> Seq.map (fun element ->
                let targets =
                    (required element "targets").EnumerateArray()
                    |> Seq.map (fun target ->
                        { x=(required target "x").GetString(); y=(required target "y").GetString() })
                    |> Seq.toArray
                let inventory = Dictionary<string,int>()
                for pair in (required element "inventory").EnumerateObject() do
                    inventory[pair.Name] <- pair.Value.GetInt32()
                let mutable stationElement = Unchecked.defaultof<JsonElement>
                let station =
                    if element.TryGetProperty("station",&stationElement) then
                        { id=(required stationElement "id").GetString()
                          op=(required stationElement "op").GetString()
                          before=(required stationElement "before").GetInt32()
                          after=(required stationElement "after").GetInt32() }
                    else Unchecked.defaultof<ExtendedStation>
                let mutable relationElement = Unchecked.defaultof<JsonElement>
                let mutable cropElement = Unchecked.defaultof<JsonElement>
                let crop =
                    if element.TryGetProperty("crop",&cropElement) then
                        { from=(required cropElement "from").GetString()
                          ``to``=(required cropElement "to").GetString()
                          targetFrom=(required cropElement "targetFrom").GetString()
                          targetTo=(required cropElement "targetTo").GetString() }
                    else Unchecked.defaultof<ExtendedCrop>
                let mutable outlineElement = Unchecked.defaultof<JsonElement>
                { id=(required element "id").GetInt32()
                  source=(required element "source").GetString()
                  degree=(required element "degree").GetInt32()
                  endpoint=(required element "endpoint").GetInt32()
                  targets=targets; inventory=inventory
                  limit=(required element "limit").GetInt32()
                  station=station
                  relation=(if element.TryGetProperty("relation",&relationElement) then relationElement.GetString() else null)
                  crop=crop
                  outline=(if element.TryGetProperty("outline",&outlineElement) then outlineElement.GetString() else null) })
            |> Seq.toArray
    do
        for index,puzzle in extendedPuzzles |> Array.indexed do
            let expectedId = baseSourceCount + index + 1
            if puzzle.id <> expectedId || String.IsNullOrWhiteSpace(puzzle.source) ||
               puzzle.degree < 0 || puzzle.degree > maxDegree || puzzle.endpoint < 1 || puzzle.endpoint > 16 ||
               isNull puzzle.targets || puzzle.targets.Length = 0 || puzzle.targets.Length > 16 ||
               isNull puzzle.inventory || puzzle.limit < 0 || puzzle.limit > maxNodes ||
               (not (isNull puzzle.relation) && puzzle.relation <> "height-squared") then
                invalidOp (sprintf "Invalid embedded puzzle definition %d." expectedId)
            if puzzle.inventory |> Seq.exists (fun pair -> not (List.contains pair.Key operations) || pair.Value < 0 || pair.Value > maxNodes) then
                invalidOp (sprintf "Invalid embedded inventory for puzzle %d." expectedId)
            if not (obj.ReferenceEquals(puzzle.station,null)) &&
               (puzzle.station.id <> "station" || not (List.contains puzzle.station.op operations) ||
                puzzle.station.before < 0 || puzzle.station.after < 0 ||
                puzzle.station.before + puzzle.station.after + 1 > maxNodes) then
                invalidOp (sprintf "Invalid embedded station for puzzle %d." expectedId)
            if not (obj.ReferenceEquals(puzzle.crop,null)) then
                let endpoint = Piecewise.ofInt puzzle.endpoint
                let values = [puzzle.crop.from;puzzle.crop.``to``;puzzle.crop.targetFrom;puzzle.crop.targetTo]
                match values |> List.map Piecewise.tryParseRational with
                | [Some initialFrom;Some initialTo;Some targetFrom;Some targetTo]
                    when Piecewise.compareRational initialFrom Piecewise.zero >= 0 &&
                         Piecewise.compareRational initialFrom initialTo < 0 &&
                         Piecewise.compareRational initialTo endpoint <= 0 &&
                         Piecewise.compareRational targetFrom Piecewise.zero >= 0 &&
                         Piecewise.compareRational targetFrom targetTo < 0 &&
                         Piecewise.compareRational targetTo endpoint <= 0 -> ()
                | _ -> invalidOp (sprintf "Invalid embedded crop for puzzle %d." expectedId)
            if not (isNull puzzle.outline) then
                if String.IsNullOrWhiteSpace(puzzle.outline) || puzzle.outline.Length > 1024 then
                    invalidOp (sprintf "Invalid embedded outline for puzzle %d." expectedId)
                try MathS.FromString(puzzle.outline) |> ignore
                with _ -> invalidOp (sprintf "Invalid embedded outline for puzzle %d." expectedId)
            for target in puzzle.targets do
                if obj.ReferenceEquals(target,null) || Option.isNone (Piecewise.tryParseRational target.x) || String.IsNullOrWhiteSpace(target.y) then
                    invalidOp (sprintf "Invalid embedded target for puzzle %d." expectedId)
    let sources = Array.append baseSources (extendedPuzzles |> Array.map (fun puzzle -> puzzle.source))
    let targets =
        Array.append baseTargets
            (extendedPuzzles |> Array.map (fun puzzle -> puzzle.targets |> Array.map (fun target -> target.x,target.y) |> Array.toList))
    let inventories =
        Array.append baseInventories
            (extendedPuzzles |> Array.map (fun puzzle -> puzzle.inventory |> Seq.map (fun pair -> pair.Key,pair.Value) |> Map.ofSeq))
    let limits = Array.append baseLimits (extendedPuzzles |> Array.map (fun puzzle -> puzzle.limit))
    let sourceDegrees = Array.append baseSourceDegrees (extendedPuzzles |> Array.map (fun puzzle -> puzzle.degree))
    let sourceEndpoints =
        let original = Array.create baseSourceCount 4
        original[4] <- 2
        Array.append original (extendedPuzzles |> Array.map (fun puzzle -> puzzle.endpoint))
    let cropDefinitions =
        extendedPuzzles
        |> Array.choose (fun puzzle ->
            if obj.ReferenceEquals(puzzle.crop,null) then None
            else Some (puzzle.id,
                ({ From=Piecewise.rationalText (Piecewise.parseRational puzzle.crop.from)
                   To=Piecewise.rationalText (Piecewise.parseRational puzzle.crop.``to``) },
                 { From=Piecewise.rationalText (Piecewise.parseRational puzzle.crop.targetFrom)
                   To=Piecewise.rationalText (Piecewise.parseRational puzzle.crop.targetTo) })))
        |> Map.ofArray
    let outlineDefinitions =
        extendedPuzzles
        |> Array.choose (fun puzzle -> if isNull puzzle.outline then None else Some (puzzle.id,puzzle.outline))
        |> Map.ofArray
    // Exact authored goals shipped before the picture puzzles moved from a
    // whole-outline win condition to stronger checkpoint sets. These are the
    // only obsolete authored rules that state loading may upgrade.
    let private legacyPictureGoals = Map [
        72,[{X="0";Y="0"};{X="1";Y="1"};{X="2";Y="0"}]
        73,[{X="1";Y="7/6"};{X="2";Y="4/3"};{X="3";Y="3/2"}]
        74,[{X="3/2";Y="0"};{X="2";Y="1/2"};{X="2";Y="-1/2"};{X="5/2";Y="0"}]
        75,[{X="0";Y="0"};{X="1";Y="3/4"};{X="1";Y="-3/4"};{X="2";Y="1"};
            {X="2";Y="-1"};{X="3";Y="3/4"};{X="3";Y="-3/4"};{X="4";Y="0"}]
        76,[{X="1";Y="1/2"};{X="2";Y="1"};{X="3";Y="1/2"}]
        77,[{X="0";Y="0"};{X="2";Y="1/2"};{X="2";Y="-1/2"};{X="4";Y="0"}]
    ]
    let private baseStationDefinitions = Map [
        32,{ Id="station"; Op="D"; Before=1; After=1 }
        33,{ Id="station"; Op="D"; Before=1; After=1 }
        34,{ Id="station"; Op="D"; Before=2; After=1 }
        35,{ Id="station"; Op="D"; Before=1; After=1 }
        36,{ Id="station"; Op="D"; Before=5; After=2 }
        37,{ Id="station"; Op="I"; Before=1; After=1 }
        38,{ Id="station"; Op="I"; Before=1; After=1 }
        39,{ Id="station"; Op="I"; Before=2; After=1 }
        40,{ Id="station"; Op="I"; Before=1; After=2 }
        41,{ Id="station"; Op="I"; Before=1; After=1 }
        42,{ Id="station"; Op="I"; Before=5; After=2 } ]
    let stationDefinitions =
        extendedPuzzles
        |> Array.choose (fun puzzle ->
            if obj.ReferenceEquals(puzzle.station,null) then None
            else Some (puzzle.id,{ Id=puzzle.station.id; Op=puzzle.station.op; Before=puzzle.station.before; After=puzzle.station.after }))
        |> Array.fold (fun definitions (source,station) -> Map.add source station definitions) baseStationDefinitions
    let sourceRelations =
        extendedPuzzles
        |> Array.choose (fun puzzle -> if isNull puzzle.relation then None else Some (puzzle.id,puzzle.relation))
        |> Map.ofArray
    let isHeightSquaredSource source = sourceRelations |> Map.tryFind source = Some "height-squared"
    let defaultCircle = { X="2"; Y="0"; Radius="1" }
    let circleDefinitions = Map [
        43,{ Initial={ X="2"; Y="0"; Radius="1/2" }; Editable=["radius"] }
        44,{ Initial=defaultCircle; Editable=["x";"y"] }
        45,{ Initial=defaultCircle; Editable=["y";"radius"] }
        46,{ Initial=defaultCircle; Editable=["x";"y";"radius"] }
        47,{ Initial=defaultCircle; Editable=["x";"y";"radius"] } ]
    let isCircleSource source = circleDefinitions |> Map.containsKey source
    let legacyRemixInventory = Map [ "H",3; "A",2; "N",1; "Q",1; "D",1 ]
    let str (s: string) : JsonNode = JsonValue.Create(s)
    let num (n: int) : JsonNode = JsonValue.Create(n)
    let flt (n: float) : JsonNode = JsonValue.Create(n)
    let boolean (b: bool) : JsonNode = JsonValue.Create(b)
    let obj (pairs: (string * JsonNode) list) : JsonNode =
        let o = JsonObject()
        for key,value in pairs do o.Add(key, value)
        o
    let arr (values: JsonNode seq) : JsonNode =
        let a = JsonArray()
        for v in values do a.Add(v)
        a
    let field (n: JsonNode) key =
        match n with
        | :? JsonObject as o when o.ContainsKey(key) && not (isNull o[key]) -> o[key]
        | _ -> invalidInput key ("Missing " + key + ".")
    let stringField n key =
        match field n key with
        | :? JsonValue as v ->
            let mutable value = ""
            if v.TryGetValue<string>(&value) && not (isNull value) then value else invalidInput key ("Invalid text field: " + key)
        | _ -> invalidInput key ("Invalid text field: " + key)
    let intField n key =
        match field n key with
        | :? JsonValue as v ->
            let mutable value = 0
            if v.TryGetValue<int>(&value) then value else invalidInput key ("Invalid integer field: " + key)
        | _ -> invalidInput key ("Invalid integer field: " + key)
    let boolField n key =
        match field n key with
        | :? JsonValue as v ->
            let mutable value = false
            if v.TryGetValue<bool>(&value) then value else invalidInput key ("Invalid Boolean field: " + key)
        | _ -> invalidInput key ("Invalid Boolean field: " + key)
    let keys (n: JsonNode) (allowed: string list) =
        match n with
        | :? JsonObject as o ->
            if o |> Seq.exists (fun p -> not (List.contains p.Key allowed)) then invalidInput "data" "Unexpected fields in this file."
        | _ -> invalidInput "data" "Expected an object."
    let array (n: JsonNode) =
        match n with
        | :? JsonArray as a -> a |> Seq.toList
        | _ -> invalidInput "data" "Expected an array."
    let rationalCache = Dictionary<string,Entity>()
    let rational (s: string) =
        let pattern = sprintf "^-?[0-9]{1,%d}(/[1-9][0-9]{0,%d})?$" maxExactDigits (maxExactDigits - 1)
        if isNull s || not (Regex.IsMatch(s, pattern)) then
            invalidInput "checkpoint" "Checkpoint values must be bounded exact fractions."
        match rationalCache.TryGetValue(s) with
        | true,value -> value
        | _ ->
            let value = MathS.FromString(s).Evaled
            if rationalCache.Count < 256 then rationalCache[s] <- value
            value
    let exactParts (value: Entity) =
        let parts = value.Evaled.ToString().Split('/')
        if parts.Length = 1 then BigInteger.Parse(parts[0].Trim()),BigInteger.One
        else BigInteger.Parse(parts[0].Trim()),BigInteger.Parse(parts[1].Trim())
    let compareExact left right =
        let leftNumerator,leftDenominator = exactParts left
        let rightNumerator,rightDenominator = exactParts right
        compare (leftNumerator * rightDenominator) (rightNumerator * leftDenominator)
    let isQuarterMultiple value =
        let numerator,denominator = exactParts value
        (numerator * BigInteger(4)) % denominator = BigInteger.Zero
    let exactInRange minimum maximum value =
        compareExact value (rational minimum) >= 0 && compareExact value (rational maximum) <= 0
    let asFloat (e: Entity) =
        match e.Evaled with
        | :? Entity.Number.Real as r -> r.AsDouble()
        | _ -> invalidInput "preview" "The curve did not return a real number."
    let checkedPreviewValue value =
        if not (Double.IsFinite(value)) || abs value > maxPreviewMagnitude then
            invalidInput "preview" "This construction produces values outside the supported preview range."
        value
    let exactConstant fieldName (text: string) =
        if isNull text || text.Length = 0 || text.Length > 256 then
            invalidInput fieldName "Exact values must use a bounded constant expression."
        try
            let value = MathS.FromString(text).InnerSimplified
            if value.Vars |> Seq.isEmpty |> not then
                invalidInput fieldName "Exact values cannot contain variables."
            let numeric = asFloat value
            if not (Double.IsFinite(numeric)) || abs numeric > maxTargetMagnitude then
                invalidInput fieldName "Checkpoint height is outside the supported challenge range."
            value
        with
        | :? InvalidInput -> reraise()
        | :? ArgumentException -> invalidInput fieldName "Exact values must use a supported constant expression."
    let private compareGoalHeight (left: Goal) (right: Goal) =
        let leftValue,rightValue = exactConstant "goals" left.Y,exactConstant "goals" right.Y
        Piecewise.tryCompareConstants leftValue rightValue
        |> Option.defaultWith (fun () -> invalidInput "goals" "Authored checkpoint heights could not be compared exactly.")
    let goalsJson (goals: Goal seq) = goals |> Seq.map (fun g -> obj [ "x",str g.X; "y",str g.Y ]) |> arr
    let nodesJson (nodes: Node seq) = nodes |> Seq.map (fun n -> obj [ "id",str n.Id; "op",str n.Op ]) |> arr
    let inventoryJson inventory = inventory |> Map.toList |> List.map (fun (k,v) -> k,num v) |> obj
    let circleJson (circle: Circle) = obj [ "x",str circle.X; "y",str circle.Y; "radius",str circle.Radius ]
    let cropJson (crop: Crop) = obj [ "from",str crop.From; "to",str crop.To ]
    let stationJson (station: Station) = obj [
        "id",str station.Id; "op",str station.Op; "before",num station.Before; "after",num station.After ]
    let stateJson (s: State) =
        let json = obj [
            "schema",num 1; "rules",str rules; "engine",str engine; "sourceId",num s.Source
            "mode",str s.Mode; "nodes",nodesJson s.Nodes; "goals",goalsJson s.Goals
            "inventory",inventoryJson s.Inventory; "limit",num s.Limit ]
        match s.Station with
        | Some station -> json["station"] <- stationJson station
        | None -> ()
        match s.Circle with
        | Some circle -> json["circle"] <- circleJson circle
        | None -> ()
        match s.Crop with
        | Some crop -> json["crop"] <- cropJson crop
        | None -> ()
        json
    let initial source mode =
        if source < 1 || source > sources.Length then invalidInput "source" "Choose an available source curve."
        let station = if mode = "puzzle" then stationDefinitions |> Map.tryFind source else None
        let nodes = station |> Option.map (fun fixedStation -> [{ Id=fixedStation.Id; Op=fixedStation.Op }]) |> Option.defaultValue []
        let circle =
            circleDefinitions |> Map.tryFind source
            |> Option.map (fun definition -> if mode = "puzzle" then definition.Initial else defaultCircle)
        let goals =
            if isCircleSource source && mode = "remix" then []
            else targets[source-1] |> List.map (fun (x,y) -> { X=x; Y=y })
        let crop = if mode = "puzzle" then cropDefinitions |> Map.tryFind source |> Option.map snd else None
        { Source=source; Mode=mode; Nodes=nodes
          Goals=goals
          Inventory=(if mode="remix" || isCircleSource source then Map.empty else inventories[source-1])
          Limit=(if mode="remix" || isCircleSource source then 0 else limits[source-1])
          Station=station; Circle=circle; Crop=crop }
    let readNodes n =
        let ns = array n
        if ns.Length > maxNodes then invalidInput "nodes" "The preview supports at most 64 parts."
        ns |> List.map (fun n ->
            keys n [ "id"; "op" ]
            let id,op = stringField n "id",stringField n "op"
            if isNull id || not (Regex.IsMatch(id, "^[A-Za-z0-9_-]{1,64}$")) then invalidInput "id" "Invalid part identity."
            if not (List.contains op operations) then invalidInput "op" "Unknown operation."
            { Id=id; Op=op })
    let readCircle n =
        keys n [ "x"; "y"; "radius" ]
        let x,y,radius = rational (stringField n "x"),rational (stringField n "y"),rational (stringField n "radius")
        if not (isQuarterMultiple x && isQuarterMultiple y && isQuarterMultiple radius) then
            invalidInput "circle" "Circle parameters must use quarter-unit steps."
        if not (exactInRange "-4" "8" x && exactInRange "-4" "8" y) then
            invalidInput "circle" "Circle centre coordinates must stay between -4 and 8."
        if not (exactInRange "1/4" "6" radius) then
            invalidInput "circle" "Circle radius must stay between 1/4 and 6."
        { X=x.ToString(); Y=y.ToString(); Radius=radius.ToString() }
    let readCrop source n =
        keys n [ "from"; "to" ]
        if isCircleSource source then invalidInput "crop" "Circle sources do not support Crop."
        let fromPoint =
            Piecewise.tryParseRational (stringField n "from")
            |> Option.defaultWith (fun () -> invalidInput "crop" "Crop bounds must be exact rational numbers.")
        let toPoint =
            Piecewise.tryParseRational (stringField n "to")
            |> Option.defaultWith (fun () -> invalidInput "crop" "Crop bounds must be exact rational numbers.")
        let endpoint = Piecewise.ofInt sourceEndpoints[source-1]
        if Piecewise.compareRational fromPoint Piecewise.zero < 0 ||
           Piecewise.compareRational fromPoint toPoint >= 0 ||
           Piecewise.compareRational toPoint endpoint > 0 then
            invalidInput "crop" "Crop must be a non-empty interval inside the source domain."
        { From=Piecewise.rationalText fromPoint; To=Piecewise.rationalText toPoint }
    let private goalIsInsideCrop crop (goalX: string) =
        match crop with
        | None -> true
        | Some crop ->
            let point = Piecewise.parseRational goalX
            Piecewise.compareRational point (Piecewise.parseRational crop.From) >= 0 &&
            Piecewise.compareRational point (Piecewise.parseRational crop.To) <= 0
    let private serializedGoalsExactly (n: JsonNode) (expected: Goal list) =
        let supplied =
            array n |> List.map (fun goal ->
                keys goal ["x";"y"]
                { X=stringField goal "x";Y=stringField goal "y" })
        supplied = expected
    let readGoals source _allowSymbolic cropTargets crop n =
        let gs = array n
        if isCircleSource source then
            if gs.Length < 3 || gs.Length > 8 then invalidInput "goals" "Circle challenges require between three and eight targets."
            gs |> List.map (fun n ->
                keys n [ "x"; "y" ]
                let x,y = rational (stringField n "x"),rational (stringField n "y")
                if not (exactInRange "-10" "14" x && exactInRange "-10" "14" y) then
                    invalidInput "goals" "Circle target coordinates must stay between -10 and 14."
                { X=x.ToString(); Y=y.ToString() })
        else
            let currentTargets =
                targets[source-1]
                |> List.filter (fun (goalX,_) -> not cropTargets || goalIsInsideCrop crop goalX)
            let supplied =
                gs |> List.map (fun n ->
                    keys n [ "x"; "y" ]
                    stringField n "x",stringField n "y")
            let positionCandidates =
                if cropTargets then
                    match legacyPictureGoals |> Map.tryFind source with
                    | Some legacy ->
                        let legacyTargets =
                            legacy
                            |> List.filter (fun goal -> goalIsInsideCrop crop goal.X)
                            |> List.map (fun goal -> goal.X,goal.Y)
                        [currentTargets;legacyTargets] |> List.distinct
                    | None -> [currentTargets]
                else [currentTargets]
            let expectedTargets =
                positionCandidates
                |> List.tryFind (fun candidate ->
                    supplied.Length = candidate.Length &&
                    (supplied,candidate) ||> List.forall2 (fun (suppliedX,_) (expectedX,_) -> rational suppliedX = rational expectedX))
                |> Option.defaultWith (fun () -> invalidInput "goals" "This source has a fixed set of checkpoint positions.")
            (supplied,expectedTargets) ||> List.map2 (fun (x,y) _ ->
                match Piecewise.tryParseRational y with
                | Some _ -> rational y |> ignore
                | None -> ()
                exactConstant "goals" y |> ignore
                { X=x; Y=y })
    let readInventory n =
        keys n operations
        operations |> List.choose (fun op ->
            match n[op] with
            | null -> None
            | v ->
                let count = intField n op
                if count < 0 || count > maxNodes then invalidInput "inventory" "Inventory counts must be between zero and 64."
                Some (op,count)) |> Map.ofList
    let readStation n =
        keys n [ "id"; "op"; "before"; "after" ]
        let station = { Id=stringField n "id"; Op=stringField n "op"; Before=intField n "before"; After=intField n "after" }
        if station.Id <> "station" || not (List.contains station.Op operations) ||
           station.Before < 0 || station.After < 0 || station.Before + station.After + 1 > maxNodes then
            invalidInput "station" "Invalid fixed station metadata."
        station
    let polynomialDegree s =
        s.Nodes |> List.fold (fun (degree,hasRounding) node ->
            let nextDegree =
                match node.Op,degree with
                | "Q",Some value -> Some (value * 2)
                | "D",Some value -> Some (max 0 (value - 1))
                | "I",Some value -> Some (value + 1)
                | ("S"),_ -> None
                | ("F" | "C"),_ -> Some 0
                | _,value -> value
            match nextDegree with
            | Some value when value > maxDegree ->
                invalidInput "preview" "This construction exceeds the preview polynomial degree limit of 32."
            | _ -> ()
            nextDegree,(hasRounding || node.Op = "F" || node.Op = "C")) (Some sourceDegrees[s.Source-1],false)
    let validateCircle s =
        match (circleDefinitions |> Map.tryFind s.Source),s.Circle with
        | None,None -> ()
        | None,Some _ -> invalidInput "circle" "Polynomial sources cannot carry circle parameters."
        | Some _,None -> invalidInput "circle" "Circle parameters are required for this source."
        | Some definition,Some circle ->
            if not s.Nodes.IsEmpty || Option.isSome s.Station || s.Inventory <> Map.empty || s.Limit <> 0 then
                invalidInput "circle" "Circle sources do not use operation parts or stations."
            if s.Mode = "puzzle" then
                if not (List.contains "x" definition.Editable) && rational circle.X <> rational definition.Initial.X then
                    invalidInput "circle" "This puzzle keeps the horizontal centre fixed."
                if not (List.contains "y" definition.Editable) && rational circle.Y <> rational definition.Initial.Y then
                    invalidInput "circle" "This puzzle keeps the vertical centre fixed."
                if not (List.contains "radius" definition.Editable) && rational circle.Radius <> rational definition.Initial.Radius then
                    invalidInput "circle" "This puzzle keeps the radius fixed."
    let validateStation s =
        let expected = if s.Mode = "puzzle" then stationDefinitions |> Map.tryFind s.Source else None
        if s.Station <> expected then invalidInput "station" "Fixed station rules cannot be changed."
        match expected with
        | None -> ()
        | Some station ->
            let fixedNodes = s.Nodes |> List.filter (fun node -> node.Id = station.Id)
            if fixedNodes.Length <> 1 || fixedNodes.Head.Op <> station.Op then
                invalidInput "station" "The authored fixed station must appear exactly once with its required operation."
            let index = s.Nodes |> List.findIndex (fun node -> node.Id = station.Id)
            let before,after = index,s.Nodes.Length-index-1
            if before > station.Before || after > station.After then
                invalidInput "station" "The construction exceeds a fixed station slot capacity."
            if s.Limit <> station.Before + station.After + 1 then
                invalidInput "station" "The fixed station capacity does not match the authored part limit."
    let movableNodes s =
        match s.Station with
        | Some station -> s.Nodes |> List.filter (fun node -> node.Id <> station.Id)
        | None -> s.Nodes
    let validateCommon s =
        if s.Nodes.Length > maxNodes then invalidInput "parts" "The preview supports at most 64 parts."
        if (s.Nodes |> List.map (fun n -> n.Id) |> Set.ofList |> Set.count) <> s.Nodes.Length then invalidInput "identity" "Part identities must be unique."
        validateCircle s
        match s.Mode,(cropDefinitions |> Map.tryFind s.Source),s.Crop with
        | "puzzle",None,None -> ()
        | "puzzle",None,Some _ -> invalidInput "crop" "This authored puzzle does not use Crop."
        | "puzzle",Some _,None -> invalidInput "crop" "This authored puzzle requires Crop."
        | "puzzle",Some (_,required),Some crop when crop <> required -> invalidInput "crop" "This puzzle keeps its drawing interval fixed."
        | _,_,Some crop -> readCrop s.Source (cropJson crop) |> ignore
        | _ -> ()
        validateStation s
        if not (isCircleSource s.Source) then polynomialDegree s |> ignore
        s
    let validateConstrained s =
        validateCommon s |> ignore
        if s.Limit < 0 || s.Limit > maxNodes then invalidInput "parts" "Part limits must be between zero and 64."
        if s.Nodes.Length > s.Limit then invalidInput "parts" "The construction exceeds its part limit."
        for op,count in (movableNodes s |> List.countBy (fun n -> n.Op)) do
            if count > (s.Inventory |> Map.tryFind op |> Option.defaultValue 0) then invalidInput "inventory" "That part is not available."
        s
    let validate s =
        if s.Mode = "remix" then
            validateCommon s |> ignore
            if s.Inventory <> Map.empty || s.Limit <> 0 then
                invalidInput "rules" "Reusable remix states must use an empty inventory and the unlimited limit sentinel."
            s
        else validateConstrained s
    let readState (n: JsonNode) =
        keys n [ "schema"; "rules"; "engine"; "sourceId"; "mode"; "nodes"; "goals"; "inventory"; "limit"; "station"; "circle"; "crop" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then
            invalidInput "version" "This save uses an unsupported schema, ruleset or engine."
        let source,mode = intField n "sourceId",stringField n "mode"
        if not (List.contains mode [ "puzzle"; "remix"; "challenge" ]) then invalidInput "mode" "Unknown play mode."
        let baseState = initial source mode
        let suppliedCrop =
            match n with
            | :? JsonObject as stateObject when stateObject.ContainsKey("crop") ->
                if isNull stateObject["crop"] then invalidInput "crop" "Invalid Crop interval."
                Some (readCrop source stateObject["crop"])
            | _ -> None
        let crop =
            match mode,suppliedCrop,baseState.Crop with
            // Earlier authored saves had movable cuts. Keep their construction
            // and restore the authored frame; creations/challenges keep theirs.
            | "puzzle",_,Some derived -> Some derived
            | "puzzle",Some supplied,None -> Some supplied
            | _,supplied,_ -> supplied
        let goalData = field n "goals"
        let goals =
            if mode = "puzzle" &&
               (legacyPictureGoals |> Map.tryFind source |> Option.exists (serializedGoalsExactly goalData)) then
                baseState.Goals
            elif mode = "remix" && (array goalData).IsEmpty then []
            else readGoals source (mode = "puzzle") (mode = "challenge") crop goalData
        let suppliedInventory = readInventory (field n "inventory")
        let suppliedLimit = intField n "limit"
        let legacyCropOnly =
            mode = "puzzle" && source = 72 && suppliedInventory = Map.empty && suppliedLimit = 0 &&
            (array (field n "nodes")).IsEmpty && serializedGoalsExactly goalData legacyPictureGoals[72]
        let inventory = if legacyCropOnly then baseState.Inventory else suppliedInventory
        let limit = if legacyCropOnly then baseState.Limit else suppliedLimit
        let suppliedStation =
            match n with
            | :? JsonObject as stateObject when stateObject.ContainsKey("station") ->
                if isNull stateObject["station"] then invalidInput "station" "Invalid fixed station metadata."
                Some (readStation stateObject["station"])
            | _ -> None
        match suppliedStation,baseState.Station with
        | Some supplied,Some expected when supplied = expected -> ()
        | None,Some _ -> () // Earlier saves derive the authored station from their source and mode.
        | None,None -> ()
        | _ -> invalidInput "station" "Fixed station rules cannot be changed."
        let suppliedCircle =
            match n with
            | :? JsonObject as stateObject when stateObject.ContainsKey("circle") ->
                if isNull stateObject["circle"] then invalidInput "circle" "Invalid circle parameters."
                Some (readCircle stateObject["circle"])
            | _ -> None
        let circle =
            match isCircleSource source,suppliedCircle,baseState.Circle with
            | true,Some supplied,_ -> Some supplied
            | true,None,Some derived -> Some derived
            | false,None,_ -> None
            | false,Some _,_ -> invalidInput "circle" "Polynomial sources cannot carry circle parameters."
            | _ -> invalidInput "circle" "Circle parameters are required for this source."
        let loaded = {
            baseState with
                Nodes=readNodes (field n "nodes")
                Goals=goals
                Inventory=inventory
                Limit=limit
                Circle=circle
                Crop=crop
        }
        match mode with
        | "puzzle" ->
            if goals <> baseState.Goals || inventory <> baseState.Inventory || limit <> baseState.Limit then
                invalidInput "rules" "Authored puzzle rules cannot be changed."
            validate loaded
        | "remix" ->
            if isCircleSource source then
                if goals <> [] then invalidInput "rules" "Circle creations cannot carry authored targets."
                if inventory = Map.empty && limit = 0 then validate loaded
                else invalidInput "rules" "Circle creations do not use operation inventory."
            elif goals <> [] && goals <> baseState.Goals then invalidInput "rules" "Authored checkpoint positions cannot be changed."
            elif inventory = Map.empty && limit = 0 then validate loaded
            elif inventory = legacyRemixInventory && limit = 6 then
                // Validate the acknowledged legacy rules before upgrading to reusable remix semantics.
                validateConstrained loaded |> ignore
                validate { loaded with Inventory=Map.empty; Limit=0 }
            else invalidInput "rules" "This remix save has unsupported inventory rules."
        | "challenge" -> validate loaded
        | _ -> invalidInput "mode" "Unknown play mode."
    let x = MathS.FromString("x") :?> Entity.Variable
    let h = MathS.FromString("h") :?> Entity.Variable
    let private relationRhs = MathS.FromString("z") :?> Entity.Variable
    let sourceEntities = sources |> Array.map MathS.FromString
    let private sineSources =
        sourceEntities |> Array.map (fun source -> source.Nodes |> Seq.exists (function :? Entity.Sinf -> true | _ -> false))
    let apply (f: Entity) op =
        let result =
            match op with
            | "H" -> f / rational "2"
            | "A" -> f + rational "1"
            | "N" -> -f
            | "Q" -> f.Pow(rational "2")
            | "D" -> f.Differentiate(x)
            | "I" -> f.Integrate(x,rational "0",x).Simplify()
            | "S" -> MathS.FromString("sin(pi*x/2)").Substitute(x,f).InnerSimplified
            | _ -> invalidInput "op" "Unknown operation."
        result.InnerSimplified
    let expressions s =
        let source = sourceEntities[s.Source-1]
        s.Nodes |> List.scan (fun f n -> apply f n.Op) source
    type private NumericCurvePath = {
        Points: (float * float) list
        StartClosed: bool
        EndClosed: bool
    }
    type private NumericSegment = {
        Segment: Piecewise.Segment
        Evaluate: float -> float
        Rounding: float -> float list
    }
    type private RelationBranch = {
        Family: int
        Expression: Entity
        Domain: Entity
    }
    let private heightSquaredBranchSchema = lazy (
        use _realCodomain = MathS.Settings.Codomain.Set(Domain.Real)
        let solution = (h.Pow(rational "2")-relationRhs).Simplify().SolveEquation(h)
        match solution with
        | :? Entity.Set.FiniteSet as finite ->
            finite.Elements
            |> Seq.mapi (fun family branch ->
                let simplified = branch.Simplify()
                if simplified.Vars |> Seq.exists (fun variable -> variable = h) then
                    invalidInput "preview" "The squared-height relation could not be solved explicitly for h."
                { Family=family; Expression=simplified; Domain=simplified.DomainConditionIn(Domain.Real).Simplify() })
            |> Seq.distinctBy (fun branch -> branch.Expression.ToString(),branch.Domain.ToString())
            |> Seq.sortBy (fun branch -> branch.Expression.ToString())
            |> Seq.toList
        | _ -> invalidInput "preview" "The squared-height relation could not be solved explicitly for h.")
    let private relationBranchCacheLimit = 256
    let private relationBranchCache = Dictionary<string,RelationBranch list*Entity option>()
    let private relationBranchCacheOrder = Queue<string>()
    let private relationBranchCacheGate = System.Object()
    let private cachedRelationSolution key create =
        match lock relationBranchCacheGate (fun () ->
            match relationBranchCache.TryGetValue(key) with
            | true,cached -> Some cached
            | false,_ -> None) with
        | Some cached -> cached
        | None ->
            let computed = create()
            lock relationBranchCacheGate (fun () ->
                match relationBranchCache.TryGetValue(key) with
                | true,cached -> cached
                | false,_ ->
                    if relationBranchCache.Count >= relationBranchCacheLimit then
                        let oldest = relationBranchCacheOrder.Dequeue()
                        relationBranchCache.Remove(oldest) |> ignore
                    relationBranchCache[key] <- computed
                    relationBranchCacheOrder.Enqueue(key)
                    computed)
    type private RelationSolvedSegment = {
        Segment: Piecewise.Segment
        Branches: RelationBranch list
        SignedTraversalRoot: Entity option
    }
    type private RelationSolvedLine = {
        HeightLatex: string
        ConditionLatex: string
    }
    type private RelationSolution = {
        Segments: RelationSolvedSegment list
        Latex: string
        Lines: RelationSolvedLine list
        HasRounding: bool
    }
    let private constructedLatex s =
        // Keep the operation tree intact, then let AngouriMath serialize it with
        // the precedence rules it uses for every other displayed expression.
        // In particular, additions do not need a fresh pair of parentheses at
        // every earlier operation, while powers and negation still retain the
        // grouping needed to show the player's order exactly.
        let operand = MathS.FromString("constructed_operand") :?> Entity.Variable
        let two = rational "2"
        let one = rational "1"
        let zero = rational "0"
        let sourceRenderer (variable: Entity.Variable) =
            sourceEntities[s.Source-1].Substitute(x,variable)
        let unaryTemplate text input =
            MathS.FromString(text).Substitute(operand,input)
        let renderNode (renderInput: Entity.Variable -> Entity) (index,node: Node) : Entity.Variable -> Entity =
            match node.Op with
            | "H" -> fun variable -> renderInput variable / two
            | "A" -> fun variable -> renderInput variable + one
            | "N" -> fun variable -> -(renderInput variable)
            | "Q" -> fun variable -> (renderInput variable).Pow(two)
            | "S" -> fun variable -> unaryTemplate "sin(pi*constructed_operand/2)" (renderInput variable)
            | "F" -> fun variable -> unaryTemplate "floor(constructed_operand)" (renderInput variable)
            | "C" -> fun variable -> unaryTemplate "ceil(constructed_operand)" (renderInput variable)
            | "D" -> fun variable ->
                upcast Entity.Derivativef(renderInput variable,variable,1)
            | "I" -> fun variable ->
                let dummy = MathS.FromString(sprintf "u_%d" (index+1)) :?> Entity.Variable
                // Construct the bound node directly. Substituting its upper
                // limit through every nested integral makes deep recipes grow
                // exponentially during rendering, despite their small output.
                let bounds = Nullable<ValueTuple<Entity,Entity>>(ValueTuple<Entity,Entity>(zero,variable))
                upcast Entity.Integralf(renderInput dummy,dummy,bounds)
            | _ -> invalidInput "op" "Unknown operation."
        let rendered =
            s.Nodes
            |> List.indexed
            |> List.fold renderNode sourceRenderer
            |> fun render -> render x
            |> fun expression -> expression.Latexize()
        sprintf "%s = %s" (if isHeightSquaredSource s.Source then "h^{2}" else "h") rendered
    let evaluateAt (f: Entity) (v: Entity) = f.Substitute(x,v).InnerSimplified
    let exactEqual left right = Piecewise.exactEqual left right
    let continuousPolynomialResultJson s =
        // Rational polynomial substitutions are already reduced exact numbers.
        // Latexize them directly; general simplification is only needed for the
        // variable expressions, whose presentations are cached below.
        let stages = expressions s
        let final = List.last stages
        let startSlope = final.Differentiate(x) |> fun slope -> evaluateAt slope (rational "0") |> asFloat
        if not (Double.IsFinite(startSlope)) then invalidInput "preview" "This construction exceeds the supported preview limits."
        let presentationGoals =
            if s.Mode = "remix" && List.isEmpty s.Goals then
                targets[s.Source-1] |> List.map (fun (x,_) -> { X=x; Y="0" })
            else s.Goals
        let checkpoints = presentationGoals |> List.map (fun g ->
            let actual = evaluateAt final (rational g.X)
            let target = exactConstant "goals" g.Y
            let height = actual |> asFloat |> checkedPreviewValue
            let targetNumber = target |> asFloat |> checkedPreviewValue
            obj [ "x",str g.X; "target",str g.Y; "actual",str (actual.ToString())
                  "targetLatex",str (target.Latexize()); "targetNumber",flt targetNumber
                  "actualLatex",str (actual.Latexize()); "actualNumber",flt height
                  "hit",boolean (exactEqual actual target); "y",flt height ])
        let endpoint = sourceEndpoints[s.Source-1]
        let samples = [0..80] |> List.map (fun i -> float i * float endpoint / 80.)
        let sampleXs = (samples @ (presentationGoals |> List.map (fun g -> asFloat (rational g.X)))) |> List.distinct |> List.sort
        let stageJson = stages |> List.mapi (fun i f ->
            let compiled = f.Compile([|x|])
            // Reuse the bounded display cache used by segmented equations. An
            // edit usually adds only one new expression: re-simplifying every
            // unchanged prefix made longer polynomial recipes lag on each move.
            // Exact evaluation and samples still use the original expression.
            let presentation = Piecewise.create f endpoint |> Piecewise.presentation
            let points = sampleXs |> List.map (fun sx ->
                let y = compiled.Call([|Complex(sx,0.)|]).Real |> checkedPreviewValue
                arr [flt sx;flt y])
            let values = presentationGoals |> List.map (fun g -> evaluateAt f (rational g.X))
            obj [ "id",str (if i=0 then "source" else s.Nodes[i-1].Id)
                  "expression",str presentation.ExpressionText; "latex",str presentation.Latex
                  "points",arr points
                  "values",arr (values |> List.map (fun value -> str (value.ToString())))
                  "valueLatex",arr (values |> List.map (fun value -> str (value.Latexize()))) ])
        // AngouriMath's bytecode interpreter samples the preview without dynamic code generation.
        // Exact symbolic checkpoint checks above remain the sole success authority.
        let preview = final.Compile([| x |])
        let exactPoints = checkpoints |> List.map (fun c -> asFloat (rational (stringField c "x")),c["y"].GetValue<float>())
        let points = sampleXs |> List.map (fun v ->
            let exact = exactPoints |> List.tryFind (fun (px,_) -> px = v)
            let y = match exact with
                    | Some (_,py) -> py
                    | None -> preview.Call([|Complex(v,0.)|]).Real
            arr [flt v;flt (checkedPreviewValue y)])
        let result = obj [ "constructedLatex",str (constructedLatex s)
                           "stages",arr stageJson; "checkpoints",arr checkpoints; "points",arr points; "startSlope",flt startSlope
                           "solved",boolean (s.Mode<>"remix" && (checkpoints |> List.forall (fun c -> c["hit"].GetValue<bool>()))) ]
        if s.Mode = "puzzle" && s.Source >= 3 then
            let fromGoal =
                s.Goals |> List.reduce (fun best candidate ->
                    if compareGoalHeight candidate best < 0 then candidate else best)
            let toGoal =
                s.Goals |> List.reduce (fun best candidate ->
                    if compareGoalHeight candidate best > 0 then candidate else best)
            let fromX,toX = rational fromGoal.X,rational toGoal.X
            let gap f =
                let fromValue,toValue = evaluateAt f fromX,evaluateAt f toX
                fromValue,toValue,(toValue - fromValue).InnerSimplified
            let targetGap = (exactConstant "goals" toGoal.Y - exactConstant "goals" fromGoal.Y).InnerSimplified
            let _,_,actualGap = gap final
            result["heightGuide"] <- obj [
                "fromX",str fromGoal.X; "toX",str toGoal.X; "target",str (targetGap.ToString())
                "targetLatex",str (targetGap.Latexize())
                "targetNumber",flt (targetGap |> asFloat |> checkedPreviewValue)
                "actual",str (actualGap.ToString()); "actualLatex",str (actualGap.Latexize())
                "hit",boolean (exactEqual actualGap targetGap)
                "stages",arr (stages |> List.map (fun stage ->
                    let fromValue,toValue,stageGap = gap stage
                    obj [ "from",str (fromValue.ToString()); "to",str (toValue.ToString()); "gap",str (stageGap.ToString())
                          "fromLatex",str (fromValue.Latexize()); "toLatex",str (toValue.Latexize())
                          "gapLatex",str (stageGap.Latexize())
                          "fromNumber",flt (fromValue |> asFloat |> checkedPreviewValue)
                          "toNumber",flt (toValue |> asFloat |> checkedPreviewValue)
                          "gapNumber",flt (stageGap |> asFloat |> checkedPreviewValue) ])) ]
        result

    let private piecewiseSampleXs (presentationGoals: Goal list) stages endpoint =
        let regular =
            [0..80]
            |> List.map (fun index ->
                Piecewise.createRational (BigInteger(index * endpoint)) (BigInteger 80))
        let checkpoints =
            presentationGoals
            |> List.map (fun goal ->
                Piecewise.tryParseRational goal.X
                |> Option.defaultWith (fun () -> invalidInput "goals" "Checkpoint positions must be exact fractions."))
        let boundaries = stages |> List.collect Piecewise.boundaries
        regular @ checkpoints @ boundaries
        |> List.distinct
        |> List.sortWith Piecewise.compareRational

    let private numericSegments (fn: Piecewise.Function) : NumericSegment list =
        fn.Segments |> List.map (fun segment ->
            let evaluate,rounding = Piecewise.compileNumeric x segment.Expression
            { Segment=segment
              Rounding=rounding
              Evaluate=evaluate >> checkedPreviewValue })

    let private numericAt point fn (evaluators: NumericSegment list) =
        let owner = Piecewise.segmentAt point fn
        let evaluator =
            evaluators
            |> List.find (fun evaluator -> Object.ReferenceEquals(evaluator.Segment,owner) || evaluator.Segment = owner)
        evaluator.Evaluate(Piecewise.toFloat point)

    let private pathJson (path: NumericCurvePath) =
        obj [ "points",arr (path.Points |> List.map (fun (px,py) -> arr [flt px;flt py]))
              "startClosed",boolean path.StartClosed; "endClosed",boolean path.EndClosed ]

    let private sampledRoundingPaths sampleXs (evaluator: NumericSegment) =
        let segment=evaluator.Segment
        let startValue,endValue=Piecewise.toFloat segment.Start,Piecewise.toFloat segment.End
        let sample point = let value=evaluator.Evaluate point in point,value,[value]
        // Geometry is approximate and compiled. Exact target ownership is
        // evaluated separately; bisection here only locates visual jumps.
        let rec between depth (left,_,leftSignature as first) (right,_,rightSignature as last) =
            if depth=0 || right-left<0.000000001 || leftSignature=rightSignature then [first;last]
            else
                let middle=sample ((left+right)/2.)
                between (depth-1) first middle @ (between (depth-1) middle last |> List.tail)
        let values =
            ([0..640] |> List.map (fun index -> startValue+(endValue-startValue)*float index/640.)) @
                (sampleXs |> List.map Piecewise.toFloat |> List.filter (fun point -> point>=startValue && point<=endValue))
            |> List.distinct |> List.sort |> List.map sample
            |> List.pairwise |> List.collect (fun (first,last) -> between 28 first last |> List.tail)
            |> fun rest -> sample startValue :: rest
        let paths=ResizeArray<NumericCurvePath>()
        let mutable points=[]
        let mutable previous=[]
        let flush () =
            if not points.IsEmpty then
                paths.Add({Points=List.rev points;StartClosed=true;EndClosed=false})
                points<-[]
        for point,height,signature in values do
            if not points.IsEmpty && signature<>previous then flush ()
            points<-(point,height)::points
            previous<-signature
        flush ()
        if paths.Count>maxSegments then invalidInput "preview" (sprintf "This rounding construction creates more than %d preview segments." maxSegments)
        paths |> Seq.mapi (fun index path ->
            {path with StartClosed=(if index=0 then segment.StartClosed else false)
                       EndClosed=(if index=paths.Count-1 then segment.EndClosed else false)}) |> Seq.toList

    let private piecewisePathsWithEvaluators sampleXs (evaluators: NumericSegment list) =
        evaluators
        |> List.collect (fun evaluator ->
            let segment = evaluator.Segment
            if Piecewise.hasSymbolicRounding segment.Expression then sampledRoundingPaths sampleXs evaluator
            else
            let points =
                segment.Start :: segment.End ::
                    (sampleXs |> List.filter (fun point ->
                        Piecewise.compareRational point segment.Start >= 0 &&
                        Piecewise.compareRational point segment.End <= 0))
                |> List.distinct
                |> List.sortWith Piecewise.compareRational
                |> List.map (fun point ->
                    let px = Piecewise.toFloat point
                    px,evaluator.Evaluate(px))
            [{ Points=points; StartClosed=segment.StartClosed; EndClosed=segment.EndClosed }])

    let private piecewisePaths sampleXs (fn: Piecewise.Function) =
        piecewisePathsWithEvaluators sampleXs (numericSegments fn)

    let private exactOutputRange initialRange (nodes: Node list) =
        let ordered low high =
            if Piecewise.compareRational low high <= 0 then low,high else high,low
        let transform range op =
            match op,range with
            // Sine is globally bounded for every real input, so it establishes a
            // range even when the operations before it had no known bounds.
            | "S",_ -> Some (Piecewise.negate Piecewise.one,Piecewise.one)
            | _,None -> None
            | "H",Some (low,high) ->
                let two = Piecewise.ofInt 2
                Some (Piecewise.divide low two,Piecewise.divide high two)
            | "A",Some (low,high) -> Some (Piecewise.add low Piecewise.one,Piecewise.add high Piecewise.one)
            | "N",Some (low,high) -> Some (Piecewise.negate high,Piecewise.negate low)
            | "Q",Some (low,high) ->
                let lowSquared,highSquared = Piecewise.square low,Piecewise.square high
                if Piecewise.compareRational low Piecewise.zero >= 0 then Some (lowSquared,highSquared)
                elif Piecewise.compareRational high Piecewise.zero <= 0 then Some (highSquared,lowSquared)
                else
                    let upper = if Piecewise.compareRational lowSquared highSquared >= 0 then lowSquared else highSquared
                    Some (Piecewise.zero,upper)
            | "F",Some (low,high) ->
                Some (Piecewise.ofBigInteger (Piecewise.floorRational low),Piecewise.ofBigInteger (Piecewise.floorRational high))
            | "C",Some (low,high) ->
                Some (Piecewise.ofBigInteger (Piecewise.ceilRational low),Piecewise.ofBigInteger (Piecewise.ceilRational high))
            // A derivative or anchored integral depends on more than the input's
            // value range. Discard the invariant until a later sine establishes it.
            | "D",_ | "I",_ -> None
            | _,_ -> None
        nodes
        |> List.fold (fun range node -> transform range node.Op) initialRange
        |> Option.map (fun (low,high) -> ordered low high)

    let private rangeProvesMismatch range (expected: Entity) =
        match range,Piecewise.tryParseRational (expected.ToString()) with
        | Some (low,high),Some value ->
            Piecewise.compareRational value low < 0 || Piecewise.compareRational value high > 0
        | _ -> false

    let private rationalQuadraticRoots (segment: Piecewise.Segment) =
        match Piecewise.tryQuadratic x segment.Expression with
        | None -> []
        | Some (quadratic,linear,constant) when quadratic.Numerator = BigInteger.Zero ->
            if linear.Numerator = BigInteger.Zero then []
            else [Piecewise.toFloat (Piecewise.divide (Piecewise.negate constant) linear)]
        | Some (quadratic,linear,constant) ->
            let four = Piecewise.ofInt 4
            let two = Piecewise.ofInt 2
            let discriminant =
                Piecewise.subtract (Piecewise.square linear)
                    (Piecewise.multiply four (Piecewise.multiply quadratic constant))
            if discriminant.Numerator.Sign < 0 then []
            else
                match Piecewise.tryRationalSquareRoot discriminant with
                | Some root ->
                    let denominator = Piecewise.multiply two quadratic
                    [ Piecewise.divide (Piecewise.add (Piecewise.negate linear) root) denominator
                      Piecewise.divide (Piecewise.subtract (Piecewise.negate linear) root) denominator ]
                    |> List.map Piecewise.toFloat
                | None ->
                    let a,b,d = Piecewise.toFloat quadratic,Piecewise.toFloat linear,Piecewise.toFloat discriminant
                    let root = Math.Sqrt(d)
                    [(-b-root)/(2.*a);(-b+root)/(2.*a)]

    let private tryExactSignedSquareRoot (expression: Entity) =
        let two = rational "2"
        let half = rational "1/2"
        let rec root (current: Entity) =
            match current with
            | :? Entity.Powf as power ->
                match Piecewise.tryRationalEntity power.Exponent with
                | Some exponent when exponent.Denominator = BigInteger.One &&
                                         exponent.Numerator.Sign >= 0 &&
                                         exponent.Numerator.IsEven ->
                    let rootExponent = Piecewise.ofBigInteger (exponent.Numerator/BigInteger(2)) |> Piecewise.toEntity
                    Some (power.Base.Pow(rootExponent).InnerSimplified)
                | _ -> None
            | :? Entity.Mulf as product ->
                match root product.Multiplier,root product.Multiplicand with
                | Some left,Some right -> Some ((left*right).InnerSimplified)
                | _ -> None
            | :? Entity.Divf as quotient ->
                match root quotient.Dividend,root quotient.Divisor with
                | Some numerator,Some denominator -> Some ((numerator/denominator).InnerSimplified)
                | _ -> None
            | _ ->
                match Piecewise.tryRationalEntity current with
                | Some value when value.Numerator.Sign = 0 -> Some (rational "0")
                | Some value when value.Numerator.Sign > 0 -> Some (current.Pow(half).InnerSimplified)
                | _ -> None
        root expression
        |> Option.bind (fun candidate ->
            let candidate = candidate.InnerSimplified
            // The structural proof above only admits products and quotients of
            // positive constants and even powers. Keep AngouriMath as the final
            // exact authority before using the signed representative in Flight.
            if exactEqual (candidate.Pow(two).InnerSimplified) expression then Some candidate else None)

    let private samePoint (leftX,leftY) (rightX,rightY) =
        abs (leftX-rightX) < 0.0000001 && abs (leftY-rightY) < 0.0000001

    let private joinPoints first second =
        match second with
        | [] -> first
        | _ -> first @ (second |> List.skip 1)

    let private reversePath path =
        { Points=List.rev path.Points; StartClosed=path.EndClosed; EndClosed=path.StartClosed }

    let private mergeConnectedPaths paths =
        let endpoints path = List.head path.Points,List.last path.Points
        let merge first second =
            let firstStart,firstEnd = endpoints first
            let secondStart,secondEnd = endpoints second
            if samePoint firstEnd secondStart then
                Some { Points=joinPoints first.Points second.Points; StartClosed=first.StartClosed; EndClosed=second.EndClosed }
            elif samePoint firstEnd secondEnd then
                let reversed = reversePath second
                Some { Points=joinPoints first.Points reversed.Points; StartClosed=first.StartClosed; EndClosed=reversed.EndClosed }
            elif samePoint firstStart secondEnd then
                Some { Points=joinPoints second.Points first.Points; StartClosed=second.StartClosed; EndClosed=first.EndClosed }
            elif samePoint firstStart secondStart then
                let reversed = reversePath second
                Some { Points=joinPoints reversed.Points first.Points; StartClosed=reversed.StartClosed; EndClosed=first.EndClosed }
            else None
        let rec add candidate accumulated =
            match accumulated |> List.tryPick (fun existing -> merge existing candidate |> Option.map (fun joined -> existing,joined)) with
            | None -> candidate::accumulated
            | Some (existing,joined) ->
                accumulated |> List.filter (fun item -> not (Object.ReferenceEquals(item,existing))) |> add joined
        paths |> List.fold (fun accumulated path -> add path accumulated) [] |> List.rev

    let private solveHeightSquaredRelation (fn: Piecewise.Function) =
        use _realCodomain = MathS.Settings.Codomain.Set(Domain.Real)
        let solve expression =
            let key = expression.ToString()
            cachedRelationSolution key (fun () ->
                // Solve the real h^2 = z shape once with AngouriMath, then
                // substitute each exact segment RHS into those solver-derived
                // branches and domains. This preserves concrete SolveEquation
                // semantics without asking the CAS to rediscover the same
                // quadratic structure for every response and segment.
                let branches =
                    heightSquaredBranchSchema.Value
                    |> List.choose (fun schema ->
                        let branch = schema.Expression.Substitute(relationRhs,expression).Simplify()
                        let domain = schema.Domain.Substitute(relationRhs,expression).Simplify()
                        if branch.Vars |> Seq.exists (fun variable -> variable = h || variable = relationRhs) ||
                           domain.Vars |> Seq.exists (fun variable -> variable = relationRhs) then
                            invalidInput "preview" "The squared-height relation could not be solved explicitly for h."
                        if domain.ToString() = "False" then None
                        else Some { Family=schema.Family; Expression=branch; Domain=domain })
                    |> List.distinctBy (fun branch -> branch.Expression.ToString(),branch.Domain.ToString())
                    |> List.sortBy (fun branch -> branch.Expression.ToString())
                branches,tryExactSignedSquareRoot expression)
        let segments =
            fn.Segments
            |> List.map (fun segment ->
                let branches,signedRoot = solve segment.Expression
                { Segment=segment
                  Branches=branches
                  // A rounded function owns jumps and isolated endpoint values
                  // through its exact segments. Its principal height solutions
                  // must retain that ownership rather than being reinterpreted
                  // as a smooth signed square root across segment boundaries.
                  SignedTraversalRoot=
                    if fn.HasRounding then None else signedRoot })
        let conditionLatex (segment: Piecewise.Segment) (domain: Entity) =
            let interval = Piecewise.segmentConditionLatex segment
            match domain.ToString() with
            | "True" -> interval
            | _ -> sprintf "%s \\land %s" interval (domain.Latexize())
        let lines =
            segments
            |> List.collect (fun solved ->
                match solved.Branches with
                | [] ->
                    [{ HeightLatex="h \\in \\varnothing"
                       ConditionLatex=Piecewise.segmentConditionLatex solved.Segment }]
                | branches ->
                    branches
                    |> List.map (fun branch ->
                        { HeightLatex=sprintf "h = %s" (branch.Expression.Latexize())
                          ConditionLatex=conditionLatex solved.Segment branch.Domain }))
        let rows = lines |> List.map (fun line -> sprintf "%s & %s" line.HeightLatex line.ConditionLatex)
        { Segments=segments; Lines=lines; HasRounding=fn.HasRounding
          Latex=sprintf "\\begin{cases}%s\\end{cases}" (String.concat " \\\\ " rows) }

    let private approximatelyDistinct tolerance values =
        values
        |> List.sort
        |> List.fold (fun accumulated value ->
            match accumulated with
            | previous::_ when abs (value-previous) <= tolerance -> accumulated
            | _ -> value::accumulated) []
        |> List.rev

    let private relationRawPaths sampleXs checkpointXs polynomialDegree (solution: RelationSolution) =
        let tolerance = 0.000000001
        let rawPaths = ResizeArray<int*NumericCurvePath>()
        let samePath (left: NumericCurvePath) (right: NumericCurvePath) =
            left.StartClosed = right.StartClosed && left.EndClosed = right.EndClosed &&
            left.Points.Length = right.Points.Length &&
            List.forall2 samePoint left.Points right.Points
        let addPath family path =
            if not (rawPaths |> Seq.exists (fun (existingFamily,existing) -> family=existingFamily && samePath path existing)) then rawPaths.Add(family,path)
        for solved in solution.Segments do
            let segment = solved.Segment
            let compiledEvaluator = (numericSegments { DomainStart=segment.Start; DomainEnd=segment.End; Segments=[segment]; HasRounding=false }).Head
            let genericRounding = Piecewise.hasSymbolicRounding segment.Expression
            let evaluator =
                if genericRounding then
                    let known =
                        sampleXs |> List.filter (fun point ->
                            Piecewise.compareRational point segment.Start>=0 && Piecewise.compareRational point segment.End<=0 &&
                            (checkpointXs |> List.contains (Piecewise.toFloat point)))
                        |> List.map (fun point -> Piecewise.toFloat point,Piecewise.evaluateSegmentAt x point segment |> asFloat)
                        |> Map.ofList
                    {compiledEvaluator with Evaluate=fun point -> Map.tryFind point known |> Option.defaultWith (fun () -> compiledEvaluator.Evaluate point)}
                else compiledEvaluator
            let traversalBranches =
                match solved.SignedTraversalRoot with
                | None -> solved.Branches |> List.map (fun branch -> branch.Family,branch.Expression)
                | Some root ->
                    [root;(-root).InnerSimplified]
                    |> List.distinctBy (fun expression -> expression.ToString())
                    |> List.sortBy (fun expression -> expression.ToString())
                    |> List.mapi (fun family expression -> family,expression)
            let branchEvaluators =
                traversalBranches
                |> List.map (fun (family,expression) ->
                    let evaluate,_ = Piecewise.compileNumeric x expression
                    family,(fun value ->
                        let result=evaluate value
                        if abs result < tolerance then 0. else checkedPreviewValue result))
            if genericRounding then
                let schemas = heightSquaredBranchSchema.Value |> List.map (fun branch -> branch.Family,branch.Expression.Compile([|relationRhs|]))
                for path in sampledRoundingPaths sampleXs evaluator do
                    if path.Points |> List.forall (fun (_,value) -> value>=0.) then
                        for family,compiled in schemas do
                            addPath family {path with Points=path.Points |> List.map (fun (px,value) -> px,compiled.Call([|Complex(value,0.)|]).Real)}
            else
                let startValue,endValue = Piecewise.toFloat segment.Start,Piecewise.toFloat segment.End
                let exactRoots =
                    match polynomialDegree with
                    | Some degree when degree <= 2 -> rationalQuadraticRoots segment
                    | _ -> []
                let exactTraversalRoots =
                    match solved.SignedTraversalRoot,polynomialDegree with
                    | Some root,Some degree when degree <= 4 ->
                        // tryQuadratic proves the coefficients and discriminant
                        // symbolically. Irrational roots are converted to doubles
                        // only to anchor the drawn curve, never for validation.
                        rationalQuadraticRoots { segment with Expression=root }
                    | _ -> []
                let baseCandidates =
                    startValue :: endValue :: exactRoots @ exactTraversalRoots @
                        (sampleXs |> List.map Piecewise.toFloat |> List.filter (fun value -> value >= startValue && value <= endValue))
                    |> List.filter (fun value -> Double.IsFinite(value) && value >= startValue-tolerance && value <= endValue+tolerance)
                    |> List.map (fun value -> max startValue (min endValue value))
                    |> approximatelyDistinct tolerance
                let crossingRoots =
                    baseCandidates
                    |> List.pairwise
                    |> List.choose (fun (left,right) ->
                        let leftValue,rightValue = evaluator.Evaluate(left),evaluator.Evaluate(right)
                        if leftValue * rightValue >= 0. || right-left <= tolerance then None
                        else
                            let mutable low,high = left,right
                            let mutable lowValue = leftValue
                            for _ in 1..52 do
                                let middle = (low+high)/2.
                                let middleValue = evaluator.Evaluate(middle)
                                if lowValue * middleValue <= 0. then high <- middle
                                else
                                    low <- middle
                                    lowValue <- middleValue
                            Some ((low+high)/2.))
                let candidates = baseCandidates @ crossingRoots |> approximatelyDistinct tolerance
                let samples =
                    candidates
                    |> List.map (fun px ->
                        let value = evaluator.Evaluate(px)
                        px,(if abs value < tolerance then 0. else value))
                let runs = ResizeArray<(float*float) list>()
                let mutable current : (float*float) list = []
                for point in samples do
                    if snd point >= 0. then current <- point::current
                    elif not current.IsEmpty then
                        runs.Add(List.rev current)
                        current <- []
                if not current.IsEmpty then runs.Add(List.rev current)
                for run in runs do
                    let indexed = run |> List.indexed
                    let lastIndex = run.Length-1
                    let splitIndices =
                        indexed
                        |> List.choose (fun (index,(_,value)) ->
                            let adjacentPositive =
                                (index > 0 && snd run[index-1] > tolerance) ||
                                (index < lastIndex && snd run[index+1] > tolerance)
                            let checkpoint = checkpointXs |> List.exists (fun checkpointX -> abs (fst run[index]-checkpointX) <= tolerance)
                            if index = 0 || index = lastIndex || checkpoint || abs value <= tolerance && adjacentPositive then Some index else None)
                        |> List.distinct
                        |> List.sort
                    let ranges =
                        if splitIndices.Length <= 1 then [0,lastIndex]
                        else splitIndices |> List.pairwise
                    for firstIndex,lastIndex in ranges do
                        let subrun = run[firstIndex..lastIndex]
                        let firstX,lastX = fst (List.head subrun),fst (List.last subrun)
                        let startClosed = if abs (firstX-startValue) < tolerance then segment.StartClosed else true
                        let endClosed = if abs (lastX-endValue) < tolerance then segment.EndClosed else true
                        for family,branchEvaluator in branchEvaluators do
                            let points = subrun |> List.map (fun (px,value) -> if abs value <= tolerance then px,0. else px,branchEvaluator px)
                            let path={ Points=points; StartClosed=startClosed; EndClosed=endClosed }
                            addPath family path
                            // Both signs of a zero piece belong to their respective
                            // solutions; a completely zero equation is deduplicated below.
                            if points |> List.forall (fun (_,height) -> height=0.) then
                                for schema in heightSquaredBranchSchema.Value do addPath schema.Family path
        rawPaths |> Seq.toList

    let private withoutConsecutiveDuplicates points =
        points
        |> List.fold (fun accumulated point ->
            match accumulated with
            | previous::_ when samePoint previous point -> accumulated
            | _ -> point::accumulated) []
        |> List.rev

    let private curveLength points =
        points
        |> List.pairwise
        |> List.sumBy (fun ((leftX,leftY),(rightX,rightY)) ->
            let dx,dy = rightX-leftX,rightY-leftY
            Math.Sqrt(dx*dx+dy*dy))

    let private resampleCurve intervals points =
        let points = withoutConsecutiveDuplicates points
        match points with
        | [] -> []
        | [_] -> points
        | _ ->
            let pointArray = points |> List.toArray
            let cumulative = Array.zeroCreate<float> pointArray.Length
            for index in 1..pointArray.Length-1 do
                cumulative[index] <- cumulative[index-1] + curveLength [pointArray[index-1];pointArray[index]]
            let total = cumulative[cumulative.Length-1]
            if total <= 0. then [pointArray[0]]
            else
                let mutable segmentIndex = 1
                [0..intervals]
                |> List.map (fun index ->
                    let target = total * float index / float intervals
                    while segmentIndex < cumulative.Length-1 && cumulative[segmentIndex] < target do
                        segmentIndex <- segmentIndex+1
                    let leftDistance,rightDistance = cumulative[segmentIndex-1],cumulative[segmentIndex]
                    let ratio = if rightDistance=leftDistance then 0. else (target-leftDistance)/(rightDistance-leftDistance)
                    let leftX,leftY = pointArray[segmentIndex-1]
                    let rightX,rightY = pointArray[segmentIndex]
                    leftX+(rightX-leftX)*ratio,leftY+(rightY-leftY)*ratio)

    let private resampleRoute curves =
        let curveData =
            curves
            |> List.map (fun curve ->
                let points = withoutConsecutiveDuplicates curve.Points
                points,curveLength points,max 1 (points.Length-1))
        let totalLength = curveData |> List.sumBy (fun (_,length,_) -> length)
        if totalLength <= 0. then
            curveData |> List.collect (fun (points,_,_) -> points) |> withoutConsecutiveDuplicates
        else
            let baseIntervals = curveData |> List.sumBy (fun (_,length,intervals) -> if length > 0. then intervals else 0)
            // Use a denser, distance-paced route than the drawing samples. This
            // keeps curved flight smooth while retaining a bounded payload.
            let desiredIntervals = min 4096 (baseIntervals*2)
            let quotas = curveData |> List.map (fun (_,length,_) -> if length > 0. then length/totalLength*float desiredIntervals else 0.) |> List.toArray
            let allocations = quotas |> Array.map (fun quota -> if quota > 0. then max 1 (int (Math.Floor(quota))) else 0)
            let mutable allocated = allocations |> Array.sum
            while allocated < desiredIntervals do
                let index = [0..allocations.Length-1] |> List.maxBy (fun index -> quotas[index]-float allocations[index])
                allocations[index] <- allocations[index]+1
                allocated <- allocated+1
            while allocated > desiredIntervals do
                let candidates = [0..allocations.Length-1] |> List.filter (fun index -> allocations[index] > 1)
                if candidates.IsEmpty then allocated <- desiredIntervals
                else
                    let index = candidates |> List.maxBy (fun index -> float allocations[index]-quotas[index])
                    allocations[index] <- allocations[index]-1
                    allocated <- allocated-1
            curveData
            |> List.mapi (fun index (points,length,_) ->
                if length <= 0. then points else resampleCurve allocations[index] points)
            |> List.fold (fun accumulated points ->
                match accumulated,points with
                | [],_ -> points
                | _,[] -> accumulated
                | _ when samePoint (List.last accumulated) (List.head points) -> joinPoints accumulated points
                | _ -> accumulated @ points) []
            |> withoutConsecutiveDuplicates

    let private relationCurveData sampleXs checkpointXs preferredTarget polynomialDegree solution =
        let rawPaths = relationRawPaths sampleXs checkpointXs polynomialDegree solution
        // Keep the solver's height solutions distinct, including through zeros.
        // Joining arbitrary graph edges would silently switch between solutions.
        let families =
            rawPaths |> List.groupBy fst |> List.sortBy fst
            |> List.map (fun (_,paths) ->
                paths |> List.map snd |> List.sortBy (fun path -> fst (List.head path.Points))
                |> mergeConnectedPaths
                |> List.map (fun path -> if fst (List.head path.Points)>fst (List.last path.Points) then reversePath path else path)
                |> List.sortBy (fun path -> fst (List.head path.Points)))
            |> List.distinctBy (fun paths -> paths |> List.map (fun path -> path.Points))
        let hasNoInteriorIntersection path =
            path.Points.Length>2 &&
            (path.Points |> List.skip 1 |> List.take (path.Points.Length-2) |> List.forall (fun (_,height) -> abs height>0.000000001)) &&
            // A signed traversal representative can cross zero between two
            // display samples. Treat that proven analytic crossing as an
            // interior intersection too, so the two curves are never folded
            // into a loop or endpoint join.
            (path.Points |> List.pairwise |> List.forall (fun ((_,left),(_,right)) -> left*right>=0.))
        let tryJoinAtOneEndpoint first second =
            let endpoints path = [true,List.head path.Points,path.StartClosed; false,List.last path.Points,path.EndClosed]
            let shared =
                endpoints first
                |> List.collect (fun (firstStarts,firstPoint,firstClosed) ->
                    endpoints second
                    |> List.choose (fun (secondStarts,secondPoint,secondClosed) ->
                        if firstClosed && secondClosed && samePoint firstPoint secondPoint then Some (firstStarts,secondStarts) else None))
            match shared with
            | [firstStarts,secondStarts] when hasNoInteriorIntersection first && hasNoInteriorIntersection second ->
                // Orient both paths from one outer endpoint, through their only
                // shared endpoint, to the other outer endpoint.
                let before = if firstStarts then reversePath first else first
                let after = if secondStarts then second else reversePath second
                Some { before with
                         Points=joinPoints before.Points after.Points
                         EndClosed=after.EndClosed }
            | _ -> None
        let tryJoinRegions (firstPaths: NumericCurvePath list) (secondPaths: NumericCurvePath list) =
            if solution.HasRounding || firstPaths.Length<>secondPaths.Length then None
            else
                (firstPaths,secondPaths)
                ||> List.map2 tryJoinAtOneEndpoint
                |> List.fold (fun joined candidate ->
                    match joined,candidate with
                    | Some accumulated,Some path -> Some (path::accumulated)
                    | _ -> None) (Some [])
                |> Option.map (List.rev >> List.map List.singleton)
        let flights =
            match families with
            | [ [first]; [second] ] when first.Points.Length>2 && second.Points.Length>2 &&
                    samePoint (List.head first.Points) (List.head second.Points) &&
                    samePoint (List.last first.Points) (List.last second.Points) &&
                    hasNoInteriorIntersection first && hasNoInteriorIntersection second ->
                // Circles, ovals and leaf-shaped loops can combine their two
                // branches without retracing or passing an internal junction.
                let joined=joinPoints first.Points (List.rev second.Points)
                let openLoop=joined |> List.take (joined.Length-1)
                let offset=
                    match preferredTarget with
                    | Some (x,y) -> openLoop |> List.mapi (fun index (a,b) -> index,(a-x)*(a-x)+(b-y)*(b-y)) |> List.minBy snd |> fst
                    | None -> 0
                let rotated=(openLoop |> List.skip offset) @ (openLoop |> List.take offset)
                [[{ first with Points=rotated @ [List.head rotated] }]]
            | [firstPaths;secondPaths] ->
                // Separate real x-regions are separate connected components of
                // the locus. Within each region, join the two height branches
                // through their one shared tip and launch from an outer endpoint.
                // Rounded relations deliberately keep one traveller per height
                // solution so their jumps retain the authored step semantics.
                tryJoinRegions firstPaths secondPaths |> Option.defaultValue families
            | _ -> families
        let resampleAnchored path =
            let points=path.Points
            let indices=points |> List.mapi (fun index (px,py) -> index,px,py)
                        |> List.choose (fun (index,px,py) ->
                            if index=0 || index=points.Length-1 || abs py<0.000000001 ||
                               checkpointXs |> List.exists (fun x -> abs (x-px)<0.000000001) then Some index else None)
            let pieces=indices |> List.pairwise |> List.map (fun (first,last) -> {path with Points=points[first..last]})
            {path with Points=if pieces.IsEmpty then points else resampleRoute pieces}
        let playbackFlights = flights |> List.map (List.map resampleAnchored)
        rawPaths |> List.map snd |> List.distinctBy (fun path -> path.Points) |> mergeConnectedPaths,playbackFlights

    let private playbackData flights =
        let playback = ResizeArray<float*float>()
        let breaks = ResizeArray<int>()
        let ranges = ResizeArray<int*int>()
        for flight in flights do
            let first=playback.Count
            for path in flight do
                if not path.Points.IsEmpty then
                    if playback.Count>0 then breaks.Add(playback.Count)
                    for point in path.Points do playback.Add(point)
            if playback.Count>first then ranges.Add(first,playback.Count-1)
        playback |> Seq.toList,breaks |> Seq.toList,ranges |> Seq.toList

    type private PictureTarget = { Paths: NumericCurvePath list }
    let private pictureTargetCache = Dictionary<int,PictureTarget>()
    let private pictureTargetOrder = Queue<int>()
    let private pictureCacheGate = System.Object()
    let private boundedCached (cache: Dictionary<'key,'value>) (order: Queue<'key>) key create =
        match lock pictureCacheGate (fun () -> match cache.TryGetValue(key) with | true,value -> Some value | _ -> None) with
        | Some value -> value
        | None ->
            let value = create()
            lock pictureCacheGate (fun () ->
                match cache.TryGetValue(key) with
                | true,cached -> cached
                | _ ->
                    if cache.Count >= 256 then cache.Remove(order.Dequeue()) |> ignore
                    cache[key] <- value
                    order.Enqueue(key)
                    value)
    let private pictureTarget (source: int) (relation: bool) =
        boundedCached pictureTargetCache pictureTargetOrder source (fun () ->
            let outlineText = outlineDefinitions[source]
            let target =
                match Piecewise.fromExpression x maxSegments sourceEndpoints[source-1] (MathS.FromString(outlineText)) with
                | Ok fn -> fn
                | Error message -> invalidInput "outline" message
            let fromPoint,toPoint =
                cropDefinitions
                |> Map.tryFind source
                |> Option.map snd
                |> Option.map (fun required -> Piecewise.parseRational required.From,Piecewise.parseRational required.To)
                |> Option.defaultValue (Piecewise.zero,Piecewise.ofInt sourceEndpoints[source-1])
            let target = Piecewise.crop fromPoint toPoint target
            let goals = targets[source-1] |> List.map (fun (goalX,goalY) -> { X=goalX;Y=goalY })
            let samples = piecewiseSampleXs goals [target] sourceEndpoints[source-1]
                          |> List.filter (fun point -> Piecewise.compareRational point fromPoint >= 0 && Piecewise.compareRational point toPoint <= 0)
            let paths =
                if relation then
                    let solution = solveHeightSquaredRelation (Piecewise.presentation target).Simplified
                    relationCurveData samples [] None None solution |> fst
                else piecewisePathsWithEvaluators samples (numericSegments target)
            { Paths=paths })

    type private ExactOutputRange = (Piecewise.Rational*Piecewise.Rational) option
    type private SegmentedStageCore = {
        Stage: Piecewise.Function
        Presentation: Piecewise.Presentation
        Values: Entity list
        Evaluators: NumericSegment list
    }
    type private SegmentedBaseEvaluation = {
        Stages: Piecewise.Function list
        StageRanges: ExactOutputRange list
        FinalDegree: int option
        FinalRange: ExactOutputRange
        PresentationGoals: Goal list
        SampleXs: Piecewise.Rational list
        StagePresentations: Piecewise.Presentation list
        StageValues: Entity list list
        StageEvaluators: NumericSegment list list
        StagePoints: (float*float) list list
        StagePaths: NumericCurvePath list list
        StageJsonTemplates: JsonNode list
        ConstructedLatex: string
    }
    let private segmentedBaseCache = Dictionary<string,SegmentedBaseEvaluation>()
    let private segmentedBaseOrder = Queue<string>()
    let private segmentedBaseGate = System.Object()
    let private segmentedStageCache = Dictionary<string,SegmentedStageCore>()
    let private segmentedStageOrder = Queue<string>()
    let private segmentedStageGate = System.Object()
    let private segmentedContextKey s (presentationGoals: Goal list) =
        let goals = presentationGoals |> List.map (fun goal -> goal.X+"\u001f"+goal.Y) |> String.concat "\u001e"
        String.concat "\u001d" [string s.Source;s.Mode;goals]
    let private segmentedBaseKey s =
        let goals = s.Goals |> List.map (fun goal -> goal.X+"\u001f"+goal.Y) |> String.concat "\u001e"
        let nodes = s.Nodes |> List.map (fun node -> node.Id+"\u001f"+node.Op) |> String.concat "\u001e"
        String.concat "\u001d" [string s.Source;s.Mode;goals;nodes]
    let private cachedSegmentedStage key create =
        match lock segmentedStageGate (fun () ->
            match segmentedStageCache.TryGetValue(key) with | true,value -> Some value | _ -> None) with
        | Some cached -> cached
        | None ->
            let computed = create()
            lock segmentedStageGate (fun () ->
                match segmentedStageCache.TryGetValue(key) with
                | true,cached -> cached
                | _ ->
                    if segmentedStageCache.Count >= 256 then segmentedStageCache.Remove(segmentedStageOrder.Dequeue()) |> ignore
                    segmentedStageCache[key] <- computed
                    segmentedStageOrder.Enqueue(key)
                    computed)
    let private buildSegmentedBase s =
        let presentationGoals : Goal list =
            if s.Mode = "remix" && List.isEmpty s.Goals then
                targets[s.Source-1] |> List.map (fun (goalX,_) -> { X=goalX; Y="0" })
            else s.Goals
        let contextKey = segmentedContextKey s presentationGoals
        let initialStage = Piecewise.create sourceEntities[s.Source-1] sourceEndpoints[s.Source-1]
        let sourceRange = Piecewise.tryAffineRange x initialStage
        let mutable previous = initialStage
        let mutable operationPrefix = ""
        let stageCores =
            [0..s.Nodes.Length]
            |> List.map (fun index ->
                if index > 0 then
                    let op = s.Nodes[index-1].Op
                    operationPrefix <- operationPrefix+"\u001f"+op
                let key = contextKey+"\u001d"+operationPrefix
                let core =
                    cachedSegmentedStage key (fun () ->
                        let stage =
                            if index = 0 then initialStage
                            else
                                match Piecewise.apply x maxSegments s.Nodes[index-1].Op previous with
                                | Ok next -> next
                                | Error message -> invalidInput "preview" message
                        let values =
                            presentationGoals |> List.map (fun goal ->
                                Piecewise.evaluateAt x (Piecewise.parseRational goal.X) stage)
                        let known =
                            (presentationGoals,values)
                            ||> List.map2 (fun goal value ->
                                Piecewise.toFloat (Piecewise.parseRational goal.X),value |> asFloat |> checkedPreviewValue)
                            |> Map.ofList
                        let evaluators =
                            numericSegments stage |> List.map (fun evaluator ->
                                if Piecewise.hasSymbolicRounding evaluator.Segment.Expression then
                                    { evaluator with Evaluate=fun point -> Map.tryFind point known |> Option.defaultWith (fun () -> evaluator.Evaluate point) }
                                else evaluator)
                        { Stage=stage
                          Presentation=Piecewise.presentation stage
                          Values=values
                          Evaluators=evaluators })
                previous <- core.Stage
                core)
        let stages = stageCores |> List.map (fun core -> core.Stage)
        let sampleXs = piecewiseSampleXs presentationGoals stages sourceEndpoints[s.Source-1]
        let stageValues = stageCores |> List.map (fun core -> core.Values)
        let stageEvaluators = stageCores |> List.map (fun core -> core.Evaluators)
        let stagePoints =
            (stages,stageEvaluators)
            ||> List.map2 (fun stage evaluators ->
                sampleXs |> List.map (fun point -> Piecewise.toFloat point,numericAt point stage evaluators))
        let stagePresentations = stageCores |> List.map (fun core -> core.Presentation)
        let stageRanges =
            [0..s.Nodes.Length]
            |> List.map (fun count -> exactOutputRange sourceRange (List.take count s.Nodes))
        let stagePaths = stageEvaluators |> List.map (piecewisePathsWithEvaluators sampleXs)
        let stageJsonTemplates =
            List.zip stages stagePresentations |> List.mapi (fun index (stage,presentation) ->
                let points = stagePoints[index] |> List.map (fun (point,height) -> arr [flt point;flt height])
                let values = stageValues[index]
                let paths = stagePaths[index] |> List.map (fun path ->
                    let json=pathJson path
                    if stage.Segments |> List.exists (fun segment -> Piecewise.hasSymbolicRounding segment.Expression) then
                        json["approximateEnds"]<-boolean true
                    json)
                let json = obj [
                    "id",str (if index=0 then "source" else s.Nodes[index-1].Id)
                    "expression",str presentation.ExpressionText; "latex",str presentation.Latex
                    "points",arr points
                    "paths",arr paths
                    "values",arr (values |> List.map (fun value -> str (value.ToString())))
                    "valueLatex",arr (values |> List.map (fun value -> str (value.Latexize()))) ]
                if index > 0 && s.Nodes[index-1].Op = "S" then
                    let incoming = stages[index-1]
                    let incomingEvaluators = stageEvaluators[index-1]
                    json["projection"] <- arr (sampleXs |> List.map (fun point ->
                        let angle = Math.PI * numericAt point incoming incomingEvaluators / 2.
                        arr [flt (Math.Cos(angle));flt (Math.Sin(angle))]))
                json)
        { Stages=stages
          StageRanges=stageRanges
          FinalDegree=polynomialDegree s |> fst
          FinalRange=List.last stageRanges
          PresentationGoals=presentationGoals
          SampleXs=sampleXs
          StagePresentations=stagePresentations
          StageValues=stageValues
          StageEvaluators=stageEvaluators
          StagePoints=stagePoints
          StagePaths=stagePaths
          StageJsonTemplates=stageJsonTemplates
          ConstructedLatex=constructedLatex s }
    let private segmentedBaseEvaluation s =
        let key = segmentedBaseKey s
        match lock segmentedBaseGate (fun () ->
            match segmentedBaseCache.TryGetValue(key) with | true,value -> Some value | _ -> None) with
        | Some cached -> cached
        | None ->
            let computed = buildSegmentedBase s
            lock segmentedBaseGate (fun () ->
                match segmentedBaseCache.TryGetValue(key) with
                | true,cached -> cached
                | _ ->
                    if segmentedBaseCache.Count >= 64 then segmentedBaseCache.Remove(segmentedBaseOrder.Dequeue()) |> ignore
                    segmentedBaseCache[key] <- computed
                    segmentedBaseOrder.Enqueue(key)
                    computed)

    let private segmentedPolynomialResultJson s =
        let baseEvaluation = segmentedBaseEvaluation s
        let stages = baseEvaluation.Stages
        let final = List.last stages
        let cropBounds =
            s.Crop |> Option.map (fun crop -> Piecewise.parseRational crop.From,Piecewise.parseRational crop.To)
        let outputFinal =
            match cropBounds with
            | Some (fromPoint,toPoint) -> Piecewise.crop fromPoint toPoint final
            | None -> final
        let finalDegree = baseEvaluation.FinalDegree
        let finalRange = baseEvaluation.FinalRange
        let relation = isHeightSquaredSource s.Source
        let presentationGoals = baseEvaluation.PresentationGoals
        let sampleXs = baseEvaluation.SampleXs
        let outputSampleXs =
            match cropBounds with
            | None -> sampleXs
            | Some (fromPoint,toPoint) ->
                fromPoint :: toPoint :: Piecewise.boundaries outputFinal @ sampleXs
                |> List.filter (fun point -> Piecewise.compareRational point fromPoint >= 0 && Piecewise.compareRational point toPoint <= 0)
                |> List.distinct
                |> List.sortWith Piecewise.compareRational
        let stagePresentations = baseEvaluation.StagePresentations
        let finalPresentation = Piecewise.presentation outputFinal
        let relationSolution =
            if relation then Some (solveHeightSquaredRelation finalPresentation.Simplified) else None
        let relationPaths,playbackPaths =
            match relationSolution with
            | Some solution ->
                let checkpointXs = presentationGoals |> List.map (fun goal -> Piecewise.toFloat (Piecewise.parseRational goal.X))
                let preferredTarget =
                    presentationGoals
                    |> List.tryHead
                    |> Option.map (fun goal ->
                        Piecewise.toFloat (Piecewise.parseRational goal.X),
                        exactConstant "goals" goal.Y |> asFloat)
                relationCurveData outputSampleXs checkpointXs preferredTarget finalDegree solution
            | None -> [],[]
        let playback,breaks,flights = playbackData playbackPaths
        let exactLatexCache = Dictionary<string,string>()
        let exactNumberCache = Dictionary<string,float>()
        let exactEqualityCache = Dictionary<string,bool>()
        let exactLatex (value: Entity) =
            let key = value.ToString()
            match exactLatexCache.TryGetValue(key) with
            | true,cached -> cached
            | false,_ ->
                // Exact substitutions are already InnerSimplified. Rendering
                // that entity is exact and avoids a second general-purpose
                // Simplify pass for every table/stage occurrence.
                let rendered = value.Latexize()
                exactLatexCache[key] <- rendered
                rendered
        let exactNumber (value: Entity) =
            let key = value.ToString()
            match exactNumberCache.TryGetValue(key) with
            | true,cached -> cached
            | false,_ ->
                let numeric = value |> asFloat |> checkedPreviewValue
                exactNumberCache[key] <- numeric
                numeric
        let cachedExactEqual (left: Entity) (right: Entity) =
            let key = left.ToString()+"\u001f"+right.ToString()
            match exactEqualityCache.TryGetValue(key) with
            | true,cached -> cached
            | false,_ ->
                let equal = exactEqual left right
                exactEqualityCache[key] <- equal
                equal
        let proveSineLandmark inputRange input expected =
            match inputRange,Piecewise.tryRationalEntity expected with
            | Some (low,high),Some target when target = Piecewise.negate Piecewise.one || target = Piecewise.zero || target = Piecewise.one ->
                let first,last = Piecewise.ceilRational low,Piecewise.floorRational high
                if last < first || last-first > BigInteger(256) then None
                else
                    let expectedRemainder =
                        if target = Piecewise.zero then None
                        elif target = Piecewise.one then Some BigInteger.One
                        else Some (BigInteger(3))
                    let candidates = ResizeArray<BigInteger>()
                    let mutable candidate = first
                    while candidate <= last do
                        let remainder = candidate % BigInteger(4)
                        let normalized = if remainder.Sign < 0 then remainder+BigInteger(4) else remainder
                        let applies =
                            match expectedRemainder with
                            | None -> normalized = BigInteger.Zero || normalized = BigInteger(2)
                            | Some expected -> normalized = expected
                        if applies then candidates.Add(candidate)
                        candidate <- candidate+BigInteger.One
                    Some (candidates |> Seq.exists (fun value ->
                        cachedExactEqual input (Piecewise.ofBigInteger value |> Piecewise.toEntity)))
            | _ -> None
        let stageValues = baseEvaluation.StageValues
        let stageEvaluators = baseEvaluation.StageEvaluators
        let stagePoints = baseEvaluation.StagePoints
        let stagePaths = baseEvaluation.StagePaths
        let finalValues = List.last stageValues
        let sineInputs =
            match List.tryLast s.Nodes with
            | Some node when node.Op = "S" && stageValues.Length > 1 ->
                Some (stageValues[stageValues.Length-2],baseEvaluation.StageRanges[baseEvaluation.StageRanges.Length-2])
            | _ -> None
        let checkpoints =
            List.zip presentationGoals finalValues |> List.mapi (fun index (goal,actual) ->
                let point = Piecewise.parseRational goal.X
                let authoredTarget = exactConstant "goals" goal.Y
                let authoredTargetNumber = exactNumber authoredTarget
                let authoredTargetLatex = exactLatex authoredTarget
                let expected = if relation then authoredTarget.Pow(rational "2").InnerSimplified else authoredTarget
                let defined = Piecewise.isDefinedAt point outputFinal
                let checkpoint =
                    if not defined then
                        obj [ "x",str goal.X; "target",str goal.Y; "actual",str "undefined"
                              "targetNumber",flt authoredTargetNumber; "targetLatex",str authoredTargetLatex
                              "actualLatex",str "\\varnothing"; "defined",boolean false
                              "hit",boolean false; "y",flt authoredTargetNumber ]
                    else
                        let actualNumber = exactNumber actual
                        let actualLatex = exactLatex actual
                        let hit =
                            if rangeProvesMismatch finalRange expected then false
                            else
                                match sineInputs with
                                | Some (inputs,inputRange) ->
                                    proveSineLandmark inputRange inputs[index] expected
                                    |> Option.defaultWith (fun () -> cachedExactEqual actual expected)
                                | None -> cachedExactEqual actual expected
                        let y = if relation then authoredTargetNumber else actualNumber
                        obj [ "x",str goal.X; "target",str goal.Y; "actual",str (actual.ToString())
                              "targetNumber",flt authoredTargetNumber; "targetLatex",str authoredTargetLatex
                              "actualLatex",str actualLatex; "actualNumber",flt actualNumber
                              "defined",boolean true; "hit",boolean hit; "y",flt y ]
                match cropBounds with
                | Some (fromPoint,toPoint) ->
                    let phase =
                        if not defined then 1.
                        else
                            let numerator = Piecewise.subtract point fromPoint
                            let denominator = Piecewise.subtract toPoint fromPoint
                            Piecewise.divide numerator denominator |> Piecewise.toFloat |> max 0. |> min 1.
                    checkpoint["phase"] <- flt phase
                | None -> ()
                if relation then
                    checkpoint["lhs"] <- str (expected.ToString())
                    checkpoint["rhs"] <- str (if defined then actual.ToString() else "undefined")
                    if defined then
                        let targetX,targetY = Piecewise.toFloat point,authoredTarget |> asFloat
                        let phase =
                            if playback.IsEmpty then 1.
                            else
                                playback
                                |> List.mapi (fun index (px,py) -> index,(px-targetX)*(px-targetX)+(py-targetY)*(py-targetY))
                                |> List.minBy snd
                                |> fst
                                |> fun index -> if playback.Length <= 1 then 1. else float index / float (playback.Length-1)
                        checkpoint["phase"] <- flt phase
                    else
                        // A target outside the kept interval is confirmed as a
                        // miss when the cropped flight finishes.
                        checkpoint["phase"] <- flt 1.
                checkpoint)
        let stageJson = baseEvaluation.StageJsonTemplates |> List.map (fun template -> template.DeepClone())
        let finalKnown =
            (presentationGoals,finalValues)
            ||> List.map2 (fun goal value -> Piecewise.toFloat (Piecewise.parseRational goal.X),exactNumber value)
            |> Map.ofList
        let finalBaseEvaluators = List.last baseEvaluation.StageEvaluators
        let outputEvaluators =
            outputFinal.Segments
            |> List.map (fun segment ->
                finalBaseEvaluators
                |> List.tryFind (fun evaluator -> evaluator.Segment.Expression = segment.Expression)
                |> Option.map (fun evaluator -> { evaluator with Segment=segment })
                |> Option.defaultWith (fun () -> numericSegments { outputFinal with Segments=[segment] } |> List.head))
            |> List.map (fun evaluator ->
                if Piecewise.hasSymbolicRounding evaluator.Segment.Expression then
                    { evaluator with Evaluate=fun point -> Map.tryFind point finalKnown |> Option.defaultWith (fun () -> evaluator.Evaluate point) }
                else evaluator)
        let outputPoints =
            outputSampleXs
            |> List.choose (fun point ->
                if Piecewise.isDefinedAt point outputFinal then Some (Piecewise.toFloat point,numericAt point outputFinal outputEvaluators)
                else None)
        let points = outputPoints |> List.map (fun (point,height) -> arr [flt point;flt height])
        let outputPaths = piecewisePathsWithEvaluators outputSampleXs outputEvaluators
        let finalPaths = outputPaths |> List.map (fun path ->
            let json=pathJson path
            if outputFinal.Segments |> List.exists (fun segment -> Piecewise.hasSymbolicRounding segment.Expression) then json["approximateEnds"]<-boolean true
            json)
        let startPoint = cropBounds |> Option.map fst |> Option.defaultValue Piecewise.zero
        let startSlope = Piecewise.rightSlopeAt x startPoint outputFinal |> asFloat |> checkedPreviewValue
        let cropHit,requiredBounds =
            if s.Mode <> "puzzle" then true,None
            else
                match (cropDefinitions |> Map.tryFind s.Source),s.Crop with
                | Some (_,required),Some current ->
                    let hit = Piecewise.parseRational current.From = Piecewise.parseRational required.From &&
                              Piecewise.parseRational current.To = Piecewise.parseRational required.To
                    hit,Some (Piecewise.parseRational required.From,Piecewise.parseRational required.To)
                | Some _,None -> false,None
                | None,_ -> true,None
        let pictureData =
            if s.Mode <> "puzzle" then None
            else
                outlineDefinitions |> Map.tryFind s.Source |> Option.map (fun _ ->
                    (pictureTarget s.Source relation).Paths)
        let constructed =
            match cropBounds with
            | None -> baseEvaluation.ConstructedLatex
            | Some (fromPoint,toPoint) ->
                sprintf "%s \\quad \\text{for} \\quad %s"
                    baseEvaluation.ConstructedLatex (Piecewise.intervalConditionLatex fromPoint toPoint)
        let result = obj [
            "constructedLatex",str constructed
            "stages",arr stageJson; "checkpoints",arr checkpoints; "points",arr points
            "paths",arr finalPaths
            "startSlope",flt startSlope
            "solved",boolean (s.Mode<>"remix" && cropHit && checkpoints |> List.forall (fun checkpoint -> checkpoint["hit"].GetValue<bool>())) ]
        match s.Crop with
        | Some crop ->
            let fromPoint,toPoint = Piecewise.parseRational crop.From,Piecewise.parseRational crop.To
            let cropResult = obj [
                "from",str crop.From; "to",str crop.To
                "fromNumber",flt (Piecewise.toFloat fromPoint); "toNumber",flt (Piecewise.toFloat toPoint)
                "editable",boolean (s.Mode = "remix"); "hit",boolean cropHit ]
            match requiredBounds with
            | Some (requiredFrom,requiredTo) ->
                cropResult["required"] <- obj ["from",str (Piecewise.rationalText requiredFrom);"to",str (Piecewise.rationalText requiredTo)]
            | None -> ()
            result["crop"] <- cropResult
            result["equationLatex"] <- str (sprintf "%s = %s" (if relation then "h^{2}" else "h") (Piecewise.providedLatex finalPresentation.Simplified))
        | None -> ()
        match pictureData with
        | Some paths ->
            result["picture"] <- obj ["paths",arr (paths |> List.map pathJson)]
        | None -> ()
        if relation then
            let solution = relationSolution.Value
            result["relation"] <- obj [
                "kind",str "height-squared"
                "equationLatex",str (sprintf "h^{2} = %s" finalPresentation.Latex)
                "solvedLatex",str solution.Latex
                "solvedLines",arr (solution.Lines |> List.map (fun line -> obj [
                    "heightLatex",str line.HeightLatex
                    "conditionLatex",str line.ConditionLatex ]))
                "paths",arr (relationPaths |> List.map (fun path ->
                    let json=pathJson path
                    if final.Segments |> List.exists (fun segment -> Piecewise.hasSymbolicRounding segment.Expression) then json["approximateEnds"]<-boolean true
                    json))
                "playback",arr (playback |> List.map (fun (px,py) -> arr [flt px;flt py]))
                "breaks",arr (breaks |> List.map num)
                "flights",arr (flights |> List.map (fun (first,last) -> arr [num first;num last])) ]
        elif s.Mode = "puzzle" && s.Source >= 3 then
            let fromGoal = s.Goals |> List.reduce (fun best candidate -> if compareGoalHeight candidate best < 0 then candidate else best)
            let toGoal = s.Goals |> List.reduce (fun best candidate -> if compareGoalHeight candidate best > 0 then candidate else best)
            let fromIndex = presentationGoals |> List.findIndex (fun goal -> goal.X = fromGoal.X)
            let toIndex = presentationGoals |> List.findIndex (fun goal -> goal.X = toGoal.X)
            let gap (values: Entity list) =
                let fromValue,toValue = values[fromIndex],values[toIndex]
                fromValue,toValue,(toValue-fromValue).InnerSimplified
            let targetGap = (exactConstant "goals" toGoal.Y-exactConstant "goals" fromGoal.Y).InnerSimplified
            let _,_,actualGap = gap finalValues
            result["heightGuide"] <- obj [
                "fromX",str fromGoal.X; "toX",str toGoal.X; "target",str (targetGap.ToString())
                "targetLatex",str (exactLatex targetGap)
                "targetNumber",flt (exactNumber targetGap)
                "actual",str (actualGap.ToString()); "actualLatex",str (exactLatex actualGap)
                "hit",boolean (cachedExactEqual actualGap targetGap)
                "stages",arr (stageValues |> List.map (fun values ->
                    let fromValue,toValue,stageGap = gap values
                    obj [ "from",str (fromValue.ToString()); "to",str (toValue.ToString()); "gap",str (stageGap.ToString())
                          "fromLatex",str (exactLatex fromValue); "toLatex",str (exactLatex toValue)
                          "gapLatex",str (exactLatex stageGap)
                          "fromNumber",flt (exactNumber fromValue)
                          "toNumber",flt (exactNumber toValue)
                          "gapNumber",flt (exactNumber stageGap) ])) ]
        result

    let polynomialResultJson s =
        if Option.isSome s.Crop || Map.containsKey s.Source outlineDefinitions || isHeightSquaredSource s.Source || sineSources[s.Source-1] || s.Nodes |> List.exists (fun node -> List.contains node.Op ["S";"F";"C"])
        then segmentedPolynomialResultJson s
        else continuousPolynomialResultJson s

    let circleProbeGoals (circle: Circle) : Goal list =
        let centreX,centreY,radius = rational circle.X,rational circle.Y,rational circle.Radius
        [ "3/5","4/5"; "-4/5","3/5"; "0","-1" ]
        |> List.map (fun (offsetX,offsetY) ->
            let targetX = (centreX + radius * rational offsetX).Evaled
            let targetY = (centreY + radius * rational offsetY).Evaled
            { X=targetX.ToString(); Y=targetY.ToString() })
    let circleEquation circle =
        let centreX,centreY,radius = rational circle.X,rational circle.Y,rational circle.Radius
        let radiusSquared = radius.Pow(rational "2").Simplify()
        let right = (radiusSquared - (x - centreX).Pow(rational "2")).Simplify()
        let differenceLatex variable centre =
            let zero = rational "0"
            let relation = compareExact centre zero
            if relation = 0 then variable
            elif relation > 0 then sprintf "\\left(%s - %s\\right)" variable (centre.Latexize())
            else sprintf "\\left(%s + %s\\right)" variable ((-centre).Latexize())
        let leftLatex = sprintf "%s^{2}" (differenceLatex "h" centreY)
        let latex = sprintf "%s = %s" leftLatex (right.Latexize())
        let constructedDifferenceLatex variable centre =
            let zero = rational "0"
            let relation = compareExact centre zero
            if relation = 0 then variable
            elif relation > 0 then sprintf "\\left(%s - %s\\right)" variable (centre.Latexize())
            else sprintf "\\left(%s + %s\\right)" variable ((-centre).Evaled.Latexize())
        let constructed =
            sprintf "%s^{2} = \\left(%s\\right)^{2} - %s^{2}"
                (constructedDifferenceLatex "h" centreY) (radius.Latexize()) (constructedDifferenceLatex "x" centreX)
        let expression = sprintf "%s^2 = %s" (differenceLatex "h" centreY) (right.ToString())
        expression,latex,constructed,radiusSquared
    let circleResultJson s circle =
        let centreXEntity,centreYEntity,radiusEntity = rational circle.X,rational circle.Y,rational circle.Radius
        let centreX,centreY,radius = asFloat centreXEntity,asFloat centreYEntity,asFloat radiusEntity
        let expression,equationLatex,constructedLatex,radiusSquared = circleEquation circle
        let presentationGoals = if s.Mode = "remix" && s.Goals.IsEmpty then circleProbeGoals circle else s.Goals
        let checkpointData =
            presentationGoals
            |> List.mapi (fun index goal ->
                let targetX,targetY = rational goal.X,rational goal.Y
                let dx,dy = (targetX - centreXEntity).Evaled,(targetY - centreYEntity).Evaled
                let dxSquared,dySquared = dx.Pow(rational "2").Evaled,dy.Pow(rational "2").Evaled
                let lhs = (dxSquared + dySquared).Evaled
                let dxFloat,dyFloat = asFloat dx,asFloat dy
                let angle =
                    if dx = rational "0" && dy = rational "0" then 0.
                    else
                        let raw = Math.Atan2(dyFloat,dxFloat)
                        if raw < 0. then raw + 2. * Math.PI else raw
                let phase = angle / (2. * Math.PI)
                let checkpoint = obj [
                    "x",str goal.X; "target",str goal.Y; "actual",str (lhs.ToString())
                    "actualLatex",str ((lhs.Simplify()).Latexize()); "actualNumber",flt (asFloat lhs)
                    "hit",boolean (exactEqual lhs radiusSquared); "y",flt (asFloat targetY)
                    "phase",flt phase; "dx",str (dx.ToString()); "dy",str (dy.ToString())
                    "dxSquared",str (dxSquared.ToString()); "dySquared",str (dySquared.ToString())
                    "lhs",str (lhs.ToString()); "rhs",str (radiusSquared.ToString()) ]
                phase,index,checkpoint)
        let checkpoints = checkpointData |> List.map (fun (_,_,checkpoint) -> checkpoint)
        let pointCoordinates =
            [0..160] |> List.map (fun index ->
                if index = 160 then centreX + radius,centreY
                else
                    let angle = 2. * Math.PI * float index / 160.
                    centreX + radius * Math.Cos(angle),centreY + radius * Math.Sin(angle))
        let pointsJson () = pointCoordinates |> List.map (fun (px,py) -> arr [flt px;flt py]) |> arr
        let stage = obj [
            "id",str "source"; "expression",str expression; "latex",str equationLatex
            "points",pointsJson()
            "values",arr (checkpoints |> List.map (fun checkpoint -> str (stringField checkpoint "lhs")))
            "valueLatex",arr (checkpoints |> List.map (fun checkpoint ->
                stringField checkpoint "lhs" |> rational |> fun value -> str ((value.Simplify()).Latexize()))) ]
        let allX = 0. :: (centreX-radius) :: (centreX+radius) :: (presentationGoals |> List.map (fun goal -> asFloat (rational goal.X)))
        let allY = 0. :: (centreY-radius) :: (centreY+radius) :: (presentationGoals |> List.map (fun goal -> asFloat (rational goal.Y)))
        let bounds = obj [
            "minX",flt ((List.min allX) - 1.); "maxX",flt ((List.max allX) + 1.)
            "minY",flt ((List.min allY) - 1.); "maxY",flt ((List.max allY) + 1.) ]
        let definition = circleDefinitions[s.Source]
        let editable = if s.Mode = "puzzle" then definition.Editable else ["x";"y";"radius"]
        let initialCircle = if s.Mode = "puzzle" then definition.Initial else defaultCircle
        let circleMetadata = obj [
            "equationLatex",str equationLatex; "radiusSquared",str (radiusSquared.ToString())
            "centre",arr [flt centreX;flt centreY]; "radius",flt radius
            "editable",arr (editable |> List.map str); "bounds",bounds
            "tangent",arr [flt 0.;flt 1.]; "initial",circleJson initialCircle ]
        obj [
            "constructedLatex",str constructedLatex
            "stages",arr [stage]; "checkpoints",arr checkpoints; "points",pointsJson()
            "startSlope",flt 0.; "solved",boolean (s.Mode <> "remix" && (checkpoints |> List.forall (fun checkpoint -> checkpoint["hit"].GetValue<bool>())))
            "circle",circleMetadata ]
    let resultJson s =
        match s.Circle with
        | Some circle -> circleResultJson s circle
        | None -> polynomialResultJson s
    let importArtifact (n: JsonNode) =
        keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "goals"; "inventory"; "limit"; "circle"; "crop" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then invalidInput "version" "Unsupported file version."
        if not (isNull n["view"]) && not (List.contains (stringField n "view") ["flight";"function";"flow"]) then invalidInput "view" "Unknown presentation."
        let source = intField n "sourceId"
        let s = initial source "remix"
        let artifactCrop =
            match n with
            | :? JsonObject as artifact when artifact.ContainsKey("crop") -> Some (readCrop source artifact["crop"])
            | _ -> None
        match stringField n "type" with
        | "creation" ->
            if isCircleSource source then
                keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "circle" ]
                { s with Nodes=readNodes (field n "nodes"); Circle=Some (readCircle (field n "circle")) } |> validate
            else
                keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "crop" ]
                { s with Nodes=readNodes (field n "nodes"); Crop=artifactCrop } |> validate
        | "challenge" ->
            keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "view"; "goals"; "inventory"; "limit"; "crop" ]
            { s with Mode="challenge"; Goals=readGoals source false true artifactCrop (field n "goals")
                     Inventory=readInventory (field n "inventory"); Limit=intField n "limit"; Crop=artifactCrop } |> validate
        | _ -> invalidInput "type" "Choose a creation or challenge file."
    let command s (a: JsonNode) =
        match stringField a "type" with
        | "evaluate" | "export" -> s
        | "level" -> initial (intField a "sourceId") (stringField a "mode")
        | "import" -> importArtifact (field a "artifact")
        | "reset" ->
            match s.Circle with
            | Some _ ->
                let resetCircle =
                    if s.Mode = "puzzle" then circleDefinitions[s.Source].Initial else defaultCircle
                { s with Circle=Some resetCircle }
            | None ->
                let nodes = s.Station |> Option.map (fun station -> [{ Id=station.Id; Op=station.Op }]) |> Option.defaultValue []
                let crop =
                    if s.Mode = "puzzle" then (initial s.Source "puzzle").Crop
                    elif s.Mode = "challenge" then s.Crop
                    else None
                { s with Nodes=nodes; Crop=crop }
        | "remix" ->
            match s.Circle with
            | Some circle -> { initial s.Source "remix" with Circle=Some circle; Goals=[] }
            | None -> { initial s.Source "remix" with Nodes=s.Nodes; Crop=s.Crop }
        | "source" ->
            if s.Mode <> "remix" then invalidInput "mode" "Starting curves can only be changed in creation mode."
            let source = intField a "sourceId"
            if isCircleSource source then
                if not s.Nodes.IsEmpty then invalidInput "circle" "Circle sources require an explicitly empty operation list."
                let next = initial source "remix"
                { next with Circle=(s.Circle |> Option.orElse next.Circle); Nodes=[]; Goals=[] }
            else
                let next = initial source "remix"
                let crop =
                    match s.Crop with
                    | None -> None
                    | Some current ->
                        let fromPoint,toPoint = Piecewise.parseRational current.From,Piecewise.parseRational current.To
                        let endpoint = Piecewise.ofInt sourceEndpoints[source-1]
                        if Piecewise.compareRational fromPoint endpoint >= 0 then None
                        else
                            let clippedTo = if Piecewise.compareRational toPoint endpoint > 0 then endpoint else toPoint
                            Some { From=Piecewise.rationalText fromPoint; To=Piecewise.rationalText clippedTo }
                { next with Nodes=s.Nodes; Goals=[]; Crop=crop }
        | "circle" ->
            if not (isCircleSource s.Source) then invalidInput "circle" "The current source is not a circle."
            keys a [ "type"; "x"; "y"; "radius" ]
            let circle = readCircle (obj [ "x",str (stringField a "x"); "y",str (stringField a "y"); "radius",str (stringField a "radius") ])
            { s with Circle=Some circle }
        | "crop" ->
            if isCircleSource s.Source then invalidInput "crop" "Circle sources do not support Crop."
            if s.Mode = "challenge" then invalidInput "crop" "A shared challenge keeps its Crop interval fixed."
            if s.Mode = "puzzle" then
                invalidInput "crop" "This puzzle keeps its drawing interval fixed. Crop is editable in Create."
            match a with
            | :? JsonObject as action when action.ContainsKey("clear") && boolField a "clear" ->
                keys a [ "type"; "clear" ]
                if s.Mode <> "remix" then invalidInput "crop" "Authored Crop intervals cannot be removed."
                { s with Crop=None }
            | _ ->
                keys a [ "type"; "from"; "to" ]
                { s with Crop=Some (readCrop s.Source (obj ["from",str (stringField a "from");"to",str (stringField a "to")])) }
        | "insert" ->
            let index = intField a "index"
            if index < 0 || index > s.Nodes.Length then invalidInput "position" "Invalid insertion position."
            let node = readNodes (arr [obj ["id",str (stringField a "id"); "op",str (stringField a "op")]]) |> List.head
            { s with Nodes=(List.take index s.Nodes) @ [node] @ (List.skip index s.Nodes) }
        | "remove" ->
            let id = stringField a "id"
            if not (s.Nodes |> List.exists (fun n -> n.Id=id)) then invalidInput "part" "Part no longer exists."
            if s.Station |> Option.exists (fun station -> station.Id=id) then
                invalidInput "station" "The fixed station cannot be removed."
            { s with Nodes=s.Nodes |> List.filter (fun n -> n.Id<>id) }
        | "move" ->
            let id,index = stringField a "id",intField a "index"
            let node = s.Nodes |> List.tryFind (fun n -> n.Id=id) |> Option.defaultWith (fun () -> invalidInput "part" "Part no longer exists.")
            if s.Station |> Option.exists (fun station -> station.Id=id) then
                invalidInput "station" "The fixed station cannot be moved."
            let remaining = s.Nodes |> List.filter (fun n -> n.Id<>id)
            if index < 0 || index > remaining.Length then invalidInput "position" "Invalid move position."
            { s with Nodes=List.take index remaining @ [node] @ List.skip index remaining }
        | _ -> invalidInput "command" "Unknown game command."
    let exportArtifact s a (result: JsonNode) =
        let kind,view = stringField a "kind",stringField a "view"
        if not (List.contains view ["flight";"function";"flow"]) then invalidInput "view" "Unknown presentation."
        let artifactSource = if kind = "challenge" && Option.isSome s.Circle then 43 else s.Source
        let common = [ "schema",num 1; "rules",str rules; "engine",str engine; "type",str kind; "sourceId",num artifactSource; "view",str view ]
        let cropFields = s.Crop |> Option.map (fun crop -> ["crop",cropJson crop]) |> Option.defaultValue []
        match kind with
        | "creation" ->
            match s.Circle with
            | Some circle -> obj (common @ ["nodes",nodesJson s.Nodes;"circle",circleJson circle])
            | None -> obj (common @ ["nodes",nodesJson s.Nodes] @ cropFields)
        | "challenge" ->
            // The evaluated legal construction is the witness. Its solution is never exported.
            let goals,inventory,limit =
                match s.Circle with
                | Some circle ->
                    let generated = circleProbeGoals circle
                    let radiusSquared = rational circle.Radius |> fun radius -> radius.Pow(rational "2").Evaled
                    for goal in generated do
                        let dx = (rational goal.X - rational circle.X).Evaled
                        let dy = (rational goal.Y - rational circle.Y).Evaled
                        if (dx.Pow(rational "2") + dy.Pow(rational "2")).Evaled <> radiusSquared then
                            invalidInput "export" "This circle cannot be represented as an exact shared challenge."
                    generated,Map.empty,0
                | None when isHeightSquaredSource s.Source ->
                    let referenceGoals : Goal list =
                        if s.Goals.IsEmpty then targets[s.Source-1] |> List.map (fun (goalX,goalY) -> { X=goalX;Y=goalY })
                        else s.Goals
                    let resultCheckpoints = result["checkpoints"] |> array
                    if resultCheckpoints.Length <> referenceGoals.Length then
                        invalidInput "export" "This height-squared construction does not have the required authored checkpoint positions."
                    let generated =
                        List.zip resultCheckpoints referenceGoals
                        |> List.filter (fun (_,referenceGoal) -> goalIsInsideCrop s.Crop referenceGoal.X)
                        |> List.map (fun (checkpoint,referenceGoal) ->
                            let squaredHeight =
                                Piecewise.tryParseRational (stringField checkpoint "actual")
                                |> Option.defaultWith (fun () ->
                                    invalidInput "export" "This height-squared construction needs rational real checkpoint heights before it can be shared as a challenge.")
                            if squaredHeight.Numerator.Sign < 0 then
                                invalidInput "export" "This height-squared construction has no real height at a required checkpoint."
                            let height =
                                MathS.FromString(sprintf "sqrt(%s)" (Piecewise.rationalText squaredHeight)).InnerSimplified
                            let referenceHeight = exactConstant "export" referenceGoal.Y
                            let sign =
                                Piecewise.tryCompareConstants referenceHeight (rational "0")
                                |> Option.defaultWith (fun () -> invalidInput "export" "A checkpoint height sign could not be established exactly.")
                            let signedHeight = if sign < 0 then -height else height
                            if abs (signedHeight |> asFloat) > maxTargetMagnitude then
                                invalidInput "export" "This construction's checkpoint values exceed the supported challenge target range."
                            { X=stringField checkpoint "x"; Y=signedHeight.ToString() })
                    generated,(s.Nodes |> List.countBy (fun node -> node.Op) |> Map.ofList),s.Nodes.Length
                | None ->
                    let generated : Goal list =
                        result["checkpoints"] |> array
                        |> List.filter (fun checkpoint -> goalIsInsideCrop s.Crop (stringField checkpoint "x"))
                        |> List.map (fun checkpoint ->
                            let exact = exactConstant "export" (stringField checkpoint "actual")
                            { X=stringField checkpoint "x";Y=exact.ToString() })
                    for goal in generated do
                        let height = exactConstant "export" goal.Y |> asFloat
                        if not (Double.IsFinite(height)) || abs height > maxTargetMagnitude then
                            invalidInput "export" "This construction's checkpoint values exceed the supported challenge target range."
                    generated,(s.Nodes |> List.countBy (fun node -> node.Op) |> Map.ofList),s.Nodes.Length
            let artifact = obj (common @ ["goals",goalsJson goals;"inventory",inventoryJson inventory;"limit",num limit] @ cropFields)
            // Keep export and import contracts locked together so no successful export can make a broken link.
            try importArtifact artifact |> ignore
            with :? ArgumentException ->
                invalidInput "export" "This construction cannot be represented as a supported challenge."
            artifact
        | _ -> invalidInput "export" "Unknown export type."
    let Run (request: string) : string =
        try
            use budget = MathS.Settings.Budget.Set(WorkBudget(Steps=100000L, Time=Nullable(TimeSpan.FromSeconds(2.))))
            if isNull request || request.Length > 65536 || Encoding.UTF8.GetByteCount(request) > 65536 then
                invalidInput "file" "Requests must be no larger than 64 KiB."
            let input = JsonNode.Parse(request)
            keys input ["state";"action"]
            let before = if isNull input["state"] then initial 1 "puzzle" else readState input["state"]
            let action = field input "action"
            let state = command before action |> validate
            if not (List.contains state.Mode ["puzzle";"remix";"challenge"]) then invalidInput "mode" "Unknown play mode."
            let result = resultJson state
            let response = obj ["status",str "ok";"state",stateJson state;"result",result]
            if stringField action "type" = "export" then response["artifact"] <- exportArtifact state action result
            response.ToJsonString()
        with
        | :? InvalidInput as e -> (obj ["status",str "invalid";"message",str e.UserMessage]).ToJsonString()
        | :? ArgumentException as e -> (obj ["status",str "invalid";"message",str e.Message]).ToJsonString()
        | :? JsonException -> (obj ["status",str "invalid";"message",str "The file is not valid JSON."]).ToJsonString()
        | :? OverflowException -> (obj ["status",str "invalid";"message",str "This construction exceeds the supported preview limits."]).ToJsonString()
        | e -> (obj ["status",str "error";"message",str ("The math engine could not finish this move: " + e.Message)]).ToJsonString()
