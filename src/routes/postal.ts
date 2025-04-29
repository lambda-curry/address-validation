import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '../api'; // Import shared Bindings
import { Resource } from 'sst/resource';
const postalRoutes = new Hono<{ Bindings: Bindings }>();

// Handler for /postal-code/:code
postalRoutes.get('/:code', async (c: Context<{ Bindings: Bindings }>) => {
  const postalCode = c.req.param('code');
  const db = Resource.AddressValidationDB;

  try {
    const result = await db
      .prepare('SELECT * FROM postal_codes WHERE postal_code = ?')
      .bind(postalCode.toUpperCase())
      .first();

    if (!result) {
      return c.json({ error: 'Postal code not found' }, 404);
    }
    return c.json(result);
  } catch (dbError) {
    console.error('Database query error:', dbError);
    return c.json({ error: 'Database query failed' }, 500);
  }
});

// Handler for /postal-info (relative to base path, e.g., /postal-code/)
postalRoutes.get('/', async (c: Context<{ Bindings: Bindings }>) => {
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

  try {
    const result = await db
      .prepare(
        'SELECT * FROM postal_codes WHERE postal_code = ? AND country = ?',
      )
      .bind(postalCode.toUpperCase(), countryCode.toUpperCase())
      .first();

    if (!result) {
      return c.json(
        { error: 'Postal code not found for the specified country' },
        404,
      );
    }
    return c.json(result);
  } catch (dbError) {
    console.error('Database query error:', dbError);
    return c.json({ error: 'Database query failed' }, 500);
  }
});

export default postalRoutes;
