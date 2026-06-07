const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'mihi_db'
});

// Helper functions matching SQLite signatures to minimize changes in server.js
async function run(sql, params = []) {
  // Replace sqlite style ? placeholders with $1, $2 for Postgres
  const pgSql = convertPlaceholders(sql);
  const res = await pool.query(pgSql, params);
  return { id: res.insertId, changes: res.rowCount };
}

async function get(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const res = await pool.query(pgSql, params);
  return res.rows[0] || null;
}

async function all(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

// Convert SQLite '?' to PostgreSQL '$1', '$2', ...
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function initDB() {
  // Create Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      email VARCHAR(255) PRIMARY KEY,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      studentId VARCHAR(50)
    )
  `);

  // Create Students Table
  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(50) PRIMARY KEY,
      firstName VARCHAR(255) NOT NULL,
      lastName VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      birthDate VARCHAR(50),
      class VARCHAR(255)
    )
  `);

  // Create Grades Table
  await run(`
    CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(50) PRIMARY KEY,
      studentId VARCHAR(50) NOT NULL REFERENCES students (id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      score NUMERIC(4,2) NOT NULL,
      coefficient INTEGER NOT NULL
    )
  `);

  // Seed default data if empty
  const userCount = await get(`SELECT COUNT(*) as count FROM users`);
  if (parseInt(userCount.count) === 0) {
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
  initDB,
  pool
};
