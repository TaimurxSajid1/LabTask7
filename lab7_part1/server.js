// Lab Task 07 (Part 1) - Student Management System (In-Memory API)
// Name: Taimur Sajid | Roll No: 241839
//
// Modified from the instructor's in-memory API (node:http + reply helper).
// Modules: Student (CRUD), Teacher (CRUD), Attendance (CRUD), Marks (CRUD)
// All data lives in memory (JavaScript arrays), so it resets when the server restarts.

const http = require('node:http');

const PORT = 3002;

// ---------------- In-memory data store ----------------
const db = {
  students: [
    { id: 1, name: 'Taimur Sajid', rollNo: '241839', department: 'BSCS', semester: 3, email: 'taimur@example.com' },
    { id: 2, name: 'Ali Khan', rollNo: '241840', department: 'BSCS', semester: 3, email: 'ali@example.com' }
  ],
  teachers: [
    { id: 1, name: 'Sir Ahmed', subject: 'Web Technologies', email: 'ahmed@example.com', phone: '0300-1234567' }
  ],
  attendance: [
    { id: 1, studentId: 1, subject: 'Web Technologies', date: '2026-10-20', status: 'present' }
  ],
  marks: [
    { id: 1, studentId: 1, subject: 'Web Technologies', exam: 'Mid', obtained: 42, total: 50 }
  ]
};

// Next id counter for every module
const nextId = { students: 3, teachers: 2, attendance: 2, marks: 2 };

// ---------------- Validation rules for every module ----------------
// required: fields needed on create (POST) and full update (PUT)
const modules = {
  students: {
    required: ['name', 'rollNo', 'department', 'semester'],
    validate: (data, id) => {
      if (data.rollNo !== undefined &&
          db.students.some((s) => s.rollNo === String(data.rollNo) && s.id !== id)) {
        return 'A student with this rollNo already exists';
      }
      if (data.semester !== undefined && (!Number.isInteger(Number(data.semester)) || Number(data.semester) < 1)) {
        return 'semester must be a positive integer';
      }
      return null;
    }
  },
  teachers: {
    required: ['name', 'subject'],
    validate: () => null
  },
  attendance: {
    required: ['studentId', 'subject', 'date', 'status'],
    validate: (data) => {
      if (data.studentId !== undefined && !findById('students', data.studentId)) {
        return `Student with id ${data.studentId} does not exist`;
      }
      if (data.status !== undefined && !['present', 'absent', 'leave'].includes(data.status)) {
        return "status must be 'present', 'absent' or 'leave'";
      }
      if (data.date !== undefined && Number.isNaN(Date.parse(data.date))) {
        return 'date must be a valid date (YYYY-MM-DD)';
      }
      return null;
    }
  },
  marks: {
    required: ['studentId', 'subject', 'obtained', 'total'],
    validate: (data, id) => {
      if (data.studentId !== undefined && !findById('students', data.studentId)) {
        return `Student with id ${data.studentId} does not exist`;
      }
      // For PATCH we need to compare against the existing record values too
      const old = id ? findById('marks', id) || {} : {};
      const obtained = Number(data.obtained ?? old.obtained);
      const total = Number(data.total ?? old.total);
      if (Number.isNaN(obtained) || Number.isNaN(total) || obtained < 0 || total <= 0) {
        return 'obtained and total must be valid numbers (total > 0)';
      }
      if (obtained > total) return 'obtained marks cannot be greater than total marks';
      return null;
    }
  }
};

// ---------------- Helpers ----------------
function findById(collection, id) {
  return db[collection].find((item) => item.id === Number(id));
}

// Reads the request body and converts the JSON text into a JavaScript object
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Keep only the allowed fields (never let the client change the id)
function cleanFields(collection, body) {
  const { id, ...rest } = body;
  if (collection === 'students' && rest.rollNo !== undefined) rest.rollNo = String(rest.rollNo);
  if (rest.semester !== undefined) rest.semester = Number(rest.semester);
  if (rest.studentId !== undefined) rest.studentId = Number(rest.studentId);
  if (rest.obtained !== undefined) rest.obtained = Number(rest.obtained);
  if (rest.total !== undefined) rest.total = Number(rest.total);
  return rest;
}

function missingFields(collection, body) {
  return modules[collection].required.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ''
  );
}

