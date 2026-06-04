const nombreRegistro = document.getElementById('nombreRegistro');
const correoRegistro = document.getElementById('correoRegistro');
const claveRegistro = document.getElementById('claveRegistro');
const nacimientoRegistro = document.getElementById('nacimientoRegistro');
const sexoRegistro = document.getElementById('sexoRegistro');
const submitRegistro = document.getElementById('submitRegistro');




submitRegistro.addEventListener('click', envioRegistro);


function envioRegistro(eventoClick) {
    console.log('entro');
    console.log(nombreRegistro.value);
    saveInLocalStorageForm(nombreRegistro.value,correoRegistro.value, claveRegistro.value, nacimientoRegistro.value, sexoRegistro.value)
    eventoClick.preventDefault();
    nombreRegistro.value = '';
    correoRegistro.value = '';
    claveRegistro.value = '';
    nacimientoRegistro.value = '';
    sexoRegistro.value = '';
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


