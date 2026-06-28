import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("User", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  lineUserId: text("lineUserId"),
  lineLinkCode: text("lineLinkCode"),
  googleAccessToken: text("googleAccessToken"),
  googleRefreshToken: text("googleRefreshToken"),
  googleTokenExpiry: timestamp("googleTokenExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teams = pgTable("Team", {
  id: text("id").primaryKey(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teamMemberships = pgTable(
  "TeamMembership",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
  },
  (t) => [
    uniqueIndex("TeamMembership_userId_teamId_key").on(t.userId, t.teamId),
    index("TeamMembership_userId_idx").on(t.userId),
  ],
);

export const columns = pgTable(
  "Column",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    order: integer("order").default(0).notNull(),
    isDone: boolean("isDone").default(false).notNull(),
    teamId: text("teamId").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("Column_teamId_idx").on(t.teamId)],
);

export const tasks = pgTable(
  "Task",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("dueAt"),
    plannedFor: timestamp("plannedFor"),
    notified: boolean("notified").default(false).notNull(),
    googleEventId: text("googleEventId"),
    columnId: text("columnId").references(() => columns.id, { onDelete: "set null" }),
    order: integer("order").default(0).notNull(),
    assigneeId: text("assigneeId").references(() => users.id),
    repeatType: text("repeatType"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [
    index("Task_dueAt_idx").on(t.dueAt),
    index("Task_assigneeId_idx").on(t.assigneeId),
    index("Task_columnId_idx").on(t.columnId),
  ],
);

export const comments = pgTable(
  "Comment",
  {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("authorId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("Comment_taskId_idx").on(t.taskId)],
);

export const checklistItems = pgTable(
  "ChecklistItem",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    done: boolean("done").default(false).notNull(),
    order: integer("order").default(0).notNull(),
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [index("ChecklistItem_taskId_idx").on(t.taskId)],
);

export const attachments = pgTable(
  "Attachment",
  {
    id: text("id").primaryKey(),
    kind: text("kind").default("link").notNull(),
    url: text("url").notNull(),
    label: text("label"),
    taskId: text("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [index("Attachment_taskId_idx").on(t.taskId)],
);
