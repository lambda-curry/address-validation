/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'address-validation-api',
      home: 'cloudflare',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
    };
  },
  async run() {
    const API_KEY = new sst.Secret('API_KEY');

    const database = new sst.cloudflare.D1('AddressValidationDB');

    const dailyImport = new sst.cloudflare.Cron('DailyImport', {
      schedules: ['0 0 * * *'],
      job: {
        link: [database, API_KEY],
        handler: 'daily-import.ts',
      },
    });

    const hono = new sst.cloudflare.Worker('Hono', {
      url: true,
      link: [database, API_KEY],
      handler: 'index.ts',
      domain:
        $app.stage === 'production'
          ? 'address-validation.lambdacurry.dev'
          : undefined,
    });

    return {
      api: hono.url,
    };
  },
});
