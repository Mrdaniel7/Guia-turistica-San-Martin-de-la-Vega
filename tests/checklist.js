const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const checks = [
  {
    name: 'Selector de idioma visible',
    pass: /id="selectIdioma"/.test(html) && /ajustes\.idioma/.test(html)
  },
  {
    name: 'Traducciones configuradas',
    pass: /const I18N_TEXTOS = \{/.test(html) && /nav\.inicio/.test(html)
  },
  {
    name: 'Botón de compartir presente',
    pass: /id="btnCompartir"/.test(html) && /compartirGuia/.test(html)
  },
  {
    name: 'Preferencia de voz guardada',
    pass: /id="selectVozPreferida"/.test(html) && /smv-voz-preferida/.test(html)
  },
  {
    name: 'Botón de reproducir voz',
    pass: /id="btnProbarVoz"/.test(html) && /reproducirVozPreferida/.test(html)
  },
  {
    name: 'Cerrar sesión dentro de ajustes',
    pass: /id="btnLogout"/.test(html) && html.indexOf('panelCuenta') < html.indexOf('btnLogout')
  },
  {
    name: 'Mostrar contraseña en registro',
    pass: /inputRegistroPassword/.test(html) && /toggle-password/.test(html)
  },
  {
    name: 'Traducción dinámica lista',
    pass: /TEXTOS_UI/.test(html) && /data-i18n-dynamic/.test(html) && /observadorTraducciones/.test(html)
  },
  {
    name: 'Compartir la página actual',
    pass: /compartirGuia/.test(html) && /window.location\.pathname/.test(html)
  }
];

console.table(checks.map(({ name, pass }) => ({ name, estado: pass ? 'OK' : 'FALLO' })));

const fallos = checks.filter((c) => !c.pass);
if (fallos.length) {
  console.error(`Pruebas con fallos: ${fallos.map((c) => c.name).join(', ')}`);
  process.exit(1);
}
