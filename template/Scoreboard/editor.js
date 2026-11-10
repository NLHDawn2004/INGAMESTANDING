export function createScoreboardEditor(ranks, refreshBranding, onNameEditEnd) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".png,.jpg,.jpeg,.webp,.gif";
  picker.hidden = true;
  document.body.append(picker);
  let logoTeam;

  function sendEdit(team, changes) {
    window.parent.postMessage({ type: "ff-scoreboard-edit", team, ...changes }, location.origin);
  }

  picker.addEventListener("change", () => {
    const [file] = picker.files;
    if (file && logoTeam) sendEdit(logoTeam, { file });
    picker.value = "";
    logoTeam = undefined;
  });

  window.addEventListener("message", event => {
    if (event.source === window.parent && event.origin === location.origin
      && event.data?.type === "ff-scoreboard-branding-refresh") refreshBranding();
  });

  function makeButton(element, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scoreboard-edit-target";
    button.setAttribute("aria-label", label);
    element.replaceWith(button);
    button.append(element);
    button.addEventListener("click", onClick);
    return button;
  }

  function editName(team, label, button) {
    const previous = label.textContent;
    const input = document.createElement("input");
    input.className = "scoreboard-name-input";
    input.maxLength = 60;
    input.value = previous;
    input.setAttribute("aria-label", `Tên hiển thị của ${team}`);
    button.hidden = true;
    button.after(input);
    let finished = false;
    function finish(save, refocus = false) {
      if (finished) return;
      finished = true;
      const displayName = input.value.trim();
      input.remove();
      button.hidden = false;
      if (refocus) button.focus();
      if (save && displayName !== previous) sendEdit(team, { displayName });
      requestAnimationFrame(onNameEditEnd);
    }
    input.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        finish(event.key === "Enter", true);
      }
    });
    input.addEventListener("blur", () => finish(true));
    input.focus();
    input.select();
  }

  return () => {
    for (const row of ranks.querySelectorAll(".rank-row")) {
      if (row.dataset.editorBound) continue;
      row.dataset.editorBound = "true";
      const team = row.id;
      const image = row.querySelector(".rank-row-data-logo img");
      const label = row.querySelector(".rank-row-data-teamname span");
      makeButton(image, `Đổi logo ${team}`, () => {
        logoTeam = team;
        picker.click();
      });
      const nameButton = makeButton(label, `Sửa tên ${team}`, () => editName(team, label, nameButton));
    }
  };
}
