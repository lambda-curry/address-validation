import { Transport } from './types';

interface StreamableHTTPOptions {
  sessionIdGenerator: () => string;
}

/**
 * StreamableHTTP transport for MCP
 * This implements the streamable HTTP transport protocol for MCP
 */
export class StreamableHTTPServerTransport implements Transport {
  private server: any;
  private options: StreamableHTTPOptions;
  private sessionId: string;
  private controller: ReadableStreamDefaultController | null = null;
  private encoder = new TextEncoder();

  constructor(options: StreamableHTTPOptions) {
    this.options = options;
    this.sessionId = options.sessionIdGenerator();
  }

  /**
   * Connect to an MCP server
   */
  public async connect(server: any): Promise<void> {
    this.server = server;
    
    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
        
        // Send initial connection event
        const initialEvent = {
          event: 'connection',
          data: JSON.stringify({
            sessionId: this.sessionId,
            serverInfo: this.server.getInfo(),
          }),
        };
        
        this.sendEvent(initialEvent);
      },
      cancel: () => {
        this.controller = null;
      },
    });
    
    // Return a Response with the stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }) as any;
  }

  /**
   * Send a response to the client
   */
  public async sendResponse(response: any): Promise<void> {
    if (!this.controller) {
      throw new Error('Transport not connected');
    }
    
    this.sendEvent({
      event: 'message',
      data: JSON.stringify(response),
    });
  }

  /**
   * Send an error to the client
   */
  public async sendError(error: Error): Promise<void> {
    if (!this.controller) {
      throw new Error('Transport not connected');
    }
    
    this.sendEvent({
      event: 'error',
      data: JSON.stringify({
        message: error.message,
        stack: error.stack,
      }),
    });
  }

  /**
   * Send an SSE event
   */
  private sendEvent(event: { event: string; data: string }): void {
    if (!this.controller) {
      return;
    }
    
    const formattedEvent = `event: ${event.event}\ndata: ${event.data}\n\n`;
    this.controller.enqueue(this.encoder.encode(formattedEvent));
  }
}

