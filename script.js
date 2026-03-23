const API_URL = "https://script.google.com/macros/s/AKfycbw2o6edVGp86S0lLnDmZaw1TmXvNej0hHllqWpLhlMl0YuSVyzndb4ZqTKMqcmR2hVk/exec";

let html5QrCode;
let comparisonChart;
let currentClassId = '';
let currentMode = 'attendance';
let allClassData = []; 
let teacherPassword = localStorage.getItem('teacherPass') || '1234';
let isProcessing = false; // ป้องกันการสแกนซ้อน
let assignmentData = {};  // เก็บข้อมูลใบงานและคะแนนสำหรับดึงอัตโนมัติ

// --- 1. ระบบโหมดครูผู้สอน ---

function unlockTeacherMode() {
    const pass = prompt("กรุณากรอกรหัสผ่านผู้สอน:");
    if (pass === teacherPassword) {
        const section = document.getElementById('teacher-section');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        alert("🔓 ปลดล็อกโหมดครูผู้สอนเรียบร้อย");
    } else {
        alert("❌ รหัสผ่านไม่ถูกต้อง");
    }
}

function closeTeacherSection() {
    document.getElementById('teacher-section').style.display = 'none';
    document.getElementById('new-class-name').value = '';
    document.getElementById('new-assignment').value = '';
}

function changePassword() {
    const newPass = prompt("ระบุรหัสผ่านใหม่:");
    if (newPass) {
        teacherPassword = newPass;
        localStorage.setItem('teacherPass', newPass);
        alert("✅ เปลี่ยนรหัสผ่านสำเร็จ");
    }
}

// --- 2. การจัดการห้องเรียน ---

function filterLevel(level) {
    document.querySelectorAll('#levelTab button').forEach(btn => btn.classList.remove('active'));
    const activeBtnId = level === 'ปวช' ? 'btn-level-pvc' : 'btn-level-pvs';
    if(document.getElementById(activeBtnId)) {
        document.getElementById(activeBtnId).classList.add('active');
    }
    renderClassButtons(level);
}

function renderClassButtons(level) {
    const container = document.getElementById('class-buttons');
    container.innerHTML = '<div class="col-12 text-center text-muted small">กำลังโหลดรายการห้องเรียน...</div>';
    
    fetch(`${API_URL}?action=getClasses`)
        .then(res => res.json())
        .then(data => {
            allClassData = data;
            const filtered = data.filter(c => c.level === level);
            container.innerHTML = '';
            
            if(filtered.length === 0) {
                container.innerHTML = `<div class="col-12 text-center py-3">ยังไม่มีห้องเรียนระดับ ${level}</div>`;
                return;
            }

            filtered.forEach(item => {
                const col = document.createElement('div');
                col.className = 'col-4 col-md-3';
                const displayName = item.name || item.id; 
                col.innerHTML = `<div class="card card-btn text-center p-3 shadow-sm" 
                                onclick="selectClass('${displayName}', this)">${displayName}</div>`;
                container.appendChild(col);
            });
        });
}

function selectClass(classId, element) {
    if(!classId || String(classId).includes('T00:00')) {
        alert("ข้อมูลห้องเรียนผิดพลาด กรุณาลบและสร้างใหม่ใน Sheets");
        return;
    }
    currentClassId = classId;
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    document.getElementById('selected-class').innerText = "จัดการห้อง: " + classId;
    document.getElementById('selected-class').className = "status-badge bg-primary shadow-sm mb-3";
    document.getElementById('setting-class-name').innerText = classId;

    loadAssignments(classId); 
    loadScoreSummary(); // โหลดตารางคะแนนของห้องที่เลือกทันที
}

// --- 3. การจัดการใบงานและคะแนน (โหมดครู & สแกนเนอร์) ---

async function addNewClass() {
    const level = document.getElementById('new-level').value;
    const name = document.getElementById('new-class-name').value;
    if (!name) return alert("กรุณาระบุชื่อห้อง (เช่น 1/1)");

    const params = new URLSearchParams();
    params.append('action', 'addClass');
    params.append('level', level);
    params.append('name', name);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("✅ สร้างห้องเรียน " + level + " " + name + " สำเร็จ");
        closeTeacherSection();
        renderClassButtons(level);
    } catch (e) { alert("ล้มเหลว: " + e.message); }
}

async function addNewAssignment() {
    const asgnName = document.getElementById('new-assignment').value;
    if (!currentClassId) return alert("กรุณาเลือกห้องเรียนก่อนเพิ่มงาน");
    if (!asgnName) return alert("กรุณากรอกชื่อใบงาน");

    const params = new URLSearchParams();
    params.append('action', 'addNewAssignment');
    params.append('classId', currentClassId);
    params.append('assignmentName', asgnName);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("✅ เพิ่มใบงาน: " + asgnName + " เรียบร้อยแล้ว");
        closeTeacherSection();
        loadAssignments(currentClassId);
    } catch (e) { alert("❌ เกิดข้อผิดพลาด"); }
}

async function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    if(!select) return;
    select.innerHTML = '<option value="">กำลังโหลดงาน...</option>';
    
    try {
        const response = await fetch(`${API_URL}?action=getAssignments&classId=${classId}`);
        const assignments = await response.json();
        
        select.innerHTML = '<option value="">-- เลือกใบงาน --</option>';
        assignmentData = {}; // ล้างข้อมูลเก่า
        
        assignments.forEach(asgn => {
            const option = document.createElement('option');
            option.value = asgn.id;
            option.text = asgn.title || asgn.name;
            // เก็บค่าคะแนนไว้ใน attribute และ object
            const points = asgn.points || asgn.score || 10;
            option.setAttribute('data-score', points);
            select.appendChild(option);
            
            assignmentData[asgn.id] = points; 
        });
    } catch (e) {
        select.innerHTML = '<option value="">โหลดงานไม่สำเร็จ</option>';
    }
}

