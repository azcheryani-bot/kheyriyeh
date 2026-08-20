
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export function getConnectionString(): string {
  let url = process.env.DATABASE_URL || '';
  if (!url || !url.trim()) {
    return 'postgresql://dummy:dummy@ep-dummy-000000.us-east-1.aws.neon.tech/neondb';
  }
  // Remove '-pooler' suffix from hostname when using Neon HTTP fetch client
  if (url.includes('.neon.tech')) {
    url = url.replace(/-pooler(?=\.)/g, '');
  }
  // Remove unsupported parameters like channel_binding
  url = url.replace(/([?&])(channel_binding|sslmode|gssencmode)=[^&]*&?/g, '$1');
  url = url.replace(/[?&]$/, '');

  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    url = 'postgresql://' + url;
  }

  return url;
}

let _client: any = null;
let _clientUrl: string = '';

function getClient() {
  const currentUrl = getConnectionString();
  if (!_client || _clientUrl !== currentUrl) {
    _clientUrl = currentUrl;
    try {
      _client = neon(currentUrl);
    } catch (e) {
      console.error('Error initializing neon client:', e);
      _client = neon('postgresql://dummy:dummy@ep-dummy-000000.us-east-1.aws.neon.tech/neondb');
    }
  }
  return _client;
}

const sqlProxy = new Proxy(() => {}, {
  apply: (target, thisArg, argArray) => {
    return getClient()(...(argArray as any));
  },
  get: (target, prop) => {
    const client = getClient();
    const orig = client[prop];
    if (typeof orig === 'function') {
      return orig.bind(client);
    }
    return orig;
  }
});

export const db = drizzle(sqlProxy as any, { schema });

