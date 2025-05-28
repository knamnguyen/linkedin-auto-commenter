console.log('background script loaded');

interface AutoCommentingState {
  isRunning: boolean;
  postUrls: string[];
  currentIndex: number;
  styleGuide: string;
  apiKey: string;
  processingMode: 'sequential' | 'parallel';
  scrollDuration: number;
  batchDelay: number;
  sequentialDelay: number;
  spectatorMode: boolean;
  commentCount: number;
  currentBatch: number;
  totalBatches: number;
  feedTabId?: number;
}

let autoCommentingState: AutoCommentingState = {
  isRunning: false,
  postUrls: [],
  currentIndex: 0,
  styleGuide: '',
  apiKey: '',
  processingMode: 'sequential',
  scrollDuration: 10,
  batchDelay: 5,
  sequentialDelay: 10,
  spectatorMode: false,
  commentCount: 0,
  currentBatch: 0,
  totalBatches: 0
};

// Utility function to wait for a specified time
const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Function to send status updates to popup
const sendStatusUpdate = (status: string, updates: Partial<AutoCommentingState> = {}) => {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status,
      commentCount: autoCommentingState.commentCount,
      currentBatch: autoCommentingState.currentBatch,
      totalBatches: autoCommentingState.totalBatches,
      isRunning: autoCommentingState.isRunning,
      ...updates
    });
    
    // Also save state to storage for persistence
    chrome.storage.local.set({
      isRunning: autoCommentingState.isRunning,
      currentCommentCount: autoCommentingState.commentCount,
      currentBatch: autoCommentingState.currentBatch,
      totalBatches: autoCommentingState.totalBatches
    });
  } catch (error) {
    console.error('Error sending status update:', error);
  }
};

// Function to inject and execute a script in a tab
const executeScriptInTab = (tabId: number, func: (...args: any[]) => any, args?: any[]): Promise<any> => {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: func,
    args: args
  }).then(results => results[0]?.result);
};

// Function to scroll down the LinkedIn feed
const scrollFeedAndWait = async (): Promise<void> => {
  const scrollScript = (duration: number) => {
    let scrollCount = 0;
    const maxScrolls = Math.floor(duration * 2); // Scroll twice per second
    
    const scrollInterval = setInterval(() => {
      window.scrollTo(0, document.body.scrollHeight);
      scrollCount++;
      
      if (scrollCount >= maxScrolls) {
        clearInterval(scrollInterval);
      }
    }, 500); // Scroll every 500ms
  };

  if (autoCommentingState.feedTabId) {
    await executeScriptInTab(autoCommentingState.feedTabId, scrollScript, [autoCommentingState.scrollDuration]);
    await wait(autoCommentingState.scrollDuration * 1000); // Wait for specified duration
  }
};

// Function to extract post URLs from the feed
const extractPostUrls = async (): Promise<string[]> => {
  if (autoCommentingState.feedTabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(autoCommentingState.feedTabId!, { action: 'extractUrls' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error extracting URLs:', chrome.runtime.lastError);
          resolve([]);
        } else {
          resolve(response?.urls || []);
        }
      });
    });
  }
  return [];
};

// Function to extract post content via content script
const extractPostContentFromTab = async (tabId: number): Promise<string> => {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error extracting content:', chrome.runtime.lastError);
        resolve('');
      } else {
        resolve(response?.content || '');
      }
    });
  });
};

// Function to generate comment using AI
const generateComment = async (postContent: string): Promise<string> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${autoCommentingState.apiKey}`,
        'HTTP-Referer': 'https://linkedin-auto-commenter.com',
        'X-Title': 'LinkedIn Auto Commenter',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a LinkedIn comment generator. Generate concise but engaging comments for LinkedIn posts. Style guide: ${autoCommentingState.styleGuide}. Keep comments professional yet conversational, under 100 words, and avoid generic responses.`
          },
          {
            role: 'user',
            content: `Generate a thoughtful comment for this LinkedIn post: ${postContent}`
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Great post! Thanks for sharing.';
  } catch (error) {
    console.error('Error generating comment:', error);
    return 'Great post! Thanks for sharing.';
  }
};

