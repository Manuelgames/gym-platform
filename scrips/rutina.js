const headerDatos = document.querySelector('.header__datos');
const menuMobile = document.querySelector('#nav__menu');
const modalOpcionesNombre = document.querySelector('.modal__opciones--nombre');
const modalOpcionesConcluir = document.querySelector('.modal__opciones--concluir');
const headerModalOpciones = document.querySelector('.header--modal__opciones');
const modalOpciones = document.querySelector('.main--modal__opciones');
//opciones de modal del header
const modalOpcionesDieta = document.querySelector('.modal__opciones--dieta');
const modalOpcionesRutina = document.querySelector('.modal__opciones--rutina');
const modalOpcionesMediciones = document.querySelector('.modal__opciones--mediciones');
const modalOpcionesCalculadora = document.querySelector('.modal__opciones--calculadora');
const headerNombre = document.querySelector('.header--nombre');


const lunesRutina = document.querySelector('.lunes__rutina');
const martesRutina = document.querySelector('.martes__rutina');
const miercolesRutina = document.querySelector('.miercoles__rutina');
const juevesRutina = document.querySelector('.jueves__rutina');
const viernesRutina = document.querySelector('.viernes__rutina');
const sabadoRutina = document.querySelector('.sabado__rutina');
const domingoRutina = document.querySelector('.domingo__rutina');


const sesionIniciada = JSON.parse(localStorage.getItem("sesionIniciada"));

validacionSesionIniciada(sesionIniciada[0])
const body = document.querySelector('body');

headerDatos.addEventListener('click', opcionesAperturaUsuario);
menuMobile.addEventListener('click', aperturaMenu);




function validacionSesionIniciada(sesionIniciada) {
    if (sesionIniciada === 1) {
        //obtenemos los datos del usuario para activar las opciones particulares del usuario y sus funcionalidades
        usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
        usuarioNombre = JSON.parse(localStorage.getItem("nombreRegistro"));
        

        modalOpcionesNombre.style.display = 'block';
        modalOpcionesConcluir.style.display = 'block';
        modalOpcionesDieta.style.display = 'block';
        modalOpcionesMediciones.style.display = 'block';
        modalOpcionesCalculadora.style.display = 'block';
        //para no tomar el conjunto de todos los usuario y todos los registros de activos, tomamos siempre el primero que es el que esta activo, que cada que se cierra sesion de borra por completo el historial de activos
        const nombre = usuarioNombre[usuarioActivo[0]];
        headerNombre.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
        modalOpcionesNombre.textContent = `Hola ${headerNombre.textContent}`;
        headerDatos.classList.add('is-active');
    }
}


function aperturaMenu() {
    body.classList.toggle('hidden');
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}


function opcionesAperturaUsuario() {
    headerModalOpciones.classList.toggle('is-flex');
}
