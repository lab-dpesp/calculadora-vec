'use strict';

var CACHE = 'calculadora-execucao-penal-674300e9e1dde37db9fcf934b9ff551326d4b13d98252a562bcc7e2fda746185';
var ARQUIVOS = [
  './',
  './index.html',
  './ferramentas.html',
  './ferramentas.css',
  './ferramentas-ui.js',
  './ferramentas-rapidas.js',
  './importar.html',
  './importacao.css',
  './importacao.js',
  './core/natureza.js',
  './core/leitura-texto.js',
  './core/leitores/versoes-documentos.js',
  './core/leitores/calculo-pena.js',
  './core/leitores/seeu-relatorio.js',
  './core/leitores/tjsp-calculo.js',
  './core/leitores/processo.js',
  './core/indulto.js',
  './core/index.js',
  './core/regras.js',
  './core/datas.js',
  './core/engine.js',
  './core/explicador.js',
  './componente/demo.html',
  './componente/calc-conferencia.js',
  './ferramentas/detracao-cautelar.html',
  './ferramentas/detracao-cautelar.js',
  './ui/integracao.js',
  './ui/textos.js',
  './ui-importacao.js',
  './radar-importacoes.js',
  './radar.html',
  './radar.js',
  './radar-ui.js',
  './radar.css',
  './piloto.js',
  './copilot.js',
  './calcpenal-copilot-v1.schema.json',
  './calcpenal-copilot-v2.schema.json',
  './vendor/pdfjs/pdf.mjs',
  './vendor/pdfjs/pdf.worker.mjs',
  './regras.js',
  './dados/eras.js',
  './dados/natureza.js',
  './dados/movimentos-execucao.js',
  './dados/fracoes-progressao.js',
  './dados/fracoes-livramento.js',
  './dados/vedacoes.js',
  './dados/decretos/2024.js',
  './dados/decretos/2025.js',
  './dados/decretos.js',
  './dados/index.js',
  './dados/modulos-provisorios.js',
  './catalogo-tipos.js',
  './projecao-ui.js',
  './docs/legislacao/catalogo-tipos-conferido.json',
  './datas.js',
  './engine.js',
  './explicador.js',
  './antecedentes.js',
  './ui.js',
  './calc.css',
  './compartilhado.css',
  './execucao.css',
  './compartilhado.js',
  './tema.js',
  './dados-casos.js',
  './privacidade-ui.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon16.png',
  './icons/icon32.png',
  './icons/icon48.png',
  './icons/icon128.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './icons/logo-dpesp.png',
  './fonts/figtree-latin-wght-normal.woff2',
  './REGRAS-DE-NEGOCIO.md',
  './modelos/index.html',
  './modelos/gerador.js',
  './modelos/exemplo.js',
  './modelos/pagina.js',
  './modelos/pedido-progressao.md',
  './modelos/pedido-livramento.md',
  './modelos/pedido-saida-temporaria.md',
  './modelos/pedido-detracao-horas.md',
  './modelos/impugnacao-calculo.md',
  './modelos/pedido-remicao.md',
  './modelos/folha-assistido.md',
  './modelos/pedido-indulto.md',
  './modelos/pedido-prescricao.md'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ARQUIVOS.map(function (arquivo) {
      return new URL(arquivo, self.registration.scope).href;
    }));
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(caches.keys().then(function (chaves) {
    return Promise.all(chaves.filter(function (chave) {
      return chave.indexOf('calculadora-execucao-penal-') === 0 && chave !== CACHE;
    }).map(function (chave) { return caches.delete(chave); }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener('fetch', function (evento) {
  var requisicao = evento.request;
  var url = new URL(requisicao.url);
  if (requisicao.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === new URL('./ensaio-replica.html', self.registration.scope).pathname) return;

  evento.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(requisicao).then(function (resposta) {
      if (resposta) return resposta;
      return fetch(requisicao).then(function (respostaRede) {
        if (!respostaRede.ok) return respostaRede;
        return cache.put(requisicao, respostaRede.clone()).then(function () { return respostaRede; });
      }).catch(function () {
        if (requisicao.mode === 'navigate') {
          return cache.match(new URL('./index.html', self.registration.scope).href);
        }
        return Response.error();
      });
    });
  }));
});
