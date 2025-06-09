document.addEventListener('DOMContentLoaded', () => {
    const openMenu = document.querySelector("#open-menu");
    const closeMenu = document.querySelector("#close-menu");
    const aside = document.querySelector("aside");

    if (!openMenu || !closeMenu || !aside) {
        console.warn('Menu buttons or aside element missing');
        return;
    }

    openMenu.addEventListener("click", () => {
        aside.classList.add("aside-visible");
        openMenu.setAttribute("aria-expanded", "true");
    });

    closeMenu.addEventListener("click", () => {
        aside.classList.remove("aside-visible");
        openMenu.setAttribute("aria-expanded", "false");
        openMenu.focus();
    });
});
