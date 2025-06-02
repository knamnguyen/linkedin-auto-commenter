import { GoogleGenAI } from "@google/genai";

console.log('background script loaded');

interface AutoCommentingState {
  isRunning: boolean;
  styleGuide: string;
  apiKey: string;
  scrollDuration: number;
  commentDelay: number;
  maxPosts: number;
  commentCount: number;
  feedTabId?: number;
  originalTabId?: number;
}

let autoCommentingState: AutoCommentingState = {
  isRunning: false,
  styleGuide: '',
  apiKey: '',
  scrollDuration: 10,
  commentDelay: 10,
  maxPosts: 20,
  commentCount: 0
};

// Utility function to wait for a specified time
const waitBackground = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};


// Function to send status updates to popup
const sendStatusUpdate = (status: string, updates: Partial<AutoCommentingState> = {}) => {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status,
      commentCount: autoCommentingState.commentCount,
      isRunning: autoCommentingState.isRunning,
      ...updates
    });
    
    // Also save state to storage for persistence
    chrome.storage.local.set({
      isRunning: autoCommentingState.isRunning,
      currentCommentCount: autoCommentingState.commentCount
    });
  } catch (error) {
    console.error('Error sending status update:', error);
  }
};

// Function to update today's comment count
const updateTodayComments = (newCount: number) => {
  const today = new Date().toDateString();
  const storageKey = `comments_today_${today}`;
  
  chrome.storage.local.get([storageKey], (result) => {
    const currentTodayCount = result[storageKey] || 0;
    const updatedTodayCount = currentTodayCount + newCount;
    chrome.storage.local.set({ [storageKey]: updatedTodayCount });
    
    // Send updated today total to popup
    try {
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        newTodayTotal: updatedTodayCount
      });
    } catch (error) {
      console.error('Error sending today total update:', error);
    }
  });
};

// Function to generate comment using AI
const generateCommentBackground = async (postContent: string): Promise<string> => {
  console.log('Background: Starting comment generation for content length:', postContent?.length || 0);

  const ai = new GoogleGenAI({ apiKey: autoCommentingState.apiKey });

  const systemPrompt = `
  You are a LinkedIn influencer commenting on a post. 
  
  Generate concise but engaging comments for a single LinkedIn. 

  Super Importantly, ONLY REPSOND WITH THE COMMENT. DO NOT REPLY WITH ANYTHING ELSE LIKE QUOTATIONS OR ANYTHING ELSE.
  
  You must ahere to the style guide: ${autoCommentingState.styleGuide}. 
  
  Importantly, ahere strictly to the following additional rules:
  - Keep comments professional yet conversational
  - under 100 words
  - avoid generic responses.

  Super Importantly, ONLY REPSOND WITH THE COMMENT. DO NOT REPLY WITH ANYTHING ELSE LIKE QUOTATIONS OR ANYTHING ELSE.

  Generate a thoughtful comment for this LinkedIn post: ${postContent}

  Super Importantly, ONLY REPSOND WITH THE COMMENT. DO NOT REPLY WITH ANYTHING ELSE LIKE QUOTATIONS OR ANYTHING ELSE.

  `

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: systemPrompt,
      config: {
        maxOutputTokens: 100,
        temperature: 0.7,
      },
    });

    const generatedComment = response.text || "Great post! Thanks for sharing.";
    
    console.log('Background: Successfully generated comment:', generatedComment.substring(0, 100) + '...');
    return generatedComment;
    
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      apiKey: autoCommentingState.apiKey ? 'Present' : 'Missing',
      styleGuide: autoCommentingState.styleGuide ? 'Present' : 'Missing',
      postContentLength: postContent ? postContent.length : 0,
      timestamp: new Date().toISOString()
    };
    
    console.error('Background: Error generating comment:', errorDetails);
    
    // Send detailed error to content script via message
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
          action: 'statusUpdate',
            error: errorDetails
          });
        }
      });
    } catch (msgError) {
      console.error('Background: Failed to send error message to content script:', msgError);
    }
    
    // Re-throw the error so it can be caught by the promise handler
    throw error;
  }
};

