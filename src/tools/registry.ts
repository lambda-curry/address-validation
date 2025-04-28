import { ToolDefinition, ToolHandler, ToolRegistry } from './types';

/**
 * Default implementation of the tool registry
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool with the registry
   * @param name Tool name
   * @param description Tool description
   * @param inputSchema Tool input schema
   * @param handler Tool handler function
   */
  register(name: string, description: string, inputSchema: any, handler: ToolHandler): void {
    if (this.tools.has(name)) {
      console.warn(`Tool with name '${name}' already registered, overwriting`);
    }

    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler,
    });

    console.log(`Registered tool: ${name}`);
  }

  /**
   * List all registered tools
   * @returns Array of tool definitions
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a tool by name
   * @param name Tool name
   * @returns Tool definition or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
}
