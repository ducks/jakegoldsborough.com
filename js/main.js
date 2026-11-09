const body = document.body;
const radios = document.querySelectorAll('input[name="theme"]');

function applyTheme(theme) {
  body.className = theme;
  localStorage.setItem('theme', theme);
}

const stored = localStorage.getItem('theme') || 'dark';
applyTheme(stored);
const selected = document.querySelector(`input[value="${stored}"]`);
if (selected) selected.checked = true;

radios.forEach(radio => {
  radio.addEventListener('change', () => {
    applyTheme(radio.value);
  });
});
