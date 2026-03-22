// 1. ตั้งค่า API URL (ใช้ URL ล่าสุดจากการ Deploy ใน Apps Script)
const API_URL = "https://script.google.com/macros/s/AKfycbx57VxNJTYIDr-y4SCQs5eEWkxw5ifhOZZi41dh5Uc_kvaavN398Z-rmS7thaNsXZAa/exec";

let html5QrCode;
let myChart;
let currentClassId = ''; 
let currentMode = 'attendance'; // โหมดเริ่มต้นคือเช็คชื่อ

// --- ฟังก์ชันหลัก (Core Functions) ---

// เลือกห้องเรียน
function selectClass(classId) {
    currentClassId = classId;
    
    // อัปเดต UI ข้อความห้องเรียน
    const display = document.getElementById('selected-class');
    if (display) {
        let className = (classId === 'A1') ? 'ปวช.1' : (classId === 'A2' ? 'ปวช.2' : 'ปวช.3');
        display.innerText = "กำลังจัดการห้อง: " + className;
        display.className = "status-badge bg-primary mb-3";
    }
    
    // เน้นปุ่มที่ถูกเลือก (Active State)
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');
    
    // โหลดข้อมูล Dashboard และรายชื่อใบงาน (เผื่อสลับไปโหมดคะแนน)
    loadClassData(classId);
    loadAssignments(classId);
}

// สลับโหมดการทำงาน (เช็คชื่อ / ให้คะแนน)
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

// --- ฟังก์ชันกล้อง (Camera Functions) ---

async function startCamera() {
    const status = document.getElementById('status');
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
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

// --- ฟังก์ชันจัดการข้อมูล (Data Handling) ---

// เมื่อสแกน QR Code สำเร็จ
async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียนก่อนเริ่มสแกนครับ");
        return;
    }

    const status = document.getElementById('status');
    const assignmentId = document.getElementById('assignment-select').value;
    const score = document.getElementById('input-score').value;

    if (currentMode === 'score') {
        // --- โหมดบันทึกคะแนน ---
        if (!assignmentId || !score) {
            alert("กรุณาเลือกใบงานและระบุคะแนนก่อนสแกนครับ!");
            return;
        }
        status.innerText = "กำลังบันทึกคะแนน...";
        const params = new URLSearchParams();
        params.append('action', 'submitWork');
        params.append('userId', decodedText);
        params.append('assignmentId', assignmentId);
        params.append('score', score);

        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            status.innerText = "✅ บันทึกคะแนนสำเร็จ: " + decodedText;
        } catch (e) { status.innerText = "❌ เกิดข้อผิดพลาดในการบันทึก"; }

    } else {
        // --- โหมดเช็คชื่อปกติ ---
        status.innerText = "กำลังบันทึกการเข้าเรียน...";
        const params = new URLSearchParams();
        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);

        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            status.innerText = "✅ เช็คชื่อสำเร็จ: " + decodedText;
            // หน่วงเวลาเล็กน้อยเพื่อให้ชีตอัปเดตแล้วโหลด Dashboard ใหม่
            setTimeout(() => loadClassData(currentClassId), 1500);
        } catch (e) { status.innerText = "❌ เช็คชื่อล้มเหลว"; }
    }
}

// ดึงรายชื่อใบงานจาก Google Sheets
async function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    try {
        const response = await fetch(`${API_URL}?action=getAssignments&classId=${classId}`);
        const list = await response.json();
        
        select.innerHTML = '<option value="">-- เลือกชิ้นงาน --</option>';
        list.forEach(item => {
            select.innerHTML += `<option value="${item.id}">${item.title}</option>`;
        });
    } catch (e) {
        console.error("โหลดใบงานล้มเหลว:", e);
    }
}

// ดึงข้อมูล Dashboard (ตาราง + กราฟ)
async function loadClassData(classId) {
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center">กำลังอัปเดต...</td></tr>';

    try {
        const response = await fetch(`${API_URL}?action=getDashboard&classId=${classId}`);
        const res = await response.json();
        
        let html = '';
        if (res.attendanceList && res.attendanceList.length > 0) {
            res.attendanceList.forEach(item => {
                let badge = item.status === 'present' ? 'bg-success' : 'bg-warning';
                let text = item.status === 'present' ? 'มาเรียน' : 'สาย';
                html += `<tr><td>${item.name}</td><td>${item.time}</td><td><span class="badge ${badge}">${text}</span></td></tr>`;
            });
        } else {
            html = '<tr><td colspan="3" class="text-center text-muted">ยังไม่มีข้อมูลวันนี้</td></tr>';
        }
        tableBody.innerHTML = html;
        updateChart(res.stats);
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">โหลดข้อมูลล้มเหลว</td></tr>';
    }
}

// อัปเดตกราฟ Doughnut
function updateChart(stats) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    const total = stats.present + stats.late + stats.absent;
    const percent = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0;
    document.getElementById('total-percent').innerText = percent + "%";

    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['มา', 'สาย', 'ขาด'],
            datasets: [{
                data: [stats.present, stats.late, stats.absent],
                backgroundColor: ['#1e40af', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '75%' }
    });
}
