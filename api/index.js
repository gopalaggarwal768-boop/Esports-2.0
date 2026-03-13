const BACKEND_BASE_URL = "BACKEND_URL_PLACEHOLDER";

const api = {
    async getAuthToken() {
        const user = firebase.auth().currentUser;
        return user ? await user.getIdToken() : null;
    },

    async post(endpoint, data) {
        const token = await this.getAuthToken();
        const response = await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    }
};function renderProfile(userData) {
    const XP_PER_LEVEL = 1000;
    const level = Math.floor(userData.totalXP / XP_PER_LEVEL) + 1;
    const currentLevelXP = userData.totalXP % XP_PER_LEVEL;
    const progressPercent = (currentLevelXP / XP_PER_LEVEL) * 100;

    // Update DOM (Reusing existing IDs/Classes)
    document.getElementById('user-level').innerText = `Lvl ${level}`;
    document.getElementById('xp-bar-fill').style.width = `${progressPercent}%`;
    document.getElementById('stat-matches').innerText = userData.matchesPlayed || 0;
    document.getElementById('stat-kills').innerText = userData.totalKills || 0;
    
    const vipBadge = document.getElementById('vip-badge');
    userData.isVip ? vipBadge.classList.remove('hidden') : vipBadge.classList.add('hidden');
}async function openJoinModal(match) {
    const container = document.getElementById('game-uid-inputs');
    container.innerHTML = ''; // Clear previous
    
    let requiredIDs = 1;
    if (match.mode === 'Duo') requiredIDs = 2;
    if (match.mode === 'Squad') requiredIDs = 4;

    for (let i = 0; i < requiredIDs; i++) {
        container.innerHTML += `
            <input type="text" class="existing-input-style mb-2" 
                   placeholder="Enter Game UID ${i + 1}" 
                   id="uid-input-${i}" required>`;
    }

    // On Submit Button Click
    document.getElementById('confirm-join-btn').onclick = async () => {
        const uids = [];
        for (let i = 0; i < requiredIDs; i++) {
            uids.push(document.getElementById(`uid-input-${i}`).value);
        }

        const res = await api.post('/match/join', {
            matchId: match.id,
            gameUids: uids
        });

        if (res.success) {
            showToast("Joined successfully!");
            closeModal();
        } else {
            showError(res.message);
        }
    };
}function renderMatchCard(match, isJoined) {
    const status = match.status; // 'upcoming', 'playing', 'ended'
    
    // 1. Join Button Logic
    const joinBtn = document.getElementById(`join-btn-${match.id}`);
    if (status !== 'upcoming' || isJoined) {
        joinBtn.disabled = true;
        joinBtn.innerText = isJoined ? "Joined" : "Locked";
    }

    // 2. Room Credentials Logic
    const roomInfo = document.getElementById(`room-info-${match.id}`);
    if (status === 'playing' && isJoined) {
        roomInfo.innerHTML = `
            <div class="p-3 bg-green-900/20 border border-green-500 rounded">
                <p>ID: ${match.roomId}</p>
                <p>Pass: ${match.roomPassword}</p>
            </div>`;
    }

    // 3. Post-Match Result Logic
    if (status === 'ended') {
        renderMatchSummary(match);
    }
}// Daily Reward
async function claimDaily() {
    const btn = document.getElementById('daily-claim-btn');
    btn.disabled = true;
    const res = await api.post('/rewards/daily', {});
    if (res.success) {
        showToast("Claimed successfully!");
    }
}

// Referral (Listeners for Real-time History)
function watchReferrals() {
    const uid = firebase.auth().currentUser.uid;
    db.collection('users').doc(uid).collection('referrals')
      .onSnapshot(snapshot => {
          const list = document.getElementById('referral-history');
          list.innerHTML = snapshot.docs.map(doc => `
            <div class="flex justify-between border-b border-white/10 py-2">
                <span>${doc.data().refereeName}</span>
                <span class="${doc.data().status === 'completed' ? 'text-green-500' : 'text-yellow-500'}">
                    ${doc.data().status}
                </span>
            </div>
          `).join('');
      });
        }async function initiateDeposit(amount) {
    // 1. Create Order on Backend
    const orderData = await api.post('/wallet/createOrder', { amount });
    
    if (!orderData.payment_session_id) {
        showError("Failed to initialize payment.");
        return;
    }

    // 2. Initialize Cashfree SDK
    const cashfree = Cashfree({
        mode: "production", // or "sandbox"
    });

    let checkoutOptions = {
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: "_self", 
    };

    // 3. Open Payment Modal
    cashfree.checkout(checkoutOptions).then((result) => {
        if (result.error) {
            console.log("User closed the popup or error occurred");
        }
        if (result.redirect) {
            console.log("Payment redirected");
        }
    });
}
