import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { SSETransport } from './sse';
import { toolRegistry, registerAllTools } from './tools';
import type { Context } from 'hono';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Server implementation
 */
export class MCPService {
  private mcpServer_: Server;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize the MCP server
    this.mcpServer_ = new Server(
      { name: 'Address Validation MCP Server', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
  }

  /**
   * Initialize the server by loading and registering all tools
   * @param c Hono context to inject into tools
   */
  public async init(c: Context): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Wait for all tools to be registered with context
        await registerAllTools(c);

        // Synchronize tools from registry with MCP server
        this.syncTools();

        this.ready = true;
        console.log('[MCP] Server initialization complete');
      } catch (error) {
        console.error(
          `[MCP] Failed to initialize server: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Synchronize the tools with the MCP server
   */
  private syncTools(): void {
    const tools = toolRegistry.list();
    if (tools.length === 0) {
      console.warn('[MCP] No tools found in registry to synchronize');
      return;
    }

    // Build a mapping of tool names to their JSON Schema for capabilities
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const schemaMap: Record<string, any> = {};
    // biome-ignore lint/complexity/noForEach: <explanation>
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    tools.forEach((tool: any) => {
      // Use the raw inputSchema (already JSON Schema) for registration
      const schemaObj = tool.inputSchema;
      schemaMap[tool.name] = schemaObj;
    });

    // Ensure clients get the full JSON Schema back
    this.mcpServer_.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }));

    // Wire the same registry up for tool execution
    this.mcpServer_.setRequestHandler(
      CallToolRequestSchema,
      async ({ params }) => {
        const tool = tools.find((t) => t.name === params.name);
        if (!tool) throw new Error(`Tool '${params.name}' not found`);
        return tool.handler(params.arguments);
      },
    );

    // Populate the MCP server's advertised capabilities with JSON Schema definitions
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    if ((this.mcpServer_ as any).capabilities) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (this.mcpServer_ as any).capabilities.tools = schemaMap;
    }
    console.log(`[MCP] Synchronized ${tools.length} tools with MCP server`);
  }

  /**
   * Check if the server is ready
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * Wait for the server to be ready
   */
  public async waitForReady(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Connect a transport to the MCP server
   */
  public async connect(transport: SSETransport): Promise<void> {
    await this.waitForReady();
    await this.mcpServer_.connect(transport);
  }

  /**
   * Get the tool registry
   */
  public getToolRegistry() {
    return toolRegistry;
  }
}

// Create and export a singleton instance
const mcpService = new MCPService();

export { mcpService };
