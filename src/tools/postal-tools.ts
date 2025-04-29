import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition, ToolHandler } from './types';
import { Resource } from 'sst';
import type { Context } from 'hono';

/**
 * Get postal code information by code
 */
export const getPostalCodeInfoTool = (c: Context): ToolDefinition => {
  const inputSchema = z.object({
    postalCode: z.string().describe('The postal code to look up'),
  });

  const handler: ToolHandler = async (params) => {
    try {
      const { postalCode } = params;
      const db = Resource.AddressValidationDB;

      const result = await db
        .prepare(`
          SELECT * FROM postal_codes
          WHERE postal_code = ?
        `)
        .bind(postalCode)
        .first();

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: `Postal code '${postalCode}' not found`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'json',
            json: result,
          },
        ],
      };
    } catch (error) {
      console.error('Error in getPostalCodeInfo tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving postal code information: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };

  return {
    name: 'getPostalCodeInfo',
    description: 'Get information about a postal code',
    inputSchema: zodToJsonSchema(inputSchema),
    handler,
  };
};

/**
 * Get postal code information by code and country
 */
export const getPostalInfoTool = (c: Context): ToolDefinition => {
  const inputSchema = z.object({
    postalCode: z.string().describe('The postal code to look up'),
    countryCode: z.string().describe('The country code (e.g., US, CA)'),
  });

  const handler: ToolHandler = async (params) => {
    try {
      const { postalCode, countryCode } = params;
      const db = Resource.AddressValidationDB;

      if (!postalCode || !countryCode) {
        return {
          content: [
            {
              type: 'text',
              text: 'Both postal_code and country_code parameters are required',
            },
          ],
          isError: true,
        };
      }

      const result = await db
        .prepare(`
          SELECT * FROM postal_codes
          WHERE postal_code = ? AND country = ?
        `)
        .bind(postalCode.toUpperCase(), countryCode.toUpperCase())
        .first();

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: `Postal code '${postalCode}' not found for country '${countryCode}'`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'json',
            json: result,
          },
        ],
      };
    } catch (error) {
      console.error('Error in getPostalInfo tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving postal information: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };

  return {
    name: 'getPostalInfo',
    description: 'Get information about a postal code in a specific country',
    inputSchema: zodToJsonSchema(inputSchema),
    handler,
  };
};
