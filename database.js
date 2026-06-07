const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_FILE);

// Helper to wrap db.run, db.get, db.all in Promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDB() {
  // Create Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      studentId TEXT
    )
  `);

  // Create Students Table
  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      birthDate TEXT,
      class TEXT
    )
  `);

  // Create Grades Table
  await run(`
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      subject TEXT NOT NULL,
      score REAL NOT NULL,
      coefficient INTEGER NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students (id) ON DELETE CASCADE
    )
  `);

  // Seed default data if empty
  const userCount = await get(`SELECT COUNT(*) as count FROM users`);
  if (userCount.count === 0) {
    // Insert Users
    await run(`INSERT INTO users (email, password, name, role, studentId) VALUES (?, ?, ?, ?, ?)`, 
      ['admin@school.com', 'admin123', 'Jean Admin', 'admin', null]);
    await run(`INSERT INTO users (email, password, name, role, studentId) VALUES (?, ?, ?, ?, ?)`, 
      ['teacher@school.com', 'teacher123', 'Prof. Marie Curie', 'teacher', null]);
    await run(`INSERT INTO users (email, password, name, role, studentId) VALUES (?, ?, ?, ?, ?)`, 
      ['student@school.com', 'student123', 'Alice Smith', 'student', 'STU001']);

    // Insert Students
    await run(`INSERT INTO students (id, firstName, lastName, email, birthDate, class) VALUES (?, ?, ?, ?, ?, ?)`,
      ['STU001', 'Alice', 'Smith', 'student@school.com', '2004-05-15', 'Informatique A']);
    await run(`INSERT INTO students (id, firstName, lastName, email, birthDate, class) VALUES (?, ?, ?, ?, ?, ?)`,
      ['STU002', 'Bob', 'Johnson', 'bob.johnson@school.com', '2003-09-22', 'Informatique A']);
    await run(`INSERT INTO students (id, firstName, lastName, email, birthDate, class) VALUES (?, ?, ?, ?, ?, ?)`,
      ['STU003', 'Camille', 'Dupont', 'camille.dupont@school.com', '2004-01-10', 'Informatique B']);

    // Insert Grades
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g1', 'STU001', 'Algorithmique', 16, 3]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g2', 'STU001', 'Bases de Données', 14, 2]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g3', 'STU001', 'Développement Web', 18, 4]);

    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g4', 'STU002', 'Algorithmique', 12, 3]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g5', 'STU002', 'Bases de Données', 11, 2]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g6', 'STU002', 'Développement Web', 15, 4]);

    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g7', 'STU003', 'Algorithmique', 15, 3]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g8', 'STU003', 'Bases de Données', 16, 2]);
    await run(`INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`, ['g9', 'STU003', 'Développement Web', 13, 4]);
  }
}

module.exports = {
  run,
  get,
  all,
  initDB
};
