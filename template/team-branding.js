function connectTeamBranding(onChange) {
  let teams = {};
  let logos = [];
  let previousResponse = "";

  function apply(team, label, image) {
    const key = String(team ?? "").trim().normalize("NFC").toUpperCase();
    const brand = Object.hasOwn(teams, key) ? teams[key] : {};
    const name = brand.displayName || team;
    label.textContent = name;
    label.title = name;
    const filename = brand.logoName || logos.find(logo =>
      logo.replace(/\.[^.]+$/, "").toUpperCase() === String(name).trim().toUpperCase());
    const selected = filename && `/overlays/Scoreboard/assets/teamAvatars/${encodeURIComponent(filename)}`;
    const original = team && `./assets/teamAvatars/${encodeURIComponent(team)}.png`;
    const urls = [...new Set([
      brand.uploadedLogo,
      (brand.logoName || brand.displayName) && selected,
      original,
      selected,
      "./assets/test_logo.png",
    ].filter(Boolean))];
    if (image.dataset.brandingUrls === urls.join("|")) return;
    image.dataset.brandingUrls = urls.join("|");
    let next = 0;
    const showLogo = () => {
      if (next < urls.length) image.src = urls[next++];
    };
    image.onerror = showLogo;
    showLogo();
  }

  async function refresh() {
    try {
      const response = await fetch("/api/team-branding");
      if (!response.ok) return;
      const data = await response.text();
      if (data === previousResponse) return;
      ({ teams, logos } = JSON.parse(data));
      previousResponse = data;
      onChange(apply);
    } catch {
      // The built-in logo remains available while the server reconnects.
    }
  }

  if (location.protocol !== "file:") {
    void refresh();
    const timer = setInterval(refresh, 2000);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
  }
  apply.refresh = refresh;
  return apply;
}
