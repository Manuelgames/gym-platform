const correoIngreso = document.getElementById('correoIngreso');
const claveIngreso = document.getElementById('claveIngreso');
const submitRegistro = document.getElementById('submitRegistro');

submitRegistro.addEventListener('click', ingresoValidacion);


function ingresoValidacion (eventoClick) {
    eventoClick.preventDefault();
    console.log(validadorCuenta(correoIngreso.value, claveIngreso.value));
    correoIngreso.value = '';
    claveIngreso.value  = '';
}




function validadorCuenta (correo, clave) {
   // Parsear ambos arrays
const correos = JSON.parse(localStorage.getItem("correoRegistro"));
const claves  = JSON.parse(localStorage.getItem("claveRegistro"));
console.log(correos)

// Buscar el índice del correo
const indice = correos.indexOf(correoIngreso);
console.log(indice)
if (indice === -1) {
    return 3;
} else {
    // Con el índice verificamos la clave correspondiente
    if (claves[indice] === claveIngreso) {
        console.log("✅ Login correcto");
        return 1;
    } else {
        return 2;
    }
}
}