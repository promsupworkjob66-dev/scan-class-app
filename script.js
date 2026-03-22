const API_URL = "https://script.google.com/macros/s/AKfycbwyNTMB-3QCddM0t9KInTcBlOXkDT8I0krXpXeQhIvlBac1U3Gl73eaUcS3ZtuQDXRg/exec";

let html5QrCode;
let myChart;
let currentClassId = '';

// ฟังก์ชันเปิดกล้อง
async function startCamera() {
    const status = document.getElementById('status');
    status.className = "status-badge bg-warning text-dark";
    status.innerText = "กำลังเชื่อมต่อกล้อง...";

    try {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
        }
        
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess
        );
        
        status.className = "status-badge bg-success";
        status.innerText = "กล้องกำลังทำงาน...";
    } catch (err) {
        status.className = "status-badge bg-danger";
        status.innerText = "กล้องถูกบล็อก";
        alert("กรุณาอนุญาตการเข้าถึงกล้องที่รูปแม่กุญแจบน URL แล้วลองใหม่อีกครั้งครับ");
    }
}

// ฟังก์ชันปิดกล้อง
function stopCamera() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            const status = document.getElementById('status');
            status.innerText = "ปิดกล้องแล้ว";
            status.className = "status-badge bg-secondary";
        });
    }
}

// ฟังก์ชันเมื่อสแกนพบ QR
async function onScanSuccess(decodedText) {
    const status = document.getElementById('status');
    status.innerText = "สแกนสำเร็จ! กำลังส่งข้อมูล...";
    status.className = "status-badge bg-warning text-dark";

    try {
        // ส่งแบบ POST ไม่ระบุ Content-Type เพื่อลดปัญหา CORS Preflight
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'record',
                qrData: decodedText,
                userId: 'STU_AUTO'
            })
        });

        alert("สแกนสำเร็จ! ข้อมูลถูกบันทึกลง Google Sheets แล้ว");
        
        if (currentClassId) {
            loadClassData(currentClassId);
        }
    } catch (e) {
        // หากเบราว์เซอร์จับ error จาก No-CORS แต่ข้อมูลไปถึงหลังบ้านจริง ก็อัปเดตตารางได้
        if (currentClassId) {
            loadClassData(currentClassId);
        }
    }
}

// ดึงข้อมูลรายชื่อและสถิติห้องเรียน
async function loadClassData(classId) {
    currentClassId = classId;
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td class="text-center">กำลังดึงข้อมูลล่าสุด...</td></tr>';

    try {
        const response = await fetch(`${API_URL}?action=getDashboard&classId=${classId}`);
        const res = await response.json();
        
        let html = '';
        if (res.attendanceList && res.attendanceList.length > 0) {
            res.attendanceList.forEach(item => {
                html += `<tr><td>${item.name}</td><td>${item.time}</td><td><span class="badge bg-success">มาเรียน</span></td></tr>`;
            });
        } else {
            html = '<tr><td class="text-center text-muted">ยังไม่มีข้อมูลเช็คชื่อวันนี้</td></tr>';
        }
        tableBody.innerHTML = html;
        
        updateChart(res.stats || { present: 0, late: 0, absent: 0 });
    } catch (e) {
        tableBody.innerHTML = '<tr><td class="text-center text-danger">ไม่พบข้อมูล หรือ ลิงก์ API ไม่ถูกต้อง</td></tr>';
    }
}

// อัปเดตกราฟ Chart.js
function updateChart(stats) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    const total = stats.present + stats.late + stats.absent;
    
    document.getElementById('total-percent').innerText = total > 0 ? Math.round((stats.present / total) * 100) + "%" : "0%";

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
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}
