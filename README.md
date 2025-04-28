# address-validation-api

To install dependencies:

```bash
bun install && npx sst dev
```
Notes:
You'll need to sst add a secret with your API_KEY to your stage: `sst secret set API_KEY apikeyvalue --stage=stagename`
You'll need to curl and post to the init endpoint to download the data files.


To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.10. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Reference

- [MCP Server Setup Guide](docs/hono-mcp-server.md)
