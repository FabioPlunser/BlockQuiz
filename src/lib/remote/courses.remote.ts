
import { requireAuth } from '$lib/utils/requireAuth';
import { z} from 'zod';
import { Role } from '$lib/roles';
import { error } from '@sveltejs/kit';
import { query, form, command} from '$app/server';
import {exercises, courses} from '$server/db/schema';



const createCourseSchema = z.object({
	title: z.string(), 
	description: z.string(),
	published: z.boolean().optional(),
});


export const getCourses = query('unchecked', async () => {
	return await db.select().from(courses);
});

export const getCourse = query(z.object({ id: z.string()}), async (id) => {
	const course = await db.select().from(courses).where('id', id).first();
	if (!course) {
	 error(404, 'Course not found');
		}
	return course;	
});

export const getCourseExercises = query(z.object({ id: z.string()}), async (id) => {
		if (!course) {
		 error(404, 'Course not found');
			}


		return await db.select().from(exercises).where(eq('courseId', id)).execute();
})

