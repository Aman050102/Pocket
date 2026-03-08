// 1. กำหนด URL ของ Cloudflare Worker API
const API_URL = "https://my-finance-api.aman02012548.workers.dev/api";

// เริ่มต้นสถานะข้อมูล (หมวดหมู่และบัญชียังใช้ localStorage เพื่อความสะดวกในการตั้งค่าส่วนตัว)
let state = {
    transactions: [],
    categories: JSON.parse(localStorage.getItem('fpro_cat')) || ['อาหาร', 'เดินทาง', 'จิปาถะ', 'เงินเดือน'],
    accounts: JSON.parse(localStorage.getItem('fpro_acc')) || ['เงินสด', 'ธ.กรุงไทย', 'ธ.ออมสิน'],
    currentMonth: new Date().toISOString().substring(0, 7)
};

// 2. การจัดการหน้าจอ (Navigation)
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-bar button').forEach(b => b.classList.remove('active'));

    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    const navId = `nav-${viewName === 'home' ? 'home' : (viewName === 'accounts' ? 'accounts' : 'cats')}`;
    document.getElementById(navId).classList.add('active');
    render();
}

// 3. ดึงข้อมูลจาก Cloudflare D1
async function fetchTransactions() {
    try {
        const res = await fetch(`${API_URL}/transactions?month=${state.currentMonth}`);
        if (!res.ok) throw new Error("Network error");
        state.transactions = await res.json();
        render();
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// 4. จัดการหมวดหมู่ (Categories)
function addCategory() {
    const input = document.getElementById('new-cat-input');
    const val = input.value.trim();
    if (val && !state.categories.includes(val)) {
        state.categories.push(val);
        saveSettings();
        input.value = '';
        render();
    }
}

function deleteCategory(index) {
    if (confirm('ยืนยันการลบหมวดหมู่?')) {
        state.categories.splice(index, 1);
        saveSettings();
        render();
    }
}

// 5. จัดการบัญชี (Accounts)
function addAccount() {
    const input = document.getElementById('new-acc-input');
    const val = input.value.trim();
    if (val && !state.accounts.includes(val)) {
        state.accounts.push(val);
        saveSettings();
        input.value = '';
        render();
    }
}

function deleteAccount(index) {
    if (confirm('การลบบัญชีจะไม่ลบข้อมูลเก่าที่เคยบันทึกไว้ ยืนยันไหม?')) {
        state.accounts.splice(index, 1);
        saveSettings();
        render();
    }
}

// 6. บันทึกรายการ (Transactions)
function openEntryModal() {
    document.getElementById('entry-modal').style.display = 'flex';
    renderDropdowns();
}

function closeEntryModal() {
    document.getElementById('entry-modal').style.display = 'none';
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
        const res = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
        if (res.ok) {
            closeEntryModal();
            e.target.reset();
            fetchTransactions(); // โหลดข้อมูลใหม่จาก DB
        }
    } catch (err) {
        alert("ไม่สามารถบันทึกข้อมูลได้");
    }
};

async function deleteTransaction(id) {
    if (confirm('ลบรายการนี้ใช่หรือไม่?')) {
        try {
            await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
            fetchTransactions();
        } catch (err) {
            alert("ไม่สามารถลบข้อมูลได้");
        }
    }
}

// 7. การประมวลผลและการแสดงผล
function saveSettings() {
    localStorage.setItem('fpro_cat', JSON.stringify(state.categories));
    localStorage.setItem('fpro_acc', JSON.stringify(state.accounts));
}

function renderDropdowns() {
    const catSel = document.getElementById('cat-select');
    const accSel = document.getElementById('acc-select');
    catSel.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    accSel.innerHTML = state.accounts.map(a => `<option value="${a}">${a}</option>`).join('');
}

function render() {
    // เรนเดอร์หน้าจัดการหมวดหมู่และบัญชี
    document.getElementById('category-list-render').innerHTML = state.categories.map((c, i) => `
        <div class="cat-pill"><span>${c}</span><button onclick="deleteCategory(${i})" class="btn-del">ลบ</button></div>
    `).join('');

    document.getElementById('account-list-render').innerHTML = state.accounts.map((a, i) => `
        <div class="cat-pill"><span>🏦 ${a}</span><button onclick="deleteAccount(${i})" class="btn-del">ลบ</button></div>
    `).join('');

    // แสดงรายการจาก State (ที่ได้จาก API)
    const listDiv = document.getElementById('transaction-list');
    listDiv.innerHTML = '';

    let sin = 0, sout = 0;
    state.transactions.forEach(t => {
        if (t.type === 'in') sin += t.amt; else sout += t.amt;
        listDiv.innerHTML += `
            <div class="item-row">
                <div class="item-info">
                    <b>${t.desc}</b>
                    <small>${t.date} • ${t.cat} | <span class="acc-tag">${t.acc}</span></small>
                </div>
                <div style="text-align:right">
                    <span class="${t.type === 'in' ? 'in' : 'out'}" style="font-weight:600">
                        ${t.type === 'in' ? '+' : '-'}${t.amt.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                    <button onclick="deleteTransaction(${t.id})" class="btn-del" style="display:block; margin-left:auto; margin-top:4px">ลบ</button>
                </div>
            </div>
        `;
    });

    // อัปเดตตัวเลขสรุป
    document.getElementById('total-in').innerText = `฿${sin.toLocaleString()}`;
    document.getElementById('total-out').innerText = `฿${sout.toLocaleString()}`;
    document.getElementById('total-net').innerText = `฿${(sin - sout).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

// 8. Event Listeners
document.getElementById('month-filter').onchange = (e) => {
    state.currentMonth = e.target.value;
    fetchTransactions();
};

window.onclick = (e) => { if(e.target == document.getElementById('entry-modal')) closeEntryModal(); };

// เริ่มต้นแอป
document.getElementById('month-filter').value = state.currentMonth;
fetchTransactions();
