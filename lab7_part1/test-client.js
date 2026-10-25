// Lab Task 07 (Part 1) - Test client for the Student Management System
// Name: Taimur Sajid | Roll No: 241839
// First run server.js in another terminal (npm start), then run this file (npm test).
// Node.js 20+ provides global fetch().

const BASE = 'http://localhost:3002';

async function call(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  console.log(`\n${method} ${path} -> ${response.status}`);
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  // ---------- Student CRUD ----------
  const student = await call('POST', '/students', { name: 'Sara Ahmed', rollNo: '241850', department: 'BSCS', semester: 3, email: 'sara@example.com' });
  const sid = student.data.id;
  await call('GET', '/students');
  await call('GET', `/students/${sid}`);
  await call('PUT', `/students/${sid}`, { name: 'Sara Ahmed', rollNo: '241850', department: 'BSSE', semester: 4, email: 'sara@example.com' });
  await call('PATCH', `/students/${sid}`, { semester: 5 });

  // ---------- Teacher CRUD ----------
  const teacher = await call('POST', '/teachers', { name: 'Miss Ayesha', subject: 'Database Systems', email: 'ayesha@example.com' });
  await call('GET', '/teachers');
  await call('PATCH', `/teachers/${teacher.data.id}`, { phone: '0311-7654321' });
  await call('DELETE', `/teachers/${teacher.data.id}`);

  // ---------- Attendance CRUD ----------
  const att = await call('POST', '/attendance', { studentId: sid, subject: 'Web Technologies', date: '2026-10-25', status: 'present' });
  await call('GET', `/attendance?studentId=${sid}`);
  await call('PUT', `/attendance/${att.data.id}`, { studentId: sid, subject: 'Web Technologies', date: '2026-10-25', status: 'absent' });

  // ---------- Marks CRUD ----------
  const mark = await call('POST', '/marks', { studentId: sid, subject: 'Web Technologies', exam: 'Quiz 1', obtained: 8, total: 10 });
  await call('PATCH', `/marks/${mark.data.id}`, { obtained: 9 });
  await call('GET', `/students/${sid}/report`);

  // ---------- Validation / error examples ----------
  await call('POST', '/marks', { studentId: sid, subject: 'OOP', obtained: 60, total: 50 });
  await call('POST', '/attendance', { studentId: 999, subject: 'OOP', date: '2026-10-25', status: 'present' });
  await call('GET', '/students/999');

  // ---------- Delete student (also removes his attendance + marks) ----------
  await call('DELETE', `/marks/${mark.data.id}`);
  await call('DELETE', `/attendance/${att.data.id}`);
  await call('DELETE', `/students/${sid}`);
  await call('GET', '/students');
}

main().catch((error) => { console.error('Start server.js first:', error.message); process.exitCode = 1; });
