using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using DemoFile;
using DemoFile.Game.Deadlock;
using DemoFile.Sdk;

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
if (args.Contains("--self-test")) { DecoderChecks.Run(); return 0; }
if (args.Length < 2) { Console.Error.WriteLine("Usage: Deadlock.Parser <demo.dem> <output.ndjson> [--inspect]"); return 2; }
var path = Path.GetFullPath(args[0]);
var output = Path.GetFullPath(args[1]);
var temp = output + ".partial";
Directory.CreateDirectory(Path.GetDirectoryName(output)!);
var sw = Stopwatch.StartNew();
using var cancel = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancel.Cancel(); };
try {
    using var writer = new StreamWriter(temp, false, new System.Text.UTF8Encoding(false), 1 << 20);
    void Write(object value) => writer.WriteLine(JsonSerializer.Serialize(value, json));
    var demo = new DeadlockDemoParser();
    var players = new Dictionary<uint, PlayerIdentity>();
    var seenClasses = new Dictionary<string, int>();
    var tracked = new Dictionary<string, EntityState>();
    var rawCounts = new Dictionary<string, int>();
    var lastPlayerState = new Dictionary<string, PlayerState>();
    var eventSequence = 0;
    var frameCount = 0;
    var nextSample = 0.0;
    var lastSampleTime = 0.0;
    var lastTick = -1;
    var lastProgress = -1;
    var winningTeam = 0;
    var originValid = 0;
    var originTotal = 0;
    var originInBounds = 0;
    CCitadelGameRules? Rules() { try { return demo.GameRules; } catch (InvalidOperationException) { return null; } }
    double TickInterval() => demo.ServerInfo?.TickInterval is > 0 and < 1 ? demo.ServerInfo.TickInterval : 1.0 / 64;
    double ReplayTime() => Math.Max(0, demo.CurrentDemoTick.Value) * TickInterval();
    double? Clock() {
        var r = Rules();
        if (r == null) return null;
        return ReplayClock.MatchClock(demo.CurrentGameTick.Value, TickInterval(), r.MatchClockAtLastUpdate, r.MatchClockUpdateTick, r.ServerPaused, r.GamePaused, r.PauseStartTick);
    }
    PlayerIdentity? Resolve(int index) {
        if (index < 0 || index >= 16384) return null;
        var e = demo.GetEntityByIndex<CEntityInstance<DeadlockDemoParser>>(new CEntityIndex((uint)index));
        if (e is CCitadelPlayerController pc) return Register(pc);
        foreach (var p in demo.PlayersIncludingDisconnected) if (p.HeroPawn?.EntityIndex.Value == index) return Register(p);
        return null;
    }
    PlayerIdentity Register(CCitadelPlayerController p) {
        var id = p.SteamID == 0 ? $"slot-{p.EntityIndex.Value}" : p.SteamID.ToString();
        var identity = new PlayerIdentity(id, p.PlayerName, p.SteamID.ToString(), (int)p.TeamNum, p.PlayerDataGlobal.HeroID.Value, (int)p.EntityIndex.Value);
        if (!players.TryGetValue(p.EntityIndex.Value, out var prev) || prev != identity) {
            players[p.EntityIndex.Value] = identity;
            Write(new { type = "player", time = ReplayTime(), player = identity });
        }
        return identity;
    }
    void Event(string kind, string source, object detail, string? actor = null, string? target = null, int? team = null, string[]? assisters = null, double[]? position = null, string quality = "observed") {
        rawCounts[kind] = rawCounts.GetValueOrDefault(kind) + 1;
        Write(new { type = "event", id = $"e{++eventSequence}", tick = demo.CurrentDemoTick.Value, time = ReplayTime(), clock = Clock(), kind, source, actor, target, team, assisters, position, quality, detail });
    }
    demo.UserMessageEvents.HeroKilled += e => {
        var actor = Resolve(e.EntindexAttacker);
        var target = Resolve(e.EntindexVictim);
        var assists = e.EntindexAssisters.Select(Resolve).Where(p => p != null).Select(p => p!.Id).Distinct().ToArray();
        var victim = e.EntindexVictim is >= 0 and < 16384 ? demo.GetEntityByIndex<CBaseEntity>(new CEntityIndex((uint)e.EntindexVictim)) : null;
        Event("kill", "HeroKilled", new { victimIndex = e.EntindexVictim, attackerIndex = e.EntindexAttacker, inflictorIndex = e.EntindexInflictor }, actor?.Id, target?.Id, actor?.Team, assists, victim == null ? null : Position(victim));
    };
    demo.UserMessageEvents.Damage += e => {
        var actor = Resolve(e.EntindexAttacker); var target = Resolve(e.EntindexVictim);
        if (actor != null && target != null && actor.Team != target.Team)
            Event("damage", "Damage", new { amount = e.Damage, healthLost = e.HasHealthLost ? e.HealthLost : (int?)null, absorbed = e.DamageAbsorbed, abilityIndex = e.EntindexAbility }, actor.Id, target.Id, actor.Team, position: target == null ? null : demo.PlayersIncludingDisconnected.FirstOrDefault(p => p.EntityIndex.Value == target.Slot)?.HeroPawn is { } victimPawn ? Position(victimPawn) : null);
    };
    demo.Source1GameEvents.PlayerHealed += e => {
        var healer = Resolve(e.EntindexHealer); var healed = Resolve(e.EntindexHealed);
        if (healer != null && healed != null && e.HealAmount > 0)
            Event("heal", "player_healed", new { amount = e.HealAmount, abilityId = e.AbilityidHealingSource }, healer.Id, healed.Id, healer.Team);
    };
    demo.UserMessageEvents.BossKilled += e => {
        var killed = new CHandle<CBaseEntity, DeadlockDemoParser>(e.EntityKilled).Get(demo);
        var killer = new CHandle<CBaseEntity, DeadlockDemoParser>(e.EntityKiller).Get(demo);
        Event("objective", "BossKilled", new { entity = e.EntityKilled, classId = e.EntityKilledClass, className = killed?.ServerClass.Name, entityId = killed == null ? null : EntityId(killed), killer = e.EntityKiller, mask = e.ObjectiveMaskChange }, killer == null ? null : Resolve((int)killer.EntityIndex.Value)?.Id, team: e.ObjectiveTeam, position: killed == null ? null : Position(killed));
    };
    demo.UserMessageEvents.ReturnIdol += e => Event("urn_location", "ReturnIdol", new { location = e.LocationIndex, enabled = e.LocationEnabled }, position: e.ReturnLocation == null ? null : [e.ReturnLocation.X, e.ReturnLocation.Y, e.ReturnLocation.Z]);
    demo.UserMessageEvents.GameOver += e => { winningTeam = e.WinningTeam; Event("game_over", "GameOver", new { winner = e.WinningTeam }, team: e.WinningTeam); };
    demo.UserMessageEvents.PostMatchDetails += _ => rawCounts["post_match"] = rawCounts.GetValueOrDefault("post_match") + 1;
    demo.EntityEvents.CBaseEntity.Create += e => {
        var cls = e.ServerClass.Name;
        seenClasses[cls] = seenClasses.GetValueOrDefault(cls) + 1;
        var category = Category(cls);
        if (category == null) return;
        var state = State(e, category);
        tracked[state.Id] = state;
        Write(new { type = "entity", time = ReplayTime(), tick = demo.CurrentDemoTick.Value, clock = Clock(), action = "create", entity = state });
    };
    demo.EntityEvents.CBaseEntity.Delete += e => {
        var id = EntityId(e);
        if (!tracked.Remove(id, out var state)) return;
        Write(new { type = "entity", time = ReplayTime(), tick = demo.CurrentDemoTick.Value, clock = Clock(), action = "remove", entity = state with { Active = false } });
    };
    demo.OnCommandFinishPersistent += () => {
        var tick = demo.CurrentDemoTick.Value;
        if (tick < 0 || tick == lastTick) return;
        lastTick = tick;
        var time = ReplayTime();
        if (time + 0.0001 < nextSample) return;
        nextSample = time + 0.1;
        var states = new List<PlayerState>();
        foreach (var p in demo.PlayersIncludingDisconnected) {
            if (p.TeamNum is not (2 or 3)) continue;
            var identity = Register(p); var d = p.PlayerDataGlobal; var pawn = p.HeroPawn;
            var pos = pawn == null ? null : Position(pawn);
            originTotal++; if (pos != null && (Math.Abs(pos[0]) > 1 || Math.Abs(pos[1]) > 1)) originValid++;
            if (pos != null && Rules() is { } mapRules && pos[0] >= mapRules.MinimapMins.X && pos[0] <= mapRules.MinimapMaxs.X && pos[1] >= mapRules.MinimapMins.Y && pos[1] <= mapRules.MinimapMaxs.Y) originInBounds++;
            var abilities = pawn?.CCitadelAbilityComponent.Abilities.Select(h => h.Get(demo)).Where(a => a != null && a is not CCitadelBaseTriggerAbility && !a.ServerClass.Name.EndsWith("_Trigger") && (int)a.AbilitySlot is >= 0 and <= 3).Select(a => new AbilityState((int)a!.AbilitySlot, a.SubclassID.Value, a.ServerClass.Name, a.UpgradeInfo.Value, a.CooldownStart.Value, a.CooldownEnd.Value, a.StoppedCooldownRemaining, a.RemainingCharges, a.ChargeRechargeStart.Value, a.ChargeRechargeEnd.Value, a.Channeling, a.InCastDelay, a.ToggleState)).OrderBy(a => a.Slot).ToArray();
            var items = d.Upgrades.Select(u => u.Value).Where(id => id != 0).Distinct().ToArray();
            var current = new PlayerState(identity.Id, (int)p.TeamNum, d.HeroID.Value, pos, pawn == null ? null : EntityId(pawn), d.Alive, d.Health, d.HealthMax, d.Level, d.GoldNetWorth, d.PlayerKills, d.Deaths, d.PlayerAssists, d.LastHits, d.Denies, d.CreepGoldNeutral, d.HasRejuvenator, d.HasRebirth, abilities, items, d.HeroDamage, d.HeroHealing, d.SelfHealing);
            states.Add(current);
            if (lastPlayerState.TryGetValue(identity.Id, out var old)) {
                if (current.HeroHealing > old.HeroHealing || current.SelfHealing > old.SelfHealing)
                    Event("healing_total", "PlayerDataGlobal", new { amount = Math.Max(0, current.HeroHealing - old.HeroHealing), selfAmount = Math.Max(0, current.SelfHealing - old.SelfHealing), intervalStart = lastSampleTime }, identity.Id, team: identity.Team);
                if (!old.HasRejuvenator && current.HasRejuvenator) Event("reward_acquired", "PlayerDataGlobal.HasRejuvenator", new { reward = "rejuvenator" }, identity.Id, team: identity.Team);
                if (!old.HasRebirth && current.HasRebirth) Event("reward_acquired", "PlayerDataGlobal.HasRebirth", new { reward = "rebirth" }, identity.Id, team: identity.Team);
            }
            lastPlayerState[identity.Id] = current;
        }
        lastSampleTime = time;
        var r = Rules();
        Write(new { type = "frame", tick, serverTick = demo.CurrentGameTick.Value, time, clock = Clock(), paused = r == null ? (bool?)null : r.ServerPaused || r.GamePaused,
            gameTime = demo.CurrentGameTick.Value * TickInterval(),
            abilityTime = r == null ? (double?)null : ReplayClock.SimulationTick(demo.CurrentGameTick.Value, r.TotalPausedTicks, r.GamePaused, r.PauseStartTick) * TickInterval(),
            totalPausedTicks = r?.TotalPausedTicks, pauseStartTick = r?.PauseStartTick,
            clockUpdateTick = r?.MatchClockUpdateTick, clockAtLastUpdate = r?.MatchClockAtLastUpdate, players = states });
        frameCount++;
        if (frameCount % 10 == 1) {
            foreach (var e in demo.Entities.OfType<CBaseEntity>()) {
                var category = Category(e.ServerClass.Name); if (category == null) continue;
                var state = State(e, category);
                if (!tracked.TryGetValue(state.Id, out var old) || !Equivalent(old, state)) {
                    tracked[state.Id] = state;
                    Write(new { type = "entity", time, tick, clock = Clock(), action = "update", entity = state });
                }
            }
        }
    };
    demo.DemoEvents.DemoClassInfo += _ => {
        if (!args.Contains("--inspect")) return;
        foreach (var ser in demo.Serializers.Values) foreach (var field in ser.Fields)
            if (field.VarType.Name is "HeroID_t" or "MatchID_t" or "PlayerConnectedState" || field.VarName.Contains("cell", StringComparison.OrdinalIgnoreCase)) Console.Error.WriteLine($"ENC {ser.Key}.{field}");
    };
    using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 1 << 20, FileOptions.SequentialScan);
    var reader = DemoFileReader.Create(demo, stream);
    reader.OnProgress = p => {
        var progress = Math.Clamp((int)(p.ProgressRatio * 100), 0, 99);
        if (progress != lastProgress) { lastProgress = progress; Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", progress, tick = demo.CurrentDemoTick.Value }, json)); }
    };
    await reader.ReadAllAsync(cancel.Token);
    if (reader.IsIncompleteFile) throw new InvalidDataException("录像不完整，未发布分析结果。请使用完整 demo。");
    var rules = Rules();
    var bounds = rules == null ? null : new { min = new[] { rules.MinimapMins.X, rules.MinimapMins.Y }, max = new[] { rules.MinimapMaxs.X, rules.MinimapMaxs.Y } };
    stream.Position = 0;
    var hash = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    var metadata = new {
        schemaVersion = 1, parserVersion = "demofile-net-0.44.1+deadlock-review.6", rulesVersion = 1,
        source = new { fileName = Path.GetFileName(path), bytes = stream.Length, sha256 = hash },
        matchId = rules?.MatchID.Value.ToString(), build = demo.FileHeader?.BuildNum,
        protocol = demo.FileHeader?.NetworkProtocol, map = demo.FileHeader?.MapName, mapVersion = $"build-{demo.FileHeader?.BuildNum}",
        duration = ReplayTime(), tickInterval = TickInterval(), winner = winningTeam is 2 or 3 ? winningTeam : (int?)null,
        compatibility = demo.FileHeader?.BuildNum == 10932 ? "sample-tested" : "unverified-build",
        bounds, frames = frameCount, events = eventSequence, decodeErrors = demo.DecodeErrorCount, parseSeconds = sw.Elapsed.TotalSeconds,
        positionInBoundsRatio = originTotal == 0 ? 0 : (double)originInBounds / originTotal,
        positionCoverage = originTotal == 0 ? 0 : (double)originValid / originTotal,
        capabilities = new { positions = originValid > 0, economy = frameCount > 0, kills = rawCounts.GetValueOrDefault("kill") > 0, damage = rawCounts.GetValueOrDefault("damage") > 0, abilities = true, abilityClock = true, items = true, healing = true, resources = true, resourceAttribution = false, visibility = false },
        rawCounts, entityClasses = seenClasses.OrderByDescending(p => p.Value).ToDictionary(p => p.Key, p => p.Value),
        quality = new { status = "parsed", humanVerified = false, notes = new[] { "严格模式完整解析；尚需与游戏内录像人工核对。", "实体移除只表示停止观测，不自动判定被领取或击杀。", "资源领取者和永久增益数值缺少直接证据时保留未知。", "坐标按 demo 边界投影；可选参考底图不代表精确匹配录像版本，也不表示玩家视野。", "目前仅针对 build 10932 做过样本验证，其他版本须检查坐标及数据语义。" } }
    };
    Write(new { type = "metadata", metadata });
    writer.Flush(); writer.Close();
    File.Move(temp, output, true);
    Console.WriteLine(JsonSerializer.Serialize(new { type = "complete", output, metadata }, json));
    return 0;
} catch (OperationCanceledException) {
    if (File.Exists(temp)) File.Delete(temp);
    Console.Error.WriteLine("解析已取消"); return 130;
} catch (Exception e) {
    if (File.Exists(temp)) File.Delete(temp);
    Console.Error.WriteLine(JsonSerializer.Serialize(new { type = "error", message = e.Message, detail = e.ToString() }, json)); return 1;
}

