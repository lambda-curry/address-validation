import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types';
import { importData } from './import-data';
import { Resource } from 'sst';
export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return new Response('Hello World!');
  },

  async importCountryData(country_code: string) {
    try {
      await importData(Resource.AddressValidationDB, country_code);
    } catch (error) {
      console.error('Error importing data', error);
      throw error;
    }
  },
};
