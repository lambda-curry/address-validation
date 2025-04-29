import { z } from 'zod';

/**
 * Tool response content item
 */
export type ToolResponseContentItem = {
  type: 'text' | 'image' | 'json';
  text?: string;
  image_url?: string;
  json?: any;
};

/**
 * Tool response
 */
export type ToolResponse = {
  content: ToolResponseContentItem[];
  isError?: boolean;
};

/**
 * Tool handler function
 */
export type ToolHandler = (params: any) => Promise<ToolResponse>;

/**
 * Tool definition
 */
export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: any;
  handler: ToolHandler;
};

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  register(name: string, description: string, inputSchema: any, handler: ToolHandler): void;
  list(): ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
}
