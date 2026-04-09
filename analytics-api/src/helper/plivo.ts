export function generatePlivoXml(ngrokUrl: string, agentId: string): string {
  const wsUrl = ngrokUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream
    bidirectional="true"
    keepCallAlive="true"
    streamTimeout="86400"
    contentType="audio/x-mulaw;rate=8000"
    audioTrack="inbound">
    ${wsUrl}/realtime/${agentId}
  </Stream>
</Response>`;
}