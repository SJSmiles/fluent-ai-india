# Fluent AI India Conversion Plan (Retell to Custom Stack)

This document outlines the plan to migrate the `fluent-ai-india` project from Retell to a custom architecture using Plivo, Deepgram, and ElevenLabs, with added support for bulk calling and company-level management.

## 🎯 Objectives
1.  **Remove Retell & Vapi**: Clean up all SDKs and logic related to Retell.
2.  **Custom Integration**: Port the logic from `ai-agent-india` (Plivo + Deepgram + ElevenLabs) into the TypeScript/Fastify architecture.
3.  **Company-level Management**: Store API keys in the database per company (multi-tenant).
4.  **Bulk Calling**: Implement a robust queue system for making thousands of calls simultaneously.

---

## 🛠 Required Changes

### 1. Database Schema Updates
- **Agent Model**: Remove Retell specific fields. Add fields for `voiceId`, `language`, and `prompt`.
- **CompanyConfig Model [NEW]**: Create a new model to store credentials:
  - `plivoAuthId`
  - `plivoAuthToken`
  - `deepgramApiKey`
  - `elevenLabsApiKey`

### 2. Core Services (Porting from ai-agent-india)
- **PlivoService**: Handle call orchestration and XML generation.
- **DeepgramService**: Handle real-time speech-to-text (Hindi support included).
- **TTSService**: Handle ElevenLabs text-to-speech generation.
- **LLMService**: Handle OpenAI response generation and call analysis.

### 3. WebSocket Refactoring
- The current `WebSocketService` is built for Retell events.
- **Rewrite**: It must now handle raw audio buffers from Plivo's WebSocket stream.
- **CallHandler**: Implement a robust class to manage the conversation state, handle interruptions (barge-in), and process audio packets.

### 4. Bulk Calling Feature
- **Queue System**: Use `bull` (Redis-based) to manage call tasks.
- **Concurrency**: Set a limit for concurrent calls to prevent hitting API rate limits.
- **API Endpoint**: Create a `/bulk-call` endpoint to accept a list of contacts.

---

## 📝 Implementation Phases

### Phase 1: Preparation & Cleanup
- Update `package.json` (remove retell, add plivo/deepgram/elevenlabs).
- Delete Retell specific services and controllers.

### Phase 2: Core Logic Integration
- Implement the 4 core services mentioned above in TypeScript.
- Update the WebSocket controller to handle Plivo's stream protocol.

### Phase 3: Company Level & RBAC
- Update models to link API keys to companies.
- Ensure the decrypt logic correctly identifies the company and loads the right keys.

### Phase 4: Bulk Calling & Testing
- Setup a `QueueProcessor` for bulk calls.
- Manual testing with single calls followed by bulk tests.

---

## 🛑 Open Questions / Requirements
- **Redis**: Fluent-ai-india will need a Redis instance for the bulk calling queue (Bull).
- **Plivo Numbers**: Ensure you have verified phone numbers in Plivo for outbound calling.
- **API Keys**: We will need a way for companies to input their own keys in the frontend (Admin UI).

**Aap approve krenge toh me execution start krunga.**
