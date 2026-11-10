const endpoint = "/api/scoreboard-visibility/cpr";
const form = document.getElementById("scoreboard-cpr-form");
const points = document.getElementById("scoreboard-cpr-points");
const color = document.getElementById("scoreboard-cpr-color");
const button = document.getElementById("scoreboard-cpr-save");
const status = document.getElementById("scoreboard-cpr-status");
const sliders = [...form.querySelectorAll('input[type="range"]')];
const changedSliders = new Set();
let colorEdited = false;
color.addEventListener("input", () => { colorEdited = true; });

function showSliderValue(slider) {
  slider.parentElement.querySelector("output").value = slider.value + slider.dataset.unit;
}

for (const slider of sliders) {
  slider.addEventListener("input", () => {
    changedSliders.add(slider);
    showSliderValue(slider);
  });
}

function report(message, error = false) {
  status.textContent = message;
  status.toggleAttribute("data-error", error);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const threshold = points.value ? Number(points.value) : null;
  const outline = Object.fromEntries(sliders.map(slider => [slider.name, slider.valueAsNumber]));
  button.disabled = true;
  try {
    const response = await fetch(endpoint, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold, outlineColor: color.value, ...outline }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    if (!Object.keys(outline).every(name => Number.isFinite(result[name]))) {
      report("Đã lưu điểm CPR. Hãy khởi động lại TOOLFINAL để áp dụng các chỉnh sửa viền.", true);
      return;
    }
    if (result.outlineColor !== color.value || Object.entries(outline).some(([name, value]) => result[name] !== value)) {
      throw new Error("Chưa lưu được các chỉnh sửa viền CPR. Hãy thử áp dụng lại.");
    }
    report(threshold === null ? "Đã lưu kiểu viền. CPR đang tắt."
      : `Đã lưu kiểu viền cho các đội đạt từ ${threshold} điểm CPR.`);
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
  for (const slider of sliders) {
    if (!changedSliders.has(slider) && Number.isFinite(result[slider.name])) {
      slider.valueAsNumber = result[slider.name];
      showSliderValue(slider);
    }
  }
}).catch(error => report(error.message, true));
