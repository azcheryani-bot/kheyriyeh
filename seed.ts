import 'dotenv/config';
import { db } from './db/index.js';
import { admins } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  console.log('Seeding admin user...');
  const username = process.env.SUPERADMIN_USERNAME;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!username || !password) {
    console.error('SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD environment variables are required for seeding.');
    return;
  }

  try {
    const existing = await db.select().from(admins).where(eq(admins.username, username));
    if (existing.length > 0) {
      await db.update(admins)
        .set({ password: password, role: 'superadmin' })
        .where(eq(admins.username, username));
      console.log('Successfully updated existing admin password and role.');
    } else {
      await db.insert(admins).values({
        username: username,
        password: password,
        role: 'superadmin'
      });
      console.log('Successfully inserted new admin user.');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

seedAdmin();
