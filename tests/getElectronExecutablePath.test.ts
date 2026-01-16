import { describe, it, expect } from 'vitest';
import { getElectronExecutablePath } from '../src/index.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';

// Mock fs and os modules
vi.mock('fs');
vi.mock('os');
vi.mock('path');

describe('getElectronExecutablePath', () => {
  it('should return Windows .cmd path when electron.cmd exists in AppData', () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    vi.mocked(path.join).mockReturnValue('C:\\Users\\test\\AppData\\Roaming\\npm\\electron.cmd');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    const result = getElectronExecutablePath();
    expect(result).toBe('C:\\Users\\test\\AppData\\Roaming\\npm\\electron.cmd');
  });

  it('should return macOS Electron.app path when exists', () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      return p.includes('Electron.app');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('Electron.app');
  });

  it('should return Linux electron executable when exists', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      return p.includes('node_modules/.bin/electron') && !p.includes('.cmd');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('electron');
    expect(result).not.toContain('.cmd');
  });

  it('should fallback to "electron" in PATH when no paths found', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const result = getElectronExecutablePath();
    expect(result).toBe('electron');
  });

  it('should check node_modules/.bin path for current project', () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    vi.mocked(path.resolve).mockReturnValue('C:\\project\\node_modules\\.bin\\electron.cmd');
    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      return p.includes('node_modules');
    });
    
    const result = getElectronExecutablePath();
    expect(result).toContain('node_modules');
  });
});
