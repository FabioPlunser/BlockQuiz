import { form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as v from 'valibot';

import { lucia } from '$lib/server/lucia/lucia';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const login = form(
  v.object({
    email: v.pipe(v.string(), v.nonEmpty(), v.email()),
    password: v.pipe(v.string(), v.nonEmpty(), v.minLength(5))
  }),
  async ({ email, password }) => {

  }
);