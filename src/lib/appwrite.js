import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)


export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID, Query };

// Database IDs
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const DAILY_TASKS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_DAILY_TASKS_COLLECTION_ID;
export const HABITS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_HABITS_COLLECTION_ID;
export const HABIT_LOGS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_HABIT_LOGS_COLLECTION_ID;
export const FUTURE_TASKS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_FUTURE_TASKS_COLLECTION_ID;

// Storage IDs
export const STORAGE_BUCKET_ID = import.meta.env.VITE_APPWRITE_STORAGE_BUCKET_ID;
