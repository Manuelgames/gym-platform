const opcionesIngresoBlog = document.querySelector('.opciones__ingreso');
const menuMobile = document.querySelector('#nav__menu');
const modalOpciones = document.querySelector('.main--modal__opciones');
const modalOpcioneCerrar = document.querySelector('.modal--opciones__cerrar');
const modalOpcionesNombre = document.querySelector('.modal__opciones--nombre');
const modalOpcionesDieta = document.querySelector('.modal__opciones--dieta');
const modalOpcionesRutina = document.querySelector('.modal__opciones--rutina');
const modalOpcionesMediciones = document.querySelector('.modal__opciones--mediciones');
const modalOpcionesCalculadora = document.querySelector('.modal__opciones--calculadora');

const headerDatos = document.querySelector('.header__datos');
const headerModalOpciones = document.querySelector('.header--modal__opciones');
const concluirDesktop = document.querySelector('.opciones--concluir__desktop');

const body = document.querySelector('body');

const modalOpcionesIniciar = document.querySelector('.modal__opciones--iniciar');
const modalOpcionesRegistro = document.querySelector('.modal__opciones--registro');
const modalOpcionesConcluir = document.querySelector('.modal__opciones--concluir');
const headerNombre = document.querySelector('.header--nombre');


const sesionIniciada = JSON.parse(localStorage.getItem("sesionIniciada"));
menuMobile.addEventListener('click', aperturaMenu);
modalOpcioneCerrar.addEventListener('click', aperturaMenu);

validacionSesionIniciada(sesionIniciada[0]);
modalOpcionesConcluir.addEventListener('click', cerrarSesion);
concluirDesktop.addEventListener('click', cerrarSesion);
function aperturaMenu() {
    body.classList.toggle('hidden');
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}
function opcionesAperturaUsuario(){
    headerModalOpciones.classList.toggle('is-flex');
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
        modalOpcionesDieta.style.display = 'block';
        modalOpcionesRutina.style.display = 'block';
        modalOpcionesMediciones.style.display = 'block';
        modalOpcionesCalculadora.style.display = 'block';
        const nombre = usuarioNombre[usuarioActivo];
        headerNombre.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
        modalOpcionesNombre.textContent = `Hola ${headerNombre.textContent}`;
        // En lugar de: elemento.style.display = 'block';
        headerDatos.classList.add('is-active');
    }
    else{

    }
}
headerDatos.addEventListener('click', opcionesAperturaUsuario);


function cerrarSesion() {
    window.location.href = 'ingresar.html';
}