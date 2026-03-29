const API_URL = "https://script.google.com/macros/s/AKfycbzXwy4ydsEHXbal7IqbLzxHc0OWndVS3GHzusD8UXDXrTguf1IDbfA2qYeoDfZTRfs/exec";

let html5QrCode;
let comparisonChart;
let currentClassId = '';
let currentMode = 'attendance';
let allClassData = []; 
let teacherPassword = localStorage.getItem('teacherPass') || '1234';
let isProcessing = false; // ป้องกันการสแกนซ้อน
let assignmentData = {}; // เก็บข้อมูลใบงานและคะแนนสำหรับดึงอัตโนมัติ

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
// เก็บค่าเวลาลง LocalStorage
localStorage.setItem('limitTime', document.getElementById('end-time').value);
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
col.className = 'col-4 col-md-3 mb-2';

// --- ส่วนที่ปรับเพิ่ม: แยกสีตามระดับ ---
let colorClass = level === 'ปวช' ? 'btn-pvc' : 'btn-pvs';

const displayName = item.name || item.id; 
// ป้องกันค่าวันที่หลุดมาแสดง (ถ้าลืมแก้ใน Sheets)
const finalName = String(displayName).includes('T00:00') ? "แก้ใน Sheets" : displayName;

col.innerHTML = `
<div class="card card-btn text-center p-3 shadow-sm ${colorClass}" 
onclick="selectClass('${finalName}', this)">
${finalName}
</div>`;
container.appendChild(col);
});
});
}

// แก้ไขฟังก์ชันเลือกห้องเพื่อให้แสดงในหน้าตั้งค่าด้วย
function selectClass(classId, element) {
if(!classId || String(classId).includes('T00:00')) {
alert("ข้อมูลห้องเรียนผิดพลาด กรุณาลบและสร้างใหม่ใน Sheets");
return;
}
currentClassId = classId;
document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
if(element) element.classList.add('active');

document.getElementById('selected-class').innerText = "จัดการห้อง: " + classId;
document.getElementById('selected-class').className = "status-badge bg-primary shadow-sm mb-3";

// อัปเดตในโหมดครู
document.getElementById('setting-class-display').innerText = classId;
renderWorkListInSettings(classId); // โหลดรายการงานพร้อมปุ่มลบ

loadAssignments(classId); 
loadScoreSummary();
}

// ฟังก์ชันโหลดรายการห้องในหน้าตั้งค่า
function renderClassListInSettings() {
    const list = document.getElementById('existing-classes-list');
    if(!list) return; // ป้องกัน Error ถ้าไม่มี Element นี้
    list.innerHTML = '<div class="p-2 text-center text-muted small">กำลังโหลด...</div>';

    fetch(`${API_URL}?action=getClasses`)
    .then(res => res.json())
    .then(data => {
        list.innerHTML = '';
        if(data.length === 0) list.innerHTML = '<div class="p-2 text-center text-muted">ไม่พบข้อมูลห้อง</div>';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
            div.innerHTML = `
                <span style="cursor:pointer" onclick="selectClass('${item.id}', null)">${item.id}</span>
                <i class="bi bi-trash3-fill text-danger" style="cursor:pointer" onclick="handleDeleteClass('${item.id}')"></i>
            `;
            list.appendChild(div);
        });
    });
}
function renderWorkListInSettings(classId) {
    const list = document.getElementById('existing-works-list');
    if (!list) return;
    
    list.innerHTML = '<div class="p-2 text-center text-muted small">⏳ กำลังโหลดรายการใบงาน...</div>';

    // ดึงข้อมูลใหม่จาก Server
    fetch(`${API_URL}?action=getAssignments&classId=${encodeURIComponent(classId)}`)
    .then(res => res.json())
    .then(data => {
        list.innerHTML = ''; // ล้างสถานะกำลังโหลด
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="p-2 text-center text-muted small">⚠️ ยังไม่มีใบงานในห้องนี้</div>';
            return;
        }

        data.forEach(work => {
            const div = document.createElement('div');
            div.className = 'list-group-item d-flex justify-content-between align-items-center py-1';
            // ปรับขนาดตัวอักษรให้ดูสะอาดตา (Minimalist) ตามที่แจ้งไว้
            div.innerHTML = `
                <div class="d-flex flex-column">
                    <span class="fw-bold" style="font-size: 0.9rem;">${work.title}</span>
                    <small class="text-muted" style="font-size: 0.75rem;">คะแนนเต็ม: ${work.points} ค.</small>
                </div>
                <i class="bi bi-trash3-fill text-danger" style="cursor:pointer; font-size: 1.1rem;" 
                   onclick="handleDeleteWork('${work.id}', '${work.title}')"></i>
            `;
            list.appendChild(div);
        });
    })
    .catch(err => {
        list.innerHTML = '<div class="p-2 text-center text-danger small">❌ โหลดล้มเหลว กรุณาลองใหม่</div>';
        console.error("Fetch Error:", err);
    });
}

