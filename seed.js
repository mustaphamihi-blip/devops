const db = require('./database');

async function seed() {
  console.log('Seeding SQLite database...');
  try {
    // Drop existing tables if they exist to start fresh
    await db.run('DROP TABLE IF EXISTS grades');
    await db.run('DROP TABLE IF EXISTS users');
    await db.run('DROP TABLE IF EXISTS students');
    
    // Initialize & seed tables
    await db.initDB();
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seed();
