# 🐱 Mochi — Cat Task Assistant

**Your cute AI desktop companion for productivity.** 🐾

Mochi is an AI-powered desktop productivity assistant designed to make everyday tasks feel easier and more enjoyable. With a cute floating cat companion, AI-powered conversations, task reminders, and voice interaction, Mochi brings a little personality to your desktop.

## ✨ Features

- 🐱 **Floating Cat Companion** — A cute desktop pet that stays accessible while you work.
- 🤖 **AI-Powered Chat** — Get help with studying, planning, breaking down tasks, and brainstorming using Google's Gemma AI.
- ⏰ **Task Reminders** — Schedule reminders for everyday activities and important tasks.
- 🔊 **Text-to-Speech** — Let Mochi speak messages and reminders aloud.
- 🎙️ **Voice Input** — Speak to Mochi and convert speech into text when supported by the configured recognition engine.
- 📋 **Productivity Dashboard** — View tasks, track progress, and manage your daily activities.
- 🎨 **Cute Pastel Interface** — A friendly, cozy design made to make productivity feel less stressful.

## 🛠️ Built With

- Electron
- HTML, CSS, and JavaScript
- Node.js
- Google's Gemma AI API
- Windows speech capabilities, depending on the configured environment

## 🚀 Getting Started

### Prerequisites

Before running Mochi, install:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)

You will also need a Google AI Studio API key for AI-powered chat.

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd cat-task-assistant
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's actual URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your API key

Create a `.env` file in the project root directory and add:

```env
GEMMA_API_KEY=your_google_ai_studio_api_key
```

Replace the placeholder with your own API key.

**Security:** Never commit your `.env` file or share your API key publicly. Keep `.env` excluded through `.gitignore`.

### 4. Start Mochi

```bash
npm start
```

Mochi should launch as a desktop application.

## 🎯 Project Goal

Mochi aims to make desktop productivity more approachable by combining AI assistance with a friendly virtual companion. Instead of interacting with a productivity tool that feels purely mechanical, users can chat with Mochi, organize tasks, and receive reminders through a more engaging experience.

## 🔮 Future Improvements

- More reliable voice recognition for Indian English and additional languages
- Smarter, task-specific spoken reminders
- Improved reminder delivery and window behavior
- More personalization options for the floating cat
- Better offline capabilities and accessibility features

## 🔐 Privacy and Security

- Keep API keys in environment variables.
- Never upload `.env`, credentials, or private user data to GitHub.
- Review permissions before enabling microphone access.
- AI responses and online speech services may require an internet connection.

## 👩‍💻 Built For

Created as a desktop productivity assistant project exploring AI integration, desktop applications, and more human-friendly user experiences.

---

**Made with 🩷, code, and a little cat energy.**

*Meet Mochi — your cozy little productivity companion!* 🐾
