/**
 * Receptor de la Preformulación de proyectos · Visión Circular
 *
 * Qué hace: recibe cada ficha que se envía desde preformulacion.html, la manda por correo
 * (con copia) y la agrega como una fila nueva en una hoja de Google (abre en Excel).
 * Es el Code.gs de la carpeta de la consultoría, actualizado al orden nuevo de la ficha:
 * quién la diligencia, análisis del problema, posibles soluciones, definición y alcance,
 * propósito, objetivo general, objetivos con actividades y conexiones.
 *
 * Instalación (una sola vez, con la cuenta que enviará los correos):
 * 1. Entra a script.google.com > Proyecto nuevo.
 * 2. Borra lo que haya, pega todo este código y guarda.
 * 3. Elige la función "probar" y oprime Ejecutar. Autoriza los permisos
 *    (Revisar permisos > Avanzado > Ir al proyecto). Debe llegar un correo de prueba.
 * 4. Implementar > Nueva implementación > Tipo: Aplicación web.
 *      Ejecutar como: Yo.   Quién tiene acceso: Cualquier persona.
 *    Copia la URL que termina en /exec.
 * 5. Pega esa URL en la constante RECEPTOR de preformulacion.html.
 *
 * Si cambias este código después, usa Implementar > Administrar implementaciones >
 * Editar > Nueva versión, para que la URL siga siendo la misma.
 */

var PARA = 'daniel.villa@projectability.net';
var CC = 'pahola.delgado@projectability.net';
var ASUNTO = 'Preformulación de proyecto';

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 60000) return salida({ ok: false, error: 'demasiado largo' });
    var o = limpiar(JSON.parse(raw));
    if (!o.nombre || !o.problema || !o.objetivoGeneral) return salida({ ok: false, error: 'incompleta' });

    registrar(o);          // primero la hoja: si el correo falla, la ficha no se pierde
    enviarCorreo(o);
    return salida({ ok: true });
  } catch (err) {
    return salida({ ok: false, error: 'no se pudo procesar' });
  }
}

function doGet() {
  return ContentService.createTextOutput('Receptor de preformulaciones activo.');
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function corto(s, n) {
  return String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, n);
}

function limpiar(o) {
  var r = {
    responsable: corto(o.responsable, 100), area: corto(o.area, 100),
    problema: corto(o.problema, 1500), afectados: corto(o.afectados, 800), causas: corto(o.causas, 1000), consecuencias: corto(o.consecuencias, 800),
    alternativas: (o.alternativas || []).slice(0, 5).map(function (x) { return corto(x, 300); }).filter(Boolean),
    elegida: corto(o.elegida, 300), porque: corto(o.porque, 800),
    nombre: corto(o.nombre, 150), tipo: corto(o.tipo, 40), incluye: corto(o.incluye, 800), noIncluye: corto(o.noIncluye, 800),
    proposito: corto(o.proposito, 800), objetivoGeneral: corto(o.objetivoGeneral, 500), conexiones: corto(o.conexiones, 700),
    objetivos: []
  };
  (o.objetivos || []).slice(0, 6).forEach(function (x) {
    var acts = (x.actividades || []).slice(0, 6).map(function (a) { return corto(a, 250); }).filter(Boolean);
    var t = corto(x.texto, 400);
    if (t || acts.length) r.objetivos.push({ texto: t, actividades: acts });
  });
  return r;
}

