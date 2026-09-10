import { z } from 'zod';

export const classFilterSchema = z.object({
	search: z.string().optional(),
	ssoProviderId: z.string().optional(),
	// 'all' (default), 'sso' (IdP-owned only), 'manual' (no provider only)
	source: z.enum(['all', 'sso', 'manual']).optional(),
	includeArchived: z.boolean().optional()
});

// Form/command schema for create/edit. Either both ssoProviderId and externalKey
// are set (IdP-owned) or both are blank (manual). The remote handler enforces
// the pairing rule and the uniqueness of (provider, externalKey).
export const saveClassSchema = z.object({
	id: z.string().optional().default(''),
	name: z.string().min(1),
	description: z.string().optional().default(''),
	ssoProviderId: z.string().optional().default(''),
	externalKey: z.string().optional().default('')
});

export const deleteClassSchema = z.object({ id: z.string().min(1) });
export const archiveClassSchema = z.object({ id: z.string().min(1) });

export const classMembersSchema = z.object({
	classId: z.string().min(1),
	userIds: z.array(z.string().min(1)).min(1)
});

export const removeClassMembersSchema = z.object({
	classId: z.string().min(1),
	userIds: z.array(z.string().min(1)).min(1),
	// When true, also removes rows with source='sso'. Default false so admins
	// can't accidentally wipe IdP-managed memberships that will reappear next login.
	force: z.boolean().optional().default(false)
});

export const setCourseClassesSchema = z.object({
	courseId: z.string().min(1),
	classIds: z.array(z.string().min(1))
});

// Replace one user's MANUAL class memberships in one call. classIds may be
// empty to clear all manual rows. Source='sso' rows are never touched.
export const setUserClassesSchema = z.object({
	userId: z.string().min(1),
	classIds: z.array(z.string().min(1))
});

// Symmetric: replace one class's MANUAL member set.
export const setClassMembersSchema = z.object({
	classId: z.string().min(1),
	userIds: z.array(z.string().min(1))
});

export const promoteIdpGroupSchema = z.object({
	ssoProviderId: z.string().min(1),
	externalKey: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional().default('')
});
