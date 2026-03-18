const API_URL = "ใส่_URL_AppsScript_ของคุณ";

const assignmentSelect = document.getElementById("assignment");

// สร้างงาน 20 งานอัตโนมัติ
for (let i = 1; i <= 20; i++) {
  let opt = document.createElement("option");
  opt.value = "A" + i;
  opt.innerText = "งาน " + i;
  assignmentSelect.appendChild(opt);
}

function startScan(type) {
  const html5QrCode = new Html5Qrcode("reader");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10 },
    (decodedText) => {

      let assignment = document.getElementById("assignment").value;
      let score = document.getElementById("score").value;

      fetch(`${API_URL}?id=${decodedText}&type=${type}&assignment=${assignment}&score=${score}`)
      .then(res => res.text())
      .then(() => {
        alert("✅ บันทึกสำเร็จ: " + decodedText);
        html5QrCode.stop();
      });

    }
  );
}
