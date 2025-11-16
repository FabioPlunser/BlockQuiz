import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, exercises, exerciseVersions, quizzes, attempts, auditLogs } from './schema';

// Select types (what you get from DB queries)
export type User = InferSelectModel<typeof users>;
export type Exercise = InferSelectModel<typeof exercises>;
export type ExerciseVersion = InferSelectModel<typeof exerciseVersions>;
export type Quiz = InferSelectModel<typeof quizzes>;
export type Attempt = InferSelectModel<typeof attempts>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

// Insert types (what you need to insert into DB)
export type NewUser = InferInsertModel<typeof users>;
export type NewExercise = InferInsertModel<typeof exercises>;
export type NewExerciseVersion = InferInsertModel<typeof exerciseVersions>;
export type NewQuiz = InferInsertModel<typeof quizzes>;
export type NewAttempt = InferInsertModel<typeof attempts>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// Parsed JSON field types
export type ExerciseMeta = {
  difficulty: number;
  tags: string[];
  ageBand: string;
  estimatedTime: number;
};

export type ExerciseContent = {
  title: { de: string; en: string };
  description: { de: string; en: string };
  hints: Array<{ de: string; en: string }>;
};

export type GraderConfig = {
  normalize: boolean;
  tests: Array<{
    id: string;
    input: string;
    expected: string;
    visible: boolean;
  }>;
};