// 1. ตรวจสอบ URL: ต้องเป็นอันล่าสุดที่ Deploy และลงท้ายด้วย /exec
const API_URL = "https://script.google.com/macros/s/AKfycbzvYYKyvrh_249-HYOajFJf4YmoVeJreor1RtSbvOllQrkhW8_Ika1XUER4c0MEvwWWqg/exec";

let html5QrCode;
let myChart;
let currentClassId = ''; 

// ฟังก์ชันเลือกห้องเรียน
function selectClass(classId) {
    currentClassId = classId;
    
    // อัปเดต UI ให้ครูรู้ว่าเลือกห้องไหน
    const display = document.getElementById('selected-class');
    if (display) {
        display.innerText = "กำลังจัดการห้อง: " + classId;
        display.className = "status-badge bg-primary mb-3";
    }
    
    // โหลดข้อมูล Dashboard ของห้องนั้นมาโชว์ทันที
    loadClassData(classId); 
}

// ฟังก์ชันเปิดกล้อง
async function startCamera() {
    const status = document.getElementById('status');
    
    // ถ้ามีการแสกนค้างอยู่ให้ปิดก่อน
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    
    status.innerText = "กำลังเชื่อมต่อกล้อง...";
    
    try {
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess
        );
        
        status.className = "status-badge bg-success";
        status.innerText = "กล้องกำลังทำงาน... พร้อมสแกน";
    } catch (err) {
        status.className = "status-badge bg-danger";
        status.innerText = "กล้องถูกบล็อก หรือหาไม่พบ (โปรดอนุญาตสิทธิ์)";
        console.error(err);
    }
}

// ฟังก์ชันปิดกล้อง (แก้ไขให้ทำงานได้จริง)
async function stopCamera() {
    const status = document.getElementById('status');
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode = null; // คืนค่าตัวแปร
            status.className = "status-badge bg-secondary";
            status.innerText = "ปิดกล้องเรียบร้อยแล้ว";
        } catch (err) {
            console.error("ปิดกล้องพลาด:", err);
        }
    }
}

// ฟังก์ชันเมื่อสแกนพบ QR Code
async function onScanSuccess(decodedText) {
    if (!currentClassId) {
        alert("กรุณาเลือกห้องเรียน (ป.6/1, ม.1/2 ฯลฯ) ก่อนเริ่มสแกนครับ");
        return;
    }

    const status = document.getElementById('status');
    status.innerText = "สแกนติดแล้ว! กำลังบันทึก...";

    const params = new URLSearchParams();
    params.append('action', 'record');
    params.append('qrData', decodedText); // user_id จาก QR
    params.append('classId', currentClassId);

    try {
        // ส่งข้อมูลแบบ no-cors (สำคัญมากสำหรับ GitHub -> Google Sheets)
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: params
        });

        // แจ้งเตือน (สามารถเปลี่ยนเป็นเสียง Beep ได้)
        console.log("บันทึกสำเร็จ: " + decodedText);
        
        // หน่วงเวลาเล็กน้อยเพื่อให้ Google Sheets เขียนเสร็จ แล้วโหลดข้อมูลใหม่
        setTimeout(() => {
            loadClassData(currentClassId);
            status.innerText = "บันทึก " + decodedText + " สำเร็จ! พร้อมคนถัดไป";
        }, 1500);

    } catch (e) {
        status.innerText = "เกิดข้อผิดพลาดในการส่งข้อมูล";
        console.error(e);
    }
}

// ฟังก์ชันดึงข้อมูล Dashboard
async function loadClassData(classId) {
    currentClassId = classId;
    const tableBody = document.getElementById('att-table');
    tableBody.innerHTML = '<tr><td
