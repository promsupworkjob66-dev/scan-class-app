const API_URL = "https://script.google.com/macros/s/AKfycbx57VxNJTYIDr-y4SCQs5eEWkxw5ifhOZZi41dh5Uc_kvaavN398Z-rmS7thaNsXZAa/exec";

let html5QrCode;
let myChart;
let currentClassId = ''; 

// 1. ฟังก์ชันเลือกห้องเรียน
function selectClass(classId) {
    currentClassId = classId;
    
    // อัปเดตข้อความบนหน้าจอ
    const display = document.getElementById('selected-class');
    if (display) {
        let className = (classId === 'A1') ? 'ปวช.1' : (classId === 'A2' ? 'ปวช.2' : 'ปวช.3');
        display.innerText = "กำลังจัดการห้อง: " + className;
        display.className = "status-badge bg-primary mb-3";
    }
    
    // เน้นปุ่มที่กด (Active State)
    document.querySelectorAll('.card-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    loadClassData(classId);
}

// 2. เปิดกล้อง
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
        status.innerText = "กล้องกำลังทำงาน... พร้อมสแกน";
    } catch (err) {
        status.className = "status-badge bg-danger";
        status.innerText = "กล้องถูกบล็อก หรือหาไม่พบ";
    }
}

// 3. ปิดกล้อง
async function stopCamera() {
    const status = document.getElementById('status');
    if (html5QrCode) {
        await html5QrCode.stop();
        html5QrCode = null;
        status.className = "status-badge bg-secondary";
        status.innerText = "ปิดกล้องเรียบร้อยแล้ว";
    }
}

// 4. เมื่อสแกนติด
async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียนก่อนเริ่มสแกนครับ");
        return;
    }
    const status = document.getElementById('status');
    status.innerText = "กำลังบันทึกข้อมูล...";

    const params = new URLSearchParams();
    params.append('action', 'record');
    params.append('qrData', decodedText);
    params.append('classId', currentClassId);

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        status.innerText = "บันทึกสำเร็จ! [" + decodedText + "]";
        setTimeout(() => {
            loadClassData(currentClassId);
            status.innerText = "พร้อมสแกนคนต่อไป";
        }, 1500);
    } catch (e) {
        console.error(e);
    }
}

// 5. โหลดข้อมูลลง Dashboard
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

// 6. อัปเดตกราฟ
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
