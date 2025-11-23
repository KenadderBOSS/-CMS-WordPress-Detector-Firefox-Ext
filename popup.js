// Función auxiliar para crear elementos de forma segura
function createStatusElement(isPositive, text) {
  const span = document.createElement('span');
  span.className = `status ${isPositive ? 'yes' : 'no'}`;
  span.textContent = text;
  return span;
}

function createClickableStatusElement(text, url) {
  const span = document.createElement('span');
  span.className = 'status yes clickable';
  span.id = 'sitemapLink';
  span.textContent = text;
  span.style.cursor = 'pointer';
  span.addEventListener('click', () => {
    browser.tabs.create({ url: url });
  });
  return span;
}

// Obtener la pestaña activa y solicitar información
browser.tabs.query({active: true, currentWindow: true})
  .then(tabs => {
    const activeTab = tabs[0];
    
    // Esperar 1.5 segundos antes de analizar
    setTimeout(() => {
      // Enviar mensaje al content script
      browser.tabs.sendMessage(activeTab.id, {action: "detectWordPress"})
        .then(response => {
          displayResults(response);
        })
        .catch(error => {
          console.error('Error:', error);
          displayError();
        });
    }, 1500);
  });

function displayResults(info) {
  // Ocultar texto de loading
  document.getElementById('loading').style.display = 'none';
  
  // Cambiar el GIF a uno permanente
  const gifEl = document.getElementById('decorativeGif');
  
  // Si es Google Sites, ajustar el GIF y estado
  if (info.pageBuilder === "Google Sites") {
    gifEl.src = 'google-sites.gif';
    gifEl.alt = 'Google Sites detectado';
    
    const wpStatusEl = document.getElementById('wpStatus');
    wpStatusEl.textContent = ''; // Limpiar primero
    wpStatusEl.appendChild(createStatusElement(false, '✗ No (Google Sites)'));
    
    document.getElementById('builderRow').style.display = 'flex';
    document.getElementById('pageBuilder').textContent = info.pageBuilder;
    
    document.getElementById('versionRow').style.display = 'none';
    document.getElementById('phpRow').style.display = 'none';
    document.getElementById('themeRow').style.display = 'none';
    document.getElementById('cloudflareRow').style.display = 'none';
    document.getElementById('jqueryRow').style.display = 'none';
    document.getElementById('sitemapRow').style.display = 'none';
    document.getElementById('woocommerceRow').style.display = 'none';
    
    document.getElementById('results').style.display = 'block';
    return;
  }

  if (info.isWordPress) {
    gifEl.src = 'wordpress-detected.gif';
    gifEl.alt = 'WordPress detectado';
  } else {
    gifEl.src = 'no-wordpress.gif';
    gifEl.alt = 'No es WordPress';
  }

  // Mostrar resultados
  const resultsDiv = document.getElementById('results');
  resultsDiv.style.display = 'block';

  // WordPress Status
  const wpStatusEl = document.getElementById('wpStatus');
  wpStatusEl.textContent = ''; // Limpiar primero
  wpStatusEl.appendChild(createStatusElement(info.isWordPress, info.isWordPress ? '✓ Sí' : '✗ No'));

  // WordPress Version
  if (info.wpVersion) {
    document.getElementById('versionRow').style.display = 'flex';
    document.getElementById('wpVersion').textContent = info.wpVersion;
  }

  // TEMA DE WORDPRESS
  if (info.theme) {
    document.getElementById('themeRow').style.display = 'flex';
    let themeText = info.theme;
    if (info.themeVersion) {
      themeText += ' (v' + info.themeVersion + ')';
    }
    document.getElementById('themeInfo').textContent = themeText;
  }

  // Page Builder
  if (info.pageBuilder) {
    document.getElementById('builderRow').style.display = 'flex';
    document.getElementById('pageBuilder').textContent = info.pageBuilder;
  }

  // PHP Version
  if (info.phpVersion) {
    document.getElementById('phpRow').style.display = 'flex';
    document.getElementById('phpVersion').textContent = info.phpVersion;
  } else if (info.isWordPress) {
    document.getElementById('phpRow').style.display = 'flex';
    const phpEl = document.getElementById('phpVersion');
    phpEl.textContent = '';
    const span = document.createElement('span');
    span.style.opacity = '0.6';
    span.style.fontSize = '12px';
    span.textContent = 'No detectable';
    phpEl.appendChild(span);
  }

  // CLOUDFLARE
  document.getElementById('cloudflareRow').style.display = 'flex';
  const cloudflareEl = document.getElementById('cloudflareStatus');
  cloudflareEl.textContent = '';
  cloudflareEl.appendChild(createStatusElement(info.cloudflare, info.cloudflare ? '✓ Sí' : '✗ No'));

  // JQUERY
  if (info.jquery) {
    document.getElementById('jqueryRow').style.display = 'flex';
    const jqueryEl = document.getElementById('jqueryVersion');
    jqueryEl.textContent = info.jquery + ' ';
    
    const statusSpan = document.createElement('span');
    statusSpan.style.fontWeight = '600';
    
    if (info.jqueryOutdated) {
      statusSpan.style.color = '#ef4444';
      statusSpan.textContent = '⚠ Desactualizado';
    } else {
      statusSpan.style.color = '#10b981';
      statusSpan.textContent = '✓';
    }
    jqueryEl.appendChild(statusSpan);
  }

  // SITEMAP - CON ENLACE CLICKEABLE SEGURO
  document.getElementById('sitemapRow').style.display = 'flex';
  const sitemapEl = document.getElementById('sitemapStatus');
  sitemapEl.textContent = '';
  
  if (info.sitemap) {
    if (info.sitemapUrl) {
      sitemapEl.appendChild(createClickableStatusElement('✓ Ver sitemap', info.sitemapUrl));
    } else {
      sitemapEl.appendChild(createStatusElement(true, '✓ Detectado'));
    }
  } else {
    sitemapEl.appendChild(createStatusElement(false, '✗ No detectado'));
  }

  // WOOCOMMERCE
  if (info.woocommerce) {
    document.getElementById('woocommerceRow').style.display = 'flex';
    const wooEl = document.getElementById('woocommerceStatus');
    wooEl.textContent = '';
    wooEl.appendChild(createStatusElement(true, '✓ Activo'));
  }

  // PLUGINS DETECTADOS - CONSTRUIDO DE FORMA SEGURA
  if (info.plugins && info.plugins.length > 0) {
    document.getElementById('pluginsSection').style.display = 'block';
    const pluginsList = document.getElementById('pluginsList');
    pluginsList.textContent = ''; // Limpiar lista de forma segura
    
    info.plugins.forEach(plugin => {
      const pluginRow = document.createElement('div');
      pluginRow.className = 'info-row';
      
      const pluginInfo = document.createElement('div');
      pluginInfo.style.flex = '1';
      
      // Crear elemento strong para el nombre
      const pluginName = document.createElement('strong');
      pluginName.textContent = plugin.name;
      pluginInfo.appendChild(pluginName);
      
      // Añadir versión si existe
      if (plugin.version) {
        const versionSpan = document.createElement('span');
        versionSpan.style.opacity = '0.7';
        versionSpan.style.fontSize = '12px';
        versionSpan.textContent = ' v' + plugin.version;
        pluginInfo.appendChild(versionSpan);
      }
      
      // Crear botón de vulnerabilidades
      const vulnButton = document.createElement('button');
      vulnButton.className = 'vuln-button';
      vulnButton.textContent = '🔍 Vulnerabilidades';
      vulnButton.addEventListener('click', () => {
        browser.tabs.create({ 
          url: `https://patchstack.com/database?search=${encodeURIComponent(plugin.slug)}` 
        });
      });
      
      pluginRow.appendChild(pluginInfo);
      pluginRow.appendChild(vulnButton);
      pluginsList.appendChild(pluginRow);
    });
  }
}

function displayError() {
  document.getElementById('loading').style.display = 'none';
  const resultsDiv = document.getElementById('results');
  resultsDiv.textContent = ''; // Limpiar de forma segura
  
  const errorCard = document.createElement('div');
  errorCard.className = 'info-card';
  
  const errorText = document.createElement('p');
  errorText.style.textAlign = 'center';
  errorText.textContent = 'No se pudo analizar esta página. Intenta recargar el sitio.';
  
  errorCard.appendChild(errorText);
  resultsDiv.appendChild(errorCard);
  resultsDiv.style.display = 'block';
}