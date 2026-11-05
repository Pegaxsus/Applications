# FlowDiagDesigner

Editor local de diagramas de flujo. Abre `index.html` directamente en un navegador moderno o usa `iniciar.cmd` en Windows. La aplicación funciona sin instalación ni conexión a Internet.

## Edición

1. Elige una forma en la paleta izquierda y haz clic en el lienzo para colocarla. Arrastra al colocarla si quieres definir su tamaño. Puedes añadir texto independiente o escribir dentro de una forma.
2. Selecciona un elemento para ajustar sus propiedades. Arrástralo para moverlo o usa el tirador de la esquina inferior derecha para redimensionarlo. Usa el tirador circular para girarlo. Mantén pulsada **Mayús** para girar en pasos de 15°.
3. Activa **Punto de conexión** y haz clic donde quieras situarlo en una forma, un texto o una imagen. Para conectar, arrastra de un punto a otro. Después, selecciona la línea para cambiar su grosor, estilo, trayectoria o flechas.
4. Usa el candado de la cabecera para proteger el lienzo. Puedes bloquear elementos y conexiones por separado en **Propiedades**.
5. Para reutilizar un formato, selecciona el origen, pulsa **Copiar formato** en la cabecera y haz clic en el destino. Se aplican las propiedades compatibles y se conservan el contenido, la posición y el tamaño del destino.

Usa la rueda sobre el lienzo para acercar o alejar alrededor del puntero. Puedes dibujar en toda la superficie visible. En **Propiedades**, puedes escribir cada valor numérico o ajustarlo con su deslizador.

## Archivos

- **Guardar** descarga un JSON editable con los elementos, las imágenes y la vista. Usa **Importar** para recuperarlo.
- **Exportar PNG** descarga el diagrama completo con el fondo del tema activo. La imagen parte de 3200 × 2000 píxeles y se ajusta si el diagrama ocupa más espacio.
- **Limpiar** vacía el lienzo. **Deshacer** recupera el contenido.

Atajos disponibles fuera de los campos de edición. **V** selecciona, **T** añade texto, **P** añade un punto, **Supr** elimina, **Esc** cancela, **Ctrl+Z** deshace y **Ctrl+Mayús+Z** o **Ctrl+Y** rehace.
