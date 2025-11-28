const { getDatabase, ensureCollection } = require('../db/connector');

const COLLECTION_NAME = 'todos';

class TodosModel {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    this.collection = await ensureCollection(COLLECTION_NAME);
  }

  async createTodo(userId, userName, todoText, priority = 'medium') {
    try {
      const todo = {
        userId,
        userName,
        todoText,
        priority, // low, medium, high
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      
      const result = await this.collection.save(todo);
      return result;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }

  async getUserTodos(userId, includeCompleted = false) {
    try {
      const db = getDatabase();
      const query = `
        FOR todo IN ${COLLECTION_NAME}
        FILTER todo.userId == @userId
        ${!includeCompleted ? 'FILTER todo.completed == false' : ''}
        SORT todo.createdAt DESC
        RETURN todo
      `;
      
      const cursor = await db.query(query, { userId });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting user todos:', error);
      throw error;
    }
  }

  async getTodosByPriority(userId, priority) {
    try {
      const db = getDatabase();
      const query = `
        FOR todo IN ${COLLECTION_NAME}
        FILTER todo.userId == @userId
        FILTER todo.priority == @priority
        FILTER todo.completed == false
        SORT todo.createdAt DESC
        RETURN todo
      `;
      
      const cursor = await db.query(query, { userId, priority });
      return await cursor.all();
    } catch (error) {
      console.error('Error getting todos by priority:', error);
      throw error;
    }
  }

  async markAsCompleted(todoKey) {
    try {
      const result = await this.collection.update(todoKey, { 
        completed: true,
        completedAt: new Date().toISOString()
      });
      return result;
    } catch (error) {
      console.error('Error marking todo as completed:', error);
      throw error;
    }
  }

  async markMultipleAsCompleted(todoKeys) {
    try {
      const updates = todoKeys.map(key => ({
        _key: key,
        completed: true,
        completedAt: new Date().toISOString()
      }));
      
      if (typeof this.collection.bulkUpdate === 'function') {
        await this.collection.bulkUpdate(updates);
      } else {
        for (const update of updates) {
          await this.collection.update(update._key,{
            completed: update.completed,
            completedAt: update.completedAt
          });
        }
      }
      return true;
    } catch (error) {
      console.error('error while marking multiple todos as completed: ', error);
      throw error;
    }
  }

  async updateTodo(todoKey, updates) {
    try {
      const result = await this.collection.update(todoKey, updates);
      return result;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  async deleteTodo(todoKey) {
    try {
      await this.collection.remove(todoKey);
      return true;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  async getTodoCount(userId, completed = false) {
    try {
      const db = getDatabase();
      const query = `
        RETURN LENGTH(
          FOR todo IN ${COLLECTION_NAME}
          FILTER todo.userId == @userId
          FILTER todo.completed == @completed
          RETURN 1
        )
      `;
      
      const cursor = await db.query(query, { userId, completed });
      const result = await cursor.all();
      return result[0] || 0;
    } catch (error) {
      console.error('Error getting todo count:', error);
      throw error;
    }
  }

  async deleteCompletedTodos(userId) {
    try {
      const db = getDatabase();
      const query = `
        FOR todo IN ${COLLECTION_NAME}
        FILTER todo.userId == @userId
        FILTER todo.completed == true
        REMOVE todo IN ${COLLECTION_NAME}
      `;
      
      await db.query(query, { userId });
      return true;
    } catch (error) {
      console.error('Error deleting completed todos:', error);
      throw error;
    }
  }
}

module.exports = new TodosModel();
