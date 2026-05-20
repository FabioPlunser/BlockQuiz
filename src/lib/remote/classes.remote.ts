import { query, form, command, requested } from '$app/server';
import { db } from '$db/client';
import {
	classes,
	classUsers,
	courseClasses,
	courses,
	idpGroupSeen,
	ssoProvider,
	user
} from '$db/schema';
import { and, eq, inArray, isNull, isNotNull, like, sql } from 'drizzle-orm';
import { invalid } from '@sveltejs/kit';
import { requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';
import { writeAuditLog } from '$lib/server/audit';
import {
	addManualClassMembers,
	findProviderKeyConflict,
	removeClassMembersImpl,
	replaceManualClassMembers,
	replaceUserManualClasses,
	validateClassInput
} from '$lib/server/class-admin';
import {
	classFilterSchema,
	saveClassSchema,
	deleteClassSchema,
	archiveClassSchema,
	classMembersSchema,
	removeClassMembersSchema,
	promoteIdpGroupSchema,
	setUserClassesSchema,
	setClassMembersSchema
} from '$remote/schemas/classesSchema';

const nowMs = () => Date.now();

export const getClasses = query(classFilterSchema, async (filters) => {
	requireAuth(Role.ADMIN);

	const conditions = [] as ReturnType<typeof and>[];
	if (filters.search) conditions.push(like(classes.name, `%${filters.search}%`));
	if (filters.ssoProviderId) conditions.push(eq(classes.ssoProviderId, filters.ssoProviderId));
	if (filters.source === 'sso') conditions.push(isNotNull(classes.ssoProviderId));
	if (filters.source === 'manual') conditions.push(isNull(classes.ssoProviderId));
	if (!filters.includeArchived) conditions.push(isNull(classes.archivedAt));

	const rows = await db
		.select({
			id: classes.id,
			name: classes.name,
			description: classes.description,
			ssoProviderId: classes.ssoProviderId,
			externalKey: classes.externalKey,
			archivedAt: classes.archivedAt,
			createdAt: classes.createdAt,
			updatedAt: classes.updatedAt,
			providerDomain: ssoProvider.domain,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${classUsers} WHERE ${classUsers.classId} = ${classes.id}
			)`.as('member_count'),
			courseCount: sql<number>`(
				SELECT COUNT(*) FROM ${courseClasses} WHERE ${courseClasses.classId} = ${classes.id}
			)`.as('course_count')
		})
		.from(classes)
		.leftJoin(ssoProvider, eq(ssoProvider.id, classes.ssoProviderId))
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	if (rows.length === 0) return [] as Array<(typeof rows)[number] & { memberIds: string[]; ssoMemberIds: string[] }>;

	// Side-query for memberships, grouped in JS — drives the inline Members
	// dropdown without N+1.
	const classIds = rows.map((r) => r.id);
	const memberships = await db
		.select({
			classId: classUsers.classId,
			userId: classUsers.userId,
			source: classUsers.source
		})
		.from(classUsers)
		.where(inArray(classUsers.classId, classIds));

	const byClass = new Map<string, { memberIds: string[]; ssoMemberIds: string[] }>();
	for (const m of memberships) {
		let bucket = byClass.get(m.classId);
		if (!bucket) {
			bucket = { memberIds: [], ssoMemberIds: [] };
			byClass.set(m.classId, bucket);
		}
		if (!bucket.memberIds.includes(m.userId)) bucket.memberIds.push(m.userId);
		if (m.source === 'sso' && !bucket.ssoMemberIds.includes(m.userId)) {
			bucket.ssoMemberIds.push(m.userId);
		}
	}

	return rows.map((r) => ({
		...r,
		memberIds: byClass.get(r.id)?.memberIds ?? [],
		ssoMemberIds: byClass.get(r.id)?.ssoMemberIds ?? []
	}));
});

export const getClass = query(deleteClassSchema, async ({ id }) => {
	requireTeacherOrAdmin();

	const [row] = await db
		.select({
			id: classes.id,
			name: classes.name,
			description: classes.description,
			ssoProviderId: classes.ssoProviderId,
			externalKey: classes.externalKey,
			archivedAt: classes.archivedAt,
			createdAt: classes.createdAt,
			updatedAt: classes.updatedAt,
			providerDomain: ssoProvider.domain
		})
		.from(classes)
		.leftJoin(ssoProvider, eq(ssoProvider.id, classes.ssoProviderId))
		.where(eq(classes.id, id))
		.limit(1);

	if (!row) return null;

	const members = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			active: user.active,
			source: classUsers.source,
			membershipId: classUsers.id,
			addedAt: classUsers.createdAt
		})
		.from(classUsers)
		.innerJoin(user, eq(user.id, classUsers.userId))
		.where(eq(classUsers.classId, id));

	const linkedCourses = await db
		.select({
			courseId: courses.id,
			content: courses.content,
			published: courses.published,
			archivedAt: courses.archivedAt,
			attachedAt: courseClasses.createdAt
		})
		.from(courseClasses)
		.innerJoin(courses, eq(courses.id, courseClasses.courseId))
		.where(eq(courseClasses.classId, id));

	return { ...row, members, courses: linkedCourses };
});

// Lightweight list for the CourseEditor "Klassen" picker.
export const getAssignableClasses = query(async () => {
	requireTeacherOrAdmin();
	const rows = await db
		.select({
			id: classes.id,
			name: classes.name,
			ssoProviderId: classes.ssoProviderId,
			providerDomain: ssoProvider.domain,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${classUsers} WHERE ${classUsers.classId} = ${classes.id}
			)`.as('member_count')
		})
		.from(classes)
		.leftJoin(ssoProvider, eq(ssoProvider.id, classes.ssoProviderId))
		.where(isNull(classes.archivedAt));
	return rows;
});

