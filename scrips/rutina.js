const headerLogoHome = document.querySelector('.header__logo--home');
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
const cerrarSesionDesktop = document.querySelector('.opciones--concluir__desktop');

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
console.log(usuarioActivo[0]);

//se genera un identificador por usuario para que los registros sean idenpendientes y no se junten
// const storageKey = `rutinaUsuarioStorage_${usuarioActivo[0]}`;

const rutinaUsuarioStorage = JSON.parse(
    localStorage.getItem(`rutinaUsuarioStorage_${usuarioActivo[0]}`) || JSON.stringify({
        //nos permita identificar que el usuario haya iniciado sesion
        usuarioIdentificador: usuarioActivo,
        //semana donde se estaran registrando cada ejercicio para cada dia
        semana: [[], [], [], [], [], [], []]
    })
);

validacionSesionIniciada(sesionIniciada[0])
const body = document.querySelector('body');

headerDatos.addEventListener('click', opcionesAperturaUsuario);
menuMobile.addEventListener('click', aperturaMenu);
generarRutina.addEventListener('click', activacionRutinaMenu);
rutinaCancelarCreacion.addEventListener('click', cancelarCreacionRutina);
rutinaConfirmarCreacion.addEventListener('click', confirmacionCreacionRutina);
modalOpcionesConcluir.addEventListener('click', cerrarSesion);
cerrarSesionDesktop.addEventListener('click', cerrarSesion);
headerLogoHome.addEventListener('click', () => {
    if (usuarioActivo[0] !== undefined && usuarioActivo[0] !== null && usuarioActivo[0] >= 0) {
        window.location.href = 'blog.html';
    }
}
);


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
        let dia;
        const sindias = semanaDiaRutina.querySelector('.container__rutina--sindia');
        const condias = semanaDiaRutina.querySelector('.container__rutina--dia');
        sindias?.remove();
        condias?.remove();
        //de acuerdo al evento, si este contiene una clase de eliminar o editar
        if (event.target.classList.contains('lunes__rutina')) {
            busquedaRutina(0);
        }
        if (event.target.classList.contains('martes__rutina')) {
            busquedaRutina(1);
        }
        if (event.target.classList.contains('miercoles__rutina')) {
            busquedaRutina(2);
        }
        if (event.target.classList.contains('jueves__rutina')) {
            busquedaRutina(3);
        }
        if (event.target.classList.contains('viernes__rutina')) {
            busquedaRutina(4);
        }
        if (event.target.classList.contains('sabado__rutina')) {
            busquedaRutina(5);
        }
        if (event.target.classList.contains('domingo__rutina')) {
            busquedaRutina(6);
        }

    });


function activacionRutinaMenu() {
    modalRutinaCreacion.classList.toggle('display-active');
}

