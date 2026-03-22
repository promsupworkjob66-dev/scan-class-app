const API_URL = "https://script.google.com/macros/s/AKfycbzvYYKyvrh_249-HYOajFJf4YmoVeJreor1RtSbvOllQrkhW8_Ika1XUER4c0MEvwWWqg/exec";

let html5QrCode;
let myChart;
let currentClassId = '';

async function startCamera() {
    const status = document.getElementById('status');
    status.innerText = "กำลังเชื่อมต่อกล้อง...";
    try {
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
        status.innerText = "กล้องถูกบล็อก";
    }
}

async function onScanSuccess(decodedText) {
    const status = document.getElementById('status');
    status.innerText = "กำลังบันทึก...";

    // ใช้พารามิเตอร์แบบ URLSearchParams เพื่อให้ Google Apps Script รับค่าได้ง่ายขึ้น
    const params = new URLSearchParams();
    params.append('action', 'record');
    params.append('qrData', decodedText);
    params.append('userId', 'STU_001'); // หรือดึงจากระบบ Login

    try {
        // ส่งข้อมูลแบบ no-cors (จะมองไม่เห็น response แต่ข้อมูลจะเข้า Sheet แน่นอน)
        fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        alert("สแกนสำเร็จ! ข้อมูลกำลังถูกบันทึก...");
        
        // หน่วงเวลา 2 วินาทีก่อนรีเฟรชหน้าจอ เพื่อให้ Google อัปเดตข้อมูลทัน
        setTimeout(() => {
            if (currentClassId) loadClassData(currentClassId);
            status.innerText = "พร้อมสแกนต่อ";
        }, 2000);

    } catch (e) {
        console.error(e);
    }
}

async function loadClassData(classId) {
    currentClassId = classId;
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td class="text-center">อัปเดตข้อมูล...</td></tr>';

    try {
        const response = await fetch(`${API_URL}?action=getDashboard&classId=${classId}`);
        const res = await response.json();
        
        let html = '';
        if (res.attendanceList && res.attendanceList.length > 0) {
            res.attendanceList.forEach(item => {
                html += `<tr><td>${item.name}</td><td>${item.time}</td><td><span class="badge bg-success">มาเรียน</span></td></tr>`;
            });
        } else {
            html = '<tr><td class="text-center text-muted">ยังไม่มีข้อมูลวันนี้</td></tr>';
        }
        tableBody.innerHTML = html;
        updateChart(res.stats);
    } catch (e) {
        console.log("Error loading data");
    }
}

function updateChart(stats) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
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
