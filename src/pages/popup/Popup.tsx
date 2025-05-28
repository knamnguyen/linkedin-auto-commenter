import React, { useState, useEffect } from 'react';

// Default comment style guide
const DEFAULT_STYLE_GUIDE = `You are about to write a LinkedIn comment. Imagine you are a young professional or ambitious student (Gen Z), scrolling through your LinkedIn feed during a quick break – maybe between classes, on your commute, or while grabbing a coffee. You're sharp, interested in tech, business, career growth, personal development, social impact, product, marketing, or entrepreneurship. You appreciate authentic, slightly edgy, and insightful content.

You've just read a LinkedIn post (which I will provide). Your goal is to leave a comment that sounds genuinely human – like a real thought that just popped into your head.

Your Commenter Persona (reflecting the target audience of the original poster):

Curious & Engaged: Genuinely interested in the topic.
Slightly Skeptical/Analytical: You don't just accept things at face value; you might gently question or offer a slightly different angle, but respectfully.
Relatable: You might connect it to a brief, personal thought or observation without writing an essay.
Informal but Smart: Your language is casual, like texting a knowledgeable friend or colleague, but your thoughts are intelligent.
Appreciative of Nuance: You pick up on deeper points, not just surface-level stuff.
CRITICAL: How to Sound Human and AVOID Sounding Like AI:

The biggest challenge is to avoid the "AI smell." Here's how:

DON'T Start with Generic Reactions: Absolutely avoid starting with "Wow!", "Great post!", "Amazing insight!", "This is so true!", "Love this!", "Thanks for sharing!" or any similar generic positive opener. Humans rarely do this unless they're being very low-effort.
DO React to ONE Specific Thing (if anything): If one particular phrase, idea, or example in the post genuinely caught your eye, mention that specific thing. "That point about [specific detail] is interesting because..." or "Hmm, the idea of [specific concept] makes me wonder..." If nothing specific stands out strongly, it's okay to make a more general observation, but still try to make it feel personal.
DON'T Systematically Address Multiple Points: AI often tries to summarize or hit every key takeaway. A human usually latches onto one or two things at most.
DO Embrace Imperfect, Natural Language:
Sentence Fragments are Good: "Interesting take on X." or "Definitely something I've been thinking about."
Varied Sentence Length: Mix it up. A short punchy sentence. Then maybe one that rambles a bit as if you're thinking aloud. Example: "Solid point. I've seen a lot of people struggle with this, especially when they're just starting out and the pressure is on to have all the answers, you know?"
Start Mid-Thought (Sometimes): "Yeah, been mulling over something similar..." or "It's funny, I was just discussing [related topic]..."
Casual Connectors (or none): Use "so," "but," "and," "though." Avoid "furthermore," "moreover," "in addition," "consequently." Sometimes, just jump to the next thought.
DON'T Use Perfect Punctuation and Grammar Obsessively: While it shouldn't be sloppy, it shouldn't feel like a perfectly edited essay. A slightly more relaxed approach is more human. Think text message or quick email to a colleague. (e.g., a comma splice might be okay if it reflects how someone would speak).
DO Ask Genuine Questions (or don't): If the post sparks a real question in your "mind," ask it. But don't force a question just for "engagement." Sometimes a statement or observation is enough. If you do ask, make it specific and not a generic "What do others think?"
DON'T End with Generic Engagement Bait: Avoid "Looking forward to more content!" or "What are your thoughts?" unless it flows perfectly and genuinely from your specific comment. A comment can just... end.
DO Inject Mild, Believable Emotion/Personality:
Skepticism/Challenge (gentle): "I get that, but I wonder if X is also a big factor?" or "Is that always the case though? I've seen Y happen too."
Relatability: "Totally get that feeling." or "Reminds me of when I..." (keep it brief).
A New Angle: "Another way to look at it could be..."
DON'T Over-Explain or Just Paraphrase: Add a new thought, however small. Don't just reword what the post said.
Length is Variable: Could be one sharp sentence. Could be 2-3 sentences. Whatever feels like a natural, quick thought. Don't force length.
Avoid "AI Voice" Vocabulary: Steer clear of words that sound overly formal, analytical in a detached way, or overly enthusiastic in a generic way. No "It is imperative," "This elucidates," "A quintessential example."
Think "Interruption": Your comment is a slight, thoughtful interruption in your scrolling. It's not a prepared speech.
Your Task:

Read the provided LinkedIn post. Then, write a comment that embodies this human, Gen Z persona, adhering strictly to the "How to Sound Human" guidelines above. Make it feel like a genuine, spontaneous reaction.

Remember the core principle: You're a real person scrolling your feed who had a quick, authentic thought. Not an AI trying to optimize for engagement or demonstrate comprehension.`;

