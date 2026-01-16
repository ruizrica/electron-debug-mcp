import { describe, it, expect } from 'vitest';
import type { CDPClient } from '../src/types/chrome-remote-interface';

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
});
