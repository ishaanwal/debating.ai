// -----------------------------
// Global Variables and Constants
// -----------------------------
let isLoggedIn = false;
let isWriter = false;
let currentUserName = ''; // store displayName or email
let votes = { yes: 0, no: 0 };
let comments = [];

// For articles (Notion integration)
const ARTICLES_DATABASE_ID = '1a8c2d7a0a5580ed8e61cdc4db96c272';
const NOTION_TOKEN = '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';

// Global array for debates (Notion pages)
let debatesData = [];

// -----------------------------
// General UI and Auth Functions
// -----------------------------
function getRandomColor() {
  const colors = [
    '#E57373', '#F06292', '#BA68C8', '#9575CD',
    '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1',
    '#4DB6AC', '#81C784', '#AED581', '#DCE775',
    '#FFF176', '#FFD54F', '#FFB74D', '#FF8A65'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function toggleLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function loginWithEmailForm(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (!emailInput || !passInput) return;
  const email = emailInput.value.trim();
  const password = passInput.value.trim();
  if (!email || !password) return;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then((result) => {
      isLoggedIn = true;
      currentUserName = result.user.displayName || result.user.email;
      isWriter = (currentUserName === 'writer@mydomain.com');
      toggleLoginModal();
      updateUI();
      alert("Logged in successfully!");
    })
    .catch((error) => {
      console.error("Email login error:", error);
      alert("Email login failed: " + error.message);
    });
}

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      isLoggedIn = true;
      currentUserName = result.user.displayName || result.user.email;
      isWriter = (currentUserName === 'writer@mydomain.com');
      toggleLoginModal();
      updateUI();
      alert("Logged in successfully with Google!");
    })
    .catch((error) => {
      console.error("Google login error:", error);
      alert("Google login failed: " + error.message);
    });
}

