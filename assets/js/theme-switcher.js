const button = document.querySelector(".btn-toggle");
const icon = button.querySelector(".fa");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");

function setTheme(theme) {
  const dark = theme === "dark-theme";

  document.body.classList.toggle("dark-theme", dark);
  document.body.classList.toggle("light-theme", !dark);
  icon.classList.toggle("fa-moon", dark);
  icon.classList.toggle("fa-sun", !dark);

  const label = `Switch to ${dark ? "light" : "dark"} mode`;
  button.title = label;
  button.ariaLabel = label;
}

const savedTheme = localStorage.getItem("theme");
setTheme(savedTheme || (systemTheme.matches ? "dark-theme" : "light-theme"));

button.addEventListener("click", () => {
  const theme = document.body.classList.contains("dark-theme") ? "light-theme" : "dark-theme";
  localStorage.setItem("theme", theme);
  setTheme(theme);
});

systemTheme.addEventListener("change", event => {
  if (!localStorage.getItem("theme")) setTheme(event.matches ? "dark-theme" : "light-theme");
});
