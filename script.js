// script.js
const auth = firebase.auth();
const db = firebase.firestore();

const loginBtn = document.getElementById('loginBtn');
const userInfo = document.getElementById('userInfo');
const welcome = document.getElementById('welcome');
const coinCount = document.getElementById('coinCount');
const spinBtn = document.getElementById('spinBtn');
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const logoutBtn = document.getElementById('logoutBtn');
const messageDiv = document.getElementById('message');
const leaderboardDiv = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboardList');

let currentUser = null;
let userCoins = 0;
let spinning = false;

let isScratching = false;
let revealed = false;
let scratchValue = null;

const scratchPrizes = [10, 0, 25, 5, 0, 15, 50, 100];

function getRandomPrize() {
  return scratchPrizes[Math.floor(Math.random() * scratchPrizes.length)];
}

function setupScratchCard(prize) {
  const ctx = scratchCanvas.getContext('2d');
  ctx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
  ctx.fillStyle = '#bdbdbd';
  ctx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
  ctx.font = '32px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Scratch Here!', scratchCanvas.width / 2, scratchCanvas.height / 2 + 10);
  revealed = false;
  scratchResult.textContent = '';
}

function revealPrize(prize) {
  scratchResult.textContent = prize > 0 ? `🎉 You won ${prize} coins!` : 'No win, try again!';
  scratchResult.style.color = prize > 0 ? 'green' : '#d32f2f';
  if (prize > 0) {
    winSound.currentTime = 0;
    winSound.play();
  }
}

scratchBtn.onclick = async () => {
  if (!currentUser || isScratching) return;
  isScratching = true;
  scratchValue = getRandomPrize();
  setupScratchCard(scratchValue);
  scratchCanvas.style.pointerEvents = 'auto';
  scratchBtn.disabled = true;
};

scratchCanvas.addEventListener('mousedown', function(e) {
  if (revealed || !isScratching) return;
  scratchCanvas.isDrawing = true;
});
scratchCanvas.addEventListener('mouseup', function(e) {
  scratchCanvas.isDrawing = false;
});
scratchCanvas.addEventListener('mousemove', function(e) {
  if (!scratchCanvas.isDrawing || revealed) return;
  const ctx = scratchCanvas.getContext('2d');
  const rect = scratchCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Check if enough area is scratched
  const imageData = ctx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height);
  let scratched = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] === 0) scratched++;
  }
  if (scratched > imageData.data.length / 4 * 0.45 && !revealed) {
    revealed = true;
    revealPrize(scratchValue);
    if (currentUser) {
      userCoins += scratchValue;
      coinCount.textContent = userCoins;
      updateCoins(currentUser.uid, userCoins);
      fetchLeaderboard();
    }
    scratchBtn.disabled = false;
    isScratching = false;
  scratchCanvas = document.getElementById('scratchCanvas');
  scratchBtn = document.getElementById('scratchBtn');
  scratchResult = document.getElementById('scratchResult');
    scratchCanvas.style.pointerEvents = 'none';
  }
});

// Hide wheel and show scratch card on login
function showScratchCardUI() {
  if (document.getElementById('wheelCanvas')) {
    document.getElementById('wheelCanvas').style.display = 'none';
  }
  if (document.getElementById('spinBtn')) {
    document.getElementById('spinBtn').style.display = 'none';
  }
  document.getElementById('scratchCardContainer').style.display = 'block';
  setupScratchCard(getRandomPrize());
  scratchBtn.disabled = false;
  scratchCanvas.style.pointerEvents = 'none';
}

// Sound effects
const spinSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b6b2b7b.mp3'); // spinning sound
const winSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b6b2b7b.mp3'); // winning sound (replace with a win sound URL)

function animateSpin(finalAngle, callback) {
  let start = null;
  const totalSpins = 6;
  spinning = true;
  spinSound.currentTime = 0;
  spinSound.play();
  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / 2200, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const angle = eased * (totalSpins * 360 + finalAngle);
    drawRotatedWheel(angle);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      drawRotatedWheel(finalAngle);
      spinning = false;
      spinSound.pause();
      callback();
    }
  }
  requestAnimationFrame(step);
}

async function updateCoins(uid, coins) {
  try {
    await db.collection('users').doc(uid).set({ coins }, { merge: true });
  } catch (e) {
    showMessage('Error updating coins!', '#d32f2f');
  }
}

async function fetchLeaderboard() {
  try {
    const snapshot = await db.collection('users').orderBy('coins', 'desc').limit(5).get();
    leaderboardList.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const li = document.createElement('li');
      li.textContent = `${data.name || 'Anonymous'}: ${data.coins || 0} coins`;
      leaderboardList.appendChild(li);
    });
    leaderboardDiv.style.display = 'block';
  } catch (e) {
    leaderboardDiv.style.display = 'none';
  }
}

loginBtn.onclick = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    currentUser = result.user;
    welcome.textContent = `Welcome, ${currentUser.displayName}`;
    loginBtn.style.display = 'none';
    userInfo.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    await loadUserData();
    await fetchLeaderboard();
    showMessage('Login successful!', 'green');
    showScratchCardUI();
  } catch (e) {
    showMessage('Login failed!', '#d32f2f');
  }
};

logoutBtn.onclick = async () => {
  await auth.signOut();
  currentUser = null;
  userInfo.style.display = 'none';
  loginBtn.style.display = 'inline-block';
  leaderboardDiv.style.display = 'none';
  showMessage('Logged out!', 'green');
};

async function loadUserData() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      userCoins = doc.data().coins || 0;
    } else {
      userCoins = 0;
      await db.collection('users').doc(currentUser.uid).set({
        name: currentUser.displayName,
        coins: 0
      });
    }
    coinCount.textContent = userCoins;
  } catch (e) {
    showMessage('Error loading user data!', '#d32f2f');
  }
}

spinBtn.onclick = async () => {
  if (!currentUser || spinning) return;
  spinBtn.disabled = true;
  showMessage('Spinning...', '#1976d2');
  const sectorAngle = 360 / sectors.length;
  const randomAngle = Math.random() * 360;
  animateSpin(randomAngle, async () => {
    // Offset by half a sector so pointer is at center
    let normalized = (360 - (randomAngle % 360) + sectorAngle / 2) % 360;
    let sectorIndex = Math.floor(normalized / sectorAngle) % sectors.length;
    const win = sectors[sectorIndex].value;
    userCoins += win;
    coinCount.textContent = userCoins;
    await updateCoins(currentUser.uid, userCoins);
    await fetchLeaderboard();
    if (win > 0) {
      winSound.currentTime = 0;
      winSound.play();
    }
    showMessage(win > 0 ? `You won ${win} coins!` : 'No win, try again!', win > 0 ? 'green' : '#d32f2f');
    spinBtn.disabled = false;
  });
};

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    welcome.textContent = `Welcome, ${user.displayName}`;
    loginBtn.style.display = 'none';
    userInfo.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    await loadUserData();
    await fetchLeaderboard();
    showScratchCardUI();
  } else {
    currentUser = null;
    userInfo.style.display = 'none';
    loginBtn.style.display = 'inline-block';
    leaderboardDiv.style.display = 'none';
    if (document.getElementById('scratchCardContainer')) {
      document.getElementById('scratchCardContainer').style.display = 'none';
    }
  }
});