try {
  console.log('content script loaded');
} catch (e) {
  console.error(e);
}

// Content script for LinkedIn Auto Commenter - New Single Mode
// This script processes posts directly on the feed page

let isCommentingActive = false;
let commentedAuthors = new Set<string>();
let currentSpectatorMode = false;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startNewCommentingFlow') {
    startNewCommentingFlow(
      request.scrollDuration, 
      request.commentDelay, 
      request.maxPosts, 
      request.spectatorMode,
      request.styleGuide, 
      request.apiKey
    );
    sendResponse({ success: true });
  } else if (request.action === 'stopCommentingFlow') {
    console.log('Received stop signal - stopping commenting flow');
    isCommentingActive = false;
    sendResponse({ success: true });
  } else if (request.action === 'openrouter_error') {
    // Handle OpenRouter API errors specifically
    console.group('🚨 OPENROUTER API ERROR - WHY FALLBACK COMMENT WAS USED');
    console.error('🔥 OpenRouter API Error Message:', request.error.message);
    console.error('🔥 Error Type:', request.error.name);
    console.error('🔥 API Key Status:', request.error.apiKey);
    console.error('🔥 Style Guide Status:', request.error.styleGuide);
    console.error('🔥 Post Content Length:', request.error.postContentLength, 'characters');
    console.error('🔥 Timestamp:', request.error.timestamp);
    if (request.error.stack) {
      console.error('🔥 Stack Trace:', request.error.stack);
    }
    console.error('🔥 This is why the comment defaulted to "Great post! Thanks for sharing."');
    console.groupEnd();
    
    // Create a prominent visual alert
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      border: 3px solid #fff;
      padding: 20px;
      border-radius: 12px;
      z-index: 99999;
      max-width: 500px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      text-align: center;
    `;
    errorDiv.innerHTML = `
      <div style="font-weight: bold; font-size: 18px; margin-bottom: 12px;">
        🚨 OpenRouter API Error Detected
      </div>
      <div style="margin-bottom: 10px; font-size: 16px;">
        ${request.error.message}
      </div>
      <div style="font-size: 12px; margin-bottom: 15px; opacity: 0.9;">
        This is why the comment defaulted to "Great post! Thanks for sharing."
      </div>
      <div style="font-size: 12px; margin-bottom: 15px; opacity: 0.9;">
        API Key: ${request.error.apiKey} | Content Length: ${request.error.postContentLength} chars
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: white;
        color: #ff4444;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
      ">Close & Check Console</button>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 15000);
  } else if (request.action === 'statusUpdate' && request.error) {
    // Log error details to the website console for debugging
    console.group('🚨 LinkedIn Auto Commenter Error Details');
    console.error('Error Message:', request.error.message);
    if (request.error.status) {
      console.error('HTTP Status:', request.error.status, '-', request.error.statusText);
    }
    if (request.error.body) {
      console.error('API Response Body:', request.error.body);
    }
    if (request.error.headers) {
      console.error('Response Headers:', request.error.headers);
    }
    console.error('API Key Status:', request.error.apiKey || 'Unknown');
    console.error('Style Guide Status:', request.error.styleGuide || 'Unknown');
    if (request.error.postContentLength !== undefined) {
      console.error('Post Content Length:', request.error.postContentLength, 'characters');
    }
    if (request.error.stack) {
      console.error('Stack Trace:', request.error.stack);
    }
    if (request.error.data) {
      console.error('Additional Data:', request.error.data);
    }
    console.groupEnd();
    
    // Also create a visual alert in the page
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fee;
      border: 2px solid #f00;
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 400px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    errorDiv.innerHTML = `
      <div style="font-weight: bold; color: #d00; margin-bottom: 8px;">
        🚨 LinkedIn Auto Commenter Error
      </div>
      <div style="color: #800; margin-bottom: 5px;">
        ${request.error.message || 'Unknown error occurred'}
      </div>
      ${request.error.status ? `<div style="color: #600; font-size: 11px;">HTTP ${request.error.status}: ${request.error.statusText}</div>` : ''}
      <div style="color: #600; font-size: 11px; margin-top: 5px;">
        Check console for full details (F12)
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: #d00;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        margin-top: 8px;
      ">Close</button>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 10000);
  }
});

// Function to get today's date string
function getTodayDateString(): string {
  return new Date().toDateString();
}

// Function to load today's commented authors from local storage
async function loadTodayCommentedAuthors(): Promise<Set<string>> {
  const today = getTodayDateString();
  const storageKey = `commented_authors_${today}`;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      const todayAuthors = result[storageKey] || [];
      resolve(new Set(todayAuthors));
    });
  });
}

// Function to save commented author to local storage
async function saveCommentedAuthor(authorName: string): Promise<void> {
  const today = getTodayDateString();
  const storageKey = `commented_authors_${today}`;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      const todayAuthors = result[storageKey] || [];
      if (!todayAuthors.includes(authorName)) {
        todayAuthors.push(authorName);
        chrome.storage.local.set({ [storageKey]: todayAuthors }, () => {
          console.log(`Saved commented author: ${authorName} for ${today}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Function to update comment counts in local storage
async function updateCommentCounts(): Promise<void> {
  const today = getTodayDateString();
  const todayKey = `comments_today_${today}`;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([todayKey, 'totalAllTimeComments'], (result) => {
      const currentTodayCount = result[todayKey] || 0;
      const currentAllTimeCount = result['totalAllTimeComments'] || 0;
      
      const newTodayCount = currentTodayCount + 1;
      const newAllTimeCount = currentAllTimeCount + 1;
      
      chrome.storage.local.set({
        [todayKey]: newTodayCount,
        totalAllTimeComments: newAllTimeCount
      }, () => {
        console.log(`Updated counts - Today: ${newTodayCount}, All-time: ${newAllTimeCount}`);
        
        // Send real-time update to popup
        chrome.runtime.sendMessage({
          action: 'realTimeCountUpdate',
          todayCount: newTodayCount,
          allTimeCount: newAllTimeCount
        });
        
        resolve();
      });
    });
  });
}

