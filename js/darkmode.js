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
        var navText = document.getElementById('theme-nav-text');
        var copyright = document.getElementById('copyright-toggle');
        if (!dot) return;

        function syncLabels() {
            var label = html.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
            navText.textContent = label;
            if (copyright) copyright.textContent = label;
        }

        function toggle() {
            if (html.classList.contains('dark-mode')) {
                html.classList.remove('dark-mode');
                localStorage.setItem('colorMode', 'light');
            } else {
                html.classList.add('dark-mode');
                localStorage.setItem('colorMode', 'dark');
            }
            syncLabels();
            if (typeof window.reinitParticles === 'function') {
                window.reinitParticles();
            }
        }

        syncLabels();

        setTimeout(function () {
            dot.classList.add('nav-dot-hint');
            setTimeout(function () {
                dot.classList.remove('nav-dot-hint');
            }, 750 + 750);
        }, 1500);

        dot.addEventListener('click', toggle);
        if (copyright) copyright.addEventListener('click', toggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggle);
    } else {
        initToggle();
    }
})();
