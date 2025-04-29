/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    console.log('🚀  inside app()');
    return {
      name: 'address-validation-api',
      home: 'cloudflare',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
    };
  },
  async run() {
    console.log('🏃 inside run()');
    const API_KEY = new sst.Secret('API_KEY');
    const database = new sst.cloudflare.D1('AddressValidationDB');

    const importWorker = new sst.cloudflare.Worker('ImportWorker', {
      url: false,
      link: [database],
      handler: 'src/import-worker.ts',
    });

    const binding = sst.cloudflare.binding({
      type: 'serviceBindings',
      properties: {
        service: importWorker.nodes.worker.name,
      },
    });

    const dailyImportCron = new sst.cloudflare.Cron('DailyImportCron', {
      schedules: ['0 0 * * *'],
      job: {
        link: [database, API_KEY, importWorker, binding],
        handler: 'src/daily-import.ts',
      },
    });

    const hono = new sst.cloudflare.Worker('Hono', {
      url: true,
      link: [database, API_KEY, importWorker, binding],
      handler: 'src/api.ts',
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
