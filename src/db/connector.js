const { Database } = require('arangojs');

let db = null;

async function connectToArangoDB() {
  if (db) {
    return db;
  }

  try {
    // Create initial connection to _system database
    const systemDb = new Database({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || ''
      }
    });

    // Check if our database exists
    const dbName = process.env.ARANGO_DB_NAME || 'watson-stark';
    const databases = await systemDb.listDatabases();
    
    if (!databases.includes(dbName)) {
      await systemDb.createDatabase(dbName);
      console.log(`✓ Database "${dbName}" created`);
    }

    // Connect to our database
    db = new Database({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      databaseName: dbName,
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || ''
      }
    });

    console.log(`✓ Connected to database "${dbName}"`);
    return db;
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