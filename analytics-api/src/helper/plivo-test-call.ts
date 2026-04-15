export function generateTestPlivoXml(
  baseUrl: string,
  agentId: string,
  token: string
): string {
  const wsUrl = baseUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Connecting your call, please wait...</Speak>

  <Stream
    bidirectional="true"
    keepCallAlive="true"
    contentType="audio/x-mulaw;rate=8000"
    statusCallbackUrl="${baseUrl}/webhook/test-call-status?token=${encodeURIComponent(token)}"
    statusCallbackMethod="POST"
  >
    ${wsUrl}/realtime/${agentId}?token=${encodeURIComponent(token)}
  </Stream>

</Response>`;
}