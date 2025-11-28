import * as v from 'valibot';

// For backward compatibility
export const loginSchema = v.object({
	email: v.pipe(v.string(), v.nonEmpty(), v.email()),
	password: v.pipe(v.string(), v.nonEmpty(), v.minLength(8))
});
