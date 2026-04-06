# 🖥️ Fluent-AI Admin API Backend

**Administrative backend service for managing users, analytics, content moderation, and system operations**

## 🎯 Purpose

This backend service is the **admin control center** of Fluent-AI that handles:

- 👤 **User Management** - CRUD operations, profiles, suspensions
- 📊 **Analytics & Reporting** - Usage statistics, learning progress, revenue
- 💰 **Cost Management** - OpenAI API usage monitoring and optimization
- 🛡️ **Content Moderation** - Conversation review, flagging, safety
- ⚙️ **System Administration** - Service health, configurations, monitoring
- 📈 **Business Intelligence** - KPIs, growth metrics, user insights

## 🛠️ Tech Stack

- **Language**: Node.js 18+ / TypeScript
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance
- **Authentication**: JWT + RBAC (Role-Based Access Control)
- **Monitoring**: Prometheus + Grafana integration
- **File Storage**: AWS S3 / Google Cloud Storage
- **Queue**: Bull/BullMQ for background jobs
