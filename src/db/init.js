require('dotenv').config();
const { connectToArangoDB } = require('./connector');
const dialoguesModel = require('../models/dialogues.model');
const remindersModel = require('../models/reminders.model');
const knowledgeBaseModel = require('../models/knowledgeBase.model');
const todosModel = require('../models/todos.model');

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Connect to ArangoDB
    await connectToArangoDB();
    
    // Initialize all models (creates collections if needed)
    await dialoguesModel.initialize();
    await remindersModel.initialize();
    await knowledgeBaseModel.initialize();
    await todosModel.initialize();
    
    console.log('✓ Database initialization complete!');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };