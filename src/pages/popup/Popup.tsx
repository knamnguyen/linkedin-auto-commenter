import React, { useState, useEffect } from 'react';

export default function Popup() {
  const [styleGuide, setStyleGuide] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [processingMode, setProcessingMode] = useState<'sequential' | 'parallel'>('sequential');
  const [scrollDuration, setScrollDuration] = useState(10);
  const [batchDelay, setBatchDelay] = useState(5);
  const [sequentialDelay, setSequentialDelay] = useState(10);
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [commentCount, setCommentCount] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalAllTimeComments, setTotalAllTimeComments] = useState(0);

  // Load saved data from storage on component mount
  useEffect(() => {
    chrome.storage.local.get([
      'apiKey', 'styleGuide', 'processingMode', 'scrollDuration', 
      'batchDelay', 'sequentialDelay', 'spectatorMode', 'totalAllTimeComments',
      'isRunning', 'currentCommentCount', 'currentBatch', 'totalBatches'
    ], (result) => {
      if (result.apiKey) setApiKey(result.apiKey);
      if (result.styleGuide) setStyleGuide(result.styleGuide);
      if (result.processingMode) setProcessingMode(result.processingMode);
      if (result.scrollDuration) setScrollDuration(result.scrollDuration);
      if (result.batchDelay) setBatchDelay(result.batchDelay);
      if (result.sequentialDelay) setSequentialDelay(result.sequentialDelay);
      if (result.spectatorMode !== undefined) setSpectatorMode(result.spectatorMode);
      if (result.totalAllTimeComments) setTotalAllTimeComments(result.totalAllTimeComments);
      
      // Restore running state if it exists
      if (result.isRunning) setIsRunning(result.isRunning);
      if (result.currentCommentCount) setCommentCount(result.currentCommentCount);
      if (result.currentBatch) setCurrentBatch(result.currentBatch);
      if (result.totalBatches) setTotalBatches(result.totalBatches);
    });

    // Listen for status updates from background script
    const messageListener = (request: any, sender: any, sendResponse: any) => {
      if (request.action === 'statusUpdate') {
        setStatus(request.status);
        if (request.commentCount !== undefined) {
          setCommentCount(request.commentCount);
          // Save current run state to storage
          chrome.storage.local.set({ currentCommentCount: request.commentCount });
        }
        if (request.currentBatch !== undefined) {
          setCurrentBatch(request.currentBatch);
          chrome.storage.local.set({ currentBatch: request.currentBatch });
        }
        if (request.totalBatches !== undefined) {
          setTotalBatches(request.totalBatches);
          chrome.storage.local.set({ totalBatches: request.totalBatches });
        }
        if (request.isRunning !== undefined) {
          setIsRunning(request.isRunning);
          chrome.storage.local.set({ isRunning: request.isRunning });
          
          // If process completed, update all-time total
          if (!request.isRunning && request.commentCount > 0) {
            const newTotal = totalAllTimeComments + request.commentCount;
            setTotalAllTimeComments(newTotal);
            chrome.storage.local.set({ totalAllTimeComments: newTotal });
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
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Save settings to storage when they change
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    chrome.storage.local.set({ apiKey: value });
  };

  const handleStyleGuideChange = (value: string) => {
    setStyleGuide(value);
    chrome.storage.local.set({ styleGuide: value });
  };

  const handleProcessingModeChange = (value: 'sequential' | 'parallel') => {
    setProcessingMode(value);
    chrome.storage.local.set({ processingMode: value });
  };

  const handleScrollDurationChange = (value: number) => {
    setScrollDuration(value);
    chrome.storage.local.set({ scrollDuration: value });
  };

  const handleBatchDelayChange = (value: number) => {
    setBatchDelay(value);
    chrome.storage.local.set({ batchDelay: value });
  };

  const handleSequentialDelayChange = (value: number) => {
    setSequentialDelay(value);
    chrome.storage.local.set({ sequentialDelay: value });
  };

  const handleSpectatorModeChange = (value: boolean) => {
    setSpectatorMode(value);
    chrome.storage.local.set({ spectatorMode: value });
  };

  const handleStart = async () => {
    if (!styleGuide.trim()) {
      setStatus('Please enter a style guide for your comments.');
      return;
    }
    
    if (!apiKey.trim()) {
      setStatus('Please enter your OpenRouter API key.');
      return;
    }

    setIsRunning(true);
    setCommentCount(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setStatus(`Starting LinkedIn auto-commenting in ${processingMode} mode...`);

    try {
      await chrome.runtime.sendMessage({
        action: 'startAutoCommenting',
        styleGuide: styleGuide.trim(),
        apiKey: apiKey.trim(),
        processingMode: processingMode,
        scrollDuration: scrollDuration,
        batchDelay: batchDelay,
        sequentialDelay: sequentialDelay,
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
      // Update all-time total before stopping
      if (commentCount > 0) {
        const newTotal = totalAllTimeComments + commentCount;
        setTotalAllTimeComments(newTotal);
        chrome.storage.local.set({ totalAllTimeComments: newTotal });
      }
      
      await chrome.runtime.sendMessage({
        action: 'stopAutoCommenting'
      });
      setIsRunning(false);
      setStatus('Auto-commenting process stopped and reset.');
      setCommentCount(0);
      setCurrentBatch(0);
      setTotalBatches(0);
      
      // Clear current run state from storage
      chrome.storage.local.set({ 
        isRunning: false,
        currentCommentCount: 0,
        currentBatch: 0,
        totalBatches: 0
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
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <span className="text-xs text-green-700 font-medium">
            🎉 Total comments posted all-time: <span className="font-bold">{totalAllTimeComments}</span>
          </span>
        </div>
      </div>

      {/* Status Display */}
      {isRunning && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">🚀 LinkedIn commenting running</span>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-blue-600 font-medium">📝 {commentCount}</span>
              {processingMode === 'parallel' && totalBatches > 0 && (
                <span className="text-sm text-blue-600">Batch: {currentBatch}/{totalBatches}</span>
              )}
            </div>
          </div>
          <div className="text-xs text-blue-700 mb-2">{status}</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-600">Mode: {processingMode}{spectatorMode ? ' + spectator' : ''}</span>
            <span className="text-blue-600">This session: {commentCount}</span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          OpenRouter API Key:
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="Enter your OpenRouter API key"
          className="w-full p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isRunning}
        />
        <p className="text-xs text-gray-500 mt-1">
          Get your API key from{' '}
          <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            OpenRouter.ai
          </a>
        </p>
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
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Processing Mode:
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="processingMode"
              value="sequential"
              checked={processingMode === 'sequential'}
              onChange={(e) => handleProcessingModeChange(e.target.value as 'sequential' | 'parallel')}
              disabled={isRunning}
              className="mr-2"
            />
            <span className="text-sm">
              <strong>Sequential</strong> - Process posts one by one (safer, slower)
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="processingMode"
              value="parallel"
              checked={processingMode === 'parallel'}
              onChange={(e) => handleProcessingModeChange(e.target.value as 'sequential' | 'parallel')}
              disabled={isRunning}
              className="mr-2"
            />
            <span className="text-sm">
              <strong>Parallel</strong> - Process posts in batches of 5 (faster, smart loading)
            </span>
          </label>
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
      </div>

      {processingMode === 'parallel' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delay Between Batches:
          </label>
          <div className="flex items-center space-x-2">
                      <input
            type="range"
            min="0"
            max="30"
            value={batchDelay}
            onChange={(e) => handleBatchDelayChange(parseInt(e.target.value))}
            disabled={isRunning}
            className="flex-1"
          />
            <span className="text-sm font-medium w-16">{batchDelay}s</span>
          </div>
        </div>
      )}

      {processingMode === 'sequential' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delay Between Posts:
          </label>
          <div className="flex items-center space-x-2">
                      <input
            type="range"
            min="0"
            max="60"
            value={sequentialDelay}
            onChange={(e) => handleSequentialDelayChange(parseInt(e.target.value))}
            disabled={isRunning}
            className="flex-1"
          />
            <span className="text-sm font-medium w-16">{sequentialDelay}s</span>
          </div>
        </div>
      )}

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
            '🎯 Batches of 5 tabs will be prepared, then you\'ll watch each comment being posted one by one' : 
            '⚡ Comments will be posted automatically in batches without showing you'
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
            Start Auto Commenting ({processingMode})
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            Stop & Reset Auto Commenting
          </button>
        )}
      </div>

      {status && !isRunning && (
        <div className="text-sm text-gray-700 bg-gray-100 p-3 rounded-md border-l-4 border-blue-500 mb-4">
          {status}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Settings Summary:</h3>
        <ul className="text-xs text-gray-600 space-y-1 mb-3">
          <li>• Feed scroll: {scrollDuration}s</li>
          {processingMode === 'sequential' ? (
            <li>• Sequential delay: {sequentialDelay}s between posts</li>
          ) : (
            <li>• Batch delay: {batchDelay}s between batches of 5</li>
          )}
          <li>• Spectator mode: {spectatorMode ? 'Enabled' : 'Disabled'}</li>
          <li>• Mode: {processingMode}</li>
        </ul>

        <div className="text-xs text-gray-500">
          <p className="font-medium text-gray-600 mb-1">⚠️ Use responsibly:</p>
          <p className="mb-2">Monitor posted comments and ensure they add value to conversations</p>
          {spectatorMode && (
            <p className="text-green-600 font-medium">
              👁️ Spectator mode will show you each comment before posting
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