static string EntityId(CBaseEntity e) => $"{e.EntityIndex.Value}:{e.SerialNumber}";
static double[]? Position(CBaseEntity e) {
    if (e.CBodyComponent is not CBodyComponentSkeletonInstance) return null;
    var p = e.Origin;
    return float.IsFinite(p.X) && float.IsFinite(p.Y) && float.IsFinite(p.Z) ? [Math.Round(p.X, 2), Math.Round(p.Y, 2), Math.Round(p.Z, 2)] : null;
}
static string? Category(string cls) {
    if (cls.Contains("SinnersSacrifice")) return "vending";
    if (cls.Contains("TrooperNeutral") || cls.StartsWith("CNPC_Neutral_Bug")) return "neutral";
    if (cls.Contains("MidBoss")) return "boss";
    if (cls.Contains("Rejuv") && cls.Contains("Pickup")) return "reward";
    if (cls.Contains("ItemPickupIdol")) return "urn";
    if (cls.Contains("Koth")) return "rift";
    if (cls.StartsWith("CNPC_Boss") || cls is "CNPC_TrooperBoss" or "CNPC_TrooperBarrackBoss" or "CNPC_BarrackBoss" or "CNPC_BaseDefenseSentry") return "building";
    if (cls is "CNPC_Trooper" or "CNPC_Escort" || cls.Contains("TrooperMinimap")) return "lane";
    if (cls.Contains("BreakableProp") || cls == "CItemCrate") return "breakable";
    if (cls.Contains("Pickup_Modifier") || cls is "CCitadel_PickupItemSpawner" or "CCitadel_PunchablePowerup") return "buff";
    if (cls.Contains("ItemPickup") || cls.Contains("Pickup_Gold")) return "pickup";
    return null;
}
static EntityState State(CBaseEntity e, string category) => new(EntityId(e), e.ServerClass.Name, category, (int)e.TeamNum, Position(e), e.Health, e.MaxHealth, e.IsActive, null,
    e is CCitadelItemPickup pickup ? pickup.CurrencyValue : null,
    e is CCitadelItemPickupRejuv rejuv ? rejuv.PickedUp : e is CCitadel_PickupItemSpawner spawner ? !spawner.PowerupActive : e is CCitadel_Pickup drop ? !drop.Active : null,
    e.SubclassID.Value);
