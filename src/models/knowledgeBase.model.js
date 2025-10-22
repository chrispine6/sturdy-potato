const { getDatabase, ensureCollection } = require('../db/connector');

const COLLECTION_NAME = 'knowledge_base';

class KnowledgeBaseModel {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    this.collection = await ensureCollection(COLLECTION_NAME);
  }

  // Add a knowledge entry
  async addEntry(category, topic, content, tags = []) {
    try {
      const entry = {
        category,
        topic,
        content,
        tags,
        createdAt: new Date().toISOString()
      };
      const result = await this.collection.save(entry);
      return result;
    } catch (error) {
      console.error('Error adding knowledge entry:', error);
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