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

const generarRutina = document.querySelector('.generacion__rutina');
const modalRutinaCreacion = document.querySelector('.main--modal__rutina');
const rutinaCancelarCreacion = document.querySelector('.rutina--botones__cancelar');
const rutinaConfirmarCreacion = document.querySelector('.rutina--botones__confirmar');
const grupoMuscular = document.querySelector('#grupoMuscular')
const diaEjercicioSemana = document.querySelector('#diaEjercicioSemana')
const nombreEjercicio = document.querySelector('#nombreEjercicio')
const numeroSeries = document.querySelector('#numeroSeries')
const numeroRepeticiones = document.querySelector('#numeroRepeticiones')
const descripcionEjercicio = document.querySelector('#descripcionEjercicio')


const rutinaSemana = document.querySelector('.rutina__semana');
const lunesRutina = document.querySelector('.lunes__rutina');
const martesRutina = document.querySelector('.martes__rutina');
const miercolesRutina = document.querySelector('.miercoles__rutina');
const juevesRutina = document.querySelector('.jueves__rutina');
const viernesRutina = document.querySelector('.viernes__rutina');
const sabadoRutina = document.querySelector('.sabado__rutina');
const domingoRutina = document.querySelector('.domingo__rutina');

const semanaDiaRutina = document.querySelector('.semana__dias');
const sesionIniciada = JSON.parse(localStorage.getItem("sesionIniciada"));
//obtenemos los datos del usuario para activar las opciones particulares del usuario y sus funcionalidades
const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
const usuarioNombre = JSON.parse(localStorage.getItem("nombreRegistro"));

const rutinaUsuarioStorage = JSON.parse(localStorage.getItem('rutinaUsuario') || '[]');


//estructura de la rutina de la semana
let rutinaUsuario = {
    //siempre seleccionara el usuario que haya iniciado sesion
    usuarioIdentificador: usuarioActivo[0],
    //de acuerdo al boton del dia que se seleccione mostrara el contenido de cada dia (posicion del arreglo correspondiente)
    semana: [
        lunes = [],
        martes = [],
        miercoles = [],
        jueves = [],
        viernes = [],
        sabado = [],
        domingo = []
    ]
}

validacionSesionIniciada(sesionIniciada[0])
const body = document.querySelector('body');

headerDatos.addEventListener('click', opcionesAperturaUsuario);
menuMobile.addEventListener('click', aperturaMenu);
generarRutina.addEventListener('click', activacionRutinaMenu);
rutinaCancelarCreacion.addEventListener('click', cancelarCreacionRutina);
rutinaConfirmarCreacion.addEventListener('click', confirmacionCreacionRutina);

function validacionSesionIniciada(sesionIniciada) {
    if (sesionIniciada === 1) {
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

rutinaSemana.addEventListener('click',
    (event) => {
        let dia = 0
        //de acuerdo al evento, si este contiene una clase de eliminar o editar
        if (event.target.classList.contains('lunes__rutina')) {
            dia = 0;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('martes__rutina')) {
            dia = 1;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('miercoles__rutina')) {
            dia = 2;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('jueves__rutina')) {
            dia = 3;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('viernes__rutina')) {
            dia = 4;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('sabado__rutina')) {
            dia = 5;
            busquedaRutina(dia);
        }
        if (event.target.classList.contains('domingo__rutina')) {
            dia = 6;
            busquedaRutina(dia);
        }

    });


function activacionRutinaMenu() {
    modalRutinaCreacion.classList.toggle('display-active');
}

function confirmacionCreacionRutina(evento) {
    evento.preventDefault();
    //creacion de variables de local storage para guardar en los datos del usuario 
    if (diaEjercicioSemana.value === 'lunes') {
        rutinaUsuario.semana[0].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'martes') {
        rutinaUsuario.semana[1].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'miercoles') {
        rutinaUsuario.semana[2].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'jueves') {
        rutinaUsuario.semana[3].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'viernes') {
        rutinaUsuario.semana[4].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'sabado') {
        rutinaUsuario.semana[5].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    if (diaEjercicioSemana.value === 'domingo') {
        rutinaUsuario.semana[6].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value
        });
    }
    localStorage.setItem('rutinaUsuarioStorage', JSON.stringify(rutinaUsuario));

    modalRutinaCreacion.classList.toggle('display-active');
    grupoMuscular.value = '';
    diaEjercicioSemana.value = '';
    nombreEjercicio.value = '';
    numeroSeries.value = '';
    numeroRepeticiones.value = '';
    descripcionEjercicio.value = '';
}
function cancelarCreacionRutina(evento) {
    evento.preventDefault();
    modalRutinaCreacion.classList.toggle('display-active');
}

function busquedaRutina(diaSemana) {
    if (rutinaUsuario.usuarioIdentificador !== null && rutinaUsuario.usuarioIdentificador !== undefined && rutinaUsuario.usuarioIdentificador >= 0) {
        const datos = localStorage.getItem('rutinaUsuarioStorage');
        // no hay rutinas encontradas
        const rutinaUsuarioStorage =    JSON.parse(datos);
        if (!rutinaUsuarioStorage?.semana?.[diaSemana]?.length) {
            if (!semanaDiaRutina.querySelector('.container__rutina--sindia')) {
                const con1tainerRutinaSinDia = document.createElement('div');
                containerRutinaSinDia.className = 'container__rutina--sindia';
                const diaSinRutina = document.createElement('p');
                diaSinRutina.textContent = 'Este dia no tiene rutinas'
                containerRutinaSinDia.append(diaSinRutina);
                semanaDiaRutina.append(containerRutinaSinDia);
            }
        }
        //si hay rutinas encontradas
        if (rutinaUsuarioStorage.semana[diaSemana].length > 0) {

            rutinaUsuarioStorage.semana.forEach((dia, indiceDia) => {
                if (dia.length > 0) {
                    dia.forEach((ejercicio) => {
                        console.log(`Grupo Muscular: ${ejercicio.grupoMuscular}`);
                        console.log(`Día de la semana: ${ejercicio.diaSemana}`);
                        console.log(`Ejercicio: ${ejercicio.nombreEjercicio}`);
                        console.log(`Series: ${ejercicio.numeroSeries}`);
                        console.log(`Repeticiones: ${ejercicio.numeroRepeticiones}`);
                    });
                }
            });

            // for (let dia = 0; dia < rutinaUsuarioStorage.semana[diaSemana].length; dia++) {
            //     const containerSemanaDia = document.createElement('div');
            //     containerSemanaDia.className = 'container__rutina--dia';
            //     const pGrupoMuscular = document.createElement('p');
            //     const pDiaSemana = document.createElement('p');
            //     const pNombreEjercicio = document.createElement('p');
            //     const pNumeroSeries = document.createElement('p');
            //     const pNumeroRepeticiones = document.createElement('p');
            //     const pDescripcionEjercicio = document.createElement('p');
            //     pGrupoMuscular.textContent = rutinaUsuarioStorage.semana[diaSemana, dia]

            // }

        }
    }
}


function aperturaMenu() {
    body.classList.toggle('hidden');
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}


function opcionesAperturaUsuario() {
    headerModalOpciones.classList.toggle('is-flex');
}
