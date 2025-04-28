# Hono MCP Server for Address Validation API

This document outlines how to create a simple MCP (Model Context Protocol) server using Hono for the Address Validation API.

## What is MCP?

The Model Context Protocol (MCP) is a standardized way for AI models to interact with external tools and services. It allows AI models to access real-time data and perform actions in the world through a consistent interface.

MCP servers expose tools as JSON-RPC endpoints that AI models can call to perform specific tasks.

## Project Structure

The Address Validation MCP server is structured as follows:

```
src/
  ├── index.ts           # Main entry point
  ├── mcp.ts             # MCP service implementation
  ├── routes.ts          # API routes
  ├── sse.ts             # Server-Sent Events transport
  └── tools/
      ├── index.ts       # Tool registry
      ├── registry.ts    # Tool registration
      ├── types.ts       # Tool type definitions
      └── postal-tools.ts # Postal code validation tools
```

## Setting Up the MCP Server

### 1. Install Dependencies

```bash
npm install @modelcontextprotocol/sdk @modelcontextprotocol/inspector hono @hono/node-server zod uuid
```

### 2. Configure the Server

Create a `.env` file with your API key:

```
API_KEY=your_api_key_here
```

### 3. Implement the MCP Server

The MCP server consists of several components:

- **Main Entry Point**: Sets up the Hono application and server
- **MCP Service**: Manages tool registration and connections
- **SSE Transport**: Handles Server-Sent Events for real-time communication
- **Tool Registry**: Manages available tools
- **Routes**: Defines API endpoints

## Implementing Address Validation Tools

The Address Validation API provides two main endpoints:

1. `GET /postal-code/:code` - Get postal code information by code
2. `GET /postal-info?postal_code=X&country_code=Y` - Get postal code information by code and country

We'll implement MCP tools that wrap these endpoints:

### Tool Implementation

Tools are defined with:
- Name
- Description
- Input schema (using Zod or JSON Schema)
- Handler function

Example:

```typescript
// Tool definition
{
  name: "getPostalCodeInfo",
  description: "Get information about a postal code",
  inputSchema: z.object({
    postalCode: z.string().describe("The postal code to look up")
  }),
  handler: async (params) => {
    // Implementation
  }
}
```

## Running the MCP Server

To run the server:

```bash
npm run dev
```

The server will be available at http://localhost:4200 with the following endpoints:

- `/sse` - SSE endpoint for MCP communication
- `/health` - Health check endpoint
- `/messages` - Message handling endpoint

## Testing with the MCP Inspector

You can test your MCP server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector proxy http://localhost:4200/sse
```

This will open a web interface where you can test your tools.

## Example Usage

Here's how an AI model would use the postal code validation tools:

```json
{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "getPostalCodeInfo",
    "arguments": {
      "postalCode": "10001"
    }
  },
  "id": "1"
}
```

## Cursor Configuration

To use the MCP server with Cursor, add the following to your `.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "address-validation-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:4200/sse"]
    }
  }
}
```
