const { getDatabase, ensureCollection } = require('../db/connector');
const OpenAI = require('openai');

const COLLECTION_NAME = 'knowledge_base';
const EDGE_COLLECTION_NAME = 'knowledge_links';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class KnowledgeBaseModel {
  constructor() {
    this.collection = null;
    this.edgeCollection = null;
  }

  async initialize() {
    this.collection = await ensureCollection(COLLECTION_NAME);
    this.edgeCollection = await this.ensureEdgeCollection(EDGE_COLLECTION_NAME);
  }

  async ensureEdgeCollection(name) {
    const db = getDatabase();
    const collection = db.collection(name);
    if (!await collection.exists()) {
      await collection.create({ type: 3 }); // 3 for edge collection
    }
    return collection;
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

  // Add a knowledge entry
  async addEntry(category, topic, content, tags = []) {
    try {
      const embedding = await this.generateEmbedding(content);
      const entry = {
        category,
        topic,
        content,
        tags,
        embedding,
        createdAt: new Date().toISOString()
      };
      const result = await this.collection.save(entry);
      // Link to similar documents
      await this.linkSimilarDocuments(result._id);
      return result;
    } catch (error) {
      console.error('Error adding knowledge entry:', error);
      throw error;
    }
  }

  async linkSimilarDocuments(newDocId, threshold = 0.8, limit = 5) {
    try {
      const db = getDatabase();
      const newDoc = await this.collection.document(newDocId);
      const queryEmbedding = newDoc.embedding;
      const query = `
        FOR doc IN ${COLLECTION_NAME}
        FILTER doc._id != @newDocId
        LET similarity = COSINE_SIMILARITY(doc.embedding, @queryEmbedding)
        FILTER similarity > @threshold
        SORT similarity DESC
        LIMIT @limit
        RETURN { _from: @newDocId, _to: doc._id, similarity }
      `;
      const cursor = await db.query(query, { newDocId, queryEmbedding, threshold, limit });
      const links = await cursor.all();
      for (const link of links) {
        await this.edgeCollection.save(link);
      }
    } catch (error) {
      console.error('Error linking similar documents:', error);
      throw error;
    }
  }

  // Search the knowledge base by query (case-insensitive substring search on topic/content or tag match)
  async searchByTopic(query) {
    try {
      const db = getDatabase();
      const q = `%${query.toLowerCase()}%`;
      const aql = `
        FOR doc IN ${COLLECTION_NAME}
          FILTER LOWER(doc.topic) LIKE @q
            OR LOWER(doc.content) LIKE @q
            OR @tag IN doc.tags
          SORT doc.createdAt DESC
          RETURN doc
      `;
      const cursor = await db.query(aql, { q, tag: query.toLowerCase() });
      const results = await cursor.all();
      return results;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  // Optional helper: get all entries for a user/category (not used by ai.service.js but useful)
  async getEntriesByCategory(category) {
    try {
      const db = getDatabase();
      const query = `
        FOR doc IN ${COLLECTION_NAME}
          FILTER doc.category == @category
          SORT doc.createdAt DESC
          RETURN doc
      `;
      const cursor = await db.query(query, { category });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting entries by category:', error);
      throw error;
    }
  }
}

module.exports = new KnowledgeBaseModel();