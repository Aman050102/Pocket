const API_URL = "https://my-finance-api.aman02012548.workers.dev";

let state = {
    token: localStorage.getItem('pocket_token') || null,
    transactions: [],
    allTransactions: [],
    categories: [],
    accounts: [],
    currentMonth: new Date().toISOString().substring(0, 7)
};

// --- Auth ---
function logout() { localStorage.removeItem('pocket_token'); location.reload(); }
function checkAuth() {
    if (state.token) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        fetchAppData();
        setupNotification();
    }
}

async function fetchAppData() {
    if (!state.token) return;
    try {
        const headers = { 'Authorization': `Bearer ${state.token}` };
        const [transRes, allTransRes, settingsRes] = await Promise.all([
            fetch(`${API_URL}/api/transactions?month=${state.currentMonth}`, { headers }),
            fetch(`${API_URL}/api/transactions`, { headers }),
            fetch(`${API_URL}/api/settings`, { headers })
        ]);
        if (transRes.status === 401) return logout();
        state.transactions = await transRes.json();
        state.allTransactions = await allTransRes.json();
        const settings = await settingsRes.json();
        state.categories = settings.categories || [];
        state.accounts = settings.accounts || [];
        render();
        renderDashboard();
    } catch (err) { console.error("Load Error", err); }
}

// --- Views ---
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-bar button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    const navId = viewName === 'home' ? 'nav-home' : (viewName === 'accounts' ? 'nav-accounts' : (viewName === 'dashboard' ? 'nav-dash' : 'nav-cats'));
    document.getElementById(navId).classList.add('active');
}