export const saveClass = form(saveClassSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);

	const validation = validateClassInput(data);
	if (!validation.ok) {
		const message = validation.error;
		invalid(message);
		return { success: false as const, error: message };
	}
	const { name, description, ssoProviderId, externalKey } = validation.value;

	if (ssoProviderId && externalKey) {
		const conflictId = await findProviderKeyConflict(
			db,
			ssoProviderId,
			externalKey,
			data.id || undefined
		);
		if (conflictId) {
			return {
				success: false as const,
				error: 'A class with this provider + external key already exists.'
			};
		}
	}

	try {
		const now = nowMs();

		if (data.id) {
			await db
				.update(classes)
				.set({ name, description, ssoProviderId, externalKey, updatedAt: now })
				.where(eq(classes.id, data.id));
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'class.update',
				category: 'admin',
				details: { classId: data.id, name, ssoProviderId, externalKey }
			});
			await requested(getClasses, 10).refreshAll();
			return { success: true as const, id: data.id };
		}

		const id = crypto.randomUUID();
		await db.insert(classes).values({
			id,
			name,
			description,
			ssoProviderId,
			externalKey,
			archivedAt: null,
			createdAt: now,
			updatedAt: now,
			createdBy: actor.id
		});
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'class.create',
			category: 'admin',
			details: { classId: id, name, ssoProviderId, externalKey }
		});
		await requested(getClasses, 10).refreshAll();
		return { success: true as const, id };
	} catch (e) {
		console.error('saveClass failed', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save class'
		};
	}
});

export const deleteClass = command(deleteClassSchema, async ({ id }) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		const [target] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
		if (!target) return { success: false as const, error: 'Class not found' };
		await db.delete(classes).where(eq(classes.id, id));
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'class.delete',
			category: 'admin',
			details: { classId: id, name: target.name }
		});
		await requested(getClasses, 10).refreshAll();
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to delete class'
		};
	}
});

export const archiveClass = command(archiveClassSchema, async ({ id }) => {
	const actor = requireAuth(Role.ADMIN);
	const now = nowMs();
	await db.update(classes).set({ archivedAt: now, updatedAt: now }).where(eq(classes.id, id));
	await writeAuditLog({
		actorUserId: actor.id,
		action: 'class.archive',
		category: 'admin',
		details: { classId: id }
	});
	await requested(getClasses, 10).refreshAll();
	return { success: true as const };
});

export const restoreClass = command(archiveClassSchema, async ({ id }) => {
	const actor = requireAuth(Role.ADMIN);
	const now = nowMs();
	await db.update(classes).set({ archivedAt: null, updatedAt: now }).where(eq(classes.id, id));
	await writeAuditLog({
		actorUserId: actor.id,
		action: 'class.restore',
		category: 'admin',
		details: { classId: id }
	});
	await requested(getClasses, 10).refreshAll();
	return { success: true as const };
});

export const addClassMembers = command(classMembersSchema, async ({ classId, userIds }) => {
	const actor = requireAuth(Role.ADMIN);
	const { added } = await addManualClassMembers(db, classId, userIds, actor.id, nowMs());
	if (added > 0) {
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'class.member.add',
			category: 'admin',
			details: { classId, addedCount: added, requestedUserIds: userIds }
		});
	}
	await requested(getClasses, 10).refreshAll();
	await requested(getClass, 10).refreshAll();
	return { success: true as const, added };
});

