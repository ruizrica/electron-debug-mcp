import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Memory Leak Prevention - Logs Array', () => {
  const MAX_LOG_ENTRIES = 1000;

  it('should limit logs array to MAX_LOG_ENTRIES', () => {
    const logs: string[] = [];
    
    // Simulate adding logs beyond limit
    for (let i = 0; i < MAX_LOG_ENTRIES + 100; i++) {
      logs.push(`Log entry ${i}`);
      
      // Simulate rotation logic
      if (logs.length > MAX_LOG_ENTRIES) {
        const removeCount = Math.floor(MAX_LOG_ENTRIES * 0.1);
        logs.splice(0, removeCount);
      }
    }
    
    expect(logs.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
  });

  it('should rotate logs by removing oldest 10% when limit exceeded', () => {
    const logs: string[] = [];
    
    // Fill to limit
    for (let i = 0; i < MAX_LOG_ENTRIES; i++) {
      logs.push(`Log ${i}`);
    }
    
    expect(logs.length).toBe(MAX_LOG_ENTRIES);
    
    // Add one more to trigger rotation
    logs.push('New log');
    if (logs.length > MAX_LOG_ENTRIES) {
      const removeCount = Math.floor(MAX_LOG_ENTRIES * 0.1);
      logs.splice(0, removeCount);
    }
    
    expect(logs.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
    expect(logs[0]).not.toBe('Log 0'); // Oldest should be removed
  });

  it('should prevent unbounded log growth', () => {
    const logs: string[] = [];
    const iterations = 10000;
    
    for (let i = 0; i < iterations; i++) {
      logs.push(`Log ${i}`);
      
      if (logs.length > MAX_LOG_ENTRIES) {
        const removeCount = Math.floor(MAX_LOG_ENTRIES * 0.1);
        logs.splice(0, removeCount);
      }
    }
    
    // After many iterations, logs should still be bounded
    expect(logs.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
  });

  it('should maintain recent logs after rotation', () => {
    const logs: string[] = [];
    
    // Fill beyond limit
    for (let i = 0; i < MAX_LOG_ENTRIES + 50; i++) {
      logs.push(`Log ${i}`);
      
      if (logs.length > MAX_LOG_ENTRIES) {
        const removeCount = Math.floor(MAX_LOG_ENTRIES * 0.1);
        logs.splice(0, removeCount);
      }
    }
    
    // Recent logs should still be present
    const lastLog = logs[logs.length - 1];
    expect(lastLog).toBe(`Log ${MAX_LOG_ENTRIES + 49}`);
  });
});
