import { db } from '$db/client';
import { user, verification } from '$server/db/schema';
import { eq } from 'drizzle-orm';

export async function getUser(email: string) {
	const _user = await db.select().from(user).where(eq(user.email, email));

	if (!_user || _user.length === 0) {
		throw new Error('User not found');
	}

	return _user[0];
}

export async function getResetToken(email: string) {
	// Find user with Drizzle
	const _user = await db.select().from(user).where(eq(user.email, email));

	if (!_user || _user.length === 0) {
		throw new Error('User not found');
	}

	// Get reset token from verification table
	const resetToken = await db
		.select()
		.from(verification)
		.where(eq(verification.value, _user[0].id));

	const id = resetToken[0]?.identifier;
	if (!id) {
		throw new Error('Reset token not found');
	}
	return id.replace('reset-password:', '');
}