async function deleteTransaction(id) {
    if (!confirm('ลบรายการนี้?')) return;
    try {
        const res = await fetch(`${API_URL}/api/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) fetchAppData();
    } catch (err) { alert("ลบไม่สำเร็จ"); }
}

// --- Rendering ---
function render() {
    // 1. Render Settings
    document.getElementById('category-list-render').innerHTML = state.categories.map(c => `
        <div class="cat-pill"><span>${c.name}</span><button onclick="deleteSetting('cat', ${c.id})" class="btn-del">ลบ</button></div>`).join('');
    document.getElementById('account-list-render').innerHTML = state.accounts.map(a => `
        <div class="cat-pill"><span>🏦 ${a.name}</span><button onclick="deleteSetting('acc', ${a.id})" class="btn-del">ลบ</button></div>`).join('');

    // 2. ยอดรวม Lifetime (บนสุด)
    let totalIn = 0, totalOut = 0;
    state.allTransactions.forEach(t => {
        const val = parseFloat(t.amt) || 0;
        if (t.type === 'in') totalIn += val; else totalOut += val;
    });
    document.getElementById('total-in').innerText = `฿${totalIn.toLocaleString()}`;
    document.getElementById('total-out').innerText = `฿${totalOut.toLocaleString()}`;
    document.getElementById('total-net').innerText = `฿${(totalIn - totalOut).toLocaleString()}`;

    // 3. รายการล่าสุดรายเดือน (ล่างสุด)
    const listDiv = document.getElementById('transaction-list');
    listDiv.innerHTML = state.transactions.length ? '' : '<p style="text-align:center; color:#64748b; font-size:0.9rem; margin-top:20px;">ไม่มีรายการในเดือนนี้</p>';
    state.transactions.forEach(t => {
        listDiv.innerHTML += `
            <div class="item-row">
                <div class="item-info"><b>${t.desc}</b><small>${t.date} • ${t.cat} | <span class="acc-tag">${t.acc}</span></small></div>
                <div style="text-align:right">
                    <span class="${t.type === 'in' ? 'in' : 'out'}" style="font-weight:600">${t.type === 'in' ? '+' : '-'}${t.amt.toLocaleString()}</span>
                    <button onclick="deleteTransaction(${t.id})" class="btn-del" style="display:block; margin-left:auto; margin-top:4px">ลบ</button>
                </div>
            </div>`;
    });
}

// --- ส่วนที่ปรับปรุงใหม่: renderDashboard ---
function renderDashboard() {
    const dashCat = document.getElementById('dashboard-cat-summary');
    const dashAcc = document.getElementById('dashboard-acc-summary');

    const monthIn = state.transactions.filter(t => t.type === 'in').reduce((a, b) => a + (parseFloat(b.amt) || 0), 0);
    const monthOut = state.transactions.filter(t => t.type === 'out').reduce((a, b) => a + (parseFloat(b.amt) || 0), 0);

    // คำนวณรายจ่ายแยกตามหมวดหมู่
    const catMap = {};
    state.transactions.filter(t => t.type === 'out').forEach(t => {
        catMap[t.cat] = (catMap[t.cat] || 0) + parseFloat(t.amt);
    });

    // 1. ส่วนบน: วงกลมสัดส่วน และ สถิติด่วน
    dashCat.innerHTML = `
        <div class="dashboard-grid">
            <div class="mini-stat-card"><span>รับเดือนนี้</span><strong class="in">฿${monthIn.toLocaleString()}</strong></div>
            <div class="mini-stat-card"><span>จ่ายเดือนนี้</span><strong class="out">฿${monthOut.toLocaleString()}</strong></div>
        </div>
        <div class="summary-container">
            <div class="circle-chart" style="background: conic-gradient(#10b981 0% ${(monthIn/(monthIn+monthOut || 1))*100}%, #f43f5e 0% 100%)">
                <div class="inner-circle chart-center-text">
                    <small>คงเหลือ</small>
                    <strong>฿${(monthIn - monthOut).toLocaleString()}</strong>
                </div>
            </div>
            <div class="summary-stats">
                <p>📈 รายรับ: <strong style="color:#10b981">${((monthIn/(monthIn+monthOut || 1))*100).toFixed(0)}%</strong></p>
                <p>📉 รายจ่าย: <strong style="color:#f43f5e">${((monthOut/(monthIn+monthOut || 1))*100).toFixed(0)}%</strong></p>
                <p>📝 รายการ: <strong>${state.transactions.length} ชุด</strong></p>
            </div>
        </div>
        <hr style="border:none; border-top:1px solid #f1f5f9; margin: 20px 0;">
        <p style="font-size: 0.95rem; font-weight: 700; margin-bottom: 20px; color: var(--primary);">📊 รายจ่ายแยกตามหมวดหมู่</p>
    `;

    // 2. รายการ Progress Bar ของหมวดหมู่
    const sortedCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
    if(sortedCats.length === 0) {
        dashCat.innerHTML += `<p style="text-align:center; color:#94a3b8; font-size:0.85rem; padding: 20px 0;">ยังไม่มีข้อมูลการใช้จ่าย</p>`;
    } else {
        sortedCats.forEach(([name, val]) => {
            const pct = (val / monthOut) * 100;
            dashCat.innerHTML += `
                <div class="cat-usage-item">
                    <div class="cat-usage-label"><b>${name}</b><small>฿${val.toLocaleString()} (${pct.toFixed(0)}%)</small></div>
                    <div class="progress-bg"><div class="progress-bar bar-accent" style="width:${pct}%"></div></div>
                </div>`;
        });
    }

    // 3. ส่วนล่าง: สถานะบัญชี
    const accMap = {};
    state.accounts.forEach(a => accMap[a.name] = 0);
    state.allTransactions.forEach(t => {
        const val = parseFloat(t.amt) || 0;
        if (t.type === 'in') accMap[t.acc] = (accMap[t.acc] || 0) + val;
        else accMap[t.acc] = (accMap[t.acc] || 0) - val;
    });

    const maxAcc = Math.max(...Object.values(accMap), 1);
    dashAcc.innerHTML = Object.keys(accMap).map(name => {
        const pct = Math.max(0, (accMap[name] / maxAcc) * 100);
        return `
            <div style="margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.9rem;">
                    <span style="font-weight:500; color:#475569;">🏦 ${name}</span>
                    <strong style="color:var(--primary)">฿${accMap[name].toLocaleString()}</strong>
                </div>
                <div class="progress-bg"><div class="progress-bar bar-success" style="width:${pct}%"></div></div>
            </div>`;
    }).join('');
}

function setupNotification() {
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 20 && now.getMinutes() === 0) new Notification("Pocket", { body: "อย่าลืมบันทึกรายจ่ายวันนี้!" });
    }, 60000);
}

document.getElementById('month-filter').onchange = (e) => { state.currentMonth = e.target.value; fetchAppData(); };
checkAuth();

// --- ส่วนเติมเต็มเพื่อให้ฟังก์ชันทำงานได้ครบ (ห้ามตัด) ---

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type = input.type === "password" ? "text" : "password";
    btn.innerText = input.type === "password" ? "SHOW" : "HIDE";
}

function openEntryModal() {
    const catSelect = document.getElementById('cat-select');
    const accSelect = document.getElementById('acc-select');
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('') || '<option disabled>เพิ่มหมวดหมู่ก่อน</option>';
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('') || '<option disabled>เพิ่มบัญชีก่อน</option>';
    document.getElementById('entry-modal').style.display = 'flex';
}

function closeEntryModal() { document.getElementById('entry-modal').style.display = 'none'; }

async function addSetting(type) {
    const inputId = type === 'cat' ? 'new-cat-input' : 'new-acc-input';
    const name = document.getElementById(inputId).value.trim();
    if (!name) return;
    try {
        const res = await fetch(`${API_URL}/api/settings/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify({ type, name })
        });
        if (res.ok) { document.getElementById(inputId).value = ''; await fetchAppData(); }
    } catch (err) { alert("เพิ่มไม่สำเร็จ"); }
}

async function deleteSetting(type, id) {
    if (!confirm('ลบรายการนี้?')) return;
    try {
        const res = await fetch(`${API_URL}/api/settings/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify({ type, id })
        });
        if (res.ok) await fetchAppData();
    } catch (err) { alert("ลบไม่สำเร็จ"); }
}

document.getElementById('entry-form').onsubmit = async (e) => {
    e.preventDefault();
    const entry = {
        desc: document.getElementById('desc').value,
        amt: parseFloat(document.getElementById('amt').value),
        type: document.getElementById('type-select').value,
        cat: document.getElementById('cat-select').value,
        acc: document.getElementById('acc-select').value,
        month: state.currentMonth,
        date: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    };
    try {
        const res = await fetch(`${API_URL}/api/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify(entry)
        });
        if (res.ok) { closeEntryModal(); await fetchAppData(); }
    } catch (err) { alert("บันทึกไม่สำเร็จ"); }
};

// Login Form
if(document.getElementById('login-form')) {
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value })
            });
            const data = await res.json();
            if (res.ok) { localStorage.setItem('pocket_token', data.token); location.reload(); }
            else alert(data.error);
        } catch (err) { alert("Error connecting to server"); }
    };
}

function toggleAuth(view) {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('register-card').classList.add('hidden');
    document.getElementById('forgot-card').classList.add('hidden');
    document.getElementById(`${view}-card`).classList.remove('hidden');
}