// Default API key
const DEFAULT_API_KEY = 'AIzaSyDXwKB6h-jGMaOrq88461CcJt4KZpwh8aM';

export default function Popup() {
  const [styleGuide, setStyleGuide] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [scrollDuration, setScrollDuration] = useState(10);
  const [commentDelay, setCommentDelay] = useState(10);
  const [maxPosts, setMaxPosts] = useState(20);
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [commentCount, setCommentCount] = useState(0);
  const [totalAllTimeComments, setTotalAllTimeComments] = useState(0);
  const [totalTodayComments, setTotalTodayComments] = useState(0);
  const [lastError, setLastError] = useState<any>(null);

  // Load saved data from storage on component mount
  useEffect(() => {
    chrome.storage.local.get([
      'apiKey', 'styleGuide', 'scrollDuration', 
      'commentDelay', 'maxPosts', 'spectatorMode', 'totalAllTimeComments',
      'isRunning', 'currentCommentCount'
    ], (result) => {
      if (result.apiKey) setApiKey(result.apiKey);
      if (result.styleGuide) setStyleGuide(result.styleGuide);
      if (result.scrollDuration) setScrollDuration(result.scrollDuration);
      if (result.commentDelay) setCommentDelay(result.commentDelay);
      if (result.maxPosts) setMaxPosts(result.maxPosts);
      if (result.spectatorMode !== undefined) setSpectatorMode(result.spectatorMode);
      if (result.totalAllTimeComments) setTotalAllTimeComments(result.totalAllTimeComments);
      
      // Restore running state if it exists
      if (result.isRunning) setIsRunning(result.isRunning);
      if (result.currentCommentCount) setCommentCount(result.currentCommentCount);
    });

    // Load today's comments
    loadTodayComments();

    // Listen for status updates from background script
    const messageListener = (request: any, sender: any, sendResponse: any) => {
      if (request.action === 'statusUpdate') {
        setStatus(request.status);
        
        // Handle error details for debugging
        if (request.error) {
          setLastError(request.error);
          console.error('LinkedIn Auto Commenter Error Details:', request.error);
        }
        
        if (request.commentCount !== undefined) {
          setCommentCount(request.commentCount);
          // Save current run state to storage
          chrome.storage.local.set({ currentCommentCount: request.commentCount });
        }
        if (request.isRunning !== undefined) {
          setIsRunning(request.isRunning);
          chrome.storage.local.set({ isRunning: request.isRunning });
          
          // If process completed, update all-time total and today's total
          if (!request.isRunning && request.commentCount > 0) {
            const newAllTimeTotal = totalAllTimeComments + request.commentCount;
            const newTodayTotal = totalTodayComments + request.commentCount;
            setTotalAllTimeComments(newAllTimeTotal);
            setTotalTodayComments(newTodayTotal);
            chrome.storage.local.set({ totalAllTimeComments: newAllTimeTotal });
            saveTodayComments(newTodayTotal);
          }
        }
        // Always check for updated all-time total from background script
        if (request.newAllTimeTotal !== undefined) {
          setTotalAllTimeComments(request.newAllTimeTotal);
          chrome.storage.local.set({ totalAllTimeComments: request.newAllTimeTotal });
        }
        if (request.totalAllTimeComments !== undefined) {
          setTotalAllTimeComments(request.totalAllTimeComments);
          chrome.storage.local.set({ totalAllTimeComments: request.totalAllTimeComments });
        }
        if (request.newTodayTotal !== undefined) {
          setTotalTodayComments(request.newTodayTotal);
          saveTodayComments(request.newTodayTotal);
        }
      } else if (request.action === 'realTimeCountUpdate') {
        // Handle real-time count updates from content script
        if (request.todayCount !== undefined) {
          setTotalTodayComments(request.todayCount);
          saveTodayComments(request.todayCount);
        }
        if (request.allTimeCount !== undefined) {
          setTotalAllTimeComments(request.allTimeCount);
          chrome.storage.local.set({ totalAllTimeComments: request.allTimeCount });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [totalAllTimeComments, totalTodayComments]);

  // Function to load today's comments
  const loadTodayComments = () => {
    const today = new Date().toDateString();
    const storageKey = `comments_today_${today}`;
    
    chrome.storage.local.get([storageKey], (result) => {
      const todayCount = result[storageKey] || 0;
      setTotalTodayComments(todayCount);
    });
  };

  // Function to save today's comments
  const saveTodayComments = (count: number) => {
    const today = new Date().toDateString();
    const storageKey = `comments_today_${today}`;
    chrome.storage.local.set({ [storageKey]: count });
  };

  // Save settings to storage when they change
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    chrome.storage.local.set({ apiKey: value });
  };

  const handleStyleGuideChange = (value: string) => {
    setStyleGuide(value);
    chrome.storage.local.set({ styleGuide: value });
  };

  const handleScrollDurationChange = (value: number) => {
    setScrollDuration(value);
    chrome.storage.local.set({ scrollDuration: value });
  };

  const handleCommentDelayChange = (value: number) => {
    setCommentDelay(value);
    chrome.storage.local.set({ commentDelay: value });
  };

  const handleMaxPostsChange = (value: number) => {
    setMaxPosts(value);
    chrome.storage.local.set({ maxPosts: value });
  };

  const handleSpectatorModeChange = (value: boolean) => {
    setSpectatorMode(value);
    chrome.storage.local.set({ spectatorMode: value });
  };

  const handleSetDefaultStyleGuide = () => {
    setStyleGuide(DEFAULT_STYLE_GUIDE);
    chrome.storage.local.set({ styleGuide: DEFAULT_STYLE_GUIDE });
  };

  const handleSetDefaultApiKey = () => {
    setApiKey(DEFAULT_API_KEY);
    chrome.storage.local.set({ apiKey: DEFAULT_API_KEY });
  };

  const handleStart = async () => {
    if (!styleGuide.trim()) {
      setStatus('Please enter a style guide for your comments.');
      return;
    }
    
    if (!apiKey.trim()) {
      setStatus('Please enter your Google AI Studio API key.');
      return;
    }

    setIsRunning(true);
    setCommentCount(0);
    setStatus('Starting LinkedIn auto-commenting...');

    try {
      await chrome.runtime.sendMessage({
        action: 'startAutoCommenting',
        styleGuide: styleGuide.trim(),
        apiKey: apiKey.trim(),
        scrollDuration: scrollDuration,
        commentDelay: commentDelay,
        maxPosts: maxPosts,
        spectatorMode: spectatorMode
      });
    } catch (error) {
      console.error('Error starting auto-commenting:', error);
      setStatus('Error starting the process. Please try again.');
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      // Update all-time total and today's total before stopping
      if (commentCount > 0) {
        const newAllTimeTotal = totalAllTimeComments + commentCount;
        const newTodayTotal = totalTodayComments + commentCount;
        setTotalAllTimeComments(newAllTimeTotal);
        setTotalTodayComments(newTodayTotal);
        chrome.storage.local.set({ totalAllTimeComments: newAllTimeTotal });
        saveTodayComments(newTodayTotal);
      }
      
      await chrome.runtime.sendMessage({
        action: 'stopAutoCommenting'
      });
      setIsRunning(false);
      setStatus('Auto-commenting process stopped and reset.');
      setCommentCount(0);
      
      // Clear current run state from storage
      chrome.storage.local.set({ 
        isRunning: false,
        currentCommentCount: 0
      });
    } catch (error) {
      console.error('Error stopping auto-commenting:', error);
    }
  };

  return (
    <div className="w-[500px] h-[800px] p-6 bg-white overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">LinkedIn Auto Commenter</h2>
        <p className="text-sm text-gray-600">Automatically comment on LinkedIn posts using AI</p>
        <div className="mt-2 space-y-1">
          <div className="p-2 bg-green-50 border border-green-200 rounded-md">
            <span className="text-xs text-green-700 font-medium">
              🎉 Total comments all-time: <span className="font-bold">{totalAllTimeComments}</span>
            </span>
          </div>
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
            <span className="text-xs text-blue-700 font-medium">
              📅 Comments posted today: <span className="font-bold">{totalTodayComments}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Status Display */}
      {isRunning && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">🚀 LinkedIn commenting running</span>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-blue-600 font-medium">📝 {commentCount}/{maxPosts}</span>
            </div>
          </div>
          <div className="text-xs text-blue-700 mb-2">{status}</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600">This session: {commentCount}</span>
            <span className="text-blue-600">Target: {maxPosts} posts</span>
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Mode: {spectatorMode ? 'Spectator (visible)' : 'Background (pinned tab)'}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google AI Studio API Key:
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="Enter your Google AI Studio API key"
          className="w-full p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isRunning}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            Get your API key from{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Google AI Studio
            </a>
          </p>
          <button
            onClick={handleSetDefaultApiKey}
            disabled={isRunning}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Default API Key
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comment Style Guide:
        </label>
        <textarea
          value={styleGuide}
          onChange={(e) => handleStyleGuideChange(e.target.value)}
          placeholder="Describe your commenting style... e.g., 'Professional but friendly, ask thoughtful questions, share relevant insights, keep responses under 50 words, add value to the conversation'"
          className="w-full h-20 p-3 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isRunning}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSetDefaultStyleGuide}
            disabled={isRunning}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Default Style
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Feed Scroll Duration:
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="5"
            max="30"
            value={scrollDuration}
            onChange={(e) => handleScrollDurationChange(parseInt(e.target.value))}
            disabled={isRunning}
            className="flex-1"
          />
          <span className="text-sm font-medium w-16">{scrollDuration}s</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Time to scroll the feed to load more posts
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Max Posts to Comment On:
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="5"
            max="50"
            value={maxPosts}
            onChange={(e) => handleMaxPostsChange(parseInt(e.target.value))}
            disabled={isRunning}
            className="flex-1"
          />
          <span className="text-sm font-medium w-16">{maxPosts}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Maximum number of posts to comment on in one session
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seconds Between Each Comment:
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="5"
            max="60"
            value={commentDelay}
            onChange={(e) => handleCommentDelayChange(parseInt(e.target.value))}
            disabled={isRunning}
            className="flex-1"
          />
          <span className="text-sm font-medium w-16">{commentDelay}s</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Delay between processing each post to avoid being flagged
        </p>
      </div>

      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={spectatorMode}
            onChange={(e) => handleSpectatorModeChange(e.target.checked)}
            disabled={isRunning}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            👁️ Spectator Mode
            {spectatorMode && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">ENABLED</span>}
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {spectatorMode ? 
            '🎯 Opens LinkedIn feed in active tab so you can watch the commenting process' : 
            '⚡ Runs in background with pinned, inactive tab for minimal disruption'
          }
        </p>
      </div>

      <div className="mb-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            disabled={!styleGuide.trim() || !apiKey.trim()}
          >
            Start Auto Commenting
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            Stop Auto Commenting
          </button>
        )}
      </div>

      {status && !isRunning && (
        <div className="text-sm text-gray-700 bg-gray-100 p-3 rounded-md border-l-4 border-blue-500 mb-4">
          {status}
        </div>
      )}

      {/* Error Details for Debugging */}
      {lastError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-800">🐛 Debug Info</span>
            <button 
              onClick={() => setLastError(null)}
              className="text-xs text-red-600 hover:text-red-800"
            >
              ✕ Clear
            </button>
          </div>
          <div className="text-xs text-red-700 space-y-1">
            <div><strong>Message:</strong> {lastError.message}</div>
            {lastError.status && <div><strong>Status:</strong> {lastError.status} - {lastError.statusText}</div>}
            {lastError.apiKey && <div><strong>API Key:</strong> {lastError.apiKey}</div>}
            {lastError.styleGuide && <div><strong>Style Guide:</strong> {lastError.styleGuide}</div>}
            {lastError.postContentLength !== undefined && <div><strong>Post Length:</strong> {lastError.postContentLength} chars</div>}
            {lastError.body && (
              <div className="mt-2">
                <strong>Response:</strong>
                <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-x-auto max-h-20">
                  {typeof lastError.body === 'string' ? lastError.body : JSON.stringify(lastError.body, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Settings Summary:</h3>
        <ul className="text-xs text-gray-600 space-y-1 mb-3">
          <li>• Feed scroll: {scrollDuration}s</li>
          <li>• Max posts: {maxPosts}</li>
          <li>• Comment delay: {commentDelay}s between posts</li>
          <li>• Mode: {spectatorMode ? 'Spectator (visible)' : 'Background (pinned tab)'}</li>
        </ul>

        <div className="text-xs text-gray-500">
          <p className="font-medium text-gray-600 mb-1">⚠️ Use responsibly:</p>
          <p className="mb-2">Monitor posted comments and ensure they add value to conversations</p>
          <p className="text-blue-600 font-medium">
            🔄 New mode: Comments directly on the feed page without opening individual posts
          </p>
        </div>
      </div>
    </div>
  );
}
