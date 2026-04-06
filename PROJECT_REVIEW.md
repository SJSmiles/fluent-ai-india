# Fluent AI India - Project Review & Module Documentation (Hindi/Hinglish)

Yeh document **Fluent AI** project ka ek comprehensive overview deta hai, jisme architecture, modules, aur AI voice providers (Vapi & Retell) ki integration ki details hain.

## 🚀 Project Overview

Fluent AI ek high-performance AI-driven voice calling platform hai jo automated outbound aur inbound calls handle karta hai. Isme advanced LLMs aur voice synthesis technologies ka use hota hai.

### Core Technology Stack
- **Frontend**: Angular (Admin Panel)
- **Backend**: Fastify (TypeScript)
- **AI/LLM**: OpenAI (GPT-4o), Ollama (Local Analysis)
- **Voice Providers**: Vapi AI, Retell AI
- **Database**: MongoDB (Mongoose), Redis (Caching & Queues)
- **Infrastructure**: Bull (Task Queue), PM2 (Process Management)

---

## 📂 Module Breakdown

### 1. `admin-panel` (Angular)
Project ka main dashboard.
- **Features**: Agents configure karna, Contacts manage karna, Batch calls schedule karna, Real-time call monitoring, aur Analytics dashboards.
- **Interactions**: `backend` se REST APIs ke through baat karta hai.

### 2. `backend` (Fastify)
Business logic ka central orchestrator.
- **Key Modules**:
  - `agent`: AI agent ki personality, voice, aur prompts define karta hai.
  - `batchCall`: Bulk call uploads (CSV/Excel) aur validation handle karta hai.
  - `webhook`: Vapi/Retell se real-time events (call start, end, transcripts) receive karta hai.
  - `company`: Enterprise-level settings aur voice providers ki API keys manage karta hai.
- **Call Logic**: Call recipients ka state manage karta hai aur provider ke data ke sath reconcile karta hai.

### 3. `llm-api`
AI agents ka "brain".
- **Real-time Conversation**: Live calls ke waqt `GPT-4o-mini` ka use karke streaming responses generate karta hai.
- **Post-Call Analysis**: Call khatam hone ke baad transcripts ko `Ollama` (local LLM) se analyze karake lead status update karta hai.
- **Caching**: Redis ka use karta hai taaki agent prompts fast access ho sakein.

### 4. `cron-service`
Background tasks aur scheduled jobs handle karta hai.
- **Batch Processing**: Bull queues ka use karke calls ko sahi time par trigger karta hai.
- **Service Integration**: `batch-call-runner.ts` decide karta hai ki Vapi use karna hai ya Retell, aur sahi API keys ensure karta hai.

### 5. `analytics-api` & `billing-service`
- **Analytics**: Call data process karke conversion rates aur agent performance dikhata hai.
- **Billing**: Credits, usage-based pricing, aur subscriptions manage karta hai.

---

## 📞 Calls Kaise Lagte Hain (Call Flow)

### Outbound Call Flow (Batch)
1. **Initiation**: User **Admin Panel** mein contact sheet upload karta hai.
2. **Database**: `backend` contacts validate karke `Recipient` collection mein associate karta hai.
3. **Scheduling**: `cron-service` scheduled batches ko monitor karta hai.
4. **Trigger**: `batch-call-runner.ts` batch ko pick karke `batch-process` Bull queue mein dal deta hai.
5. **Provider Selection**:
   - **Vapi**: System `@vapi-ai/server-sdk` use karke call lagata hai.
   - **Retell**: Retell ki API se call initiate hoti hai.
6. **Live Call**: Voice provider `llm-api` se WebSockets ke through connect hokar conversation generate karta hai.
7. **Webhook**: Call khatam hone par provider `backend/src/modules/webhook` par notification bhejta hai.
8. **Analysis**: `llm-api` final transcript ko Ollama se process karake lead ka status update karta hai.

---

## 🛠 Voice Provider vs Humara System (Kaun Kya Manage Karta Hai?)

Sabse bada sawal: **Kya Vapi aur Retell sab kuch khud karte hain?** 
Jawab hai: **Nahi.** Yeh ek split responsibility model hai.

### 1. Vapi / Retell Kya Manage Karte Hain? (The "Voice & Ears")
Yeh providers basically "Call Infrastructure" aur "Voice Processing" handle karte hain:
- **Calling**: Phone numbers provide karna aur calls connect karna (SIP trunking).
- **STT (Speech-to-Text)**: Jab user bolta hai, toh uski awaaz ko text mein convert karna.
- **TTS (Text-to-Speech)**: Jab humara system text bhejta hai, toh use AI voice mein convert karke user ko sunana.
- **Latency & Streaming**: Audio ko bina rukawat (low latency) ke stream karna.
- **Interruption Handling**: Agar AI bol raha hai aur user beech mein bolne lage, toh AI ko turant chup karana.

### 2. Humara System (`llm-api`) Kya Manage Karta Hai? (The "Brain")
Humara project "Intelligence" handle karta hai:
- **Agent Prompting**: Agent ka personality, instructions, aur scripts humare database mein save hote hain aur hum hi Vapi/Retell ko batate hain ki agent ko kaise behave karna hai.
- **LLM Logic**: Vapi sirf text bhejta hai, lekin *kya jawab dena hai* yeh humara system OpenAI (`gpt-4o`) se puch kar batata hai.
- **Function Calling**: Agar call ke beech mein koi appointment book karni ho ya database check karna ho, toh woh logic humare code mein hai.
- **Batch Management**: Hazaron logo ko kab call lagana hai, yeh humara `cron-service` handle karta hai.
- **Post-Call Analysis**: Call khatam hone ke baad Puri conversation ko analyze karna (leads qualify karna) humara system `Ollama` ke through karta hai.

---

## 🛠 Voice Provider Integration Detail

### Vapi AI
- **SDK**: `@vapi-ai/server-sdk` use hota hai.
- **Status Reconciliation**: `batchCallProcess.service.ts` "stuck" calls ko check karta hai aur Vapi se directly status fetch karke sync karta hai.

### Retell AI
- **Support**: Schema aur provider selection mein Retell fully integrated hai.
- **Logic**: Retell ki specific phone number IDs use karke high-quality voice calls initiate ki jati hain.

---

## 🔍 Important Files
- `backend/src/modules/batchCall/handlers/batchCallPM.ts`: CSV/Excel ingestion logic.
- `backend/src/modules/batchCall/services/batchCallProcess.service.ts`: Call status reconciliation.
- `cron-service/src/batch-call-runner.ts`: Database aur providers ke beech ka bridge.
- `llm-api/src/modules/services/llm.service.ts`: OpenAI/Ollama integration logic.
