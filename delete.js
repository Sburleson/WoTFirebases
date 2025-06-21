const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'WOT.db');
const db = new sqlite3.Database(dbPath);

module.exports = function wipeDatabase() {

db.serialize(() => {
  db.run("DELETE FROM statistics");
  db.run("DELETE FROM shots");
  db.run("DELETE FROM positions");
  db.run("DELETE FROM players");
  db.run("DELETE FROM games");
  db.run("VACUUM"); // Optional: reclaim disk space
  console.log("Database wiped.");
  db.close();
});
}