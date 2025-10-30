const REPO_OWNER = 'platanus-hack';
const REPO_NAME = 'platanus-hack-25-arcade';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks`;
// Last commit date from parent repo: 2025-10-28T14:51:05Z
const PARENT_LAST_PUSH = new Date('2025-10-28T14:51:05Z');

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const forksListEl = document.getElementById('forks-list');
const gameContainerEl = document.getElementById('game-container');
const gameIframeEl = document.getElementById('game-iframe');
const currentGameTitleEl = document.getElementById('current-game-title');
const closeGameBtn = document.getElementById('close-game');
const tokenInput = document.getElementById('github-token');
const saveTokenBtn = document.getElementById('save-token');
const filterCheckbox = document.getElementById('filter-modified');

// Get stored token
let githubToken = localStorage.getItem('github_token');
if (githubToken) {
    tokenInput.value = githubToken;
}

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

// Fetch forks from GitHub REST API
async function fetchForks() {
    try {
        const headers = {};
        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }

        const response = await fetch(`${API_URL}?per_page=100`, { headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const forks = await response.json();
        return forks;
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
        return forkPushDate > PARENT_LAST_PUSH;
    });
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
    forks.forEach(fork => {
        const card = createForkCard(fork);
        forksListEl.appendChild(card);
    });
}

// Create fork card HTML
function createForkCard(fork) {
    const card = document.createElement('div');
    card.className = 'fork-card';

    card.innerHTML = `
        <div class="fork-header">
            <img src="${fork.owner.avatar_url}" alt="${fork.owner.login}" class="fork-avatar">
            <div class="fork-info">
                <h3>${fork.owner.login}</h3>
                <a href="${fork.html_url}" target="_blank">View Fork →</a>
            </div>
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
    const gameJsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/game.js`;

    currentGameTitleEl.textContent = `${owner}'s Game`;
    gameContainerEl.style.display = 'block';

    try {
        // Fetch game.js from parent page (has network permissions)
        const response = await fetch(gameJsUrl);
        if (!response.ok) throw new Error('Failed to load game.js');
        const gameCode = await response.text();

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
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
});


// Handle filter checkbox change
filterCheckbox.addEventListener('change', () => {
    const filtered = filterForks(allForks, filterCheckbox.checked);
    displayForks(filtered);
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

        // Display with filter applied (checkbox is checked by default)
        const filtered = filterForks(allForks, filterCheckbox.checked);
        displayForks(filtered);

    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// Start the app
init();
