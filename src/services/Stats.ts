
import axios from "axios";
import fs from 'fs'

class FreeFireMatchStats {
  private _sign: string = "8665d8e498e24059ac460b2c6febe1d0";

  private getBody(matchIDs: string[]) {
    return {
      match_ids: matchIDs,
      single_match_id: [],
      _ts: Date.now(),
      _sign: this._sign
    }
  }

  private fetchStats(matchIDs: string[]) {
    return new Promise<MatchStatsAPIResponse>((resolve, reject) => {
      axios.post("https://matchstats.sea.ffesports.com/api/match_stats/match_data", this.getBody(matchIDs), {
        responseType: "json",
        timeout: 8000,
      })
        .then((response) => resolve(response.data))
        .catch((error) => reject(error))
    })
  }

  /**
   * 
   * @param matchIDs Truyền vào là một array string hoặc string matchID (nếu là string matchID, mỗi matchID các nhau 1 dấu phẩy)
   * @returns 
   */
  async getStats(matchIDs: string | string[]): Promise<{ status: "success" | "error", message: string, data?: MatchStatsAPIResponse }> {
    if (!Array.isArray(matchIDs)) {
      matchIDs = matchIDs.split(",")
    }

    if (matchIDs.length > 8)
      return { status: "error", message: "Không thể nhập quá 8 trận đấu!" }

    const response = await this.fetchStats(matchIDs)

    if (response.code === 0 && response.status === "success")
      return { message: "", status: "success", data: response }

    return { message: "Dữ liệu trận đấu có vấn đề!", status: "error", data: response }
  }
}

export interface MatchStatsAPIResponse {
  code: number;
  status: string;
  msg: string;
  data: MatchStatsResponse;
}

export interface MatchStatsResponse {
  match_info: MatchInfo[];
  team_stats: TeamStatsByMatch[];
}

export interface MatchInfo {
  match_id: string;
  mode: number;
  match_name: string;
  form: number;
  number_of_team: number;
  number_of_player: number;
  match_results: any[];
  grenade_stats: GrenadeStats;
}

export interface GrenadeStats {
  grenade_use: number;
  grenade_kills: number;
  grenade_damage: number;
  icewall_use: number;
  icewall_destroyed_times: number;
  medkit_use: number;
}

export interface TeamStatsByMatch {
  match_id: string;
  team_stats: TeamStats[];
}

export interface TeamStats {
  match_rank: number;
  team_id: number;
  team_name: string;
  match_ids: string[];

  survival_score: number;
  killing_score: number;
  total_score: number;

  kills: number;
  booyah: number;
  damage: number;

  icewall_destroyed_times: number;
  grenade_use: number;
  icewall_use: number;
  medkit_use: number;
  grenade_damage: number;
  grenade_kills: number;

  max_kill_distance: number;

  on_target: string;
  headshots: number;
  headshot_kill_rate: string;
  headshot_accuracy_rate: string;

  survival_time: number;
  revival: number;
  rescue_members: number;

  teammate_list: string[];

  weapon: WeaponStats[];

  active_skills: ActiveSkill[];
  passive_skills: PassiveSkill[];
  pet_skills: PetSkill[];
  loadout_skills: LoadoutSkill[];

  player_data: PlayerStats[];

  pos_change: number;
}

export interface WeaponStats {
  weapon_id: number;
  weapon: string;
  kills: number;
  damage: number;
  headshots: number;
  on_target: string;
  headshot_accuracy_rate: string;
}

export interface BaseSkill {
  skill_id: number;
  name: string;
  pick_times: number;
  pick_rate: number;
  skill: string;
}

export interface ActiveSkill extends BaseSkill {
  time: number;
  info: string;
}

export interface PassiveSkill extends BaseSkill { }

export interface PetSkill extends BaseSkill { }

export interface LoadoutSkill extends BaseSkill { }

export interface PlayerStats {
  match_rank: number;
  player_id: number;
  player_name: string;
  team_name: string;

  kills: number;
  assists: number;
  damage: number;

  icewall_destroyed_times: number;
  grenade_use: number;
  icewall_use: number;
  medkit_use: number;
  grenade_damage: number;
  grenade_kills: number;

  max_kill_distance: number;

  headshot_kill_rate: string;
  moving_distance: string;

  headshots: number;
  revival: number;
  revival_members: number;

  headshot_accuracy_rate: string;
  on_target: string;

  weapon: WeaponStats[];

  active_skills: ActiveSkill[];
  passive_skills: PassiveSkill[];
  pet_skills: PetSkill[];
  loadout_skills: LoadoutSkill[];

  knock_down: number;
  survival_time: number;
  rescue_members: number;

  vehicle_kill: number;
  oil_kill: number;
  pos_change: number;
}


export default new FreeFireMatchStats()
