// -----------------------------
// Global Variables and Constants
// -----------------------------
let isLoggedIn = false;
let isWriter = false;
let currentUserName = '';
// Initialize Firestore (Firebase is already initialized in your HTML)
const db = firebase.firestore();
// store displayName or email
let votes = { yes: 0, no: 0 };
let comments = [];

// For articles (Notion integration)
const ARTICLES_DATABASE_ID = '1a8c2d7a0a5580ed8e61cdc4db96c272';
const NOTION_TOKEN = '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';

// Global array for debates (Notion pages)
let debatesData = [];
let userIconColor = null;

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
      getUserProfile(result.user.uid); // Fetch the stored icon color
      updateUI();
      alert("Logged in successfully!");
    })

    .catch((error) => {
      console.error("Email login error:", error);
      alert("Email login failed: " + error.message);
    });
}

function toggleSignupModal() {
  const modal = document.getElementById('signup-modal');
  if (!modal) return;
  modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

function signupWithEmailForm(event) {
  event.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((result) => {
      isLoggedIn = true;
      currentUserName = result.user.displayName || result.user.email;
      // Create user profile in Firestore
      return db.collection('users').doc(result.user.uid).set({
        email: email,
        iconColor: getRandomColor()
      });
    })
    .then(() => {
      toggleSignupModal();
      updateUI();
      alert("Signed up and logged in successfully!");
    })
    .catch((error) => {
      console.error("Signup error:", error);
      alert("Signup failed: " + error.message);
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
      // Use the stored userIconColor if available, otherwise fallback to a random color.
      profileIcon.style.backgroundColor = userIconColor || getRandomColor();
    }
  }
  const writerTools = document.getElementById('writer-tools');
  if (writerTools) {
    writerTools.style.display = isWriter ? 'block' : 'none';
  }
}

function getUserProfile(uid) {
  db.collection('users').doc(uid).get()
    .then(doc => {
      if (doc.exists) {
        userIconColor = doc.data().iconColor;
        updateUI(); // Update UI with the stored color
      }
    })
    .catch(error => {
      console.error("Error fetching user profile:", error);
    });
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
    debatesData = debates;
    preloadDebateImages();  // Preload images before rendering
    renderDebates();
  } catch (err) {
    console.error("Error fetching debates from Notion:", err);
  }
}

function preloadDebateImages() {
  debatesData.forEach(page => {
    const image = page.properties.Cover?.files?.[0]?.file?.url;
    if (image) {
      const img = new Image();
      img.src = image;
    }
  });
}

// Render all debate cards and duplicate them for infinite scrolling
function renderDebates() {
  const container = document.getElementById('debate-cards');
  if (!container) return;
  container.innerHTML = '';

  // Render original set
  debatesData.forEach(page => {
    const card = createDebateCard(page);
    container.appendChild(card);
  });

  // Duplicate the same set for a seamless loop
  debatesData.forEach(page => {
    const card = createDebateCard(page);
    container.appendChild(card);
  });
}

function createDebateCard(page) {
  const image = page.properties.Cover?.files?.[0]?.file?.url || "https://via.placeholder.com/80";
  const card = document.createElement('div');
  card.className = 'debate-card';
  card.innerHTML = `
    <div class="debate-card-image">
      <img src="${image}" alt="Debate Thumbnail" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  `;
  // Pause carousel on hover
  card.onmouseenter = () => { pauseCarousel = true; };
  card.onmouseleave = () => { pauseCarousel = false; };

  card.onclick = () => {
    window.location.href = `debate.html?debateId=${page.id}`;
  };
  return card;
}


// -----------------------------
// Continuous Carousel for Debates
// -----------------------------
// Remove any redundant step-based functions and use continuous scrolling
let lastTimestamp = null;
let scrollOffset = 0;
const scrollSpeed = 50;
let pauseCarousel = false;  // NEW

function continuousScroll(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (!pauseCarousel) {
    scrollOffset += (scrollSpeed * delta) / 1000;
    const container = document.getElementById('debate-cards');
    if (container) {
      const resetPoint = container.scrollWidth / 2;
      if (scrollOffset >= resetPoint) {
        scrollOffset -= resetPoint;
      }
      container.style.transform = `translateX(-${scrollOffset}px)`;
    }
  }
  requestAnimationFrame(continuousScroll);
}
requestAnimationFrame(continuousScroll);

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

  results.forEach(page => {
    const card = document.createElement('div');
    card.className = 'article-grid-card';
    card.innerHTML = createArticleGridHTML(page);
    container.appendChild(card);
  });
}


