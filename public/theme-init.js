// Runs before React renders to restore the saved theme and prevent flash.
(function () {
  try {
    var t = localStorage.getItem("memohub_theme") || "light";
    document.documentElement.classList.toggle("dark", t === "dark");
    var c = localStorage.getItem("memohub_compact");
    document.documentElement.classList.toggle("compact-mode", c === "true");
  } catch (e) {}
})();
