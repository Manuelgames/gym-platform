const opcionesIngresoBlogMobil = document.querySelector('#nav__menu');
const opcionesIngresoBlog = document.querySelector('.opciones__ingreso');
const menuMobile = document.querySelector('#nav__menu');
const modalOpciones = document.querySelector('.main--modal__opciones');
const modalOpcioneCerrar = document.querySelector('.modal--opciones__cerrar');
const modalOpcionesNombre = document.querySelector('.modal__opciones--nombre');
const modalOpcionesIniciar = document.querySelector('.modal__opciones--iniciar');
const modalOpcionesRegistro = document.querySelector('.modal__opciones--registro');
const modalOpcionesConcluir = document.querySelector('.modal__opciones--concluir');
const sesionIniciada = JSON.parse(localStorage.getItem("sesionIniciada"));
menuMobile.addEventListener('click', aperturaMenu);
modalOpcioneCerrar.addEventListener('click', aperturaMenu);


validacionSesionIniciada(sesionIniciada[0]);
modalOpcionesConcluir.addEventListener('click',cerrarSesion);

function aperturaMenu() {
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}
function validacionSesionIniciada(sesionIniciada) {
    if (sesionIniciada === 1) {
        usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
        usuarioNombre = JSON.parse(localStorage.getItem("nombreRegistro"));
        opcionesIngresoBlog.style.display = 'none';
        modalOpcionesIniciar.style.display = 'none'
        modalOpcionesRegistro.style.display = 'none'
        modalOpcionesNombre.style.display = 'block';
        modalOpcionesConcluir.style.display = 'block';
        modalOpcionesNombre.textContent = `Hola ${usuarioNombre[usuarioActivo]}`;
    }
}


function cerrarSesion(){
    window.location.href = '/pages/ingresar.html';
}