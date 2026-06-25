import Database from "better-sqlite3";

const db = new Database("./dev.db");
const now = Date.now();

// Clear (order matters for FKs).
for (const t of ["Comment", "ChecklistItem", "Attachment", "Task", "Column", "User"]) {
  db.prepare(`DELETE FROM ${t}`).run();
}

// Users
const users = [
  ["u_tanaka", "田中"],
  ["u_suzuki", "鈴木"],
  ["u_sato", "佐藤"],
  ["u_yamada", "山田"],
  ["u_kato", "加藤"],
  ["u_ito", "伊藤"],
];
const insUser = db.prepare("INSERT INTO User (id, name, createdAt) VALUES (?,?,?)");
users.forEach(([id, name], i) => insUser.run(id, name, now + i));

// Columns (customizable board lists)
const columns = [
  ["c_todo", "未着手", 0, 0],
  ["c_doing", "進行中", 1, 0],
  ["c_done", "完了", 2, 1],
];
const insCol = db.prepare(
  "INSERT INTO \"Column\" (id, name, \"order\", isDone, createdAt) VALUES (?,?,?,?,?)"
);
columns.forEach(([id, name, order, isDone]) => insCol.run(id, name, order, isDone, now));

// Tasks. columnId null => Inbox.
const tasks = [
  // id, title, dueAt, columnId, order, assignee, plannedFor
  ["t1", "請求書を送る", now + 86400000, "c_todo", 0, "u_tanaka", null],
  ["t2", "資料レビュー", null, "c_doing", 0, "u_tanaka", null],
  ["t3", "在庫チェック", now - 86400000, "c_todo", 1, "u_suzuki", null],
  ["t4", "ミーティング準備", now + 172800000, "c_todo", 0, "u_sato", null],
  ["t5", "メール返信", null, "c_done", 0, "u_yamada", null],
  ["t6", "見積もり作成", now + 43200000, "c_doing", 0, "u_kato", null],
  ["t7", "電球を買う", null, null, 0, "u_tanaka", null], // inbox
  ["t8", "本を返す", now + 259200000, null, 1, "u_tanaka", null], // inbox
];
const insTask = db.prepare(
  "INSERT INTO Task (id, title, dueAt, plannedFor, notified, columnId, \"order\", assigneeId, createdAt, updatedAt) VALUES (?,?,?,?,0,?,?,?,?,?)"
);
tasks.forEach(([id, title, dueAt, columnId, order, assigneeId, plannedFor]) =>
  insTask.run(id, title, dueAt, plannedFor, columnId, order, assigneeId, now, now)
);

console.log("users:", db.prepare("SELECT COUNT(*) c FROM User").get().c);
console.log("columns:", db.prepare('SELECT COUNT(*) c FROM "Column"').get().c);
console.log("tasks:", db.prepare("SELECT COUNT(*) c FROM Task").get().c);
db.close();
