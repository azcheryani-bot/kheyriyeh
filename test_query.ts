import { getTableColumns } from 'drizzle-orm';
import { donations } from './db/schema.js';
const { receiptImage, ...donationColumns } = getTableColumns(donations);
console.log(Object.keys(donationColumns));
