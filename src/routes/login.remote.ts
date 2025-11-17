import { form, query, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { db } from '../lib/server/db';
import { users } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { generateIdFromEntropySize } from 'lucia';

export const login = form(
  v.object({
    email: v.pipe(v.string(), v.nonEmpty()),
    password: v.pipe(v.string(), v.nonEmpty()),
    action: v.picklist(['login', 'register'])
  }),
  async (data, invalid) => {
    try {
      const { cookies } = getRequestEvent();
      console.log(data);
      let existingUser = await db.select().from(users).where(eq(users.email, data.email));

      if (existingUser) {
        invalid(invalid.email("User alread exists"));
      }

      if (data.action === 'login') {
        // Sign in 
      } else {
        // Register
      }
    } catch (e) {
      return fail(500, { message: e })
    }

    // try {
    //   const userId = generateIdFromEntropySize(10);
    //   const passwordHash = await Bun.password.hash(password);

    //   await db.insert(users).values({
    //     id: userId,
    //     email,
    //     passwordHash,
    //   });

    //   const session = await lucia.createSession(userId, {});
    //   const sessionCookie = lucia.createSessionCookie(session.id);
    //   cookies.set(sessionCookie.name, sessionCookie.value, {
    //     path: '.',
    //     ...sessionCookie.attributes,
    //   });
    // } catch (e) {
    //   return fail(500, { message: 'User already exists' });
    // }

    // redirect(302, '/');
  }
);
