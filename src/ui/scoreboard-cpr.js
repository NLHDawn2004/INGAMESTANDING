const endpoint = "/api/scoreboard-visibility/cpr";
const form = document.getElementById("scoreboard-cpr-form");
const points = document.getElementById("scoreboard-cpr-points");
const color = document.getElementById("scoreboard-cpr-color");
const button = document.getElementById("scoreboard-cpr-save");
const status = document.getElementById("scoreboard-cpr-status");
let colorEdited = false;
color.addEventListener("input", () => { colorEdited = true; });

function report(message, error = false) {
  status.textContent = message;
  status.toggleAttribute("data-error", error);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const threshold = points.value ? Number(points.value) : null;
  button.disabled = true;
  try {
    const response = await fetch(endpoint, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold, outlineColor: color.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    report(threshold === null ? "Đã tắt CPR." : `Đã áp dụng CPR từ ${threshold} điểm.`);
  } catch (error) {
    report(error.message || "Không lưu được CPR.", true);
  } finally {
    button.disabled = false;
  }
});

fetch(endpoint).then(async response => {
  if (!response.ok) throw new Error("Không tải được cấu hình CPR.");
  const result = await response.json();
  if (!points.value) points.value = result.threshold ?? "";
  if (!colorEdited) color.value = result.outlineColor ?? "#ffffff";
}).catch(error => report(error.message, true));
