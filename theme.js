// theme.js — общая логика темы для всех страниц
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const next = (localStorage.getItem('theme') || 'dark') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
}

// мгновенно ставим тему ещё до полной загрузки (без "мигания")
document.body.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

// если тема меняется в другой открытой вкладке — подхватываем сразу, без перезагрузки
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') applyTheme(e.newValue || 'dark');
});

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('theme') || 'dark');
});