function logout() {
  firebase.auth().signOut()
    .then(() => {
      isLoggedIn = false;
      isWriter = false;
      currentUserName = '';
      updateUI();
      alert("You have been logged out.");
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
}

function getInitials(name) {
  if (!name) return 'U';
  if (name.includes('@')) return name[0].toUpperCase();
  const parts = name.trim().split(' ');
  return parts.map(p => p[0].toUpperCase()).join('').slice(0, 2);
}

function updateUI() {
  const loginBtn = document.getElementById('login-btn');
  const profileIcon = document.getElementById('profile-icon');
  const profileInitials = document.getElementById('profile-initials');
  if (loginBtn && profileIcon && profileInitials) {
    if (!isLoggedIn) {
      loginBtn.style.display = 'inline-block';
      profileIcon.style.display = 'none';
    } else {
      loginBtn.style.display = 'none';
      profileIcon.style.display = 'inline-flex';
      profileInitials.textContent = getInitials(currentUserName);
      profileIcon.style.backgroundColor = getRandomColor();
    }
  }
  const writerTools = document.getElementById('writer-tools');
  if (writerTools) {
    writerTools.style.display = isWriter ? 'block' : 'none';
  }
}

// -----------------------------
// Debates (Notion) Functions
// -----------------------------
async function fetchDebatesFromNotion() {
  try {
    // Fetch all items from the database (using the articles endpoint)
    const response = await fetch('/api/articles');
    const data = await response.json();
    console.log("All items fetched:", JSON.stringify(data, null, 2));

    // Filter items that have a non-empty "TD:metadata" property
    const debates = data.results.filter(page => {
      return page.properties["TD:metadata"] &&
             page.properties["TD:metadata"].rich_text &&
             page.properties["TD:metadata"].rich_text.length > 0;
    });
    console.log("Filtered debates:", debates);

    // Store the debates in a global array
    // Inside fetchDebatesFromNotion()
debatesData = debates;
preloadDebateImages();  // Preload images before rendering
renderDebates();

// New helper function to preload images:
function preloadDebateImages() {
  debatesData.forEach(page => {
    const image = page.properties.Cover?.files?.[0]?.file?.url;
    if (image) {
      const img = new Image();
      img.src = image;
    }
  });
}

  } catch (err) {
    console.error("Error fetching debates from Notion:", err);
  }
}

// This function renders the first 4 debates from the debatesData array
function renderDebates() {
  const container = document.getElementById('debate-cards');
  if (!container) return;
  container.innerHTML = '';

  // Determine how many debates to display (up to 4)
  const count = Math.min(4, debatesData.length);
  for (let i = 0; i < count; i++) {
    const page = debatesData[i];
    const title = page.properties["TD:metadata"]?.rich_text?.[0]?.plain_text || 'No Title';
    const image = page.properties.Cover?.files?.[0]?.file?.url || "https://via.placeholder.com/80";

    const card = document.createElement('div');
    card.className = 'debate-card';
    card.style.cssText = `
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      flex: 1;
      min-width: 250px;
      cursor: pointer;
      margin: 0 0.5rem;
    `;
    card.innerHTML = `
      <div style="height: 150px; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <img src="${image}" alt="Debate Thumbnail" style="max-width: 100%; max-height: 100%; object-fit: cover;" />
      </div>
      <div style="padding: 1rem;">
        <h3>${title}</h3>
      </div>
    `;
    card.onclick = () => {
      window.location.href = `debate.html?debateId=${page.id}`;
    };
    container.appendChild(card);
  }
}


// Rotates the debates array forward: moves the first debate to the end and re-renders
function rotateDebatesSmooth() {
  const container = document.getElementById('debate-cards');
  if (!container || container.children.length <= 1) return;

  const card = container.querySelector('.debate-card');
  const cardStyle = window.getComputedStyle(card);
  const cardWidth = card.offsetWidth + parseFloat(cardStyle.marginRight);

  container.style.transition = 'transform 0.5s ease';
  container.style.transform = `translateX(-${cardWidth}px)`;

  setTimeout(() => {
    container.style.transition = 'none';
    container.style.transform = 'translateX(0)';
    // Move the first DOM node to the end without re-rendering
    container.appendChild(container.firstElementChild);
  }, 500);
}



// Rotates the debates array backward: moves the last debate to the front and re-renders
function rotateDebatesBackward() {
  if (debatesData.length <= 1) return;
  const last = debatesData.pop();
  debatesData.unshift(last);
  renderDebates();
}

// -----------------------------
// Articles (Notion) Functions
// -----------------------------
async function fetchArticlesFromNotion() {
  try {
    const response = await fetch('/api/articles');
    const data = await response.json();
    console.log("Articles fetched from server:", JSON.stringify(data, null, 2));
    displayArticlesFromNotion(data.results);
  } catch (err) {
    console.error("Error fetching articles from server:", err);
  }
}

function displayArticlesFromNotion(results) {
  const container = document.getElementById('article-cards');
  if (!container) return;
  container.innerHTML = '';

  // For the homepage, let's get up to 4 articles
  if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
    results = results.slice(0, 4);
  }

  // Create a wrapper for our layout
  const layoutWrapper = document.createElement('div');
  layoutWrapper.className = 'articles-layout'; // We'll style this in CSS

  // Create featured container (left side)
  const featuredWrapper = document.createElement('div');
  featuredWrapper.className = 'featured-article';

  // Create side container (right side)
  const sideWrapper = document.createElement('div');
  sideWrapper.className = 'side-articles';

  // If there's at least one article, use the first as "featured"
  if (results.length > 0) {
    const featuredPage = results[0];
    featuredWrapper.innerHTML = createArticleHTML(featuredPage, true);
  }

  // The next 3 articles go on the right side
  for (let i = 1; i < results.length && i < 4; i++) {
    const sidePage = results[i];
    sideWrapper.innerHTML += createArticleHTML(sidePage, false);
  }

  // Append the featured and side articles into our layout wrapper
  layoutWrapper.appendChild(featuredWrapper);
  layoutWrapper.appendChild(sideWrapper);

  // Finally, add the layout to the container
  container.appendChild(layoutWrapper);
}

// Helper to return HTML for either the featured or side article
function createArticleHTML(page, isFeatured) {
  const title = page.properties.data?.title?.[0]?.plain_text || 'No Title';
  const snippet = page.properties.Snippet?.rich_text?.[0]?.plain_text || 'No snippet available.';
  const image = page.properties.Cover?.files?.[0]?.file?.url || "https://via.placeholder.com/80";
  const author = page.properties.Author?.select?.name || 'Unknown';
  const date = page.properties.Date?.date?.start || 'Unknown Date';

  if (isFeatured) {
    // Larger featured article styling
    return `
      <div class="featured-card" onclick="window.location.href='article.html?articleId=${page.id}'">
        <div class="featured-image">
          <img src="${image}" alt="Article Thumbnail"/>
        </div>
        <div class="featured-content">
          <h3>${title}</h3>
          <p>${snippet}</p>
          <div><strong>${author}</strong><span> | ${date}</span></div>
        </div>
      </div>
    `;
  } else {
    // Smaller side article styling
    return `
      <div class="side-card" onclick="window.location.href='article.html?articleId=${page.id}'">
        <div class="side-image">
          <img src="${image}" alt="Article Thumbnail"/>
        </div>
        <div class="side-content">
          <h4>${title}</h4>
          <p>${snippet}</p>
          <div><strong>${author}</strong><span> | ${date}</span></div>
        </div>
      </div>
    `;
  }
}


// -----------------------------
// Article Detail Loading
// -----------------------------
async function loadArticleContent() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('articleId');
  if (!articleId) return;

  try {
    const pageResponse = await fetch(`/api/pages/${articleId}`);
    const pageData = await pageResponse.json();
    console.log("Page data:", pageData);

    const articleTitleElem = document.getElementById('article-title');
    if (articleTitleElem) {
      const title = pageData.properties.data?.title?.[0]?.plain_text || 'Untitled';
      articleTitleElem.textContent = title;
    }

    const response = await fetch(`/api/blocks/${articleId}/children?page_size=100`);
    const data = await response.json();
    console.log("Article content blocks:", data);

    const container = document.getElementById('article-content');
    if (container) {
      container.innerHTML = '';
      data.results.forEach(block => {
        let html = '';
        switch (block.type) {
          case 'paragraph':
            {
              const text = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
              html = `<p>${text}</p>`;
            }
            break;
          case 'heading_1':
            {
              const text = block.heading_1.rich_text.map(rt => rt.plain_text).join('');
              html = `<h1>${text}</h1>`;
            }
            break;
          case 'heading_2':
            {
              const text = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
              html = `<h2>${text}</h2>`;
            }
            break;
          case 'heading_3':
            {
              const text = block.heading_3.rich_text.map(rt => rt.plain_text).join('');
              html = `<h3>${text}</h3>`;
            }
            break;
          case 'bulleted_list_item':
            {
              const text = block.bulleted_list_item.rich_text.map(rt => rt.plain_text).join('');
              html = `<li>${text}</li>`;
            }
            break;
          case 'numbered_list_item':
            {
              const text = block.numbered_list_item.rich_text.map(rt => rt.plain_text).join('');
              html = `<li>${text}</li>`;
            }
            break;
          default:
            console.log("Unhandled block type:", block.type, block);
            break;
        }
        container.innerHTML += html;
      });
    }
  } catch (err) {
    console.error("Error loading article content:", err);
  }
}

