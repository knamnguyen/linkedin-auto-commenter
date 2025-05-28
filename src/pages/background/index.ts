import { GoogleGenAI } from "@google/genai";

console.log('background script loaded');

interface AutoCommentingState {
  isRunning: boolean;
  styleGuide: string;
  apiKey: string;
  scrollDuration: number;
  commentDelay: number;
  maxPosts: number;
  spectatorMode: boolean;
  commentCount: number;
  feedTabId?: number;
}

let autoCommentingState: AutoCommentingState = {
  isRunning: false,
  styleGuide: '',
  apiKey: '',
  scrollDuration: 10,
  commentDelay: 10,
  maxPosts: 20,
  spectatorMode: false,
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

// Main function to start auto-commenting with new flow
const startAutoCommenting = async (
  styleGuide: string, 
  apiKey: string, 
  scrollDuration: number,
  commentDelay: number,
  maxPosts: number,
  spectatorMode: boolean
): Promise<void> => {
  try {
    // Reset and initialize state
    autoCommentingState.styleGuide = styleGuide;
    autoCommentingState.apiKey = apiKey;
    autoCommentingState.scrollDuration = scrollDuration;
    autoCommentingState.commentDelay = commentDelay;
    autoCommentingState.maxPosts = maxPosts;
    autoCommentingState.spectatorMode = spectatorMode;
    autoCommentingState.isRunning = true;
    autoCommentingState.commentCount = 0;

    console.log(`Starting LinkedIn auto-commenting process in ${spectatorMode ? 'spectator' : 'background'} mode...`);
    sendStatusUpdate(`Starting LinkedIn auto-commenting in ${spectatorMode ? 'spectator' : 'background'} mode...`);

    // Open LinkedIn feed - active tab for spectator mode, pinned inactive for background mode
    const feedTab = await chrome.tabs.create({
      url: 'https://www.linkedin.com/feed/',
      active: spectatorMode, // Active only in spectator mode
      pinned: !spectatorMode // Pinned only in background mode
    });

    if (!feedTab.id) {
      throw new Error('Failed to create LinkedIn feed tab');
    }

    autoCommentingState.feedTabId = feedTab.id;
    sendStatusUpdate('Loading LinkedIn feed...');

    // Wait for feed to load
    await waitBackground(5000);

    // Start the new commenting flow
    sendStatusUpdate(`Scrolling feed for ${scrollDuration} seconds to load posts...`);
    
    // Send message to content script to start the new flow
    chrome.tabs.sendMessage(feedTab.id, {
      action: 'startNewCommentingFlow',
      scrollDuration: scrollDuration,
      commentDelay: commentDelay,
      maxPosts: maxPosts,
      spectatorMode: spectatorMode,
      styleGuide: styleGuide,
      apiKey: apiKey
    });

  } catch (error) {
    console.error('Error in auto-commenting process:', error);
    autoCommentingState.isRunning = false;
    sendStatusUpdate('Error occurred during auto-commenting', { isRunning: false });
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
      maxPosts: request.maxPosts,
      spectatorMode: request.spectatorMode
    });
    startAutoCommenting(
      request.styleGuide, 
      request.apiKey, 
      request.scrollDuration,
      request.commentDelay,
      request.maxPosts,
      request.spectatorMode
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
    
    // Clear current run state from storage
    chrome.storage.local.set({ 
      isRunning: false,
      currentCommentCount: 0
    });
    
    // Reset comment count
    autoCommentingState.commentCount = 0;
    
    sendStatusUpdate('Process stopped and reset', { isRunning: false });
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
    sendStatusUpdate(`Commenting completed! Check the counts above for total comments posted.`, { isRunning: false });
    sendResponse({ success: true });
  }
});

console.log('LinkedIn Auto Commenter background script loaded');