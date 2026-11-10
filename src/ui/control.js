const key = location.hash.slice(1);
if (key && location.pathname === "/control") {
  history.replaceState(null, "", "/control");
  const status = document.getElementById("control-status");
  status.textContent = "Đang mở bảng điều khiển…";
  fetch("/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then(response => {
    if (!response.ok) throw new Error();
    location.replace("/");
  }).catch(() => {
    status.textContent = "Không mở được bảng điều khiển. Hãy dùng lại link điều khiển riêng.";
  });
}
