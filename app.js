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
    let availableVoices = [];
    let processedComments = 0;
    let totalComments = 0;
    let retryCount = 0;
    const MAX_RETRIES = 5;

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
        processedComments = 0;
        totalComments = 0;
        retryCount = 0;
        
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
        const title = threadData.title;
        const text = threadData.text || '';
        const by = threadData.by;
        
        // Assign a voice for the original poster
        assignVoice(by);
        
        let originalPostText = `${title}. `;
        if (text) {
            originalPostText += text;
        }
        
        // Create intro text
        const introText = `Hey, ${by} here. ${originalPostText}`;
        
        await generateAndAddAudio(introText, voiceMapping[by], apiKey);
        processedComments++;
        
        // Update UI
        currentUser.textContent = by;
        updateProgress();
        
        // Handle comments
        await processComments(threadData, apiKey, commentLimit);
    }

    // Process comments recursively
    async function processComments(item, apiKey, commentLimit) {
        if (!item.kids || processedComments >= commentLimit) {
            return;
        }
        
        // Set total comments for progress tracking
        if (totalComments === 0) {
            totalComments = Math.min(commentLimit, countTotalComments(item));
            progressStats.textContent = `${processedComments}/${totalComments} comments processed`;
        }
        
        // Track the last commenter for continuity
        let lastCommenter = item.by;
        
        // Process each comment in order
        for (const commentId of item.kids) {
            if (processedComments >= commentLimit) {
                break;
            }
            
            const commentData = await fetchHNThread(commentId);
            if (!commentData || !commentData.text || commentData.deleted) {
                continue;
            }
            
            const commenter = commentData.by;
            currentUser.textContent = commenter;
            
            // Assign voice if not already assigned
            assignVoice(commenter);
            
            // Create comment text with appropriate intro
            let commentText = "";
            if (commenter === lastCommenter) {
                // Same commenter as last time - no intro needed
                commentText = commentData.text;
            } else if (!voiceMapping[commenter].used) {
                // First time this commenter speaks
                commentText = `Hey, ${commenter} here. ${commentData.text}`;
                voiceMapping[commenter].used = true;
            } else {
                // Returning commenter
                commentText = `Hey, it's ${commenter} again. ${commentData.text}`;
            }
            
            // Generate audio for this comment
            await generateAndAddAudio(commentText, voiceMapping[commenter], apiKey);
            
            // Add pause between comments (400ms silence)
            const silenceBlob = generateSilence(400);
            audioBlobs.push(silenceBlob);
            
            processedComments++;
            updateProgress();
            lastCommenter = commenter;
            
            // Process nested comments recursively
            await processComments(commentData, apiKey, commentLimit);
        }
    }

    // Count total comments in a thread (recursive)
    function countTotalComments(item) {
        if (!item.kids) {
            return 0;
        }
        
        let count = item.kids.length;
        return count; // Simplified count - just top-level comments
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
            used: false
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
        // Clean the text from HTML tags
        const cleanText = text.replace(/<[^>]*>/g, '');
        
        try {
            const response = await fetchWithRetry(() => 
                fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice.voice_id, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: cleanText,
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
        // This is a simplified approach - in production, you might want to convert all to same format
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
a
