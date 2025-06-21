-- Games table: one row per replay/game
CREATE TABLE games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
    map TEXT,
    date_played TEXT -- or other metadata
);

-- Players table: one row per player
CREATE TABLE players (
    player_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
);

-- Statistics table: one row per player per game
CREATE TABLE statistics (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    player_id INTEGER,
    tank TEXT,
    pov INTEGER,
    capture_points INTEGER,
    comp7_prestige_points INTEGER,
    damage_assisted_radio INTEGER,
    damage_dealt INTEGER,
    damage_recieved INTEGER,
    direct_enemy_hits INTEGER,
    kills INTEGER,
    lifetime INTEGER,
    mileage INTEGER,
    role_skill_used INTEGER,
    shots INTEGER,
    spotted INTEGER,
    team INTEGER,
    winner_team INTEGER,
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    FOREIGN KEY(player_id) REFERENCES players(player_id)
);

-- Shots table: one row per shot, linked to game and shooter/target
CREATE TABLE shots (
    shot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    shooter_id INTEGER,
    target_id INTEGER,
    x INTEGER,
    y INTEGER,
    z INTEGER,
    time REAL,
    damage INTEGER,
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    FOREIGN KEY(shooter_id) REFERENCES players(player_id),
    FOREIGN KEY(target_id) REFERENCES players(player_id)
);

-- Positions table: one row per position, linked to game and player
CREATE TABLE positions (
    position_id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER,
    player_id INTEGER,
    x INTEGER,
    y INTEGER,
    z INTEGER,
    time REAL,
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    FOREIGN KEY(player_id) REFERENCES players(player_id)
);