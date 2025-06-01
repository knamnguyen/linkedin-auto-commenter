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
  backgroundWindowId?: number;
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

// Function to get current window position for background window positioning
const getCurrentWindowInfo = async (): Promise<chrome.windows.Window | null> => {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    return currentWindow;
  } catch (error) {
    console.error('Error getting current window info:', error);
    return null;
  }
};

// Function to create a background window positioned behind the current window
const createBackgroundWindow = async (url: string): Promise<chrome.windows.Window | null> => {
  try {
    const currentWindow = await getCurrentWindowInfo();
    console.log('Current window info:', currentWindow);
    
    // Force new window creation with specific settings to prevent throttling
    let windowOptions: chrome.windows.CreateData = {
      url: url,
      type: 'popup', // Use popup to ensure it's a separate window
      focused: true, // Start with focus so user can see it
      width: 1200,
      height: 800,
      left: 100,
      top: 100
    };

    // If we have current window info, position the background window behind it
    if (currentWindow && currentWindow.left !== undefined && currentWindow.top !== undefined) {
      windowOptions = {
        ...windowOptions,
        // Position slightly offset from current window  
        left: (currentWindow.left || 0) + 50,
        top: (currentWindow.top || 0) + 50,
        width: Math.min(currentWindow.width || 1200, 1200),
        height: Math.min(currentWindow.height || 800, 800)
      };
    }

    console.log('Creating background window with options:', windowOptions);
    const backgroundWindow = await chrome.windows.create(windowOptions);
    console.log('Created window result:', backgroundWindow);
    console.log('Window ID:', backgroundWindow.id);
    console.log('Window tabs:', backgroundWindow.tabs);
    console.log('Window type:', backgroundWindow.type);
    console.log('Window state:', backgroundWindow.state);
    
    // Verify it's actually a separate window
    if (backgroundWindow.id) {
      const allWindows = await chrome.windows.getAll();
      console.log('Total windows after creation:', allWindows.length);
      console.log('All window IDs:', allWindows.map(w => w.id));
    }
    
    // Wait a moment for the window to be fully created
    await waitBackground(2000);
    
    // Don't immediately refocus the original window - let the new window stay focused
    // so the user can interact with it and see the start button
    console.log('New LinkedIn window should now be focused and visible');

    return backgroundWindow;
  } catch (error) {
    console.error('Error creating background window:', error);
    return null;
  }
};

