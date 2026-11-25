import http from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';

const port = Number(process.env.PILOT_COLLECTOR_PORT || '8080');
const host = process.env.PILOT_COLLECTOR_HOST || '127.0.0.1';
const outputDir = new URL('../pilot-output/', import.meta.url);
const outputFile = new URL('quality-events.ndjson', outputDir);

await mkdir(outputDir, { recursive: true });

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.url !== '/events' || request.method !== 'POST') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  for await (const chunk of request) body += chunk;

  try {
    const payload = JSON.parse(body);
    if (!payload.appVersion || !payload.sessionId || !payload.quality || !payload.performance) {
      sendJson(response, 400, { error: 'Sanitized payload required' });
      return;
    }

    await appendFile(outputFile, `${JSON.stringify({
      receivedAt: Date.now(),
      remoteAddress: request.socket.remoteAddress || 'unknown',
      payload,
    })}\n`, 'utf8');
    sendJson(response, 202, { accepted: true });
  } catch {
    sendJson(response, 400, { error: 'Invalid JSON' });
  }
});

server.listen(port, host, () => {
  console.log(`Pilot collector listening on http://${host}:${port}/events`);
  console.log(`Events: ${outputFile.pathname}`);
});