// Main function to start the new commenting flow
async function startNewCommentingFlow(
  scrollDuration: number, 
  commentDelay: number, 
  maxPosts: number, 
  spectatorMode: boolean,
  styleGuide: string, 
  apiKey: string
) {
  isCommentingActive = true;
  currentSpectatorMode = spectatorMode;
  
  // Load today's commented authors from local storage
  commentedAuthors = await loadTodayCommentedAuthors();
  console.log(`Loaded ${commentedAuthors.size} already commented authors for today`);
  
  try {
    console.log(`Starting new commenting flow with max ${maxPosts} posts in ${spectatorMode ? 'spectator' : 'background'} mode...`);
    
    // Step 1: Scroll down for specified duration to load posts
    await scrollFeedToLoadPosts(scrollDuration);
    
    if (!isCommentingActive) {
      console.log('Commenting stopped during scroll phase');
      return;
    }
    
    // Step 2: Scroll back to top
    console.log('Scrolling back to top...');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await wait(2000);
    
    if (!isCommentingActive) {
      console.log('Commenting stopped during scroll to top');
      return;
    }
    
    // Step 3: Find all posts and process them
    await processAllPostsOnFeed(commentDelay, maxPosts);
    
    // Only notify completion if we weren't stopped
    if (isCommentingActive) {
      chrome.runtime.sendMessage({
        action: 'commentingCompleted'
      });
    }
    
  } catch (error) {
    console.error('Error in new commenting flow:', error);
    isCommentingActive = false;
  }
}

// Function to scroll feed and load posts
async function scrollFeedToLoadPosts(duration: number): Promise<void> {
  console.log(`Scrolling feed for ${duration} seconds to load posts...`);
  
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  
  while (Date.now() < endTime && isCommentingActive) {
    // Check if we should stop
    if (!isCommentingActive) {
      console.log('Stopping scroll due to stop signal');
      break;
    }
    
    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);
    await wait(500);
    
    // Check again after wait
    if (!isCommentingActive) {
      console.log('Stopping scroll due to stop signal after wait');
      break;
    }
    
    // Check if we've reached the end or if new content is loading
    const currentHeight = document.body.scrollHeight;
    await wait(1000);
    const newHeight = document.body.scrollHeight;
    
    // If no new content loaded, continue scrolling anyway
    if (currentHeight === newHeight) {
      console.log('No new content detected, continuing to scroll...');
    }
  }
  
  console.log('Finished scrolling to load posts');
}

