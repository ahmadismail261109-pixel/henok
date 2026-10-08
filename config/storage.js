const { Redis } = require('@upstash/redis');

class StorageConfig {
  constructor() {
    this.redisKey = 'hotspot_users_data';
    // Inisialisasi eksplisit menggunakan environment variables Vercel
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  async getUsersData() {
    try {
      const data = await this.redis.get(this.redisKey);
      if (data) {
        // Jika data tersimpan sebagai string JSON ataupun objek langsung
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      return { users: [] };
    } catch (error) {
      console.error('Error getting data from Redis:', error);
      return { users: [] };
    }
  }

  async saveUsersData(data) {
    try {
      await this.redis.set(this.redisKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data to Redis:', error);
      throw error;
    }
  }

  async addUser(userData) {
    try {
      const db = await this.getUsersData();
      if (!db.users) db.users = [];

      const timestamp = new Date().toISOString();
      const newUser = {
        id: Date.now().toString(),
        timestamp,
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        username: userData.username,
        password: userData.password,
        status: 'pending',
        approvedAt: '',
        approvedBy: ''
      };

      db.users.push(newUser);
      await this.saveUsersData(db);
      
      return newUser;
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const db = await this.getUsersData();
      return db.users || [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  async approveUser(username, adminName = 'Admin') {
    try {
      const db = await this.getUsersData();
      const userIndex = db.users.findIndex(u => u.username === username);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }
      
      db.users[userIndex].status = 'approved';
      db.users[userIndex].approvedAt = new Date().toISOString();
      db.users[userIndex].approvedBy = adminName;
      
      await this.saveUsersData(db);
      return db.users[userIndex];
    } catch (error) {
      console.error('Error approving user:', error);
      throw error;
    }
  }

  async rejectUser(username, adminName = 'Admin') {
    try {
      const db = await this.getUsersData();
      const userIndex = db.users.findIndex(u => u.username === username);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }
      
      db.users[userIndex].status = 'rejected';
      db.users[userIndex].approvedAt = new Date().toISOString();
      db.users[userIndex].approvedBy = adminName;
      
      await this.saveUsersData(db);
      return db.users[userIndex];
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    try {
      const db = await this.getUsersData();
      return db.users.find(u => u.username === username) || null;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  async deleteUser(username) {
    try {
      const db = await this.getUsersData();
      const userIndex = db.users.findIndex(u => u.username === username);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }
      
      db.users.splice(userIndex, 1);
      await this.saveUsersData(db);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

module.exports = new StorageConfig();
