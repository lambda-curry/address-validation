# Address Validation MCP Server

This repository contains an MCP (Model Context Protocol) server for the Address Validation API, built with Hono.

## Features

- MCP server implementation for address validation
- Two tools for postal code validation:
  - `getPostalCodeInfo`: Get information about a postal code
  - `getPostalInfo`: Get information about a postal code in a specific country
- Server-Sent Events (SSE) for real-time communication
- Cursor integration for AI-assisted development

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your API key.

### Running the Server

Start the development server:

```bash
npm run dev
```

This will start the MCP server on port 4200 and launch the MCP Inspector.

## API Endpoints

- `GET /health`: Health check endpoint
- `GET /sse`: SSE endpoint for MCP communication
- `POST /messages`: Message handling endpoint

## MCP Tools

### getPostalCodeInfo

Get information about a postal code.

**Input Schema:**
```json
{
  "postalCode": "string"
}
```

**Example:**
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

### getPostalInfo

Get information about a postal code in a specific country.

**Input Schema:**
```json
{
  "postalCode": "string",
  "countryCode": "string"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "callTool",
  "params": {
    "name": "getPostalInfo",
    "arguments": {
      "postalCode": "10001",
      "countryCode": "US"
    }
  },
  "id": "1"
}
```

## Cursor Integration

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

## Documentation

For more detailed documentation, see [docs/hono-mcp-server.md](docs/hono-mcp-server.md).

## License

This project is licensed under the MIT License.