// Function to process all posts on the feed
async function processAllPostsOnFeed(commentDelay: number, maxPosts: number): Promise<void> {
  console.log(`Starting to process posts on feed (max ${maxPosts} posts) in ${currentSpectatorMode ? 'spectator' : 'background'} mode...`);
  
  // Find all post containers using the new structure
  const postContainers = document.querySelectorAll('.feed-shared-update-v2__control-menu-container');
  console.log(`Found ${postContainers.length} posts to process`);
  
  let commentCount = 0;
  
  for (let i = 0; i < postContainers.length && isCommentingActive && commentCount < maxPosts; i++) {
    // Check if we should stop at the beginning of each iteration
    if (!isCommentingActive) {
      console.log('Stopping post processing due to stop signal');
      break;
    }
    
    const postContainer = postContainers[i] as HTMLElement;
    
    try {
      console.log(`Processing post ${i + 1}/${postContainers.length} (commented: ${commentCount}/${maxPosts})`);
      
      // Scroll to the post
      postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(1000);
      
      // Check again after scroll
      if (!isCommentingActive) {
        console.log('Stopping due to stop signal after scroll to post');
        break;
      }
      
      // Check for author duplicate
      const authorInfo = extractAuthorInfo(postContainer);
      if (!authorInfo) {
        console.log(`Skipping post ${i + 1} - could not extract author info`);
        continue;
      }
      
      if (commentedAuthors.has(authorInfo.name)) {
        console.log(`Skipping post ${i + 1} - already commented on ${authorInfo.name} today`);
        continue;
      }
      
      // Extract post content
      const postContent = extractPostContent(postContainer);
      if (!postContent) {
        console.log(`Skipping post ${i + 1} - could not extract post content`);
        continue;
      }
      
      console.log(`Post content: ${postContent.substring(0, 100)}...`);
      
      // Check again before generating comment
      if (!isCommentingActive) {
        console.log('Stopping due to stop signal before comment generation');
        break;
      }
      
      // Generate comment using background script
      const comment = await generateComment(postContent);
      if (!comment) {
        console.log(`❌ Skipping post ${i + 1} - could not generate comment`);
        continue;
      }
      
      console.log(`✅ Generated comment for post ${i + 1}:`, comment);
      
      // Check again before posting comment
      if (!isCommentingActive) {
        console.log('Stopping due to stop signal before posting comment');
        break;
      }
      
      // Post the comment
      console.log(`📝 Attempting to post comment on post ${i + 1} by ${authorInfo.name}...`);
      const success = await postCommentOnPost(postContainer, comment);
      
      if (success) {
        commentCount++;
        commentedAuthors.add(authorInfo.name);
        
        // Save to local storage and update counts
        await saveCommentedAuthor(authorInfo.name);
        await updateCommentCounts();
        
        console.log(`🎉 Successfully posted comment ${commentCount}/${maxPosts} on post by ${authorInfo.name}`);
        console.group(`📊 Progress Update`);
        console.log(`Comments posted this session: ${commentCount}/${maxPosts}`);
        console.log(`Authors commented on today:`, Array.from(commentedAuthors));
        console.groupEnd();
        
        // Update background script with progress
        chrome.runtime.sendMessage({
          action: 'updateCommentCount',
          count: commentCount,
          status: `Posted comment ${commentCount}/${maxPosts} on post by ${authorInfo.name}`
        });
        
        // Check if we've reached the max posts limit
        if (commentCount >= maxPosts) {
          console.log(`Reached maximum posts limit (${maxPosts}). Stopping...`);
          break;
        }
        
        // Wait between comments with stop checking
        if (i < postContainers.length - 1 && commentCount < maxPosts) {
          console.log(`Waiting ${commentDelay} seconds before next comment...`);
          
          // Break the delay into smaller chunks to check for stop signal
          const delayChunks = Math.ceil(commentDelay);
          for (let chunk = 0; chunk < delayChunks && isCommentingActive; chunk++) {
            await wait(1000);
            if (!isCommentingActive) {
              console.log('Stopping during comment delay due to stop signal');
              break;
            }
          }
        }
      } else {
        console.log(`Failed to post comment on post ${i + 1} by ${authorInfo.name}`);
      }
      
    } catch (error) {
      console.error(`Error processing post ${i + 1}:`, error);
    }
  }
  
  console.log(`Completed processing posts. Posted ${commentCount}/${maxPosts} comments total.`);
}

