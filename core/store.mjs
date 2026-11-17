import { detectEncounters, economicTurningPoints, DEFAULT_RULES, teamEconomy } from './analysis.mjs';
export class ReviewStore {
  constructor(database, { readonly = false } = {}) {
    this.db = database;
    if (!readonly) {
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS frames(time REAL PRIMARY KEY,tick INTEGER NOT NULL,payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,time REAL NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS event_time ON events(time);
        CREATE TABLE IF NOT EXISTS entity_updates(seq INTEGER PRIMARY KEY,time REAL NOT NULL,id TEXT NOT NULL,category TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS entity_time ON entity_updates(time);
        CREATE INDEX IF NOT EXISTS entity_id_time ON entity_updates(id,time);
        CREATE TABLE IF NOT EXISTS annotations(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      `);
    }
  }
  get(key) { const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key); return row ? JSON.parse(row.value) : null; }
  set(key, value) { this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, JSON.stringify(value)); }
  players() { return this.db.prepare('SELECT payload FROM players').all().map(r => JSON.parse(r.payload)); }
  events() { return this.db.prepare('SELECT payload FROM events ORDER BY time,id').all().map(r => JSON.parse(r.payload)); }
  frames(from = 0, to = Infinity) {
    return this.db.prepare('SELECT payload FROM frames WHERE time>=? AND time<=? ORDER BY time').all(from, Number.isFinite(to) ? to : 1e12).map(r => JSON.parse(r.payload));
  }
  frame(time) { const r = this.db.prepare('SELECT payload FROM frames WHERE time<=? ORDER BY time DESC LIMIT 1').get(time); return r ? JSON.parse(r.payload) : null; }
  economy() { return this.frames().filter((f, i) => i % 10 === 0).map(f => ({ time: f.time, clock: f.clock, paused: f.paused, players: f.players.map(p => ({ id: p.id, team: p.team, netWorth: p.netWorth, kills: p.kills, deaths: p.deaths, assists: p.assists })) })); }
  entities(time, categories = []) {
    const rows = this.db.prepare(`SELECT u.payload,u.action FROM entity_updates u JOIN (SELECT id,MAX(seq) AS seq FROM entity_updates WHERE time<=? GROUP BY id) latest ON u.seq=latest.seq`).all(time);
    return rows.filter(r => r.action !== 'remove').map(r => JSON.parse(r.payload).entity).filter(e => !categories.length || categories.includes(e.category));
  }
  resources() {
    return this.db.prepare(`SELECT category,COUNT(DISTINCT id) count,SUM(CASE WHEN action='remove' THEN 1 ELSE 0 END) removals FROM entity_updates GROUP BY category`).all();
  }
  history(id) { return this.db.prepare('SELECT payload FROM entity_updates WHERE id=? ORDER BY seq').all(id).map(r => JSON.parse(r.payload)); }
  annotations() { return this.db.prepare('SELECT payload FROM annotations').all().map(r => JSON.parse(r.payload)); }
  saveAnnotation(a) {
    if (a.override) {
      const { start, end } = a.override;
      const participants = new Set(a.override.participants?.map(p => p.id) || []);
      const allEvents = this.events();
      const combatEvents = allEvents.filter(e => !participants.size || participants.has(e.actor) && participants.has(e.target));
      const kills = combatEvents.filter(e => e.kind === 'kill' && e.time >= start && e.time <= end);
      const before = teamEconomy(this.frame(start)), after = teamEconomy(this.frame(end)), later = teamEconomy(this.frame(end + DEFAULT_RULES.outcomeSeconds));
      const identities = new Map(this.players().map(p => [p.id, p]));
      a = { ...a, override: { ...a.override, kills: kills.length,
        deaths: { amber: kills.filter(e => identities.get(e.target)?.team === 2).length, sapphire: kills.filter(e => identities.get(e.target)?.team === 3).length },
        economySwing: before?.complete && after?.complete ? after.difference - before.difference : null,
        followupSwing: before?.complete && later?.complete ? later.difference - before.difference : null,
        objectiveIds: allEvents.filter(e => ['objective', 'reward_acquired'].includes(e.kind) && e.time >= end && e.time <= end + DEFAULT_RULES.outcomeSeconds).map(e => e.id),
        eventIds: combatEvents.filter(e => ['kill','damage'].includes(e.kind) && e.time >= start && e.time <= end).map(e => e.id),
      }};
    }
    this.db.prepare('INSERT OR REPLACE INTO annotations VALUES (?,?)').run(a.id, JSON.stringify(a)); return this.annotations(); }
  deleteAnnotation(id) { this.db.prepare('DELETE FROM annotations WHERE id=?').run(id); return this.annotations(); }
  analyze(rules = DEFAULT_RULES) {
    const frames = this.economy(), events = this.events(), players = this.players();
    const encounters = detectEncounters(events, players, frames, rules), turningPoints = economicTurningPoints(frames);
    this.set('rules', rules); this.set('encounters', encounters); this.set('turningPoints', turningPoints);
    return { encounters, turningPoints, rules };
  }
  summary() { return { metadata: this.get('metadata'), players: this.players(), events: this.events(), economy: this.economy(), encounters: this.get('encounters') || [], turningPoints: this.get('turningPoints') || [], annotations: this.annotations(), rules: this.get('rules') || DEFAULT_RULES, resources: this.resources() }; }
  close() { this.db.close(); }
  checkpoint() { this.db.pragma('wal_checkpoint(TRUNCATE)'); }
}
