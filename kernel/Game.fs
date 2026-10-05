namespace Angouri.Kernel

open System
open System.Text
open System.Text.Json.Nodes
open System.Text.RegularExpressions
open System.Text.Json
open System.Numerics
open System.Collections.Generic
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
    let operations = [ "H"; "A"; "N"; "Q"; "D"; "I" ]
    let maxNodes = 64
    let maxDegree = 32
    let maxExactDigits = 128
    let maxPreviewMagnitude = 10000000.
    let maxTargetMagnitude = 1000000.
    type Node = { Id: string; Op: string }
    type Goal = { X: string; Y: string }
    type State = { Source: int; Mode: string; Nodes: Node list; Goals: Goal list; Inventory: Map<string,int>; Limit: int }
    let sources = [|
        "x * (4 - x)"; "x * (4 - x) / 2"; "x * (4 - x)"; "x - 2"; "x^3"
        "-x * (4 - x) / 2"; "x - 2"; "(x - 2)^2 / 4"; "(x - 2)^2"; "x - 2"
        "x - 2"; "(x - 2)^2 / 4"; "(x - 2)^2 / 4"
        "(x - 2)^2 / 4"; "(x - 2)^3 / 3 + 2"
        "1"; "2 - x"; "(x - 2)^3 / 2"
        "2 - x"; "1"; "1 + x * (4 - x) / 2"
        "(x - 2)^3 / 3 + 2"; "3 * (x - 2)^2 / 8"
        "x * (4 - x)"; "x * (4 - x)"; "(x - 2)^2 + 1"; "x - 2"; "x - 2" |]
    let targets = [|
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
        [ "0", "3/8"; "1", "1/2"; "2", "3/8"; "3", "0"; "4", "-5/8" ] |]
    let inventories = [|
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
        Map [ "H",3; "A",3; "N",2; "Q",1 ] |]
    let limits = [| 1; 1; 2; 5; 3; 1; 1; 2; 3; 2; 8; 1; 3; 1; 5; 1; 2; 4; 1; 2; 2; 9; 8; 4; 10; 8; 2; 8 |]
    let sourceDegrees = [| 2; 2; 2; 1; 3; 2; 1; 2; 2; 1; 1; 2; 2; 2; 3; 0; 1; 3; 1; 0; 2; 3; 2; 2; 2; 2; 1; 1 |]
    let sourceEndpoints = [| 4; 4; 4; 4; 2; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4; 4 |]
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
    let asFloat (e: Entity) =
        match e.Evaled with
        | :? Entity.Number.Real as r -> r.AsDouble()
        | _ -> invalidInput "preview" "The curve did not return a real number."
    let checkedPreviewValue value =
        if not (Double.IsFinite(value)) || abs value > maxPreviewMagnitude then
            invalidInput "preview" "This construction produces values outside the supported preview range."
        value
    let goalsJson goals = goals |> Seq.map (fun g -> obj [ "x",str g.X; "y",str g.Y ]) |> arr
    let nodesJson nodes = nodes |> Seq.map (fun n -> obj [ "id",str n.Id; "op",str n.Op ]) |> arr
    let inventoryJson inventory = inventory |> Map.toList |> List.map (fun (k,v) -> k,num v) |> obj
    let stateJson s = obj [
        "schema",num 1; "rules",str rules; "engine",str engine; "sourceId",num s.Source
        "mode",str s.Mode; "nodes",nodesJson s.Nodes; "goals",goalsJson s.Goals
        "inventory",inventoryJson s.Inventory; "limit",num s.Limit ]
    let initial source mode =
        if source < 1 || source > sources.Length then invalidInput "source" "Choose an available source curve."
        { Source=source; Mode=mode; Nodes=[]
          Goals=targets[source-1] |> List.map (fun (x,y) -> { X=x; Y=y })
          Inventory=(if mode="remix" then Map.empty else inventories[source-1])
          Limit=(if mode="remix" then 0 else limits[source-1]) }
    let readNodes n =
        let ns = array n
        if ns.Length > maxNodes then invalidInput "nodes" "The preview supports at most 64 parts."
        ns |> List.map (fun n ->
            keys n [ "id"; "op" ]
            let id,op = stringField n "id",stringField n "op"
            if isNull id || not (Regex.IsMatch(id, "^[A-Za-z0-9_-]{1,64}$")) then invalidInput "id" "Invalid part identity."
            if not (List.contains op operations) then invalidInput "op" "Unknown operation."
            { Id=id; Op=op })
    let readGoals source n =
        let gs = array n
        if gs.Length <> targets[source-1].Length then invalidInput "goals" "This source has a fixed set of checkpoint positions."
        gs |> List.mapi (fun i n ->
            keys n [ "x"; "y" ]
            let x,y = stringField n "x",stringField n "y"
            if rational x <> rational (fst (targets.[source-1].[i])) then invalidInput "goals" "Checkpoint positions do not match the source."
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
    let polynomialDegree s =
        s.Nodes |> List.fold (fun degree node ->
            let next =
                match node.Op with
                | "Q" -> degree * 2
                | "D" -> max 0 (degree - 1)
                | "I" -> degree + 1
                | _ -> degree
            if next > maxDegree then
                invalidInput "preview" "This construction exceeds the preview polynomial degree limit of 32."
            next) sourceDegrees[s.Source-1]
    let validateCommon s =
        if s.Nodes.Length > maxNodes then invalidInput "parts" "The preview supports at most 64 parts."
        if (s.Nodes |> List.map (fun n -> n.Id) |> Set.ofList |> Set.count) <> s.Nodes.Length then invalidInput "identity" "Part identities must be unique."
        polynomialDegree s |> ignore
        s
    let validateConstrained s =
        validateCommon s |> ignore
        if s.Limit < 0 || s.Limit > maxNodes then invalidInput "parts" "Part limits must be between zero and 64."
        if s.Nodes.Length > s.Limit then invalidInput "parts" "The construction exceeds its part limit."
        for op,count in (s.Nodes |> List.countBy (fun n -> n.Op)) do
            if count > (s.Inventory |> Map.tryFind op |> Option.defaultValue 0) then invalidInput "inventory" "That part is not available."
        s
    let validate s =
        if s.Mode = "remix" then
            validateCommon s |> ignore
            if s.Inventory <> Map.empty || s.Limit <> 0 then
                invalidInput "rules" "Reusable remix states must use an empty inventory and the unlimited limit sentinel."
            s
        else validateConstrained s
    let readState n =
        keys n [ "schema"; "rules"; "engine"; "sourceId"; "mode"; "nodes"; "goals"; "inventory"; "limit" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then
            invalidInput "version" "This save uses an unsupported schema, ruleset or engine."
        let source,mode = intField n "sourceId",stringField n "mode"
        if not (List.contains mode [ "puzzle"; "remix"; "challenge" ]) then invalidInput "mode" "Unknown play mode."
        let baseState = initial source mode
        let goalData = field n "goals"
        let goals =
            if mode = "remix" && (array goalData).IsEmpty then []
            else readGoals source goalData
        let inventory = readInventory (field n "inventory")
        let limit = intField n "limit"
        let loaded = { baseState with Nodes=readNodes (field n "nodes"); Goals=goals; Inventory=inventory; Limit=limit }
        match mode with
        | "puzzle" ->
            if goals <> baseState.Goals || inventory <> baseState.Inventory || limit <> baseState.Limit then
                invalidInput "rules" "Authored puzzle rules cannot be changed."
            validate loaded
        | "remix" ->
            if goals <> [] && goals <> baseState.Goals then invalidInput "rules" "Authored checkpoint positions cannot be changed."
            if inventory = Map.empty && limit = 0 then validate loaded
            elif inventory = legacyRemixInventory && limit = 6 then
                // Validate the acknowledged legacy rules before upgrading to reusable remix semantics.
                validateConstrained loaded |> ignore
                validate { loaded with Inventory=Map.empty; Limit=0 }
            else invalidInput "rules" "This remix save has unsupported inventory rules."
        | "challenge" -> validate loaded
        | _ -> invalidInput "mode" "Unknown play mode."
    let x = MathS.FromString("x") :?> Entity.Variable
    let sourceEntities = sources |> Array.map MathS.FromString
    let apply (f: Entity) op =
        let result =
            match op with
            | "H" -> f / rational "2"
            | "A" -> f + rational "1"
            | "N" -> -f
            | "Q" -> f.Pow(rational "2")
            | "D" -> f.Differentiate(x)
            | "I" ->
                let antiderivative = f.Integrate(x)
                (antiderivative - antiderivative.Substitute(x, rational "0").Evaled).Simplify()
            | _ -> invalidInput "op" "Unknown operation."
        result.InnerSimplified
    let expressions s =
        let source = sourceEntities[s.Source-1]
        s.Nodes |> List.scan (fun f n -> apply f n.Op) source
    let evaluateAt (f: Entity) (v: Entity) = f.Substitute(x,v).Evaled
    let resultJson s =
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
            let height = actual |> asFloat |> checkedPreviewValue
            obj [ "x",str g.X; "target",str g.Y; "actual",str (actual.ToString())
                  "hit",boolean (actual = rational g.Y); "y",flt height ])
        let endpoint = sourceEndpoints[s.Source-1]
        let samples = [0..80] |> List.map (fun i -> float i * float endpoint / 80.)
        let sampleXs = (samples @ (presentationGoals |> List.map (fun g -> asFloat (rational g.X)))) |> List.distinct |> List.sort
        let stageJson = stages |> List.mapi (fun i f ->
            let compiled = f.Compile([|x|])
            let points = sampleXs |> List.map (fun sx ->
                let y = compiled.Call([|Complex(sx,0.)|]).Real |> checkedPreviewValue
                arr [flt sx;flt y])
            obj [ "id",str (if i=0 then "source" else s.Nodes[i-1].Id)
                  "expression",str (f.ToString()); "latex",str (f.Latexize())
                  "points",arr points
                  "values",arr (presentationGoals |> List.map (fun g -> str ((evaluateAt f (rational g.X)).ToString()))) ])
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
        let result = obj [ "stages",arr stageJson; "checkpoints",arr checkpoints; "points",arr points; "startSlope",flt startSlope
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
                fromValue,toValue,(toValue - fromValue).Evaled
            let targetGap = (rational toGoal.Y - rational fromGoal.Y).Evaled
            let _,_,actualGap = gap final
            result["heightGuide"] <- obj [
                "fromX",str fromGoal.X; "toX",str toGoal.X; "target",str (targetGap.ToString())
                "actual",str (actualGap.ToString()); "hit",boolean (actualGap = targetGap)
                "stages",arr (stages |> List.map (fun stage ->
                    let fromValue,toValue,stageGap = gap stage
                    obj [ "from",str (fromValue.ToString()); "to",str (toValue.ToString()); "gap",str (stageGap.ToString()) ])) ]
        result
    let importArtifact n =
        keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view"; "goals"; "inventory"; "limit" ]
        if intField n "schema" <> 1 || stringField n "rules" <> rules || stringField n "engine" <> engine then invalidInput "version" "Unsupported file version."
        if not (isNull n["view"]) && not (List.contains (stringField n "view") ["flight";"function";"flow"]) then invalidInput "view" "Unknown presentation."
        let source = intField n "sourceId"
        let s = initial source "remix"
        match stringField n "type" with
        | "creation" ->
            keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "nodes"; "view" ]
            { s with Nodes=readNodes (field n "nodes") } |> validate
        | "challenge" ->
            keys n [ "schema"; "rules"; "engine"; "type"; "sourceId"; "view"; "goals"; "inventory"; "limit" ]
            { s with Mode="challenge"; Goals=readGoals source (field n "goals")
                     Inventory=readInventory (field n "inventory"); Limit=intField n "limit" } |> validate
        | _ -> invalidInput "type" "Choose a creation or challenge file."
    let command s a =
        match stringField a "type" with
        | "evaluate" | "export" -> s
        | "level" -> initial (intField a "sourceId") (stringField a "mode")
        | "import" -> importArtifact (field a "artifact")
        | "reset" -> { s with Nodes=[] }
        | "remix" -> { initial s.Source "remix" with Nodes=s.Nodes }
        | "source" ->
            if s.Mode <> "remix" then invalidInput "mode" "Starting curves can only be changed in creation mode."
            { initial (intField a "sourceId") "remix" with Nodes=s.Nodes; Goals=[] }
        | "insert" ->
            let index = intField a "index"
            if index < 0 || index > s.Nodes.Length then invalidInput "position" "Invalid insertion position."
            let node = readNodes (arr [obj ["id",str (stringField a "id"); "op",str (stringField a "op")]]) |> List.head
            { s with Nodes=(List.take index s.Nodes) @ [node] @ (List.skip index s.Nodes) }
        | "remove" ->
            let id = stringField a "id"
            if not (s.Nodes |> List.exists (fun n -> n.Id=id)) then invalidInput "part" "Part no longer exists."
            { s with Nodes=s.Nodes |> List.filter (fun n -> n.Id<>id) }
        | "move" ->
            let id,index = stringField a "id",intField a "index"
            let node = s.Nodes |> List.tryFind (fun n -> n.Id=id) |> Option.defaultWith (fun () -> invalidInput "part" "Part no longer exists.")
            let remaining = s.Nodes |> List.filter (fun n -> n.Id<>id)
            if index < 0 || index > remaining.Length then invalidInput "position" "Invalid move position."
            { s with Nodes=List.take index remaining @ [node] @ List.skip index remaining }
        | _ -> invalidInput "command" "Unknown game command."
    let exportArtifact s a (result: JsonNode) =
        let kind,view = stringField a "kind",stringField a "view"
        if not (List.contains view ["flight";"function";"flow"]) then invalidInput "view" "Unknown presentation."
        let common = [ "schema",num 1; "rules",str rules; "engine",str engine; "type",str kind; "sourceId",num s.Source; "view",str view ]
        match kind with
        | "creation" -> obj (common @ ["nodes",nodesJson s.Nodes])
        | "challenge" ->
            // The evaluated legal construction is the witness. Its solution is never exported.
            let goals = result["checkpoints"] |> array |> List.map (fun c -> {X=stringField c "x";Y=stringField c "actual"})
            for goal in goals do
                let height =
                    try rational goal.Y |> asFloat
                    with :? ArgumentException ->
                        invalidInput "export" "This construction's exact checkpoint values are too large to share as a challenge."
                if not (Double.IsFinite(height)) || abs height > maxTargetMagnitude then
                    invalidInput "export" "This construction's checkpoint values exceed the supported challenge target range."
            let inventory = s.Nodes |> List.countBy (fun node -> node.Op) |> Map.ofList
            let artifact = obj (common @ ["goals",goalsJson goals;"inventory",inventoryJson inventory;"limit",num s.Nodes.Length])
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
