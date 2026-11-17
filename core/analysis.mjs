export const DEFAULT_RULES = Object.freeze({ minPerTeam: 2, gapSeconds: 12, preRoll: 10, postRoll: 30, outcomeSeconds: 60 });
export const CATEGORY_LABELS = { building: '建筑', boss: '中立 Boss', reward: 'Boss 奖励', urn: '灵瓮', rift: '裂隙', neutral: '野怪', vending: '售货机', breakable: '箱罐', buff: 'Buff / 增益符', pickup: '资源掉落', lane: '兵线' };

export function lowerBound(items, time, key = 'time') {
  let lo = 0, hi = items.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (items[mid][key] < time) lo = mid + 1; else hi = mid; }
  return lo;
}
export function frameAt(frames, time) {
  if (!frames.length) return null;
  const i = lowerBound(frames, time);
  return frames[Math.max(0, i < frames.length && frames[i].time === time ? i : i - 1)];
}
export function interpolatePlayer(a, b, alpha, maxDistance = 500) {
  if (!a?.position || !b?.position || a.entityId !== b.entityId || !a.alive || !b.alive) return a;
  const distance = Math.hypot(...a.position.map((v, i) => b.position[i] - v));
  if (distance > maxDistance) return a;
  return { ...a, position: a.position.map((v, i) => v + (b.position[i] - v) * alpha) };
}
export function teamEconomy(frame) {
  if (!frame) return null;
  const totals = { amber: 0, sapphire: 0, amberCount: 0, sapphireCount: 0 };
  for (const p of frame.players) {
    if (p.team === 2) { totals.amber += p.netWorth; totals.amberCount++; }
    if (p.team === 3) { totals.sapphire += p.netWorth; totals.sapphireCount++; }
  }
  return { ...totals, complete: totals.amberCount === 6 && totals.sapphireCount === 6, difference: totals.amber - totals.sapphire };
}
function joinable(component, event, gapSeconds) {
  const involved = new Set([event.actor, event.target, ...(event.assisters || [])].filter(Boolean));
  return component.events.some(e => event.time - e.time <= gapSeconds && [e.actor, e.target, ...(e.assisters || [])].some(id => involved.has(id))); 
}
export function detectEncounters(events, identities, frames, rules = DEFAULT_RULES) {
  rules = { ...DEFAULT_RULES, ...rules };
  const playerMap = new Map(identities.map(p => [p.id, p]));
  const combat = events.filter(e => ['kill', 'damage'].includes(e.kind) && e.actor && e.target && [2,3].includes(playerMap.get(e.actor)?.team) && [2,3].includes(playerMap.get(e.target)?.team) && playerMap.get(e.actor).team !== playerMap.get(e.target).team).sort((a, b) => a.time - b.time);
  
  let active = [], finished = [];
  for (const event of combat) {
    const expired = active.filter(c => event.time - c.end > rules.gapSeconds);
    finished.push(...expired); active = active.filter(c => !expired.includes(c));
    const matches = active.filter(c => event.time - c.start <= 120 && joinable(c, event, rules.gapSeconds));
    const current = matches.shift() || { start: event.time, end: event.time, events: [], people: new Set() };
    if (!active.includes(current)) active.push(current);
    for (const other of matches) {
      current.start = Math.min(current.start, other.start); current.events.push(...other.events);
      for (const id of other.people) current.people.add(id);
      active = active.filter(c => c !== other);
    }
    current.end = event.time; current.events.push(event);
    for (const id of [event.actor, event.target, ...(event.assisters || [])].filter(Boolean)) current.people.add(id);
  }
  finished.push(...active);
  return finished.sort((a, b) => a.start - b.start).map(c => {
    const participants = [...c.people].map(id => ({ id, team: playerMap.get(id)?.team ?? 0, firstSeen: Math.min(...c.events.filter(e => e.actor === id || e.target === id || e.assisters?.includes(id)).map(e => e.time)) }));
    const amber = participants.filter(p => p.team === 2).length, sapphire = participants.filter(p => p.team === 3).length;
    const kind = Math.min(amber, sapphire) >= rules.minPerTeam ? 'teamfight' : 'skirmish';
    const kills = c.events.filter(e => e.kind === 'kill');
    const before = teamEconomy(frameAt(frames, c.start));
    const after = teamEconomy(frameAt(frames, c.end));
    const later = teamEconomy(frameAt(frames, c.end + rules.outcomeSeconds));
    const objectives = events.filter(e => ['objective', 'reward_acquired'].includes(e.kind) && e.time >= c.end && e.time <= c.end + rules.outcomeSeconds).map(e => e.id);
    return {
      id: `enc-${stableId(c.events.map(e => e.id).sort().join('|'))}`,
      kind, start: c.start, end: c.end, clock: c.events[0]?.clock,
      quality: c.events.some(e => e.kind === 'damage') ? 'damage-based-candidate' : 'kill-based-candidate',
      title: `${amber}v${sapphire} ${kind === 'teamfight' ? '团战' : '交火'}`,
      participants, kills: kills.length,
      deaths: { amber: kills.filter(e => playerMap.get(e.target)?.team === 2).length, sapphire: kills.filter(e => playerMap.get(e.target)?.team === 3).length },
      eventIds: c.events.map(e => e.id), objectiveIds: objectives,
      economySwing: before?.complete && after?.complete ? after.difference - before.difference : null,
      followupSwing: before?.complete && later?.complete ? later.difference - before.difference : null,
      playbackStart: Math.max(0, c.start - rules.preRoll), playbackEnd: c.end + rules.postRoll,
    };
  });
}
export function economicTurningPoints(frames, count = 5) {
  const points = [];
  for (const frame of frames) {
    const end = frameAt(frames, frame.time + 60);
    if (!end || end.time - frame.time < 59) continue;
    const a = teamEconomy(frame), b = teamEconomy(end);
    if (a?.complete && b?.complete) points.push({ kind: 'economy', start: frame.time, end: end.time, swing: b.difference - a.difference });
  }
  points.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
  const selected = [];
  for (const p of points) { if (selected.every(q => p.end <= q.start || p.start >= q.end)) selected.push(p); if (selected.length === count) break; }
  return selected.sort((a, b) => a.start - b.start);
}
export function effectiveEncounters(generated, annotations) {
  const overrides = new Map(annotations.filter(a => a.kind === 'encounter').map(a => [a.targetId, a]));
  const result = generated.filter(e => !overrides.get(e.id)?.hidden).map(e => ({ ...e, ...overrides.get(e.id)?.override, note: overrides.get(e.id)?.text || '', manual: overrides.has(e.id) }));
  result.push(...annotations.filter(a => a.kind === 'manual-encounter' && !overrides.get(a.id)?.hidden).map(a => ({ ...a.override, ...overrides.get(a.id)?.override, id: a.id, note: overrides.get(a.id)?.text ?? a.text, manual: true })));
  return result.sort((a, b) => a.start - b.start);
}
// Damage is restricted to selected combatants; healing is the healer's replicated
// hero-healing counter (includes self healing). Do not add self healing twice.
export function encounterMetrics(encounter, events, identities, capabilities = {}) {
  const selected = new Set(encounter.participants?.map(p => p.id) || []);
  const people = new Map(identities.filter(p => selected.has(p.id)).map(p => [p.id, {
    id: p.id, team: p.team, heroId: p.heroId,
    damage: capabilities.damage ? 0 : null, taken: capabilities.damage ? 0 : null,
    healing: capabilities.healing ? 0 : null, selfHealing: capabilities.healing ? 0 : null,
  }]));
  const amount = value => Number.isFinite(value) && value > 0 ? value : 0;
  for (const e of events) {
    if (e.time < encounter.start || e.time > encounter.end) continue;
    const actor = people.get(e.actor), target = people.get(e.target);
    if (e.kind === 'damage' && actor && target && actor.team !== target.team && capabilities.damage) {
      const value = amount(e.detail?.healthLost ?? e.detail?.amount);
      actor.damage += value; target.taken += value;
    }
    if (e.kind === 'healing_total' && e.time > encounter.start && actor && capabilities.healing) {
      actor.healing += amount(e.detail?.amount);
      actor.selfHealing += amount(e.detail?.selfAmount);
    }
  }
  return [...people.values()].sort((a,b) => a.team-b.team || (b.damage || 0)-(a.damage || 0));
}
export function safeCsv(rows, columns) {
  const escape = value => { let s = value == null ? '' : String(value); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  return '\ufeff' + [columns, ...rows.map(row => columns.map(c => row[c]))].map(row => row.map(escape).join(',')).join('\r\n');
}
export function formatClock(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--';
  const n = Math.abs(Math.floor(seconds));
  return `${seconds < 0 ? '-' : ''}${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
}

function stableId(text) { let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16); }