// Function to post comment on a LinkedIn post via content script
const postCommentOnTab = async (tabId: number, comment: string): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'postComment', comment }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error posting comment:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(response?.success || false);
      }
    });
  });
};

// Function to process a single post
const processSinglePost = async (url: string): Promise<boolean> => {
  try {
    console.log(`Processing post: ${url}`);
    
    // Create new tab for the post
    const tab = await chrome.tabs.create({
      url: url,
      active: false, // Don't activate by default, spectator mode is handled in batch processing
      pinned: true
    });

    if (!tab.id) {
      console.error('Failed to create tab');
      return false;
    }

    // Wait for tab to load
    await wait(5000);

    // Check if we've already commented on this author today
    const duplicateCheck = await new Promise<{shouldSkip: boolean, authorName: string, reason?: string}>((resolve) => {
      if (!tab.id) {
        resolve({ shouldSkip: true, authorName: '', reason: 'Invalid tab ID' });
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, { action: 'checkAuthorDuplicate' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error checking author duplicate:', chrome.runtime.lastError);
          resolve({ shouldSkip: false, authorName: '' }); // Proceed if check fails
        } else {
          resolve(response || { shouldSkip: false, authorName: '' });
        }
      });
    });

    if (duplicateCheck.shouldSkip) {
      console.log(`Skipping post by ${duplicateCheck.authorName}: ${duplicateCheck.reason}`);
      await chrome.tabs.remove(tab.id);
      return false;
    }

    console.log(`Proceeding with post by ${duplicateCheck.authorName}`);

    // Extract post content
    const postContent = await extractPostContentFromTab(tab.id);
    if (!postContent) {
      console.log('No post content found, skipping...');
      await chrome.tabs.remove(tab.id);
      return false;
    }

    console.log('Post content extracted:', postContent.substring(0, 100) + '...');

    // Generate comment
    const comment = await generateComment(postContent);
    console.log('Generated comment:', comment);

    // Note: Spectator mode tab activation is handled in batch processing for parallel mode

    // Post comment
    const success = await postCommentOnTab(tab.id, comment);
    
    if (success) {
      console.log('Comment posted successfully');
      // Wait 5 seconds after posting to ensure it registers
      await wait(5000);
    } else {
      console.log('Failed to post comment');
    }

    // Wait before closing tab
    await wait(3000);

    // Close tab
    await chrome.tabs.remove(tab.id);

    return success;

  } catch (error) {
    console.error('Error processing post:', error);
    return false;
  }
};

// Function to process all posts sequentially
const processAllPostsSequentially = async (): Promise<void> => {
  for (let i = autoCommentingState.currentIndex; i < autoCommentingState.postUrls.length; i++) {
    if (!autoCommentingState.isRunning) {
      console.log('Auto-commenting stopped by user');
      break;
    }

    autoCommentingState.currentIndex = i;
    const url = autoCommentingState.postUrls[i];
    
    console.log(`Processing post ${i + 1}/${autoCommentingState.postUrls.length}`);
    sendStatusUpdate(`Processing post ${i + 1}/${autoCommentingState.postUrls.length}...`);
    
    const success = await processSinglePost(url);
    if (success) {
      autoCommentingState.commentCount++;
      sendStatusUpdate(`Comment posted on post ${i + 1}. Total: ${autoCommentingState.commentCount}`);
    }
    
    // Wait between posts using configured delay
    if (i < autoCommentingState.postUrls.length - 1) {
      sendStatusUpdate(`Waiting ${autoCommentingState.sequentialDelay} seconds before next post...`);
      await wait(autoCommentingState.sequentialDelay * 1000);
    }
  }

  // Update all-time total and reset state when done
  if (autoCommentingState.commentCount > 0) {
    chrome.storage.local.get(['totalAllTimeComments'], (result) => {
      const currentTotal = result.totalAllTimeComments || 0;
      const newTotal = currentTotal + autoCommentingState.commentCount;
      chrome.storage.local.set({ totalAllTimeComments: newTotal });
      
      // Send updated total to popup
      try {
        chrome.runtime.sendMessage({
          action: 'statusUpdate',
          status: `Sequential processing completed! Posted ${autoCommentingState.commentCount} comments.`,
          isRunning: false,
          newAllTimeTotal: newTotal
        });
      } catch (error) {
        console.error('Error sending all-time total update:', error);
      }
    });
  } else {
    // No comments posted, just send completion status
    sendStatusUpdate(`Sequential processing completed! Posted ${autoCommentingState.commentCount} comments.`, { isRunning: false });
  }
  
  autoCommentingState.isRunning = false;
  autoCommentingState.currentIndex = 0;
  console.log('Sequential auto-commenting completed');
};

