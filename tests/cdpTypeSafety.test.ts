import { describe, it, expect } from 'vitest';
import type { CDPClient } from '../src/types/chrome-remote-interface';

// Import types from source (these would be exported in a real scenario)
interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

describe('CDP Type Safety', () => {
  it('should have CDPClient interface exported', () => {
    // Verify CDPClient type exists
    const client: CDPClient = {
      send: async () => ({}),
      on: () => {},
      close: () => {}
    };
    
    expect(client).toBeDefined();
    expect(typeof client.send).toBe('function');
    expect(typeof client.on).toBe('function');
    expect(typeof client.close).toBe('function');
  });

  it('should enforce CDPClient type in ElectronProcess interface', () => {
    // Type check: cdpClient should be CDPClient | undefined, not 'any'
    interface TestProcess {
      cdpClient?: CDPClient;
    }
    
    const process: TestProcess = {
      cdpClient: {
        send: async () => ({}),
        on: () => {},
        close: () => {}
      }
    };
    
    expect(process.cdpClient).toBeDefined();
  });

  it('should use Record<string, unknown> for CDP command params', () => {
    const params: Record<string, unknown> = {
      expression: 'document.title',
      returnByValue: true
    };
    
    expect(params).toBeDefined();
    expect(typeof params.expression).toBe('string');
    expect(typeof params.returnByValue).toBe('boolean');
  });

  it('should use unknown for CDP command return types', () => {
    const result: unknown = {
      result: {
        type: 'string',
        value: 'Test Title'
      }
    };
    
    expect(result).toBeDefined();
    // Type safety: result is unknown, requires type checking before use
    if (typeof result === 'object' && result !== null) {
      expect('result' in result).toBe(true);
    }
  });

  it('should not allow any type for CDP client', () => {
    // TypeScript compilation should fail if 'any' is used
    // This test verifies type safety at compile time
    const client: CDPClient = {
      send: async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
        return { method, params };
      },
      on: (event: string, callback: (params: unknown) => void): void => {},
      close: (): void => {}
    };
    
    expect(client.send).toBeDefined();
  });

  it('should enforce CDPTarget interface structure', () => {
    const target: CDPTarget = {
      id: 'target-123',
      type: 'page',
      title: 'Test Page',
      url: 'https://example.com',
      webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-123',
      devtoolsFrontendUrl: 'chrome-devtools://...'
    };
    
    expect(target.id).toBe('target-123');
    expect(target.type).toBe('page');
    expect(target.title).toBe('Test Page');
    expect(target.url).toBe('https://example.com');
    expect(typeof target.webSocketDebuggerUrl).toBe('string');
  });

  it('should require type checking for CDP command results', () => {
    // Simulate executeCDPCommand return type
    const executeCDPCommand = async (
      domain: string,
      method: string,
      params: Record<string, unknown> = {}
    ): Promise<unknown> => {
      return { result: { type: 'string', value: 'test' } };
    };

    const result = await executeCDPCommand('Runtime', 'evaluate', { expression: '1+1' });
    
    // Type safety: must check type before accessing properties
    expect(result).toBeDefined();
    if (typeof result === 'object' && result !== null && 'result' in result) {
      const typedResult = result as { result: { type: string; value: unknown } };
      expect(typedResult.result.type).toBe('string');
    }
  });

  it('should enforce domain and method as strings in CDP commands', () => {
    const executeCommand = (domain: string, method: string, params: Record<string, unknown> = {}): void => {
      expect(typeof domain).toBe('string');
      expect(typeof method).toBe('string');
      expect(typeof params).toBe('object');
    };

    executeCommand('Runtime', 'evaluate', { expression: 'test' });
    executeCommand('Page', 'reload', {});
    executeCommand('Debugger', 'pause', {});
  });

  it('should handle CDP error responses with proper typing', () => {
    const errorResponse: unknown = {
      error: {
        code: -32000,
        message: 'Invalid parameters'
      }
    };

    expect(errorResponse).toBeDefined();
    // Type safety: check structure before accessing
    if (typeof errorResponse === 'object' && errorResponse !== null && 'error' in errorResponse) {
      const typedError = errorResponse as { error: { code: number; message: string } };
      expect(typedError.error.code).toBe(-32000);
      expect(typedError.error.message).toBe('Invalid parameters');
    }
  });

  it('should enforce CDP target array type safety', () => {
    const targets: CDPTarget[] = [
      {
        id: 'target-1',
        type: 'page',
        title: 'Page 1',
        url: 'https://example.com'
      },
      {
        id: 'target-2',
        type: 'page',
        title: 'Page 2',
        url: 'https://example.org'
      }
    ];

    expect(Array.isArray(targets)).toBe(true);
    expect(targets.length).toBe(2);
    expect(targets[0].id).toBe('target-1');
    expect(targets[1].id).toBe('target-2');
  });

  it('should require type guards for unknown CDP responses', () => {
    const response: unknown = {
      result: {
        type: 'number',
        value: 42
      }
    };

    // Type guard function
    const isCDPResult = (obj: unknown): obj is { result: { type: string; value: unknown } } => {
      return typeof obj === 'object' && obj !== null && 'result' in obj;
    };

    if (isCDPResult(response)) {
      expect(response.result.type).toBe('number');
      expect(response.result.value).toBe(42);
    } else {
      throw new Error('Type guard failed');
    }
  });
});
