// Network upgrade word: high 16 bits are AbilityUpgradeBits; low 16 bits are upgrade level.
export function abilityUpgrade(packed) {
  if (!Number.isInteger(packed)) return null;
  const bits = packed >>> 16;
  if (bits & ~0x9f) return null;
  return {trained:!!(bits & 1),tier:[2,4,8].filter(bit=>bits & bit).length,bits};
}
export function abilityStatus(ability, frame, time, definition = {}) {
  const upgrade=abilityUpgrade(ability?.upgradeInfo);
  if (!ability || !Number.isFinite(frame?.abilityTime) || !upgrade) return {known:false,label:'未知',tier:null,charges:null,cooldown:0,recharge:0,trained:false};
  // Network ticks include gameplay pauses; abilityTime excludes them. Legacy snapshots
  // lack the pause counters, so do not silently reuse their incorrect gameTime.
  const now=frame.abilityTime+(frame.paused?0:Math.max(0,Math.min(.2,time-frame.time)));
  const cooldown=Math.max(0,ability.stoppedCooldownRemaining||0,(ability.cooldownEnd||0)-now);
  const recharge=Math.max(0,(ability.rechargeEnd||0)-now);
  const charged=Number(definition.baseCharges)>0 || ability.charges>0 || ability.rechargeEnd>0;
  const charges=charged?Math.max(0,ability.charges):null;
  return {known:true,tier:upgrade.tier,trained:upgrade.trained,cooldown,recharge,charges,
    label:!upgrade.trained?'未学':ability.channeling?'引导':ability.inCastDelay?'施法':cooldown>0?String(Math.ceil(cooldown)):charges===0&&recharge>0?String(Math.ceil(recharge)):ability.toggleState?'开启':'就绪'};
}
export function recentKills(events,time,{duration=8,limit=4}={}) {
  return events.filter(e=>e.kind==='kill'&&e.time<=time&&e.time>time-duration).sort((a,b)=>a.time-b.time).slice(-limit);
}
