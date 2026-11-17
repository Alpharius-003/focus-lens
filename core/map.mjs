// Game minimap assets span ±10752 units, X right / Y up, independently of a demo's observed bounds.
export const MAP_RADIUS = 10752;
export function mapRect(bounds, size) {
  const width = bounds.max[0] - bounds.min[0], height = bounds.max[1] - bounds.min[1];
  return { x: (-MAP_RADIUS - bounds.min[0]) / width * size, y: (bounds.max[1] - MAP_RADIUS) / height * size, width: MAP_RADIUS * 2 / width * size, height: MAP_RADIUS * 2 / height * size };
}

// Source spline handles are offsets from each knot (P1 incoming, P2 outgoing).
export function laneCurves(lane) {
  const add = (...vectors) => vectors[0].map((_, i) => vectors.reduce((sum, v) => sum + v[i], 0));
  return lane.P0_points.slice(1).map((end, i) => [
    add(lane.origin, lane.P0_points[i]),
    add(lane.origin, lane.P0_points[i], lane.P2_points[i]),
    add(lane.origin, end, lane.P1_points[i + 1]),
    add(lane.origin, end),
  ]);
}

export const mapTeamColor = team => team === 2 ? 0xf4eee1 : team === 3 ? 0xeb6455 : 0xb5d4c5;
// Counter-scale with the camera: zoom reveals more positional detail instead of enlarging markers.
// At 5x zoom the screen size is about 77% of its size at 1x; zooming out keeps the overview behavior.
export const playerDisplayScale = zoom => zoom > 1 ? Math.pow(zoom, -1.16) : 1;
export const playerLabel = (player, roster) => roster.find(p => p.id === player.id)?.name?.trim() || player.name?.trim() || player.id;
export const entityVisible = e => !!e.position && e.active && !e.pickedUp && !(e.health === 0 && e.maxHealth > 0);

// Valve hud_minimap.css wash-color values, including shardColor for souls.
export const buffColors = {powerup_weapon:0xffcc80,powerup_health:0xd7ff9a,powerup_magic:0xe1a6ff,powerup_movement:0x99ffdd,powerup_souls:0x99ffd6,powerup_generic:0xc5cec9};
export const buffColor = icon => buffColors[icon] ?? buffColors.powerup_generic;

export function resourceIcon(e, neutralTypes = {}) {
  const cls = e.className || '';
  switch (e.category) {
    case 'building':
      if (/Tier3/.test(cls)) return 'boss_health_final_psd';
      if (/Tier2/.test(cls)) return 'boss_health_t2_psd';
      if (/BaseDefenseSentry/.test(cls)) return e.team === 3 ? 'npc_tower_enemy_psd' : 'npc_tower_friend_psd';
      return 'boss_health_psd';
    case 'neutral': {
      const type = neutralTypes[e.subclassId]?.className || '';
      return /_weak$/.test(type) ? 'neutral_small_psd' : /_normal$/.test(type) ? 'neutral_medium_psd' : /_strong$/.test(type) ? 'neutral_large_psd' : 'npc_marker_neutral_psd';
    }
    case 'boss': return 'super_neutral_marker_psd';
    case 'reward': return 'rejuv_crystal_psd';
    case 'urn': return 'soul_jar_marker_return_psd';
    case 'rift': return 'minimap_icon_koth';
    case 'vending': return 'neutral_vault_psd';
    case 'lane': return /Escort/.test(cls) ? (e.team === 3 ? 'escort_enemy_psd' : 'escort_friendly_psd') : (e.team === 3 ? 'npc_marker_enemy_psd' : 'npc_marker_friend_psd');
    case 'buff': {
      const type = neutralTypes[e.subclassId]?.className || '';
      return ({gun_powerup_pickup:'powerup_weapon',survival_powerup_pickup:'powerup_health',casting_powerup_pickup:'powerup_magic',movement_powerup_pickup:'powerup_movement',souls_powerup_pickup:'powerup_souls'})[type] || 'powerup_generic';
    }
    case 'breakable': return 'item_crate_spawn_psd';
    case 'pickup': return 'gold_psd';
    case 'shop': return 'shop_psd';
    default: return 'npc_marker_neutral_psd';
  }
}
