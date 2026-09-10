// Pure helpers for admin class operations. Kept free of $app/server, $env, and
// $lib/utils/requireAuth so each branch can be exercised against an in-memory
// drizzle SQLite database without wrapping the SvelteKit form/command boundary.

import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { classes, classUsers, courseClasses } from '$db/schema';

type Db = BunSQLiteDatabase<Record<string, unknown>>;

type SaveClassInput = {
	id?: string;
	name: string;
	description?: string | null;
	ssoProviderId?: string | null;
	externalKey?: string | null;
};

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

/** Validate the (provider, key) pairing and shape — pure, no I/O. */
export function validateClassInput(input: SaveClassInput): Result<{
	name: string;
	description: string | null;
	ssoProviderId: string | null;
	externalKey: string | null;
}> {
	const name = input.name?.trim();
	if (!name) return { ok: false, error: 'Class name is required.' };
	const description = input.description?.trim() || null;
	const ssoProviderId = input.ssoProviderId?.trim() || null;
	const externalKey = input.externalKey?.trim() || null;
	if ((ssoProviderId && !externalKey) || (!ssoProviderId && externalKey)) {
		return {
			ok: false,
			error: 'IdP provider and external key must be set together (or both blank for a manual class).'
		};
	}
	return { ok: true, value: { name, description, ssoProviderId, externalKey } };
}

/**
 * Check that (ssoProviderId, externalKey) is unique among non-archived classes,
 * excluding the row being edited. Returns the conflicting class id if any.
 */
export async function findProviderKeyConflict(
	db: Db,
	ssoProviderId: string,
	externalKey: string,
	excludeClassId?: string
): Promise<string | null> {
	const rows = await db
		.select({ id: classes.id })
		.from(classes)
		.where(
			and(
				eq(classes.ssoProviderId, ssoProviderId),
				eq(classes.externalKey, externalKey),
				isNull(classes.archivedAt)
			)
		);
	const conflict = rows.find((r) => r.id !== excludeClassId);
	return conflict ? conflict.id : null;
}

/**
 * Idempotently add manual members to a class. Skips users that already have a
 * source='manual' row. Returns the number of rows actually inserted.
 */
export async function addManualClassMembers(
	db: Db,
	classId: string,
	userIds: string[],
	actorId: string,
	now: number
): Promise<{ added: number }> {
	if (userIds.length === 0) return { added: 0 };

	const existing = await db
		.select({ userId: classUsers.userId })
		.from(classUsers)
		.where(
			and(
				eq(classUsers.classId, classId),
				eq(classUsers.source, 'manual'),
				inArray(classUsers.userId, userIds)
			)
		);
	const existingIds = new Set(existing.map((r) => r.userId));
	const toInsert = userIds.filter((id) => !existingIds.has(id));
	if (toInsert.length === 0) return { added: 0 };

	await db.insert(classUsers).values(
		toInsert.map((userId) => ({
			id: crypto.randomUUID(),
			classId,
			userId,
			source: 'manual' as const,
			addedBy: actorId,
			createdAt: now,
			updatedAt: now
		}))
	);
	return { added: toInsert.length };
}

/**
 * Replace the set of classes linked to a course. Wipes existing course_classes
 * rows for the course and re-inserts the new set. Called from createCourse,
 * updateCourse and (without the wipe) cloneCourse.
 */
export async function replaceCourseClasses(
	db: Db,
	courseId: string,
	classIds: string[],
	actorId: string,
	now: number
): Promise<{ inserted: number }> {
	console.log('replaceCourseClasses', { courseId, classIds, actorId, now });
	await db.delete(courseClasses).where(eq(courseClasses.courseId, courseId));
	if (classIds.length === 0) return { inserted: 0 };
	await db.insert(courseClasses).values(
		classIds.map((classId) => ({
			id: crypto.randomUUID(),
			courseId,
			classId,
			addedBy: actorId,
			createdAt: now,
			updatedAt: now
		}))
	);
	return { inserted: classIds.length };
}

/**
 * Replace the user's set of MANUAL class memberships in one diff. Insert
 * targets that aren't already present (with source='manual'), delete manual
 * rows that aren't in the target. Never touches source='sso' rows — those
 * remain the IdP-sync's responsibility.
 *
 * IdP-owned classes (ssoProviderId IS NOT NULL) cannot receive manual
 * memberships: any target IDs pointing to them are silently filtered out, and
 * the returned `rejected` array lists them so callers can surface a warning.
 */
