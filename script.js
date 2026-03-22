// 1. เปลี่ยน URL เป็น Web App URL ล่าสุดที่คุณครู Deploy จาก Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyR8m8eRcuVrooYK_hFH5bE76DLgCGIb6vMJO-dDRm1_JH4g9q7Rgv4HDka6GB6QDTHbA/exec";

let html5QrCode;
let myChart;
let currentClassId = ''; // ตัวแปรนี้จะเก็บ ID ห้องเรียน เช่น 1, 2, 3 หรือ 'A1'

// ฟังก์ชันเมื่อคุณครูกดเลือกห้องเรียน (เช่น ปุ่ม ป.6/1)
function selectClass(classId) {
    currentClassId = classId;
    loadClassData(classId); // โหลดข้อมูล Dashboard ของห้องนั้นมาโชว์ทันที
    
    // แสดงชื่อห้องที่เลือกบนหน้าจอ (ถ้ามี Element id="selected-class")
    const display = document.getElementById('selected-class');
    if (display) display.innerText = "กำลังจัดการห้อง: " + classId;
}

async function startCamera() {
    const status = document.getElementById('status');
    status.innerText = "กำลังเชื่อมต่อกล้อง...";
    try {
        if (html5QrCode) {
            await html5QrCode.stop();
        }
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

async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียน (ป.6/1, ม.1/2 ฯลฯ) ก่อนเริ่มสแกนครับ");
        return;
    }

    const status = document.getElementById('status');
    status.innerText = "สแกนติดแล้ว! กำลังบันทึก...";

    // เตรียมพารามิเตอร์ส่งไปบันทึกในตาราง Attendance
    const params = new URLSearchParams();
    params.append('action', 'record');
    params.append('qrData', decodedText); // ตัวนี้คือ user_id จาก QR Code (เช่น STD001)
    params.append('classId', currentClassId); // ส่ง ID ห้องเรียนที่เลือกอยู่ไปด้วย

    try {
        // ส่งข้อมูลแบบ POST (mode: no-cors เพื่อข้ามปัญหา Security ของเบราว์เซอร์)
        fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        // แจ้งเตือนสั้นๆ (Optional)
        console.log("บันทึกรหัส: " + decodedText);
        
        // หน่วงเวลา 1.5 วินาทีเพื่อให้ Google Sheets เขียนข้อมูลเสร็จ แล้วรีเฟรชตาราง
        setTimeout(() => {
            loadClassData(currentClassId);
            status.innerText = "บันทึกสำเร็จ! พร้อมคนถัดไป";
        }, 1500);

    } catch (e) {
        status.innerText = "เกิดข้อผิดพลาดในการส่งข้อมูล";
        console.error(e);
    }
}

async function loadClassData(classId) {
    currentClassId = classId;
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center">กำลังดึงข้อมูลล่าสุด...</td></tr>';

    try {
        // ดึงข้อมูล Dashboard จาก doGet ใน Code.gs
        const response = await fetch(`${API_URL}?action=getDashboard&classId=${classId}`);
        const res = await response.json();
        
        let html = '';
        if (res.attendanceList && res.attendanceList.length > 0) {
            res.attendanceList.forEach(item => {
                // เลือกสี Badge ตามสถานะ
                let badgeClass = item.status === 'present' ? 'bg-success' : (item.status === 'late' ? 'bg-warning' : 'bg-danger');
                let statusText = item.status === 'present' ? 'มาเรียน' : (item.status === 'late' ? 'สาย' : 'ขาด');

                html += `<tr>
                            <td>${item.name}</td>
                            <td>${item.time}</td>
                            <td><span class="badge ${badgeClass}">${statusText}</span></td>
                         </tr>`;
            });
        } else {
            html = '<tr><td colspan="3" class="text-center text-muted">ยังไม่มีข้อมูลการเข้าเรียนในห้องนี้</td></tr>';
        }
        tableBody.innerHTML = html;
        
        // อัปเดตกราฟวงกลม
        if (res.stats) {
            updateChart(res.stats);
        }
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">ไม่สามารถโหลดข้อมูลได้ ตรวจสอบการเชื่อมต่อ</td></tr>';
    }
}

function updateChart(stats) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    // คำนวณเปอร์เซ็นต์มาเรียน
    const total = stats.present + stats.late + stats.absent;
    const percent = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0;
    
    const percentDisplay = document.getElementById('total-percent');
    if (percentDisplay) percentDisplay.innerText = percent + "%";

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
        options: { 
            plugins: { 
                legend: { position: 'bottom' } 
            },
            cutout: '70%' // ทำเป็นวงแหวนสวยๆ
        }
    });
}
