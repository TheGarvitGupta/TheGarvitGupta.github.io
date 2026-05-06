(function () {
    var html = document.documentElement;
    var stored = localStorage.getItem('colorMode');
    if (stored === 'light') {
        html.classList.remove('dark-mode');
    } else {
        html.classList.add('dark-mode');
    }

    function initToggle() {
        var dot = document.getElementById('theme-nav-toggle');
        var text = document.getElementById('theme-nav-text');
        if (!dot) return;

        text.textContent = html.classList.contains('dark-mode') ? 'Light' : 'Dark';

        setTimeout(function () {
            dot.classList.add('nav-dot-hint');
            setTimeout(function () {
                dot.classList.remove('nav-dot-hint');
            }, 750 + 750); // 750ms visible after 750ms fade-in
        }, 1500);

        dot.addEventListener('click', function () {
            if (html.classList.contains('dark-mode')) {
                html.classList.remove('dark-mode');
                localStorage.setItem('colorMode', 'light');
                text.textContent = 'Dark';
            } else {
                html.classList.add('dark-mode');
                localStorage.setItem('colorMode', 'dark');
                text.textContent = 'Light';
            }
            if (typeof window.reinitParticles === 'function') {
                window.reinitParticles();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggle);
    } else {
        initToggle();
    }
})();
