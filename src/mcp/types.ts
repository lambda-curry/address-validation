/**
 * MCP Server types
 */

// Request schemas
export const ListToolsRequestSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: ['listTools'] },
    params: { type: 'object' },
  },
  required: ['method'],
};

export const CallToolRequestSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: ['callTool'] },
    params: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        arguments: {},
        _meta: {
          type: 'object',
          properties: {
            progressToken: { type: ['string', 'number'] },
          },
        },
      },
      required: ['name'],
    },
  },
  required: ['method', 'params'],
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
  handler: (args: any) => Promise<any>;
}

// Transport types
export interface Transport {
  connect: (server: any) => Promise<void>;
  sendResponse: (response: any) => Promise<void>;
  sendError: (error: Error) => Promise<void>;
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
  result: any;
}

