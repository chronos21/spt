/* eslint-disable @typescript-eslint/naming-convention */
export interface IBotCore {
    SAVAGE_KILL_DIST: number;
    SOUND_DOOR_BREACH_METERS: number;
    SOUND_DOOR_OPEN_METERS: number;
    STEP_NOISE_DELTA: number;
    JUMP_NOISE_DELTA: number;
    GUNSHOT_SPREAD: number;
    GUNSHOT_SPREAD_SILENCE: number;
    BASE_WALK_SPEREAD2: number;
    MOVE_SPEED_COEF_MAX: number;
    SPEED_SERV_SOUND_COEF_A: number;
    SPEED_SERV_SOUND_COEF_B: number;
    G: number;
    STAY_COEF: number;
    SIT_COEF: number;
    LAY_COEF: number;
    MAX_ITERATIONS: number;
    START_DIST_TO_COV: number;
    MAX_DIST_TO_COV: number;
    STAY_HEIGHT: number;
    CLOSE_POINTS: number;
    COUNT_TURNS: number;
    SIMPLE_POINT_LIFE_TIME_SEC: number;
    DANGER_POINT_LIFE_TIME_SEC: number;
    DANGER_POWER: number;
    COVER_DIST_CLOSE: number;
    GOOD_DIST_TO_POINT: number;
    COVER_TOOFAR_FROM_BOSS: number;
    COVER_TOOFAR_FROM_BOSS_SQRT: number;
    MAX_Y_DIFF_TO_PROTECT: number;
    FLARE_POWER: number;
    MOVE_COEF: number;
    PRONE_POSE: number;
    LOWER_POSE: number;
    MAX_POSE: number;
    FLARE_TIME: number;
    MAX_REQUESTS__PER_GROUP: number;
    UPDATE_GOAL_TIMER_SEC: number;
    DIST_NOT_TO_GROUP: number;
    DIST_NOT_TO_GROUP_SQR: number;
    LAST_SEEN_POS_LIFETIME: number;
    DELTA_GRENADE_START_TIME: number;
    DELTA_GRENADE_END_TIME: number;
    DELTA_GRENADE_RUN_DIST: number;
    DELTA_GRENADE_RUN_DIST_SQRT: number;
    PATROL_MIN_LIGHT_DIST: number;
    HOLD_MIN_LIGHT_DIST: number;
    STANDART_BOT_PAUSE_DOOR: number;
    ARMOR_CLASS_COEF: number;
    SHOTGUN_POWER: number;
    RIFLE_POWER: number;
    PISTOL_POWER: number;
    SMG_POWER: number;
    SNIPE_POWER: number;
    GESTUS_PERIOD_SEC: number;
    GESTUS_AIMING_DELAY: number;
    GESTUS_REQUEST_LIFETIME: number;
    GESTUS_FIRST_STAGE_MAX_TIME: number;
    GESTUS_SECOND_STAGE_MAX_TIME: number;
    GESTUS_MAX_ANSWERS: number;
    GESTUS_FUCK_TO_SHOOT: number;
    GESTUS_DIST_ANSWERS: number;
    GESTUS_DIST_ANSWERS_SQRT: number;
    GESTUS_ANYWAY_CHANCE: number;
    TALK_DELAY: number;
    CAN_SHOOT_TO_HEAD: boolean;
    CAN_TILT: boolean;
    TILT_CHANCE: number;
    MIN_BLOCK_DIST: number;
    MIN_BLOCK_TIME: number;
    COVER_SECONDS_AFTER_LOSE_VISION: number;
    MIN_ARG_COEF: number;
    MAX_ARG_COEF: number;
    DEAD_AGR_DIST: number;
    MAX_DANGER_CARE_DIST_SQRT: number;
    MAX_DANGER_CARE_DIST: number;
    MIN_MAX_PERSON_SEARCH: number;
    PERCENT_PERSON_SEARCH: number;
    LOOK_ANYSIDE_BY_WALL_SEC_OF_ENEMY: number;
    CLOSE_TO_WALL_ROTATE_BY_WALL_SQRT: number;
    SHOOT_TO_CHANGE_RND_PART_MIN: number;
    SHOOT_TO_CHANGE_RND_PART_MAX: number;
    SHOOT_TO_CHANGE_RND_PART_DELTA: number;
    FORMUL_COEF_DELTA_DIST: number;
    FORMUL_COEF_DELTA_SHOOT: number;
    FORMUL_COEF_DELTA_FRIEND_COVER: number;
    SUSPETION_POINT_DIST_CHECK: number;
    MAX_BASE_REQUESTS_PER_PLAYER: number;
    MAX_HOLD_REQUESTS_PER_PLAYER: number;
    MAX_GO_TO_REQUESTS_PER_PLAYER: number;
    MAX_COME_WITH_ME_REQUESTS_PER_PLAYER: number;
    CORE_POINT_MAX_VALUE: number;
    CORE_POINTS_MAX: number;
    CORE_POINTS_MIN: number;
    BORN_POISTS_FREE_ONLY_FAREST_BOT: boolean;
    BORN_POINSTS_FREE_ONLY_FAREST_PLAYER: boolean;
    SCAV_GROUPS_TOGETHER: boolean;
    LAY_DOWN_ANG_SHOOT: number;
    HOLD_REQUEST_TIME_SEC: number;
    TRIGGERS_DOWN_TO_RUN_WHEN_MOVE: number;
    MIN_DIST_TO_RUN_WHILE_ATTACK_MOVING: number;
    MIN_DIST_TO_RUN_WHILE_ATTACK_MOVING_OTHER_ENEMIS: number;
    MIN_DIST_TO_STOP_RUN: number;
    JUMP_SPREAD_DIST: number;
    LOOK_TIMES_TO_KILL: number;
    COME_INSIDE_TIMES: number;
    TOTAL_TIME_KILL: number;
    TOTAL_TIME_KILL_AFTER_WARN: number;
    MOVING_AIM_COEF: number;
    VERTICAL_DIST_TO_IGNORE_SOUND: number;
    DEFENCE_LEVEL_SHIFT: number;
    MIN_DIST_CLOSE_DEF: number;
    USE_ID_PRIOR_WHO_GO: boolean;
    SMOKE_GRENADE_RADIUS_COEF: number;
    GRENADE_PRECISION: number;
    MAX_WARNS_BEFORE_KILL: number;
    CARE_ENEMY_ONLY_TIME: number;
    MIDDLE_POINT_COEF: number;
    MAIN_TACTIC_ONLY_ATTACK: boolean;
    LAST_DAMAGE_ACTIVE: number;
    SHALL_DIE_IF_NOT_INITED: boolean;
    CHECK_BOT_INIT_TIME_SEC: number;
    WEAPON_ROOT_Y_OFFSET: number;
    DELTA_SUPRESS_DISTANCE_SQRT: number;
    DELTA_SUPRESS_DISTANCE: number;
    WAVE_COEF_LOW: number;
    WAVE_COEF_MID: number;
    WAVE_COEF_HIGH: number;
    WAVE_COEF_HORDE: number;
    WAVE_ONLY_AS_ONLINE: boolean;
    LOCAL_BOTS_COUNT: number;
    AXE_MAN_KILLS_END: number;
}