export async function replaceUserManualClasses(
	db: Db,
	userId: string,
	classIds: string[],
	actorId: string,
	now: number
): Promise<{ added: number; removed: number; rejected: string[] }> {
	// Strip out IdP-owned class IDs from the target — manual rows on those
	// classes wouldn't survive the next IdP sync anyway, and exposing the
	// option would mislead admins.
	let filteredTarget = classIds;
	let rejected: string[] = [];
	if (classIds.length > 0) {
		const targetClasses = await db
			.select({ id: classes.id, ssoProviderId: classes.ssoProviderId })
			.from(classes)
			.where(inArray(classes.id, classIds));
		const idpOwned = new Set(
			targetClasses.filter((c) => c.ssoProviderId != null).map((c) => c.id)
		);
		if (idpOwned.size > 0) {
			rejected = classIds.filter((id) => idpOwned.has(id));
			filteredTarget = classIds.filter((id) => !idpOwned.has(id));
		}
	}

	const current = await db
		.select({ id: classUsers.id, classId: classUsers.classId })
		.from(classUsers)
		.where(and(eq(classUsers.userId, userId), eq(classUsers.source, 'manual')));

	const target = new Set(filteredTarget);
	const currentByClass = new Map(current.map((r) => [r.classId, r.id]));

	const toAdd = [...target].filter((id) => !currentByClass.has(id));
	const toRemoveRowIds = current.filter((r) => !target.has(r.classId)).map((r) => r.id);

	if (toAdd.length > 0) {
		await db.insert(classUsers).values(
			toAdd.map((classId) => ({
				id: crypto.randomUUID(),
				classId,
				userId,
				source: 'manual' as const,
				addedBy: actorId,
				createdAt: now,
				updatedAt: now
			}))
		);
	}
	if (toRemoveRowIds.length > 0) {
		await db.delete(classUsers).where(inArray(classUsers.id, toRemoveRowIds));
	}
	return { added: toAdd.length, removed: toRemoveRowIds.length, rejected };
}

/**
 * Symmetric to replaceUserManualClasses but scoped to one class — replaces the
 * class's set of MANUAL members. Source='sso' rows remain untouched.
 *
 * Refuses to operate at all on IdP-owned classes (returns 0/0 with
 * `rejected=true`).
 */
export async function replaceManualClassMembers(
	db: Db,
	classId: string,
	userIds: string[],
	actorId: string,
	now: number
): Promise<{ added: number; removed: number; rejected: boolean }> {
	const [classRow] = await db
		.select({ ssoProviderId: classes.ssoProviderId })
		.from(classes)
		.where(eq(classes.id, classId))
		.limit(1);
	if (!classRow) return { added: 0, removed: 0, rejected: false };
	if (classRow.ssoProviderId != null) {
		// Class is IdP-owned: no manual membership editing.
		return { added: 0, removed: 0, rejected: true };
	}

	const current = await db
		.select({ id: classUsers.id, userId: classUsers.userId })
		.from(classUsers)
		.where(and(eq(classUsers.classId, classId), eq(classUsers.source, 'manual')));

	const target = new Set(userIds);
	const currentByUser = new Map(current.map((r) => [r.userId, r.id]));

	const toAdd = [...target].filter((id) => !currentByUser.has(id));
	const toRemoveRowIds = current.filter((r) => !target.has(r.userId)).map((r) => r.id);

	if (toAdd.length > 0) {
		await db.insert(classUsers).values(
			toAdd.map((userId) => ({
				id: crypto.randomUUID(),
				classId,
				userId,
				source: 'manual' as const,
				addedBy: actorId,
				createdAt: now,
				updatedAt: now
			}))
		);
	}
	if (toRemoveRowIds.length > 0) {
		await db.delete(classUsers).where(inArray(classUsers.id, toRemoveRowIds));
	}
	return { added: toAdd.length, removed: toRemoveRowIds.length, rejected: false };
}

/**
 * Remove memberships from a class. By default only `source='manual'` rows are
 * deleted; pass `force=true` to also delete `source='sso'` rows (which will
 * reappear on the user's next IdP login).
 */
export async function removeClassMembersImpl(
	db: Db,
	classId: string,
	userIds: string[],
	force: boolean
): Promise<{ removed: number }> {
	if (userIds.length === 0) return { removed: 0 };

	const conds = [eq(classUsers.classId, classId), inArray(classUsers.userId, userIds)];
	if (!force) conds.push(eq(classUsers.source, 'manual'));

	const targets = await db
		.select({ id: classUsers.id })
		.from(classUsers)
		.where(and(...conds));
	if (targets.length === 0) return { removed: 0 };

	await db.delete(classUsers).where(
		inArray(
			classUsers.id,
			targets.map((t) => t.id)
		)
	);
	return { removed: targets.length };
}
