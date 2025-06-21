const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');

module.exports = async function importReplayJson(replayPath) {
  try {

    const bigquery = new BigQuery();

    let data =   JSON.parse(fs.readFileSync(replayPath, 'utf8'));
    const datasetId = 'wot_data';
    const gamesTable = 'Games';
    const playersTable = 'Players';

    const gameId = `${data.map}_${Date.now()}`;
    const mapValue = data.map || null;

    // --- Type Checking and Handling for map ---
    if (mapValue !== null && typeof mapValue !== 'string') {
      console.warn(`⚠️  Map value is not a string. Converting to string: ${mapValue}`);
      mapValue = String(mapValue); // Convert to string
    }

    // --- Type Checking and Handling for shots (JSON) ---
    let shotsValue = data.shots || null;
    if (shotsValue !== null) {
      try {
        // Try to stringify it.  If it's already a JSON string, this will work fine.
        shotsValue = JSON.stringify(shotsValue);
      } catch (err) {
        console.warn(`⚠️  Shots value could not be converted to JSON. Setting to null.`);
        shotsValue = null; // Set to null if not convertible to JSON
      }
    }
    // Insert into Games
    try {
      await bigquery.dataset(datasetId).table(gamesTable).insert([{
        game_id: gameId,
        map: mapValue || null,
        shots: shotsValue || null,
        upload_date: new Date().toISOString()
      }]);
      console.log(`Inserted game ${gameId}`);
    } catch (err) {
      console.error(`❌ Failed to insert game:`, err);
    }

    // Insert into Players
    // filtering out non-numeric keys, as players are stored with playerid as keys
    const playerKeys = Object.keys(data).filter(key => /^\d+$/.test(key));

    console.log(`Found ${playerKeys.length} players in the data.`);
    console.log(`Inserting players for game ${gameId}...`);

    for (const player of playerKeys) {
      const playerData = data[player];
      console.log(`Processing player: ${player}`);
      console.log(`Player data:`, playerData);

      console.log(`Player name:`, playerData.name);
      console.log(`Player tank:`, playerData.tank);
      console.log(`Player statistics:`, playerData.statistics);
      console.log(`Player positions:`, playerData.positions);
      console.log(`typeof playerData.positions:`, typeof playerData.positions);

      try {
        await bigquery.dataset(datasetId).table(playersTable).insert([{
          game_id: gameId,
          player_name: playerData.name || null,
          tank:playerData.tank || null,
          statistics: playerData.statistics || null,
          positions: JSON.stringify(playerData.positions)|| null
        }]);
        console.log(`✅ Inserted player: ${playerData.name}`);
      } catch (err) {
            if (err.name === 'PartialFailureError') {
          console.error('Partial Failure Error:');
          console.error(JSON.stringify(err.errors, null, 2)); // Log the errors array
        } else {
          console.error('Other error:', err);
        }
      }
    }

  } catch (err) {
    console.error(`❌ Unexpected error during import:`, err);
  }
};