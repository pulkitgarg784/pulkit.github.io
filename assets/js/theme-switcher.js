// Theme switcher functionality
document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.querySelector(".btn-toggle");
  
  function setTheme(theme) {
    if (theme === "dark-theme") {
      document.body.classList.remove("light-theme");
      document.body.classList.add("dark-theme");
      toggleButton.classList.remove("fa-sun");
      toggleButton.classList.add("fa-moon");
      toggleButton.setAttribute("title", "Switch to light mode");
      toggleButton.setAttribute("aria-label", "Switch to light mode");
    } else {
      document.body.classList.remove("dark-theme");
      document.body.classList.add("light-theme");
      toggleButton.classList.remove("fa-moon");
      toggleButton.classList.add("fa-sun");
      toggleButton.setAttribute("title", "Switch to dark mode");
      toggleButton.setAttribute("aria-label", "Switch to dark mode");
    }
    localStorage.setItem("theme", theme);
  }

  // Set initial theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Use system preference if no theme is saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme("dark-theme");
    } else {
      setTheme("light-theme");
    }
  }

  // Update theme when system preference changes (if user hasn't set a preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem("theme")) {
      setTheme(e.matches ? "dark-theme" : "light-theme");
    }
  });

  // Toggle theme when button is clicked
  toggleButton.addEventListener("click", function() {
    if (document.body.classList.contains("dark-theme")) {
      setTheme("light-theme");
    } else {
      setTheme("dark-theme");
    }
  });
});