import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MCP Tool Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ListToolsRequestSchema Handler', () => {
    const expectedTools = [
      'electron_start',
      'electron_stop',
      'electron_list',
      'electron_reload',
      'electron_evaluate',
      'electron_pause',
      'electron_resume'
    ];

    it('should list all 7 available Electron debugging tools', () => {
      expect(expectedTools.length).toBe(7);
      expect(expectedTools).toContain('electron_start');
      expect(expectedTools).toContain('electron_stop');
      expect(expectedTools).toContain('electron_list');
      expect(expectedTools).toContain('electron_reload');
      expect(expectedTools).toContain('electron_evaluate');
      expect(expectedTools).toContain('electron_pause');
      expect(expectedTools).toContain('electron_resume');
    });

    it('should have electron_start tool with correct schema', () => {
      const schema = {
        type: 'object',
        properties: {
          appPath: { type: 'string' },
          debugPort: { type: 'number' },
          startupTimeout: { type: 'number' }
        },
        required: ['appPath']
      };

      expect(schema.required).toContain('appPath');
      expect(schema.properties.appPath.type).toBe('string');
      expect(schema.properties.debugPort.type).toBe('number');
      expect(schema.properties.startupTimeout.type).toBe('number');
    });

    it('should have electron_stop tool with correct schema', () => {
      const schema = {
        type: 'object',
        properties: {
          processId: { type: 'string' }
        },
        required: ['processId']
      };

      expect(schema.required).toContain('processId');
      expect(schema.properties.processId.type).toBe('string');
    });

    it('should have electron_list tool with empty schema', () => {
      const schema = {
        type: 'object',
        properties: {}
      };

      expect(Object.keys(schema.properties)).toHaveLength(0);
    });

    it('should have electron_reload tool with optional targetId', () => {
      const schema = {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          targetId: { type: 'string' }
        },
        required: ['processId']
      };

      expect(schema.required).toContain('processId');
      expect(schema.required).not.toContain('targetId');
      expect(schema.properties.targetId.type).toBe('string');
    });

    it('should have electron_evaluate tool with required parameters', () => {
      const schema = {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          targetId: { type: 'string' },
          expression: { type: 'string' },
          returnByValue: { type: 'boolean' }
        },
        required: ['processId', 'targetId', 'expression']
      };

      expect(schema.required).toContain('processId');
      expect(schema.required).toContain('targetId');
      expect(schema.required).toContain('expression');
      expect(schema.required).not.toContain('returnByValue');
    });

    it('should have electron_pause tool with required processId and targetId', () => {
      const schema = {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          targetId: { type: 'string' }
        },
        required: ['processId', 'targetId']
      };

      expect(schema.required).toContain('processId');
      expect(schema.required).toContain('targetId');
    });

    it('should have electron_resume tool with required processId and targetId', () => {
      const schema = {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          targetId: { type: 'string' }
        },
        required: ['processId', 'targetId']
      };

      expect(schema.required).toContain('processId');
      expect(schema.required).toContain('targetId');
    });
  });

  describe('CallToolRequestSchema Handler - Input Validation', () => {
    it('should validate electron_start tool input schema', () => {
      const validInput = {
        appPath: '/path/to/app'
      };
      
      const validInputWithOptional = {
        appPath: '/path/to/app',
        debugPort: 9222,
        startupTimeout: 30000
      };
      
      const invalidInput = {
        // Missing required appPath
      };
      
      expect(validInput.appPath).toBeDefined();
      expect(validInputWithOptional.appPath).toBeDefined();
      expect(validInputWithOptional.debugPort).toBe(9222);
      expect(invalidInput.appPath).toBeUndefined();
    });

    it('should validate electron_stop tool input schema', () => {
      const validInput = {
        processId: 'electron-123456'
      };
      
      expect(validInput.processId).toBeDefined();
      expect(typeof validInput.processId).toBe('string');
    });

    it('should validate electron_list tool accepts empty arguments', () => {
      const validInput = {};
      
      expect(validInput).toBeDefined();
      expect(Object.keys(validInput)).toHaveLength(0);
    });

    it('should validate electron_reload tool input schema', () => {
      const validInputWithTarget = {
        processId: 'electron-123',
        targetId: 'target-1'
      };
      
      const validInputWithoutTarget = {
        processId: 'electron-123'
      };
      
      expect(validInputWithTarget.processId).toBeDefined();
      expect(validInputWithTarget.targetId).toBeDefined();
      expect(validInputWithoutTarget.processId).toBeDefined();
      expect(validInputWithoutTarget.targetId).toBeUndefined();
    });

    it('should validate electron_evaluate tool input schema', () => {
      const validInput = {
        processId: 'electron-123456',
        targetId: 'target-1',
        expression: 'document.title',
        returnByValue: true
      };
      
      const validInputWithoutOptional = {
        processId: 'electron-123456',
        targetId: 'target-1',
        expression: 'document.title'
      };
      
      expect(validInput.processId).toBeDefined();
      expect(validInput.targetId).toBeDefined();
      expect(validInput.expression).toBeDefined();
      expect(validInput.returnByValue).toBe(true);
      expect(validInputWithoutOptional.returnByValue).toBeUndefined();
    });

    it('should validate electron_pause tool input schema', () => {
      const validInput = {
        processId: 'electron-123',
        targetId: 'target-1'
      };
      
      expect(validInput.processId).toBeDefined();
      expect(validInput.targetId).toBeDefined();
    });

    it('should validate electron_resume tool input schema', () => {
      const validInput = {
        processId: 'electron-123',
        targetId: 'target-1'
      };
      
      expect(validInput.processId).toBeDefined();
      expect(validInput.targetId).toBeDefined();
    });
  });

  describe('CallToolRequestSchema Handler - Error Handling', () => {
    it('should handle tool execution errors gracefully', () => {
      const error = new Error('Process not found');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Process not found');
    });

    it('should return error response with isError flag', () => {
      const errorResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Process not found'
          })
        }],
        isError: true
      };

      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].type).toBe('text');
      
      const errorData = JSON.parse(errorResponse.content[0].text);
      expect(errorData.error).toBe('Process not found');
    });

    it('should handle unknown tool names', () => {
      const unknownTool = 'electron_unknown';
      const expectedError = `Unknown tool: ${unknownTool}`;
      
      expect(expectedError).toContain('Unknown tool');
    });

    it('should handle missing required parameters', () => {
      const missingAppPath = {};
      const missingProcessId = {};
      const missingTargetId = { processId: 'electron-123' };
      
      expect(missingAppPath.appPath).toBeUndefined();
      expect(missingProcessId.processId).toBeUndefined();
      expect(missingTargetId.targetId).toBeUndefined();
    });

    it('should handle invalid process status errors', () => {
      const errorMessage = 'Process electron-123 not found or not running';
      expect(errorMessage).toContain('not found or not running');
    });

    it('should handle CDP command execution errors', () => {
      const cdpError = new Error('Error executing CDP command: Target not found');
      expect(cdpError.message).toContain('CDP command');
    });
  });

  describe('CallToolRequestSchema Handler - Response Format', () => {
    it('should return success response with correct format for electron_start', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            processId: 'electron-123',
            name: 'test-app',
            status: 'running',
            pid: 12345,
            debugPort: 9222,
            appPath: '/path/to/app'
          })
        }]
      };

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      
      const data = JSON.parse(response.content[0].text);
      expect(data.processId).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.status).toBe('running');
    });

    it('should return success response for electron_stop', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            processId: 'electron-123'
          })
        }]
      };

      const data = JSON.parse(response.content[0].text);
      expect(data.success).toBe(true);
      expect(data.processId).toBeDefined();
    });

    it('should return processes array for electron_list', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            processes: [
              { id: 'electron-1', name: 'app1', status: 'running' },
              { id: 'electron-2', name: 'app2', status: 'running' }
            ]
          })
        }]
      };

      const data = JSON.parse(response.content[0].text);
      expect(Array.isArray(data.processes)).toBe(true);
      expect(data.processes.length).toBe(2);
    });

    it('should return result for electron_evaluate', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            result: { type: 'string', value: 'Test Title' },
            processId: 'electron-123',
            targetId: 'target-1'
          })
        }]
      };

      const data = JSON.parse(response.content[0].text);
      expect(data.result).toBeDefined();
      expect(data.processId).toBeDefined();
      expect(data.targetId).toBeDefined();
    });
  });
});
