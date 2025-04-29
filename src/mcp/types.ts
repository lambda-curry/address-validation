/**
 * MCP Server types
 */

// Request schemas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ListToolsRequestSchema: MethodSchema = {
  method: 'tools/list',
  params: { type: 'object', properties: {} }, // No params expected
  response: {
    type: 'object',
    properties: {
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            inputSchema: { type: 'object' }, // Ideally, define the schema structure more precisely
          },
          required: ['name', 'description', 'inputSchema'],
        },
      },
    },
    required: ['tools'],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CallToolRequestSchema: MethodSchema = {
  method: 'tool/call', // Or could be dynamic based on tool name?
  params: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      arguments: { type: 'object', additionalProperties: true }, // Allow any properties for arguments
      _meta: {
        type: 'object',
        properties: {
          progressToken: { type: ['string', 'number'] },
        },
        additionalProperties: false,
        required: [],
        optional: true, // Make _meta optional
      },
    },
    required: ['name'],
  },
  // Response schema is highly dependent on the tool being called
  response: { type: 'object', additionalProperties: true }, // Allow any properties in response
};

// Server types
export interface ServerInfo {
  name: string;
  version: string;
}

export interface ServerCapabilities {
  tools: Record<string, unknown>;
}

export interface ServerConfig {
  capabilities: ServerCapabilities;
}

// Tool types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

// Basic JSON-RPC 2.0 Structures

export interface JSONRPCRequest<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
  id?: string | number | null;
}

export interface JSONRPCResponse<TResult = unknown> {
  jsonrpc: '2.0';
  result: TResult;
  id: string | number | null;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCErrorResponse {
  jsonrpc: '2.0';
  error: JSONRPCError;
  id: string | number | null;
}

// Minimal interface for the Server object passed to Transport.connect
// Add methods/properties as needed for the transport to interact with the server
export interface ServerInterface {
  getInfo: () => {
    name: string;
    version: string;
    capabilities: Record<string, unknown>;
  };
  // Potentially add: receiveRequest(request: JSONRPCRequest): Promise<void>;
}

// Basic MCP Transport Interface
// This is what the Server class will interact with.
export interface Transport {
  /**
   * Called by the Server when it wants to connect to this transport.
   * The transport should store the server internally if needed.
   */
  connect: (server: ServerInterface) => Promise<void>;

  /**
   * Called by the Server to send a successful response back to the client.
   */
  sendResponse: (response: JSONRPCResponse) => Promise<void>;

  /**
   * Called by the Server to send an error response back to the client.
   */
  sendError: (errorResponse: JSONRPCErrorResponse) => Promise<void>;

  // Add other methods if needed (e.g., close, disconnect)
}

// Response types
export interface ListToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface CallToolResponse {
  result: unknown;
}

// Define a generic type for our simple schema definitions
interface MethodSchema {
  method: string;
  params: Record<string, unknown>;
  response: Record<string, unknown>;
}
