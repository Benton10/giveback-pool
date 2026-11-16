-- One row holds the current game. The teacher page replaces it.
CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL);

-- Students who joined. The session column ties each player to one class.
CREATE TABLE IF NOT EXISTS players (
  pid TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  name TEXT NOT NULL,
  joined INTEGER NOT NULL
);

-- One vote per student per question per round. Writing again replaces it.
CREATE TABLE IF NOT EXISTS ballots (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  round INTEGER NOT NULL,
  kind TEXT NOT NULL,
  pid TEXT NOT NULL,
  choice TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ballots_session_round ON ballots (session, round);
CREATE INDEX IF NOT EXISTS players_session ON players (session);
