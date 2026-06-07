const test = require('node:test');
const assert = require('node:assert');

// 1. Mock the database module before importing the Express app
const db = require('../database');

// Simple in-memory mock tables
let mockUsers = [
  { email: 'admin@school.com', password: 'admin123', name: 'Jean Admin', role: 'admin', studentId: null }
];
let mockStudents = [
  { id: 'STU001', firstName: 'Alice', lastName: 'Smith', email: 'student@school.com', birthDate: '2004-05-15', class: 'Informatique A' }
];
let mockGrades = [
  { id: 'g1', studentId: 'STU001', subject: 'Algorithmique', score: 16, coefficient: 3 }
];

db.initDB = async () => {}; // No-op
db.get = async (sql, params = []) => {
  if (sql.includes('SELECT * FROM users WHERE email = ? AND password = ?')) {
    return mockUsers.find(u => u.email === params[0] && u.password === params[1]) || null;
  }
  if (sql.includes('SELECT * FROM users WHERE email = ?')) {
    return mockUsers.find(u => u.email === params[0]) || null;
  }
  if (sql.includes('SELECT * FROM students WHERE id = ?')) {
    return mockStudents.find(s => s.id === params[0]) || null;
  }
  if (sql.includes('SELECT id FROM students ORDER BY id DESC LIMIT 1')) {
    return mockStudents[mockStudents.length - 1] || null;
  }
  return null;
};
db.all = async (sql, params = []) => {
  if (sql.includes('SELECT * FROM students')) {
    return mockStudents;
  }
  if (sql.includes('SELECT * FROM grades WHERE studentId = ?')) {
    return mockGrades.filter(g => g.studentId === params[0]);
  }
  return [];
};
db.run = async (sql, params = []) => {
  if (sql.includes('INSERT INTO students')) {
    const newStudent = { id: params[0], firstName: params[1], lastName: params[2], email: params[3], birthDate: params[4], class: params[5] };
    mockStudents.push(newStudent);
    return { id: params[0], changes: 1 };
  }
  if (sql.includes('INSERT INTO users')) {
    const newUser = { email: params[0], password: params[1], name: params[2], role: params[3], studentId: params[4] };
    mockUsers.push(newUser);
    return { id: params[0], changes: 1 };
  }
  return { id: null, changes: 0 };
};

// 2. Now import app and supertest
const request = require('supertest');
const app = require('../server');

test('POST /api/auth/login with valid admin credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@school.com', password: 'admin123' });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.role, 'admin');
});

test('POST /api/auth/login with invalid credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@school.com', password: 'wrongpassword' });

  assert.strictEqual(res.status, 401);
  assert.ok(res.body.error);
});

test('GET /api/students without authentication', async () => {
  const res = await request(app).get('/api/students');
  assert.strictEqual(res.status, 401);
});

test('GET /api/students with admin auth token', async () => {
  // Generate admin token
  const tokenPayload = { email: 'admin@school.com', role: 'admin' };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

  const res = await request(app)
    .get('/api/students')
    .set('Authorization', token);

  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.strictEqual(res.body[0].firstName, 'Alice');
});
