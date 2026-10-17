# Cat Task Assistant

## Run on Windows
1. Run `npm install` once, if dependencies are not already installed.
2. Start the desktop app with `npm start`.
3. Run the focused reminder tests with `npm test`.

To make one credential-safe live AI check, run `npm run diagnose:gemma`. It prints whether `.env` and a key are present, then makes exactly one request and reports only success/status or a redacted error. It never prints the key or generated text.

The dashboard remains the task source: Mochi reads its existing `cat-task-assistant-v1` local-storage records (`{ tasks, history }`), with task due times in local `HH:mm` format. Electron checks pending tasks every 15 seconds while the app is running. A task without a valid due time is ignored. Overdue pending tasks are checked after startup; each task occurrence is only announced once, with snoozes as new occurrences. **Remind me later** means one hour.

Chat requests such as “Remind me in 5 minutes to go for lunch” create a one-time reminder in Electron's user-data store. It survives app restarts and is delivered through Mochi's existing speech and reminder controls.

Done and snooze actions from Mochi update the existing dashboard task and history. Keep the dashboard window open or minimized while the app runs. Reminders do not run after the app is fully closed. The cat stays above normal desktop windows; exclusive full-screen apps may cover it.

## Speech and microphone
**Say hello** and task reminders use system `speechSynthesis`; no AI key is needed. The reminder text shown is the text spoken. Mute stops current speech but leaves reminders visible and actionable. **Listen** uses Windows' built-in `System.Speech` recognizer through the Electron main process; it needs a working microphone, Windows desktop-app microphone permission, and an installed speech language profile. It does not need an API key, internet service, or extra npm package. English requests `en-IN` and falls back to `en-US` only when the India profile is not installed. Low-confidence transcripts remain editable and are flagged for review. Locale selection and Windows' installed recognizer do not guarantee transcription accuracy. A transcript is placed in Mochi's input for review before sending. Typed chat remains available as a fallback.

## Optional AI setup
The API key is read by Electron's main process from `.env`; it is never passed to renderer JavaScript. Copy `.env.example` to `.env`, put a restricted Google AI Studio key after `GEMMA_API_KEY=`, and restart with `npm start`. Never commit or share `.env`.

The default model is `gemma-4-26b-a4b-it`, which Google's [Gemma Gemini API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) lists as supported. The request uses the documented `models.generateContent` endpoint and a separate `systemInstruction`; only generated answer text is shown. Set `GEMMA_MODEL_ID` in `.env` only if you want another supported model. A missing key or rejected model displays a safe provider/setup message; reminder scheduling remains independent.

Official references: [model catalog](https://ai.google.dev/gemini-api/docs/models), [generateContent API](https://ai.google.dev/api/generate-content), [API key security](https://ai.google.dev/gemini-api/docs/api-key).
