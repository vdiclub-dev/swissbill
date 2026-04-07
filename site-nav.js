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

    /* Déconnexion → login (déclenche déconnexion Supabase + retour accueil) — pages sans config.js */
    var logoutHref = new URL('login/index.html?logout=1', window.location.href).href;
    var navAct = document.querySelector('.nav-actions .nav-desktop-btns');
    if (navAct && !document.getElementById('colixo-nav-logout')) {
        var lo = document.createElement('a');
        lo.id = 'colixo-nav-logout';
        lo.className = 'btn btn-outline';
        lo.href = logoutHref;
        lo.innerHTML = '<i class="fas fa-sign-out-alt"></i> Déconnexion';
        lo.setAttribute('title', 'Se déconnecter et retourner à l’accueil');
        navAct.appendChild(lo);
    }
    /* Mobile : lien dans le menu burger (barre du haut = Connexion + burger seulement) */
    if (!document.getElementById('colixo-nav-logout-mobile')) {
        var loM = document.createElement('a');
        loM.id = 'colixo-nav-logout-mobile';
        loM.className = 'nav-link-logout';
        loM.href = logoutHref;
        loM.innerHTML = '<i class="fas fa-sign-out-alt" aria-hidden="true"></i> Déconnexion';
        loM.setAttribute('title', 'Se déconnecter et retourner à l’accueil');
        links.appendChild(loM);
    }

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
