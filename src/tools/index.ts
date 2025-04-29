import { DefaultToolRegistry } from './registry';
import { getPostalCodeInfoTool, getPostalInfoTool } from './postal-tools';
import type { Context } from 'hono';

// Create a tool registry instance
const toolRegistry = new DefaultToolRegistry();

/**
 * Register all tools with the registry
 * @param c Hono context to inject into tools
 */
async function registerAllTools(c: Context): Promise<void> {
  try {
    // Register postal code tools
    toolRegistry.register(
      getPostalCodeInfoTool(c).name,
      getPostalCodeInfoTool(c).description,
      getPostalCodeInfoTool(c).inputSchema,
      getPostalCodeInfoTool(c).handler
    );

    toolRegistry.register(
      getPostalInfoTool(c).name,
      getPostalInfoTool(c).description,
      getPostalInfoTool(c).inputSchema,
      getPostalInfoTool(c).handler
    );

    console.log(`[MCP] Total registered tools: ${toolRegistry.list().length}`);
  } catch (error) {
    console.error(`[MCP] Error registering tools: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Re-throw to ensure initialization failure is propagated
  }
}

// Export the tool registry and registration function
export { toolRegistry, registerAllTools };

// Export types
export * from './types';
