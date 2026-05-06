(function () {
    var html = document.documentElement;
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var STORAGE_KEY = 'colorModeOverride'; // versioned key — avoids stale values from old implementation

    function applyMode(dark) {
        html.classList.toggle('dark-mode', dark);
    }

    function isDark() {
        return html.classList.contains('dark-mode');
    }

    function syncLabels() {
        var navText = document.getElementById('theme-nav-text');
        var copyright = document.getElementById('copyright-toggle');
        var label = isDark() ? 'Light Mode' : 'Dark Mode';
        if (navText) navText.textContent = label;
        if (copyright) copyright.textContent = label + '.';
    }

    // Apply on load: manual override takes priority, otherwise follow OS
    var override = localStorage.getItem(STORAGE_KEY);
    applyMode(override === 'dark' || (override === null && mq.matches));

    // Follow OS changes when no manual override is set
    function onOSChange(e) {
        if (!localStorage.getItem(STORAGE_KEY)) {
            applyMode(e.matches);
            syncLabels();
            if (typeof window.reinitParticles === 'function') {
                window.reinitParticles();
            }
        }
    }
    if (mq.addEventListener) {
        mq.addEventListener('change', onOSChange);
    } else if (mq.addListener) {
        mq.addListener(onOSChange);
    }

    function initToggle() {
        var dot = document.getElementById('theme-nav-toggle');
        if (!dot) return;

        syncLabels();

        function toggle() {
            var dark = !isDark();
            applyMode(dark);
            // If toggled back to match OS, clear override so OS is followed again
            if (dark === mq.matches) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
            }
            syncLabels();
            if (typeof window.reinitParticles === 'function') {
                window.reinitParticles();
            }
        }

        setTimeout(function () {
            dot.classList.add('nav-dot-hint');
            setTimeout(function () {
                dot.classList.remove('nav-dot-hint');
            }, 750 + 750);
        }, 1500);

        dot.addEventListener('click', toggle);
        var copyright = document.getElementById('copyright-toggle');
        if (copyright) copyright.addEventListener('click', toggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggle);
    } else {
        initToggle();
    }
})();
