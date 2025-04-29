/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: 'address-validation-api',
      home: 'cloudflare',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      providers: {
        '@pulumi/cloudflare': '5.37.1',
      },
    };
  },
  async run() {
    const API_KEY = new sst.Secret('API_KEY');
    const database = new sst.cloudflare.D1('AddressValidationDB');

    const importWorker = new sst.cloudflare.Worker('ImportWorker', {
      url: false,
      link: [database],
      handler: 'src/import-worker.ts',
      transform: {
        worker: {
          compatibilityDate: '2025-04-28',
          compatibilityFlags: ['nodejs_compat_v2'],
        },
      },
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
        transform: {
          worker: {
            compatibilityDate: '2025-04-28',
            compatibilityFlags: ['nodejs_compat_v2'],
          },
        },
      },
    });

    const hono = new sst.cloudflare.Worker('Hono', {
      url: true,
      link: [database, API_KEY, importWorker, binding],
      handler: 'src/api.ts',
      transform: {
        worker: {
          compatibilityDate: '2025-04-28',
          compatibilityFlags: ['nodejs_compat_v2'],
        },
      },
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
