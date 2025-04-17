document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('audio-form');
    const apiKeyInput = document.getElementById('elevenlabs-api-key');
    const threadUrlInput = document.getElementById('hn-thread-url');
    const commentLimitInput = document.getElementById('comment-limit');
    const generateBtn = document.getElementById('generate-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressStats = document.getElementById('progress-stats');
    const currentUser = document.getElementById('current-user');
    const statusMessage = document.getElementById('status-message');
    const resultContainer = document.getElementById('result-container');
    const resultAudio = document.getElementById('result-audio');
    const downloadBtn = document.getElementById('download-btn');
    const apiKeyError = document.getElementById('api-key-error');
    const urlError = document.getElementById('url-error');
    const themeToggle = document.getElementById('theme-toggle');
    const togglePasswordBtn = document.querySelector('.toggle-password');

    // State variables
    let audioBlobs = [];
    let voiceMapping = {};
    let commentersCount = {}; // Track how many comments each user has
    let commentsByUser = {}; // Track all comments by each user
    let availableVoices = [];
    let processedComments = 0;
    let totalComments = 0;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let allComments = []; // Store all comments for preprocessing
    let commentHierarchy = {}; // Store parent-child relationships

    // Introduction phrases for variety
    const firstIntroductions = [
        "Hey, {username} here.",
        "Hi it's {username}.",
        "Howdy I'm {username}.",
        "Hi y'all it's {username}.",
        "{username} here!"
    ];
    
    const returnIntroductions = [
        "Hey, it's {username} again."
    ];
    
    const replyIntroductions = [
        "(in response to {username})",
        "(replying to {username})",
        "A word to {username}: ",
        "Quick comment to {username}!"
    ];

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

    // Load theme preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset state
        resetState();
        
        const apiKey = apiKeyInput.value.trim();
        const threadUrl = threadUrlInput.value.trim();
        const commentLimit = parseInt(commentLimitInput.value, 10) || 100;
        
        // Validate inputs
        if (!validateInputs(apiKey, threadUrl)) {
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
            
            // Extract thread ID from URL
            const threadId = extractThreadId(threadUrl);
            if (!threadId) {
                throw new Error("Invalid Hacker News thread URL");
            }
            
            // Fetch thread data
            const threadData = await fetchHNThread(threadId);
            if (!threadData || !threadData.title) {
                throw new Error("Could not retrieve thread data");
            }
            
            // Preprocess and count all comments
            await preprocessThread(threadData, commentLimit);
            
            // Process thread and comments
            await processThread(threadData, apiKey, commentLimit);
            
            // Display result
            const finalAudio = await combineAudioBlobs(audioBlobs);
            displayResult(finalAudio);
        } catch (error) {
            handleError(error);
        } finally {
            generateBtn.disabled = false;
        }
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        const audioUrl = resultAudio.src;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = 'hn-thread-audio.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Reset state for new generation
    function resetState() {
        audioBlobs = [];
        voiceMapping = {};
        commentersCount = {};
        commentsByUser = {};
        processedComments = 0;
        totalComments = 0;
        retryCount = 0;
        allComments = [];
        commentHierarchy = {};
        
        progressBar.style.width = '0%';
        progressStats.textContent = '0/0 comments processed';
        currentUser.textContent = '...';
        statusMessage.textContent = '';
        
        resultContainer.classList.add('hidden');
        apiKeyError.textContent = '';
        urlError.textContent = '';
    }

    // Validate form inputs
    function validateInputs(apiKey, threadUrl) {
        let isValid = true;
        
        if (!apiKey) {
            apiKeyError.textContent = 'Please enter your ElevenLabs API key';
            apiKeyInput.focus();
            isValid = false;
        }
        
        if (!threadUrl || !threadUrl.includes('news.ycombinator.com')) {
            urlError.textContent = 'Please enter a valid Hacker News thread URL';
            threadUrlInput.focus();
            isValid = false;
        }
        
        return isValid;
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
        // Reset counts
        commentersCount = {};
        allComments = [];
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
            parent: null
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
        
        // Update the progress UI
        progressStats.textContent = `0/${totalComments} comments processed`;
    }

    // Recursively collect all comments
    async function collectComments(item, commentLimit, parentId = null) {
        if (!item.kids || allComments.length >= commentLimit) {
            return;
        }
        
        for (const commentId of item.kids) {
            if (allComments.length >= commentLimit) {
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
                isOriginalPost: false
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
    async function processThread(threadData, apiKey, commentLimit) {
        // Start with the original post
        const originalPost = allComments.find(c => c.isOriginalPost);
        if (!originalPost) return;
        
        const title = originalPost.title;
        const text = originalPost.text || '';
        const by = originalPost.by;
        
        // Assign a voice for the original poster
        assignVoice(by);
        
        let originalPostText = `${title}. `;
        if (text) {
            // Process text to handle links
            originalPostText += processTextContent(text, true);
        }
        
        // Determine if poster has multiple comments
        const hasMultipleComments = commentersCount[by] > 1;
        
        // Create intro text based on comment count
        let introText = originalPostText;
        if (hasMultipleComments) {
            const introPhrase = getRandomIntroPhrase(firstIntroductions, by);
            introText = `${introPhrase} ${originalPostText}`;
        }
        
        await generateAndAddAudio(introText, voiceMapping[by], apiKey);
        processedComments++;
        
        // Update UI
        currentUser.textContent = by;
        updateProgress();
        
        // Add pause between comments
        const silenceBlob = generateSilence(400);
        audioBlobs.push(silenceBlob);
        
        // Process all comments in order (flat traversal of our collected comments)
        let lastCommenter = by;
        let lastCommentParent = null;
        
        // Skip the first comment (original post) since we already processed it
        for (let i = 1; i < allComments.length; i++) {
            const comment = allComments[i];
            const commenter = comment.by;
            
            currentUser.textContent = commenter;
            
            // Assign voice if not already assigned
            assignVoice(commenter);
            
            // Process text content (handle links)
            let processedText = processTextContent(comment.text, true);
            
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
                    const replyIntro = getRandomIntroPhrase(replyIntroductions, parentUsername);
                    commentText += `${replyIntro} `;
                }
            }
            
            // Add user introduction if needed
            if (hasMultipleComments) {
                if (isFirstCommentByUser) {
                    // First time this commenter speaks
                    const introPhrase = getRandomIntroPhrase(firstIntroductions, commenter);
                    commentText += `${introPhrase} `;
                } else if (!isSameAsLastCommenter) {
                    // Returning commenter who wasn't the last speaker
                    const returnIntro = getRandomIntroPhrase(returnIntroductions, commenter);
                    commentText += `${returnIntro} `;
                }
            }
            
            // Add the comment text
            commentText += processedText;
            
            // Generate audio for this comment
            await generateAndAddAudio(commentText, voiceMapping[commenter], apiKey);
            
            // Add pause between comments (400ms silence)
            const silenceBlob = generateSilence(400);
            audioBlobs.push(silenceBlob);
            
            processedComments++;
            updateProgress();
            
            lastCommenter = commenter;
            lastCommentParent = comment.parent;
        }
    }

    // Process text content to handle links properly
    function processTextContent(text, isFirstLink = true) {
        // Remove HTML tags
        let cleanText = text.replace(/<[^>]*>/g, '');
        
        // Look for URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let matches = cleanText.match(urlRegex);
        
        if (matches) {
            if (isFirstLink) {
                // Replace the first link with a generic message
                cleanText = cleanText.replace(urlRegex, 'See the link I shared in the thread');
                // Remove any remaining links silently
                cleanText = cleanText.replace(urlRegex, '');
            } else {
                // Remove all links silently
                cleanText = cleanText.replace(urlRegex, '');
            }
        }
        
        return cleanText;
    }

    // Get a random introduction phrase
    function getRandomIntroPhrase(phrases, username) {
        const randomIndex = Math.floor(Math.random() * phrases.length);
        return phrases[randomIndex].replace('{username}', username);
    }

    // Assign a voice to a commenter
    function assignVoice(username) {
        if (voiceMapping[username]) {
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

    // Generate audio using ElevenLabs API
    async function generateAndAddAudio(text, voice, apiKey) {
        try {
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
            
        } catch (error) {
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
                if (error.message.includes('429') || error.message.includes('rate limit')) {
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
        // For simplicity, we'll use the first audio format for all
        return new Blob(blobs, { type: blobs[0].type });
    }

    // Display the final audio result
    function displayResult(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        resultAudio.src = audioUrl;
        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
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
        progressContainer.classList.remove('hidden');
    }
});
