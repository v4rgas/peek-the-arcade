const REPO_OWNER = 'platanus-hack';
const REPO_NAME = 'platanus-hack-25-arcade';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks`;
// Last commit date from parent repo: 2025-10-28T14:51:05Z
const PARENT_LAST_PUSH = new Date('2025-10-28T14:51:05Z');
// Minimum time difference (1 minute) to consider a fork as having new commits
const MIN_TIME_DIFFERENCE_MS = 60 * 1000; // 1 minute in milliseconds

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const forksListEl = document.getElementById('forks-list');
const gameContainerEl = document.getElementById('game-container');
const gameIframeEl = document.getElementById('game-iframe');
const currentGameTitleEl = document.getElementById('current-game-title');
const closeGameBtn = document.getElementById('close-game');
const shareUrlInput = document.getElementById('share-url');
const copyUrlBtn = document.getElementById('copy-url');
const tokenInput = document.getElementById('github-token');
const saveTokenBtn = document.getElementById('save-token');
const filterCheckbox = document.getElementById('filter-modified');
const refreshCacheBtn = document.getElementById('refresh-cache');
const settingsToggleBtn = document.getElementById('settings-toggle');
const settingsPanelEl = document.getElementById('settings-panel');
const searchInput = document.getElementById('search-input');

// Get stored token
let githubToken = localStorage.getItem('github_token');
if (githubToken) {
    tokenInput.value = githubToken;
}

// Toggle settings panel
settingsToggleBtn.addEventListener('click', () => {
    if (settingsPanelEl.style.display === 'none') {
        settingsPanelEl.style.display = 'block';
    } else {
        settingsPanelEl.style.display = 'none';
    }
});

// Save token
saveTokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) {
        localStorage.setItem('github_token', token);
        githubToken = token;
        alert('Token saved! Reload the page to use it.');
    } else {
        localStorage.removeItem('github_token');
        githubToken = null;
        alert('Token removed!');
    }
});

// Store all forks globally
let allForks = [];

// Cache configuration
const CACHE_KEY = 'forks_cache';
const CACHE_TIMESTAMP_KEY = 'forks_cache_timestamp';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const GAME_CACHE_PREFIX = 'game_cache_'; // Prefix for game.js cache keys
const GAME_CACHE_TIMESTAMP_PREFIX = 'game_cache_timestamp_';

// Check if cache is valid
function isCacheValid() {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;

    const cacheAge = Date.now() - parseInt(timestamp, 10);
    return cacheAge < CACHE_DURATION;
}

// Get forks from cache
function getCachedForks() {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
}

// Save forks to cache
function cacheForks(forks) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(forks));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
}

// Check if game cache is valid
function isGameCacheValid(owner, repo) {
    const timestamp = localStorage.getItem(`${GAME_CACHE_TIMESTAMP_PREFIX}${owner}_${repo}`);
    if (!timestamp) return false;

    const cacheAge = Date.now() - parseInt(timestamp, 10);
    return cacheAge < CACHE_DURATION;
}

// Get game code from cache
function getCachedGame(owner, repo) {
    const cached = localStorage.getItem(`${GAME_CACHE_PREFIX}${owner}_${repo}`);
    return cached || null;
}

// Save game code to cache
function cacheGame(owner, repo, gameCode) {
    localStorage.setItem(`${GAME_CACHE_PREFIX}${owner}_${repo}`, gameCode);
    localStorage.setItem(`${GAME_CACHE_TIMESTAMP_PREFIX}${owner}_${repo}`, Date.now().toString());
}

// Fetch forks from GitHub REST API
async function fetchForks() {
    try {
        // Check cache first
        if (isCacheValid()) {
            const cached = getCachedForks();
            if (cached) {
                console.log('Using cached forks data');
                return cached;
            }
        }

        console.log('Fetching fresh forks data from GitHub API');
        const headers = {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }

        // Fetch all pages of forks using Link header pagination
        const allForks = [];
        let url = `${API_URL}?per_page=100`;
        let pageNum = 1;

        while (url) {
            console.log(`Fetching page ${pageNum}...`);
            const response = await fetch(url, { headers });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const forks = await response.json();
            console.log(`  Received ${forks.length} forks on page ${pageNum}`);

            // Add all forks from this page
            allForks.push(...forks);

            // Parse Link header to get next page URL
            const linkHeader = response.headers.get('link');
            url = null; // Reset URL

            if (linkHeader) {
                // Extract the "next" link from the Link header
                // Link header format: <url>; rel="next", <url>; rel="last", etc.
                const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                if (nextMatch) {
                    url = nextMatch[1];
                    pageNum++;
                } else {
                    console.log(`  Last page reached (no "next" link in header)`);
                }
            } else {
                console.log(`  Last page reached (no Link header)`);
            }
        }

        console.log(`✓ Fetched ${allForks.length} total forks across ${pageNum} page(s)`);

        // Cache the results
        cacheForks(allForks);

        return allForks;
    } catch (error) {
        throw new Error(`Failed to fetch forks: ${error.message}`);
    }
}

// Filter forks based on pushed_at date
function filterForks(forks, onlyModified) {
    if (!onlyModified) {
        return forks;
    }
    return forks.filter(fork => {
        const forkPushDate = new Date(fork.pushed_at);
        const timeDifference = forkPushDate.getTime() - PARENT_LAST_PUSH.getTime();
        const shouldShow = timeDifference >= MIN_TIME_DIFFERENCE_MS;

        // Debug logging
        console.log(`Fork: ${fork.owner.login}`);
        console.log(`  pushed_at: ${fork.pushed_at}`);
        console.log(`  Parsed date: ${forkPushDate.toISOString()}`);
        console.log(`  Parent date: ${PARENT_LAST_PUSH.toISOString()}`);
        console.log(`  Time difference: ${Math.floor(timeDifference / 1000)} seconds`);
        console.log(`  Show: ${shouldShow}`);
        console.log('---');

        return shouldShow;
    });
}

// Search filter (case-insensitive, by username only)
function searchForks(forks, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        return forks;
    }

    const term = searchTerm.toLowerCase();
    return forks.filter(fork => {
        const username = fork.owner.login.toLowerCase();
        return username.includes(term);
    });
}

// Apply all filters
function applyFilters() {
    let filtered = allForks;

    // Apply modified filter
    filtered = filterForks(filtered, filterCheckbox.checked);

    // Apply search filter
    filtered = searchForks(filtered, searchInput.value);

    displayForks(filtered);
}

// Display forks
function displayForks(forks) {
    forksListEl.innerHTML = '';

    if (forks.length === 0) {
        errorEl.textContent = 'No forks found with the current filter!';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';

    // Show count of displayed vs total forks
    const countInfo = document.createElement('div');
    countInfo.className = 'fork-count-info';
    countInfo.textContent = `Showing ${forks.length} of ${allForks.length} total forks`;
    forksListEl.appendChild(countInfo);

    // Sort forks by pushed_at date (most recent first)
    const sortedForks = [...forks].sort((a, b) => {
        return new Date(b.pushed_at) - new Date(a.pushed_at);
    });

    sortedForks.forEach(fork => {
        const card = createForkCard(fork);
        forksListEl.appendChild(card);
    });
}

// Create fork card HTML
function createForkCard(fork) {
    const card = document.createElement('div');
    card.className = 'fork-card';

    // Format the pushed_at date
    const pushedDate = new Date(fork.pushed_at);
    const now = new Date();
    const diffMs = now - pushedDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeAgo;
    if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
    } else {
        timeAgo = `${diffDays}d ago`;
    }

    card.innerHTML = `
        <div class="fork-header">
            <img src="${fork.owner.avatar_url}" alt="${fork.owner.login}" class="fork-avatar">
            <div class="fork-info">
                <h3>${fork.owner.login}</h3>
                <a href="${fork.html_url}" target="_blank">View Fork →</a>
            </div>
        </div>
        <div class="fork-meta">
            <span class="meta-item" title="Last pushed ${timeAgo}">🕒 ${timeAgo}</span>
            <span class="meta-item" title="${fork.stargazers_count} stars">⭐ ${fork.stargazers_count}</span>
        </div>
        <button class="btn-play" data-owner="${fork.owner.login}" data-repo="${fork.name}">
            ▶ Play Game
        </button>
    `;

    const playBtn = card.querySelector('.btn-play');
    playBtn.addEventListener('click', () => {
        loadGame(fork.owner.login, fork.name);
    });

    return card;
}

// Load and run a game
async function loadGame(owner, repo) {
    currentGameTitleEl.textContent = `${owner}'s Game`;
    gameContainerEl.style.display = 'block';

    // Update URL with query parameter
    const url = new URL(window.location);
    url.searchParams.set('game', owner);
    window.history.pushState({}, '', url);

    // Display shareable URL
    shareUrlInput.value = url.toString();

    try {
        let gameCode;

        // Check cache first
        if (isGameCacheValid(owner, repo)) {
            gameCode = getCachedGame(owner, repo);
            if (gameCode) {
                console.log(`Using cached game.js for ${owner}/${repo}`);
            }
        }

        // Fetch from GitHub if not cached
        if (!gameCode) {
            const gameJsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/game.js`;
            console.log(`Fetching fresh game.js for ${owner}/${repo}`);
            const response = await fetch(gameJsUrl);
            if (!response.ok) throw new Error('Failed to load game.js');
            gameCode = await response.text();

            // Cache the game code
            cacheGame(owner, repo, gameCode);
        }

        // Create HTML with the game code embedded
        const gameHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        background: #000;
                    }
                    #game-root {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    #error {
                        color: #ff4757;
                        padding: 20px;
                        background: #ffebee;
                        border-radius: 8px;
                        margin: 20px;
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
            </head>
            <body>
                <div id="game-root"></div>
                <div id="error" style="display: none;"></div>
                <script>
                    const errorEl = document.getElementById('error');
                    try {
                        ${gameCode}
                    } catch (error) {
                        errorEl.textContent = 'Error running game: ' + error.message;
                        errorEl.style.display = 'block';
                    }
                </script>
            </body>
            </html>
        `;

        gameIframeEl.srcdoc = gameHtml;
    } catch (error) {
        // Show error in iframe
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body>
                <div style="color: #ff4757; padding: 20px; background: #ffebee; border-radius: 8px; margin: 20px;">
                    Error loading game: ${error.message}
                </div>
            </body>
            </html>
        `;
        gameIframeEl.srcdoc = errorHtml;
    }
}

// Close game
closeGameBtn.addEventListener('click', () => {
    gameContainerEl.style.display = 'none';
    gameIframeEl.srcdoc = '';
    // Remove query parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('game');
    window.history.pushState({}, '', url);
});


// Handle filter checkbox change
filterCheckbox.addEventListener('change', () => {
    applyFilters();
});

// Handle search input
searchInput.addEventListener('input', () => {
    applyFilters();
});

// Handle refresh cache button
refreshCacheBtn.addEventListener('click', async () => {
    // Clear the cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    console.log('Cache cleared, fetching fresh data...');

    // Reload the page to fetch fresh data
    window.location.reload();
});

// Initialize app
async function init() {
    try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';

        allForks = await fetchForks();

        loadingEl.style.display = 'none';

        if (allForks.length === 0) {
            errorEl.textContent = 'No forks found yet!';
            errorEl.style.display = 'block';
            return;
        }

        // Display with filters applied
        applyFilters();

        // Check if there's a game query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const gameOwner = urlParams.get('game');
        if (gameOwner) {
            // Find the fork for this owner
            const fork = allForks.find(f => f.owner.login.toLowerCase() === gameOwner.toLowerCase());
            if (fork) {
                loadGame(fork.owner.login, fork.name);
            }
        }

    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// Start the app
init();
