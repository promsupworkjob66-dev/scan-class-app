// 1. ตั้งค่า API URL
const API_URL = "https://script.google.com/macros/s/AKfycbxurRNi6a4opH2xthxqJ30u_ZFFoBSTY7F3DbV3x2oL8VM32TDsLveiTJxGMd3a_pjc/exec";

let html5QrCode;
let myChart;
let currentClassId = ''; 
let currentMode = 'attendance'; // โหมดเริ่มต้น

// --- ฟังก์ชันหลัก (Core Functions) ---

function selectClass(classId) {
    currentClassId = classId;
    const display = document.getElementById('selected-class');
    if (display) {
        let className = (classId === 'A1') ? 'ปวช.1' : (classId === 'A2' ? 'ปวช.2' : 'ปวช.3');
        display.innerText = "กำลังจัดการห้อง: " + className;
        display.className = "status-badge bg-primary mb-3";
    }
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');
    
    loadClassData(classId);
    loadAssignments(classId);
}

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

// --- ฟังก์ชันกล้อง ---

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

// --- ฟังก์ชันจัดการข้อมูลและสแกน ---

async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียนก่อนเริ่มสแกนครับ");
        return;
    }

    const status = document.getElementById('status');
    const assignmentId = document.getElementById('assignment-select').value;
    const score = document.getElementById('input-score').value;

    playBeep(); // ส่งเสียงทันทีที่ตรวจพบ QR

    if (currentMode === 'score') {
        if (!assignmentId || !score) {
            alert("กรุณาเลือกใบงานและระบุคะแนนก่อนสแกน!");
            return;
        }
        status.innerText = "กำลังบันทึกคะแนน...";
        status.className = "status-badge bg-primary mb-3";
        
        const params = new URLSearchParams();
        params.append('action', 'submitWork');
        params.append('userId', decodedText);
        params.append('assignmentId', assignmentId);
        params.append('score', score);

        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            status.innerText = "✅ บันทึกคะแนนสำเร็จ: " + decodedText;
            status.className = "status-badge bg-success mb-3";
        } catch (e) { 
            status.innerText = "❌ บันทึกคะแนนล้มเหลว"; 
            status.className = "status-badge bg-danger mb-3";
        }

    } else {
        status.innerText = "กำลังบันทึกการเข้าเรียน...";
        status.className = "status-badge bg-primary mb-3";
        const params = new URLSearchParams();
        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);

        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            status.innerText = "✅ เช็คชื่อสำเร็จ: " + decodedText;
            status.className = "status-badge bg-success mb-3";
            setTimeout(() => loadClassData(currentClassId), 1500);
        } catch (e) { 
            status.innerText = "❌ เช็คชื่อล้มเหลว"; 
            status.className = "status-badge bg-danger mb-3";
        }
    }
}

// --- ระบบเสียงและล้างค่า ---

function playBeep() {
    const beep = document.getElementById('beep-sound');
    if (beep) {
        beep.currentTime = 0;
        beep.play().catch(e => console.log("Audio play blocked"));
    }
}

function clearScore() {
    document.getElementById('input-score').value = '';
    document.getElementById('assignment-select').selectedIndex = 0;
    document.getElementById('status').innerText = "ล้างข้อมูลเรียบร้อย";
    document.getElementById('status').className = "status-badge bg-secondary mb-3";
}

// --- ฟังก์ชันเสริม: ส่งออกไฟล์ Excel ---

function exportToExcel() {
    const table = document.getElementById("att-table-main"); // ID ของตาราง Dashboard
    if (!table || table.rows.length <= 1) {
        alert("ไม่มีข้อมูลให้ส่งออกครับ");
        return;
    }
    
    let html = table.outerHTML;
    let blob = new Blob([html], { type: "application/vnd.ms-excel" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = `Attendance_${currentClassId}_${new Date().toLocaleDateString()}.xls`;
    a.click();
}

// --- ฟังก์ชันดึงข้อมูลจาก Sheets ---

async function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    try {
        const response = await fetch(`${API_URL}?action=getAssignments&classId=${classId}`);
        const list = await response.json();
        select.innerHTML = '<option value="">-- เลือกชิ้นงาน --</option>';
        list.forEach(item => {
            select.innerHTML += `<option value="${item.id}">${item.title}</option>`;
        });
    } catch (e) { console.error("โหลดใบงานล้มเหลว"); }
}

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
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">โหลดล้มเหลว</td></tr>';
    }
}

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

// ฟังก์ชันบันทึกการตั้งค่าห้องเรียน
async function saveSettings() {
    const startTime = document.getElementById('start-time').value;
    const lateLimit = document.getElementById('late-limit').value;
    
    const params = new URLSearchParams();
    params.append('action', 'saveSettings');
    params.append('classId', currentClassId);
    params.append('startTime', startTime);
    params.append('lateLimit', lateLimit);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("บันทึกการตั้งค่าสำเร็จ!");
    } catch (e) { alert("ล้มเหลวในการบันทึก"); }
}

// ฟังก์ชันเพิ่มใบงานใหม่เข้าไปใน Google Sheets
async function addNewAssignment() {
    const title = document.getElementById('new-assignment').value;
    if (!title) return alert("กรุณากรอกชื่อใบงาน");

    const params = new URLSearchParams();
    params.append('action', 'addAssignment');
    params.append('classId', currentClassId);
    params.append('title', title);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        document.getElementById('new-assignment').value = '';
        alert("เพิ่มใบงานสำเร็จ!");
        loadAssignments(currentClassId); // รีโหลดรายชื่อใบงานใน Dropdown
    } catch (e) { alert("เพิ่มไม่สำเร็จ"); }
}

// ฟังก์ชันโหลดสรุปคะแนนสะสม (Dashboard)
async function loadScoreSummary() {
    if (!currentClassId) return alert("กรุณาเลือกห้องเรียนก่อนครับ");
    const tbody = document.getElementById('summary-body');
    tbody.innerHTML = '<tr><td colspan="6">กำลังประมวลผลคะแนน...</td></tr>';

    try {
        const response = await fetch(`${API_URL}?action=getScoreSummary&classId=${currentClassId}`);
        const data = await response.json();
        
        let html = '';
        data.forEach((student, index) => {
            const progress = (student.submittedWorks / student.totalWorks) * 100 || 0;
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="text-start">${student.name}</td>
                    <td><span class="badge bg-light text-dark border">${student.attendanceCount}</span></td>
                    <td>${student.submittedWorks}/${student.totalWorks}</td>
                    <td class="fw-bold text-primary">${student.totalScore}</td>
                    <td>
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar bg-success" style="width: ${progress}%"></div>
                        </div>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-danger">ไม่สามารถโหลดข้อมูลสรุปได้</td></tr>';
    }
}
