import type { SSEStreamingApi } from 'hono/streaming';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';

const MAXIMUM_MESSAGE_SIZE = 4 * 1024 * 1024; // 4MB

/**
 * SSE transport implementation for MCP
 */
export class SSETransport implements Transport {
  private stream: SSEStreamingApi;
  private messagesEndpoint: string;
  private honoContext?: Context;
  private readonly _sessionId: string; // Store the session ID as a private member

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(messagesEndpoint: string, stream: SSEStreamingApi) {
    this.stream = stream;
    this.messagesEndpoint = messagesEndpoint;
    this._sessionId = uuidv4(); // Generate the session ID once during construction

    this.stream.onAbort(() => {
      this.onclose?.();
    });
  }

  /**
   * Get the session ID for this transport
   */
  get sessionId(): string {
    return this._sessionId; // Return the stored session ID
  }

  /**
   * Set the Hono context for this transport
   */
  setContext(c: Context) {
    this.honoContext = c;
  }

  /**
   * Get the Hono context for this transport
   */
  getContext(): Context | undefined {
    return this.honoContext;
  }

  /**
   * Send a message over SSE
   */
  async send(message: JSONRPCMessage): Promise<void> {
    try {
      await this.stream.writeSSE({
        data: JSON.stringify(message),
      });
    } catch (error) {
      console.error(
        `Error sending SSE message: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle a POST message from the client
   */
  async handlePostMessage(c: Context): Promise<Response> {
    try {
      // Store the context for use in tool handlers
      this.setContext(c);

      // Check content type and size
      const contentType = c.req.header('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Unsupported content-type: ${contentType}`);
      }

      const contentLength = Number.parseInt(
        c.req.header('content-length') || '0',
        10,
      );
      if (contentLength > MAXIMUM_MESSAGE_SIZE) {
        throw new Error(`Request body too large: ${contentLength} bytes`);
      }

      const body = await c.req.json();
      await this.handleMessage(body);
      return c.json({ status: 'ok' });
    } catch (error) {
      console.error(
        `Error handling POST message: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.onerror?.(error as Error);
      return c.text('Error processing message', 500);
    }
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(message: unknown): Promise<void> {
    try {
      const parsedMessage = JSONRPCMessageSchema.parse(message);
      this.onmessage?.(parsedMessage);
    } catch (error) {
      console.error(
        `Error parsing message: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.onerror?.(error as Error);
    }
  }

  /**
   * Send the endpoint URL to the client
   */
  async sendEndpoint(): Promise<void> {
    await this.stream.writeSSE({
      event: 'endpoint',
      data: `${this.messagesEndpoint}?sessionId=${this.sessionId}`,
    });
  }

  /**
   * Start the transport
   */
  async start(): Promise<void> {
    if (this.stream.closed) {
      throw new Error('SSE transport already closed!');
    }
    await this.sendEndpoint();
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (!this.stream.closed) {
      this.stream.close();
    }
  }
}
