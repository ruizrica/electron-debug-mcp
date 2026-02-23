import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/index.js';

describe('MCP Server Factory', () => {
  it('creates a new server instance per call', () => {
    const serverA = createMcpServer();
    const serverB = createMcpServer();

    expect(serverA).not.toBe(serverB);
    expect(typeof serverA.connect).toBe('function');
    expect(typeof serverB.connect).toBe('function');
  });
});
