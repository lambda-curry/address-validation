import { Hono } from 'hono';
import { Resource } from 'sst';
import { importData } from './import-data';

const app = new Hono();

// API key validation middleware
app.use('*', async (c, next) => {
  const apiKey = c.req.header('x-api-key') || c.req.query('api_key');

  if (!apiKey || apiKey !== Resource.API_KEY.value) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }

  await next();
});

app.get('/', (c) => c.text('Hello World'));

app.post('/init', async (c) => {
  const db = Resource.AddressValidationDB;
  try {
    await importData(db);
    return c.json({ message: 'Data import completed' });
  } catch (error: unknown) {
    return c.json(
      {
        error: 'Failed to import data',
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

app.get('/postal-code/:code', async (c) => {
  const postalCode = c.req.param('code');
  const db = Resource.AddressValidationDB;

  const result = await db
    .prepare(`
    SELECT * FROM postal_codes 
    WHERE postal_code = ?
  `)
    .bind(postalCode)
    .first();

  if (!result) {
    return c.json({ error: 'Postal code not found' }, 404);
  }

  return c.json(result);
});

app.get('/postal-info', async (c) => {
  const postalCode = c.req.query('postal_code');
  const countryCode = c.req.query('country_code');
  const db = Resource.AddressValidationDB;

  if (!postalCode || !countryCode) {
    return c.json(
      {
        error:
          'Both postal_code and country_code query parameters are required',
      },
      400,
    );
  }

  const result = await db
    .prepare(`
    SELECT * FROM postal_codes 
    WHERE postal_code = ? AND country = ?
  `)
    .bind(postalCode.toUpperCase(), countryCode.toUpperCase())
    .first();

  if (!result) {
    return c.json(
      { error: 'Postal code not found for the specified country' },
      404,
    );
  }

  return c.json(result);
});

export default app;
