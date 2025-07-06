const { onObjectFinalized } = require('firebase-functions/v2/storage');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const importReplayJson = require('./upload.js');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

admin.initializeApp();

const ALLOWED_EMAILS = [
  'simonb9th@gmail.com'
  // add as needed
];

async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Missing or invalid Authorization header');
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const email = decodedToken.email;

    if (!email || !ALLOWED_EMAILS.includes(email)) {
      console.warn(`Blocked user with email: ${email}`);
      res.status(403).send('Access denied: unauthorized email');
      return null;
    }

    return decodedToken;
  } catch (error) {
    console.error('Auth error:', error);
    res.status(403).send('Unauthorized');
    return null;
  }
}

// Get data from replays and process with Rust script, then upload to BigQuery
exports.processReplay = onObjectFinalized(async (event) => {

  console.log('processReplay triggered');
  const object = event.data;
  const filePath = object.name;
  if (!filePath.endsWith('.wotreplay')) return;
  console.log(`Processing file: ${filePath}`);
  const bucket = admin.storage().bucket(object.bucket);
  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
  await bucket.file(filePath).download({ destination: tempFilePath });

  // Run your Rust script
  const outputJsonPath = tempFilePath + '.json';
  await new Promise((resolve, reject) => {
    const proc = spawn(process.cwd() + '/Movement', [tempFilePath]);

    proc.stdout.on('data', (data) => {
      console.log(`[Rust stdout]: ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
      console.error(`[Rust stderr]: ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      console.log(`Process exited with code ${code}`);
      if (code === 0) resolve();
      else reject(new Error('Script failed'));
    });
  });

  console.log(`Output JSON path: ${outputJsonPath}`);
  console.log(`Checking for output JSON at: ${outputJsonPath}`);
  if (fs.existsSync(outputJsonPath)) {
    console.log("Uploading structured data to BigQuery using upload.js");
    await importReplayJson(outputJsonPath);
    fs.unlinkSync(outputJsonPath);
    console.log("BigQuery write complete.");
  } else {
    console.error(`Output JSON not found at: ${outputJsonPath}`);
  }
  // Clean up temp file
  fs.unlinkSync(tempFilePath);
});

// get stats from BigQuery
const bigquery = new BigQuery();

const baseQuery = `
  SELECT Players.positions as positions
  FROM \`wot-insight.wot_data.Players\` AS Players
  INNER JOIN \`wot-insight.wot_data.Games\` AS Games
  ON Players.game_id = Games.game_id
  WHERE Games.map = @map
`;

async function getMaps() {
  const query = `SELECT DISTINCT map FROM \`wot-insight.wot_data.Games\``;
  const [rows] = await bigquery.query(query);
  return rows.map(row => row.map);
}

async function precomputeForMap(map) {
  console.log(`Processing map: ${map}`);

  const options = {
    query: baseQuery,
    params: { map },
    types: { map: 'STRING' },
    location: 'US',
  };

  const [rows] = await bigquery.query(options);
  const tempFilePath = path.join(os.tmpdir(), `${map}.json`);
  fs.writeFileSync(tempFilePath, JSON.stringify(rows));

  const dest = `heatmaps/heatmap_${map}.json`;
  await bucket.upload(tempFilePath, {
    destination: dest,
    metadata: { contentType: 'application/json' }
  });

  console.log(`✔ Cached: ${dest}`);
}

exports.precomputeHeatmaps = functions.https.onRequest(async (req, res) => {
  try {
    const maps = await getMaps();
    for (const map of maps) {
      try {
        await precomputeForMap(map);
      } catch (err) {
        console.error(`Error caching ${map}`, err);
      }
    }
    res.send('Heatmaps precomputed and cached successfully.');
  } catch (err) {
    console.error('Failed to precompute heatmaps', err);
    res.status(500).send('Failed to precompute heatmaps');
  }
});

exports.maps = functions.https.onRequest(async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT map
      FROM \`wot-insight.wot_data.Games\`
    `;
    const [rows] = await bigquery.query(query);
    res.json(rows.map(row => row.map));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
}
);


