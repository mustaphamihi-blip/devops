const express = require('express');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
db.initDB().then(() => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

app.use(express.json());

// Simple Authorization Middleware
async function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Non autorisé. Veuillez vous connecter.' });
  }
  
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = await db.get(`SELECT * FROM users WHERE email = ?`, [decoded.email]);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé.' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide.' });
  }
}

function checkRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission refusée.' });
    }
    next();
  };
}

// AUTH ENDPOINTS
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password]);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    
    // Create a simple token
    const tokenPayload = { email: user.email, role: user.role };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    
    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, studentId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  try {
    const existingUser = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    if (role === 'student' && !studentId) {
      return res.status(400).json({ error: "L'identifiant étudiant est requis pour le rôle étudiant." });
    }

    await db.run(
      `INSERT INTO users (email, password, name, role, studentId) VALUES (?, ?, ?, ?, ?)`,
      [email, password, name, role, studentId || null]
    );

    res.status(201).json({ message: 'Compte créé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STUDENT CRUD ENDPOINTS
app.get('/api/students', authenticate, checkRole(['admin', 'teacher']), async (req, res) => {
  try {
    const students = await db.all(`SELECT * FROM students`);
    // Attach grades to each student for GPA calculation on consumer side
    for (const student of students) {
      student.grades = await db.all(`SELECT * FROM grades WHERE studentId = ?`, [student.id]);
    }
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', authenticate, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    return res.status(403).json({ error: 'Accès interdit.' });
  }
  
  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }
    student.grades = await db.all(`SELECT * FROM grades WHERE studentId = ?`, [student.id]);
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', authenticate, checkRole(['admin']), async (req, res) => {
  const { firstName, lastName, email, birthDate, class: className } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Prénom, nom et email sont requis.' });
  }

  try {
    // Generate unique student ID
    const lastStudent = await db.get(`SELECT id FROM students ORDER BY id DESC LIMIT 1`);
    const lastId = lastStudent ? parseInt(lastStudent.id.replace('STU', '')) : 0;
    const newId = `STU${String(lastId + 1).padStart(3, '0')}`;


    await db.run(
      `INSERT INTO students (id, firstName, lastName, email, birthDate, class) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId, firstName, lastName, email, birthDate || '', className || 'Non assigné']
    );

    // Auto-create login for the student if not already present
    const existingUser = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!existingUser) {
      await db.run(
        `INSERT INTO users (email, password, name, role, studentId) VALUES (?, ?, ?, ?, ?)`,
        [email, 'student123', `${firstName} ${lastName}`, 'student', newId]
      );
    }

    const createdStudent = {
      id: newId,
      firstName,
      lastName,
      email,
      birthDate: birthDate || '',
      class: className || 'Non assigné',
      grades: []
    };

    res.status(201).json(createdStudent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { firstName, lastName, email, birthDate, class: className } = req.body;
  
  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    await db.run(
      `UPDATE students SET firstName = ?, lastName = ?, email = ?, birthDate = ?, class = ? WHERE id = ?`,
      [
        firstName || student.firstName,
        lastName || student.lastName,
        email || student.email,
        birthDate || student.birthDate,
        className || student.class,
        req.params.id
      ]
    );

    const updatedStudent = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    res.json(updatedStudent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    // SQLite cascade deletes will clean up grades if configured, otherwise delete manually
    await db.run(`DELETE FROM grades WHERE studentId = ?`, [req.params.id]);
    await db.run(`DELETE FROM students WHERE id = ?`, [req.params.id]);
    await db.run(`DELETE FROM users WHERE studentId = ?`, [req.params.id]);

    res.json({ message: 'Étudiant supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GRADES ENDPOINTS
app.post('/api/students/:id/grades', authenticate, checkRole(['admin', 'teacher']), async (req, res) => {
  const { subject, score, coefficient } = req.body;
  if (!subject || score === undefined || coefficient === undefined) {
    return res.status(400).json({ error: 'Matière, note et coefficient requis.' });
  }

  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    const gradeId = `g${Date.now()}`;
    await db.run(
      `INSERT INTO grades (id, studentId, subject, score, coefficient) VALUES (?, ?, ?, ?, ?)`,
      [gradeId, req.params.id, subject, Number(score), Number(coefficient)]
    );

    res.status(201).json({ id: gradeId, studentId: req.params.id, subject, score, coefficient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id/grades/:gradeId', authenticate, checkRole(['admin', 'teacher']), async (req, res) => {
  const { score, coefficient } = req.body;
  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    const grade = await db.get(`SELECT * FROM grades WHERE id = ? AND studentId = ?`, [req.params.gradeId, req.params.id]);
    if (!grade) {
      return res.status(404).json({ error: 'Note introuvable.' });
    }

    await db.run(
      `UPDATE grades SET score = ?, coefficient = ? WHERE id = ?`,
      [
        score !== undefined ? Number(score) : grade.score,
        coefficient !== undefined ? Number(coefficient) : grade.coefficient,
        req.params.gradeId
      ]
    );

    const updatedGrade = await db.get(`SELECT * FROM grades WHERE id = ?`, [req.params.gradeId]);
    res.json(updatedGrade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id/grades/:gradeId', authenticate, checkRole(['admin', 'teacher']), async (req, res) => {
  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    const result = await db.run(`DELETE FROM grades WHERE id = ? AND studentId = ?`, [req.params.gradeId, req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note introuvable.' });
    }

    res.json({ message: 'Note supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Student Transcript
app.get('/api/students/:id/transcript', authenticate, async (req, res) => {
  if (req.user.role === 'student' && req.user.studentId !== req.params.id) {
    return res.status(403).json({ error: 'Accès interdit.' });
  }

  try {
    const student = await db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant introuvable.' });
    }

    const grades = await db.all(`SELECT * FROM grades WHERE studentId = ?`, [req.params.id]);

    // Calculate Weighted Grades & GPA
    let totalWeightedScore = 0;
    let totalCoef = 0;
    
    const detailedGrades = grades.map(g => {
      const weightedScore = g.score * g.coefficient;
      totalWeightedScore += weightedScore;
      totalCoef += g.coefficient;
      return {
        ...g,
        weightedScore
      };
    });

    const gpa = totalCoef > 0 ? Number((totalWeightedScore / totalCoef).toFixed(2)) : 0;
    const decision = gpa >= 10 ? 'Admis' : 'Ajourné';

    res.json({
      student,
      grades: detailedGrades,
      gpa,
      totalCoefficient: totalCoef,
      status: decision,
      dateGenerated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