// New function for uniform article cards in the grid
function createArticleGridHTML(page) {
  const title = page.properties.data?.title?.[0]?.plain_text || 'No Title';
  const snippet = page.properties.Snippet?.rich_text?.[0]?.plain_text || 'No snippet.';
  const image = page.properties.Cover?.files?.[1]?.file?.url || "https://via.placeholder.com/80";
  const author = page.properties.Author?.select?.name || 'Unknown';
  const date = page.properties.Date?.date?.start || 'Unknown Date';

  return `
    <div onclick="window.location.href='article.html?articleId=${page.id}'" style="cursor: pointer;">
      <img src="${image}" alt="Article Image" style="width:100%; height:200px; object-fit:cover; border-radius:4px;">
      <h3 style="margin:0.5rem 0 0.25rem;">${title}</h3>
      <p style="margin:0 0 0.25rem;">${snippet}</p>
      <small>${author} | ${date}</small>
    </div>
  `;
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

    const authorElem = document.querySelector('.article-author');
    const dateElem = document.querySelector('.article-date');
    if (authorElem) {
      authorElem.textContent = pageData.properties.Author?.select?.name || 'Unknown Author';
    }
    if (dateElem) {
      dateElem.textContent = pageData.properties.Date?.date?.start || 'Unknown Date';
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
            const text = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
            html = `<p>${text}</p>`;
            break;
          case 'heading_1':
            const text1 = block.heading_1.rich_text.map(rt => rt.plain_text).join('');
            html = `<h1>${text1}</h1>`;
            break;
          case 'heading_2':
            const text2 = block.heading_2.rich_text.map(rt => rt.plain_text).join('');
            html = `<h2>${text2}</h2>`;
            break;
          case 'heading_3':
            const text3 = block.heading_3.rich_text.map(rt => rt.plain_text).join('');
            html = `<h3>${text3}</h3>`;
            break;
          case 'bulleted_list_item':
            const textList = block.bulleted_list_item.rich_text.map(rt => rt.plain_text).join('');
            html = `<li>${textList}</li>`;
            break;
          case 'numbered_list_item':
            const textNum = block.numbered_list_item.rich_text.map(rt => rt.plain_text).join('');
            html = `<li>${textNum}</li>`;
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
// Comments & Voting Functions
// -----------------------------
function castVote(side, debateId) {
  if (!isLoggedIn) {
    alert("You must be logged in to vote.");
    return;
  }
  const voteRef = db.collection('votes').doc(debateId);
  voteRef.get().then(doc => {
    const data = doc.data() || { yes: 0, no: 0, voters: {} };
    if (data.voters && data.voters[currentUserName]) {
      alert("You've already voted.");
      return;
    }
    const update = { voters: { ...data.voters, [currentUserName]: side } };
    update[side] = firebase.firestore.FieldValue.increment(1);
    voteRef.set(update, { merge: true });
  }).catch(error => {
    console.error("Error casting vote:", error);
  });
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

// Global variable to store the ID of the comment being replied to (null for top-level comments)
// Global variable to track reply mode
let replyToCommentId = null;
function replyToComment(commentId) {
  replyToCommentId = commentId;
  const input = document.getElementById('comment-input');
  input.placeholder = "Replying...";
  input.focus();
}

function deleteComment(commentId) {
  db.collection('comments').doc(commentId).get().then(doc => {
    const data = doc.data();
    if (data && data.userName === currentUserName) {
      db.collection('comments').doc(commentId).delete().then(() => {
        loadComments();
      }).catch(err => {
        console.error("Error deleting comment:", err);
      });
    } else {
      alert("You can only delete your own comment.");
    }
  });
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
    debateId: currentDebateId,
    parentId: replyToCommentId || null,
    text: text,
    userName: currentUserName,
    date: firebase.firestore.FieldValue.serverTimestamp(),
    likes: 0,
    dislikes: 0,
    likedBy: [],
    dislikedBy: []
  };

  db.collection('comments').add(newComment)
    .then(() => {
      input.value = "";
      replyToCommentId = null; // clear reply mode
      loadComments();
    })
    .catch(err => {
      console.error("Error adding comment:", err);
    });
}



function loadComments() {
  db.collection('comments')
    .where('debateId', '==', currentDebateId) // Only get comments for the current debate
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      const list = document.getElementById('comments-list');
      if (!list) {
        console.error("❌ 'comments-list' container not found.");
        return;
      }
      // Build a flat array of comments
      let flatComments = [];
      snapshot.forEach(doc => {
        flatComments.push({ id: doc.id, ...doc.data() });
      });
      // Build a map and tree structure
      const commentMap = {};
      flatComments.forEach(comment => {
         comment.children = [];
         commentMap[comment.id] = comment;
      });
      const topLevelComments = [];
      flatComments.forEach(comment => {
         if (comment.parentId) {
           if (commentMap[comment.parentId]) {
             commentMap[comment.parentId].children.push(comment);
           }
         } else {
           topLevelComments.push(comment);
         }
      });
      // Clear the container and render recursively
      list.innerHTML = '';
      topLevelComments.forEach(comment => {
         renderCommentTree(comment, list, 0);
      });
    }, error => {
      console.error("❌ Error loading comments:", error);
    });
}