exports.positions = functions.https.onRequest(async (req, res) => {
  try {
    const { map, name } = req.query;

    if (!map) {
      return res.status(400).json({ error: 'Missing required query parameter: map' });
    }

    if (name && typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid query parameter: name must be a string' });
    }

    const isGlobalHeatmap = !name; // no name param means global
    const cacheFileName = `Heatmaps/heatmap_${map}.json`;
    const HeatmapBucket = admin.storage().bucket('wot-insight.firebasestorage.app');

    if (isGlobalHeatmap) {
      const [bucketExists] = await HeatmapBucket.exists();
      if (!bucketExists) {
        console.error(`Bucket does not exist: ${HeatmapBucket.name}`);
        return res.status(500).json({ error: `Bucket does not exist: ${HeatmapBucket.name}` });
      }

      const file = HeatmapBucket.file(cacheFileName);
      const exists = (await file.exists())[0];

      if (exists) {
        console.log(`Serving cached heatmap: ${cacheFileName}`);
        const tempFilePath = path.join(os.tmpdir(), `${map}.json`);
        await file.download({ destination: tempFilePath });
        const cachedData = fs.readFileSync(tempFilePath, 'utf8');
        return res.json(JSON.parse(cachedData));
      }
    }

    // If not cached, query BigQuery
    console.log(`Querying BigQuery for map: ${map}, player name: ${name}`);

    const query = `
      SELECT
        Players.positions as positions
      FROM
        \`wot-insight.wot_data.Players\` AS Players
      INNER JOIN
        \`wot-insight.wot_data.Games\` AS Games
      ON Players.game_id = Games.game_id
      WHERE
        Games.map = @map
        AND (@name IS NULL OR Players.player_name = @name)
        AND Players.statistics.POV = Players.statistics.team
    `;

    const options = {
      query,
      params: { map, name: name || null },
      types: {
        map: 'STRING',
        name: 'STRING'
      },
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    // Cache result if it's a global heatmap
    if (isGlobalHeatmap) {
      const tempFilePath = path.join(os.tmpdir(), `${map}.json`);
      fs.writeFileSync(tempFilePath, JSON.stringify(rows));
      await HeatmapBucket.upload(tempFilePath, {
        destination: cacheFileName,
        metadata: { contentType: 'application/json' }
      });
      console.log(`Cached heatmap saved: ${cacheFileName}`);
    }

    return res.json(rows);

  } catch (err) {
    console.error("Error in /positions:", err);
    return res.status(500).json({ error: 'Failed to fetch positions data' });
  }
});

exports.graph = functions.https.onRequest(async (req, res) => {
  try {
    const allowedStats = [
      'winrate',
      'capture_points',
      'comp7PrestigePoints',
      'damageAssistedRadio',
      'damageDealt',
      'damage_recieved',
      'direct_enemy_hits',
      'kills',
      'lifetime',
      'mileage',
      'role_skill_used',
      'shots',
      'spotted',
      'games_played'
    ];


    const { map, x, y, z } = req.query;

    // Validate inputs
    if (!map || !x || !y || !z) {
      return res.status(400).json({ error: 'Missing required query parameters: map, x, y, z' });
    }

    if (![x, y, z].every(stat => allowedStats.includes(stat))) {
      return res.status(400).json({ error: 'Invalid stat field in x, y, or z' });
    }

    const query = `
      SELECT
        Players.tank,
        COUNT(*) AS total_games,
        ${x === 'winrate' ? 'AVG(CAST(Players.statistics.team = Players.statistics.winnerTeam AS INT64))*100 AS avg_winrate,' : `AVG(Players.statistics.${x}) AS avg_${x},`}
        ${y === 'winrate' ? 'AVG(CAST(Players.statistics.team = Players.statistics.winnerTeam AS INT64))*100 AS avg_winrate,' : `AVG(Players.statistics.${y}) AS avg_${y},`}
        ${z === 'winrate' ? 'AVG(CAST(Players.statistics.team = Players.statistics.winnerTeam AS INT64))*100 AS avg_winrate' : `AVG(Players.statistics.${z}) AS avg_${z}`}
      FROM
        \`wot-insight.wot_data.Players\` AS Players
      INNER JOIN
        \`wot-insight.wot_data.Games\` AS Games
      ON Players.game_id = Games.game_id
      WHERE
        (@map = 'all' OR Games.map = @map)
      GROUP BY Players.tank
    `;

    const options = {
      query,
      params: { map },
      location: 'US', // or your dataset's location
    };

    const [rows] = await bigquery.query(options);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

exports.stats = functions.https.onRequest(async (req, res) => {

  try {
    const { name, tank, map} = req.query;
    const sort_by = req.query.sort_by
    console.log(`Received query params: name=${name}, tank=${tank}, map=${map}, sort_by=${sort_by},${req.sort_by}`);
    // Dynamically build WHERE clause
    const conditions = [];
    const params = {};

    if (name) {
      conditions.push('Players.player_name = @name');
      params.name = name;
    }
    if (tank) {
      conditions.push('Players.tank = @tank');
      params.tank = tank;
    }
    if (map) {
      conditions.push('Games.map = @map');
      params.map = map;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    console.log(`WHERE clause: ${whereClause}`);

    // Dynamically build Order by/Sort by clause
    const allowedSorts = [
        'winrate',
        'avg_capture_points',
        'avg_comp7_prestige_points',
        'avg_damage_assisted_radio',
        'avg_damage_dealt',
        'avg_damage_recieved',
        'avg_direct_enemy_hits',
        'avg_kills',
        'avg_lifetime',
        'avg_mileage',
        'avg_role_skill_used',
        'avg_shots',
        'avg_spotted',
        'games_played'
      ];
    let sortbyClause = "";
    if (sort_by && allowedSorts.includes(sort_by)) {
      sortbyClause = ` ORDER BY ${sort_by} DESC`;
    }
    console.log(`sortby clause: ${sortbyClause}`);

    // Construct full query
    let query = `
    SELECT
      Players.player_name,
      Games.map,
      Players.tank,
      COUNT(*) AS games_played,
      ROUND(AVG(CASE WHEN Players.statistics.team = Players.statistics.winnerTeam THEN 1 ELSE 0 END), 2) AS winrate,
      ROUND(AVG(Players.statistics.capturePoints), 2) AS avg_capture_points,
      ROUND(AVG(Players.statistics.comp7PrestigePoints), 2) AS avg_comp7_prestige_points,
      ROUND(AVG(Players.statistics.damageAssistedRadio), 2) AS avg_damage_assisted_radio,
      ROUND(AVG(Players.statistics.damageDealt), 2) AS avg_damage_dealt,
      ROUND(AVG(Players.statistics.damageRecieved), 2) AS avg_damage_recieved,
      ROUND(AVG(Players.statistics.directEnemyHits), 2) AS avg_direct_enemy_hits,
      ROUND(AVG(Players.statistics.kills), 2) AS avg_kills,
      ROUND(AVG(Players.statistics.lifetime), 2) AS avg_lifetime,
      ROUND(AVG(Players.statistics.mileage), 2) AS avg_mileage,
      ROUND(AVG(Players.statistics.roleSkillUsed), 2) AS avg_role_skill_used,
      ROUND(AVG(Players.statistics.shots), 2) AS avg_shots,
      ROUND(AVG(Players.statistics.spotted), 2) AS avg_spotted
    FROM
      \`wot-insight.wot_data.Players\` AS Players
    INNER JOIN
      \`wot-insight.wot_data.Games\` AS Games
    ON
      Players.game_id = Games.game_id
    ${whereClause}
    GROUP BY
      1, 2, 3
    ${sortbyClause}
  `;

    const [rows] = await bigquery.query({ query, params });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});