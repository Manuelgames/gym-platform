const correoIngreso = document.getElementById('correoIngreso');
const claveIngreso = document.getElementById('claveIngreso');
const submitRegistro = document.getElementById('submitRegistro');
const mensajeCamposCompletados = document.querySelector('.campos--completados');
const mensajeCorreoIncorrecto = document.querySelector('.correo--incorrecto');
const mensajeClaveIncorrecta = document.querySelector('.clave--incorrecta');

const sesionIniciada = JSON.parse(localStorage.getItem('sesionIniciada') || '[]');
const usuarioActivo = JSON.parse(localStorage.getItem('usuarioActivo') || '[]');
localStorage.setItem('sesionIniciada', '[]');
localStorage.setItem('usuarioActivo', '[]');

submitRegistro.addEventListener('click', ingresoValidacion);
localStorage.removeItem('sesisionIniciada');

function ingresoValidacion(eventoClick) {
    eventoClick.preventDefault();
    if (correoIngreso.value != '' && claveIngreso.value != '') {
        mensajeCamposCompletados.style.display = 'none';
        let datosIngreso = {
            correos: JSON.parse(localStorage.getItem("correoRegistro")),
            claves: JSON.parse(localStorage.getItem("claveRegistro"))
        }
        let posicion = 0
        let correoEncontrado = 0;
        const inputCorreo = correoIngreso.value.toLowerCase();
        console.log('inputcorreo', inputCorreo)
        for (correo of datosIngreso.correos) {
            if (correo === inputCorreo) {
                mensajeCorreoIncorrecto.style.display = 'none'
                correoEncontrado = 1;
                console.log(datosIngreso.claves[posicion]);
                if (correo !== null) {
                    if (claveIngreso.value === datosIngreso.claves[posicion]) {
                        sesionIniciada.push(1)
                        usuarioActivo.push(posicion)
                        localStorage.setItem('sesionIniciada', JSON.stringify(sesionIniciada));
                        localStorage.setItem('usuarioActivo', JSON.stringify(usuarioActivo));
                        console.log('datos encontrados, correo y clave');
                        window.location.href = 'blog.html';
                        break;
                    } else {
                        mensajeClaveIncorrecta.style.display = 'block'
                        console.log('clave no coincide');
                    }
                }
            }
            posicion = posicion + 1;
        }
        console.log(correoEncontrado);
        if (correoEncontrado === 0) {
            mensajeCorreoIncorrecto.style.display = 'block'
        }
    }
    else {
        mensajeCamposCompletados.style.display = 'block';
    }

}