import { countries } from './import-data';

type ENV = {
  ImportWorker: {
    importCountryData: (country_code: string) => Promise<void>;
  };
};
export default {
  async scheduled(event: unknown, env: ENV, ctx: unknown) {
    console.log('env');
    for (const country of countries) {
      await env.ImportWorker.importCountryData(country.country_code);
    }
  },
};
