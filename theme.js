// Synchronous head script: choose the palette before styles/first paint.
(() => {
    const key = '41weather.theme';
    const system = window.matchMedia?.('(prefers-color-scheme: dark)');
    let preference = null;
    try { const saved = localStorage.getItem(key); if (saved === 'dark' || saved === 'light') preference = saved; } catch { /* Optional storage. */ }
    function apply(theme) {
        document.documentElement.dataset.theme = theme;
        const button = document.getElementById('themeToggle');
        if (button) {
            document.getElementById('themeSymbol').textContent = theme === 'dark' ? '☀' : '☾';
            document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Tema chiaro' : 'Tema scuro';
            button.setAttribute('aria-label', theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro');
        }
        document.dispatchEvent(new CustomEvent('41weather:themechange'));
    }
    apply(preference ?? (system?.matches === false ? 'light' : 'dark'));
    document.addEventListener('DOMContentLoaded', () => {
        apply(document.documentElement.dataset.theme);
        document.getElementById('themeToggle').addEventListener('click', () => {
            preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(key, preference); } catch { /* Keep the in-memory choice. */ }
            apply(preference);
        });
    }, { once: true });
    system?.addEventListener('change', () => { if (!preference) apply(system.matches ? 'dark' : 'light'); });
})();
