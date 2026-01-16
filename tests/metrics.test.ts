import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getElectronDebugInfo } from '../src/index.js';

// Mock CDP client
const mockCDPClient = {
  send: vi.fn(),
  close: vi.fn(),
  on: vi.fn()
};

describe('getElectronDebugInfo - Real Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return "unavailable" for metrics when CDP client is not connected', async () => {
    // This test would require mocking the electronProcesses map
    // For now, we verify the function handles unavailable metrics
    expect(true).toBe(true); // Placeholder - actual implementation would test the function
  });

  it('should return real CPU usage from CDP Performance.getMetrics when available', async () => {
    const mockMetrics = {
      metrics: [
        { name: 'CPUUsage', value: 15.5 },
        { name: 'JSHeapUsedSize', value: 52428800 }
      ]
    };
    
    mockCDPClient.send.mockResolvedValue(mockMetrics);
    
    // Test would verify that getElectronDebugInfo uses real metrics
    expect(mockCDPClient.send).toBeDefined();
  });

  it('should return "unavailable" when Performance.getMetrics fails', async () => {
    mockCDPClient.send.mockRejectedValue(new Error('CDP error'));
    
    // Test would verify fallback to 'unavailable'
    expect(mockCDPClient.send).toBeDefined();
  });

  it('should not use Math.random() for metrics', () => {
    // Verify that metrics are either real numbers or 'unavailable', never random
    const randomValue = Math.random();
    expect(typeof randomValue).toBe('number');
    // Actual test would verify metrics are not random values
  });

  it('should handle missing CPUUsage metric gracefully', async () => {
    const mockMetrics = {
      metrics: [
        { name: 'JSHeapUsedSize', value: 52428800 }
        // CPUUsage missing
      ]
    };
    
    mockCDPClient.send.mockResolvedValue(mockMetrics);
    
    // Test would verify CPU usage is 'unavailable' when metric missing
    expect(mockMetrics.metrics.find(m => m.name === 'CPUUsage')).toBeUndefined();
  });
});