function onAssignmentChange() {
    const select = document.getElementById('assignment-select');
    const scoreInput = document.getElementById('input-score');
    if(!select || !scoreInput) return;
    
    const selectedId = select.value;
    if (assignmentData[selectedId]) {
        scoreInput.value = assignmentData[selectedId];
    } else {
        scoreInput.value = '';
    }
}

// --- 4. ระบบสแกนและบันทึก Real-time ---

function switchMode(mode) {
    currentMode = mode;
    const scoreForm = document.getElementById('score-form');
    const modeTitle = document.getElementById('mode-title');
    const tabAtt = document.getElementById('tab-att');
    const tabScore = document.getElementById('tab-score');

    if (mode === 'score') {
        scoreForm.style.display = 'block';
        modeTitle.innerText = "📝 สแกนบันทึกคะแนนงาน";
        tabScore.className = "flex-fill text-center p-3 fw-bold bg-light text-primary border-start";
        tabAtt.className = "flex-fill text-center p-3 fw-bold text-muted border-end";
    } else {
        scoreForm.style.display = 'none';
        modeTitle.innerText = "📷 สแกนเช็คชื่อเข้าเรียน";
        tabAtt.className = "flex-fill text-center p-3 fw-bold bg-light text-primary border-end";
        tabScore.className = "flex-fill text-center p-3 fw-bold text-muted border-start";
    }
}

async function startCamera() {
    if (!currentClassId) return alert("กรุณาเลือกห้องเรียนก่อนสแกน");
    const status = document.getElementById('status');
    status.innerText = "กำลังเข้าถึงกล้อง...";
    html5QrCode = new Html5Qrcode("reader");
    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        );
        status.innerText = "กล้องพร้อม สแกนได้ทันที";
        status.className = "status-badge bg-success mb-3";
    } catch (err) {
        status.innerText = "เปิดกล้องไม่สำเร็จ";
        status.className = "status-badge bg-danger mb-3";
    }
}

async function stopCamera() {
    if (html5QrCode) {
        await html5QrCode.stop();
        document.getElementById('status').innerText = "สถานะ: ปิดกล้องแล้ว";
        document.getElementById('status').className = "status-badge bg-secondary mb-3";
    }
}
async function onScanSuccess(decodedText) {
    if (isProcessing) return;
    isProcessing = true;

    // --- ส่วนของเสียงปี๊บ ---
    const beep = document.getElementById('beep-sound');
    if (beep) {
        beep.currentTime = 0; // รีเซ็ตเสียงไปที่เริ่มต้น (เผื่อกรณีสแกนรัว)
        beep.play().catch(e => {
            console.log("Browser บล็อกการเล่นเสียงอัตโนมัติ: ", e.message);
        });
    }

    const status = document.getElementById('status');
    const params = new URLSearchParams();

    // ... (ส่วนลอจิกการส่งข้อมูลเดิมของคุณครู) ...
    if (currentMode === 'score') {
        const asgnId = document.getElementById('assignment-select').value;
        const score = document.getElementById('input-score').value;
        if(!asgnId || !score) {
            alert("กรุณาเลือกงานและระบุคะแนน");
            isProcessing = false;
            return;
        }
        params.append('action', 'submitWork');
        params.append('userId', decodedText);
        params.append('assignmentId', asgnId);
        params.append('score', score);
    } else {
        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);
    }

    status.innerText = "⏳ กำลังบันทึก...";
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "✅ สำเร็จ: " + decodedText;
        showToast("✅ บันทึก " + decodedText + " เรียบร้อย!");
        loadScoreSummary(); 
    } catch (e) { 
        status.innerText = "❌ บันทึกล้มเหลว"; 
    } finally {
        setTimeout(() => { isProcessing = false; }, 2000);
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'scan-toast bg-success text-white p-2 rounded shadow';
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '9999';
    toast.innerText = msg;
    document.body.appendChild(toast);
    
    // แสดง Badge อัปเดตตาราง (ถ้ามี)
    const sync = document.getElementById('sync-status');
    if(sync) sync.style.display = 'inline-block';
    
    setTimeout(() => { 
        toast.remove();
        if(sync) sync.style.display = 'none';
    }, 2500);
}

// --- 5. กราฟและการแสดงผลข้อมูล ---

async function loadScoreSummary() {
    if(!currentClassId) return;
    const body = document.getElementById('summary-body');
    if(!body) return;
    
    try {
        const res = await fetch(`${API_URL}?action=getScoreSummary&classId=${currentClassId}`);
        const data = await res.json();
        body.innerHTML = '';
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td class="text-start">${row.name}</td>
                <td>${row.attendanceCount || 0}</td>
                <td>${row.workCount || 0}</td>
                <td class="fw-bold text-primary">${row.totalScore || 0}</td>
                <td>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar" style="width: ${row.progress || 0}%"></div>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    } catch (e) { console.error("โหลดข้อมูลตารางล้มเหลว"); }
}

async function updateComparisonChart() {
    try {
        const res = await fetch(`${API_URL}?action=getClassComparison`);
        const data = await res.json();
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        if(comparisonChart) comparisonChart.destroy();
        comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.className),
                datasets: [{
                    label: 'คะแนนเฉลี่ย',
                    data: data.map(d => d.averageScore),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) { console.error("โหลดกราฟไม่สำเร็จ"); }
}

window.onload = () => {
    filterLevel('ปวช');
    updateComparisonChart();
};
