import { Server } from './server';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from './types';
import { toolRegistry, registerAllTools } from '../tools'; // Assuming tools are in ../tools
import type { Context } from 'hono';

/**
 * MCP Server implementation
 */
class MCPService {
  private mcpServer_: Server;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.mcpServer_ = new Server(
      { name: 'Address Validation MCP Server', version: '1.0.0' },
      { capabilities: { tools: {} } }, // Define initial capabilities structure
    );
  }

  public async init(c: Context): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await registerAllTools(c); // Pass context to tool registration
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

  private syncTools(): void {
    const tools = toolRegistry.list();
    if (tools.length === 0) {
      console.warn('[MCP] No tools found in registry to synchronize');
      return;
    }

    const schemaMap: Record<string, object> = {};
    for (const tool of tools) {
      schemaMap[tool.name] = tool.inputSchema;
    }

    this.mcpServer_.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }));

    this.mcpServer_.setRequestHandler(
      CallToolRequestSchema,
      async (request: {
        params: {
          name: string;
          arguments?: unknown;
          _meta?: { progressToken?: string | number };
        };
      }) => {
        const { name, arguments: args } = request.params;
        const tool = tools.find((t) => t.name === name);
        if (!tool) throw new Error(`Tool '${name}' not found`);
        // Tool handlers might need context indirectly (e.g., via c.env)
        return tool.handler(args);
      },
    );

    console.log(`[MCP] Synchronized ${tools.length} tools with MCP server`);
  }

  public isReady(): boolean {
    return this.ready;
  }

  public async waitForReady(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  public getServerInstance(): Server {
    return this.mcpServer_;
  }

  public getToolRegistry() {
    return toolRegistry;
  }
}

// --- MCP Service Singleton ---
const mcpService = new MCPService();

export { mcpService }; // Export the singleton instance
