// Este script se ejecuta en cada página y detecta la información
async function detectWordPress() {
  const info = {
    isWordPress: false,
    wpVersion: null,
    phpVersion: null,
    pageBuilder: null,
    theme: null,
    themeVersion: null,
    cloudflare: false,
    jquery: null,
    jqueryOutdated: false,
    sitemap: false,
    sitemapUrl: null,
    woocommerce: false,
    plugins: [] // Array para guardar plugins detectados con sus versiones
  };

  // Detectar WordPress
  const wpMeta = document.querySelector('meta[name="generator"][content*="WordPress"]');
  if (wpMeta) {
    info.isWordPress = true;
    const versionMatch = wpMeta.content.match(/WordPress ([\d.]+)/);
    if (versionMatch) {
      info.wpVersion = versionMatch[1];
    }
  }

  // Buscar en enlaces y scripts
  const links = document.querySelectorAll('link[href*="wp-content"], link[href*="wp-includes"]');
  const scripts = document.querySelectorAll('script[src*="wp-content"], script[src*="wp-includes"]');
  
  if (links.length > 0 || scripts.length > 0) {
    info.isWordPress = true;
  }

  // DETECTAR TEMA DE WORDPRESS Y VERSIÓN
  if (info.isWordPress) {
    const themeLinks = document.querySelectorAll('link[href*="/themes/"]');
    if (themeLinks.length > 0) {
      const themeHref = themeLinks[0].href;
      const themeMatch = themeHref.match(/\/themes\/([^\/]+)/);
      if (themeMatch) {
        info.theme = themeMatch[1];
        
        const versionMatch = themeHref.match(/[?&]ver=([\d.]+)/);
        if (versionMatch) {
          info.themeVersion = versionMatch[1];
        }
      }
    }

    const themeMeta = document.querySelector('meta[name="theme"]');
    if (themeMeta && !info.theme) {
      info.theme = themeMeta.content;
    }
  }

  // DETECTAR CLOUDFLARE
  const cfRay = document.querySelector('meta[name="cf-ray"]');
  if (cfRay) {
    info.cloudflare = true;
  }

  const cfScripts = document.querySelectorAll('script[src*="cloudflare"]');
  if (cfScripts.length > 0) {
    info.cloudflare = true;
  }

  const htmlContent = document.documentElement.outerHTML;
  if (htmlContent.includes('cloudflare') || htmlContent.includes('cf-ray')) {
    info.cloudflare = true;
  }

  // DETECTAR JQUERY Y SI ESTÁ DESACTUALIZADO
  if (typeof window.jQuery !== 'undefined') {
    info.jquery = window.jQuery.fn.jquery;
    
    const jqueryVersion = info.jquery.split('.').map(Number);
    const majorVersion = jqueryVersion[0];
    const minorVersion = jqueryVersion[1];
    
    if (majorVersion < 3 || (majorVersion === 3 && minorVersion < 5)) {
      info.jqueryOutdated = true;
    }
  }

  // DETECTAR SITEMAP - MEJORADO PARA SIEMPRE GUARDAR LA URL
  
  // Método 1: Enlaces en el HTML (formatos legacy)
  const sitemapLinksLegacy = document.querySelectorAll(
    'link[href*="sitemap"], a[href*="sitemap.xml"]'
  );
  if (sitemapLinksLegacy.length > 0 && !info.sitemap) {
    info.sitemap = true;
    info.sitemapUrl = sitemapLinksLegacy[0].href;
  }

  // Método 2: Formatos modernos de WordPress y plugins SEO
  const sitemapLinksNew = document.querySelectorAll(
    'a[href*="sitemap_index.xml"], a[href*="wp-sitemap"], link[href*="sitemap_index.xml"], link[href*="wp-sitemap"]'
  );
  if (sitemapLinksNew.length > 0 && !info.sitemap) {
    info.sitemap = true;
    info.sitemapUrl = sitemapLinksNew[0].href;
  }

  // Método 3: Meta robots (detecta pero no da URL)
  const robotsMeta = document.querySelector('meta[name="robots"]');
  if (robotsMeta && robotsMeta.content.toLowerCase().includes('sitemap') && !info.sitemap) {
    info.sitemap = true;
  }

  // Método 4: Verificar robots.txt
  if (!info.sitemapUrl) {
    try {
      const robotsResponse = await fetch(location.origin + "/robots.txt");
      if (robotsResponse.ok) {
        const robotsText = await robotsResponse.text();
        const sitemapMatch = robotsText.match(/Sitemap:\s*(.+)/i);
        if (sitemapMatch) {
          info.sitemap = true;
          info.sitemapUrl = sitemapMatch[1].trim();
        }
      }
    } catch (error) {
      console.log('No se pudo verificar robots.txt');
    }
  }

  // Método 5: Intentar acceder directamente a sitemaps comunes (SIEMPRE intentar)
  if (!info.sitemapUrl) {
    const commonSitemaps = [
      '/sitemap_index.xml',  // Primero el más común en plugins SEO
      '/sitemap.xml',
      '/wp-sitemap.xml',
      '/post-sitemap.xml',
      '/page-sitemap.xml'
    ];

    for (const sitemapPath of commonSitemaps) {
      try {
        const testUrl = location.origin + sitemapPath;
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          info.sitemap = true;
          info.sitemapUrl = testUrl;
          console.log('Sitemap encontrado en:', testUrl);
          break;
        }
      } catch (error) {
        // Continuar con el siguiente
      }
    }
  }

  // DETECTAR WOOCOMMERCE
  const wooScripts = document.querySelectorAll('script[src*="woocommerce"]');
  const wooLinks = document.querySelectorAll('link[href*="woocommerce"]');
  const wooClasses = document.querySelectorAll('[class*="woocommerce"], [class*="wc-"]');
  const wooCart = document.querySelector('.cart-contents, .shopping-cart');
  
  if (wooScripts.length > 0 || wooLinks.length > 0 || wooClasses.length > 5 || wooCart) {
    info.woocommerce = true;
    
    // Intentar obtener versión de WooCommerce
    const wooScriptWithVer = document.querySelector('script[src*="woocommerce"][src*="ver="]');
    if (wooScriptWithVer) {
      const versionMatch = wooScriptWithVer.src.match(/ver=([\d.]+)/);
      if (versionMatch) {
        info.plugins.push({
          name: 'WooCommerce',
          slug: 'woocommerce',
          version: versionMatch[1]
        });
      }
    } else {
      info.plugins.push({
        name: 'WooCommerce',
        slug: 'woocommerce',
        version: null
      });
    }
  }

  // ========================================================================
  // DETECCIÓN DE PLUGINS POPULARES
  // ========================================================================
  
  // Lista de plugins para detectar: { slug, name, identifiers }
  const pluginsToDetect = [
    // SEO
    { slug: 'wordpress-seo', name: 'Yoast SEO', identifiers: ['yoast'], metaGenerator: 'Yoast' },
    { slug: 'seo-by-rank-math', name: 'Rank Math SEO', identifiers: ['rank-math'], metaGenerator: 'Rank Math' },
    { slug: 'all-in-one-seo-pack', name: 'All in One SEO', identifiers: ['aioseo', 'all-in-one-seo'] },
    { slug: 'seopress', name: 'SEOPress', identifiers: ['seopress'] },
    
    // FORMULARIOS
    { slug: 'contact-form-7', name: 'Contact Form 7', identifiers: ['contact-form-7'], classes: ['wpcf7'] },
    { slug: 'wpforms-lite', name: 'WPForms', identifiers: ['wpforms'], classes: ['wpforms'] },
    { slug: 'ninja-forms', name: 'Ninja Forms', identifiers: ['ninja-forms'], classes: ['nf-form'] },
    { slug: 'formidable', name: 'Formidable Forms', identifiers: ['formidable'], classes: ['frm_forms'] },
    { slug: 'gravityforms', name: 'Gravity Forms', identifiers: ['gravityforms', 'gf_'], classes: ['gform'] },
    { slug: 'caldera-forms', name: 'Caldera Forms', identifiers: ['caldera-forms'] },
    
    // SEGURIDAD
    { slug: 'wordfence', name: 'Wordfence Security', identifiers: ['wordfence'] },
    { slug: 'better-wp-security', name: 'iThemes Security', identifiers: ['ithemes-security', 'better-wp-security'] },
    { slug: 'sucuri-scanner', name: 'Sucuri Security', identifiers: ['sucuri'] },
    { slug: 'all-in-one-wp-security-and-firewall', name: 'All In One WP Security', identifiers: ['aiowps'] },
    { slug: 'jetpack-protect', name: 'Jetpack Protect', identifiers: ['jetpack-protect'] },
    
    // CACHE Y RENDIMIENTO
    { slug: 'wp-super-cache', name: 'WP Super Cache', identifiers: ['wp-super-cache'] },
    { slug: 'w3-total-cache', name: 'W3 Total Cache', identifiers: ['w3-total-cache', 'w3tc'] },
    { slug: 'wp-fastest-cache', name: 'WP Fastest Cache', identifiers: ['wp-fastest-cache'] },
    { slug: 'litespeed-cache', name: 'LiteSpeed Cache', identifiers: ['litespeed-cache'] },
    { slug: 'wp-rocket', name: 'WP Rocket', identifiers: ['wp-rocket'] },
    { slug: 'autoptimize', name: 'Autoptimize', identifiers: ['autoptimize'] },
    
    // OPTIMIZACIÓN DE IMÁGENES
    { slug: 'wp-smushit', name: 'Smush', identifiers: ['wp-smushit', 'smush'] },
    { slug: 'ewww-image-optimizer', name: 'EWWW Image Optimizer', identifiers: ['ewww-image-optimizer'] },
    { slug: 'imagify', name: 'Imagify', identifiers: ['imagify'] },
    { slug: 'shortpixel-image-optimiser', name: 'ShortPixel', identifiers: ['shortpixel'] },
    { slug: 'optimole-wp', name: 'Optimole', identifiers: ['optimole'] },
    
    // BACKUP
    { slug: 'duplicator', name: 'Duplicator', identifiers: ['duplicator'] },
    { slug: 'updraftplus', name: 'UpdraftPlus', identifiers: ['updraftplus'] },
    { slug: 'backwpup', name: 'BackWPup', identifiers: ['backwpup'] },
    { slug: 'all-in-one-wp-migration', name: 'All-in-One WP Migration', identifiers: ['all-in-one-wp-migration'] },
    
    // CAMPOS PERSONALIZADOS
    { slug: 'advanced-custom-fields', name: 'Advanced Custom Fields', identifiers: ['acf', 'advanced-custom-fields'] },
    { slug: 'custom-post-type-ui', name: 'Custom Post Type UI', identifiers: ['cpt-ui', 'custom-post-type-ui'] },
    { slug: 'meta-box', name: 'Meta Box', identifiers: ['meta-box'] },
    { slug: 'pods', name: 'Pods', identifiers: ['pods'] },
    
    // MULTIIDIOMA
    { slug: 'sitepress-multilingual-cms', name: 'WPML', identifiers: ['wpml', 'sitepress'] },
    { slug: 'polylang', name: 'Polylang', identifiers: ['polylang'] },
    { slug: 'translatepress-multilingual', name: 'TranslatePress', identifiers: ['translatepress', 'trp-'] },
    { slug: 'weglot', name: 'Weglot', identifiers: ['weglot'] },
    
    // PAGE BUILDERS (además de Elementor)
    { slug: 'beaver-builder-lite-version', name: 'Beaver Builder', identifiers: ['fl-builder'], classes: ['fl-builder'] },
    { slug: 'js_composer', name: 'WPBakery Page Builder', identifiers: ['js_composer', 'wpb_'], classes: ['vc_', 'wpb_'] },
    { slug: 'thrive-visual-editor', name: 'Thrive Architect', identifiers: ['thrive', 'tve_'] },
    { slug: 'oxygen', name: 'Oxygen Builder', identifiers: ['oxygen', 'ct-'], classes: ['oxy-'] },
    { slug: 'brizy', name: 'Brizy', identifiers: ['brizy'], classes: ['brz'] },
    
    // E-COMMERCE
    { slug: 'easy-digital-downloads', name: 'Easy Digital Downloads', identifiers: ['easy-digital-downloads', 'edd'] },
    { slug: 'wp-ecommerce', name: 'WP eCommerce', identifiers: ['wp-e-commerce', 'wpsc'] },
    
    // SOCIAL Y COMPARTIR
    { slug: 'jetpack', name: 'Jetpack', identifiers: ['jetpack'], classes: ['jetpack'] },
    { slug: 'social-warfare', name: 'Social Warfare', identifiers: ['social-warfare'] },
    { slug: 'monarch', name: 'Monarch', identifiers: ['monarch'] },
    { slug: 'add-to-any', name: 'AddToAny Share Buttons', identifiers: ['add-to-any', 'addtoany'] },
    
    // SPAM Y COMENTARIOS
    { slug: 'akismet', name: 'Akismet Anti-spam', identifiers: ['akismet'] },
    { slug: 'disqus-comment-system', name: 'Disqus', identifiers: ['disqus'] },
    
    // GALERÍA Y MULTIMEDIA
    { slug: 'nextgen-gallery', name: 'NextGEN Gallery', identifiers: ['nextgen-gallery', 'ngg'] },
    { slug: 'envira-gallery-lite', name: 'Envira Gallery', identifiers: ['envira'] },
    { slug: 'modula-best-grid-gallery', name: 'Modula', identifiers: ['modula'] },
    { slug: 'wp-smush-pro', name: 'Smush Pro', identifiers: ['wp-smush-pro'] },
    
    // MEMBRESÍAS Y LMS
    { slug: 'lifterlms', name: 'LifterLMS', identifiers: ['lifterlms'], classes: ['llms'] },
    { slug: 'learnpress', name: 'LearnPress', identifiers: ['learnpress'] },
    { slug: 'learndash', name: 'LearnDash', identifiers: ['learndash', 'ld-'] },
    { slug: 'memberpress', name: 'MemberPress', identifiers: ['memberpress', 'mepr-'] },
    { slug: 'restrict-content-pro', name: 'Restrict Content Pro', identifiers: ['restrict-content'] },
    { slug: 'paid-memberships-pro', name: 'Paid Memberships Pro', identifiers: ['paid-memberships-pro', 'pmpro'] },
    
    // NEWSLETTER Y EMAIL
    { slug: 'mailchimp-for-wp', name: 'MC4WP: Mailchimp', identifiers: ['mailchimp-for-wp', 'mc4wp'] },
    { slug: 'newsletter', name: 'Newsletter', identifiers: ['newsletter'] },
    { slug: 'mailpoet', name: 'MailPoet', identifiers: ['mailpoet', 'wysija'] },
    
    // SLIDERS
    { slug: 'ml-slider', name: 'MetaSlider', identifiers: ['ml-slider', 'metaslider'] },
    { slug: 'smart-slider-3', name: 'Smart Slider 3', identifiers: ['smart-slider', 'nextend'] },
    { slug: 'revslider', name: 'Slider Revolution', identifiers: ['revslider'] },
    
    // REDIRECCIONES Y 404
    { slug: 'redirection', name: 'Redirection', identifiers: ['redirection'] },
    { slug: 'safe-redirect-manager', name: 'Safe Redirect Manager', identifiers: ['safe-redirect-manager'] },
    
    // MANTENIMIENTO
    { slug: 'coming-soon', name: 'Coming Soon Page', identifiers: ['coming-soon', 'seed-csp'] },
    { slug: 'maintenance', name: 'Maintenance', identifiers: ['maintenance'] },
    { slug: 'wp-maintenance-mode', name: 'WP Maintenance Mode', identifiers: ['wp-maintenance-mode'] },
    
    // POPUPS Y CONVERSIÓN
    { slug: 'popup-maker', name: 'Popup Maker', identifiers: ['popup-maker', 'pum-'] },
    { slug: 'optinmonster', name: 'OptinMonster', identifiers: ['optinmonster'] },
    { slug: 'convertpro', name: 'Convert Pro', identifiers: ['convertpro'] },
    
    // OTROS POPULARES
    { slug: 'really-simple-ssl', name: 'Really Simple SSL', identifiers: ['really-simple-ssl'] },
    { slug: 'classic-editor', name: 'Classic Editor', identifiers: ['classic-editor'] },
    { slug: 'wp-mail-smtp', name: 'WP Mail SMTP', identifiers: ['wp-mail-smtp'] },
    { slug: 'google-analytics-for-wordpress', name: 'MonsterInsights', identifiers: ['monsterinsights', 'google-analytics-for-wordpress'] },
    { slug: 'google-site-kit', name: 'Site Kit by Google', identifiers: ['google-site-kit'] },
    { slug: 'wp-statistics', name: 'WP Statistics', identifiers: ['wp-statistics'] },
    { slug: 'insert-headers-and-footers', name: 'Insert Headers and Footers', identifiers: ['insert-headers-and-footers'] },
    { slug: 'cookie-notice', name: 'Cookie Notice', identifiers: ['cookie-notice'] },
    { slug: 'gdpr-cookie-consent', name: 'GDPR Cookie Consent', identifiers: ['gdpr-cookie-consent'] }
  ];

  // Función para detectar un plugin
  function detectPlugin(pluginConfig) {
    let detected = false;
    let version = null;
    
    // Verificar meta generator
    if (pluginConfig.metaGenerator) {
      const meta = document.querySelector(`meta[name="generator"][content*="${pluginConfig.metaGenerator}"]`);
      if (meta) {
        detected = true;
        const vMatch = meta.content.match(/[\d.]+/);
        if (vMatch) version = vMatch[0];
      }
    }
    
    // Verificar scripts y links con identificadores
    pluginConfig.identifiers.forEach(identifier => {
      if (!detected) {
        const scripts = document.querySelectorAll(`script[src*="${identifier}"]`);
        const links = document.querySelectorAll(`link[href*="${identifier}"]`);
        
        if (scripts.length > 0 || links.length > 0) {
          detected = true;
          
          // Intentar obtener versión
          if (scripts.length > 0) {
            const scriptWithVer = Array.from(scripts).find(s => s.src.includes('ver='));
            if (scriptWithVer) {
              const vMatch = scriptWithVer.src.match(/ver=([\d.]+)/);
              if (vMatch) version = vMatch[1];
            }
          }
          
          if (!version && links.length > 0) {
            const linkWithVer = Array.from(links).find(l => l.href.includes('ver='));
            if (linkWithVer) {
              const vMatch = linkWithVer.href.match(/ver=([\d.]+)/);
              if (vMatch) version = vMatch[1];
            }
          }
        }
      }
    });
    
    // Verificar clases CSS específicas
    if (!detected && pluginConfig.classes) {
      pluginConfig.classes.forEach(className => {
        if (!detected) {
          const elements = document.querySelectorAll(`[class*="${className}"]`);
          if (elements.length > 0) {
            detected = true;
          }
        }
      });
    }
    
    if (detected) {
      return {
        name: pluginConfig.name,
        slug: pluginConfig.slug,
        version: version
      };
    }
    
    return null;
  }

  // Detectar todos los plugins
  pluginsToDetect.forEach(pluginConfig => {
    const plugin = detectPlugin(pluginConfig);
    if (plugin) {
      // Evitar duplicados
      const exists = info.plugins.find(p => p.slug === plugin.slug);
      if (!exists) {
        info.plugins.push(plugin);
      }
    }
  });

  // Detectar Elementor
  const elementorLinks = document.querySelectorAll('link[href*="elementor"]');
  const elementorScripts = document.querySelectorAll('script[src*="elementor"]');
  const elementorClasses = document.querySelectorAll('[class*="elementor"]');
  
  if (elementorLinks.length > 0 || elementorScripts.length > 0 || elementorClasses.length > 0) {
    info.pageBuilder = 'Elementor';
    
    let elementorVersion = null;
    const elementorMeta = document.querySelector('meta[name="generator"][content*="Elementor"]');
    if (elementorMeta) {
      const vMatch = elementorMeta.content.match(/Elementor ([\d.]+)/);
      if (vMatch) {
        elementorVersion = vMatch[1];
        info.pageBuilder += ' ' + elementorVersion;
      }
    }
    
    // También añadir a la lista de plugins
    info.plugins.push({
      name: 'Elementor',
      slug: 'elementor',
      version: elementorVersion
    });
  }

  // Detectar Divi
  const diviLinks = document.querySelectorAll('link[href*="divi"], link[href*="Divi"]');
  const diviScripts = document.querySelectorAll('script[src*="divi"], script[src*="Divi"]');
  const diviClasses = document.querySelectorAll('[class*="et_pb"], [class*="et-"], [id*="et-"]');
  
  if (diviLinks.length > 0 || diviScripts.length > 0 || diviClasses.length > 5) {
    info.pageBuilder = info.pageBuilder ? info.pageBuilder + ' + Divi' : 'Divi';
  }

  // Detectar otros page builders populares
  if (!info.pageBuilder) {
    if (document.querySelector('[class*="vc_"], [class*="wpb_"]')) {
      info.pageBuilder = 'WPBakery (Visual Composer)';
    }
    else if (document.querySelector('[class*="fl-builder"]')) {
      info.pageBuilder = 'Beaver Builder';
    }
    else if (document.querySelector('.wp-block-')) {
      info.pageBuilder = 'Gutenberg (Editor de bloques)';
    }
  }

  // Detectar versión de PHP
  const phpMatch = htmlContent.match(/PHP[\/\s]+([\d.]+)/i);
  if (phpMatch) {
    info.phpVersion = phpMatch[1];
  }

  // Detectar Google Sites
  function detectGoogleSites() {
    if (document.querySelector('meta[name="generator"][content*="Google Sites"]')) {
      return true;
    }
    if (document.querySelector('script[src*="scs/sites"]') ||
        document.querySelector('link[href*="scs/sites"]')) {
      return true;
    }
    if (location.hostname.includes("sites.google.com")) {
      return true;
    }
    if (document.querySelector('[class*="sites-embed"], [class*="sites-layout"], [class*="sites-navigation"]')) {
      return true;
    }
    return false;
  }

  if (detectGoogleSites()) {
    info.isWordPress = false;
    info.pageBuilder = "Google Sites";
    return info;
  }

  return info;
}

// Escuchar mensajes del popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "detectWordPress") {
    // Usar async/await para esperar el resultado completo
    detectWordPress().then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Error en detección:', error);
      sendResponse({error: true});
    });
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
});