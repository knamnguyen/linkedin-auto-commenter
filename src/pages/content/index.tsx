try {
  console.log('content script loaded');
} catch (e) {
  console.error(e);
}

// Content script for LinkedIn Auto Commenter
// This script runs on all pages and can be used to communicate with the background script

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'extractUrls') {
    const urls = extractLinkedInUrls();
    sendResponse({ urls });
  } else if (request.action === 'extractContent') {
    const content = extractPostContent();
    sendResponse({ content });
  } else if (request.action === 'checkAuthorDuplicate') {
    checkAuthorDuplicate().then(result => {
      sendResponse(result);
    });
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === 'postComment') {
    postComment(request.comment).then(success => {
      sendResponse({ success });
    });
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === 'checkContentLoaded') {
    const hasContent = checkIfContentLoaded();
    sendResponse({ hasContent });
  }
});

// Function to extract LinkedIn post URLs from feed
function extractLinkedInUrls(): string[] {
  const baseUrl = "https://www.linkedin.com/feed/update/";
  const urnRegex = /urn:li:activity:\d+/g;
  const postUrls = new Set<string>();
  const htmlContent = document.documentElement.innerHTML;
  let match;

  while ((match = urnRegex.exec(htmlContent)) !== null) {
    const activityUrn = match[0];
    const postUrl = baseUrl + activityUrn;
    postUrls.add(postUrl);
  }

  return Array.from(postUrls);
}

// Function to extract post content
function extractPostContent(): string {
  const container = document.querySelector('.fie-impression-container');
  
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

  if (container) {
    return extractText(container).replace(/\s+/g, ' ').trim();
  }
  return '';
}

// Function to extract author name from post
function extractAuthorName(): string {
  const authorElement = document.querySelector('.update-components-actor__title');
  
  if (authorElement) {
    // Look for the author name in various possible structures
    const nameSpan = authorElement.querySelector('span[dir="ltr"] span[aria-hidden="true"]');
    if (nameSpan && nameSpan.textContent) {
      // Remove comment markers and trim
      return nameSpan.textContent.replace(/<!---->/g, '').trim();
    }
    
    // Fallback: try to get text content directly
    const textContent = authorElement.textContent;
    if (textContent) {
      return textContent.replace(/<!---->/g, '').trim().split('•')[0].trim();
    }
  }
  
  return '';
}

// Function to check if we've already commented on this author today
function hasCommentedOnAuthorToday(authorName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const today = new Date().toDateString(); // e.g., "Mon Dec 25 2023"
    const storageKey = `commented_authors_${today}`;
    
    chrome.storage.local.get([storageKey], (result) => {
      const commentedAuthors = result[storageKey] || [];
      resolve(commentedAuthors.includes(authorName));
    });
  });
}

// Function to mark author as commented on today
function markAuthorAsCommentedToday(authorName: string): void {
  const today = new Date().toDateString();
  const storageKey = `commented_authors_${today}`;
  
  chrome.storage.local.get([storageKey], (result) => {
    const commentedAuthors = result[storageKey] || [];
    if (!commentedAuthors.includes(authorName)) {
      commentedAuthors.push(authorName);
      chrome.storage.local.set({ [storageKey]: commentedAuthors });
      console.log(`Marked ${authorName} as commented on for ${today}`);
    }
  });
}

// Function to check if we should skip this author (duplicate check)
async function checkAuthorDuplicate(): Promise<{shouldSkip: boolean, authorName: string, reason?: string}> {
  const authorName = extractAuthorName();
  
  if (!authorName) {
    return { shouldSkip: true, authorName: '', reason: 'Could not extract author name' };
  }
  
  console.log(`Extracted author name: ${authorName}`);
  
  const hasCommented = await hasCommentedOnAuthorToday(authorName);
  
  if (hasCommented) {
    console.log(`Skipping ${authorName} - already commented on this author today`);
    return { shouldSkip: true, authorName, reason: 'Already commented on this author today' };
  }
  
  console.log(`Proceeding with ${authorName} - no duplicate found`);
  return { shouldSkip: false, authorName };
}

// Function to post a comment
async function postComment(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    // First, click the comment button to ensure comment box appears
    const commentButton = document.querySelector('button[aria-label="Comment"]') as HTMLButtonElement;
    
    if (commentButton) {
      console.log('Clicking comment button to show comment box...');
      commentButton.click();
      
      // Wait a moment for the comment box to appear
      setTimeout(() => {
        proceedWithComment();
      }, 1500);
    } else {
      console.log('Comment button not found, proceeding to look for comment box...');
      proceedWithComment();
    }

    function proceedWithComment() {
      const COMMENT_EDITOR_CONTAINER_SELECTOR_CONTAINS = "comments-comment-box-comment__text-editor";
      const ACTUAL_EDITABLE_FIELD_SELECTOR = "div[contenteditable='true']";
      const COMMENT_SUBMIT_BUTTON_SELECTOR_CONTAINS = "comments-comment-box__submit-button";

      const editorContainer = document.querySelector(`[class*="${COMMENT_EDITOR_CONTAINER_SELECTOR_CONTAINS}"]`);
      if (!editorContainer) {
        console.error('Comment editor container not found');
        resolve(false);
        return;
      }

      const editableField = editorContainer.querySelector(ACTUAL_EDITABLE_FIELD_SELECTOR) as HTMLElement;
      if (!editableField) {
        console.error('Editable field not found');
        resolve(false);
        return;
      }

      editableField.focus();
      editableField.click();
      editableField.innerHTML = '';

      const lines = content.split('\n');
      lines.forEach((lineText) => {
        const p = document.createElement('p');
        if (lineText === "") {
          p.appendChild(document.createElement('br'));
        } else {
          p.textContent = lineText;
        }
        editableField.appendChild(p);
      });

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

      setTimeout(() => {
        const submitButton = document.querySelector(`[class*="${COMMENT_SUBMIT_BUTTON_SELECTOR_CONTAINS}"]`) as HTMLButtonElement;
        if (!submitButton || submitButton.disabled) {
          console.error('Submit button not found or disabled');
          resolve(false);
          return;
        }

        console.log('Clicking submit button...');
        submitButton.click();
        
        // Mark author as commented on today after successful posting
        const authorName = extractAuthorName();
        if (authorName) {
          markAuthorAsCommentedToday(authorName);
        }
        
        resolve(true);
      }, 1000);
    }
  });
}

// Function to check if LinkedIn content has loaded
function checkIfContentLoaded(): boolean {
  // Check for LinkedIn-specific content indicators
  const feedContainer = document.querySelector('.fie-impression-container');
  const commentBox = document.querySelector('[class*="comments-comment-box"]');
  const linkedinContent = document.querySelector('[data-urn]');
  const activityContent = document.querySelector('[data-activity-urn]');
  
  // Page is considered loaded if we can find LinkedIn-specific content
  return !!(feedContainer || commentBox || linkedinContent || activityContent);
}

console.log('LinkedIn Auto Commenter content script loaded');