static bool Equivalent(EntityState a, EntityState b) => a.Health == b.Health && a.Team == b.Team && a.Active == b.Active && a.PickedUp == b.PickedUp && a.Currency == b.Currency && a.SubclassId == b.SubclassId && ((a.Position == null && b.Position == null) || (a.Position != null && b.Position != null && a.Position.SequenceEqual(b.Position)));
record PlayerIdentity(string Id, string Name, string SteamId, int Team, int HeroId, int Slot);
record PlayerState(string Id, int Team, int HeroId, double[]? Position, string? EntityId, bool Alive, int Health, int MaxHealth, int Level, int NetWorth, int Kills, int Deaths, int Assists, int LastHits, int Denies, int NeutralGold, bool HasRejuvenator, bool HasRebirth, AbilityState[]? Abilities, uint[] Items, int HeroDamage, int HeroHealing, int SelfHealing);
record AbilityState(int Slot, uint Id, string ClassName, int UpgradeInfo, float CooldownStart, float CooldownEnd, float StoppedCooldownRemaining, int Charges, float RechargeStart, float RechargeEnd, bool Channeling, bool InCastDelay, bool ToggleState);
record EntityState(string Id, string ClassName, string Category, int Team, double[]? Position, int Health, int MaxHealth, bool Active, string? Owner, int? Currency, bool? PickedUp, uint SubclassId);