// Function to extract author info from post container
function extractAuthorInfo(postContainer: HTMLElement): { name: string } | null {
  try {
    // Look for author container within the post
    const authorContainer = postContainer.querySelector('.update-components-actor__container');
    if (!authorContainer) {
      console.log('Author container not found');
      return null;
    }
    
    // Try different selectors for author name
    const nameSelectors = [
      '.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]',
      '.update-components-actor__title span[aria-hidden="true"]',
      '.update-components-actor__title',
      '.update-components-actor__name'
    ];
    
    for (const selector of nameSelectors) {
      const nameElement = authorContainer.querySelector(selector);
      if (nameElement && nameElement.textContent) {
        const name = nameElement.textContent.replace(/<!---->/g, '').trim().split('•')[0].trim();
        if (name) {
          console.log(`Extracted author name: ${name}`);
          return { name };
        }
      }
    }
    
    console.log('Could not extract author name');
    return null;
  } catch (error) {
    console.error('Error extracting author info:', error);
    return null;
  }
}

// Function to extract post content from post container
function extractPostContent(postContainer: HTMLElement): string {
  try {
    // Look for the content container within the post
    const contentContainer = postContainer.querySelector('.fie-impression-container');
    if (!contentContainer) {
      console.log('Content container not found');
      return '';
    }
    
    // Extract text content recursively
  function extractText(node: Node): string {
    let text = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent?.trim() + ' ';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += extractText(child);
      }
    });
    return text;
  }

    const content = extractText(contentContainer).replace(/\s+/g, ' ').trim();
    console.log(`Extracted post content: ${content.substring(0, 100)}...`);
    return content;
  } catch (error) {
    console.error('Error extracting post content:', error);
  return '';
  }
}

// Function to generate comment using background script
async function generateComment(postContent: string): Promise<string> {
  return new Promise((resolve) => {
    console.log('🤖 Requesting comment generation for post content:', postContent.substring(0, 200) + '...');
    
    // Set up a 30-second timeout
    const timeout = setTimeout(() => {
      console.error('⏰ FALLBACK REASON: Comment generation timed out after 30 seconds');
      console.error('⏰ TIMEOUT - No response from OpenRouter API within 30 seconds');
      resolve('Great post! Thanks for sharing.');
    }, 30000);
    
    chrome.runtime.sendMessage({
      action: 'generateComment',
      postContent: postContent
    }, (response) => {
      clearTimeout(timeout); // Clear the timeout since we got a response
      
      if (chrome.runtime.lastError) {
        console.error('💥 FALLBACK REASON: Chrome runtime error during comment generation');
        console.error('💥 CHROME ERROR:', chrome.runtime.lastError);
        console.error('💥 This usually means the background script crashed or message passing failed');
        resolve('Great post! Thanks for sharing.');
      } else if (!response) {
        console.error('❌ FALLBACK REASON: No response received from background script');
        console.error('❌ RESPONSE NULL - Background script may have failed silently');
        resolve('Great post! Thanks for sharing.');
      } else if (!response.comment) {
        console.error('⚠️ FALLBACK REASON: Response received but no comment field');
        console.error('⚠️ INVALID RESPONSE STRUCTURE:', response);
        console.error('⚠️ Expected response.comment but got:', Object.keys(response));
        resolve('Great post! Thanks for sharing.');
      } else if (response.comment === 'Great post! Thanks for sharing.') {
        console.error('🚨 FALLBACK REASON: Background script returned the default fallback comment');
        console.error('🚨 This means OpenRouter API failed and background script used fallback');
        
        // Check if error details were provided in the response
        if (response.error) {
          console.group('🔥 OPENROUTER ERROR DETAILS FROM RESPONSE');
          console.error('🔥 Error Message:', response.error.message);
          console.error('🔥 Error Type:', response.error.name);
          console.error('🔥 API Key Status:', response.error.apiKey);
          console.error('🔥 Style Guide Status:', response.error.styleGuide);
          console.error('🔥 Post Content Length:', response.error.postContentLength, 'characters');
          if (response.error.stack) {
            console.error('🔥 Stack Trace:', response.error.stack);
          }
          console.groupEnd();
        } else {
          console.error('🚨 No error details provided - check background script console');
        }
        
        resolve(response.comment);
      } else {
        console.log('✅ Successfully received generated comment:', response.comment.substring(0, 100) + '...');
        resolve(response.comment);
      }
    });
  });
}