// -----------------------------
// Comments & Voting Functions (Optional)
// -----------------------------
function castVote(side) {
  if (!isLoggedIn) {
    alert("You must be logged in to vote.");
    return;
  }
  votes[side]++;
  updateVotes();
}

function updateVotes() {
  const yesBar = document.getElementById('yes-bar');
  const noBar = document.getElementById('no-bar');
  const yesPercentSpan = document.getElementById('yes-percent');
  const noPercentSpan = document.getElementById('no-percent');
  const tally = document.getElementById('vote-tally');
  const total = votes.yes + votes.no;
  if (total === 0) {
    if (yesBar) yesBar.style.width = '0%';
    if (noBar) noBar.style.width = '0%';
    if (yesPercentSpan) yesPercentSpan.textContent = '0%';
    if (noPercentSpan) noPercentSpan.textContent = '0%';
    if (tally) tally.textContent = 'Yes: 0 | No: 0';
    return;
  }
  const yesPct = Math.round((votes.yes / total) * 100);
  const noPct = Math.round((votes.no / total) * 100);
  if (yesBar) yesBar.style.width = yesPct + '%';
  if (noBar) noBar.style.width = noPct + '%';
  if (yesPercentSpan) yesPercentSpan.textContent = yesPct + '%';
  if (noPercentSpan) noPercentSpan.textContent = noPct + '%';
  if (tally) tally.textContent = `Yes: ${votes.yes} | No: ${votes.no}`;
}

