import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { attempts, auditLogs, exerciseVersions, exercises, user } from './schema';

export type UserRow = InferSelectModel<typeof user>;
export type ExerciseRow = InferSelectModel<typeof exercises>;
export type ExerciseVersionRow = InferSelectModel<typeof exerciseVersions>;
export type AttemptRow = InferSelectModel<typeof attempts>;
export type AuditLogRow = InferSelectModel<typeof auditLogs>;

export type User = UserRow;
// Returned by getUsers — adds the user's class memberships for the admin
// table's classes column. `ssoClassIds` is the subset where source='sso' (used
// to grey-out IdP-managed entries in the dropdown).
export type UserWithClasses = UserRow & { classIds: string[]; ssoClassIds: string[] };
export type Exercise = ExerciseRow;
export type ExerciseVersion = ExerciseVersionRow;
export type Attempt = AttemptRow;
export type AuditLog = AuditLogRow;

export type NewUserRow = InferInsertModel<typeof user>;
export type NewExerciseRow = InferInsertModel<typeof exercises>;
export type NewExerciseVersionRow = InferInsertModel<typeof exerciseVersions>;
export type NewAttemptRow = InferInsertModel<typeof attempts>;
export type NewAuditLogRow = InferInsertModel<typeof auditLogs>;

export type NewUser = NewUserRow;
export type NewExercise = NewExerciseRow;
export type NewExerciseVersion = NewExerciseVersionRow;
export type NewAttempt = NewAttemptRow;
export type NewAuditLog = NewAuditLogRow;