export const removeClassMembers = command(
	removeClassMembersSchema,
	async ({ classId, userIds, force }) => {
		const actor = requireAuth(Role.ADMIN);
		const { removed } = await removeClassMembersImpl(db, classId, userIds, Boolean(force));
		if (removed > 0) {
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'class.member.remove',
				category: 'admin',
				details: { classId, userIds, force: Boolean(force), removed }
			});
		}
		await requested(getClasses, 10).refreshAll();
		await requested(getClass, 10).refreshAll();
		return { success: true as const, removed };
	}
);

// Atomic replace-the-set for one user. Used by the per-row multi-select
// dropdown in /users.
export const setUserClasses = command(setUserClassesSchema, async ({ userId, classIds }) => {
	const actor = requireAuth(Role.ADMIN);
	const result = await replaceUserManualClasses(db, userId, classIds, actor.id, nowMs());
	if (result.added > 0 || result.removed > 0) {
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'class.user.set',
			category: 'admin',
			details: { userId, classIds, ...result }
		});
	}
	await requested(getClasses, 10).refreshAll();
	return { success: true as const, ...result };
});

// Atomic replace-the-set for one class. Used by the multi-select dropdown in
// the class detail modal. Refuses when the class is IdP-owned.
export const setClassMembers = command(setClassMembersSchema, async ({ classId, userIds }) => {
	const actor = requireAuth(Role.ADMIN);
	const result = await replaceManualClassMembers(db, classId, userIds, actor.id, nowMs());
	if (result.rejected) {
		return {
			success: false as const,
			error: 'Cannot edit memberships of an IdP-managed class. Reconciliation runs on login.'
		};
	}
	if (result.added > 0 || result.removed > 0) {
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'class.member.set',
			category: 'admin',
			details: { classId, userIds, added: result.added, removed: result.removed }
		});
	}
	await requested(getClasses, 10).refreshAll();
	await requested(getClass, 10).refreshAll();
	return { success: true as const, added: result.added, removed: result.removed };
});

export const promoteIdpGroup = command(promoteIdpGroupSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);

	// Reject if an active class already owns this (provider, externalKey).
	const conflictId = await findProviderKeyConflict(db, data.ssoProviderId, data.externalKey);
	if (conflictId) {
		return { success: false as const, error: 'A class for this IdP group already exists.' };
	}

	const id = crypto.randomUUID();
	const now = nowMs();
	await db.insert(classes).values({
		id,
		name: data.name.trim(),
		description: data.description?.trim() || null,
		ssoProviderId: data.ssoProviderId,
		externalKey: data.externalKey,
		archivedAt: null,
		createdAt: now,
		updatedAt: now,
		createdBy: actor.id
	});
	await writeAuditLog({
		actorUserId: actor.id,
		action: 'class.create',
		category: 'admin',
		details: { classId: id, name: data.name, source: 'promoted', externalKey: data.externalKey }
	});
	await requested(getClasses, 10).refreshAll();
	await requested(getIdpGroupSuggestions, 1).refreshAll();
	return { success: true as const, id };
});

// PR7 will surface this in the admin UI. Exposed in PR3 so the schema is locked
// and PR4's `recordSeenGroups` writes can be inspected.
export const getIdpGroupSuggestions = query(async () => {
	requireAuth(Role.ADMIN);
	const rows = await db
		.select({
			id: idpGroupSeen.id,
			ssoProviderId: idpGroupSeen.ssoProviderId,
			externalKey: idpGroupSeen.externalKey,
			firstSeenAt: idpGroupSeen.firstSeenAt,
			lastSeenAt: idpGroupSeen.lastSeenAt,
			occurrenceCount: idpGroupSeen.occurrenceCount,
			sampleUserIds: idpGroupSeen.sampleUserIds,
			providerDomain: ssoProvider.domain,
			matchedClassId: classes.id
		})
		.from(idpGroupSeen)
		.innerJoin(ssoProvider, eq(ssoProvider.id, idpGroupSeen.ssoProviderId))
		.leftJoin(
			classes,
			and(
				eq(classes.ssoProviderId, idpGroupSeen.ssoProviderId),
				eq(classes.externalKey, idpGroupSeen.externalKey),
				isNull(classes.archivedAt)
			)
		);
	return rows;
});
