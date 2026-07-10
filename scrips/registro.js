const nombreRegistro = document.getElementById('nombreRegistro');
const correoRegistro = document.getElementById('correoRegistro');
const claveRegistro = document.getElementById('claveRegistro');
const nacimientoRegistro = document.getElementById('nacimientoRegistro');
const sexoRegistro = document.getElementById('sexoRegistro');
const submitRegistro = document.getElementById('submitRegistro');
const mensajeCorreoExistente = document.querySelector('.correo--existente');
const mensajeCamposCompletados = document.querySelector('.campos--completados')


submitRegistro.addEventListener('click', envioRegistro);

function envioRegistro(eventoClick) {
    eventoClick.preventDefault();
    //existeCorreo: si es 0 quiere decir que el correo no esta registrado, si es 1 es que ya esta registrado
    //camposCompletados: si es 0 es que los campos no se han completado

    const validaciones = loadUsers();
    console.log(validaciones)
    if (validaciones.camposCompletados == 1) {
        if (validaciones.existeCorreo == 0) {
            mensajeCorreoExistente.style.display = 'none';
            saveInLocalStorageForm(nombreRegistro.value, correoRegistro.value, claveRegistro.value, nacimientoRegistro.value, sexoRegistro.value)
            console.log('correo registrado')
            nombreRegistro.value = '';
            correoRegistro.value = '';
            claveRegistro.value = '';
            nacimientoRegistro.value = '';
            sexoRegistro.value = '';
        }
    }
    validaciones.camposCompletados = 0;
    validaciones.existeCorreo = 0
}



//funcion para guardar los datos en el localstorage del usuario registrado
function saveInLocalStorageForm(nombre, correo, clave, nacimiento, sexo) {
    const nombreRegistro = JSON.parse(localStorage.getItem('nombreRegistro') || '[]');
    const correoRegistro = JSON.parse(localStorage.getItem('correoRegistro') || '[]');
    const claveRegistro = JSON.parse(localStorage.getItem('claveRegistro') || '[]');
    const nacimientoRegistro = JSON.parse(localStorage.getItem('nacimientoRegistro') || '[]');
    const sexoRegistro = JSON.parse(localStorage.getItem('sexoRegistro') || '[]');
    nombreRegistro.push(nombre)
    correoRegistro.push(correo)
    claveRegistro.push(clave)
    nacimientoRegistro.push(nacimiento)
    sexoRegistro.push(sexo)
    localStorage.setItem('nombreRegistro', JSON.stringify(nombreRegistro));
    localStorage.setItem('correoRegistro', JSON.stringify(correoRegistro));
    localStorage.setItem('claveRegistro', JSON.stringify(claveRegistro));
    localStorage.setItem('nacimientoRegistro', JSON.stringify(nacimientoRegistro));
    localStorage.setItem('sexoRegistro', JSON.stringify(sexoRegistro));
}

function loadUsers() {
    console.log('loadusers')
    let validaciones = {
        //si es 0 quiere decir que el correo no esta registrado, si es 1 es que ya esta registrado
        existeCorreo: 0,
        //si es 0 es que los campos no se han completado
        camposCompletados: 0
    }

    const correoRegistroExistente = JSON.parse(localStorage.getItem('correoRegistro') || '[]');

    if (nombreRegistro.value != '' && correoRegistro.value != '' && claveRegistro.value != '' && nacimientoRegistro.value != '' && sexoRegistro.value != '') {
        //se completo el llenado de todos los campos
        validaciones.camposCompletados = 1;
        mensajeCamposCompletados.style.display = 'none'
        //validacion si en caso de que ya exista el correo
        const correoExistente = correoRegistroExistente.filter(function (correos) {
            return correos === correoRegistro.value;
        })
        for (correo of correoExistente) {
            if (correo) {
                mensajeCorreoExistente.style.display = 'block'
                validaciones.existeCorreo = 1;
                console.log('Este correo ya esta registrado')
                return validaciones;
            }
        }
    }
    else {
        console.log('campos no completados');
        mensajeCamposCompletados.style.display = 'block'
    }
    return validaciones;
}
