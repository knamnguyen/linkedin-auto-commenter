// Content script for LinkedIn Auto Commenter - Background Window Mode
// This script processes posts directly on the feed page

let isCommentingActive = false;
let commentedAuthors = new Set<string>();
let audioContext: AudioContext | null = null;
let currentOscillator: OscillatorNode | null = null;
let audioElement: HTMLAudioElement | null = null;

// Check if we need to show the start button
let hasUserInteracted = false;

// Background logging functions to send logs to background script
const backgroundLog = (...args: any[]) => {
  console.log(...args); // Still log to content script console
  chrome.runtime.sendMessage({
    action: 'backgroundLog',
    level: 'log',
    args: args
  }).catch(() => {/* ignore if background script not available */});
};

const backgroundError = (...args: any[]) => {
  console.error(...args); // Still log to content script console
  chrome.runtime.sendMessage({
    action: 'backgroundLog',
    level: 'error', 
    args: args
  }).catch(() => {/* ignore if background script not available */});
};

const backgroundWarn = (...args: any[]) => {
  console.warn(...args); // Still log to content script console
  chrome.runtime.sendMessage({
    action: 'backgroundLog',
    level: 'warn',
    args: args
  }).catch(() => {/* ignore if background script not available */});
};

const backgroundGroup = (...args: any[]) => {
  console.group(...args); // Still log to content script console
  chrome.runtime.sendMessage({
    action: 'backgroundLog',
    level: 'group',
    args: args
  }).catch(() => {/* ignore if background script not available */});
};

const backgroundGroupEnd = () => {
  console.groupEnd(); // Still log to content script console
  chrome.runtime.sendMessage({
    action: 'backgroundLog',
    level: 'groupEnd',
    args: []
  }).catch(() => {/* ignore if background script not available */});
};

//check if page is ready to display the start button
if (document.readyState !== 'loading') {
  console.log('document is already ready, just execute code here');
  //send page ready message to background script
  chrome.runtime.sendMessage({
    action: 'pageReady'
  });
} else {
  document.addEventListener('DOMContentLoaded', function () {
      console.log('document was not ready, place code here');
      //send page ready message to background script
      chrome.runtime.sendMessage({
        action: 'pageReady'
      });
  });
}

