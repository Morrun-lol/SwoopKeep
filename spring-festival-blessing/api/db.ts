import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize tables
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      openid VARCHAR(100) PRIMARY KEY,
      nickname VARCHAR(100) NOT NULL,
      avatar_url VARCHAR(500),
      gender TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS works (
      work_id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      avatar_url VARCHAR(500) NOT NULL,
      voice_url VARCHAR(500),
      blessing_text TEXT,
      style_type VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      share_count INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS avatars (
      avatar_id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      original_url VARCHAR(500) NOT NULL,
      q_version_url VARCHAR(500) NOT NULL,
      style_type VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shares (
      share_id VARCHAR(50) PRIMARY KEY,
      work_id VARCHAR(50) NOT NULL,
      share_type VARCHAR(20) NOT NULL,
      share_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      recipient_info VARCHAR(200)
    );
  `);
  console.log('Database initialized');
};

initDb();

export default db;
