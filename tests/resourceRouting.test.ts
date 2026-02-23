import { describe, it, expect } from 'vitest';
import {
  ELECTRON_RESOURCES,
  parseElectronResourceUri,
  jsonResourceResponse,
  textResourceResponse
} from '../src/resourceRouting.js';

describe('Resource URI Routing', () => {
  it('parses static info and targets URIs', () => {
    expect(parseElectronResourceUri(ELECTRON_RESOURCES.INFO)).toEqual({ kind: 'info' });
    expect(parseElectronResourceUri(ELECTRON_RESOURCES.TARGETS)).toEqual({ kind: 'targets' });
  });

  it('parses process and logs URIs with process IDs', () => {
    expect(parseElectronResourceUri('electron://process/electron-123')).toEqual({
      kind: 'process',
      processId: 'electron-123'
    });

    expect(parseElectronResourceUri('electron://logs/electron-123')).toEqual({
      kind: 'logs',
      processId: 'electron-123'
    });
  });

  it('parses CDP target metadata URIs', () => {
    expect(parseElectronResourceUri('electron://cdp/electron-123/target-1')).toEqual({
      kind: 'cdp',
      processId: 'electron-123',
      targetId: 'target-1'
    });
  });

  it('parses CDP command URIs', () => {
    expect(parseElectronResourceUri('electron://cdp/electron-123/target-1/Page/reload')).toEqual({
      kind: 'cdp',
      processId: 'electron-123',
      targetId: 'target-1',
      commandPath: 'Page/reload'
    });
  });

  it('flags malformed CDP URIs', () => {
    expect(parseElectronResourceUri('electron://cdp/electron-123')).toEqual({
      kind: 'invalidCdp'
    });
    expect(parseElectronResourceUri('electron://cdp//target-1')).toEqual({
      kind: 'invalidCdp'
    });
  });

  it('returns unknown for non-Electron URIs', () => {
    expect(parseElectronResourceUri('electron://unknown')).toEqual({ kind: 'unknown' });
    expect(parseElectronResourceUri('https://example.com')).toEqual({ kind: 'unknown' });
  });
});

describe('Resource response helpers', () => {
  it('builds JSON response contents', () => {
    const response = jsonResourceResponse('electron://info', { ok: true, count: 2 });
    expect(response.contents).toHaveLength(1);
    expect(response.contents[0].uri).toBe('electron://info');
    expect(JSON.parse(response.contents[0].text)).toEqual({ ok: true, count: 2 });
  });

  it('builds text response contents', () => {
    const response = textResourceResponse('electron://logs/electron-1', 'line1\nline2');
    expect(response.contents).toHaveLength(1);
    expect(response.contents[0].uri).toBe('electron://logs/electron-1');
    expect(response.contents[0].text).toBe('line1\nline2');
  });
});
