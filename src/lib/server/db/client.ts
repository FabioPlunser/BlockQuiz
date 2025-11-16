import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "bun:sqlite"; 
import * as schema from "./schema";

const sqlite = new Database(process.env.SQLITE_PATH ?? "app.db"); 
export const db = drizzle(sqlite, { schema });