// Function to cleanup background window
const cleanupBackgroundWindow = async (): Promise<void> => {
  if (autoCommentingState.backgroundWindowId) {
    try {
      await chrome.windows.remove(autoCommentingState.backgroundWindowId);
      console.log('Background window cleaned up successfully');
    } catch (error) {
      console.log('Background window may have already been closed:', error);
    }
    autoCommentingState.backgroundWindowId = undefined;
  }
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




  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a LinkedIn comment generator. Generate concise but engaging comments for LinkedIn posts. Style guide: ${autoCommentingState.styleGuide}. Keep comments professional yet conversational, under 100 words, and avoid generic responses. Generate a thoughtful comment for this LinkedIn post: ${postContent}`,
      config: {
        maxOutputTokens: 100,
        temperature: 0.7,
      },
    });

    const generatedComment = response.text || "Great post! Thanks for sharing.";

    
    // console.log(response.text);

    // const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${autoCommentingState.apiKey}`,
    //     'HTTP-Referer': 'https://linkedin-auto-commenter.com',
    //     'X-Title': 'LinkedIn Auto Commenter',
    //   },
    //   body: JSON.stringify({
    //     model: 'openai/gpt-4o-mini',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: `You are a LinkedIn comment generator. Generate concise but engaging comments for LinkedIn posts. Style guide: ${autoCommentingState.styleGuide}. Keep comments professional yet conversational, under 100 words, and avoid generic responses.`
    //       },
    //       {
    //         role: 'user',
    //         content: `Generate a thoughtful comment for this LinkedIn post: ${postContent}`
    //       }
    //     ],
    //     max_tokens: 150,
    //     temperature: 0.7
    //   })
    // });

    // console.log('Background: API response status:', response.status, response.statusText);

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   const errorDetails = {
    //     status: response.status,
    //     statusText: response.statusText,
    //     body: errorText,
    //     url: response.url,
    //     headers: Object.fromEntries(response.headers.entries())
    //   };
      
    //   console.error('Background: API request failed:', errorDetails);
      
    //   // Send error to content script via message
    //   try {
    //     chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    //       if (tabs[0]?.id) {
    //         chrome.tabs.sendMessage(tabs[0].id, {
    //       action: 'statusUpdate',
    //           error: errorDetails
    //         });
    //       }
    //     });
    //   } catch (msgError) {
    //     console.error('Background: Failed to send error to content script:', msgError);
    //   }
      
    //   throw new Error(`API request failed: ${response.status} - ${response.statusText}. Body: ${errorText}`);
    // }

    // const data = await response.json();
    // console.log('Background: API response data keys:', Object.keys(data));
    
    // if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    //   const errorDetails = {
    //     message: 'Invalid API response structure',
    //     data: data
    //   };
    //   console.error('Background: Invalid API response:', errorDetails);
      
    //   // Send error to content script via message
    //   try {
    //     chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    //       if (tabs[0]?.id) {
    //         chrome.tabs.sendMessage(tabs[0].id, {
    //           action: 'statusUpdate',
    //           error: errorDetails
    //         });
    //       }
    //     });
    //   } catch (msgError) {
    //     console.error('Background: Failed to send error to content script:', msgError);
    //   }
      
    //   throw new Error('Invalid API response structure');
    // }
    
    // const generatedComment = data.choices[0]?.message?.content || '';
    // if (!generatedComment.trim()) {
    //   throw new Error('API returned empty comment');
    // }
    
    // console.log('Background: Successfully generated comment:', generatedComment.substring(0, 100) + '...');
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

    let feedTab: chrome.tabs.Tab | undefined;

    // Background mode: Create dedicated background window
    console.log('Creating background window for automation...');
    sendStatusUpdate('Creating background window for LinkedIn automation...');
    
    const backgroundWindow = await createBackgroundWindow('https://www.linkedin.com/feed/');
    
    if (!backgroundWindow || !backgroundWindow.tabs || !backgroundWindow.tabs[0]) {
      throw new Error('Failed to create background window or get its tab');
    }

    autoCommentingState.backgroundWindowId = backgroundWindow.id;
    feedTab = backgroundWindow.tabs[0];
    
    console.log(`Background window created with ID: ${backgroundWindow.id}, tab ID: ${feedTab.id}`);
    sendStatusUpdate('Background window created successfully. LinkedIn automation running in background...');

    if (!feedTab || !feedTab.id) {
      throw new Error('Failed to create LinkedIn feed tab');
    }

    autoCommentingState.feedTabId = feedTab.id;
    sendStatusUpdate('Loading LinkedIn feed...');

    // Wait for feed to load
    await waitBackground(5000);

    // Send message to content script to show the start button
    sendStatusUpdate('LinkedIn feed loaded. Showing start button...');
    chrome.tabs.sendMessage(feedTab.id, {
      action: 'showStartButton'
    });

    // Note: The actual automation will start when user clicks the start button
    // The 'startNewCommentingFlow' will be triggered from the content script
    console.log('Start button should now be visible in the LinkedIn tab');

    // Remove the automatic start since we now wait for user interaction
    // Start the commenting flow
    // sendStatusUpdate(`Scrolling feed for ${scrollDuration} seconds to load posts...`);
    
    // Send message to content script to start the automation
    // chrome.tabs.sendMessage(feedTab.id, {
    //   action: 'startNewCommentingFlow',
    //   scrollDuration: scrollDuration,
    //   commentDelay: commentDelay,
    //   maxPosts: maxPosts,
    //   styleGuide: styleGuide,
    //   apiKey: apiKey
    // });

  } catch (error) {
    console.error('Error in auto-commenting process:', error);
    autoCommentingState.isRunning = false;
    await cleanupBackgroundWindow(); // Clean up on error
    sendStatusUpdate('Error occurred during auto-commenting setup', { isRunning: false });
  }
};

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startAutoCommenting') {
    // Also save the current settings to storage for persistence
    chrome.storage.local.set({
      apiKey: request.apiKey,
      styleGuide: request.styleGuide,
      scrollDuration: request.scrollDuration,
      commentDelay: request.commentDelay,
      maxPosts: request.maxPosts
    });
    startAutoCommenting(
      request.styleGuide, 
      request.apiKey, 
      request.scrollDuration,
      request.commentDelay,
      request.maxPosts
    );
    sendResponse({ success: true });
  } else if (request.action === 'stopAutoCommenting') {
    // Stop the commenting process immediately
    autoCommentingState.isRunning = false;
    
    // Send stop message to content script immediately
    if (autoCommentingState.feedTabId) {
      chrome.tabs.sendMessage(autoCommentingState.feedTabId, {
        action: 'stopCommentingFlow'
      });
    }
    
    // Clean up background window
    cleanupBackgroundWindow().then(() => {
      console.log('Background window cleanup completed');
    });
    
    // Clear current run state from storage
    chrome.storage.local.set({ 
      isRunning: false,
      currentCommentCount: 0
    });
    
    // Reset comment count
    autoCommentingState.commentCount = 0;
    
    sendStatusUpdate('Process stopped and background window closed', { isRunning: false });
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
    
    // Clean up background window when automation completes
    cleanupBackgroundWindow().then(() => {
      console.log('Automation completed - background window cleaned up');
    });
    
    sendStatusUpdate(`Commenting completed! Background window closed. Check the counts above for total comments posted.`, { isRunning: false });
    sendResponse({ success: true });
  } else if (request.action === 'heartbeat') {
    // Handle keep-alive heartbeat from content script
    sendResponse({ alive: true, timestamp: Date.now() });
  } else if (request.action === 'moveToBackground') {
    // Handle request to move window to background
    console.log('Content script requested to move window to background');
    
    const moveWindowToBackground = async () => {
      if (autoCommentingState.backgroundWindowId) {
        try {
          console.log('Step 1: Getting all windows...');
          const allWindows = await chrome.windows.getAll({ populate: false });
          
          // Find windows that aren't our background window
          const otherWindows = allWindows.filter(w => 
            w.id !== autoCommentingState.backgroundWindowId && 
            w.type === 'normal' &&
            w.state !== 'minimized'
          );
          
          console.log(`Found ${otherWindows.length} other windows to focus`);
          
          // Step 2: Focus another window or create one if none exist
          if (otherWindows.length > 0) {
            const targetWindow = otherWindows[0];
            if (targetWindow.id) {
              console.log(`Step 2: Focusing existing window ID ${targetWindow.id}...`);
              await chrome.windows.update(targetWindow.id, { focused: true });
            }
          } else {
            // No other windows, create a temporary one to take focus
            console.log('Step 2: No other windows found, creating temporary window...');
            const tempWindow = await chrome.windows.create({
              url: 'about:blank',
              width: 400,
              height: 300,
              focused: true,
              type: 'popup'
            });
            console.log(`Created temporary window ID ${tempWindow.id} to take focus`);
          }
          
          // Wait for the focus change to take effect
          await waitBackground(2000);
          
          // Step 3: Set our LinkedIn window to background
          console.log('Step 3: Setting LinkedIn window to background...');
          await chrome.windows.update(autoCommentingState.backgroundWindowId, { 
            focused: false
          });
          
          console.log('✅ Successfully moved LinkedIn window to background');
          sendResponse({ success: true });
          
        } catch (error) {
          console.error('❌ Error moving window to background:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendResponse({ success: false, error: errorMessage });
        }
      } else {
        sendResponse({ success: false, error: 'No background window ID found' });
      }
    };
    
    // Execute the async function
    moveWindowToBackground();
    
    return true; // Indicates we will send a response asynchronously
  }
});

// Handle background window being manually closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (autoCommentingState.backgroundWindowId === windowId) {
    console.log('Background window was manually closed');
    autoCommentingState.backgroundWindowId = undefined;
    
    // Stop the automation if it's running
    if (autoCommentingState.isRunning) {
      autoCommentingState.isRunning = false;
      
      // Send stop message to content script if possible
      if (autoCommentingState.feedTabId) {
        chrome.tabs.sendMessage(autoCommentingState.feedTabId, {
          action: 'stopCommentingFlow'
        }).catch(() => {
          // Tab might already be gone, that's okay
        });
      }
      
      // Clear current run state from storage
      chrome.storage.local.set({ 
        isRunning: false,
        currentCommentCount: 0
      });
      
      // Reset comment count
      autoCommentingState.commentCount = 0;
      
      sendStatusUpdate('Background window was closed - automation stopped', { isRunning: false });
    }
  }
});

console.log('LinkedIn Auto Commenter background script loaded');