// Function to wait for content to load in a tab
const waitForContentToLoad = async (tabId: number, maxWaitTime: number = 15000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const hasContent = await new Promise<boolean>((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'checkContentLoaded' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(response?.hasContent || false);
          }
        });
      });
      
      if (hasContent) {
        return true;
      }
      
      await wait(1000); // Check every second
    } catch (error) {
      console.error(`Error checking content load for tab ${tabId}:`, error);
    }
  }
  
  return false; // Timeout
};

// Function to process a batch of tabs
const processBatch = async (urls: string[], batchNumber: number, totalBatches: number): Promise<void> => {
  console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} with ${urls.length} tabs...`);
  console.log(`📋 Batch ${batchNumber} URLs:`, urls);
  
  autoCommentingState.currentBatch = batchNumber;
  sendStatusUpdate(`Processing batch ${batchNumber}/${totalBatches} with ${urls.length} tabs...`);
  
  // In spectator mode, we still batch but handle submission differently
  const isSpectatorMode = autoCommentingState.spectatorMode;
  
  // Create tabs for this batch (parallel mode, not spectator)
  const tabPromises = urls.map(async (url, index) => {
    try {
      const tab = await chrome.tabs.create({
        url: url,
        active: false,
        pinned: true
      });
      console.log(`Opened tab ${index + 1}/${urls.length} in batch ${batchNumber}: ${url}`);
      return { tab, url, batchIndex: index };
    } catch (error) {
      console.error(`Failed to create tab for ${url}:`, error);
      return null;
    }
  });

  const tabResults = await Promise.all(tabPromises);
  const validTabs = tabResults.filter(result => result !== null && result.tab.id);

  console.log(`Successfully opened ${validTabs.length} tabs in batch ${batchNumber}. Waiting for content to load...`);
  sendStatusUpdate(`Processing ${validTabs.length} tabs in batch ${batchNumber}...`);

  // First phase: Load content and generate comments for all tabs
  const tabsWithComments: Array<{
    tabResult: any;
    comment: string;
    postContent: string;
  }> = [];

  sendStatusUpdate(`Checking for author duplicates and loading content for ${validTabs.length} tabs...`);
  
  for (const tabResult of validTabs) {
    if (!autoCommentingState.isRunning || !tabResult?.tab.id) continue;

    try {
      console.log(`Waiting for content to load in tab ${tabResult.batchIndex + 1} of batch ${batchNumber}...`);
      
      // Wait for content to load with timeout
      const contentLoaded = await waitForContentToLoad(tabResult.tab.id);
      if (!contentLoaded) {
        console.log(`Content loading timeout for tab ${tabResult.batchIndex + 1} in batch ${batchNumber}, proceeding anyway...`);
      } else {
        console.log(`Content loaded for tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
      }

      // Check if we've already commented on this author today
      const duplicateCheck = await new Promise<{shouldSkip: boolean, authorName: string, reason?: string}>((resolve) => {
        if (!tabResult.tab.id) {
          resolve({ shouldSkip: true, authorName: '', reason: 'Invalid tab ID' });
          return;
        }
        
        chrome.tabs.sendMessage(tabResult.tab.id, { action: 'checkAuthorDuplicate' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error checking author duplicate:', chrome.runtime.lastError);
            resolve({ shouldSkip: false, authorName: '' }); // Proceed if check fails
          } else {
            resolve(response || { shouldSkip: false, authorName: '' });
          }
        });
      });

      if (duplicateCheck.shouldSkip) {
        console.log(`Skipping tab ${tabResult.batchIndex + 1} in batch ${batchNumber} - ${duplicateCheck.authorName}: ${duplicateCheck.reason}`);
        continue;
      }

      console.log(`Proceeding with tab ${tabResult.batchIndex + 1} in batch ${batchNumber} - author: ${duplicateCheck.authorName}`);

      // Extract post content
      const postContent = await extractPostContentFromTab(tabResult.tab.id);
      if (!postContent) {
        console.log(`No content found for tab ${tabResult.batchIndex + 1} in batch ${batchNumber}, skipping...`);
        continue;
      }

      console.log(`Content extracted from tab ${tabResult.batchIndex + 1} in batch ${batchNumber}:`, postContent.substring(0, 100) + '...');

      // Generate comment
      const comment = await generateComment(postContent);
      console.log(`Generated comment for tab ${tabResult.batchIndex + 1} in batch ${batchNumber}:`, comment);

      tabsWithComments.push({ tabResult, comment, postContent });

    } catch (error) {
      console.error(`Error preparing tab ${tabResult.batchIndex + 1} in batch ${batchNumber}:`, error);
    }
  }

  console.log(`Prepared ${tabsWithComments.length} tabs with comments in batch ${batchNumber}`);
  sendStatusUpdate(`Generated ${tabsWithComments.length} comments. ${isSpectatorMode ? 'Starting spectator review...' : 'Posting comments...'}`);

  // Second phase: Post comments (different behavior for spectator vs normal mode)
  const results: boolean[] = [];
  
  if (isSpectatorMode) {
    // Spectator mode: Go through each tab sequentially for user to watch
    for (let i = 0; i < tabsWithComments.length; i++) {
      if (!autoCommentingState.isRunning) break;
      
      const { tabResult, comment } = tabsWithComments[i];
      
      sendStatusUpdate(`Spectator mode: Review comment ${i + 1}/${tabsWithComments.length} in batch ${batchNumber}`);
      
      try {
        // Activate tab for user to see
        await chrome.tabs.update(tabResult.tab.id, { active: true });
        await wait(2000); // Give user time to see the page
        
        // Post comment
        const success = await postCommentOnTab(tabResult.tab.id, comment);
        
        if (success) {
          console.log(`Comment posted successfully on tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
          // Wait 5 seconds after posting to ensure it registers
          await wait(5000);
          // Give user time to see the posted comment
          await wait(3000);
          results.push(true);
        } else {
          console.log(`Failed to post comment on tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
          results.push(false);
        }
      } catch (error) {
        console.error(`Error in spectator mode for tab ${tabResult.batchIndex + 1}:`, error);
        results.push(false);
      }
    }
  } else {
    // Normal parallel mode: Post all comments simultaneously
    const processingPromises = tabsWithComments.map(async ({ tabResult, comment }) => {
      try {
        const success = await postCommentOnTab(tabResult.tab.id, comment);
        
        if (success) {
          console.log(`Comment posted successfully on tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
          // Wait 5 seconds after posting to ensure it registers
          await wait(5000);
          return true;
        } else {
          console.log(`Failed to post comment on tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
          return false;
        }
      } catch (error) {
        console.error(`Error processing tab ${tabResult.batchIndex + 1} in batch ${batchNumber}:`, error);
        return false;
      }
    });
    
    results.push(...await Promise.all(processingPromises));
  }

  // Clean up: Close all tabs
  for (const { tabResult } of tabsWithComments) {
    if (tabResult.tab.id) {
      try {
        await chrome.tabs.remove(tabResult.tab.id);
        console.log(`Closed tab ${tabResult.batchIndex + 1} in batch ${batchNumber}`);
      } catch (error) {
        console.error(`Error closing tab ${tabResult.tab.id}:`, error);
      }
    }
  }

  const successCount = results.filter(result => result === true).length;
  
  autoCommentingState.commentCount += successCount;
  console.log(`Completed batch ${batchNumber}/${totalBatches}, posted ${successCount} comments`);
  sendStatusUpdate(`Batch ${batchNumber} completed! Posted ${successCount} comments. Total: ${autoCommentingState.commentCount}`);
  
  // Wait between batches using configured delay
  if (batchNumber < totalBatches) {
    console.log(`Waiting ${autoCommentingState.batchDelay} seconds before starting next batch...`);
    sendStatusUpdate(`Waiting ${autoCommentingState.batchDelay} seconds before next batch...`);
    await wait(autoCommentingState.batchDelay * 1000);
  }
};

// Function to process all posts in parallel (with batching)
const processAllPostsParallel = async (): Promise<void> => {
  const batchSize = 5;
  const totalUrls = autoCommentingState.postUrls.length;
  const totalBatches = Math.ceil(totalUrls / batchSize);
  
  console.log(`🚀 PARALLEL MODE: Processing ${totalUrls} posts in ${totalBatches} batches of max ${batchSize} tabs each...`);
  
  for (let i = 0; i < totalBatches; i++) {
    if (!autoCommentingState.isRunning) {
      console.log('Auto-commenting stopped by user');
      break;
    }
    
    const startIndex = i * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalUrls);
    const batchUrls = autoCommentingState.postUrls.slice(startIndex, endIndex);
    
    console.log(`📦 Starting batch ${i + 1}/${totalBatches} with URLs:`, batchUrls.map((url, idx) => `${idx + 1}. ${url.substring(url.lastIndexOf('/') + 1)}`));
    
    await processBatch(batchUrls, i + 1, totalBatches);
    
    console.log(`✅ Completed batch ${i + 1}/${totalBatches}`);
  }

  // Update all-time total and reset state when done
  if (autoCommentingState.commentCount > 0) {
    chrome.storage.local.get(['totalAllTimeComments'], (result) => {
      const currentTotal = result.totalAllTimeComments || 0;
      const newTotal = currentTotal + autoCommentingState.commentCount;
      chrome.storage.local.set({ totalAllTimeComments: newTotal });
      
      // Send updated total to popup
      try {
        chrome.runtime.sendMessage({
          action: 'statusUpdate',
          status: `Parallel processing completed! Posted ${autoCommentingState.commentCount} comments total.`,
          isRunning: false,
          newAllTimeTotal: newTotal
        });
      } catch (error) {
        console.error('Error sending all-time total update:', error);
      }
    });
  } else {
    // No comments posted, just send completion status
    sendStatusUpdate(`Parallel processing completed! Posted ${autoCommentingState.commentCount} comments total.`, { isRunning: false });
  }
  
  autoCommentingState.isRunning = false;
  autoCommentingState.currentIndex = 0;
  console.log('🎉 Parallel auto-commenting completed');
};

