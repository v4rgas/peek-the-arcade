const REPO_OWNER = 'platanus-hack';
const REPO_NAME = 'platanus-hack-25-arcade';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/forks`;
const ORIGINAL_GAME_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/game.js`;

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const forksListEl = document.getElementById('forks-list');
const gameContainerEl = document.getElementById('game-container');
const gameIframeEl = document.getElementById('game-iframe');
const currentGameTitleEl = document.getElementById('current-game-title');
const closeGameBtn = document.getElementById('close-game');
const hideUnchangedToggle = document.getElementById('hide-unchanged');

// Store all forks data
let allForksData = [];

// Fetch forks from GitHub GraphQL API with commit counts
async function fetchForksWithCommits() {
    try {
        let allForks = [];
        let hasNextPage = true;
        let afterCursor = null;

        while (hasNextPage) {
            const query = `
                query {
                    repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {
                        forks(first: 100${afterCursor ? `, after: "${afterCursor}"` : ''}) {
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            nodes {
                                owner {
                                    login
                                    avatarUrl
                                }
                                name
                                url
                                defaultBranchRef {
                                    target {
                                        ... on Commit {
                                            history {
                                                totalCount
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    history {
                                        totalCount
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error(`GitHub GraphQL API error: ${response.status}`);
            }

            const result = await response.json();

            if (result.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
            }

            const originalCommitCount = result.data.repository.defaultBranchRef?.target?.history?.totalCount || 0;
            const forks = result.data.repository.forks.nodes;

            // Add hasCommits flag based on commit count comparison
            const forksWithStatus = forks.map(fork => ({
                owner: {
                    login: fork.owner.login,
                    avatar_url: fork.owner.avatarUrl
                },
                name: fork.name,
                html_url: fork.url,
                hasCommits: (fork.defaultBranchRef?.target?.history?.totalCount || 0) > originalCommitCount
            }));

            allForks = allForks.concat(forksWithStatus);

            hasNextPage = result.data.repository.forks.pageInfo.hasNextPage;
            afterCursor = result.data.repository.forks.pageInfo.endCursor;
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
            🎮 Play Game
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


// Render forks based on filter
function renderForks() {
    forksListEl.innerHTML = '';
    const hideUnchanged = hideUnchangedToggle.checked;

    let displayedCount = 0;
    for (const forkData of allForksData) {
        if (hideUnchanged && !forkData.hasCommits) {
            continue; // Skip unchanged forks if filter is enabled
        }
        const card = createForkCard(forkData.fork);
        forksListEl.appendChild(card);
        displayedCount++;
    }

    if (displayedCount === 0) {
        errorEl.textContent = hideUnchanged
            ? 'No forks with changes found yet!'
            : 'No forks found yet!';
        errorEl.style.display = 'block';
    } else {
        errorEl.style.display = 'none';
    }
}

// Toggle event listener
hideUnchangedToggle.addEventListener('change', renderForks);

// Initialize app
async function init() {
    try {
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';

        const forks = await fetchForksWithCommits();

        if (forks.length === 0) {
            loadingEl.style.display = 'none';
            errorEl.textContent = 'No forks found yet!';
            errorEl.style.display = 'block';
            return;
        }

        // Store forks with their hasCommits status
        allForksData = forks.map(fork => ({
            fork: fork,
            hasCommits: fork.hasCommits
        }));

        loadingEl.style.display = 'none';
        renderForks();

    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// Start the app
init();
