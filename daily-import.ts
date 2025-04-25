import { importData } from './import-data';
import { Resource } from 'sst';
export default {
  async scheduled(event: unknown, env: unknown, ctx: unknown) {
    await importData(Resource.AddressValidationDB);
  },
};