// Main function to start auto-commenting
const startAutoCommenting = async (
  styleGuide: string, 
  apiKey: string, 
  processingMode: 'sequential' | 'parallel', 
  scrollDuration: number,
  batchDelay: number,
  sequentialDelay: number,
  spectatorMode: boolean
): Promise<void> => {
  try {
    // Reset and initialize state
    autoCommentingState.styleGuide = styleGuide;
    autoCommentingState.apiKey = apiKey;
    autoCommentingState.processingMode = processingMode;
    autoCommentingState.scrollDuration = scrollDuration;
    autoCommentingState.batchDelay = batchDelay;
    autoCommentingState.sequentialDelay = sequentialDelay;
    autoCommentingState.spectatorMode = spectatorMode;
    autoCommentingState.isRunning = true;
    autoCommentingState.commentCount = 0;
    autoCommentingState.currentBatch = 0;
    autoCommentingState.totalBatches = 0;
    autoCommentingState.postUrls = [];

    console.log(`Starting LinkedIn auto-commenting process in ${processingMode} mode...`);
    sendStatusUpdate(`Starting LinkedIn auto-commenting in ${processingMode} mode...`);

    // Open LinkedIn feed in inactive, pinned tab
    const feedTab = await chrome.tabs.create({
      url: 'https://www.linkedin.com/feed/',
      active: false,
      pinned: true
    });

    if (!feedTab.id) {
      throw new Error('Failed to create LinkedIn feed tab');
    }

    autoCommentingState.feedTabId = feedTab.id;
    sendStatusUpdate('Loading LinkedIn feed...');

    // Wait for feed to load
    await wait(5000);

    // Scroll down to load more posts
    sendStatusUpdate(`Scrolling feed for ${scrollDuration} seconds to load posts...`);
    await scrollFeedAndWait();

    // Extract post URLs
    sendStatusUpdate('Extracting post URLs...');
    const postUrls = await extractPostUrls();
    autoCommentingState.postUrls = postUrls;

    console.log(`Found ${postUrls.length} posts to process using ${processingMode} mode`);
    sendStatusUpdate(`Found ${postUrls.length} posts to process`);

    // Close feed tab
    await chrome.tabs.remove(feedTab.id);

    if (postUrls.length === 0) {
      console.log('No posts found to comment on');
      autoCommentingState.isRunning = false;
      sendStatusUpdate('No posts found to comment on', { isRunning: false });
      return;
    }

    // Calculate total batches for parallel mode
    if (processingMode === 'parallel') {
      autoCommentingState.totalBatches = Math.ceil(postUrls.length / 5);
      sendStatusUpdate(`Starting ${autoCommentingState.totalBatches} batches of processing...`);
    }

    // Process all posts based on selected mode
    if (processingMode === 'sequential') {
      await processAllPostsSequentially();
    } else {
      await processAllPostsParallel();
    }

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
      processingMode: request.processingMode,
      scrollDuration: request.scrollDuration,
      batchDelay: request.batchDelay,
      sequentialDelay: request.sequentialDelay,
      spectatorMode: request.spectatorMode
    });
    startAutoCommenting(
      request.styleGuide, 
      request.apiKey, 
      request.processingMode, 
      request.scrollDuration,
      request.batchDelay,
      request.sequentialDelay,
      request.spectatorMode
    );
    sendResponse({ success: true });
  } else if (request.action === 'stopAutoCommenting') {
    // Update all-time total before stopping if there are comments
    if (autoCommentingState.commentCount > 0) {
      chrome.storage.local.get(['totalAllTimeComments'], (result) => {
        const currentTotal = result.totalAllTimeComments || 0;
        const newTotal = currentTotal + autoCommentingState.commentCount;
        chrome.storage.local.set({ totalAllTimeComments: newTotal });
        
        // Send updated total to popup
        try {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: 'Process stopped and reset',
            isRunning: false,
            newAllTimeTotal: newTotal
          });
        } catch (error) {
          console.error('Error sending all-time total update:', error);
        }
      });
    }
    
    autoCommentingState.isRunning = false;
    autoCommentingState.postUrls = [];
    autoCommentingState.commentCount = 0;
    autoCommentingState.currentBatch = 0;
    autoCommentingState.totalBatches = 0;
    
    // Clear current run state from storage
    chrome.storage.local.set({ 
      isRunning: false,
      currentCommentCount: 0,
      currentBatch: 0,
      totalBatches: 0
    });
    
    sendStatusUpdate('Process stopped and reset', { isRunning: false });
    sendResponse({ success: true });
  }
});

console.log('LinkedIn Auto Commenter background script loaded');