// Function to post comment on a specific post
async function postCommentOnPost(postContainer: HTMLElement, comment: string): Promise<boolean> {
  try {
    console.group('📝 Comment Posting Process');
    console.log('Starting to post comment:', comment.substring(0, 100) + '...');
    
    // Check if we should stop before starting
    if (!isCommentingActive) {
      console.log('❌ Stopping comment posting due to stop signal');
      console.groupEnd();
      return false;
    }
    
    // Step 1: Find and click the comment button
    console.log('🔍 Looking for comment button...');
    const commentButton = postContainer.querySelector('button[aria-label="Comment"]') as HTMLButtonElement;
    if (!commentButton) {
      console.error('❌ Comment button not found');
      console.groupEnd();
      return false;
    }
    
    console.log('👆 Clicking comment button...');
      commentButton.click();
      
    // Wait for comment editor to appear
    console.log('⏳ Waiting for comment editor to appear...');
    await wait(2000);
    
    // Check again after wait
    if (!isCommentingActive) {
      console.log('❌ Stopping during comment editor wait due to stop signal');
      console.groupEnd();
      return false;
    }
    
    // Step 2: Find the comment editor
    console.log('🔍 Looking for comment editor...');
    const commentEditor = postContainer.querySelector('.comments-comment-box-comment__text-editor');
    if (!commentEditor) {
      console.error('❌ Comment editor not found');
      console.groupEnd();
      return false;
    }
    
    // Step 3: Find the editable field within the editor
    console.log('🔍 Looking for editable field...');
    const editableField = commentEditor.querySelector('div[contenteditable="true"]') as HTMLElement;
      if (!editableField) {
        console.error('❌ Editable field not found');
        console.groupEnd();
      return false;
      }

    console.log('✅ Found editable field, inputting comment...');
    
    // Check again before inputting
    if (!isCommentingActive) {
      console.log('❌ Stopping during comment input due to stop signal');
      console.groupEnd();
      return false;
    }
    
    // Step 4: Click on the editable field and input the comment
      editableField.focus();
      editableField.click();
      editableField.innerHTML = '';

    // Input the comment text
    const lines = comment.split('\n');
      lines.forEach((lineText) => {
        const p = document.createElement('p');
        if (lineText === "") {
          p.appendChild(document.createElement('br'));
        } else {
          p.textContent = lineText;
        }
        editableField.appendChild(p);
      });

    // Set cursor position and trigger input event
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        if (editableField.lastChild) {
          range.setStartAfter(editableField.lastChild);
        } else {
          range.selectNodeContents(editableField);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editableField.focus();

      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      editableField.dispatchEvent(inputEvent);

    console.log('✅ Comment text inputted successfully');

    // Wait for submit button to become enabled
    console.log('⏳ Waiting for submit button to become enabled...');
    await wait(1000);
    
    // Check again before submitting
    if (!isCommentingActive) {
      console.log('❌ Stopping during submit button wait due to stop signal');
      console.groupEnd();
      return false;
    }
    
    // Step 5: Find and click the submit button
    console.log('🔍 Looking for submit button...');
    const submitButton = postContainer.querySelector('.comments-comment-box__submit-button--cr') as HTMLButtonElement;
        if (!submitButton || submitButton.disabled) {
          console.error('❌ Submit button not found or disabled');
          console.groupEnd();
      return false;
        }

        console.log('🚀 Clicking submit button...');
        submitButton.click();
        
    // Wait for comment to be posted
    console.log('⏳ Waiting for comment to be posted...');
    await wait(2000);
    
    console.log('🎉 Comment posted successfully');
    console.groupEnd();
    return true;
    
  } catch (error) {
    console.error('💥 Error posting comment:', error);
    console.groupEnd();
    return false;
  }
}

// Utility function to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('LinkedIn Auto Commenter content script loaded - New Single Mode');
