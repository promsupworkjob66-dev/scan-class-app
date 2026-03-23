const API_URL = "https://script.google.com/macros/s/AKfycbw2o6edVGp86S0lLnDmZaw1TmXvNej0hHllqWpLhlMl0YuSVyzndb4ZqTKMqcmR2hVk/exec";

let html5QrCode;
let comparisonChart;
let currentClassId = '';
let currentMode = 'attendance';
let allClassData = []; 
let teacherPassword = localStorage.getItem('teacherPass') || '1234'; // ดึงรหัสที่บันทึกไว้ หรือใช้ 1234 เป็นค่าเริ่มต้น

// 1. ระบบปลดล็อกโหมดครู (ปรับให้ใช้รหัสที่ตั้งค่าได้)
function unlockTeacherMode() {
    const pass = prompt("กรุณากรอกรหัสผ่านผู้สอน:");
    if (pass === teacherPassword) {
        const section = document.getElementById('teacher-section');
        section.style.display = 'block'; 
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        alert("🔓 ปลดล็อกโหมดครูผู้สอนเรียบร้อย");
    } else {
        alert("❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่");
    }
}

// เพิ่มฟังก์ชัน: เปลี่ยนรหัสผ่านครู
function changePassword() {
    const newPass = prompt("ระบุรหัสผ่านใหม่:");
    if (newPass) {
        teacherPassword = newPass;
        localStorage.setItem('teacherPass', newPass);
        alert("✅ เปลี่ยนรหัสผ่านสำเร็จ ครั้งหน้าใช้รหัสใหม่นี้ได้เลยครับ");
    }
}
// 2. ฟังก์ชันคัดกรอง ปวช. / ปวส.
function filterLevel(level) {
    document.querySelectorAll('#levelTab button').forEach(btn => btn.classList.remove('active'));
    if(level === 'ปวช') {
        document.getElementById('btn-level-pvc').classList.add('active');
    } else {
        document.getElementById('btn-level-pvs').classList.add('active');
    }
    renderClassButtons(level);
}

// 3. สร้างปุ่มห้องเรียน
// 3. ฟังก์ชันสร้างปุ่มห้องเรียน (แก้ไขให้ดึงชื่อห้องที่ถูกต้อง)
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
                
                // แก้ไขจุดนี้: item.name หรือ item.id ต้องเป็นข้อความ "ปวช 1/1" ไม่ใช่ Date
                const displayName = item.name || item.id; 
                
                col.innerHTML = `<div class="card card-btn text-center p-3 shadow-sm bg-p6" 
                                onclick="selectClass('${displayName}', this)">${displayName}</div>`;
                container.appendChild(col);
            });
        });
}

// 4. ฟังก์ชันเลือกห้องเรียน (ปรับปรุงการแสดงผล UI)
function selectClass(classId, element) {
    if(!classId || classId.includes('T00:00')) {
        alert("ข้อมูลห้องเรียนไม่ถูกต้อง กรุณาลบแถวใน Google Sheets แล้วสร้างใหม่ครับ");
        return;
    }
    
    currentClassId = classId;
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    // อัปเดต UI หน้าแรก
    const mainLabel = document.getElementById('selected-class');
    if(mainLabel) {
        mainLabel.innerText = "จัดการห้อง: " + classId;
        mainLabel.className = "status-badge bg-primary shadow-sm mb-3";
    }
    
    // อัปเดต UI โหมดครู
    const settingLabel = document.getElementById('setting-class-name');
    if(settingLabel) settingLabel.innerText = classId;
    
    const teacherLabel = document.getElementById('selected-class-label');
    if(teacherLabel) teacherLabel.innerText = "ห้อง: " + classId;

    loadAssignments(classId); 
}

// 5. ระบบดึงและเลือกใบงาน (เพิ่มการเด้งของคะแนนอัตโนมัติ)
function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    if(!select) return;
    
    select.innerHTML = '<option value="">กำลังโหลดงาน...</option>';
    fetch(`${API_URL}?action=getAssignments&classId=${classId}`)
        .then(res => res.json())
        .then(data => {
            select.innerHTML = '<option value="">-- เลือกใบงาน --</option>';
            data.forEach(asgn => {
                // เก็บค่าคะแนนไว้ใน data-score เพื่อเรียกใช้ตอนเลือก
                select.innerHTML += `<option value="${asgn.id}" data-score="${asgn.points || 10}">${asgn.title}</option>`;
            });
        })
        .catch(() => {
            select.innerHTML = '<option value="">โหลดงานไม่สำเร็จ</option>';
        });
}

