#include "replay.h"
#include <iostream>

//JSON Output shortcuts
#define JFLT(k,n) " " << "\"" << (k) << "\": " << float(n)
#define JINT(k,n) " " << "\"" << (k) << "\": " << int32_t(n)
#define JUIN(k,n) " " << "\"" << (k) << "\": " << uint32_t(n)
#define JSTR(k,s) " " << "\"" << (k) << "\": \"" << (s) << "\""
//Logic for outputting a line only if it changed since last frame (or if we're in full output mode)
#define CHANGED(field) (not delta) || (f == 0) || (s.player[p].frame[f].field != s.player[p].frame[f-1].field)
#define ICHANGED(field) (not delta) || (f == 0) || (s.item[i].frame[f].field != s.item[i].frame[f-1].field)
//Logic for outputting a comma or not depending on whether we're the first element in a JSON object
#define JEND(a) ((a++ == 0) ? "" : ",")

namespace slip {

void SlippiReplay::setFrames(int32_t max_frames) {
  this->last_frame  = max_frames;
  this->frame_count = max_frames-this->first_frame;
  for(unsigned i = 0; i < 4; ++i) {
    if (this->player[i].player_type != 3) {
      this->player[i].frame = new SlippiFrame[this->frame_count];
      if (this->player[i].ext_char_id == CharExt::CLIMBER) { //Extra player for Ice Climbers
        this->player[i+4].frame = new SlippiFrame[this->frame_count];
      }
    }
  }
}

void SlippiReplay::cleanup() {
  for(unsigned i = 0; i < 4; ++i) {
    if (this->player[i].player_type != 3) {
      delete [] this->player[i].frame;
      if (this->player[i].ext_char_id == CharExt::CLIMBER) { //Extra player for Ice Climbers
        delete [] this->player[i+4].frame;
      }
    }
  }
  for(unsigned i = 0; i < MAX_ITEMS; ++i) {
    if (this->item[i].frame != nullptr) {
      delete [] this->item[i].frame;
    }
  }
}

std::string SlippiReplay::playerFramesAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;

  for(unsigned p = 0; p < 8; ++p) {
    unsigned pp = (p % 4);

    if (s.player[p].player_type != 3) {
      for(unsigned f = 0; f < s.frame_count; ++f) {
        ss << "{ ";

        int a = 0; //True for only the first thing output per line
        ss << JEND(a) << JSTR("match_id"      ,s.start_time);
        ss << JEND(a) << JSTR("player_id"     ,s.player[pp].tag_code);
        ss << JEND(a) << JUIN("follower"      ,s.player[p].frame[f].follower);
        ss << JEND(a) << JUIN("seed"          ,s.player[p].frame[f].seed);
        ss << JEND(a) << JUIN("action_pre"    ,s.player[p].frame[f].action_pre);
        ss << JEND(a) << JFLT("pos_x_pre"     ,s.player[p].frame[f].pos_x_pre);
        ss << JEND(a) << JFLT("pos_y_pre"     ,s.player[p].frame[f].pos_y_pre);
        ss << JEND(a) << JFLT("face_dir_pre"  ,s.player[p].frame[f].face_dir_pre);
        ss << JEND(a) << JFLT("joy_x"         ,s.player[p].frame[f].joy_x);
        ss << JEND(a) << JFLT("joy_y"         ,s.player[p].frame[f].joy_y);
        ss << JEND(a) << JFLT("c_x"           ,s.player[p].frame[f].c_x);
        ss << JEND(a) << JFLT("c_y"           ,s.player[p].frame[f].c_y);
        ss << JEND(a) << JFLT("trigger"       ,s.player[p].frame[f].trigger);
        ss << JEND(a) << JUIN("buttons"       ,s.player[p].frame[f].buttons);
        ss << JEND(a) << JFLT("phys_l"        ,s.player[p].frame[f].phys_l);
        ss << JEND(a) << JFLT("phys_r"        ,s.player[p].frame[f].phys_r);
        ss << JEND(a) << JUIN("ucf_x"         ,s.player[p].frame[f].ucf_x);
        ss << JEND(a) << JFLT("percent_pre"   ,s.player[p].frame[f].percent_pre);
        ss << JEND(a) << JUIN("char_id"       ,s.player[p].frame[f].char_id);
        ss << JEND(a) << JUIN("action_post"   ,s.player[p].frame[f].action_post);
        ss << JEND(a) << JFLT("pos_x_post"    ,s.player[p].frame[f].pos_x_post);
        ss << JEND(a) << JFLT("pos_y_post"    ,s.player[p].frame[f].pos_y_post);
        ss << JEND(a) << JFLT("face_dir_post" ,s.player[p].frame[f].face_dir_post);
        ss << JEND(a) << JFLT("percent_post"  ,s.player[p].frame[f].percent_post);
        ss << JEND(a) << JFLT("shield"        ,s.player[p].frame[f].shield);
        ss << JEND(a) << JUIN("hit_with"      ,s.player[p].frame[f].hit_with);
        ss << JEND(a) << JUIN("combo"         ,s.player[p].frame[f].combo);
        ss << JEND(a) << JUIN("hurt_by"       ,s.player[p].frame[f].hurt_by);
        ss << JEND(a) << JUIN("stocks"        ,s.player[p].frame[f].stocks);
        ss << JEND(a) << JFLT("action_fc"     ,s.player[p].frame[f].action_fc);

        if(MIN_VERSION(2,0,0)) {
          ss << JEND(a) << JUIN("missile_type"  ,s.player[p].frame[f].flags_1);
          ss << JEND(a) << JUIN("turnip_face"   ,s.player[p].frame[f].flags_2);
          ss << JEND(a) << JUIN("is_launched"   ,s.player[p].frame[f].flags_3);
          ss << JEND(a) << JUIN("charged_power" ,s.player[p].frame[f].flags_4);
          ss << JEND(a) << JUIN("flags_5"       ,s.player[p].frame[f].flags_5);
          ss << JEND(a) << JUIN("hitstun"       ,s.player[p].frame[f].hitstun);
          ss << JEND(a) << JUIN("airborne"      ,s.player[p].frame[f].airborne);
          ss << JEND(a) << JUIN("ground_id"     ,s.player[p].frame[f].ground_id);
          ss << JEND(a) << JUIN("jumps"         ,s.player[p].frame[f].jumps);
          ss << JEND(a) << JUIN("l_cancel"      ,s.player[p].frame[f].l_cancel);
          ss << JEND(a) << JINT("alive"         ,s.player[p].frame[f].alive);
        }

        if(MIN_VERSION(2,1,0)) {
          ss << JEND(a) << JUIN("hurtbox"       ,s.player[p].frame[f].hurtbox);
        }

        if(MIN_VERSION(3,5,0)) {
          ss << JEND(a) << JFLT("self_air_x"    ,s.player[p].frame[f].self_air_x);
          ss << JEND(a) << JFLT("self_air_y"    ,s.player[p].frame[f].self_air_y);
          ss << JEND(a) << JFLT("attack_x"      ,s.player[p].frame[f].attack_x);
          ss << JEND(a) << JFLT("attack_y"      ,s.player[p].frame[f].attack_y);
          ss << JEND(a) << JFLT("self_grd_x"    ,s.player[p].frame[f].self_grd_x);
        }

        if(MIN_VERSION(3,8,0)) {
          ss << JEND(a) << JFLT("hitlag"        ,s.player[p].frame[f].hitlag);
        }

        if(MIN_VERSION(3,11,0)) {
          ss << JEND(a) << JUIN("anim_index"    ,s.player[p].frame[f].anim_index);
        }

        ss << " }\n";
      }
    }
  }

