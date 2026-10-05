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
    type CircleDefinition = { Initial: Circle; Editable: string list }
    [<CLIMutable>]
    type ExtendedGoal = { x: string; y: string }
    [<CLIMutable>]
    type ExtendedStation = { id: string; op: string; before: int; after: int }
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
                { id=(required element "id").GetInt32()
                  source=(required element "source").GetString()
                  degree=(required element "degree").GetInt32()
                  endpoint=(required element "endpoint").GetInt32()
                  targets=targets; inventory=inventory
                  limit=(required element "limit").GetInt32()
                  station=station
                  relation=(if element.TryGetProperty("relation",&relationElement) then relationElement.GetString() else null) })
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
    let goalsJson (goals: Goal seq) = goals |> Seq.map (fun g -> obj [ "x",str g.X; "y",str g.Y ]) |> arr
    let nodesJson (nodes: Node seq) = nodes |> Seq.map (fun n -> obj [ "id",str n.Id; "op",str n.Op ]) |> arr
    let inventoryJson inventory = inventory |> Map.toList |> List.map (fun (k,v) -> k,num v) |> obj
    let circleJson (circle: Circle) = obj [ "x",str circle.X; "y",str circle.Y; "radius",str circle.Radius ]
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
        { Source=source; Mode=mode; Nodes=nodes
          Goals=goals
          Inventory=(if mode="remix" || isCircleSource source then Map.empty else inventories[source-1])
          Limit=(if mode="remix" || isCircleSource source then 0 else limits[source-1])
          Station=station; Circle=circle }
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
    let readGoals source allowSymbolic n =
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
            if gs.Length <> targets[source-1].Length then invalidInput "goals" "This source has a fixed set of checkpoint positions."
            gs |> List.mapi (fun i n ->
                keys n [ "x"; "y" ]
                let x,y = stringField n "x",stringField n "y"
                if rational x <> rational (fst (targets.[source-1].[i])) then invalidInput "goals" "Checkpoint positions do not match the source."
                if allowSymbolic then exactConstant "goals" y |> ignore
                else
                    let height = asFloat (rational y)
                    if not (Double.IsFinite(height)) || abs height > maxTargetMagnitude then
                        invalidInput "goals" "Checkpoint height is outside the supported challenge range."
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
            if node.Op = "D" && hasRounding then
                invalidInput "preview" "Find slope cannot follow Floor or Ceiling in the current preview."
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
        keys n [ "schema"; "rules"; "engine"; "sourceId"; "mode"; "nodes"; "goals"; "inventory"; "limit"; "station"; "circle" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then
            invalidInput "version" "This save uses an unsupported schema, ruleset or engine."
        let source,mode = intField n "sourceId",stringField n "mode"
        if not (List.contains mode [ "puzzle"; "remix"; "challenge" ]) then invalidInput "mode" "Unknown play mode."
        let baseState = initial source mode
        let goalData = field n "goals"
        let goals =
            if mode = "remix" && (array goalData).IsEmpty then []
            else readGoals source (mode = "puzzle") goalData
        let inventory = readInventory (field n "inventory")
        let limit = intField n "limit"
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
    type private ConstructedVariable = { EntityName: string; Latex: string }
    type private NumericCurvePath = {
        Points: (float * float) list
        StartClosed: bool
        EndClosed: bool
    }
    type private NumericSegment = {
        Segment: Piecewise.Segment
        Evaluate: float -> float
    }
    type private RelationBranch = {
        Expression: Entity
        Domain: Entity
    }
    let private heightSquaredBranchSchema = lazy (
        use _realCodomain = MathS.Settings.Codomain.Set(Domain.Real)
        let solution = (h.Pow(rational "2")-relationRhs).Simplify().SolveEquation(h)
        match solution with
        | :? Entity.Set.FiniteSet as finite ->
            finite.Elements
            |> Seq.map (fun branch ->
                let simplified = branch.Simplify()
                if simplified.Vars |> Seq.exists (fun variable -> variable = h) then
                    invalidInput "preview" "The squared-height relation could not be solved explicitly for h."
                { Expression=simplified; Domain=simplified.DomainConditionIn(Domain.Real).Simplify() })
            |> Seq.distinctBy (fun branch -> branch.Expression.ToString(),branch.Domain.ToString())
            |> Seq.sortBy (fun branch -> branch.Expression.ToString())
            |> Seq.toList
        | _ -> invalidInput "preview" "The squared-height relation could not be solved explicitly for h.")
    let private relationBranchCacheLimit = 256
    let private relationBranchCache = Dictionary<string,RelationBranch list>()
    let private relationBranchCacheOrder = Queue<string>()
    let private relationBranchCacheGate = System.Object()
    let private cachedRelationBranches key create =
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
    }
    type private RelationSolvedLine = {
        HeightLatex: string
        ConditionLatex: string
    }
    type private RelationSolution = {
        Segments: RelationSolvedSegment list
        Latex: string
        Lines: RelationSolvedLine list
    }
    type private RelationEdge = {
        Curve: NumericCurvePath
        StartNode: int
        EndNode: int
    }
    let private constructedLatex s =
        let sourceRenderer (variable: ConstructedVariable) =
            let source = sourceEntities[s.Source-1]
            if variable.EntityName = "x" then source.Latexize()
            else
                let replacement = MathS.FromString(variable.EntityName) :?> Entity.Variable
                source.Substitute(x,replacement).Latexize()
        let renderNode (renderInput: ConstructedVariable -> string) (index,node: Node) : ConstructedVariable -> string =
            match node.Op with
            | "H" -> fun variable -> sprintf "\\frac{1}{2}\\left(%s\\right)" (renderInput variable)
            | "A" -> fun variable -> sprintf "\\left(%s\\right) + 1" (renderInput variable)
            | "N" -> fun variable -> sprintf "-\\left(%s\\right)" (renderInput variable)
            | "Q" -> fun variable -> sprintf "\\left(%s\\right)^{2}" (renderInput variable)
            | "S" -> fun variable ->
                sprintf "\\sin\\left(\\frac{\\pi}{2}\\left(%s\\right)\\right)" (renderInput variable)
            | "F" -> fun variable -> sprintf "\\left\\lfloor %s \\right\\rfloor" (renderInput variable)
            | "C" -> fun variable -> sprintf "\\left\\lceil %s \\right\\rceil" (renderInput variable)
            | "D" -> fun variable ->
                sprintf "\\frac{\\mathrm{d}}{\\mathrm{d}%s}\\left(%s\\right)" variable.Latex (renderInput variable)
            | "I" -> fun variable ->
                let dummy : ConstructedVariable = { EntityName=sprintf "u_%d" (index+1); Latex=sprintf "u_{%d}" (index+1) }
                sprintf "\\int_{0}^{%s}\\left(%s\\right)\\,\\mathrm{d}%s"
                    variable.Latex (renderInput dummy) dummy.Latex
            | _ -> invalidInput "op" "Unknown operation."
        let rendered =
            s.Nodes
            |> List.indexed
            |> List.fold renderNode sourceRenderer
            |> fun render -> render ({ EntityName="x"; Latex="x" } : ConstructedVariable)
        sprintf "%s = %s" (if isHeightSquaredSource s.Source then "h^{2}" else "h") rendered
    let evaluateAt (f: Entity) (v: Entity) = f.Substitute(x,v).InnerSimplified
    let exactEqual left right = Piecewise.exactEqual left right
    let continuousPolynomialResultJson s =
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
            obj [ "x",str g.X; "target",str g.Y; "actual",str (actual.ToString())
                  "actualLatex",str ((actual.Simplify()).Latexize()); "actualNumber",flt height
                  "hit",boolean (exactEqual actual target); "y",flt height ])
        let endpoint = sourceEndpoints[s.Source-1]
        let samples = [0..80] |> List.map (fun i -> float i * float endpoint / 80.)
        let sampleXs = (samples @ (presentationGoals |> List.map (fun g -> asFloat (rational g.X)))) |> List.distinct |> List.sort
        let stageJson = stages |> List.mapi (fun i f ->
            let compiled = f.Compile([|x|])
            let simplified = f.Simplify()
            let points = sampleXs |> List.map (fun sx ->
                let y = compiled.Call([|Complex(sx,0.)|]).Real |> checkedPreviewValue
                arr [flt sx;flt y])
            let values = presentationGoals |> List.map (fun g -> evaluateAt f (rational g.X))
            obj [ "id",str (if i=0 then "source" else s.Nodes[i-1].Id)
                  "expression",str (simplified.ToString()); "latex",str (simplified.Latexize())
                  "points",arr points
                  "values",arr (values |> List.map (fun value -> str (value.ToString())))
                  "valueLatex",arr (values |> List.map (fun value -> str ((value.Simplify()).Latexize()))) ])
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
            let compareExact left right =
                let parts (value: string) =
                    let split = value.Split('/')
                    if split.Length = 1 then BigInteger.Parse(split[0]),BigInteger.One
                    else BigInteger.Parse(split[0]),BigInteger.Parse(split[1])
                let leftNumerator,leftDenominator = parts left
                let rightNumerator,rightDenominator = parts right
                compare (leftNumerator * rightDenominator) (rightNumerator * leftDenominator)
            let fromGoal =
                s.Goals |> List.reduce (fun best candidate ->
                    if compareExact candidate.Y best.Y < 0 then candidate else best)
            let toGoal =
                s.Goals |> List.reduce (fun best candidate ->
                    if compareExact candidate.Y best.Y > 0 then candidate else best)
            let fromX,toX = rational fromGoal.X,rational toGoal.X
            let gap f =
                let fromValue,toValue = evaluateAt f fromX,evaluateAt f toX
                fromValue,toValue,(toValue - fromValue).InnerSimplified
            let targetGap = (exactConstant "goals" toGoal.Y - exactConstant "goals" fromGoal.Y).InnerSimplified
            let _,_,actualGap = gap final
            result["heightGuide"] <- obj [
                "fromX",str fromGoal.X; "toX",str toGoal.X; "target",str (targetGap.ToString())
                "actual",str (actualGap.ToString()); "actualLatex",str ((actualGap.Simplify()).Latexize())
                "hit",boolean (exactEqual actualGap targetGap)
                "stages",arr (stages |> List.map (fun stage ->
                    let fromValue,toValue,stageGap = gap stage
                    obj [ "from",str (fromValue.ToString()); "to",str (toValue.ToString()); "gap",str (stageGap.ToString())
                          "fromLatex",str ((fromValue.Simplify()).Latexize()); "toLatex",str ((toValue.Simplify()).Latexize())
                          "gapLatex",str ((stageGap.Simplify()).Latexize())
                          "fromNumber",flt (fromValue |> asFloat |> checkedPreviewValue)
                          "toNumber",flt (toValue |> asFloat |> checkedPreviewValue)
                          "gapNumber",flt (stageGap |> asFloat |> checkedPreviewValue) ])) ]
        result

    let private piecewiseStages s =
        let initialStage = Piecewise.create sourceEntities[s.Source-1] sourceEndpoints[s.Source-1]
        s.Nodes |> List.scan (fun stage node ->
            match Piecewise.apply x maxSegments node.Op stage with
            | Ok next -> next
            | Error message -> invalidInput "preview" message) initialStage

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
            let compiled = segment.Expression.Compile([|x|])
            { Segment=segment
              Evaluate=fun value ->
                  let result = compiled.Call([|Complex(value,0.)|])
                  if not (Double.IsFinite(result.Real)) || not (Double.IsFinite(result.Imaginary)) || abs result.Imaginary > 0.0000001 then
                      invalidInput "preview" "The curve did not return a real number."
                  checkedPreviewValue result.Real })

    let private numericAt point fn (evaluators: NumericSegment list) =
        let owner = Piecewise.segmentAt point fn
        let evaluator =
            evaluators
            |> List.find (fun evaluator -> Object.ReferenceEquals(evaluator.Segment,owner) || evaluator.Segment = owner)
        evaluator.Evaluate(Piecewise.toFloat point)

    let private pathJson (path: NumericCurvePath) =
        obj [ "points",arr (path.Points |> List.map (fun (px,py) -> arr [flt px;flt py]))
              "startClosed",boolean path.StartClosed; "endClosed",boolean path.EndClosed ]

    let private piecewisePathsWithEvaluators sampleXs (evaluators: NumericSegment list) =
        evaluators
        |> List.map (fun evaluator ->
            let segment = evaluator.Segment
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
            { Points=points; StartClosed=segment.StartClosed; EndClosed=segment.EndClosed })

    let private piecewisePaths sampleXs (fn: Piecewise.Function) =
        piecewisePathsWithEvaluators sampleXs (numericSegments fn)

    let private compareGoalHeight (left: Goal) (right: Goal) =
        compareExact (rational left.Y) (rational right.Y)

    let private exactOutputRange (nodes: Node list) =
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
        |> List.fold (fun range node -> transform range node.Op) None
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
            cachedRelationBranches key (fun () ->
                // Solve the real h^2 = z shape once with AngouriMath, then
                // substitute each exact segment RHS into those solver-derived
                // branches and domains. This preserves concrete SolveEquation
                // semantics without asking the CAS to rediscover the same
                // quadratic structure for every response and segment.
                heightSquaredBranchSchema.Value
                |> List.choose (fun schema ->
                    let branch = schema.Expression.Substitute(relationRhs,expression).Simplify()
                    let domain = schema.Domain.Substitute(relationRhs,expression).Simplify()
                    if branch.Vars |> Seq.exists (fun variable -> variable = h || variable = relationRhs) ||
                       domain.Vars |> Seq.exists (fun variable -> variable = relationRhs) then
                        invalidInput "preview" "The squared-height relation could not be solved explicitly for h."
                    if domain.ToString() = "False" then None
                    else Some { Expression=branch; Domain=domain })
                |> List.distinctBy (fun branch -> branch.Expression.ToString(),branch.Domain.ToString())
                |> List.sortBy (fun branch -> branch.Expression.ToString()))
        let segments =
            fn.Segments
            |> List.map (fun segment -> { Segment=segment; Branches=solve segment.Expression })
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
        { Segments=segments; Lines=lines; Latex=sprintf "\\begin{cases}%s\\end{cases}" (String.concat " \\\\ " rows) }

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
        let rawPaths = ResizeArray<NumericCurvePath>()
        let samePath (left: NumericCurvePath) (right: NumericCurvePath) =
            left.StartClosed = right.StartClosed && left.EndClosed = right.EndClosed &&
            left.Points.Length = right.Points.Length &&
            List.forall2 samePoint left.Points right.Points
        let addPath path =
            if not (rawPaths |> Seq.exists (samePath path)) then rawPaths.Add(path)
        for solved in solution.Segments do
            let segment = solved.Segment
            let evaluator = (numericSegments { DomainStart=segment.Start; DomainEnd=segment.End; Segments=[segment]; HasRounding=false }).Head
            let branchEvaluators =
                solved.Branches
                |> List.map (fun branch ->
                    let compiled = branch.Expression.Compile([|x|])
                    fun value ->
                        let result = compiled.Call([|Complex(value,0.)|])
                        if not (Double.IsFinite(result.Real)) || not (Double.IsFinite(result.Imaginary)) ||
                           abs result.Imaginary > 0.0000001 then
                            invalidInput "preview" "The solved relation branch did not return a real number."
                        if abs result.Real < tolerance then 0. else checkedPreviewValue result.Real)
            let startValue,endValue = Piecewise.toFloat segment.Start,Piecewise.toFloat segment.End
            let exactRoots =
                match polynomialDegree with
                | Some degree when degree <= 2 -> rationalQuadraticRoots segment
                | _ -> []
            let baseCandidates =
                startValue :: endValue :: exactRoots @
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
                    for branchEvaluator in branchEvaluators do
                        let points = subrun |> List.map (fun (px,value) -> if abs value <= tolerance then px,0. else px,branchEvaluator px)
                        addPath { Points=points; StartClosed=startClosed; EndClosed=endClosed }
        rawPaths |> Seq.toList

    let private relationEdges paths =
        let nodes = ResizeArray<float*float>()
        let nodeFor point =
            match nodes |> Seq.tryFindIndex (samePoint point) with
            | Some index -> index
            | None ->
                nodes.Add(point)
                nodes.Count-1
        let edges =
            paths
            |> List.choose (fun path ->
                match path.Points with
                | [] -> None
                | points -> Some { Curve=path; StartNode=nodeFor (List.head points); EndNode=nodeFor (List.last points) })
        nodes |> Seq.toArray,edges |> List.toArray

    let private edgeComponents nodeCount (edges: RelationEdge array) =
        let adjacency = Array.init nodeCount (fun _ -> ResizeArray<int>())
        edges |> Array.iteri (fun index edge ->
            adjacency[edge.StartNode].Add(index)
            if edge.EndNode <> edge.StartNode then adjacency[edge.EndNode].Add(index))
        let remaining = HashSet<int>([0..edges.Length-1])
        let components = ResizeArray<int list>()
        while remaining.Count > 0 do
            let seed = remaining |> Seq.min
            let queue = Queue<int>()
            let visitedNodes = HashSet<int>()
            let connectedEdges = ResizeArray<int>()
            queue.Enqueue(edges[seed].StartNode)
            while queue.Count > 0 do
                let node = queue.Dequeue()
                if visitedNodes.Add(node) then
                    for edgeIndex in adjacency[node] do
                        if remaining.Remove(edgeIndex) then
                            connectedEdges.Add(edgeIndex)
                            queue.Enqueue(edges[edgeIndex].StartNode)
                            queue.Enqueue(edges[edgeIndex].EndNode)
            components.Add(connectedEdges |> Seq.toList)
        components |> Seq.toList

    let private eulerRoute nodeCount (nodes: (float*float) array) (edges: RelationEdge array) connectedEdges preferredTarget =
        let degree = Array.zeroCreate<int> nodeCount
        for edgeIndex in connectedEdges do
            let edge = edges[edgeIndex]
            if edge.StartNode = edge.EndNode then degree[edge.StartNode] <- degree[edge.StartNode]+2
            else
                degree[edge.StartNode] <- degree[edge.StartNode]+1
                degree[edge.EndNode] <- degree[edge.EndNode]+1
        let oddNodes = degree |> Array.indexed |> Array.choose (fun (index,value) -> if value % 2 = 1 then Some index else None)
        let componentNodes =
            connectedEdges
            |> List.collect (fun edgeIndex -> [edges[edgeIndex].StartNode;edges[edgeIndex].EndNode])
            |> List.distinct
        let preferredNode =
            preferredTarget
            |> Option.bind (fun (targetX,targetY) ->
                componentNodes
                |> List.filter (fun node -> abs (fst nodes[node]-targetX) <= 0.000000001)
                |> List.sortBy (fun node -> abs (snd nodes[node]-targetY),node)
                |> List.tryHead)
        // A branched implicit curve has no trail that visits every arm only once.
        // Repeating its edges produces one continuous tour instead of a spatial jump.
        // An open trail can only start at an odd vertex; duplicate it as a circuit
        // when the first authored checkpoint asks to begin at an interior vertex.
        let preferredNeedsCircuit =
            match preferredNode with
            | Some node when oddNodes.Length = 2 && not (oddNodes |> Array.contains node) -> true
            | _ -> false
        let duplicateEdges = oddNodes.Length > 2 || preferredNeedsCircuit
        let instances =
            connectedEdges
            |> List.collect (fun edgeIndex -> if duplicateEdges then [edgeIndex;edgeIndex] else [edgeIndex])
            |> List.toArray
        let adjacency = Array.init nodeCount (fun _ -> ResizeArray<int>())
        instances |> Array.iteri (fun instanceIndex edgeIndex ->
            let edge = edges[edgeIndex]
            adjacency[edge.StartNode].Add(instanceIndex)
            adjacency[edge.EndNode].Add(instanceIndex))
        let startNode =
            match preferredNode with
            | Some node when duplicateEdges || oddNodes.Length = 0 || oddNodes |> Array.contains node -> node
            | _ when oddNodes.Length = 2 && not duplicateEdges -> oddNodes[0]
            | _ -> edges[instances[0]].StartNode
        let used = Array.zeroCreate<bool> instances.Length
        let nodeStack = ResizeArray<int>()
        let incomingStack = ResizeArray<(int*bool) option>()
        let reversedRoute = ResizeArray<int*bool>()
        nodeStack.Add(startNode)
        incomingStack.Add(None)
        while nodeStack.Count > 0 do
            let stackIndex = nodeStack.Count-1
            let current = nodeStack[stackIndex]
            match adjacency[current] |> Seq.tryFind (fun instanceIndex -> not used[instanceIndex]) with
            | Some instanceIndex ->
                used[instanceIndex] <- true
                let edgeIndex = instances[instanceIndex]
                let edge = edges[edgeIndex]
                let reversed = edge.StartNode <> current
                let next = if reversed then edge.StartNode else edge.EndNode
                nodeStack.Add(next)
                incomingStack.Add(Some (edgeIndex,reversed))
            | None ->
                nodeStack.RemoveAt(stackIndex)
                let incoming = incomingStack[stackIndex]
                incomingStack.RemoveAt(stackIndex)
                match incoming with
                | Some value -> reversedRoute.Add(value)
                | None -> ()
        reversedRoute
        |> Seq.rev
        |> Seq.map (fun (edgeIndex,reversed) -> if reversed then reversePath edges[edgeIndex].Curve else edges[edgeIndex].Curve)
        |> Seq.toList

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
        let nodes,edges = relationEdges rawPaths
        let componentHasPreferred connectedEdges =
            match preferredTarget with
            | None -> false
            | Some (targetX,_) ->
                connectedEdges
                |> List.exists (fun edgeIndex ->
                    let edge = edges[edgeIndex]
                    abs (fst nodes[edge.StartNode]-targetX) <= 0.000000001 ||
                    abs (fst nodes[edge.EndNode]-targetX) <= 0.000000001)
        let components =
            edgeComponents nodes.Length edges
            |> List.mapi (fun index connected -> index,connected)
            |> List.sortBy (fun (index,connected) -> if componentHasPreferred connected then (0,index) else (1,index))
            |> List.map snd
        let playbackPaths =
            components
            |> List.map (fun connected -> eulerRoute nodes.Length nodes edges connected preferredTarget |> resampleRoute)
            |> List.filter (not << List.isEmpty)
            |> List.map (fun points -> { Points=points; StartClosed=true; EndClosed=true })
        rawPaths |> mergeConnectedPaths,playbackPaths

    let private playbackData paths =
        let playback = ResizeArray<float*float>()
        let breaks = ResizeArray<int>()
        for path in paths do
            if not path.Points.IsEmpty then
                if playback.Count > 0 then breaks.Add(playback.Count)
                for point in path.Points do playback.Add(point)
        playback |> Seq.toList,breaks |> Seq.toList

    let private segmentedPolynomialResultJson s =
        let stages = piecewiseStages s
        let final = List.last stages
        let finalDegree = polynomialDegree s |> fst
        let finalRange = exactOutputRange s.Nodes
        let relation = isHeightSquaredSource s.Source
        let presentationGoals : Goal list =
            if s.Mode = "remix" && List.isEmpty s.Goals then
                targets[s.Source-1] |> List.map (fun (goalX,_) -> { X=goalX; Y="0" })
            else s.Goals
        let sampleXs = piecewiseSampleXs presentationGoals stages sourceEndpoints[s.Source-1]
        let stagePresentations = stages |> List.map Piecewise.presentation
        let finalPresentation = List.last stagePresentations
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
                        Piecewise.toFloat (Piecewise.parseRational goal.Y))
                relationCurveData sampleXs checkpointXs preferredTarget finalDegree solution
            | None -> [],[]
        let playback,breaks = playbackData playbackPaths
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
        let stageEvaluators = stages |> List.map numericSegments
        let stagePoints =
            (stages,stageEvaluators)
            ||> List.map2 (fun stage evaluators ->
                sampleXs |> List.map (fun point -> Piecewise.toFloat point,numericAt point stage evaluators))
        let stagePaths =
            (stages,stageEvaluators)
            ||> List.map2 (fun _ evaluators -> piecewisePathsWithEvaluators sampleXs evaluators)
        let stageValues =
            stages
            |> List.map (fun stage ->
                presentationGoals |> List.map (fun goal ->
                    Piecewise.evaluateAt x (Piecewise.parseRational goal.X) stage))
        let finalValues = List.last stageValues
        let checkpoints =
            (presentationGoals,finalValues) ||> List.map2 (fun goal actual ->
                let point = Piecewise.parseRational goal.X
                let authoredTarget = exactConstant "goals" goal.Y
                let expected = if relation then authoredTarget.Pow(rational "2").InnerSimplified else authoredTarget
                let actualNumber = exactNumber actual
                let actualLatex = exactLatex actual
                let hit =
                    if rangeProvesMismatch finalRange expected then false
                    else cachedExactEqual actual expected
                let y = if relation then authoredTarget |> asFloat |> checkedPreviewValue else actualNumber
                let checkpoint = obj [
                    "x",str goal.X; "target",str goal.Y; "actual",str (actual.ToString())
                    "actualLatex",str actualLatex; "actualNumber",flt actualNumber
                    "hit",boolean hit
                    "y",flt y ]
                if relation then
                    checkpoint["lhs"] <- str (expected.ToString())
                    checkpoint["rhs"] <- str (actual.ToString())
                    let targetX,targetY = Piecewise.toFloat point,authoredTarget |> asFloat
                    let phase =
                        if playback.IsEmpty then 0.
                        else
                            playback
                            |> List.mapi (fun index (px,py) -> index,(px-targetX)*(px-targetX)+(py-targetY)*(py-targetY))
                            |> List.minBy snd
                            |> fst
                            |> fun index -> if playback.Length <= 1 then 0. else float index / float (playback.Length-1)
                    checkpoint["phase"] <- flt phase
                checkpoint)
        let stageJson =
            List.zip stages stagePresentations |> List.mapi (fun index (stage,presentation) ->
                let points = stagePoints[index] |> List.map (fun (point,height) -> arr [flt point;flt height])
                let values = stageValues[index]
                let paths = stagePaths[index] |> List.map pathJson
                let valueLatex = values |> List.map (exactLatex >> str)
                let json = obj [
                    "id",str (if index=0 then "source" else s.Nodes[index-1].Id)
                    "expression",str presentation.ExpressionText; "latex",str presentation.Latex
                    "points",arr points
                    "paths",arr paths
                    "values",arr (values |> List.map (fun value -> str (value.ToString())))
                    "valueLatex",arr valueLatex ]
                if index > 0 && s.Nodes[index-1].Op = "S" then
                    let incoming = stages[index-1]
                    let incomingEvaluators = stageEvaluators[index-1]
                    json["projection"] <- arr (sampleXs |> List.map (fun point ->
                        let angle = Math.PI * numericAt point incoming incomingEvaluators / 2.
                        arr [flt (Math.Cos(angle));flt (Math.Sin(angle))]))
                json)
        let points = List.last stagePoints |> List.map (fun (point,height) -> arr [flt point;flt height])
        let finalPaths = List.last stagePaths |> List.map pathJson
        let startSlope = Piecewise.rightSlopeAtZero x final |> asFloat |> checkedPreviewValue
        let constructed = constructedLatex s
        let result = obj [
            "constructedLatex",str constructed
            "stages",arr stageJson; "checkpoints",arr checkpoints; "points",arr points
            "paths",arr finalPaths
            "startSlope",flt startSlope
            "solved",boolean (s.Mode<>"remix" && checkpoints |> List.forall (fun checkpoint -> checkpoint["hit"].GetValue<bool>())) ]
        if relation then
            let solution = relationSolution.Value
            result["relation"] <- obj [
                "kind",str "height-squared"
                "equationLatex",str (sprintf "h^{2} = %s" finalPresentation.Latex)
                "solvedLatex",str solution.Latex
                "solvedLines",arr (solution.Lines |> List.map (fun line -> obj [
                    "heightLatex",str line.HeightLatex
                    "conditionLatex",str line.ConditionLatex ]))
                "paths",arr (relationPaths |> List.map pathJson)
                "playback",arr (playback |> List.map (fun (px,py) -> arr [flt px;flt py]))
                "breaks",arr (breaks |> List.map num) ]
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
        if isHeightSquaredSource s.Source || s.Nodes |> List.exists (fun node -> List.contains node.Op ["S";"F";"C"])
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
    let importArtifact n =
        keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "goals"; "inventory"; "limit"; "circle" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then invalidInput "version" "Unsupported file version."
        if not (isNull n["view"]) && not (List.contains (stringField n "view") ["flight";"function";"flow"]) then invalidInput "view" "Unknown presentation."
        let source = intField n "sourceId"
        let s = initial source "remix"
        match stringField n "type" with
        | "creation" ->
            if isCircleSource source then
                keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "circle" ]
                { s with Nodes=readNodes (field n "nodes"); Circle=Some (readCircle (field n "circle")) } |> validate
            else
                keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view" ]
                { s with Nodes=readNodes (field n "nodes") } |> validate
        | "challenge" ->
            keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "view"; "goals"; "inventory"; "limit" ]
            { s with Mode="challenge"; Goals=readGoals source false (field n "goals")
                     Inventory=readInventory (field n "inventory"); Limit=intField n "limit" } |> validate
        | _ -> invalidInput "type" "Choose a creation or challenge file."
    let command s a =
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
                { s with Nodes=nodes }
        | "remix" ->
            match s.Circle with
            | Some circle -> { initial s.Source "remix" with Circle=Some circle; Goals=[] }
            | None -> { initial s.Source "remix" with Nodes=s.Nodes }
        | "source" ->
            if s.Mode <> "remix" then invalidInput "mode" "Starting curves can only be changed in creation mode."
            let source = intField a "sourceId"
            if isCircleSource source then
                if not s.Nodes.IsEmpty then invalidInput "circle" "Circle sources require an explicitly empty operation list."
                let next = initial source "remix"
                { next with Circle=(s.Circle |> Option.orElse next.Circle); Nodes=[]; Goals=[] }
            else
                { initial source "remix" with Nodes=s.Nodes; Goals=[] }
        | "circle" ->
            if not (isCircleSource s.Source) then invalidInput "circle" "The current source is not a circle."
            keys a [ "type"; "x"; "y"; "radius" ]
            let circle = readCircle (obj [ "x",str (stringField a "x"); "y",str (stringField a "y"); "radius",str (stringField a "radius") ])
            { s with Circle=Some circle }
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
        match kind with
        | "creation" ->
            match s.Circle with
            | Some circle -> obj (common @ ["nodes",nodesJson s.Nodes;"circle",circleJson circle])
            | None -> obj (common @ ["nodes",nodesJson s.Nodes])
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
                        (resultCheckpoints,referenceGoals)
                        ||> List.map2 (fun checkpoint referenceGoal ->
                            let squaredHeight =
                                Piecewise.tryParseRational (stringField checkpoint "actual")
                                |> Option.defaultWith (fun () ->
                                    invalidInput "export" "This height-squared construction needs rational real checkpoint heights before it can be shared as a challenge.")
                            let height =
                                Piecewise.tryRationalSquareRoot squaredHeight
                                |> Option.defaultWith (fun () ->
                                    invalidInput "export" "This height-squared construction needs rational real checkpoint heights before it can be shared as a challenge.")
                            let signedHeight =
                                if (exactConstant "export" referenceGoal.Y |> asFloat) < 0. then Piecewise.negate height else height
                            if abs (Piecewise.toFloat signedHeight) > maxTargetMagnitude then
                                invalidInput "export" "This construction's checkpoint values exceed the supported challenge target range."
                            { X=stringField checkpoint "x"; Y=Piecewise.rationalText signedHeight })
                    generated,(s.Nodes |> List.countBy (fun node -> node.Op) |> Map.ofList),s.Nodes.Length
                | None ->
                    let generated : Goal list =
                        result["checkpoints"] |> array |> List.map (fun checkpoint ->
                            let exact =
                                Piecewise.tryParseRational (stringField checkpoint "actual")
                                |> Option.defaultWith (fun () ->
                                    invalidInput "export" "Shared challenges currently require rational checkpoint heights.")
                            { X=stringField checkpoint "x";Y=Piecewise.rationalText exact })
                    for goal in generated do
                        let height = Piecewise.parseRational goal.Y |> Piecewise.toFloat
                        if not (Double.IsFinite(height)) || abs height > maxTargetMagnitude then
                            invalidInput "export" "This construction's checkpoint values exceed the supported challenge target range."
                    generated,(s.Nodes |> List.countBy (fun node -> node.Op) |> Map.ofList),s.Nodes.Length
            let artifact = obj (common @ ["goals",goalsJson goals;"inventory",inventoryJson inventory;"limit",num limit])
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