function onAssignmentChange() {
    const select = document.getElementById('assignment-select');
    const scoreInput = document.getElementById('input-score');
    if(!select || !scoreInput) return;

    const selectedOption = select.options[select.selectedIndex];
    const defaultScore = selectedOption.getAttribute('data-score') || '10';
    scoreInput.value = defaultScore; // คะแนนขึ้นโชว์ทันที
}

// 6. ระบบสแกนและบันทึก (เพิ่ม Pop-up และเสียง)
async function onScanSuccess(decodedText) {
    try { document.getElementById('beep-sound').play(); } catch(e){}
    
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

    status.innerText = "⏳ กำลังบันทึกข้อมูล...";
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        
        // แสดงสถานะที่หน้าจอและ Pop-up
        status.innerText = "✅ บันทึกสำเร็จ: " + decodedText;
        showToast("✅ บันทึก " + decodedText + " เรียบร้อย!");
        
        if(currentMode === 'attendance' && typeof loadClassData === "function") {
             setTimeout(() => loadClassData(currentClassId), 1000);
        }
    } catch (e) { 
        status.innerText = "❌ บันทึกล้มเหลว"; 
        showToast("❌ เกิดข้อผิดพลาด");
    }
}

// ฟังก์ชัน Pop-up แจ้งเตือน
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'scan-toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// 5. ระบบเพิ่มห้องเรียนใหม่ (ป้องกันการสร้างซ้ำและอัปเดต UI ทันที)
// แก้ไขฟังก์ชัน addNewClass (เพิ่มห้องเรียน)
async function addNewClass() {
    // ... โค้ดส่งข้อมูลเดิม ...
    try {
        const response = await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("บันทึกคำขอสร้างห้องเรียนแล้ว");
        
        // --- ส่วนที่เพิ่มใหม่เพื่อปิดหน้าต่าง ---
        document.getElementById('teacher-section').style.display = 'none'; 
        // เคลียร์ค่าในช่องกรอก
        document.getElementById('new-class-name').value = '';
        
        renderClassButtons(level); 
    } catch (e) { alert("ล้มเหลว: " + e.message); }
}

// แก้ไขฟังก์ชัน addNewAssignment (เพิ่มใบงาน)
async function addNewAssignment() {
    // ... โค้ดส่งข้อมูลเดิม ...
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        alert("✅ เพิ่มใบงานเรียบร้อยแล้ว");
        
        // --- ส่วนที่เพิ่มใหม่เพื่อปิดหน้าต่าง ---
        document.getElementById('teacher-section').style.display = 'none';
        document.getElementById('new-assignment').value = ''; 
        
    } catch (e) { alert("❌ เกิดข้อผิดพลาด"); }
}
// 6. ปุ่มเพิ่มใบงานใหม่ (สำหรับโหมดครู)
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
        document.getElementById('new-assignment').value = ''; 
        loadAssignments(currentClassId); // อัปเดตรายการใน Dropdown ทันที
    } catch (e) {
        alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
}

// 7. ดึงรายการใบงานมาโชว์ใน Dropdown (สำหรับสแกนคะแนน)
function loadAssignments(classId) {
    const select = document.getElementById('assignment-select');
    if(!select) return;
    
    select.innerHTML = '<option value="">กำลังโหลดงาน...</option>';
    fetch(`${API_URL}?action=getAssignments&classId=${classId}`)
        .then(res => res.json())
        .then(data => {
            select.innerHTML = '<option value="">-- เลือกใบงาน --</option>';
            data.forEach(asgn => {
                select.innerHTML += `<option value="${asgn.id}">${asgn.title}</option>`;
            });
        })
        .catch(() => {
            select.innerHTML = '<option value="">โหลดงานไม่สำเร็จ</option>';
        });
}

// 8. ระบบสลับโหมด เช็คชื่อ/คะแนน
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

// 9. กล้องและระบบสแกน
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

// 10. เมื่อสแกนสำเร็จ (ส่งข้อมูลลง Google Sheets)
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

    status.innerText = "⏳ กำลังบันทึกข้อมูล...";
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "✅ บันทึกสำเร็จ: " + decodedText;
        if(currentMode === 'attendance' && typeof loadClassData === "function") {
             setTimeout(() => loadClassData(currentClassId), 1000);
        }
    } catch (e) { 
        status.innerText = "❌ บันทึกล้มเหลว"; 
    }
}

// 11. ระบบกราฟและโหลดข้อมูลเริ่มต้น
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
    } catch (e) { console.error("โหลดกราฟไม่สำเร็จ"); }
}

window.onload = () => {
    filterLevel('ปวช');
    updateComparisonChart();
};

// หมายเหตุ: อย่าลืมใส่ฟังก์ชัน loadClassData และ loadScoreSummary ของเดิมต่อท้ายหากจำเป็นครับ