function renderCommentTree(comment, container, indentLevel) {
  const card = document.createElement('div');
  card.className = 'comment-card';
  card.style.marginLeft = (indentLevel * 20) + 'px';
  let dateStr = "";
  if (comment.date && comment.date.seconds) {
    dateStr = new Date(comment.date.seconds * 1000).toLocaleString();
  }
  // Create reply icon (↩) and delete icon (🗑️) if the comment belongs to you
  const replyButton = `<button onclick="replyToComment('${comment.id}')" style="background:none;border:none;cursor:pointer;">↩</button>`;
  const deleteButton = (comment.userName === currentUserName)
    ? `<button onclick="deleteComment('${comment.id}')" style="background:none;border:none;cursor:pointer;">🗑️</button>`
    : "";
  card.innerHTML = `
    <strong>${comment.userName || "Anonymous"}</strong> (${dateStr})
    <p style="white-space: pre-wrap; word-wrap: break-word;">${comment.text}</p>
    <button onclick="likeComment('${comment.id}')">👍 ${comment.likes || 0}</button>
    <button onclick="dislikeComment('${comment.id}')">👎 ${comment.dislikes || 0}</button>
    ${replyButton}
    ${deleteButton}
  `;
  container.appendChild(card);
  // Render any replies
  if (comment.children && comment.children.length > 0) {
    comment.children.forEach(child => {
      renderCommentTree(child, container, indentLevel + 1);
    });
  }
}



function renderOneComment(comment, container) {
  let dateStr = "";
  if (comment.date && comment.date.seconds) {
    dateStr = new Date(comment.date.seconds * 1000).toLocaleString();
  }
  // Create reply button icon
  const replyButton = `<button onclick="replyToComment('${comment.id}')" style="background:none;border:none;cursor:pointer;">↩</button>`;
  // Only show delete icon if the comment belongs to the current user
  const deleteButton = (comment.userName === currentUserName)
    ? `<button onclick="deleteComment('${comment.id}')" style="background:none;border:none;cursor:pointer;">🗑️</button>`
    : "";

  const card = document.createElement('div');
  card.className = 'comment-card';
  card.innerHTML = `
    <strong>${comment.userName || "Anonymous"}</strong> (${dateStr})
    <p style="white-space: pre-wrap; word-wrap: break-word;">${comment.text}</p>
    <button onclick="likeComment('${comment.id}')">👍 ${comment.likes || 0}</button>
    <button onclick="dislikeComment('${comment.id}')">👎 ${comment.dislikes || 0}</button>
    ${replyButton}
    ${deleteButton}
  `;
  container.appendChild(card);
}


function listenToVotes(debateId) {
  const voteRef = db.collection('votes').doc(debateId);
  voteRef.onSnapshot(doc => {
    const data = doc.data();
    if (data) {
      votes.yes = data.yes || 0;
      votes.no = data.no || 0;
      updateVotes();
    }
  });
}


function likeComment(commentId) {
  if (!isLoggedIn) {
    alert("You must be logged in to like.");
    return;
  }
  const commentRef = db.collection('comments').doc(commentId);
  commentRef.get().then(doc => {
    const data = doc.data();
    if (!data) return;
    if (data.likedBy && data.likedBy.includes(currentUserName)) {
      alert("You've already liked this comment.");
      return;
    }
    // If user had disliked before, remove that dislike
    const updates = {
      likes: firebase.firestore.FieldValue.increment(1)
    };
    if (data.dislikedBy && data.dislikedBy.includes(currentUserName)) {
      updates.dislikes = firebase.firestore.FieldValue.increment(-1);
    }
    // Update arrays
    commentRef.update({
      ...updates,
      likedBy: firebase.firestore.FieldValue.arrayUnion(currentUserName),
      dislikedBy: firebase.firestore.FieldValue.arrayRemove(currentUserName)
    });
  }).catch(error => {
    console.error("Error liking comment:", error);
  });
}

function dislikeComment(commentId) {
  if (!isLoggedIn) {
    alert("You must be logged in to dislike.");
    return;
  }
  const commentRef = db.collection('comments').doc(commentId);
  commentRef.get().then(doc => {
    const data = doc.data();
    if (!data) return;
    if (data.dislikedBy && data.dislikedBy.includes(currentUserName)) {
      alert("You've already disliked this comment.");
      return;
    }
    const updates = {
      dislikes: firebase.firestore.FieldValue.increment(1)
    };
    if (data.likedBy && data.likedBy.includes(currentUserName)) {
      updates.likes = firebase.firestore.FieldValue.increment(-1);
    }
    commentRef.update({
      ...updates,
      dislikedBy: firebase.firestore.FieldValue.arrayUnion(currentUserName),
      likedBy: firebase.firestore.FieldValue.arrayRemove(currentUserName)
    });
  }).catch(error => {
    console.error("Error disliking comment:", error);
  });
}


// -----------------------------
// Window Onload Initialization
// -----------------------------
window.onclick = function(event) {
  const loginModal = document.getElementById('login-modal');
  const signupModal = document.getElementById('signup-modal');

  if (loginModal && event.target === loginModal) {
    toggleLoginModal();
  }
  if (signupModal && event.target === signupModal) {
    toggleSignupModal();
  }
};

window.onload = function() {
  updateUI();
  updateVotes();

  // Only load comments if on debate.html (i.e. if currentDebateId is defined)
  if (window.location.pathname.includes('debate.html')) {
    loadComments();
    listenToVotes(currentDebateId);
  }

  // Fetch debates and articles via your proxy endpoints
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

