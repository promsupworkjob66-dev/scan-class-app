const API_URL = "https://script.google.com/macros/s/AKfycbyOp4j-k-u9u1ve6W7T7c11_HEAtgbYdckeYPmPgAw/dev";

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
