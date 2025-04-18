document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('audio-form');
    const apiKeyInput = document.getElementById('elevenlabs-api-key');
    const threadUrlInput = document.getElementById('hn-thread-url');
    const threadSelectorContainer = document.getElementById('thread-selector-container');
    const commentLimitContainer = document.getElementById('comment-limit-container');
    const commentLimitSelect = document.getElementById('comment-limit-select');
    const customCommentLimitContainer = document.getElementById('custom-comment-limit-container');
    const customCommentLimitInput = document.getElementById('custom-comment-limit');
    const generateBtn = document.getElementById('generate-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressStats = document.getElementById('progress-stats');
    const currentUser = document.getElementById('current-user');
    const statusMessage = document.getElementById('status-message');
    const resultContainer = document.getElementById('result-container');
    const resultAudio = document.getElementById('result-audio');
    const downloadBtn = document.getElementById('download-btn');
    const retryBtn = document.getElementById('retry-btn');
    const apiKeyError = document.getElementById('api-key-error');
    const urlError = document.getElementById('url-error');
    const themeToggle = document.getElementById('theme-toggle');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const infoTooltip = document.getElementById('api-key-info');
    const inputModeSelector = document.getElementById('input-mode-selector');
    const urlInputContainer = document.getElementById('url-input-container');
    const costEstimate = document.getElementById('cost-estimate');
    const topStoriesContainer = document.getElementById('top-stories-container');
    const linksContainer = document.getElementById('shared-links-container');
    const linksToggle = document.getElementById('shared-links-toggle');
    const linksContent = document.getElementById('shared-links-content');

    // State variables
    let audioBlobs = [];
    let voiceMapping = {};
    let commentersCount = {}; // Track how many comments each user has
    let commentsByUser = {}; // Track all comments by each user
    let availableVoices = [];
    let processedComments = 0;
    let totalComments = 0;
    let totalCharacters = 0;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let allComments = []; // Store all comments for preprocessing
    let commentHierarchy = {}; // Store parent-child relationships
    let sharedLinks = []; // Store links shared in comments
    let selectedThreadIds = []; // Store selected thread IDs for multi-thread mode
    let lastProcessedCommentIndex = -1; // For resuming after errors
    let audioChapters = []; // Store chapter information for audio metadata

    // Introduction phrases for variety
    const firstIntroductions = [
        "Hey, {username} here.",
        "Hi it's {username}.",
        "Howdy I'm {username}.",
        "Hi y'all it's {username}.",
        "{username} here!",
        "This is {username} speaking.",
        "Hello everyone, {username} joining the conversation.",
        "{username} chiming in."
    ];
    
    const returnIntroductions = [
        "Hey, it's {username} again.",
        "{username} back again.",
        "Once more from {username}.",
        "{username} with another point.",
        "Adding to my earlier comment, this is {username}.",
        "{username} here with another thought.",
        "Coming back to this thread, {username} here."
    ];
    
    const replyIntroductions = [
        "(in response to {username})",
        "(replying to {username})",
        "A word to {username}: ",
        "Quick comment to {username}!",
        "Addressing {username}'s point: ",
        "Regarding what {username} said: ",
        "My thoughts on {username}'s comment: ",
        "To answer {username}: "
    ];

    // Quote transformation phrases
    const quoteIntroductions = [
        "I read this: ",
        "Let me quote: ",
        "Allow me to quote: ",
        "I'm reacting to this: ",
        "Commenting on this: ",
        "A few words about this: ",
        "Here's what was said: ",
        "To address this quote: "
    ];

    const quoteEndings = [
        "End of quote.",
        "That's the quote.",
        "Quote ends here.",
        "End of citation.",
        "That concludes the quote."
    ];

    // Link replacement phrases
    const firstLinkPhrases = [
        "See the link I shared in the thread.",
        "Check out the link I posted.",
        "I've included a link with more details.",
        "There's a link in my comment with more information.",
        "Follow the link in my post for more context."
    ];

    const secondLinkPhrases = [
        "I have shared a second link as well.",
        "There's another link worth checking out.",
        "I've included another reference link.",
        "A second link is also available in my comment.",
        "You might want to look at my second link too."
    ];

    const multipleLinksPhrases = [
        "I am sharing some other links as well.",
        "I've included several other references.",
        "There are more links in my comment.",
        "I've shared multiple links for reference.",
        "Check out the several links in my post."
    ];

    // Initialize UI based on localStorage
    function initializeUI() {
        // Load theme preference
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        // Initialize input mode
        const savedInputMode = localStorage.getItem('inputMode') || 'url';
        inputModeSelector.value = savedInputMode;
        toggleInputMode(savedInputMode);
        
        // Initialize comment limit selection
        const savedLimitMode = localStorage.getItem('commentLimitMode') || 'all';
        commentLimitSelect.value = savedLimitMode;
        toggleCommentLimitInput(savedLimitMode);
        
        // Load custom limit if saved
        if (savedLimitMode === 'custom') {
            const savedCustomLimit = localStorage.getItem('customCommentLimit');
            if (savedCustomLimit) {
                customCommentLimitInput.value = savedCustomLimit;
            }
        }
    }

    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggle.innerHTML = isDarkMode ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
        
        // Save preference to localStorage
        localStorage.setItem('darkMode', isDarkMode);
    });

    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });

    // Toggle API key info tooltip
    if (infoTooltip) {
        infoTooltip.addEventListener('click', (e) => {
            e.preventDefault();
            const tooltip = document.getElementById('api-tooltip');
            tooltip.classList.toggle('visible');
        });
    }

    // Input mode selector
    inputModeSelector.addEventListener('change', () => {
        const mode = inputModeSelector.value;
        toggleInputMode(mode);
        localStorage.setItem('inputMode', mode);
    });

    // Comment limit selector
    commentLimitSelect.addEventListener('change', () => {
        const mode = commentLimitSelect.value;
        toggleCommentLimitInput(mode);
        localStorage.setItem('commentLimitMode', mode);
    });

    // Custom comment limit input
    customCommentLimitInput.addEventListener('change', () => {
        localStorage.setItem('customCommentLimit', customCommentLimitInput.value);
        updateCostEstimate();
    });

    // Toggle shared links container
    if (linksToggle) {
        linksToggle.addEventListener('click', () => {
            linksContent.classList.toggle('expanded');
            const isExpanded = linksContent.classList.contains('expanded');
            linksToggle.innerHTML = isExpanded ? 
                '<i class="fas fa-chevron-up"></i>' : 
                '<i class="fas fa-chevron-down"></i>';
        });
    }

    // Toggle input mode between URL and top stories
    function toggleInputMode(mode) {
        if (mode === 'url') {
            urlInputContainer.classList.remove('hidden');
            threadSelectorContainer.classList.add('hidden');
            selectedThreadIds = [];
        } else {
            urlInputContainer.classList.add('hidden');
            threadSelectorContainer.classList.remove('hidden');
            fetchTopStories();
        }
    }

    // Toggle comment limit input visibility
    function toggleCommentLimitInput(mode) {
        if (mode === 'custom') {
            customCommentLimitContainer.classList.remove('hidden');
        } else {
            customCommentLimitContainer.classList.add('hidden');
        }
        updateCostEstimate();
    }

    // Fetch top stories from HN API
    async function fetchTopStories() {
        try {
            statusMessage.textContent = 'Fetching top stories...';
            topStoriesContainer.innerHTML = '<p>Loading...</p>';
            
            const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch top stories: ${response.status}`);
            }
            
            const storyIds = await response.json();
            const topStoryIds = storyIds.slice(0, 100);
            
            // Fetch story details in parallel
            const storyPromises = topStoryIds.map(id => fetchHNThread(id));
            const stories = await Promise.all(storyPromises);
            
            // Filter out invalid stories
            const validStories = stories.filter(story => story && story.title);
            
            // Display stories with checkboxes
            displayTopStories(validStories);
            statusMessage.textContent = '';
        } catch (error) {
            topStoriesContainer.innerHTML = `<p class="error">Error loading top stories: ${error.message}</p>`;
            statusMessage.textContent = '';
        }
    }

    // Display top stories with checkboxes
    function displayTopStories(stories) {
        topStoriesContainer.innerHTML = '';
        
        const storyList = document.createElement('div');
        storyList.className = 'story-list';
        
        stories.forEach(story => {
            const storyItem = document.createElement('div');
            storyItem.className = 'story-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `story-${story.id}`;
            checkbox.value = story.id;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!selectedThreadIds.includes(story.id)) {
                        selectedThreadIds.push(story.id);
                    }
                } else {
                    selectedThreadIds = selectedThreadIds.filter(id => id !== story.id);
                }
                updateCostEstimate();
            });
            
            const label = document.createElement('label');
            label.htmlFor = `story-${story.id}`;
            
            const title = document.createElement('span');
            title.className = 'story-title';
            title.textContent = story.title;
            
            const meta = document.createElement('span');
            meta.className = 'story-meta';
            meta.textContent = `${story.score || 0} points by ${story.by || 'unknown'} | ${story.descendants || 0} comments`;
            
            label.appendChild(title);
            label.appendChild(meta);
            
            storyItem.appendChild(checkbox);
            storyItem.appendChild(label);
            storyList.appendChild(storyItem);
        });
        
        topStoriesContainer.appendChild(storyList);
    }

    // Update cost estimate based on current settings
    function updateCostEstimate() {
        // Can't estimate until we know about data
        if (inputModeSelector.value === 'url' && !threadUrlInput.value) {
            costEstimate.textContent = 'Enter a thread URL to see cost estimate';
            return;
        }
        
        if (inputModeSelector.value === 'top' && selectedThreadIds.length === 0) {
            costEstimate.textContent = 'Select threads to see cost estimate';
            return;
        }
        
        // Rough estimate based on average comment length
        const AVG_CHARS_PER_COMMENT = 500; // Rough estimate
        let estimatedCommentCount = 0;
        
        if (inputModeSelector.value === 'url') {
            estimatedCommentCount = commentLimitSelect.value === 'all' ? 50 : parseInt(customCommentLimitInput.value, 10) || 50;
        } else {
            // For multiple threads, use a rough estimate based on selected count
            const avgCommentsPerThread = 25;
            estimatedCommentCount = selectedThreadIds.length * avgCommentsPerThread;
            if (commentLimitSelect.value === 'custom') {
                const customLimit = parseInt(customCommentLimitInput.value, 10) || 50;
                estimatedCommentCount = Math.min(estimatedCommentCount, customLimit);
            }
        }
        
        const estimatedChars = estimatedCommentCount * AVG_CHARS_PER_COMMENT;
        const estimatedCost = Math.ceil(estimatedChars / 1000) * 0.12;
        
        costEstimate.textContent = `Estimated: ~${Math.ceil(estimatedChars/1000)}k characters ($${estimatedCost.toFixed(2)})`;
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset state
        resetState();
        
        const apiKey = apiKeyInput.value.trim();
        let commentLimit = null;
        
        if (commentLimitSelect.value === 'custom') {
            commentLimit = parseInt(customCommentLimitInput.value, 10) || 100;
        }
        
        // Validate API key
        if (!apiKey) {
            apiKeyError.textContent = 'Please enter your ElevenLabs API key';
            apiKeyInput.focus();
            return;
        }
        
        // Start processing
        generateBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        
        try {
            // Fetch available voices from ElevenLabs
            availableVoices = await fetchElevenLabsVoices(apiKey);
            if (!availableVoices.length) {
                throw new Error("Could not retrieve voices from ElevenLabs");
            }
            
            if (inputModeSelector.value === 'url') {
                // Single thread mode
                const threadUrl = threadUrlInput.value.trim();
                
                // Validate URL
                if (!threadUrl || !threadUrl.includes('news.ycombinator.com')) {
                    urlError.textContent = 'Please enter a valid Hacker News thread URL';
                    threadUrlInput.focus();
                    generateBtn.disabled = false;
                    return;
                }
                
                // Extract thread ID from URL
                const threadId = extractThreadId(threadUrl);
                if (!threadId) {
                    throw new Error("Invalid Hacker News thread URL");
                }
                
                // Process single thread
                await processSingleThread(threadId, apiKey, commentLimit);
            } else {
                // Multi-thread mode
                if (selectedThreadIds.length === 0) {
                    statusMessage.textContent = 'Please select at least one thread';
                    generateBtn.disabled = false;
                    return;
                }
                
                // Process multiple threads
                await processMultipleThreads(selectedThreadIds, apiKey, commentLimit);
            }
            
            // Display result
            const finalAudio = await combineAudioBlobs(audioBlobs);
            displayResult(finalAudio);
        } catch (error) {
            handleError(error);
        } finally {
            generateBtn.disabled = false;
        }
    });

    // Process a single thread
    async function processSingleThread(threadId, apiKey, commentLimit) {
        // Fetch thread data
        const threadData = await fetchHNThread(threadId);
        if (!threadData || !threadData.title) {
            throw new Error("Could not retrieve thread data");
        }
        
        // Preprocess and count all comments
        await preprocessThread(threadData, commentLimit);
        
        // Process thread and comments
        await processThread(threadData, apiKey);
    }

    // Process multiple threads
    async function processMultipleThreads(threadIds, apiKey, commentLimit) {
        // Set total for progress tracking
        totalComments = 0;
        let processedThreads = 0;
        
        for (const threadId of threadIds) {
            statusMessage.textContent = `Processing thread ${processedThreads + 1} of ${threadIds.length}`;
            
            // Fetch thread data
            const threadData = await fetchHNThread(threadId);
            if (!threadData || !threadData.title) {
                statusMessage.textContent = `Skipping invalid thread (ID: ${threadId})`;
                continue;
            }
            
            // Add a silence gap between threads if not the first thread
            if (processedThreads > 0) {
                const silenceBlob = generateSilence(1500);
                audioBlobs.push(silenceBlob);
                
                // Add thread transition announcement
                const transitionText = "Moving to the next thread.";
                const announcer = Object.values(voiceMapping)[0]; // Use first voice as announcer
                
                if (announcer) {
                    await generateAndAddAudio(transitionText, announcer, apiKey);
                    const silenceBlob = generateSilence(1000);
                    audioBlobs.push(silenceBlob);
                }
            }
            
            // Preprocess thread
            allComments = []; // Reset comments for this thread
            await preprocessThread(threadData, commentLimit);
            
            // Process this thread
            await processThread(threadData, apiKey);
            
            processedThreads++;
        }
    }

    // Download button
    downloadBtn.addEventListener('click', () => {
        const audioUrl = resultAudio.src;
        const a = document.createElement('a');
        a.href = audioUrl;
        
        // Create a filename based on thread title or date
        let filename = 'hn-thread-audio';
        if (allComments.length > 0 && allComments[0].title) {
            // Use first thread title (truncated if needed)
            const title = allComments[0].title;
            const sanitizedTitle = title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '-').slice(0, 30);
            filename = `hn-${sanitizedTitle}`;
        } else {
            // Use date if no title
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            filename = `hn-thread-${dateStr}`;
        }
        
        a.download = `${filename}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Retry button
    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        statusMessage.textContent = 'Retrying from where we left off...';
        
        try {
            // Continue processing from where we left off
            const apiKey = apiKeyInput.value.trim();
            
            // Need to fetch voices again in case the session expired
            if (availableVoices.length === 0) {
                availableVoices = await fetchElevenLabsVoices(apiKey);
                if (!availableVoices.length) {
                    throw new Error("Could not retrieve voices from ElevenLabs");
                }
            }
            
            // Resume processing
            if (allComments.length > 0 && lastProcessedCommentIndex < allComments.length - 1) {
                // Continue processing comments from where we left off
                await resumeProcessingComments(apiKey);
                
                // Display updated result
                const finalAudio = await combineAudioBlobs(audioBlobs);
                displayResult(finalAudio);
            }
        } catch (error) {
            handleError(error);
        } finally {
            retryBtn.disabled = false;
        }
    });

    // Reset state for new generation
    function resetState() {
        audioBlobs = [];
        voiceMapping = {};
        commentersCount = {};
        commentsByUser = {};
        processedComments = 0;
        totalComments = 0;
        totalCharacters = 0;
        retryCount = 0;
        allComments = [];
        commentHierarchy = {};
        sharedLinks = [];
        lastProcessedCommentIndex = -1;
        audioChapters = [];
        
        progressBar.style.width = '0%';
        progressStats.textContent = '0/0 comments processed';
        currentUser.textContent = '...';
        statusMessage.textContent = '';
        
        resultContainer.classList.add('hidden');
        apiKeyError.textContent = '';
        urlError.textContent = '';
        
        // Clear shared links
        if (linksContent) {
            linksContent.innerHTML = '';
        }
        linksContainer.classList.add('hidden');
        
        // Hide retry button
        retryBtn.classList.add('hidden');
    }

    // Extract thread ID from HN URL
    function extractThreadId(url) {
        const match = url.match(/item\?id=(\d+)/);
        return match ? match[1] : null;
    }

    // Fetch thread data from Hacker News API
    async function fetchHNThread(threadId) {
        try {
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${threadId}.json`);
            if (!response.ok) {
                throw new Error(`Failed to fetch thread: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(`Error fetching thread: ${error.message}`);
        }
    }

    // Preprocess the thread to count comments and build the hierarchy
    async function preprocessThread(threadData, commentLimit) {
        // Reset counts for this thread
        commentersCount = {};
        commentHierarchy = {};
        
        // Process the original post
        const by = threadData.by;
        commentersCount[by] = (commentersCount[by] || 0) + 1;
        
        // Add the original post to allComments
        allComments.push({
            id: threadData.id,
            by: by,
            text: threadData.text || '',
            title: threadData.title,
            isOriginalPost: true,
            parent: null,
            timestamp: threadData.time || Math.floor(Date.now() / 1000)
        });
        
        // Process all comments recursively
        await collectComments(threadData, commentLimit);
        
        // Count valid comments (excluding deleted, flagged, etc.)
        totalComments = allComments.length;
        
        // Group comments by user
        commentsByUser = {};
        for (const comment of allComments) {
            if (!commentsByUser[comment.by]) {
                commentsByUser[comment.by] = [];
            }
            commentsByUser[comment.by].push(comment);
        }
        
        // Sort comments by timestamp (ensure chronological order)
        allComments.sort((a, b) => a.timestamp - b.timestamp);
        
        // Update the progress UI
        progressStats.textContent = `0/${totalComments} comments processed`;
    }

    // Recursively collect all comments
    async function collectComments(item, commentLimit, parentId = null) {
        if (!item.kids || (commentLimit !== null && allComments.length >= commentLimit + 1)) {
            // +1 because the original post doesn't count against the limit
            return;
        }
        
        for (const commentId of item.kids) {
            if (commentLimit !== null && allComments.length >= commentLimit + 1) {
                break;
            }
            
            const commentData = await fetchHNThread(commentId);
            
            // Skip invalid, deleted, flagged comments
            if (!commentData || !commentData.text || commentData.deleted || commentData.dead || commentData.flagged) {
                continue;
            }
            
            const commenter = commentData.by;
            
            // Add to our comment counts
            commentersCount[commenter] = (commentersCount[commenter] || 0) + 1;
            
            // Store parent-child relationship
            commentHierarchy[commentId] = parentId;
            
            // Add to our list of all comments
            allComments.push({
                id: commentId,
                by: commenter,
                text: commentData.text,
                parent: parentId,
                isOriginalPost: false,
                timestamp: commentData.time || Math.floor(Date.now() / 1000)
            });
            
            // Process nested comments recursively
            await collectComments(commentData, commentLimit, commentId);
        }
    }

    // Fetch available voices from ElevenLabs
    async function fetchElevenLabsVoices(apiKey) {
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    apiKeyError.textContent = 'Invalid API key. Please check and try again.';
                    throw new Error('Invalid API key');
                }
                throw new Error(`Failed to fetch voices: ${response.status}`);
            }
            
            const data = await response.json();
            return data.voices || [];
        } catch (error) {
            throw new Error(`Error fetching voices: ${error.message}`);
        }
    }

    // Process the entire thread
    async function processThread(threadData, apiKey) {
        // Start with the original post
        const originalPost = allComments.find(c => c.isOriginalPost);
        if (!originalPost) return;
        
        const title = originalPost.title;
        const text = originalPost.text || '';
        const by = originalPost.by;
        
        // Add chapter marker for the original post
        const startTime = new Date().getTime();
        addChapterMarker(startTime, `Original Post by ${by}`, title);
        
        // Assign a voice for the original poster
        assignVoice(by);
        
        let originalPostText = `${title}. `;
        if (text) {
            // Process text to handle links and quotes
            originalPostText += processTextContent(text);
        }
        
        // Determine if poster has multiple comments
        const hasMultipleComments = commentersCount[by] > 1;
        
        // Create intro text based on comment count
        let introText = originalPostText;
        if (hasMultipleComments) {
            const introPhrase = getRandomPhrase(firstIntroductions, by);
            introText = `${introPhrase} ${originalPostText}`;
        }
        
        await generateAndAddAudio(introText, voiceMapping[by], apiKey);
        processedComments++;
        lastProcessedCommentIndex = 0;
        
        // Update UI
        currentUser.textContent = by;
        updateProgress();
        
        // Add pause between comments
        const silenceBlob = generateSilence(800);
        audioBlobs.push(silenceBlob);
        
        // Continue processing from comment index 1 (skip original post)
        await resumeProcessingComments(apiKey);
    }

    // Resume processing comments from where we left off