// เพิ่มการเรียกโหลดห้องเมื่อปลดล็อกโหมดครู
function unlockTeacherMode() {
const pass = prompt("กรุณากรอกรหัสผ่านผู้สอน:");
if (pass === teacherPassword) {
renderClassListInSettings(); // โหลดรายการห้องทันที
const section = document.getElementById('teacher-section');
section.style.display = 'block';
section.scrollIntoView({ behavior: 'smooth' });
} else {
alert("❌ รหัสผ่านไม่ถูกต้อง");
}
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
    const asgnScore = document.getElementById('new-assignment-score').value || 10; // ดึงคะแนนเต็ม (ถ้าว่างให้เป็น 10)
    
    if (!currentClassId) return alert("❌ กรุณาเลือกห้องเรียนก่อนเพิ่มงาน");
    if (!asgnName) return alert("❌ กรุณากรอกชื่อใบงาน");

    const params = new URLSearchParams();
    params.append('action', 'addNewAssignment');
    params.append('classId', currentClassId); // ส่งค่า ID ห้อง (เช่น ปวช 1/1)
    params.append('assignmentName', asgnName);
    params.append('points', asgnScore);

    try {
        // บันทึกข้อมูลไปยัง Google Sheets
        // ใช้ fetch แบบ POST เพื่อความปลอดภัยและรองรับข้อมูลจำนวนมาก
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: params 
        });
        
        alert("✅ เพิ่มใบงาน: " + asgnName + " เรียบร้อยแล้ว");
        
        // ล้างช่องกรอกข้อมูลเดิม
        document.getElementById('new-assignment').value = '';
        
        // --- ส่วนสำคัญ: สั่ง Refresh ข้อมูลใหม่ทันทีโดยไม่ต้องรีโหลดหน้าเว็บ ---
        renderWorkListInSettings(currentClassId); // อัปเดตรายการในหน้าโหมดครู (ที่มีปุ่มถังขยะ)
        loadAssignments(currentClassId);          // อัปเดต Dropdown ในโหมดสแกนเนอร์
        
    } catch (e) { 
        alert("❌ เกิดข้อผิดพลาดในการบันทึก: " + e.message); 
    }
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
        beep.currentTime = 0;
        beep.play().catch(e => console.log("Audio play blocked"));
    }

    const status = document.getElementById('status');
    const params = new URLSearchParams();

    if (currentMode === 'score') {
        // ... (ส่วนบันทึกคะแนนเดิมของคุณครู) ...
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
        // --- ส่วนที่ปรับปรุงใหม่: เช็คเวลา สาย/ปกติ ---
        const now = new Date();
        const currentTimeString = now.getHours().toString().padStart(2, '0') + ":" + 
                                now.getMinutes().toString().padStart(2, '0');
        
        const limitTime = document.getElementById('end-time').value;
        let attendanceStatus = "มาเรียน";
        let speechText = "เช็คชื่อสำเร็จ"; // ข้อความเสียง

        if (limitTime && currentTimeString > limitTime) {
            attendanceStatus = "สาย";
            speechText = "มาสาย"; // เปลี่ยนเป็นมาสาย
        }
        
        // เรียกใช้ฟังก์ชันเสียงพูดที่สร้างไว้ด้านบน
        speakStatus(speechText);

        params.append('action', 'record');
        params.append('qrData', decodedText);
        params.append('classId', currentClassId);
        params.append('status', attendanceStatus); // ส่งสถานะ มาเรียน/สาย ไปที่ Sheets
        params.append('time', currentTimeString);   // ส่งเวลาที่สแกนไปด้วย
    }

    status.innerText = "⏳ กำลังบันทึก...";
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "✅ บันทึกสำเร็จ: " + decodedText;
        showToast(`✅ ${decodedText} (${params.get('status')})`);
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




// ตัวอย่างปุ่มในรายการห้องเรียน
// <span class="btn-delete" onclick="handleDeleteClass('ปวช 1/1')"><i class="fas fa-trash"></i></span>


// ปรับปรุงฟังก์ชันลบห้องเรียนให้แสดงผลทันที
async function handleDeleteClass(id) {
    if (confirm(`⚠️ ยืนยันการลบห้อง ${id}?`)) {
        const params = new URLSearchParams({ action: 'deleteClass', classId: id });
        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            alert("✅ ลบเรียบร้อย");
            renderClassListInSettings(); // อัปเดตรายการในหน้าตั้งค่า
            filterLevel(document.querySelector('#levelTab .active').innerText.includes('ปวช') ? 'ปวช' : 'ปวส');
        } catch (e) { alert("ล้มเหลว: " + e.message); }
    }
}

async function handleDeleteWork(id, name) {
    if (confirm(`คุณครูยืนยันที่จะลบใบงาน "${name}" หรือไม่?\n(ข้อมูลคะแนนที่เคยบันทึกไว้จะไม่หายไปจากระบบ)`)) {
        const params = new URLSearchParams({ 
            action: 'deleteAssignment', 
            assignmentId: id 
        });
        
        try {
            await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
            alert("✅ ลบใบงานเรียบร้อย");
            
            // สั่งโหลดรายการใหม่ทันที
            renderWorkListInSettings(currentClassId);
            loadAssignments(currentClassId);
        } catch (e) { 
            alert("ล้มเหลว: " + e.message); 
        }
    }
}

// ระบบเสียงพูด (เพิ่มเข้าไปใน onScanSuccess)
function speakStatus(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'th-TH';
        window.speechSynthesis.speak(msg);
    }
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


window.onload = () => {
    filterLevel('ปวช'); // ต้องมีบรรทัดนี้เพื่อให้ปุ่มห้องเรียนขึ้น
    
    // โหลดค่าเวลาที่เคยตั้งไว้ (ถ้ามี)
    if(localStorage.getItem('limitTime')) {
        document.getElementById('end-time').value = localStorage.getItem('limitTime');
    }
};