// Main function to start auto-commenting with background window support
const startAutoCommenting = async (
  styleGuide: string, 
  apiKey: string, 
  scrollDuration: number,
  commentDelay: number,
  maxPosts: number
): Promise<void> => {
  try {
    // Reset and initialize state
    autoCommentingState.styleGuide = styleGuide;
    autoCommentingState.apiKey = apiKey;
    autoCommentingState.scrollDuration = scrollDuration;
    autoCommentingState.commentDelay = commentDelay;
    autoCommentingState.maxPosts = maxPosts;
    autoCommentingState.isRunning = true;
    autoCommentingState.commentCount = 0;

    console.log(`Starting LinkedIn auto-commenting process...`);
    sendStatusUpdate(`Starting LinkedIn auto-commenting...`);

    // Get the current active tab to remember as the original tab
    const currentTabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (currentTabs.length > 0 && currentTabs[0].id) {
      autoCommentingState.originalTabId = currentTabs[0].id;
      console.log(`Captured original tab ID: ${autoCommentingState.originalTabId}`);
    }

    let feedTab: chrome.tabs.Tab | undefined;

    // Create LinkedIn tab in current window instead of new background window
    console.log('Creating LinkedIn tab in current window...');
    sendStatusUpdate('Creating LinkedIn tab for automation...');
    
    feedTab = await chrome.tabs.create({
      url: 'https://www.linkedin.com/feed/',
      active: true, // Start with focus so user can see it
      pinned: true  // Pin the tab to provide exemption from throttling
    });
    
    if (!feedTab || !feedTab.id) {
      throw new Error('Failed to create LinkedIn feed tab');
    }

    autoCommentingState.feedTabId = feedTab.id;
    console.log(`LinkedIn tab created with ID: ${feedTab.id}`);
    console.log(`LinkedIn tab pinned status: ${feedTab.pinned}`);
    sendStatusUpdate('LinkedIn tab created successfully as pinned tab (anti-throttling)...');

    sendStatusUpdate('Waiting for LinkedIn page to load...');

    // Don't show start button immediately - wait for content script to signal ready
    // The content script will send 'pageReady' when DOM is loaded and LinkedIn feed is ready
    console.log('Waiting for content script to signal page ready...');


  } catch (error) {
    console.error('Error in auto-commenting process:', error);
    autoCommentingState.isRunning = false;
    // No need to cleanup background window since we're using tabs now
    sendStatusUpdate('Error occurred during auto-commenting setup', { isRunning: false });
  }
};

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'backgroundLog') {
    // Handle logging from content script to background console
    const timestamp = new Date().toLocaleTimeString();
    const tabInfo = sender.tab ? `[Tab ${sender.tab.id}]` : '[Unknown Tab]';
    
    switch (request.level) {
      case 'error':
        console.error(`${timestamp} ${tabInfo} CONTENT:`, ...request.args);
        break;
      case 'warn':
        console.warn(`${timestamp} ${tabInfo} CONTENT:`, ...request.args);
        break;
      case 'group':
        console.group(`${timestamp} ${tabInfo} CONTENT:`, ...request.args);
        break;
      case 'groupEnd':
        console.groupEnd();
        break;
      default:
        console.log(`${timestamp} ${tabInfo} CONTENT:`, ...request.args);
        break;
    }
    
    sendResponse({ success: true });
  } else if (request.action === 'startAutoCommenting') {
    console.log('Background: Received startAutoCommenting with settings:', {
      scrollDuration: request.scrollDuration,
      commentDelay: request.commentDelay,
      maxPosts: request.maxPosts,
      styleGuide: request.styleGuide?.substring(0, 50) + '...',
      hasApiKey: !!request.apiKey
    });
    
    // Also save the current settings to storage for persistence
    const settingsToSave = {
      apiKey: request.apiKey,
      styleGuide: request.styleGuide,
      scrollDuration: request.scrollDuration,
      commentDelay: request.commentDelay,
      maxPosts: request.maxPosts
    };
    
    console.log('Background: Saving settings to storage:', settingsToSave);
    chrome.storage.local.set(settingsToSave);
    
    startAutoCommenting(
      request.styleGuide, 
      request.apiKey, 
      request.scrollDuration,
      request.commentDelay,
      request.maxPosts
    );
    sendResponse({ success: true });
  } else if (request.action === 'stopAutoCommenting') {
    console.log('Background: Received stopAutoCommenting request');
    // Stop the commenting process immediately
    autoCommentingState.isRunning = false;
    
    // Send stop message to content script immediately
    if (autoCommentingState.feedTabId) {
      chrome.tabs.sendMessage(autoCommentingState.feedTabId, {
        action: 'stopCommentingFlow'
      });
      
      // Close the LinkedIn tab
      chrome.tabs.remove(autoCommentingState.feedTabId).catch(() => {
        // Tab might already be closed, that's okay
      });
    }
    
    // Clear current run state from storage
    chrome.storage.local.set({ 
      isRunning: false,
      currentCommentCount: 0
    });
    
    // Reset comment count
    autoCommentingState.commentCount = 0;
    
    // Clear original tab reference
    autoCommentingState.originalTabId = undefined;
    
    sendStatusUpdate('Process stopped and LinkedIn tab closed', { isRunning: false });
    sendResponse({ success: true });
  } else if (request.action === 'generateComment') {
    // Handle comment generation requests from content script
    console.log('Background: Received comment generation request for content:', request.postContent?.substring(0, 100) + '...');
    
    generateCommentBackground(request.postContent).then(comment => {
      console.log('Background: Sending comment response:', comment.substring(0, 100) + '...');
      sendResponse({ comment });
    }).catch(error => {
      console.error('Background: Error in comment generation promise:', error);
      
      // Create detailed error object for content script
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        apiKey: autoCommentingState.apiKey ? 'Present' : 'Missing',
        styleGuide: autoCommentingState.styleGuide ? 'Present' : 'Missing',
        postContentLength: request.postContent ? request.postContent.length : 0,
        timestamp: new Date().toISOString(),
        type: 'openrouter_api_error'
      };

      // Send error details to content script
      if (autoCommentingState.feedTabId) {
        chrome.tabs.sendMessage(autoCommentingState.feedTabId, {
          action: 'openrouter_error',
          error: errorDetails
        }).catch(msgError => {
          console.error('Background: Failed to send error to content script:', msgError);
        });
      }
      
      console.error('Background: Sending fallback comment due to error');
      sendResponse({ 
        comment: 'Great post! Thanks for sharing.',
        error: errorDetails
      });
    });
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === 'updateCommentCount') {
    // Handle comment count updates from content script
    autoCommentingState.commentCount = request.count;
    sendStatusUpdate(request.status || `Processed ${request.count} comments`, { commentCount: request.count });
    sendResponse({ success: true });
  } else if (request.action === 'commentingCompleted') {
    // Handle completion notification from content script
    autoCommentingState.isRunning = false;
    
    // Close the LinkedIn tab when automation completes
    if (autoCommentingState.feedTabId) {
      chrome.tabs.remove(autoCommentingState.feedTabId).catch(() => {
        // Tab might already be closed, that's okay
        console.log('LinkedIn tab was already closed or could not be closed');
      });
    }
    
    // Clear original tab reference
    autoCommentingState.originalTabId = undefined;
    
    sendStatusUpdate(`Commenting completed! LinkedIn tab closed. Check the counts above for total comments posted.`, { isRunning: false });
    sendResponse({ success: true });
  }  else if (request.action === 'moveToOriginalTab') {
    // Handle request to move back to the original tab
    console.log('Background: Received request to move back to the original tab');
    
    if (autoCommentingState.originalTabId) {
      // Switch focus to the original tab
      chrome.tabs.update(autoCommentingState.originalTabId, { active: true })
        .then(() => {
          console.log(`✅ Successfully focused original tab ID: ${autoCommentingState.originalTabId}`);
          sendResponse({ success: true });
        })
    }
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === 'pageReady') {
    // Handle signal from content script that LinkedIn page is ready
    console.log('Content script signaled page ready - showing start button');
    sendStatusUpdate('LinkedIn feed loaded. Showing start button...');
    
    if (autoCommentingState.feedTabId) {
      chrome.tabs.sendMessage(autoCommentingState.feedTabId, {
        action: 'showStartButton'
      });
      console.log('Start button should now be visible in the LinkedIn tab');
    }
    
    sendResponse({ success: true });
  }
});

// Handle LinkedIn tab being manually closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (autoCommentingState.feedTabId === tabId) {
    console.log('LinkedIn tab was manually closed');
    autoCommentingState.feedTabId = undefined;
    
    // Stop the automation if it's running
    if (autoCommentingState.isRunning) {
      autoCommentingState.isRunning = false;
      
      // Clear current run state from storage
      chrome.storage.local.set({ 
        isRunning: false,
        currentCommentCount: 0
      });
      
      // Reset comment count
      autoCommentingState.commentCount = 0;
      
      // Clear original tab reference
      autoCommentingState.originalTabId = undefined;
      
      sendStatusUpdate('LinkedIn tab was closed - automation stopped', { isRunning: false });
    }
  }
});

console.log('LinkedIn Auto Commenter background script loaded');