/* Las secciones de la ficha, en orden, como [título, texto] o [título, null, objetivos]. */
function secciones(o) {
  function lineas(pares) { return pares.filter(function (p) { return p[1]; }).map(function (p) { return p[0] + ': ' + p[1]; }).join('\n'); }
  var ideas = o.alternativas.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
  var escogida = lineas([['Escogida', o.elegida], ['Por qué', o.porque]]);
  return [
    ['Análisis del problema o la necesidad', lineas([['Qué está pasando', o.problema], ['A quién afecta y en qué magnitud', o.afectados], ['Por qué está pasando', o.causas], ['Qué pasa si no se atiende', o.consecuencias]])],
    ['Posibles soluciones', [ideas, escogida].filter(Boolean).join('\n\n')],
    ['Alcance del proyecto', lineas([['Incluye', o.incluye], ['No incluye', o.noIncluye]])],
    ['Propósito superior', o.proposito],
    ['Objetivo general', o.objetivoGeneral],
    ['Objetivos específicos y actividades', null, o.objetivos],
    ['Con quién se conecta', o.conexiones]
  ];
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function cuerpoHtml(o) {
  var h = '<div style="font-family:Trebuchet MS,Arial,sans-serif;color:#1E305D;max-width:680px">' +
    '<h2 style="margin:0 0 4px;color:#2C67B0">' + esc(o.nombre) + '</h2>' +
    '<p style="margin:0 0 14px;color:#5A6B85">' + esc([o.area, o.responsable, o.tipo].filter(Boolean).join(' · ')) + '</p>';
  var h4 = '<h4 style="margin:14px 0 2px;color:#006F63;text-transform:uppercase;font-size:12px;letter-spacing:.06em">';
  secciones(o).forEach(function (s) {
    if (s[2]) {
      h += h4 + s[0] + '</h4><ol style="margin:4px 0 0;padding-left:20px">';
      s[2].forEach(function (x) {
        h += '<li style="margin-bottom:8px">' + esc(x.texto) + '<ul style="margin:3px 0 0;color:#5A6B85">' +
          x.actividades.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></li>';
      });
      h += '</ol>';
    } else if (s[1]) {
      h += h4 + s[0] + '</h4><div>' + esc(s[1]) + '</div>';
    }
  });
  return h + '</div>';
}

function cuerpoTexto(o) {
  var L = [o.nombre, [o.area, o.responsable, o.tipo].filter(Boolean).join(' · ')];
  secciones(o).forEach(function (s) {
    if (s[2]) {
      L.push('', s[0].toUpperCase());
      s[2].forEach(function (x, i) {
        L.push('Objetivo ' + (i + 1) + ': ' + x.texto);
        x.actividades.forEach(function (a, j) { L.push('   ' + (i + 1) + '.' + (j + 1) + ' ' + a); });
      });
    } else if (s[1]) {
      L.push('', s[0].toUpperCase(), s[1]);
    }
  });
  return L.join('\n');
}

function enviarCorreo(o) {
  MailApp.sendEmail({
    to: PARA,
    cc: CC,
    subject: ASUNTO + ': ' + o.nombre + (o.area ? ' · ' + o.area : ''),
    body: cuerpoTexto(o),
    htmlBody: cuerpoHtml(o),
    name: 'Preformulación · Visión Circular'
  });
}

var ENCABEZADOS = ['Fecha', 'Quién diligencia', 'Línea o área', 'Qué está pasando', 'A quién afecta', 'Por qué pasa', 'Si no se atiende',
  'Posibles soluciones', 'Solución escogida', 'Por qué esa', 'Proyecto', 'Tipo', 'Incluye', 'No incluye',
  'Propósito superior', 'Objetivo general', 'Con quién se conecta'];

function hoja() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('HOJA_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Respuestas · Preformulación de proyectos · Visión Circular');
    props.setProperty('HOJA_ID', ss.getId());
    var sh = ss.getSheets()[0];
    sh.setName('Respuestas');
    var H = ENCABEZADOS.slice();
    for (var i = 1; i <= 6; i++) { H.push('Objetivo específico ' + i); H.push('Actividades del objetivo ' + i); }
    sh.appendRow(H);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, H.length).setFontWeight('bold').setBackground('#1E305D').setFontColor('#FFFFFF').setWrap(true);
  }
  return ss.getSheetByName('Respuestas') || ss.getSheets()[0];
}

function registrar(o) {
  var fila = [new Date(), o.responsable, o.area, o.problema, o.afectados, o.causas, o.consecuencias,
    o.alternativas.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'), o.elegida, o.porque,
    o.nombre, o.tipo, o.incluye, o.noIncluye, o.proposito, o.objetivoGeneral, o.conexiones];
  for (var i = 0; i < 6; i++) {
    var x = o.objetivos[i];
    fila.push(x ? x.texto : '');
    fila.push(x ? x.actividades.join('\n') : '');
  }
  var sh = hoja();
  sh.appendRow(fila);
  sh.getRange(sh.getLastRow(), 1, 1, fila.length).setWrap(true).setVerticalAlignment('top');
}

/** Ejecútala una vez a mano: manda una ficha de prueba y crea la hoja de respuestas. */
function probar() {
  var o = limpiar({
    responsable: 'Prueba', area: 'Projectability',
    problema: 'Ficha de prueba para verificar que el correo y la hoja funcionan.', causas: 'Es la primera vez que se instala.',
    alternativas: ['Probar con una ficha real', 'Probar con esta función'], elegida: 'Probar con esta función', porque: 'No molesta a nadie.',
    nombre: 'Prueba de conexión', tipo: 'Proyecto', incluye: 'Un correo y una fila.',
    proposito: 'Comprobar la conexión.', objetivoGeneral: 'Verificar el envío de fichas.',
    objetivos: [{ texto: 'Probar el correo', actividades: ['Enviar un correo de prueba'] }, { texto: 'Probar la hoja', actividades: ['Agregar una fila'] }]
  });
  registrar(o);
  enviarCorreo(o);
  Logger.log('Listo. Hoja: ' + SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID')).getUrl());
}
