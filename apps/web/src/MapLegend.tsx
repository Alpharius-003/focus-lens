import {iconUrl} from './mapAssets';
import {buffColor} from '../../../core/map.mjs';
const legend=[['boss_health_psd','守护者 / 兵营'],['boss_health_t2_psd','步行者'],['boss_health_final_psd','守护神 / 基地'],['npc_marker_friend_psd','兵线'],['shop_psd','商店'],['neutral_small_psd','小野'],['neutral_medium_psd','中野'],['neutral_large_psd','大野'],['neutral_vault_psd','售货机'],['super_neutral_marker_psd','中立 Boss'],['soul_jar_marker_return_psd','灵瓮'],['minimap_icon_koth','裂隙']];
const buffs=[['powerup_weapon','武器符'],['powerup_health','生存符'],['powerup_magic','精神符'],['powerup_movement','移速符'],['powerup_souls','灵魂符'],['powerup_generic','未知增益']];
export default function MapLegend(){
 return <section className="map-legend" aria-label="地图图标说明"><h3>地图图标说明</h3><div>{legend.map(([key,label])=><span key={key}><img src={iconUrl(key)} alt=""/>{label}</span>)}</div>
  <h4>Buff 符</h4><div className="buff-legend">{buffs.map(([key,label])=>{const color=`#${buffColor(key).toString(16).padStart(6,'0')}`;return <span key={key} style={{color}}><i className="buff-legend-icon" style={{backgroundColor:color,maskImage:`url("${iconUrl(key)}")`}}/>{label}</span>;})}</div>
  <p>白底：琥珀之手 · 红底：蓝焰。放大地图时头像和昵称会逐渐缩小，便于定位。商店与三路为参考地图数据，可能与录像版本有差异；野怪等级仅在实体类型已确认时区分。Buff 按确认的实体类型显示游戏小地图配色，未确认类型使用无中心圆点的灰色环；永久增益不套用随机符颜色。旧工程缺少类型字段时，重新导入原始 demo 可更新图标。</p>
 </section>;
}
