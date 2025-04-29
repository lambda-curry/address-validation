import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '../api'; // Import shared Bindings
import { countries } from '../import-data'; // Import countries data

const adminRoutes = new Hono<{ Bindings: Bindings }>();

// Middleware: Ensure this route is only accessible via POST (or add auth)
// adminRoutes.use('/', ...) // Example placeholder for auth middleware

// Handler for /init
adminRoutes.post('/', async (c: Context<{ Bindings: Bindings }>) => {
  // Access the ImportWorker binding via c.env
  for (const country of countries) {
    try {
      // Note: Worker invocations are async. Await ensures sequential triggering.
      await c.env.ImportWorker.importCountryData(country.country_code);
      console.log(`Triggered import for ${country.country_code}`);
    } catch (error) {
      console.error(
        `Error triggering import for ${country.country_code}:`,
        error,
      );
      // Decide if one failure should stop the loop or just be logged
      // Optionally return a partial success/failure message
    }
  }
  return c.json({
    message: 'Data import process initiated for all countries.',
  });
});

export default adminRoutes;
