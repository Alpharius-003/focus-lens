// Ability timestamps exclude gameplay pauses; the network tick keeps advancing.
static class ReplayClock
{
    public static double SimulationTick(uint serverTick, int totalPausedTicks, bool gamePaused, int pauseStartTick) =>
        (gamePaused && pauseStartTick > 0 ? pauseStartTick : (double)serverTick) - totalPausedTicks;

    public static double MatchClock(uint serverTick, double interval, double lastClock, int updateTick, bool serverPaused, bool gamePaused, int pauseStartTick) =>
        lastClock + (serverPaused ? 0 : ((gamePaused && pauseStartTick > 0 ? pauseStartTick : (double)serverTick) - updateTick) * interval);
}
