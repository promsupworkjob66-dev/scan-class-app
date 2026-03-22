// 1. ตั้งค่า API URL และตัวแปรส่วนกลาง
const API_URL = "https://script.google.com/macros/s/AKfycbxurRNi6a4opH2xthxqJ30u_ZFFoBSTY7F3DbV3x2oL8VM32TDsLveiTJxGMd3a_pjc/exec";
const TEACHER_PIN = "1234"; 

let html5QrCode;
let myChart;
let comparisonChartObj; 
let currentClassId = ''; 
let currentMode = 'attendance'; 

// รายชื่อห้องเรียน
let classList = [
    { id: 'A1', name: '1/1', level: 'ปวช' },
    { id: 'A2', name: '2/1', level: 'ปวช' },
    { id: 'A3', name: '3/1', level: 'ปวช' },
    { id: 'B1', name: '1/1', level: 'ปวส' },
    { id: 'B2', name: '2/1', level: 'ปวส' }
];

// --- ระบบเริ่มต้น (Initialization) ---

window.onload = () => {
    loadComparisonChart();
    filterLevel('ปวช'); 
    updateClassSelects(); // อัปเดตรายชื่อห้องในเมนูจัดการ (ลบห้อง)
};

// --- ฟังก์ชันหลัก (Core Functions) ---

function selectClass(classId) {
    currentClassId = classId;
    const display = document.getElementById('selected-class');
    const room = classList.find(c => c.id === classId);
    
    if (display && room) {
        display.innerText = `กำลังจัดการห้อง: ${room.level}.${room.name}`;
        display.className = "status-badge bg-primary mb-3";
    }
    
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    
    loadClassData(classId);
    loadAssignments(classId);
    loadScoreSummary();
    loadComparisonChart();
}

function filterLevel(level) {
    document.querySelectorAll('#levelTab .nav-link').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const activeBtn = level === 'ปวช' ? document.getElementById('btn-level-pvc') : document.getElementById('btn-level-pvs');
        if(activeBtn) activeBtn.classList.add('active');
    }

    const container = document.getElementById('class-buttons');
    if (!container) return;
    container.innerHTML = '';

    const filtered = classList.filter(c => c.level === level);
    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">ยังไม่มีห้องเรียนในระดับนี้</div>';
        return;
    }

    filtered.forEach(c => {
        container.innerHTML += `
            <div class="col-4 col-md-2">
                <div class="card card-btn text-center p-2 shadow-sm border-0 bg-light mb-2" 
                     style="cursor:pointer;" 
                     onclick="selectClass('${c.id}')">
                    <small class="text-primary fw-bold">${c.level}</small>
                    <div class="fw-bold">${c.name}</div>
                </div>
            </div>`;
    });
}

function switchMode(mode) {
    currentMode = mode;
    const scoreForm = document.getElementById('score-form');
    const modeTitle = document.getElementById('mode-title');
    const tabAtt = document.getElementById('tab-att');
    const tabScore = document.getElementById('tab-score');

    if (mode === 'score') {
        if(scoreForm) scoreForm.style.display = 'block';
        modeTitle.innerText = "📝 สแกนบันทึกคะแนนงาน";
        tabScore.classList.add('bg-light', 'text-primary');
        tabScore.classList.remove('text-muted');
        tabAtt.classList.add('text-muted');
        tabAtt.classList.remove('bg-light', 'text-primary');
    } else {
        if(scoreForm) scoreForm.style.display = 'none';
        modeTitle.innerText = "📷 สแกนเช็คชื่อเข้าเรียน";
        tabAtt.classList.add('bg-light', 'text-primary');
        tabAtt.classList.remove('text-muted');
        tabScore.classList.add('text-muted');
        tabScore.classList.remove('bg-light', 'text-primary');
    }
}

// --- ฟังก์ชันการจัดการ (Export / Edit / Delete) ---

// ฟังก์ชันอัปเดต List รายชื่อห้องในเมนูลบ
function updateClassSelects() {
    const deleteSelect = document.getElementById('delete-class-select');
    if (!deleteSelect) return;
    deleteSelect.innerHTML = '<option value="">-- เลือกห้องที่จะลบ --</option>';
    classList.forEach(c => {
        deleteSelect.innerHTML += `<option value="${c.id}">${c.level} ${c.name}</option>`;
    });
}

