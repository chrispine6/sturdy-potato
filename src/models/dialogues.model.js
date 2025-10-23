const { getDatabase, ensureCollection } = require('../db/connector');
const OpenAI = require('openai');

const COLLECTION_NAME = 'dialogues';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class DialoguesModel {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    this.collection = await ensureCollection(COLLECTION_NAME);
  }

  async generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async saveDialogue(userId, userName, userMessage, botResponse) {
    try {
      // Generate embedding for the user message
      const embedding = await this.generateEmbedding(userMessage);
      
      const dialogue = {
        userId,
        userName,
        userMessage,
        botResponse,
        embedding,
        timestamp: new Date().toISOString()
      };
      
      const result = await this.collection.save(dialogue);
      return result;
    } catch (error) {
      console.error('Error saving dialogue:', error);
      throw error;
    }
  }

  async getUserDialogues(userId, limit = 10) {
    try {
      const db = getDatabase();
      const query = `
        FOR dialogue IN ${COLLECTION_NAME}
        FILTER dialogue.userId == @userId
        SORT dialogue.timestamp DESC
        LIMIT @limit
        RETURN dialogue
      `;
      
      const cursor = await db.query(query, { userId, limit });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting user dialogues:', error);
      throw error;
    }
  }

  async searchSimilarDialogues(userId, queryText, limit = 5) {
    try {
      const db = getDatabase();
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Using cosine similarity for vector search
      const query = `
        FOR dialogue IN ${COLLECTION_NAME}
        FILTER dialogue.userId == @userId
        LET similarity = COSINE_SIMILARITY(dialogue.embedding, @queryEmbedding)
        SORT similarity DESC
        LIMIT @limit
        RETURN MERGE(dialogue, { similarity })
      `;
      
      const cursor = await db.query(query, { 
        userId, 
        queryEmbedding,
        limit 
      });
      return await cursor.all();
    } catch (error) {
      console.error('Error searching similar dialogues:', error);
      throw error;
    }
  }

  async getDialogueCount(userId = null) {
    try {
      const db = getDatabase();
      const query = userId
        ? `RETURN LENGTH(FOR dialogue IN ${COLLECTION_NAME} FILTER dialogue.userId == @userId RETURN 1)`
        : `RETURN LENGTH(${COLLECTION_NAME})`;
      
      const cursor = await db.query(query, userId ? { userId } : {});
      const result = await cursor.all();
      return result[0] || 0;
    } catch (error) {
      console.error('Error getting dialogue count:', error);
      throw error;
    }
  }

  async deleteUserDialogues(userId) {
    try {
      const db = getDatabase();
      const query = `
        FOR dialogue IN ${COLLECTION_NAME}
        FILTER dialogue.userId == @userId
        REMOVE dialogue IN ${COLLECTION_NAME}
      `;
      
      await db.query(query, { userId });
      return true;
    } catch (error) {
      console.error('Error deleting user dialogues:', error);
      throw error;
    }
  }
}

module.exports = new DialoguesModel();