import { db } from './db/index.js';
import { admins } from './db/schema.js';
async function run() {
  const res = await db.select().from(admins);
  console.log(res);
  process.exit(0);
}
run();
