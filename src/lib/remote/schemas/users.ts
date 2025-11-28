import * as v from 'valibot';
import { Role, ROLES } from '$lib/roles';

export const userFilterSchema = v.object({
	search: v.optional(v.string()),
	id: v.optional(v.string()),
	active: v.optional(v.boolean()),
	email: v.optional(v.pipe(v.string())),
	role: v.optional(v.picklist(ROLES))
});

export const createUpdateUserSchema = v.object({
	id: v.optional(v.string()),
	email: v.optional(v.pipe(v.string(), v.email())),
	active: v.optional(v.boolean()),
	password: v.optional(v.pipe(v.string(), v.minLength(8))),
	role: v.optional(v.picklist(ROLES))
});
