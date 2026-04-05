(function () {
    'use strict';
    var nav = document.getElementById('nav');
    var burger = document.getElementById('navBurger');
    var links = document.getElementById('navLinks');
    if (!nav || !burger || !links) return;

    function closeMenu() {
        nav.classList.remove('nav-menu-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    function openMenu() {
        nav.classList.add('nav-menu-open');
        burger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function toggleMenu() {
        if (nav.classList.contains('nav-menu-open')) closeMenu();
        else openMenu();
    }

    burger.addEventListener('click', function () {
        toggleMenu();
    });

    links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', function () {
        if (window.matchMedia('(min-width: 769px)').matches) closeMenu();
    });
})();
