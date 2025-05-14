import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { categories } from "../schema";

const categoriesData = [
  {
    name: 'Alimentation',
    color: '#c1bcd1',
    icon: 'Utensils',
  },
  {
    name: 'Transport',
    color: '#d8a16a',
    icon: 'Car',
  },
  {
    name: 'Logement',
    color: '#1a4fef',
    icon: 'House',
  },
  {
    name: 'Loisirs',
    color: '#4ff262',
    icon: 'Volleyball',
  },
  {
    name: 'Vêtements',
    color: '#450b51',
    icon: 'Shirt',
  },
  {
    name: 'Santé',
    color: '#999577',
    icon: 'Heart',
  },
];

export async function seedCategories(db: NodePgDatabase) : Promise<void> {
  console.log('\x1b[1m\x1b[32m[Categories]\x1b[0m Start seeding categories...\x1b[0m');
  for (const category of categoriesData) {
    await db.insert(categories).values(category);
  }
  console.log('\x1b[1m\x1b[32m[Categories]\x1b[0m Seed completed\x1b[0m');
  return Promise.resolve();
}
