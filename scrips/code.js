//Menu inicial
const infoDescubre = document.querySelectorAll('.main--introduccionH2');
const infoBlog = document.querySelectorAll('.main--blog');
const menuMobile = document.querySelector('#nav__menu');
const modalOpciones = document.querySelector('.main--modal__opciones');
const modalOpcioneCerrar = document.querySelector('.modal--opciones__cerrar');

menuMobile.addEventListener('click', aperturaMenu);
modalOpcioneCerrar.addEventListener('click', aperturaMenu);

function aperturaMenu() {
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}




// 1. Configuramos el vigilante (Observer)
const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        // ¿El elemento ya apareció en la pantalla?
        if (entrada.isIntersecting) {
            entrada.target.classList.add('visible'); // Activamos la animación
            observador.unobserve(entrada.target);   // Dejamos de vigilarlo para ahorrar batería
        }
    });
}, {
    threshold: 0.15 // Se activa cuando se nota el 15% del elemento
});

// 2. Le decimos qué elementos debe vigilar
infoDescubre.forEach(elemento => observador.observe(elemento));
infoBlog.forEach(elemento => observador.observe(elemento));