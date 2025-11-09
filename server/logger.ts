/**
 * Structured logging utility for better observability
 * Extends the existing log() function with structured metadata support
 */

import { log as baseLog } from './vite';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  operation?: string;
  [key: string]: any;
}

/**
 * Structured logger with context support
 */
export const logger = {
  /**
   * Log an error with structured context
   */
  error(message: string, context: LogContext = {}): void {
    const { operation, ...metadata } = context;
    const errorMessage = operation 
      ? `[${operation}] ${message}`
      : message;
    
    const logData = {
      level: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Log to console with structured format
    console.error(`[ERROR] ${errorMessage}`, metadata);
    
    // Also use base log for consistency
    baseLog(`ERROR: ${errorMessage}`, 'email-service');
  },

  /**
   * Log a warning with structured context
   */
  warn(message: string, context: LogContext = {}): void {
    const { operation, ...metadata } = context;
    const warnMessage = operation 
      ? `[${operation}] ${message}`
      : message;
    
    console.warn(`[WARN] ${warnMessage}`, metadata);
    baseLog(`WARN: ${warnMessage}`, 'email-service');
  },

  /**
   * Log informational message with context
   */
  info(message: string, context: LogContext = {}): void {
    const { operation, ...metadata } = context;
    const infoMessage = operation 
      ? `[${operation}] ${message}`
      : message;
    
    console.log(`[INFO] ${infoMessage}`, Object.keys(metadata).length > 0 ? metadata : '');
    baseLog(`INFO: ${infoMessage}`, 'email-service');
  },

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context: LogContext = {}): void {
    if (process.env.NODE_ENV === 'development') {
      const { operation, ...metadata } = context;
      const debugMessage = operation 
        ? `[${operation}] ${message}`
        : message;
      
      console.debug(`[DEBUG] ${debugMessage}`, metadata);
    }
  },
};

/**
 * Helper to create an error with context and cause
 */
export function createError(
  message: string,
  cause: unknown,
  context?: LogContext
): Error {
  const errorMessage = context?.operation
    ? `[${context.operation}] ${message}`
    : message;

  const error = new Error(errorMessage);
  
  // Use error cause if supported (Node.js 16.9+)
  if (cause instanceof Error) {
    if ('cause' in Error.prototype) {
      (error as any).cause = cause;
    } else {
      // Fallback for older Node versions
      error.stack = `${error.stack}\nCaused by: ${cause.stack}`;
    }
  }

  return error;
}

