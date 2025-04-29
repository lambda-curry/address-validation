import { Server } from './server';
import {
  // Import schemas as values
  ListToolsRequestSchema,
  CallToolRequestSchema,
  // Import types using 'type'
  type Transport,
  type JSONRPCRequest,
} from './types';
import { toolRegistry, registerAllTools } from '../tools'; // Assuming tools are in ../tools
import type { Context } from 'hono';

// Remove manual session management - transport/routing handles this
// interface ActiveSession { ... }
// const activeSessions = new Map<string, ActiveSession>();

/**
 * MCP Service: Initializes and holds the MCP Server configuration.
 */
class MCPService {
  private ready = false;
  private initPromise: Promise<void> | null = null;
  // Singleton instance of the server with tool definitions
  private mcpServerInstance: Server | null = null;

  // Constructor is not needed if it does nothing
  // constructor() {}

  // Initialize the service (register tools, create server instance)
  public async init(c: Context): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Initialize shared resources like tool registry
        const tools = await registerAllTools(c); // Pass context to tool registration

        // Create and configure the shared server instance
        this.mcpServerInstance = new Server({
          name: 'Address Validation MCP Server',
          version: '1.0.0',
          capabilities: { tools },
        });
        this.syncTools(this.mcpServerInstance); // Sync tools to the instance

        this.ready = true;
        console.log('[MCP] Service initialization complete');
      } catch (error) {
        console.error(
          `[MCP] Failed to initialize service: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Sync tools to the provided server instance
  private syncTools(serverInstance: Server): void {
    const tools = toolRegistry.list();
    if (tools.length === 0) {
      console.warn('[MCP] No tools found in registry to synchronize');
      return;
    }

    // Register handlers on the specific server instance
    serverInstance.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }));

    serverInstance.setRequestHandler(
      CallToolRequestSchema,
      async (params: unknown, request: JSONRPCRequest) => {
        // Extract tool name and args from the full request's params
        const toolParams = request.params as {
          name: string;
          arguments?: unknown;
        };
        if (!toolParams || typeof toolParams.name !== 'string') {
          throw new Error(
            "Invalid CallTool request parameters: missing or invalid 'name'",
          );
        }
        const { name, arguments: args } = toolParams;
        const tool = tools.find((t) => t.name === name);
        if (!tool) throw new Error(`Tool '${name}' not found`);
        // Tool handlers might need context indirectly (e.g., via c.env)
        return tool.handler(args); // Pass only args to the tool's specific handler
      },
    );

    console.log(
      `[MCP] Synchronized ${tools.length} tools with MCP server instance`,
    );
  }

  public isReady(): boolean {
    return this.ready;
  }

  public async waitForReady(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) {
      await this.initPromise;
    } else {
      throw new Error('MCP Service not initialized. Call init() first.');
    }
  }

  // --- Get the configured server instance ---
  public getServerInstance(): Server {
    if (!this.mcpServerInstance) {
      throw new Error(
        'MCP Server instance not initialized. Call init() first.',
      );
    }
    return this.mcpServerInstance;
  }
  // --- End Get Server Instance ---

  public getToolRegistry() {
    return toolRegistry;
  }
}

// --- MCP Service Singleton ---
const mcpService = new MCPService();

export { mcpService }; // Export the singleton instance
