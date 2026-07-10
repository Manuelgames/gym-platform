const correoIngreso = document.getElementById('correoIngreso');
const claveIngreso = document.getElementById('claveIngreso');
const submitRegistro = document.getElementById('submitRegistro');
const mensajeCamposCompletados = document.querySelector('.campos--completados');
const mensajeCorreoIncorrecto = document.querySelector('.correo--incorrecto');
const mensajeClaveIncorrecta = document.querySelector('.clave--incorrecta');
submitRegistro.addEventListener('click', ingresoValidacion);


function ingresoValidacion(eventoClick) {
    eventoClick.preventDefault();
    if (correoIngreso.value != '' && claveIngreso.value != '') {
        mensajeCamposCompletados.style.display = 'none';
        mensajeCorreoIncorrecto.style.display = 'none'
        let datosIngreso = validadorCuenta();
        let posicion = 0
        let correoEncontrado = 0;
        for (correo of datosIngreso.correos) {
            if (correo === correoIngreso.value) {
                correoEncontrado = 1;
                if (correo !== null) {
                    if (claveIngreso.value === datosIngreso.claves[posicion]) {
                        console.log('datos encontrados, correo y clave');
                        break;
                    } else {
                        mensajeClaveIncorrecta.style.display = 'block'
                        console.log('clave no coincide');
                        break;
                    }
                }
            }
            posicion = posicion + 1;
        }
        if (correoEncontrado === 0) {
            mensajeCorreoIncorrecto.style.display = 'block'
        }
        //si esta registrado

        //no esta registrado
    }
    else {
        mensajeCamposCompletados.style.display = 'block';
    }

}




function validadorCuenta(correo, clave) {
    const datosIngreso = {
        correos: JSON.parse(localStorage.getItem("correoRegistro")),
        claves: JSON.parse(localStorage.getItem("claveRegistro"))
    }
    return datosIngreso
}