import { ToolResponse, ToolResponseContent } from '../types/index.js';
import { ServeMyAPIError } from '../errors/index.js';

/**
 * Builder class for creating consistent MCP tool responses
 */
export class ResponseBuilder {
  private content: ToolResponseContent[] = [];
  private isError = false;

  /**
   * Add text content to the response
   */
  text(text: string): ResponseBuilder {
    this.content.push({ type: 'text' as const, text });
    return this;
  }

  /**
   * Mark the response as an error
   */
  error(): ResponseBuilder {
    this.isError = true;
    return this;
  }

  /**
   * Build the final response
   */
  build(): ToolResponse {
    return {
      content: this.content,
      ...(this.isError && { isError: true })
    };
  }

  /**
   * Create a success response with text
   */
  static success(text: string): ToolResponse {
    return new ResponseBuilder().text(text).build();
  }

  /**
   * Create an error response with text
   */
  static error(text: string): ToolResponse {
    return new ResponseBuilder().text(text).error().build();
  }

  /**
   * Create an error response from an Error object
   */
  static fromError(error: unknown): ToolResponse {
    if (error instanceof ServeMyAPIError) {
      return ResponseBuilder.error(error.message);
    }
    
    if (error instanceof Error) {
      return ResponseBuilder.error(`Error: ${error.message}`);
    }
    
    return ResponseBuilder.error('An unknown error occurred');
  }

  /**
   * Create a response for listing items
   */
  static list(title: string, items: string[]): ToolResponse {
    if (items.length === 0) {
      return ResponseBuilder.success(`No ${title.toLowerCase()} found`);
    }
    
    const text = `${title}:\n${items.map(item => `- ${item}`).join('\n')}`;
    return ResponseBuilder.success(text);
  }
}