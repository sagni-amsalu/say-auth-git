// src/utils/error-tracking.ts - CREATE THIS
export interface ErrorTracker {
  captureException(error: Error, context?: Record<string, any>): void;
  captureMessage(message: string, context?: Record<string, any>): void;
}

class SentryTracker implements ErrorTracker {
  captureException(error: Error, context?: Record<string, any>): void {
    // Integrate with Sentry
    console.error('Sentry:', error, context);
  }
  
  captureMessage(message: string, context?: Record<string, any>): void {
    console.error('Sentry Message:', message, context);
  }
}

class LoggingTracker implements ErrorTracker {
  captureException(error: Error, context?: Record<string, any>): void {
    console.error('Error:', error.message, context);
  }
  
  captureMessage(message: string, context?: Record<string, any>): void {
    console.warn('Message:', message, context);
  }
}

export let errorTracker: ErrorTracker = new LoggingTracker();

export function initErrorTracker(tracker: ErrorTracker): void {
  errorTracker = tracker;
}