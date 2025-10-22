const { Database } = require('arangojs');

let db = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToArangoDB() {
  if (db) {
    return db;
  }

  const url = process.env.ARANGO_URL || 'http://arangodb:8529';
  const username = process.env.ARANGO_USERNAME || 'root';
  const password = process.env.ARANGO_PASSWORD || '';
  const dbName = process.env.ARANGO_DB_NAME || 'watson-stark';

  try {
    // Retry loop for transient DNS / connection errors
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Create initial connection to _system database
        const systemDb = new Database({
          url,
          auth: { username, password }
        });

        // Try a lightweight call to ensure the server is reachable
        const databases = await systemDb.listDatabases();

        // If we got databases, proceed
        if (!databases.includes(dbName)) {
          await systemDb.createDatabase(dbName);
          console.log(`✓ Database "${dbName}" created`);
        }

        // Connect to our database
        db = new Database({
          url,
          databaseName: dbName,
          auth: { username, password }
        });

        console.log(`✓ Connected to database "${dbName}" at ${url}`);
        return db;
      } catch (err) {
        // On last attempt throw, otherwise wait and retry
        const isLast = attempt === maxAttempts;
        console.error(`Attempt ${attempt}/${maxAttempts} - error connecting to ArangoDB: ${err.message}`);
        if (isLast) throw err;

        // Exponential backoff with jitter
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 30000);
        const jitter = Math.floor(Math.random() * 300);
        await sleep(backoff + jitter);
      }
    }
  } catch (error) {
    console.error('✗ Error connecting to ArangoDB:', error.message);
    throw error;
  }
}

async function ensureCollection(collectionName) {
  try {
    const collections = await db.listCollections();
    const exists = collections.some(col => col.name === collectionName);
    
    if (!exists) {
      await db.createCollection(collectionName);
      console.log(`✓ Collection "${collectionName}" created`);
    }
    
    return db.collection(collectionName);
  } catch (error) {
    console.error(`✗ Error ensuring collection "${collectionName}":`, error.message);
    throw error;
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not connected. Call connectToArangoDB() first.');
  }
  return db;
}

module.exports = {
  connectToArangoDB,
  ensureCollection,
  getDatabase
};