// Function to show the start button overlay
function showStartButton() {
  console.log('🚀 Showing start button for LinkedIn Auto Commenter...');
  
  // Don't show multiple buttons
  if (document.getElementById('linkedin-start-overlay')) {
    return;
  }
  
  // Create full-screen overlay
  const overlay = document.createElement('div');
  overlay.id = 'linkedin-start-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 115, 177, 0.95) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
    color: white !important;
  `;
  
  // Create container
  const container = document.createElement('div');
  container.style.cssText = `
    text-align: center !important;
    max-width: 600px !important;
    padding: 40px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border-radius: 20px !important;
    backdrop-filter: blur(10px) !important;
  `;
  
  // Create title
  const title = document.createElement('h1');
  title.textContent = 'LinkedIn Auto Commenter';
  title.style.cssText = `
    font-size: 48px !important;
    margin: 0 0 20px 0 !important;
    text-align: center !important;
    font-weight: bold !important;
    color: white !important;
  `;
  
  // Create subtitle
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Click to start auto-commenting on LinkedIn posts';
  subtitle.style.cssText = `
    font-size: 20px !important;
    margin: 0 0 40px 0 !important;
    text-align: center !important;
    opacity: 0.9 !important;
    color: white !important;
  `;
  
  // Create start button
  const startButton = document.createElement('button');
  startButton.textContent = '🚀 Start Auto-Commenting';
  startButton.style.cssText = `
    background: #ffffff !important;
    color: #0073b1 !important;
    border: none !important;
    padding: 20px 40px !important;
    font-size: 24px !important;
    font-weight: bold !important;
    border-radius: 12px !important;
    cursor: pointer !important;
    box-shadow: 0 8px 16px rgba(0,0,0,0.2) !important;
    transition: all 0.3s ease !important;
    margin: 0 0 20px 0 !important;
    font-family: inherit !important;
  `;
  
  // Add hover effects
  startButton.addEventListener('mouseenter', () => {
    startButton.style.transform = 'translateY(-2px)';
    startButton.style.boxShadow = '0 12px 20px rgba(0,0,0,0.3)';
  });
  
  startButton.addEventListener('mouseleave', () => {
    startButton.style.transform = 'translateY(0)';
    startButton.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
  });
  
  // Create info text
  const infoText = document.createElement('p');
  infoText.innerHTML = `
    <strong>What will happen:</strong><br>
    • Audio will start playing to keep this tab active<br>
    • This window will move to the background<br>
    • Auto-commenting will begin immediately<br>
    • You can continue using other applications
  `;
  infoText.style.cssText = `
    font-size: 16px !important;
    text-align: center !important;
    opacity: 0.8 !important;
    line-height: 1.6 !important;
    max-width: 500px !important;
    margin: 0 !important;
    color: white !important;
  `;
  
  // Button click handler
  startButton.addEventListener('click', async () => {
    console.log('🚀 Start button clicked! Beginning full flow...');
    hasUserInteracted = true;
    
    // Update button state
    startButton.textContent = '🔄 Starting...';
    startButton.style.background = '#28a745';
    startButton.style.color = 'white';
    startButton.disabled = true;
    
    try {
      // Step 1: Start continuous audio
      console.log('🎵 Step 1: Starting continuous audio...');
      await injectAndPlayContinuousSound();
      
      startButton.textContent = '🎵 Audio Started';

      await wait(1000);
      startButton.textContent = '💬 Starting flow';
      //step 2: move back to the original tab
   
      
     
      
      // Get settings from storage and start commenting
      chrome.storage.local.get(['scrollDuration', 'commentDelay', 'maxPosts', 'styleGuide', 'apiKey'], (result) => {
        backgroundLog('Content: Retrieved settings from storage:', result);
        
        // Use popup settings with fallbacks only if completely missing
        const scrollDuration = result.scrollDuration !== undefined ? result.scrollDuration : 10;
        const commentDelay = result.commentDelay !== undefined ? result.commentDelay : 5;
        const maxPosts = result.maxPosts !== undefined ? result.maxPosts : 5;
        const styleGuide = result.styleGuide !== undefined ? result.styleGuide : 'Be engaging and professional';
        const apiKey = result.apiKey !== undefined ? result.apiKey : '';
        
        backgroundLog('🎯 Starting commenting flow with settings:', {
          scrollDuration,
          commentDelay, 
          maxPosts,
          styleGuide: styleGuide?.substring(0, 50) + '...',
          hasApiKey: !!apiKey
        });
        
        if (!apiKey) {
          backgroundError('❌ No API key found in storage! Cannot start commenting.');
          return;
        }
        
        if (!styleGuide) {
          backgroundError('❌ No style guide found in storage! Cannot start commenting.');
          return;
        }
        
        startNewCommentingFlow(scrollDuration, commentDelay, maxPosts, styleGuide, apiKey);
      });
      await wait(1000);
      startButton.textContent = '💬 Moving back to original tab';
      await wait(1000);
      
      console.log('✅ Full flow started successfully!');
      overlay.remove();

    
      
      console.log('💬 Step 3: Moving back to the original tab...');
      chrome.runtime.sendMessage({
        action: 'moveToOriginalTab'
      });
      
    } catch (error) {
      console.error('❌ Failed to start:', error);
      startButton.textContent = '❌ Failed - Try Again';
      startButton.style.background = '#dc3545';
      startButton.disabled = false;
      subtitle.textContent = 'Something went wrong - click to try again';
    }
  });
  
  // Assemble UI
  container.appendChild(title);
  container.appendChild(subtitle);
  container.appendChild(startButton);
  container.appendChild(infoText);
  overlay.appendChild(container);
  
  // Add to page
  document.body.appendChild(overlay);
  
  console.log('🚀 Start button overlay displayed');
}

// --- Main function to create and play the continuous audio ---
async function injectAndPlayContinuousSound(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('🎵 Initializing Web Audio API for continuous sound...');
      
      // Get the AudioContext constructor, working across browsers
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

      // Check if Web Audio API is supported
      if (!AudioContext) {
        throw new Error("Web Audio API is not supported in this browser. Cannot play audio.");
      }

      // Create an AudioContext instance
      // This is the gateway to using the Web Audio API
      audioContext = new AudioContext();

      // --- Sound Generation Setup ---

      // Create an OscillatorNode: This will generate the actual sound wave
      const oscillator = audioContext.createOscillator();

      // Create a GainNode: This will control the volume of the sound
      const gainNode = audioContext.createGain();

      // Create a MediaStreamDestinationNode: This allows us to take the audio
      // generated by the Web Audio API and use it as a source for an HTML <audio> element.
      const mediaStreamDestination = audioContext.createMediaStreamDestination();

      // Connect the nodes: Oscillator -> GainNode -> MediaStreamDestination
      // The sound flows from the oscillator, through the volume control (gain),
      // and then to the stream destination.
      oscillator.connect(gainNode);
      gainNode.connect(mediaStreamDestination);

      // --- Configure the Sound ---

      // Set the type of wave for the oscillator
      // 'sine': a pure, smooth tone
      // Other options: 'square', 'sawtooth', 'triangle'
      oscillator.type = 'sine';

      // Set the frequency (pitch) of the sound in Hertz (Hz)
      // Let's pick a random frequency in a generally pleasant mid-range (e.g., between C4 and C5)
      // C4 is approx 261.63 Hz, C5 is approx 523.25 Hz
      const minFreq = 261.63;
      const maxFreq = 523.25;
      // const frequency = Math.random() * (maxFreq - minFreq) + minFreq;
      const frequency = 10000;

      //picking an inaudible frequency almost zero volume
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      // Set the volume using the GainNode
      // 0.0 is silent, 1.0 is full volume. Let's set it low to be less intrusive.
      gainNode.gain.setValueAtTime(0.001, audioContext.currentTime); // 10% volume

      // --- HTML <audio> Element Setup ---

      // Create a new HTML <audio> element
      audioElement = document.createElement('audio');

      // Set the source of the audio element to the stream from our Web Audio API setup
      audioElement.srcObject = mediaStreamDestination.stream;

      // Set the audio to autoplay
      // IMPORTANT: Browsers have autoplay restrictions. This might not work without user interaction.
      audioElement.autoplay = true;

      // Set the audio to loop continuously
      audioElement.loop = true;

      // Hide the default audio controls for background audio
      audioElement.controls = false;

      // Hide the audio element
      audioElement.style.cssText = 'position: fixed; top: -9999px; opacity: 0;';

      // --- Inject into DOM and Start ---

      // Append the new audio element to the body of the document
      // This makes it part of the webpage
      document.body.appendChild(audioElement);

      // Resume AudioContext if needed (for user gesture compliance)
      const startAudioPlayback = async () => {
        if (audioContext!.state === 'suspended') {
          await audioContext!.resume();
        }

        // Start the oscillator to begin generating sound
        // This needs to happen for any sound to be produced
        oscillator.start();
        currentOscillator = oscillator;

        // Attempt to play the HTML audio element
        // This is often needed due to autoplay policies, especially if audioCtx was not started by user gesture.
        const playPromise = audioElement!.play();

        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Autoplay started successfully.
            console.log(`✅ Playing a ${oscillator.type} wave at ${frequency.toFixed(2)} Hz. Audio element injected and playing.`);
            resolve();
          }).catch((error) => {
            // Autoplay was prevented.
            console.warn("❌ Autoplay was prevented by the browser:", error);
            reject(error);
          });
        } else {
          console.log(`✅ Audio started successfully (no promise returned)`);
          resolve();
        }
      };

      startAudioPlayback();

    } catch (error) {
      console.error('❌ Audio setup failed:', error);
      reject(error);
    }
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'showStartButton') {
    console.log('📱 Popup requested to show start button');
    showStartButton();
    sendResponse({ success: true });
  } else if (request.action === 'startNewCommentingFlow') {
    startNewCommentingFlow(
      request.scrollDuration, 
      request.commentDelay, 
      request.maxPosts, 
      request.styleGuide, 
      request.apiKey
    );
    sendResponse({ success: true });
  } else if (request.action === 'stopCommentingFlow') {
    console.log('Received stop signal - stopping commenting flow');
    isCommentingActive = false;
    stopTabActiveAudio();
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
  styleGuide: string, 
  apiKey: string
) {
  isCommentingActive = true;
  console.log(`🚀 Starting new commenting flow with parameters:`);
  backgroundLog(`🚀 Starting new commenting flow with parameters:`);
  console.log(`   - scrollDuration: ${scrollDuration}`);
  console.log(`   - commentDelay: ${commentDelay}`);
  console.log(`   - maxPosts: ${maxPosts}`);
  console.log(`   - isCommentingActive: ${isCommentingActive}`);
  backgroundLog(`   - scrollDuration: ${scrollDuration}, commentDelay: ${commentDelay}, maxPosts: ${maxPosts}, isCommentingActive: ${isCommentingActive}`);
  
  // // Start anti-throttling mechanisms to prevent tab throttling
  // keepTabActiveAudio();

  //starts the always active core
  window.alwaysActive.enable();
  
  // Load today's commented authors from local storage
  commentedAuthors = await loadTodayCommentedAuthors();
  console.log(`Loaded ${commentedAuthors.size} already commented authors for today`);
  backgroundLog(`Loaded ${commentedAuthors.size} already commented authors for today`);
  
  try {
    console.log(`Starting new commenting flow with max ${maxPosts} posts...`);
    backgroundLog(`Starting new commenting flow with max ${maxPosts} posts...`);
    
    // Step 1: Scroll down for specified duration to load posts
    console.log(`📜 Step 1: Scrolling feed for ${scrollDuration} seconds...`);
    backgroundLog(`📜 Step 1: Scrolling feed for ${scrollDuration} seconds...`);
    await scrollFeedToLoadPosts(scrollDuration);
    
    if (!isCommentingActive) {
      console.log('❌ Commenting stopped during scroll phase');
      backgroundLog('❌ Commenting stopped during scroll phase');
      stopTabActiveAudio();
      return;
    }
    
    // Step 2: Scroll back to top
    console.log('📜 Step 2: Scrolling back to top...');
    backgroundLog('📜 Step 2: Scrolling back to top...');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await wait(2000);
    
    if (!isCommentingActive) {
      console.log('❌ Commenting stopped during scroll to top');
      backgroundLog('❌ Commenting stopped during scroll to top');
      stopTabActiveAudio();
      return;
    }
    
    // Step 3: Find all posts and process them
    console.log('📜 Step 3: Processing all posts on feed...');
    console.log(`   - maxPosts parameter: ${maxPosts}`);
    console.log(`   - commentDelay parameter: ${commentDelay}`);
    console.log(`   - isCommentingActive before processing: ${isCommentingActive}`);
    backgroundLog(`📜 Step 3: Processing all posts on feed... maxPosts: ${maxPosts}, commentDelay: ${commentDelay}, isCommentingActive: ${isCommentingActive}`);
    
    await processAllPostsOnFeed(commentDelay, maxPosts);
    
    console.log(`📜 Step 3 completed. Final state:`);
    console.log(`   - isCommentingActive: ${isCommentingActive}`);
    backgroundLog(`📜 Step 3 completed. Final isCommentingActive: ${isCommentingActive}`);
    
    // Stop anti-throttling mechanisms
    stopTabActiveAudio();
    
    // Only notify completion if we weren't stopped
    if (isCommentingActive) {
      console.log('🏁 Sending completion message to background script...');
      backgroundLog('🏁 Sending completion message to background script...');
      chrome.runtime.sendMessage({
        action: 'commentingCompleted'
      });
    } else {
      console.log('🛑 Not sending completion message because commenting was stopped');
      backgroundLog('🛑 Not sending completion message because commenting was stopped');
    }
    
  } catch (error) {
    console.error('💥 Error in new commenting flow:', error);
    backgroundError('💥 Error in new commenting flow:', error);
    isCommentingActive = false;
    stopTabActiveAudio();
  }
}

// Helper function to manually trigger scroll events for better LinkedIn compatibility
function triggerScrollEvents() {
  // Manually dispatch scroll events to help LinkedIn's listeners
  const scrollEvent = new Event('scroll', { bubbles: true, cancelable: true });
  window.dispatchEvent(scrollEvent);
  document.dispatchEvent(scrollEvent);
  
  // Also trigger wheel events which some sites listen for
  const wheelEvent = new WheelEvent('wheel', { 
    bubbles: true, 
    cancelable: true, 
    deltaY: 100,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL
  });
  window.dispatchEvent(wheelEvent);
}

// Function to scroll feed and load posts - Optimized for background tabs
async function scrollFeedToLoadPosts(duration: number): Promise<void> {
  console.log(`Scrolling feed for ${duration} seconds to load posts...`);
  backgroundLog(`📜 Starting optimized background scroll for ${duration} seconds...`);
  
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  
  // Track metrics for debugging
  let scrollAttempts = 0;
  let actualScrolls = 0;
  let postCountBefore = 0;
  let postCountAfter = 0;
  
  // Get initial post count
  const initialPosts = document.querySelectorAll('.feed-shared-update-v2__control-menu-container');
  postCountBefore = initialPosts.length;
  backgroundLog(`📜 Initial post count: ${postCountBefore}`);
  
  // Use longer intervals and larger scroll amounts for background tabs
  const scrollAmount = 1200; // Larger scroll increment
  const pauseBetweenScrolls = 3000; // 3 second pause to allow LinkedIn to load content
  const maxScrollsPerCheck = 3; // Number of scrolls before checking for new content
  
  while (Date.now() < endTime && isCommentingActive) {
    // Check if we should stop
    if (!isCommentingActive) {
      backgroundLog('❌ Stopping scroll due to stop signal');
      break;
    }
    
    const currentTime = Date.now();
    const timeRemaining = Math.round((endTime - currentTime) / 1000);
    backgroundLog(`📜 Scroll attempt ${scrollAttempts + 1}, ${timeRemaining}s remaining`);
    
    // Record current scroll position
    const initialScrollY = window.scrollY;
    const initialDocHeight = document.body.scrollHeight;
    
    // Perform multiple deliberate scrolls
    for (let i = 0; i < maxScrollsPerCheck && isCommentingActive; i++) {
      const beforeScroll = window.scrollY;
      
      // Try different scroll methods for better reliability
      if (i % 2 === 0) {
        // Method 1: Scroll by fixed amount
        window.scrollBy({ top: scrollAmount, behavior: 'instant' });
      } else {
        // Method 2: Scroll to bottom
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      }
      
      // Manually trigger scroll events to help LinkedIn's listeners
      triggerScrollEvents();
      
      const afterScroll = window.scrollY;
      
      if (afterScroll > beforeScroll) {
        actualScrolls++;
        backgroundLog(`📜 Scrolled from ${beforeScroll} to ${afterScroll} (${afterScroll - beforeScroll}px)`);
      } else {
        backgroundLog(`📜 Scroll attempt failed or reached bottom. Position: ${afterScroll}`);
        // If we can't scroll anymore, we might be at the bottom
        if (afterScroll === beforeScroll && afterScroll > 0) {
          backgroundLog('📜 Reached bottom of page, breaking scroll loop');
          break;
        }
      }
      
      // Small delay between individual scrolls
      await wait(500);
    }
    
    scrollAttempts++;
    
    // Longer pause to allow LinkedIn to process and load content
    backgroundLog(`📜 Pausing ${pauseBetweenScrolls}ms for content loading...`);
    await wait(pauseBetweenScrolls);
    
    // Check for new content
    const newDocHeight = document.body.scrollHeight;
    const currentPosts = document.querySelectorAll('.feed-shared-update-v2__control-menu-container');
    const newPostCount = currentPosts.length;
    
    if (newPostCount > postCountBefore) {
      const newPosts = newPostCount - postCountBefore;
      backgroundLog(`📜 ✅ Content loaded! Found ${newPosts} new posts (total: ${newPostCount})`);
      postCountBefore = newPostCount;
    } else {
      backgroundLog(`📜 ⚠️ No new posts detected. Still at ${newPostCount} posts`);
    }
    
    // If document height increased, LinkedIn is loading content
    if (newDocHeight > initialDocHeight) {
      backgroundLog(`📜 Document height increased from ${initialDocHeight} to ${newDocHeight}`);
    }
    
    // Check if we haven't made progress in a while
    const timeElapsed = Date.now() - startTime;
    if (timeElapsed > 8000 && actualScrolls === 0) {
      backgroundWarn('📜 No successful scrolls in 8+ seconds. Page might be stuck or fully loaded.');
    }
  }
  
  // Final metrics
  postCountAfter = document.querySelectorAll('.feed-shared-update-v2__control-menu-container').length;
  const totalNewPosts = postCountAfter - initialPosts.length;
  const actualDuration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('Finished scrolling to load posts');
  backgroundLog(`📜 Scroll completed! Duration: ${actualDuration}s, Scroll attempts: ${scrollAttempts}, Successful scrolls: ${actualScrolls}, New posts loaded: ${totalNewPosts} (${initialPosts.length} → ${postCountAfter})`);
  
  // Alert if we didn't load many posts
  if (totalNewPosts < 10 && actualDuration > 10) {
    backgroundWarn(`📜 ⚠️ Only loaded ${totalNewPosts} posts in ${actualDuration}s. This suggests background tab throttling is affecting performance.`);
  }
}

// Function to process all posts on the feed
async function processAllPostsOnFeed(commentDelay: number, maxPosts: number): Promise<void> {
  console.group('🎯 PROCESSING ALL POSTS - DETAILED DEBUG');
  backgroundGroup('🎯 PROCESSING ALL POSTS - DETAILED DEBUG');
  console.log(`🎯 Starting to process posts on feed (max ${maxPosts} posts)...`);
  backgroundLog(`🎯 Starting to process posts on feed (max ${maxPosts} posts)...`);
  
  // Find all post containers using the new structure
  const postContainers = document.querySelectorAll('.feed-shared-update-v2__control-menu-container');
  console.log(`🎯 Found ${postContainers.length} post containers with selector: .feed-shared-update-v2__control-menu-container`);
  backgroundLog(`🎯 Found ${postContainers.length} post containers with selector: .feed-shared-update-v2__control-menu-container`);
  
  // Let's also try alternative selectors to see what we find
  const altSelector1 = document.querySelectorAll('.feed-shared-update-v2');
  const altSelector2 = document.querySelectorAll('[data-urn*="urn:li:activity"]');
  const altSelector3 = document.querySelectorAll('.feed-shared-update-v2__content');
  
  console.log(`🎯 Alternative selector results:`);
  console.log(`   - .feed-shared-update-v2: ${altSelector1.length} elements`);
  console.log(`   - [data-urn*="urn:li:activity"]: ${altSelector2.length} elements`);
  console.log(`   - .feed-shared-update-v2__content: ${altSelector3.length} elements`);
  backgroundLog(`🎯 Alternative selector results: .feed-shared-update-v2: ${altSelector1.length}, [data-urn*="urn:li:activity"]: ${altSelector2.length}, .feed-shared-update-v2__content: ${altSelector3.length}`);
  
  if (postContainers.length === 0) {
    console.error('🚨 NO POSTS FOUND! This is why the automation stops immediately.');
    console.error('🚨 The page might not be fully loaded or the selector is wrong.');
    backgroundError('🚨 NO POSTS FOUND! This is why the automation stops immediately.');
    backgroundError('🚨 The page might not be fully loaded or the selector is wrong.');
    console.groupEnd();
    backgroundGroupEnd();
    return;
  }
  
  let commentCount = 0;
  console.log(`🎯 Starting loop: commentCount=${commentCount}, maxPosts=${maxPosts}, isActive=${isCommentingActive}`);
  backgroundLog(`🎯 Starting loop: commentCount=${commentCount}, maxPosts=${maxPosts}, isActive=${isCommentingActive}`);
  
  for (let i = 0; i < postContainers.length && isCommentingActive && commentCount < maxPosts; i++) {
    console.group(`🔄 POST ${i + 1}/${postContainers.length} - DETAILED PROCESSING`);
    console.log(`🔄 Loop iteration ${i + 1}:`);
    console.log(`   - commentCount: ${commentCount}/${maxPosts}`);
    console.log(`   - isCommentingActive: ${isCommentingActive}`);
    console.log(`   - Loop condition: i(${i}) < postContainers.length(${postContainers.length}) = ${i < postContainers.length}`);
    console.log(`   - Active condition: isCommentingActive = ${isCommentingActive}`);
    console.log(`   - Count condition: commentCount(${commentCount}) < maxPosts(${maxPosts}) = ${commentCount < maxPosts}`);
    console.log(`   - Overall loop should continue: ${i < postContainers.length && isCommentingActive && commentCount < maxPosts}`);
    
    // Check if we should stop at the beginning of each iteration
    if (!isCommentingActive) {
      console.log('❌ STOPPING: isCommentingActive became false');
      console.groupEnd();
      break;
    }
    
    const postContainer = postContainers[i] as HTMLElement;
    
    try {
      console.log(`🔍 Processing post ${i + 1}/${postContainers.length} (commented: ${commentCount}/${maxPosts})`);
      
      // Scroll to the post
      postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(1000);
      
      // Check again after scroll
      if (!isCommentingActive) {
        console.log('❌ STOPPING: isCommentingActive became false after scroll');
        console.groupEnd();
        break;
      }
      
      // Check for author duplicate
      const authorInfo = extractAuthorInfo(postContainer);
      if (!authorInfo) {
        console.log(`⏭️ SKIPPING post ${i + 1} - could not extract author info`);
        console.groupEnd();
        continue;
      }
      
      if (commentedAuthors.has(authorInfo.name)) {
        console.log(`⏭️ SKIPPING post ${i + 1} - already commented on ${authorInfo.name} today`);
        console.groupEnd();
        continue;
      }
      
      // Extract post content
      const postContent = extractPostContent(postContainer);
      if (!postContent) {
        console.log(`⏭️ SKIPPING post ${i + 1} - could not extract post content`);
        console.groupEnd();
        continue;
      }

      const postAuthorContent = authorInfo.name + postContent;
      
      console.log(`📝 Post content preview: ${postContent.substring(0, 100)}...`);
      
      // Check again before generating comment
      if (!isCommentingActive) {
        console.log('❌ STOPPING: isCommentingActive became false before comment generation');
        console.groupEnd();
        break;
      }
      
      // Generate comment using background script
      console.log(`🤖 Generating comment for post ${i + 1}...`);
      const comment = await generateComment(postAuthorContent);
      console.log(`🤖 Comment generation result for post ${i + 1}:`, comment ? 'SUCCESS' : 'FAILED');
      
      if (!comment) {
        console.log(`❌ SKIPPING post ${i + 1} - could not generate comment`);
        console.groupEnd();
        continue;
      }
      
      console.log(`✅ Generated comment for post ${i + 1}:`, comment.substring(0, 50) + '...');
      
      // Check again before posting comment
      if (!isCommentingActive) {
        console.log('❌ STOPPING: isCommentingActive became false before posting comment');
        console.groupEnd();
        break;
      }
      
      // Post the comment
      console.log(`📝 Attempting to post comment on post ${i + 1} by ${authorInfo.name}...`);
      const success = await postCommentOnPost(postContainer, comment);
      console.log(`📝 Comment posting result for post ${i + 1}: ${success ? 'SUCCESS' : 'FAILED'}`);
      
      if (success) {
        commentCount++;
        commentedAuthors.add(authorInfo.name);
        
        // Save to local storage and update counts
        await saveCommentedAuthor(authorInfo.name);
        await updateCommentCounts();
        
        console.log(`🎉 Successfully posted comment ${commentCount}/${maxPosts} on post by ${authorInfo.name}`);
        backgroundLog(`🎉 Successfully posted comment ${commentCount}/${maxPosts} on post by ${authorInfo.name}`);
        console.group(`📊 Progress Update After Successful Comment`);
        console.log(`Comments posted this session: ${commentCount}/${maxPosts}`);
        console.log(`Authors commented on today:`, Array.from(commentedAuthors));
        console.log(`Remaining posts to process: ${postContainers.length - i - 1}`);
        console.log(`Should continue? commentCount(${commentCount}) < maxPosts(${maxPosts}) = ${commentCount < maxPosts}`);
        console.log(`Next iteration will be: ${i + 1} < ${postContainers.length} = ${i + 1 < postContainers.length}`);
        backgroundLog(`📊 Progress Update: ${commentCount}/${maxPosts} comments posted. Remaining posts: ${postContainers.length - i - 1}. Should continue: ${commentCount < maxPosts}`);
        console.groupEnd();
        
        // Update background script with progress
        chrome.runtime.sendMessage({
          action: 'updateCommentCount',
          count: commentCount,
          status: `Posted comment ${commentCount}/${maxPosts} on post by ${authorInfo.name}`
        });
        
        // Check if we've reached the max posts limit
        if (commentCount >= maxPosts) {
          console.log(`✅ REACHED MAX POSTS LIMIT: commentCount(${commentCount}) >= maxPosts(${maxPosts}). Stopping...`);
          backgroundLog(`✅ REACHED MAX POSTS LIMIT: commentCount(${commentCount}) >= maxPosts(${maxPosts}). Stopping...`);
          console.groupEnd();
          break;
        }
        
        // Wait between comments with stop checking
        if (i < postContainers.length - 1 && commentCount < maxPosts) {
          console.log(`⏳ Waiting ${commentDelay} seconds before next comment...`);
          console.log(`⏳ Delay conditions: i(${i}) < postContainers.length-1(${postContainers.length - 1}) = ${i < postContainers.length - 1}`);
          console.log(`⏳ Delay conditions: commentCount(${commentCount}) < maxPosts(${maxPosts}) = ${commentCount < maxPosts}`);
          
          // Break the delay into smaller chunks to check for stop signal
          const delayChunks = Math.ceil(commentDelay);
          for (let chunk = 0; chunk < delayChunks && isCommentingActive; chunk++) {
            await wait(1000);
            if (!isCommentingActive) {
              console.log('❌ STOPPING during comment delay due to stop signal');
              console.groupEnd();
              break;
            }
          }
          
          if (!isCommentingActive) {
            console.groupEnd();
            break;
        }
          
          console.log(`✅ Delay completed, continuing to next post...`);
      } else {
          console.log(`🔚 No delay needed - this was the last post or we've reached max comments`);
          console.log(`   - i(${i}) < postContainers.length-1(${postContainers.length - 1}): ${i < postContainers.length - 1}`);
          console.log(`   - commentCount(${commentCount}) < maxPosts(${maxPosts}): ${commentCount < maxPosts}`);
        }
      } else {
        console.log(`❌ Failed to post comment on post ${i + 1} by ${authorInfo.name}`);
      }
      
      console.groupEnd();
      
    } catch (error) {
      console.error(`💥 Error processing post ${i + 1}:`, error);
      console.groupEnd();
    }
    
    // Debug the next iteration conditions
    console.log(`🔄 End of iteration ${i + 1}. Next iteration check:`);
    console.log(`   - Next i will be: ${i + 1}`);
    console.log(`   - postContainers.length: ${postContainers.length}`);
    console.log(`   - isCommentingActive: ${isCommentingActive}`);
    console.log(`   - commentCount: ${commentCount}`);
    console.log(`   - maxPosts: ${maxPosts}`);
    console.log(`   - Loop will continue: ${(i + 1) < postContainers.length && isCommentingActive && commentCount < maxPosts}`);
  }
  
  console.log(`🏁 LOOP COMPLETED. Final stats:`);
  console.log(`   - Posted ${commentCount}/${maxPosts} comments total`);
  console.log(`   - Final isCommentingActive: ${isCommentingActive}`);
  console.log(`   - Processed ${postContainers.length} total posts`);
  console.log(`   - Loop exit reason analysis:`);
  console.log(`     - Reached max posts? ${commentCount >= maxPosts}`);
  console.log(`     - Lost active status? ${!isCommentingActive}`);
  console.log(`     - Ran out of posts? ${postContainers.length === 0}`);
  backgroundLog(`🏁 LOOP COMPLETED. Final stats: Posted ${commentCount}/${maxPosts} comments total. Final isCommentingActive: ${isCommentingActive}. Processed ${postContainers.length} total posts.`);
  backgroundLog(`🏁 Loop exit reason: Reached max posts? ${commentCount >= maxPosts}, Lost active status? ${!isCommentingActive}, Ran out of posts? ${postContainers.length === 0}`);
  console.groupEnd();
  backgroundGroupEnd();
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
    // const contentContainer = postContainer.querySelector('.fie-impression-container');
    const contentContainer = postContainer.querySelector('.feed-shared-inline-show-more-text');
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
      console.error('⏰ TIMEOUT - No response from background script within 30 seconds');
      resolve('Great post! Thanks for sharing.');
    }, 30000);
    
    // Retry mechanism for connection issues
    const attemptGeneration = (attempt: number = 1): void => {
      console.log(`🔄 Attempt ${attempt}/3: Sending comment generation request...`);
    
    chrome.runtime.sendMessage({
      action: 'generateComment',
      postContent: postContent
    }, (response) => {
      clearTimeout(timeout); // Clear the timeout since we got a response
      
      if (chrome.runtime.lastError) {
          console.error(`💥 ATTEMPT ${attempt} FAILED - Chrome runtime error:`, chrome.runtime.lastError);
          
          // Check if it's a connection error and retry
          if (chrome.runtime.lastError.message?.includes('Could not establish connection') && attempt < 3) {
            console.log(`🔄 Connection error detected, retrying in 2 seconds... (attempt ${attempt + 1}/3)`);
            setTimeout(() => {
              attemptGeneration(attempt + 1);
            }, 2000);
            return;
          }
          
        console.error('💥 FALLBACK REASON: Chrome runtime error during comment generation');
        console.error('💥 CHROME ERROR:', chrome.runtime.lastError);
        console.error('💥 This usually means the background script crashed or message passing failed');
        resolve('Great post! Thanks for sharing.');
      } else if (!response) {
          console.error(`❌ ATTEMPT ${attempt} FAILED - No response received from background script`);
          
          // Retry if no response
          if (attempt < 3) {
            console.log(`🔄 No response received, retrying in 2 seconds... (attempt ${attempt + 1}/3)`);
            setTimeout(() => {
              attemptGeneration(attempt + 1);
            }, 2000);
            return;
          }
          
          console.error('❌ FALLBACK REASON: No response received from background script after 3 attempts');
        console.error('❌ RESPONSE NULL - Background script may have failed silently');
        resolve('Great post! Thanks for sharing.');
      } else if (!response.comment) {
        console.error('⚠️ FALLBACK REASON: Response received but no comment field');
        console.error('⚠️ INVALID RESPONSE STRUCTURE:', response);
        console.error('⚠️ Expected response.comment but got:', Object.keys(response));
        resolve('Great post! Thanks for sharing.');
      } else if (response.comment === 'Great post! Thanks for sharing.') {
        console.error('🚨 FALLBACK REASON: Background script returned the default fallback comment');
          console.error('🚨 This means the AI API failed and background script used fallback');
        
        // Check if error details were provided in the response
        if (response.error) {
            console.group('🔥 AI API ERROR DETAILS FROM RESPONSE');
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
    };
    
    // Start the first attempt
    attemptGeneration(1);
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

// // Updated audio functions to work with the new Web Audio API approach
// function keepTabActiveAudio() {
//   try {
//     console.log('🔊 Continuous audio is already running from user interaction...');
    
//     // Audio is already started by the start button click
//     // This function now just ensures it keeps running
//     if (!audioContext || !currentOscillator || !audioElement) {
//       console.log('🔊 Audio not running, starting fresh...');
//       // If audio isn't running for some reason, try to start it
//       // Note: This might fail without user gesture
//       injectAndPlayContinuousSound().catch(error => {
//         console.warn('⚠️ Failed to restart audio without user gesture:', error);
//       });
//     } else {
//       console.log('🔊 Audio already active and continuous');
//     }
    
//   } catch (error) {
//     console.warn('⚠️ Audio check failed:', error);
//   }
// }

function stopTabActiveAudio() {
  try {
    console.log('🔇 Stopping continuous audio...');
    
    if (currentOscillator) {
      currentOscillator.stop();
      currentOscillator = null;
    }
    
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
      audioElement = null;
    }
    
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
    
    console.log('🔇 Continuous audio stopped');
  } catch (error) {
    console.warn('⚠️ Error stopping audio:', error);
  }
}

console.log('LinkedIn Auto Commenter content script loaded - Background Window Mode');
