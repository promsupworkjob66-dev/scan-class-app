// *** สำคัญมาก: เปลี่ยนลิงก์นี้เป็น URL Web App ของคุณครู ***
const API_URL = "https://script.google.com/macros/s/AKfycbzhaCgLbPfToy3dR97HZbzgVPSm9IEdmVEwOsjryZHDCdzfwTLZNBrcwO9GZkERnrUo/exec";

let html5QrCode;
let myChart;
let currentClassId = '';

// ฟังก์ชันเปิดกล้อง
async function startCamera() {
    const status = document.getElementById('status');
    status.className = "status-badge bg-warning text-dark";
    status.innerText = "กำลังเข้าถึงกล้อง...";

    try {
        if (html5QrCode) await html5QrCode.stop();
        html5QrCode = new Html5Qrcode("reader");
        
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        );
        
        status.className = "status-badge bg-success";
        status.innerText = "กล้องกำลังทำงาน...";
    } catch (err) {
        status.className = "status-badge bg-danger";
        status.innerText = "Error: " + err;
        alert("กรุณาอนุญาตการเข้าถึงกล้อง");
    }
}

// เมื่อสแกนติด
async function onScanSuccess(decodedText) {
    document.getElementById('status').innerText = "สแกนสำเร็จ! กำลังบันทึก...";
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // สำคัญสำหรับการส่งข้อมูลข้ามโดเมนไป Google
            body: JSON.stringify({
                action: 'record',
                qrData: decodedText,
                timestamp: new Date().toISOString()
            })
        });
        
        alert("บันทึกข้อมูลเรียบร้อยแล้ว");
        if(currentClassId) loadClassData(currentClassId);
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + e);
    }
}

// โหลดข้อมูลห้องเรียนจาก Google Sheets
async function loadClassData(classId) {
    currentClassId = classId;
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td class="text-center">กำลังโหลดข้อมูล...</td></tr>';

    try {
        const response = await fetch(`${API_URL}?action=getDashboard&classId=${classId}`);
        const res = await response.json();
        
        // อัปเดตตาราง
        let html = '';
        res.attendanceList.forEach(item => {
            html += `<tr><td>${item.name}</td><td>${item.time}</td><td><span class="badge bg-success">มาเรียน</span></td></tr>`;
        });
        tableBody.innerHTML = html || '<tr><td class="text-center text-muted">ยังไม่มีข้อมูลวันนี้</td></tr>';
        
        updateChart(res.stats);
    } catch (e) {
        tableBody.innerHTML = '<tr><td class="text-center text-danger">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
}

// อัปเดตกราฟสรุปผล (Chart.js)
function updateChart(stats) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    const total = stats.present + stats.late + stats.absent;
    document.getElementById('total-percent').innerText = total > 0 ? Math.round((stats.present/total)*100) + "%" : "0%";

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

function stopCamera() {
    if(html5QrCode) html5QrCode.stop().then(() => {
        document.getElementById('status').innerText = "ปิดกล้องแล้ว";
        document.getElementById('status').className = "status-badge bg-secondary";
    });
}
