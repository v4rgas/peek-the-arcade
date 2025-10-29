const REPO_OWNER = 'platanus-hack';
const REPO_NAME = 'platanus-hack-25-arcade';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks`;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const forksListEl = document.getElementById('forks-list');
const gameContainerEl = document.getElementById('game-container');
const gameIframeEl = document.getElementById('game-iframe');
const currentGameTitleEl = document.getElementById('current-game-title');
const closeGameBtn = document.getElementById('close-game');

// Fetch forks from GitHub REST API
async function fetchForks() {
    try {
        let allForks = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`${API_URL}?per_page=100&page=${page}`);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const forks = await response.json();

            if (forks.length === 0) {
                hasMore = false;
            } else {
                allForks = allForks.concat(forks);
                page++;
            }
        }

        return allForks;
    } catch (error) {
        throw new Error(`Failed to fetch forks: ${error.message}`);
    }
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
function loadGame(owner, repo) {
    const gameJsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/game.js`;

    currentGameTitleEl.textContent = `${owner}'s Game`;
    gameContainerEl.style.display = 'block';

    // Create a simple HTML page that loads and runs the game.js
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

                fetch('${gameJsUrl}')
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to load game.js');
                        return response.text();
                    })
                    .then(code => {
                        try {
                            eval(code);
                        } catch (error) {
                            errorEl.textContent = 'Error running game: ' + error.message;
                            errorEl.style.display = 'block';
                        }
                    })
                    .catch(error => {
                        errorEl.textContent = 'Error loading game: ' + error.message;
                        errorEl.style.display = 'block';
                    });
            </script>
        </body>
        </html>
    `;

    gameIframeEl.srcdoc = gameHtml;
}

// Close game
closeGameBtn.addEventListener('click', () => {
    gameContainerEl.style.display = 'none';
    gameIframeEl.srcdoc = '';
});


// Initialize app
async function init() {
    try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';

        const forks = await fetchForks();

        loadingEl.style.display = 'none';

        if (forks.length === 0) {
            errorEl.textContent = 'No forks found yet!';
            errorEl.style.display = 'block';
            return;
        }

        forks.forEach(fork => {
            const card = createForkCard(fork);
            forksListEl.appendChild(card);
        });

    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// Start the app
init();