async function resumeProcessingComments(apiKey) {
        // Start from the comment after the last processed one
        const startIndex = lastProcessedCommentIndex + 1;
        
        // Process comments in order
        let lastCommenter = startIndex > 0 ? allComments[lastProcessedCommentIndex].by : '';
        let lastCommentParent = startIndex > 0 ? allComments[lastProcessedCommentIndex].parent : null;
        
        for (let i = startIndex; i < allComments.length; i++) {
            const comment = allComments[i];
            const commenter = comment.by;
            
            // Add chapter marker for this comment
            const chapterStartTime = new Date().getTime();
            const chapterTitle = `Comment by ${commenter}`;
            addChapterMarker(chapterStartTime, chapterTitle, comment.text?.substring(0, 50) || '');
            
            currentUser.textContent = commenter;
            
            // Assign voice if not already assigned
            assignVoice(commenter);
            
            // Process text content (handle links and quotes)
            let processedText = processTextContent(comment.text);
            
            // Determine if user has multiple comments
            const hasMultipleComments = commentersCount[commenter] > 1;
            const isFirstCommentByUser = commentsByUser[commenter].findIndex(c => c.id === comment.id) === 0;
            const isSameAsLastCommenter = commenter === lastCommenter;
            
            // Determine if we need a context introduction (replying to someone)
            const needsContextIntro = comment.parent !== lastCommentParent && comment.parent !== null;
            
            // Build introduction text
            let commentText = "";
            
            // Add context intro if needed (replying to someone)
            if (needsContextIntro) {
                const parentComment = allComments.find(c => c.id === comment.parent);
                if (parentComment) {
                    const parentUsername = parentComment.by;
                    const replyIntro = getRandomPhrase(replyIntroductions, parentUsername);
                    commentText += `${replyIntro} `;
                }
            }
            
            // Add user introduction if needed
            if (hasMultipleComments) {
                if (isFirstCommentByUser) {
                    // First time this commenter speaks
                    const introPhrase = getRandomPhrase(firstIntroductions, commenter);
                    commentText += `${introPhrase} `;
                } else if (!isSameAsLastCommenter) {
                    // Returning commenter who wasn't the last speaker
                    const returnIntro = getRandomPhrase(returnIntroductions, commenter);
                    commentText += `${returnIntro} `;
                }
            } else if (!isSameAsLastCommenter) {
                // Single comment user - always introduce themselves
                const introPhrase = getRandomPhrase(firstIntroductions, commenter);
                commentText += `${introPhrase} `;
            }
            
            // Add the comment text
            commentText += processedText;
            
            // Generate audio for this comment
            await generateAndAddAudio(commentText, voiceMapping[commenter], apiKey);
            
            // Add pause between comments (800ms silence)
            const silenceBlob = generateSilence(800);
            audioBlobs.push(silenceBlob);
            
            processedComments++;
            lastProcessedCommentIndex = i;
            updateProgress();
            
            lastCommenter = commenter;
            lastCommentParent = comment.parent;
        }
    }

    // Process text content to handle links and quotes properly
    function processTextContent(text) {
        if (!text) return '';
        
        // Create a temporary DOM element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        
        // Find all links
        const links = tempDiv.querySelectorAll('a');
        
        // Handle the links appropriately
        if (links.length > 0) {
            // Store links for shared links section
            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                const href = link.getAttribute('href');
                const linkText = link.textContent;
                
                if (href && !sharedLinks.some(l => l.href === href)) {
                    sharedLinks.push({
                        href: href,
                        text: linkText,
                        commenter: currentUser.textContent
                    });
                }
            }
            
            // Update the shared links display
            updateSharedLinksDisplay();
            
            // Replace links with appropriate messages
            if (links.length === 1) {
                // Only one link
                links[0].textContent = getRandomPhrase(firstLinkPhrases);
            } else if (links.length === 2) {
                // Two links
                links[0].textContent = getRandomPhrase(firstLinkPhrases);
                links[1].textContent = getRandomPhrase(secondLinkPhrases);
            } else if (links.length > 2) {
                // More than two links
                links[0].textContent = getRandomPhrase(firstLinkPhrases);
                links[1].textContent = getRandomPhrase(multipleLinksPhrases);
                
                // Remove remaining links (keep the text, remove the link)
                for (let i = 2; i < links.length; i++) {
                    const textNode = document.createTextNode('');
                    links[i].parentNode.replaceChild(textNode, links[i]);
                }
            }
        }
        
        // Process quotes (lines starting with ">")
        let textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // Split by lines to find quotes
        const lines = textContent.split('\n');
        let processedLines = [];
        let inQuote = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('>')) {
                // This is a quote line
                const quoteContent = line.substring(1).trim();
                
                if (!inQuote) {
                    // Start of a quote block
                    const quoteIntro = getRandomPhrase(quoteIntroductions);
                    processedLines.push(`${quoteIntro} "${quoteContent}`);
                    inQuote = true;
                } else {
                    // Continuation of quote block
                    processedLines.push(quoteContent);
                }
            } else {
                // Not a quote line
                if (inQuote) {
                    // End the quote block
                    const lastLine = processedLines.pop();
                    const quoteEnding = getRandomPhrase(quoteEndings);
                    processedLines.push(`${lastLine}" ${quoteEnding}`);
                    inQuote = false;
                }
                
                if (line) {
                    processedLines.push(line);
                }
            }
        }
        
        // Close any open quote block
        if (inQuote) {
            const lastLine = processedLines.pop();
            const quoteEnding = getRandomPhrase(quoteEndings);
            processedLines.push(`${lastLine}" ${quoteEnding}`);
        }
        
        // Join lines back together
        let processedText = processedLines.join(' ');
        
        // Remove citation numbers like [0], [1], etc.
        processedText = processedText.replace(/\[\d+\]/g, '');
        
        // Clean any lingering HTML entities
        processedText = processedText.replace(/&[#\w]+;/g, ' ');
        
        return processedText;
    }

    // Update the shared links display
    function updateSharedLinksDisplay() {
        if (sharedLinks.length === 0) {
            linksContainer.classList.add('hidden');
            return;
        }
        
        linksContainer.classList.remove('hidden');
        linksContent.innerHTML = '';
        
        const linksList = document.createElement('ul');
        
        sharedLinks.forEach((link, index) => {
            const listItem = document.createElement('li');
            const linkElement = document.createElement('a');
            linkElement.href = link.href;
            linkElement.textContent = link.text || link.href;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            
            const commenterSpan = document.createElement('span');
            commenterSpan.className = 'link-commenter';
            commenterSpan.textContent = ` (shared by ${link.commenter})`;
            
            listItem.appendChild(linkElement);
            listItem.appendChild(commenterSpan);
            linksList.appendChild(listItem);
        });
        
        linksContent.appendChild(linksList);
    }

    // Get a random introduction phrase
    function getRandomPhrase(phrases, username = '') {
        const randomIndex = Math.floor(Math.random() * phrases.length);
        return phrases[randomIndex].replace('{username}', username);
    }

    // Assign a voice to a commenter
    function assignVoice(username) {
        if (voiceMapping[username]) {
            return;
        }
        
        // First, check if there's a voice with the same name as the username
        const matchingVoice = availableVoices.find(voice => 
            voice.name.toLowerCase() === username.toLowerCase()
        );
        
        if (matchingVoice) {
            voiceMapping[username] = {
                voice_id: matchingVoice.voice_id,
                name: matchingVoice.name,
            };
            return;
        }
        
        // Deterministic voice assignment based on username
        const usernameHash = hashString(username);
        const voiceIndex = usernameHash % availableVoices.length;
        const selectedVoice = availableVoices[voiceIndex];
        
        voiceMapping[username] = {
            voice_id: selectedVoice.voice_id,
            name: selectedVoice.name,
        };
    }

    // Simple hash function for consistent voice assignment
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Add a chapter marker for audio metadata
    function addChapterMarker(startTimeMs, title, subtitle = '') {
        audioChapters.push({
            startTime: startTimeMs,
            title: title,
            subtitle: subtitle
        });
    }

    // Generate audio using ElevenLabs API
    async function generateAndAddAudio(text, voice, apiKey) {
        try {
            // Count characters for cost estimation
            totalCharacters += text.length;
            costEstimate.textContent = `Processed: ~${Math.ceil(totalCharacters/1000)}k characters (${(Math.ceil(totalCharacters/1000) * 0.12).toFixed(2)})`;
            
            const response = await fetchWithRetry(() => 
                fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice.voice_id, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                })
            );
            
            if (!response.ok) {
                throw new Error(`Failed to generate audio: ${response.status}`);
            }
            
            const audioBlob = await response.blob();
            audioBlobs.push(audioBlob);
            
            // For partial results: if we have processed comments, let's create a temporary result
            if (processedComments > 0 && processedComments % 5 === 0) {
                const partialAudio = await combineAudioBlobs(audioBlobs);
                const tempUrl = URL.createObjectURL(partialAudio);
                
                // Update the audio element with partial result
                if (!resultContainer.classList.contains('hidden')) {
                    resultAudio.src = tempUrl;
                }
            }
            
        } catch (error) {
            // Show retry button and what we've got so far
            retryBtn.classList.remove('hidden');
            
            // Create partial audio result with what we have so far
            if (audioBlobs.length > 0) {
                const partialAudio = await combineAudioBlobs(audioBlobs);
                displayResult(partialAudio);
                statusMessage.textContent = `Error: ${error.message}. You can download partial audio or retry.`;
            }
            
            throw new Error(`Error generating audio: ${error.message}`);
        }
    }

    // Retry mechanism with exponential backoff
    async function fetchWithRetry(fetchFunc, initialDelay = 500, maxRetries = MAX_RETRIES) {
        let delay = initialDelay;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fetchFunc();
            } catch (error) {
                if (i === maxRetries) {
                    throw error;
                }
                
                // Check if it's a rate limit error
                if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
                    retryCount++;
                    statusMessage.textContent = `Rate limited. Retrying in ${delay/1000} seconds...`;
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    statusMessage.textContent = 'Retrying...';
                } else {
                    throw error;
                }
            }
        }
    }

    // Generate silence as an audio blob
    function generateSilence(durationMs) {
        const sampleRate = 44100;
        const numSamples = Math.floor(sampleRate * durationMs / 1000);
        const buffer = new ArrayBuffer(numSamples * 2);
        const view = new DataView(buffer);
        
        for (let i = 0; i < numSamples; i++) {
            view.setInt16(i * 2, 0, true);
        }
        
        return new Blob([view], { type: 'audio/wav' });
    }

    // Combine all audio blobs into one
    async function combineAudioBlobs(blobs) {
        if (blobs.length === 0) {
            return new Blob([], { type: 'audio/mp3' });
        }
        
        // For simplicity, we'll use the first audio format for all
        // TODO: Add proper handling for chapter metadata
        return new Blob(blobs, { type: blobs[0].type });
    }

    // Display the final audio result
    function displayResult(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        resultAudio.src = audioUrl;
        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        
        // Update download button text with file size
        const fileSizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
        downloadBtn.textContent = `Download Audio (${fileSizeMB} MB)`;
    }

    // Update the progress UI
    function updateProgress() {
        const percentage = totalComments > 0 ? 
            Math.floor((processedComments / totalComments) * 100) : 0;
        
        progressBar.style.width = `${percentage}%`;
        progressStats.textContent = `${processedComments}/${totalComments} comments processed`;
    }

    // General error handler
    function handleError(error) {
        console.error(error);
        statusMessage.textContent = `Error: ${error.message}`;
        
        // Show retry button if we have processed some comments
        if (lastProcessedCommentIndex >= 0) {
            retryBtn.classList.remove('hidden');
        }
    }

    // Initialize the app
    initializeUI();
    
    // Set up event listeners for dynamic inputs
    threadUrlInput.addEventListener('input', updateCostEstimate);
    apiKeyInput.addEventListener('input', () => {
        apiKeyError.textContent = '';
    });
    
    // Set up input event listeners for cost estimation
    customCommentLimitInput.addEventListener('input', updateCostEstimate);
});
