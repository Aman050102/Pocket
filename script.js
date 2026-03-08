const API_URL = "https://my-finance-api.aman02012548.workers.dev";

let state = {
    token: localStorage.getItem('pocket_token') || null,
    transactions: [],
    categories: [],
    accounts: [],
    currentMonth: new Date().toISOString().substring(0, 7)
};

// --- Auth UI ---
function toggleAuth(view) {
    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('register-card').classList.add('hidden');
    document.getElementById('forgot-card').classList.add('hidden');
    document.getElementById(`${view}-card`).classList.remove('hidden');
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type = input.type === "password" ? "text" : "password";
    btn.innerText = input.type === "password" ? "SHOW" : "HIDE";
}

// --- API Auth ---
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value })
        });
        if (!res.ok) throw new Error("Login Failed");
        const data = await res.json();
        localStorage.setItem('pocket_token', data.token);
        location.reload();
    } catch (err) { alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); }
};

document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value })
        });
        if (res.ok) { alert("สมัครสำเร็จ! กรุณา Login"); toggleAuth('login'); }
        else alert("สมัครไม่สำเร็จ: " + await res.text());
    } catch (err) { alert("Error: " + err.message); }
};

function logout() { localStorage.removeItem('pocket_token'); location.reload(); }

function checkAuth() {
    if (state.token) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        fetchAppData();
    }
}

// --- Sync Data ---
async function fetchAppData() {
    if (!state.token) return;
    try {
        const headers = { 'Authorization': `Bearer ${state.token}` };
        const [transRes, settingsRes] = await Promise.all([
            fetch(`${API_URL}/api/transactions?month=${state.currentMonth}`, { headers }),
            fetch(`${API_URL}/api/settings`, { headers })
        ]);

        if (transRes.status === 401) return logout();

        state.transactions = await transRes.json();
        const settings = await settingsRes.json();
        state.categories = settings.categories || [];
        state.accounts = settings.accounts || [];

        render();
    } catch (err) { console.error("Load Error", err); }
}

async function addSetting(type) {
    const inputId = type === 'cat' ? 'new-cat-input' : 'new-acc-input';
    const name = document.getElementById(inputId).value.trim();
    if (!name) return;
    try {
        const res = await fetch(`${API_URL}/api/settings/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ type, name })
        });
        if (res.ok) {
            document.getElementById(inputId).value = '';
            await fetchAppData();
        } else {
            const errData = await res.json();
            alert("Error: " + errData.error);
        }
    } catch (err) { alert("เพิ่มไม่สำเร็จ: " + err.message); }
}

async function deleteSetting(type, id) {
    if (!confirm('ลบรายการนี้?')) return;
    try {
        const res = await fetch(`${API_URL}/api/settings/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ type, id })
        });
        if (res.ok) await fetchAppData();
    } catch (err) { alert("ลบไม่สำเร็จ"); }
}

// --- Logic ---
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-bar button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    let navId = viewName === 'home' ? 'nav-home' : (viewName === 'accounts' ? 'nav-accounts' : 'nav-cats');
    document.getElementById(navId).classList.add('active');
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(entry)
        });
        if (res.ok) {
            closeEntryModal();
            fetchAppData();
        }
    } catch (err) { alert("บันทึกไม่สำเร็จ"); }
};

async function deleteTransaction(id) {
    if (confirm('ลบรายการนี้?')) {
        try {
            const res = await fetch(`${API_URL}/api/transactions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) fetchAppData();
        } catch (err) { alert("ลบไม่สำเร็จ"); }
    }
}

function render() {
    document.getElementById('category-list-render').innerHTML = state.categories.map(c => `
        <div class="cat-pill"><span>${c.name}</span><button onclick="deleteSetting('cat', ${c.id})" class="btn-del">ลบ</button></div>`).join('');

    document.getElementById('account-list-render').innerHTML = state.accounts.map(a => `
        <div class="cat-pill"><span>🏦 ${a.name}</span><button onclick="deleteSetting('acc', ${a.id})" class="btn-del">ลบ</button></div>`).join('');

    const listDiv = document.getElementById('transaction-list');
    listDiv.innerHTML = ''; let sin = 0, sout = 0;

    state.transactions.forEach(t => {
        if (t.type === 'in') sin += t.amt; else sout += t.amt;
        listDiv.innerHTML += `
            <div class="item-row">
                <div class="item-info"><b>${t.desc}</b><small>${t.date} • ${t.cat} | <span class="acc-tag">${t.acc}</span></small></div>
                <div style="text-align:right">
                    <span class="${t.type === 'in' ? 'in' : 'out'}" style="font-weight:600">${t.type === 'in' ? '+' : '-'}${t.amt.toLocaleString()}</span>
                    <button onclick="deleteTransaction(${t.id})" class="btn-del" style="display:block; margin-left:auto; margin-top:4px">ลบ</button>
                </div>
            </div>`;
    });

    document.getElementById('total-in').innerText = `฿${sin.toLocaleString()}`;
    document.getElementById('total-out').innerText = `฿${sout.toLocaleString()}`;
    document.getElementById('total-net').innerText = `฿${(sin - sout).toLocaleString()}`;
}

function openEntryModal() {
    const catSelect = document.getElementById('cat-select');
    const accSelect = document.getElementById('acc-select');

    catSelect.innerHTML = state.categories.length
        ? state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')
        : '<option disabled>กรุณาเพิ่มหมวดหมู่ก่อน</option>';

    accSelect.innerHTML = state.accounts.length
        ? state.accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('')
        : '<option disabled>กรุณาเพิ่มบัญชีก่อน</option>';

    document.getElementById('entry-modal').style.display = 'flex';
}

function closeEntryModal() { document.getElementById('entry-modal').style.display = 'none'; }

document.getElementById('month-filter').onchange = (e) => { state.currentMonth = e.target.value; fetchAppData(); };
document.getElementById('month-filter').value = state.currentMonth;

checkAuth();
