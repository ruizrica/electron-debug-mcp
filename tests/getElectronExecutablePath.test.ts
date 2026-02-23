import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getElectronExecutablePath } from '../src/index.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock fs, os, and path modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  },
  existsSync: vi.fn()
}));

vi.mock('os', () => ({
  default: {
    platform: vi.fn(),
    homedir: vi.fn(() => '/home/test')
  },
  platform: vi.fn(),
  homedir: vi.fn(() => '/home/test')
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args: string[]) => args.join('/')),
    resolve: vi.fn((...args: string[]) => args.join('/'))
  },
  join: vi.fn((...args: string[]) => args.join('/')),
  resolve: vi.fn((...args: string[]) => args.join('/'))
}));

describe('getElectronExecutablePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return Windows .cmd path when electron.cmd exists in AppData', () => {
    vi.mocked(os.platform).mockReturnValue('win32' as NodeJS.Platform);
    vi.mocked(path.join).mockReturnValue('C:\\Users\\test\\AppData\\Roaming\\npm\\electron.cmd');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    const result = getElectronExecutablePath();
    expect(result).toBe('C:\\Users\\test\\AppData\\Roaming\\npm\\electron.cmd');
  });

  it('should return macOS Electron.app path when exists', () => {
    vi.mocked(os.platform).mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockImplementation((p: string | undefined) => {
      return p !== undefined && p.includes('Electron.app');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('Electron.app');
  });

  it('should return Linux electron executable when exists', () => {
    vi.mocked(os.platform).mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockImplementation((p: string | undefined) => {
      return p !== undefined && p.includes('node_modules/.bin/electron') && !p.includes('.cmd');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('electron');
    expect(result).not.toContain('.cmd');
  });

  it('should fallback to "electron" in PATH when no paths found', () => {
    vi.mocked(os.platform).mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const result = getElectronExecutablePath();
    expect(result).toBe('electron');
  });

  it('should check node_modules/.bin path for current project', () => {
    vi.mocked(os.platform).mockReturnValue('win32' as NodeJS.Platform);
    vi.mocked(path.resolve).mockReturnValue('C:\\project\\node_modules\\.bin\\electron.cmd');
    vi.mocked(fs.existsSync).mockImplementation((p: string | undefined) => {
      return p !== undefined && p.includes('node_modules');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('node_modules');
  });
});
