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
bun install && npx sst dev
```
Notes:
You'll need to sst add a secret with your API_KEY to your stage: `sst secret set API_KEY apikeyvalue --stage=stagename`
You'll need to curl and post to the init endpoint to download the data files.


3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

This project was created using `bun init` in bun v1.2.10. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Reference

- [MCP Server Setup Guide](docs/hono-mcp-server.md)
