// เปลี่ยนเป็น URL ที่ได้จากตอน Deploy (ต้องลงท้ายด้วย /exec)
const API_URL = "https://script.google.com/macros/s/XXXXX/exec"; 

const assignmentSelect = document.getElementById("assignment");

// สร้างรายการงาน 1-20
for (let i = 1; i <= 20; i++) {
  let opt = document.createElement("option");
  opt.value = "A" + i;
  opt.textContent = "งาน " + i;
  assignmentSelect.appendChild(opt);
}

let html5QrCode; // ประกาศตัวแปรไว้ด้านนอกเพื่อเรียกใช้ข้ามฟังก์ชันได้

function startScan(type) {
  // ล้างการสแกนเก่าถ้ามีค้างอยู่
  if (html5QrCode) {
    html5QrCode.clear();
  }
  
  html5QrCode = new Html5Qrcode("reader");

  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      // ดึงค่าล่าสุดจาก Input ในขณะที่สแกนเจอ
      const assignment = document.getElementById("assignment").value;
      const score = document.getElementById("score").value;

      // แสดง Loading หรือปิดการกดปุ่มซ้ำเพื่อป้องกันข้อมูลเบิ้ล
      console.log("กำลังบันทึกข้อมูล...");

      fetch(`${API_URL}?id=${encodeURIComponent(decodedText)}&type=${type}&assignment=${assignment}&score=${score}`, {
        method: 'GET',
        mode: 'no-cors' // สำคัญ: Apps Script มักติดเรื่อง CORS
      })
      .then(() => {
        alert("✅ บันทึกสำเร็จ: " + decodedText);
        // หยุดกล้องเมื่อทำงานสำเร็จ
        html5QrCode.stop().then(() => {
          console.log("กล้องหยุดทำงานแล้ว");
        }).catch(err => console.error("หยุดกล้องไม่ได้:", err));
      })
      .catch(err => {
        alert("❌ เกิดข้อผิดพลาดในการบันทึก");
        console.error(err);
      });
    }
  ).catch(err => {
    alert("ไม่สามารถเปิดกล้องได้: " + err);
  });
}
