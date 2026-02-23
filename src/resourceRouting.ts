export const ELECTRON_RESOURCES = {
  INFO: "electron://info",
  PROCESS: "electron://process/",
  LOGS: "electron://logs/",
  CDP: "electron://cdp/",
  TARGETS: "electron://targets"
};

export type ParsedResourceRoute =
  | { kind: 'info' }
  | { kind: 'targets' }
  | { kind: 'process'; processId: string }
  | { kind: 'logs'; processId: string }
  | { kind: 'cdp'; processId: string; targetId: string; commandPath?: string }
  | { kind: 'invalidCdp' }
  | { kind: 'unknown' };

interface ResourceReadResult {
  [x: string]: unknown;
  contents: Array<{
    uri: string;
    text: string;
  }>;
}

export function parseElectronResourceUri(uri: string): ParsedResourceRoute {
  if (uri === ELECTRON_RESOURCES.INFO) {
    return { kind: 'info' };
  }

  if (uri === ELECTRON_RESOURCES.TARGETS) {
    return { kind: 'targets' };
  }

  if (uri.startsWith(ELECTRON_RESOURCES.CDP)) {
    const path = uri.slice(ELECTRON_RESOURCES.CDP.length);
    const segments = path.split('/');

    if (segments.length < 2 || !segments[0] || !segments[1]) {
      return { kind: 'invalidCdp' };
    }

    const [processId, targetId, ...commandSegments] = segments;
    const commandPath = commandSegments.length > 0 ? commandSegments.join('/') : undefined;

    if (!commandPath) {
      return { kind: 'cdp', processId, targetId };
    }

    return { kind: 'cdp', processId, targetId, commandPath };
  }

  if (uri.startsWith(ELECTRON_RESOURCES.PROCESS)) {
    const processId = uri.slice(ELECTRON_RESOURCES.PROCESS.length);
    if (processId) {
      return { kind: 'process', processId };
    }
  }

  if (uri.startsWith(ELECTRON_RESOURCES.LOGS)) {
    const processId = uri.slice(ELECTRON_RESOURCES.LOGS.length);
    if (processId) {
      return { kind: 'logs', processId };
    }
  }

  return { kind: 'unknown' };
}

export function jsonResourceResponse(uri: string, payload: unknown): ResourceReadResult {
  return {
    contents: [
      {
        uri,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function textResourceResponse(uri: string, text: string): ResourceReadResult {
  return {
    contents: [
      {
        uri,
        text,
      },
    ],
  };
}