function addComment() {
  if (!isLoggedIn) {
    alert("You must be logged in to comment.");
    return;
  }
  const input = document.getElementById('comment-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const newComment = {
    text: text,
    userName: currentUserName || 'Anonymous',
    date: new Date().toLocaleString(),
    likes: 0,
    dislikes: 0,
    replies: []
  };
  comments.unshift(newComment);
  input.value = '';
  renderComments();
}

function renderComments() {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  comments.forEach((comment, index) => {
    const card = document.createElement('div');
    card.className = 'comment-card';
    const initials = getInitials(comment.userName);
    card.innerHTML = `
      <div class="comment-header">
        <div class="comment-icon" style="background:${getRandomColor()}">${initials}</div>
        <div class="comment-user-info">
          <strong>${comment.userName}</strong>
          <span class="comment-date">${comment.date}</span>
        </div>
      </div>
      <p class="comment-text">${comment.text}</p>
      <div class="comment-actions">
        <button onclick="likeComment(${index})">Like (${comment.likes})</button>
        <button onclick="dislikeComment(${index})">Dislike (${comment.dislikes})</button>
        <button onclick="replyToComment(${index})">Reply</button>
      </div>
      <div class="replies" id="replies-${index}">
        ${comment.replies.map(r => `
          <div class="reply-card">
            <div class="comment-icon" style="background:${getRandomColor()}">${getInitials(r.userName)}</div>
            <div class="reply-content">
              <strong>${r.userName}</strong> <span class="comment-date">${r.date}</span>
              <p>${r.text}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    list.appendChild(card);
  });
}

function likeComment(index) {
  if (!isLoggedIn) {
    alert("You must be logged in to like.");
    return;
  }
  comments[index].likes++;
  renderComments();
}

function dislikeComment(index) {
  if (!isLoggedIn) {
    alert("You must be logged in to dislike.");
    return;
  }
  comments[index].dislikes++;
  renderComments();
}

async function loadDebateContent() {
  const params = new URLSearchParams(window.location.search);
  const debateId = params.get('debateId');
  if (!debateId) return;
  try {
    const response = await fetch(`/api/pages/${debateId}`);
    const debateData = await response.json();
    console.log("Debate data:", debateData);
    const debateTitleElem = document.querySelector('.debate-question');
    if (debateTitleElem) {
      const title = debateData.properties["TD:metadata"]?.rich_text?.[0]?.plain_text || 'Untitled Debate';
      debateTitleElem.textContent = title;
    }
    const articleBtn = document.getElementById('article-btn');
    if (articleBtn) {
      articleBtn.href = `article.html?articleId=${debateId}`;
    }
  } catch (err) {
    console.error("Error loading debate content:", err);
  }
}

// -----------------------------
// Carousel for Debates Section
// -----------------------------
// Instead of using translateX animations, we now maintain an array of debate data and re-render 4 cards.
// Auto-rotate: every 3 seconds, rotate forward (move first debate to the end).
setInterval(rotateDebatesSmooth, 3000);

// Next and Prev button event handlers call the rotation functions.
document.getElementById('debate-next').addEventListener('click', rotateDebatesSmooth);
document.getElementById('debate-prev').addEventListener('click', rotateDebatesBackward);



function rotateDebatesBackward() {
  if (debatesData.length <= 1) return;
  const last = debatesData.pop();
  debatesData.unshift(last);
  renderDebates();
}

// -----------------------------
// Window Onload Initialization
// -----------------------------
window.onclick = function(event) {
  const modal = document.getElementById('login-modal');
  if (modal && event.target === modal) {
    toggleLoginModal();
  }
};

window.onload = function() {
  updateUI();
  updateVotes();
  renderComments();
  // Fetch debates and articles from Notion via your proxy endpoints
  fetchDebatesFromNotion();
  fetchArticlesFromNotion();

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      isLoggedIn = true;
      currentUserName = user.displayName || user.email;
      isWriter = (currentUserName === 'writer@mydomain.com');
    } else {
      isLoggedIn = false;
      isWriter = false;
      currentUserName = '';
    }
    updateUI();
  });
};
