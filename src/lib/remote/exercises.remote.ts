import { requireAuth } from '$lib/utils/requireAuth';
import { z} from 'zod';
import { Role } from '$lib/roles';
import { error } from '@sveltejs/kit';
import { query, form, command} from '$app/server';
import {exercises, courses} from '$server/db/schema';


const exerciseFilterSchema = z.object({ 
	courseId:  z.string().optional(), 
	type: z.enum(['io', 'turtle']).optional(),
	published: z.boolean().optional(),
});

const createExerciseSchema = z.object({
	courseId: z.string(), 
	type: z.enum(['io', 'turtle']),
	content: z.object({ 
		title: z.object({ 
			en: z.string(), 
			de: z.string(), 
		}),
		hints: z.array(z.object({ 
			en: z.string(), 
			de: z.string(), 
		})),
		example: z.object({
			description: z.object({ 
				en: z.string(), 
				de: z.string(), 
			}),
			starterXml: z.string(),
			explaination: z.object({ 
				en: z.string(), 
				de: z.string(), 
			})
			})
		}).optional(),
	config: z.object({
		toolBox: z.array(z.string()),
		starterXml: z.string(),
		grader: z.any(),
	}),
	published: z.boolean().optional(),
	order: z.number(),
});

const updateExerciseSchema = createExerciseSchema.partial().extend({
	id: z.string(),
});

export const getExercises = query(
	exerciseFilterSchema,
async (filters) => {
	return await db.select().where(...filters).from(exercises);
});

export const getExercise = query(
	z.object({ id: z.string()}),
async (id) => {


	const exercise = await db.select().from(exercises).where('id', id).first();
	if (!exercise) {
	 error(404, 'Exercise not found');
	}
	return exercise;
});



export const createExercise = form(createExerciseSchema, async (data) => {
	const user = requireAuth(Role.Admin);
	const course = await db.select().from(courses).where('id', data.courseId).first();
	if (!course) {
		error(404, 'Course not found');
	}
	const id = crypto.randomUUID(); 

	await db.insert(exercises).values({
		id,
		courseId: data.courseId,
		type: data.type,
		content: data.content,
		config: data.config,
		published: data.published,
		order: data.order,
		createdBy: user.id,
		updateAt: Date.now(), 
		createdAt: Date.now(),
	})
	


});

export const updateExercise = form(updateExerciseSchema, async (data) => {
	const exercise = await db.select().from(exercises).where('id', data.id).first();
	if (!exercise) {
		error(404, 'Exercise not found');
	}
});


export const deleteExercise = form(
	z.object({ id: z.string() }),
async (data) => {
	const exercise = await db.select().from(exercises).where('id', data.id).first();
	if (!exercise) {
		error(404, 'Exercise not found');
	}
	await db.delete().from(exercises).where('id', data.id).execute();
});

export const publishExercise = command(
	z.object({ id: z.string() }),
async (data) => {
	const exercise = await db.select().from(exercises).where('id', data.id).first();
	if (!exercise) {
		error(404, 'Exercise not found');
	}
	exercise.published = true;
	await db.update(exercises).set(exercise).where('id', data.id).execute();
});
