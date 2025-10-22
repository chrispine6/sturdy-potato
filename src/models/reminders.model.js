const { getDatabase, ensureCollection } = require('../db/connector');

const COLLECTION_NAME = 'reminders';

class RemindersModel {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    this.collection = await ensureCollection(COLLECTION_NAME);
  }

  async createReminder(userId, userName, reminderText, reminderTime) {
    try {
      const reminder = {
        userId,
        userName,
        reminderText,
        reminderTime: new Date(reminderTime).toISOString(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      const result = await this.collection.save(reminder);
      return result;
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  async getUserReminders(userId, includeCompleted = false) {
    try {
      const db = getDatabase();
      const query = `
        FOR reminder IN ${COLLECTION_NAME}
        FILTER reminder.userId == @userId
        ${!includeCompleted ? 'FILTER reminder.completed == false' : ''}
        SORT reminder.reminderTime ASC
        RETURN reminder
      `;
      
      const cursor = await db.query(query, { userId });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting user reminders:', error);
      throw error;
    }
  }

  async getPendingReminders() {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const query = `
        FOR reminder IN ${COLLECTION_NAME}
        FILTER reminder.completed == false
        FILTER reminder.reminderTime <= @now
        SORT reminder.reminderTime ASC
        RETURN reminder
      `;
      
      const cursor = await db.query(query, { now });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting pending reminders:', error);
      throw error;
    }
  }

  async markAsCompleted(reminderId) {
    try {
      const result = await this.collection.update(reminderId, { 
        completed: true,
        completedAt: new Date().toISOString()
      });
      return result;
    } catch (error) {
      console.error('Error marking reminder as completed:', error);
      throw error;
    }
  }

  async deleteReminder(reminderId) {
    try {
      await this.collection.remove(reminderId);
      return true;
    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }
}

module.exports = new RemindersModel();