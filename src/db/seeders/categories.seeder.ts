import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { categories } from "../schema";

const categoriesData = [
  {
    name: 'Alimentation',
    color: '#e17100',
    icon: 'Utensils',
  },
  {
    name: 'Transport',
    color: '#5ea500',
    icon: 'Car',
  },
  {
    name: 'Logement',
    color: '#0084d1',
    icon: 'House',
  },
  {
    name: 'Loisirs',
    color: '#7f22fe',
    icon: 'Volleyball',
  },
  {
    name: 'Vêtements',
    color: '#ff2056',
    icon: 'Shirt',
  },
  {
    name: 'Santé',
    color: '#45556c',
    icon: 'Heart',
  },
  {
    name: 'Autres',
    color: '#7c86ff',
    icon: 'QuestionMark',
    isDefault: true, // Default category for uncategorized transactions
  },
  {
    name: 'Factures',
    color: '#0092b8',
    icon: 'FileText',
  },
  {
    name: 'Éducation',
    color: '#35530e',
    icon: 'GraduationCap',
  },
  {
    name: 'Voyages',
    color: '#74d4ff',
    icon: 'Plane',
  },
  {
    name: 'Salaires',
    color: '#fb2c36',
    icon: 'Euro',
  }
];

export async function seedCategories(db: NodePgDatabase) : Promise<void> {
  console.log('\x1b[1m\x1b[32m[Categories]\x1b[0m Start seeding categories...\x1b[0m');
  for (const category of categoriesData) {
    await db.insert(categories).values(category);
  }
  console.log('\x1b[1m\x1b[32m[Categories]\x1b[0m Seed completed\x1b[0m');
  return Promise.resolve();
}