  return ss.str();
}

std::string SlippiReplay::itemFramesAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;
    int a = 0;
    for (unsigned i = 0; i < MAX_ITEMS; ++i) {
      if (s.item[i].spawn_id > MAX_ITEMS) {
        break;
      }
      for (unsigned f = 0; f < s.item[i].num_frames; ++f) {
        ss << "{ ";
        ss << JEND(a) << JSTR("match_id", s.start_time);
        ss << JEND(a) << JUIN("spawn_id", s.item[i].spawn_id);
        ss << JEND(a) << JUIN("item_type", s.item[i].type);
        ss << JEND(a) << JUIN("frame", s.item[i].frame[f].frame);
        ss << JEND(a) << JUIN("state", s.item[i].frame[f].state);
        ss << JEND(a) << JFLT("face_dir", s.item[i].frame[f].face_dir);
        ss << JEND(a) << JFLT("xvel", s.item[i].frame[f].xvel);
        ss << JEND(a) << JFLT("yvel", s.item[i].frame[f].yvel);
        ss << JEND(a) << JFLT("xpos", s.item[i].frame[f].xpos);
        ss << JEND(a) << JFLT("ypos", s.item[i].frame[f].ypos);
        ss << JEND(a) << JUIN("damage", s.item[i].frame[f].damage);
        ss << JEND(a) << JFLT("expire", s.item[i].frame[f].expire);

        if (MIN_VERSION(3, 2, 0)) {
          ss << JEND(a) << JUIN("missile_type", s.item[i].frame[f].flags_1);
          ss << JEND(a) << JUIN("turnip_face", s.item[i].frame[f].flags_2);
          ss << JEND(a) << JUIN("is_launched", s.item[i].frame[f].flags_3);
          ss << JEND(a) << JUIN("charged_power", s.item[i].frame[f].flags_4);
        }
        if (MIN_VERSION(3, 6, 0)) {
          ss << JEND(a) << JINT("owner", s.item[i].frame[f].owner);
        }
      }

      ss << " }\n";
    }
  return ss.str();
}

std::string SlippiReplay::fodPlatformChangesAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;

  if (!s.platform_events.empty()) {

    for (size_t i = 0; i < s.platform_events.size(); ++i) {
      const auto& e = s.platform_events[i];
      ss << "{ ";
      int a = 0;
      ss << JEND(a) << JSTR("match_id", s.start_time);
      ss << JEND(a) << JUIN("frame", e.frame);
      ss << JEND(a) << JUIN("platform", e.platform);
      ss << JEND(a) << JFLT("height", e.platform_height);
      ss << " }\n";
    }
    return ss.str();
  }

  return "";
}

std::string SlippiReplay::settingsAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;
  int a = 0;

  ss << "{ ";
  ss << JEND(a) << JSTR("match_id"       ,s.start_time);
  ss << JEND(a) << JSTR("slippi_version" ,s.slippi_version);
  ss << JEND(a) << JUIN("timer"          ,s.timer);
  ss << JEND(a) << JINT("frame_count"    ,s.frame_count);
  ss << JEND(a) << JINT("winner_id"      ,s.winner_id);
  ss << JEND(a) << JUIN("stage"          ,s.stage);
  ss << JEND(a) << JUIN("end_type"       ,s.end_type);
  for (unsigned i = 0; i < 4; ++i) {
    if (s.player[i].player_type != 3) {
       ss << JEND(a) << JSTR(("player_" + std::to_string(i + 1) + "_code")     ,s.player[i].tag_code);
       ss << JEND(a) << JINT(("player_" + std::to_string(i + 1) + "_ext_char") ,s.player[i].ext_char_id);
    }
  }
  ss << " }\n" << std::endl;

  return ss.str();
}
}