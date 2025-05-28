# LinkedIn Auto Commenter

A Chrome extension that automatically comments on LinkedIn posts using AI-generated responses.

## Features

- 🤖 AI-powered comment generation using OpenRouter API
- 📱 Simple popup interface for configuration
- 🎯 Automatically finds and processes LinkedIn feed posts
- ⚙️ Customizable comment style guide
- 🔄 Sequential processing with proper delays
- 📌 Uses pinned, inactive tabs for minimal disruption

## Prerequisites

1. **OpenRouter API Key**: Get one from [OpenRouter.ai](https://openrouter.ai/)
2. **LinkedIn Account**: Must be logged into LinkedIn in your browser
3. **Chrome Browser**: Extension is built for Chrome

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   pnpm build
   ```
4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist_chrome` folder

## Usage

1. **Setup**:
   - Click the extension icon in your browser toolbar
   - Enter your OpenRouter API key
   - Write a style guide for your comments (e.g., "Professional but friendly, ask questions, share insights, keep under 50 words")

2. **Start Auto-Commenting**:
   - Make sure you're logged into LinkedIn
   - Click "Start Auto Commenting" in the popup
   - The extension will:
     - Open LinkedIn feed in a pinned tab
     - Scroll to load posts for 10 seconds
     - Extract post URLs
     - Visit each post individually
     - Generate and post AI comments
     - Process posts with 10-second delays between each

3. **Monitor Progress**:
   - Open Chrome DevTools Console to see progress logs
   - You can stop the process anytime by clicking "Stop Auto Commenting"

## How It Works

1. **Feed Scanning**: Opens LinkedIn feed and scrolls to load posts
2. **URL Extraction**: Finds all post URLs using activity URN patterns
3. **Content Analysis**: Visits each post and extracts the main content
4. **AI Generation**: Sends post content + style guide to OpenRouter API
5. **Comment Posting**: Simulates typing and submits the generated comment
6. **Sequential Processing**: Moves to next post with proper delays

## Configuration

### Style Guide Examples

- **Professional**: "Keep it professional, add value, ask thoughtful questions"
- **Casual**: "Be friendly and conversational, use emojis sparingly, share personal experiences"
- **Analytical**: "Provide data-driven insights, ask about metrics, reference industry trends"
- **Supportive**: "Be encouraging and positive, offer help or resources, celebrate achievements"

### Timing Settings

The extension uses these delays (hardcoded for reliability):
- 5 seconds: Tab loading time
- 10 seconds: Feed scrolling duration
- 10 seconds: Between processing posts
- 3 seconds: Before closing tabs

## Troubleshooting

### Common Issues

1. **No posts found**: Make sure you're on LinkedIn feed and logged in
2. **Comments not posting**: Check if comment boxes are available (some posts may have comments disabled)
3. **API errors**: Verify your OpenRouter API key is correct and has credits
4. **Extension not working**: Check browser console for error messages

### LinkedIn Changes

LinkedIn frequently updates their UI. If the extension stops working:
- Check the console for selector errors
- The extension may need updates to match new LinkedIn class names

## Security & Privacy

- API key is stored locally in the extension
- No data is sent anywhere except to OpenRouter for comment generation
- Extension only accesses LinkedIn pages when actively running
- All processing happens locally in your browser

## Development

To modify the extension:

1. Edit source files in `src/`
2. Rebuild with `pnpm build`
3. Reload the extension in Chrome extensions page

Key files:
- `src/pages/popup/Popup.tsx`: User interface
- `src/pages/background/index.ts`: Main automation logic
- `src/pages/content/index.tsx`: LinkedIn page interaction
- `manifest.json`: Extension configuration

## Limitations

- Only works on LinkedIn
- Requires manual API key setup
- May break if LinkedIn updates their UI
- Rate limited by OpenRouter API limits
- Should be used responsibly to avoid spam

## Legal & Ethical Use

Please use this extension responsibly:
- Don't spam or post inappropriate content
- Respect LinkedIn's terms of service
- Use thoughtful style guides that add value
- Monitor the comments being posted
- Consider the impact on your professional reputation

## License

This project is for educational purposes. Use at your own risk and in compliance with LinkedIn's terms of service.
