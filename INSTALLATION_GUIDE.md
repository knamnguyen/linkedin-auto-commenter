# LinkedIn Auto Commenter - Installation Guide for Testing

## For the Extension Developer (You)

### Creating the Extension Package
1. Build your extension: `npm run build` or `pnpm build`
2. The built extension will be in the `dist_chrome/` folder
3. Create a zip file: `zip -r linkedin-auto-commenter-extension.zip dist_chrome/`
4. Share the `linkedin-auto-commenter-extension.zip` file with your friend

## For the Tester (Your Friend)

### How to Install the Extension for Testing

#### Step 1: Download and Extract
1. Download the `linkedin-auto-commenter-extension.zip` file
2. Extract/unzip the file to a folder on your computer
3. You should now have a `dist_chrome` folder

#### Step 2: Enable Developer Mode in Chrome
1. Open Google Chrome
2. Go to `chrome://extensions/` (type this in the address bar)
3. Turn ON "Developer mode" (toggle switch in the top right corner)

#### Step 3: Load the Extension
1. Click "Load unpacked" button (appears after enabling Developer mode)
2. Select the `dist_chrome` folder that you extracted
3. The extension should now appear in your extensions list

#### Step 4: Pin the Extension (Optional but Recommended)
1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Find "LinkedIn Auto Commenter" and click the pin icon next to it
3. The extension icon will now appear in your toolbar for easy access

### How to Use the Extension

#### Initial Setup
1. Click the extension icon in your Chrome toolbar
2. Click "Use Default API Key" to use the free Google AI Studio key
3. Click "Use Default Style" to use the pre-configured commenting style
4. Adjust other settings as needed (scroll duration, max posts, etc.)

#### Running the Extension
1. Navigate to [LinkedIn](https://www.linkedin.com/feed/)
2. Make sure you're logged into your LinkedIn account
3. Click the extension icon and click "Start Auto Commenting"
4. Choose between:
   - **Background mode**: Runs quietly in a pinned tab
   - **Spectator mode**: Watch the commenting process in real-time

#### Safety Features
- The extension has built-in delays between comments
- It respects LinkedIn's structure and doesn't spam
- You can stop the process at any time
- Comments are generated to sound natural and human-like

### Troubleshooting

#### If the Extension Doesn't Load
- Make sure you selected the `dist_chrome` folder, not the zip file
- Try refreshing the extensions page (`chrome://extensions/`)
- Check that Developer mode is enabled

#### If Comments Aren't Being Posted
- Ensure you're logged into LinkedIn
- Check that the API key is working (click "Use Default API Key")
- Try refreshing the LinkedIn page and restarting the extension

#### If You See Errors
- Check the extension's error details in the popup
- Try stopping and restarting the process
- Make sure LinkedIn's page has fully loaded before starting

### Important Notes
- ⚠️ **Use Responsibly**: This is a testing tool - monitor the comments being posted
- 🔄 The extension works directly on the LinkedIn feed page
- 📊 It tracks your comment count (daily and all-time)
- 🛑 You can stop the process anytime using the "Stop" button

### After Testing
Please provide feedback on:
- How well the extension works
- Quality of generated comments
- Any bugs or issues encountered
- Suggestions for improvements

---

**Need Help?** Contact the developer with any issues or questions! 