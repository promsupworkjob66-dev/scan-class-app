const API_URL = "https://script.google.com/macros/s/AKfycbxrF7rPxpYYic_GOOvA9duYb-0z5aUJCdiqVNJEBU9sefoYCNKbsLcRUyRifuSeDDyj/exec";

let html5QrCode;
let comparisonChart;
let currentClassId = '';
let currentMode = 'attendance';
let allClassData = []; // เก็บรายชื่อห้องเรียนทั้งหมด

// 1. ระบบปลดล็อกโหมดครู
function unlockTeacherMode() {
    // 1. ถามรหัสผ่าน
    const pass = prompt("กรุณากรอกรหัสผ่านผู้สอน (Teacher Password):");
    
    // 2. ตรวจสอบรหัส (เปลี่ยน '1234' เป็นรหัสที่ครูนุชต้องการ)
    if (pass === "1234") {
        const section = document.getElementById('teacher-section');
        section.style.display = 'block'; // สั่งให้แสดงผล
        
        // 3. เลื่อนหน้าจอไปที่โหมดครูอัตโนมัติ
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        alert("🔓 ปลดล็อกโหมดครูผู้สอนเรียบร้อย");
    } else {
        alert("❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่");
    }
}

// 2. ฟังก์ชันคัดกรอง ปวช. / ปวส.
function filterLevel(level) {
    // อัปเดต UI ปุ่ม Tab
    document.querySelectorAll('#levelTab button').forEach(btn => btn.classList.remove('active'));
    if(level === 'ปวช') document.getElementById('btn-level-pvc').classList.add('active');
    else document.getElementById('btn-level-pvs').classList.add('active');

    renderClassButtons(level);
}

// 3. ฟังก์ชันสร้างปุ่มห้องเรียน (Generate Buttons)
function renderClassButtons(level) {
    const container = document.getElementById('class-buttons');
    container.innerHTML = '<div class="col-12 text-center text-muted small">กำลังโหลดรายการห้องเรียน...</div>';
    
    // ดึงข้อมูลห้องเรียนจาก Spreadsheet (ผ่าน API)
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
                col.innerHTML = `<div class="card card-btn text-center p-3 shadow-sm bg-p6" 
                                onclick="selectClass('${item.id}', this)">${item.name}</div>`;
                container.appendChild(col);
            });
        });
}

// 4. ฟังก์ชันเลือกห้องเรียน
function selectClass(classId, element) {
    currentClassId = classId;
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    document.getElementById('selected-class').innerText = "จัดการห้อง: " + classId;
    document.getElementById('selected-class').className = "status-badge bg-primary shadow-sm mb-3";
    document.getElementById('setting-class-name').innerText = classId;

    loadClassData(classId);
    loadAssignments(classId);
    loadScoreSummary();
}

// 5. ระบบเพิ่มห้องเรียนใหม่ (Teacher Mode)
async function addNewClass() {
    const level = document.getElementById('new-level').value;
    const name = document.getElementById('new-class-name').value;
    if(!name) return alert("กรุณาระบุเลขห้อง");

    const params = new URLSearchParams();
    params.append('action', 'addClass');
    params.append('level', level);
    params.append('name', name);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("เพิ่มห้องเรียนสำเร็จ!");
        document.getElementById('new-class-name').value = '';
        renderClassButtons(level);
    } catch (e) { alert("ล้มเหลว"); }
}

// 6. ระบบสลับโหมด เช็คชื่อ/คะแนน
function switchMode(mode) {
    currentMode = mode;
    const scoreForm = document.getElementById('score-form');
    const modeTitle = document.getElementById('mode-title');
    const tabAtt = document.getElementById('tab-att');
    const tabScore = document.getElementById('tab-score');

    if (mode === 'score') {
        scoreForm.style.display = 'block';
        modeTitle.innerText = "📝 สแกนบันทึกคะแนนงาน";
        tabScore.classList.add('bg-light', 'text-primary');
        tabScore.classList.remove('text-muted');
        tabAtt.classList.add('text-muted');
        tabAtt.classList.remove('bg-light', 'text-primary');
    } else {
        scoreForm.style.display = 'none';
        modeTitle.innerText = "📷 สแกนเช็คชื่อเข้าเรียน";
        tabAtt.classList.add('bg-light', 'text-primary');
        tabAtt.classList.remove('text-muted');
        tabScore.classList.add('text-muted');
        tabScore.classList.remove('bg-light', 'text-primary');
    }
}

// 7. กล้องและระบบสแกน
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
    document.getElementById('beep-sound').play();
    const status = document.getElementById('status');
    const params = new URLSearchParams();

    if (currentMode === 'score') {
        const asgnId = document.getElementById('assignment-select').value;
        const score = document.getElementById('input-score').value;
        if(!asgnId || !score) return alert("กรุณาเลือกงานและระบุคะแนน");
        
        params.append('action', 'submitWork');
        params.append('userId', decodedText);
        params.append('assignmentId', asgnId);
        params.append('score', score);
    } else {
        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);
    }

    status.innerText = "กำลังบันทึกข้อมูล...";
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "✅ บันทึกสำเร็จ: " + decodedText;
        if(currentMode === 'attendance') setTimeout(() => loadClassData(currentClassId), 1000);
    } catch (e) { status.innerText = "❌ บันทึกล้มเหลว"; }
}

// 8. กราฟเปรียบเทียบคะแนน (Bar Chart)
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
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 10 } }
            }
        });
    } catch (e) { console.error("กราฟผิดพลาด"); }
}

// โหลดข้อมูลเริ่มต้น
window.onload = () => {
    filterLevel('ปวช');
    updateComparisonChart();
};

// ... ฟังก์ชันเสริมอื่นๆ (loadClassData, loadAssignments, loadScoreSummary) ...
// (ให้คุณครูรวมฟังก์ชัน fetch ข้อมูลเดิมที่มีอยู่ได้เลยครับ)
