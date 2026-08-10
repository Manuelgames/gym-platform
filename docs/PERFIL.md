# Perfil de cuenta

Ruta: `/app/perfil`.

La pantalla divide las modificaciones en formularios y casos de uso independientes para que futuras secciones puedan añadirse sin acoplarse a las credenciales.

## Fotografía

- Admite JPEG, PNG o WebP de hasta 4 MB.
- Valida MIME, firma real del archivo, nombre y tamaño en servidor.
- Los bytes viven en `UPLOADS_DIRECTORY`; el usuario conserva solo una referencia.
- Al reemplazarla, la referencia se actualiza mediante compare-and-set y después se elimina el archivo anterior.
- Cualquier cuenta autenticada puede solicitar la fotografía vigente mediante `/api/profile/photo/{userId}`.
- El directorio profesional y las listas de asesoría usan la foto personal cuando existe.

## Nombre visible

El nombre se normaliza a espacios simples y debe tener entre 2 y 80 caracteres. Los perfiles profesionales no duplican el nombre: lo resuelven desde la cuenta, por lo que el cambio se refleja automáticamente.

## Contraseña

El cambio exige contraseña actual, nueva contraseña y confirmación. El servidor:

1. limita intentos por cuenta;
2. verifica la credencial actual con scrypt;
3. valida longitud, diferencia y confirmación;
4. genera un hash con salt nuevo;
5. actualiza mediante compare-and-set;
6. regenera la sesión actual.

La contraseña original y su confirmación nunca se persisten. La vista demo no permite cambiar la credencial descartada de su cuenta compartida.
