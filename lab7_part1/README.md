# Lab Task 07 (Part 1): Student Management System (In-Memory API)
**Name:** Taimur Sajid | **Roll No:** 241839

This builds on the instructor's in-memory API (`node:http` + `reply()` helper). It needs Node.js 20+ and no npm packages.
All data is kept in JavaScript arrays, so it resets when the server restarts.

## Run
```
node server.js          # starts at http://localhost:3002
node test-client.js     # (second terminal) calls every endpoint
```

## Modules and Endpoints
| Module | Create | Read all | Read one | Update | Delete |
|---|---|---|---|---|---|
| Student | POST /students | GET /students | GET /students/:id | PUT / PATCH /students/:id | DELETE /students/:id |
| Teacher | POST /teachers | GET /teachers | GET /teachers/:id | PUT / PATCH /teachers/:id | DELETE /teachers/:id |
| Attendance | POST /attendance | GET /attendance | GET /attendance/:id | PUT / PATCH /attendance/:id | DELETE /attendance/:id |
| Marks | POST /marks | GET /marks | GET /marks/:id | PUT / PATCH /marks/:id | DELETE /marks/:id |

Extra: `GET /health`, `GET /` (endpoint list), `GET /students/:id/attendance`, `GET /students/:id/marks`,
`GET /students/:id/report` (attendance % and marks %). You can filter list routes with query strings, e.g. `GET /attendance?studentId=1`.

## Sample bodies
- Student: `{ "name": "Ali", "rollNo": "241840", "department": "BSCS", "semester": 3, "email": "ali@example.com" }`
- Teacher: `{ "name": "Sir Ahmed", "subject": "Web Technologies", "email": "...", "phone": "..." }`
- Attendance: `{ "studentId": 1, "subject": "Web Technologies", "date": "2026-10-25", "status": "present" }` (present/absent/leave)
- Marks: `{ "studentId": 1, "subject": "Web Technologies", "exam": "Mid", "obtained": 42, "total": 50 }`
