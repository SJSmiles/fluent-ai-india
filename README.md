# 🎤 Fluent-AI - AI-Powered Language Learning

**Conversational AI language learning platform powered by OpenAI GPT-4, Whisper, and TTS.**

## 🌟 Features

- 🧠 **OpenAI GPT-4**: Intelligent conversation generation
- 🎙️ **Whisper**: Advanced speech recognition
- 🗣️ **OpenAI TTS**: Natural voice synthesis
- ⚡ **WebRTC**: Real-time audio streaming
- 📊 **Progress Tracking**: Fluency analytics and improvement
- 💰 **Cost Optimization**: Smart OpenAI API usage

## 🚀 Quick Start

```bash
# Clone and setup
git clone <your-repo>
cd fluent-ai
npm run setup

# Set OpenAI API key
export OPENAI_API_KEY="your-api-key"

# Start development environment
npm run dev
```

## 🗂️ Project Structure

- **📱 frontend/**: React web app for language conversations
- **🖥️ admin-panel/**: Dashboard for user and cost management
- **🎤 voice-api/**: AI processing with OpenAI APIs
- **🔌 signaling-server/**: WebRTC coordination
- **🚪 auth-service/**: User authentication and profiles
- **📊 analytics-api/**: Learning progress and API usage tracking
- **💳 billing-service/**: Payment processing and cost management
- **📧 notification-service/**: Learning reminders and updates
- **🌐 landing-page/**: Marketing website
- **📚 docs/**: Documentation and guides
- **🧪 testing/**: Automated tests
- **📦 shared/**: Common libraries and utilities

## 🛠️ Development

```bash
# Install dependencies
npm run setup

# Start all services
npm run dev

# Run specific service
npm run dev:frontend
npm run dev:voice
npm run dev:admin

# Run tests
npm test

# Build for production
npm run build
```

## 🤖 OpenAI Integration

This project uses OpenAI APIs for:
- **GPT-4**: Conversation generation and language coaching
- **Whisper**: Speech-to-text for multiple languages
- **TTS**: Text-to-speech with natural voices
- **Cost Optimization**: Smart caching and token management

## 📊 Cost Management

- Smart caching to reduce API calls
- Token optimization strategies
- Usage monitoring and alerts
- Subscription-based cost pass-through

## 🧪 Testing

```bash
# All tests
npm test

# Specific test types
npm run test:frontend
npm run test:backend
npm run test:e2e
```

## 📚 Documentation

Visit `/docs` for comprehensive guides:
- [Setup Guide](docs/guides/setup.md)
- [OpenAI Integration](docs/openai-integration/)
- [API Reference](docs/api/)
- [Architecture Overview](docs/architecture/)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](docs/)
- 🐛 [Issues](https://github.com/your-org/fluent-ai/issues)
- 💬 [Discussions](https://github.com/your-org/fluent-ai/discussions)
- 📧 Email: support@fluent-ai.com

---

**Fluent-AI** - Master any language through AI-powered conversations 🌍