// ระบบ Export Excel แยกชีตตามห้อง
async function exportAllClassesToExcel() {
    const status = document.getElementById('status');
    const originalText = status.innerText;
    if(status) status.innerText = "⏳ กำลังรวบรวมข้อมูลทุกห้องเรียน...";
    
    const wb = XLSX.utils.book_new();
    
    for (const room of classList) {
        try {
            const response = await fetch(`${API_URL}?action=getScoreSummary&classId=${room.id}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const excelData = data.map((s, index) => ({
                    "ลำดับ": index + 1,
                    "ชื่อ-นามสกุล": s.name,
                    "เข้าเรียน (ครั้ง)": s.attendanceCount || 0,
                    "ส่งงานแล้ว": s.submittedWorks,
                    "งานทั้งหมด": s.totalWorks,
                    "คะแนนรวม": s.totalScore
                }));

                const ws = XLSX.utils.json_to_sheet(excelData);
                const sheetName = `${room.level}${room.name}`.replace("/", "-");
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }
        } catch (e) {
            console.error(`ไม่สามารถดึงข้อมูลห้อง ${room.id} ได้`, e);
        }
    }

    const fileName = `สรุปคะแนน_ทุกห้องเรียน_${new Date().toLocaleDateString('th-TH')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    if(status) {
        status.innerText = "✅ ดาวน์โหลดไฟล์เรียบร้อย!";
        setTimeout(() => status.innerText = originalText, 3000);
    }
}

async function editAssignment() {
    const id = document.getElementById('edit-assignment-select').value;
    const newTitle = document.getElementById('edit-assignment-title').value;
    if (!id || !newTitle) return alert("กรุณาเลือกใบงานและใส่ชื่อใหม่");

    if (confirm(`ยืนยันการเปลี่ยนชื่อเป็น: ${newTitle} ?`)) {
        const params = new URLSearchParams();
        params.append('action', 'editAssignment');
        params.append('id', id);
        params.append('newTitle', newTitle);
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("แก้ไขเรียบร้อย!");
        loadAssignments(currentClassId);
    }
}

async function deleteAssignment() {
    const id = document.getElementById('edit-assignment-select').value;
    if (!id) return alert("กรุณาเลือกใบงาน");

    if (confirm("ยืนยันการลบใบงานนี้?")) {
        const params = new URLSearchParams();
        params.append('action', 'deleteAssignment');
        params.append('id', id);
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("ลบใบงานสำเร็จ");
        loadAssignments(currentClassId);
    }
}

async function deleteClass() {
    const classId = document.getElementById('delete-class-select').value;
    if (!classId) return alert("กรุณาเลือกห้องที่จะลบ");

    if (confirm("🚨 ยืนยันการลบห้องเรียน? ข้อมูลการเช็คชื่อจะหายไปด้วย")) {
        const params = new URLSearchParams();
        params.append('action', 'deleteClass');
        params.append('classId', classId);
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("ลบห้องเรียนเรียบร้อย");
        location.reload(); 
    }
}

// --- ระบบรักษาความปลอดภัย ---

function unlockTeacherMode() {
    const pin = prompt("กรุณากรอกรหัสผ่านเพื่อเข้าสู่โหมดครู:");
    if (pin === TEACHER_PIN) {
        const section = document.getElementById('teacher-section');
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    } else if (pin !== null) {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
}

// --- ฟังก์ชันกล้องและการสแกน ---

async function startCamera() {
    const status = document.getElementById('status');
    if (html5QrCode && html5QrCode.isScanning) { await html5QrCode.stop(); }
    status.innerText = "กำลังเชื่อมต่อกล้อง...";
    try {
        html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        );
        status.className = "status-badge bg-success";
        status.innerText = "กล้องพร้อมใช้งาน... สแกนได้ทันที";
    } catch (err) {
        status.className = "status-badge bg-danger";
        status.innerText = "กล้องถูกบล็อก หรือหาไม่พบ";
    }
}

async function stopCamera() {
    const status = document.getElementById('status');
    if (html5QrCode) {
        await html5QrCode.stop();
        html5QrCode = null;
        status.className = "status-badge bg-secondary";
        status.innerText = "ปิดกล้องเรียบร้อยแล้ว";
    }
}

async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียนก่อนเริ่มสแกนครับ");
        return;
    }

    const status = document.getElementById('status');
    const assignmentId = document.getElementById('assignment-select').value;
    const score = document.getElementById('input-score').value;

    playBeep();

    const params = new URLSearchParams();
    if (currentMode === 'score') {
        if (!assignmentId || !score) {
            alert("กรุณาเลือกใบงานและระบุคะแนนก่อนสแกน!");
            return;
        }
        status.innerText = "กำลังบันทึกคะแนน...";
        params.append('action', 'submitWork');
        params.append('userId', decodedText);
        params.append('assignmentId', assignmentId);
        params.append('score', score);
    } else {
        status.innerText = "กำลังบันทึกการเข้าเรียน...";
        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);
    }

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "✅ บันทึกสำเร็จ: " + decodedText;
        status.className = "status-badge bg-success mb-3";
        
        if (currentMode === 'score') {
            setTimeout(() => { loadScoreSummary(); loadComparisonChart(); }, 1000);
        } else {
            setTimeout(() => loadClassData(currentClassId), 1500);
        }
    } catch (e) { 
        status.innerText = "❌ ทำรายการล้มเหลว"; 
        status.className = "status-badge bg-danger mb-3";
    }
}

// --- ฟังก์ชันจัดการข้อมูล (API) ---

async function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    const editSelect = document.getElementById('edit-assignment-select');
    try {
        const response = await fetch(`${API_URL}?action=getAssignments&classId=${classId}`);
        const list = await response.json();
        const options = list.map(item => `<option value="${item.id}">${item.title}</option>`).join('');
        const placeholder = '<option value="">-- เลือกใบงาน --</option>';
        
        if(select) select.innerHTML = placeholder + options;
        if(editSelect) editSelect.innerHTML = '<option value="">-- เลือกใบงานที่จะจัดการ --</option>' + options;
    } catch (e) { console.error("โหลดใบงานล้มเหลว"); }
}

async function loadComparisonChart() {
    try {
        const response = await fetch(`${API_URL}?action=getClassComparison`);
        const data = await response.json();
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        if (comparisonChartObj) comparisonChartObj.destroy();
        
        comparisonChartObj = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(i => i.className),
                datasets: [{
                    label: 'คะแนนเฉลี่ย',
                    data: data.map(i => i.averageScore),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    } catch (e) { console.error("โหลดกราฟเปรียบเทียบไม่สำเร็จ", e); }
}

// --- ฟังก์ชันเสริม ---

function playBeep() {
    const beep = document.getElementById('beep-sound');
    if (beep) {
        beep.currentTime = 0;
        beep.play().catch(e => console.log("Audio play blocked"));
    }
}

function clearScore() {
    const input = document.getElementById('input-score');
    const select = document.getElementById('assignment-select');
    if(input) input.value = '';
    if(select) select.selectedIndex = 0;
}
