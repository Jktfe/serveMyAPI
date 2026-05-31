import { ToolHandler, ToolResponse } from '../types/index.js';
import { ResponseBuilder } from '../utils/response-builder.js';
import { logger } from '../utils/logger.js';
import { isOperationalError } from '../errors/index.js';

/**
 * Wraps a tool handler with consistent error handling and logging
 */
export function createToolHandler<T = unknown>(
  name: string,
  handler: ToolHandler<T>
): ToolHandler<T> {
  return async (params: T): Promise<ToolResponse> => {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing tool: ${name}`, { params });
      
      const result = await handler(params);
      
      const duration = Date.now() - startTime;
      logger.info(`Tool ${name} completed`, { duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log operational errors as warnings, system errors as errors
      if (isOperationalError(error)) {
        logger.warn(`Tool ${name} failed with operational error`, { 
          error: error instanceof Error ? error.message : String(error),
          duration 
        });
      } else {
        logger.error(`Tool ${name} failed with system error`, error, { duration });
      }
      
      return ResponseBuilder.fromError(error);
    }
  };
}

/**
 * Creates a tool handler that validates parameters before execution
 */
export function createValidatedToolHandler<T = unknown>(
  name: string,
  validator: (params: unknown) => T,
  handler: ToolHandler<T>
): ToolHandler<unknown> {
  return createToolHandler(name, async (rawParams: unknown) => {
    // Validate parameters
    const validatedParams = validator(rawParams);
    
    // Execute handler with validated parameters
    return handler(validatedParams);
  });
}