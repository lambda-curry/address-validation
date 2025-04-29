import { 
  ServerInfo, 
  ServerConfig, 
  Transport, 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListToolsResponse,
  CallToolResponse
} from './types';

/**
 * Custom MCP Server implementation
 */
export class Server {
  private info: ServerInfo;
  private config: ServerConfig;
  private requestHandlers: Map<string, (request: any) => Promise<any>> = new Map();
  private transport: Transport | null = null;

  constructor(info: ServerInfo, config: ServerConfig) {
    this.info = info;
    this.config = config;
    
    // Initialize with default handlers
    this.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
    this.setRequestHandler(CallToolRequestSchema, async () => {
      throw new Error('No tool handlers registered');
    });
  }

  /**
   * Set a request handler for a specific schema
   */
  public setRequestHandler(
    schema: Record<string, unknown>,
    handler: (request: any) => Promise<any>
  ): void {
    // For simplicity, we'll use the method name as the key
    const method = schema.properties?.method?.enum?.[0];
    if (typeof method !== 'string') {
      throw new Error('Invalid schema: missing method enum');
    }
    
    this.requestHandlers.set(method, handler);
  }

  /**
   * Connect to a transport
   */
  public async connect(transport: Transport): Promise<void> {
    this.transport = transport;
    await transport.connect(this);
  }

  /**
   * Handle an incoming message
   */
  public async handleMessage(message: any): Promise<any> {
    try {
      // Validate the message has a method
      if (!message.method || typeof message.method !== 'string') {
        throw new Error('Invalid message: missing method');
      }

      // Get the handler for this method
      const handler = this.requestHandlers.get(message.method);
      if (!handler) {
        throw new Error(`No handler registered for method: ${message.method}`);
      }

      // Call the handler
      const response = await handler(message);
      
      // Send the response through the transport if available
      if (this.transport) {
        await this.transport.sendResponse({
          id: message.id,
          result: response,
        });
      }
      
      return response;
    } catch (error) {
      // Send the error through the transport if available
      if (this.transport) {
        await this.transport.sendError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Get server info
   */
  public getInfo(): ServerInfo {
    return this.info;
  }

  /**
   * Get server config
   */
  public getConfig(): ServerConfig {
    return this.config;
  }
}