function confirmacionCreacionRutina(evento) {
    evento.preventDefault();
    //creacion de variables de local storage para guardar en los datos del usuario 
    if (diaEjercicioSemana.value === 'lunes') {
        rutinaUsuarioStorage.semana[0].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'martes') {
        rutinaUsuarioStorage.semana[1].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'miercoles') {
        rutinaUsuarioStorage.semana[2].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'jueves') {
        rutinaUsuarioStorage.semana[3].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'viernes') {
        rutinaUsuarioStorage.semana[4].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'sabado') {
        rutinaUsuarioStorage.semana[5].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    if (diaEjercicioSemana.value === 'domingo') {
        rutinaUsuarioStorage.semana[6].push({
            grupoMuscular: grupoMuscular.value,
            diaSemana: diaEjercicioSemana.value,
            nombreEjercicio: nombreEjercicio.value,
            numeroSeries: numeroSeries.value,
            numeroRepeticiones: numeroRepeticiones.value,
            descripcionEjercicio: descripcionEjercicio.value
        });
    }
    localStorage.setItem('rutinaUsuarioStorage', JSON.stringify(rutinaUsuarioStorage));
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
    //inicialmente se hace una limpieza de informacion en pantalla de los dias de rutina,borrando los dos contenedores con 
    //distintos mensajes (hay o no rutinas), posteriormente en la evaluacion sobre los caracteres de cada dia de la semana se condiciona si mostrara un contenedor o el otro

    //se elimina el contenedor que menciona que no hay rutinas en el dia
    const condias = semanaDiaRutina.querySelector('.container__rutina--dia');
    //pregunta si el contedor con dias existe, si existe lo elimina
    condias?.remove();
    //eliminacion de cont
    const sindias = semanaDiaRutina.querySelector('.container__rutina--sindia');
    //pregunta si el contedor sin dias existe, si existe lo elimina
    sindias?.remove();



    //variables en caso de que no haya ejercicios
    const containerRutinaSinDia = document.createElement('div');
    containerRutinaSinDia.className = 'container__rutina--sindia';
    const diaSinRutina = document.createElement('p');
    //variables en caso de que si haya ejercicios
    const containerSemanaDia = document.createElement('div');
    containerSemanaDia.className = 'container__rutina--dia';


    //revisa que el usuario haya iniciado sesion con una cuenta
    if (rutinaUsuarioStorage.usuarioIdentificador !== null && rutinaUsuarioStorage.usuarioIdentificador !== undefined && rutinaUsuarioStorage.usuarioIdentificador >= 0) {
        //se asignan a una const los datos del localstorage para convertir posteriormente a objeto rutinaUsuarioStoragerutinaUsuarioStorage
        const datos = localStorage.getItem('rutinaUsuarioStorage');
        // no hay rutinas encontradas
        const rutinaUsuarioStorage = JSON.parse(datos);
        if (!rutinaUsuarioStorage?.semana?.[diaSemana]?.length) {
            if (!semanaDiaRutina.querySelector('.container__rutina--sindia')) {
                //eliminacion del contenedor con informacion de ejercicios en caso de que anteriormente se hayan reflejado
                //se elimina el contenedor que menciona que no hay rutinas en el dia
                const condias = semanaDiaRutina.querySelector('.container__rutina--dia');
                //pregunta si el contedor con dias existe, si existe lo elimina
                condias?.remove();

                diaSinRutina.textContent = 'Este dia no tiene rutinas'
                containerRutinaSinDia.append(diaSinRutina);
                semanaDiaRutina.append(containerRutinaSinDia);
            }
        }
        //si hay rutinas encontradas
        if (rutinaUsuarioStorage?.semana?.[diaSemana]?.length > 0) {
            //eliminacion del contenedor que menciona que no hay ejercicios, en caso de que ahora si haya ejercicios
            const sindias = semanaDiaRutina.querySelector('.container__rutina--sindia');
            const condias = semanaDiaRutina.querySelector('.container__rutina--dia');
            sindias?.remove();
            condias?.remove();
            //recorre los 7 dias de la semana
            rutinaUsuarioStorage.semana.forEach((dia) => {
                //dia es igual a cada dia de la semana, por lo que se recorre 7 arreglos representando cada dia y sus ejercicios
                if (dia.length > 0) {
                    dia.forEach((ejercicio) => {
                        if (ejercicio.diaSemana === 'lunes' && diaSemana === 0) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'martes' && diaSemana === 1) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'miercoles' && diaSemana === 2) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'jueves' && diaSemana === 3) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'viernes' && diaSemana === 4) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'sabado' && diaSemana === 5) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }
                        if (ejercicio.diaSemana === 'domingo' && diaSemana === 6) {
                            listadoEjerciciosDia(ejercicio.grupoMuscular, ejercicio.diaSemana, ejercicio.nombreEjercicio, ejercicio.numeroSeries, ejercicio.numeroRepeticiones, ejercicio.descripcionEjercicio);
                        }

                    })
                }
            });
        }
    }
}

function listadoEjerciciosDia(grupoMuscular, diaSemana, nombreEjercicio, numeroSeries, numeroRepeticiones, descripcionEjercicio) {
    const containerSemanaDia = document.createElement('div');
    containerSemanaDia.className = 'container__rutina--dia';

    const containerSemanaDiaElemento = document.createElement('div');
    containerSemanaDiaElemento.className = 'container__SemanaDia--Elemento';
    const pGrupoMuscular = document.createElement('p');
    const pDiaSemana = document.createElement('p');
    const pNombreEjercicio = document.createElement('p');
    const pNumeroSeries = document.createElement('p');
    const pNumeroRepeticiones = document.createElement('p');
    const pDescripcionEjercicio = document.createElement('p');
    pGrupoMuscular.textContent = grupoMuscular;
    pDiaSemana.textContent = diaSemana;
    pNombreEjercicio.textContent = nombreEjercicio;
    pNumeroSeries.textContent = numeroSeries;
    pNumeroRepeticiones.textContent = numeroRepeticiones;
    pDescripcionEjercicio.textContent = descripcionEjercicio;
    semanaDiaRutina.append(containerSemanaDia);
    containerSemanaDiaElemento.append('Grupo Muscular: ', pGrupoMuscular);
    containerSemanaDiaElemento.append('Dia: ', pDiaSemana);
    containerSemanaDiaElemento.append('Nombre ejercicio: ', pNombreEjercicio);
    containerSemanaDiaElemento.append('Numero de series: ', pNumeroSeries);
    containerSemanaDiaElemento.append('Numero de repeticiones: ', pNumeroRepeticiones);
    containerSemanaDiaElemento.append('Descripcion del ejercicio: ', pDescripcionEjercicio);
    containerSemanaDia.append(containerSemanaDiaElemento);
}


function aperturaMenu() {
    body.classList.toggle('hidden');
    modalOpciones.classList.toggle('main--modal__opcionesActivo');
}


function opcionesAperturaUsuario() {
    headerModalOpciones.classList.toggle('is-flex');
}

function cerrarSesion() {
    window.location.href = '/index.html';
}