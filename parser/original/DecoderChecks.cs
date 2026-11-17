using DemoFile;
using DemoFile.Game.Deadlock;

static class DecoderChecks
{
    public static void Run()
    {
        // Real match 134791125 paused twice: 3732 ticks (58.3125 s).
        if (ReplayClock.SimulationTick(42196, 3732, false, 0) / 64 != 601)
            throw new Exception("Ability clock must subtract completed gameplay pauses");
        if (ReplayClock.SimulationTick(14833, 0, true, 14829) != 14829 ||
            ReplayClock.SimulationTick(15000, 0, true, 14829) != 14829 ||
            ReplayClock.SimulationTick(17843, 3012, false, 0) != 14831)
            throw new Exception("Ability clock must freeze during a pause and resume without counting paused ticks");
        var fixed8 = new FieldEncodingInfo("fixed8", 8, 0, null, null);
        var ordinary = new FieldEncodingInfo(null, 0, 0, null, null);
        var b = new BitBuffer(new byte[] { 255, 7 });
        if (FieldDecode.CreateDecoder_byte(fixed8)(ref b) != 255 || b.ReadByte() != 7)
            throw new Exception("fixed8 byte consumed the wrong number of bits");
        b = new BitBuffer(new byte[] { 254, 13 });
        if (FieldDecode.CreateDecoder_sbyte(fixed8)(ref b) != -2 || b.ReadByte() != 13)
            throw new Exception("fixed8 signed byte was not sign extended");
        b = new BitBuffer(new byte[] { 3, 11 });
        if ((int)FieldDecode.CreateDecoder_enum<PlayerConnectedState>(fixed8)(ref b) != 3 || b.ReadByte() != 11)
            throw new Exception("fixed8 enum consumed the wrong number of bits");
        b = new BitBuffer(new byte[] { 31 });
        if (HeroID.Decode(ref b).Value != 31) throw new Exception("HeroID decoded using zigzag");
        var bytes = Encode(134791125); b = new BitBuffer(bytes);
        if (MatchID.Decode(ref b).Value != 134791125) throw new Exception("MatchID decoded using zigzag");
        b = new BitBuffer(new byte[] { 8 });
        if ((int)FieldDecode.CreateDecoder_enum<PlayerConnectedState>(ordinary)(ref b) != 4)
            throw new Exception("PlayerConnectedState is a signed varint");
        b = new BitBuffer(new byte[] { 6 });
        if ((int)FieldDecode.CreateDecoder_enum<EAbilitySlots>(ordinary)(ref b) != 3)
            throw new Exception("EAbilitySlots is a signed varint");
        b = new BitBuffer(Encode(15u << 16));
        if (CitadelAbilityUpgradeInfoPacked.Decode(ref b).Value != 15 << 16)
            throw new Exception("Ability upgrade packed bits are unsigned");
        var origin = new CNetworkOriginCellCoordQuantizedVector();
        foreach (var name in new[] { "CellX", "CellY", "CellZ" })
            typeof(CNetworkOriginCellCoordQuantizedVector).GetProperty(name)!.SetValue(origin, (ushort)64);
        typeof(CNetworkOriginCellCoordQuantizedVector).GetProperty("X")!.SetValue(origin, 128f);
        if (origin.Vector.X != 128 || origin.Vector.Y != 0 || origin.Vector.Z != 0)
            throw new Exception("Build 10932 coordinates must use cell origin 64");
        var handle = new CHandle<CBaseEntity, DeadlockDemoParser>(7654142);
        if (handle.Index.Value != 2814 || handle.SerialNum != 467) throw new Exception("BossKilled uses a network handle, not an entity index");
        Console.WriteLine("Decoder checks passed (fixed8, signed bytes, enums, HeroID, MatchID, coordinates, objective handles).");
    }
    static byte[] Encode(uint n) { var r = new List<byte>(); do { var v = (byte)(n & 127); n >>= 7; r.Add((byte)(v | (n > 0 ? 128 : 0))); } while (n > 0); return r.ToArray(); }
}
