# 💳 Fluent-AI Billing Service

Payment processing and subscription management with OpenAI API cost pass-through and premium features.

## 🎯 Purpose
- Subscription plan management (Basic, Pro, Enterprise)
- OpenAI API cost tracking and billing
- Usage-based pricing for API calls
- Premium feature access control
- Invoice generation and payment processing

## 🛠️ Tech Stack
- **Language**: Node.js + TypeScript
- **Payments**: Stripe API, PayPal SDK
- **Database**: PostgreSQL + Prisma
- **Framework**: Express.js
- **Cost Tracking**: OpenAI API usage monitoring

## 🚀 Quick Start
```bash
npm install
npx prisma migrate dev
npm start
# Billing API at http://localhost:3004
```

## 💰 Billing Features
- Multiple subscription tiers
- OpenAI API cost pass-through billing
- Usage-based pricing models
- Premium feature gates
- Automatic payment processing

## 📊 Pricing Models
- **Basic**: Limited conversations, GPT-3.5
- **Pro**: Unlimited conversations, GPT-4, voice features
- **Enterprise**: Advanced analytics, custom models
- **Pay-per-use**: Direct OpenAI API cost + markup

## 🔗 Related Services
- Tracks usage from: `analytics-api`
- Controls access in: `voice-api`
- Notifies via: `notification-service`