// ---------------- Server ----------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const reply = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };

  // Health check route (same as instructor's code)
  if (req.method === 'GET' && url.pathname === '/health') {
    return reply(200, { status: 'ok' });
  }

  // Home route: list every available endpoint
  if (req.method === 'GET' && url.pathname === '/') {
    return reply(200, {
      project: 'Student Management System (In-Memory API)',
      student: 'Taimur Sajid - 241839',
      endpoints: Object.keys(modules).flatMap((m) => [
        `GET    /${m}`,
        `GET    /${m}/:id`,
        `POST   /${m}`,
        `PUT    /${m}/:id`,
        `PATCH  /${m}/:id`,
        `DELETE /${m}/:id`
      ]).concat([
        'GET    /students/:id/attendance',
        'GET    /students/:id/marks',
        'GET    /students/:id/report'
      ])
    });
  }

  // Split "/students/1" into ["students", "1"]
  const parts = url.pathname.split('/').filter(Boolean);
  const [collection, id, sub] = parts;

  if (!modules[collection] || parts.length > 3) {
    return reply(404, { error: 'Route not found' });
  }

  try {
    // ---------- Extra student routes: /students/:id/attendance | marks | report ----------
    if (sub) {
      if (collection !== 'students' || req.method !== 'GET') {
        return reply(404, { error: 'Route not found' });
      }
      const student = findById('students', id);
      if (!student) return reply(404, { error: `Student with id ${id} not found` });

      const attendance = db.attendance.filter((a) => a.studentId === student.id);
      const marks = db.marks.filter((m) => m.studentId === student.id);

      if (sub === 'attendance') return reply(200, attendance);
      if (sub === 'marks') return reply(200, marks);
      if (sub === 'report') {
        const present = attendance.filter((a) => a.status === 'present').length;
        const obtained = marks.reduce((sum, m) => sum + m.obtained, 0);
        const total = marks.reduce((sum, m) => sum + m.total, 0);
        return reply(200, {
          student,
          attendance: {
            totalClasses: attendance.length,
            present,
            percentage: attendance.length ? Number(((present / attendance.length) * 100).toFixed(2)) : 0
          },
          marks: {
            records: marks,
            obtained,
            total,
            percentage: total ? Number(((obtained / total) * 100).toFixed(2)) : 0
          }
        });
      }
      return reply(404, { error: 'Route not found' });
    }

    // ---------- READ ALL: GET /module (supports simple filters e.g. ?studentId=1) ----------
    if (req.method === 'GET' && !id) {
      let items = db[collection];
      for (const [key, value] of url.searchParams) {
        items = items.filter((item) => String(item[key]).toLowerCase() === value.toLowerCase());
      }
      return reply(200, items);
    }

    // ---------- READ ONE: GET /module/:id ----------
    if (req.method === 'GET' && id) {
      const item = findById(collection, id);
      if (!item) return reply(404, { error: `${collection} record with id ${id} not found` });
      return reply(200, item);
    }

    // ---------- CREATE: POST /module ----------
    if (req.method === 'POST' && !id) {
      const body = cleanFields(collection, await readBody(req));
      const missing = missingFields(collection, body);
      if (missing.length) return reply(400, { error: `Missing required fields: ${missing.join(', ')}` });

      const error = modules[collection].validate(body);
      if (error) return reply(400, { error });

      const item = { id: nextId[collection]++, ...body };
      db[collection].push(item);
      return reply(201, { message: `${collection} record created`, data: item });
    }

    // ---------- UPDATE: PUT (full replace) / PATCH (partial) /module/:id ----------
    if ((req.method === 'PUT' || req.method === 'PATCH') && id) {
      const item = findById(collection, id);
      if (!item) return reply(404, { error: `${collection} record with id ${id} not found` });

      const body = cleanFields(collection, await readBody(req));
      if (req.method === 'PUT') {
        const missing = missingFields(collection, body);
        if (missing.length) return reply(400, { error: `Missing required fields: ${missing.join(', ')}` });
      }

      const error = modules[collection].validate(body, item.id);
      if (error) return reply(400, { error });

      const index = db[collection].indexOf(item);
      db[collection][index] = req.method === 'PUT' ? { id: item.id, ...body } : { ...item, ...body };
      return reply(200, { message: `${collection} record updated`, data: db[collection][index] });
    }

    // ---------- DELETE: DELETE /module/:id ----------
    if (req.method === 'DELETE' && id) {
      const item = findById(collection, id);
      if (!item) return reply(404, { error: `${collection} record with id ${id} not found` });

      db[collection] = db[collection].filter((x) => x.id !== item.id);

      // Deleting a student also removes his attendance and marks records
      if (collection === 'students') {
        db.attendance = db.attendance.filter((a) => a.studentId !== item.id);
        db.marks = db.marks.filter((m) => m.studentId !== item.id);
      }
      return reply(200, { message: `${collection} record deleted`, data: item });
    }

    return reply(405, { error: `Method ${req.method} not allowed on ${url.pathname}` });
  } catch (error) {
    return reply(400, { error: error.message });
  }
});

server.listen(PORT, () => console.log(`Student Management System running at http://localhost:${PORT}`));
