import { drizzle } from 'drizzle-orm/node-postgres';
import { seedCategories } from './seeders/categories.seeder';

const db = drizzle(process.env.DATABASE_URL ?? "");

async function seed() {
  console.log('\x1b[1m\x1b[32mStart seeding...\x1b[0m');

  await seedCategories(db);

  console.log('\x1b[1m\x1b[32mSeed completed\x1b[0m');
}

seed().catch((error) => {
  console.error('\x1b[1m\x1b[31m[Seed]\x1b[0m Error seeding:', error);
  process.exit(1);
});