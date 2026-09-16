export class FirefoxEnhancementsHoverChild extends JSWindowActorChild {
  receiveMessage(message) {
    if (message.name !== 'GetHoveredImage') return null;
    const doc = this.document;
    if (!doc || doc.hidden) return null;
    function findImage(root) {
      for (const node of root.querySelectorAll(':hover')) {
        if (node.shadowRoot) {
          const nested = findImage(node.shadowRoot);
          if (nested) return nested;
        }
        if (node.localName === 'img' && node.complete && node.naturalWidth > 0) return node;
      }
      return null;
    }
    const image = findImage(doc);
    if (!image) return null;
    // Match Firefox's native ContextMenuChild: use the loaded image metadata,
    // not the page MIME type or an extension guessed from the URL.
    let contentType = null;
    let contentDisposition = null;
    try {
      const cache = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools).getImgCacheForDocument(doc);
      const props = cache.findEntryProperties(image.currentURI, doc);
      try { contentType = props.get('type', Ci.nsISupportsCString).data; } catch (_) {}
      try { contentDisposition = props.get('content-disposition', Ci.nsISupportsCString).data; } catch (_) {}
    } catch (_) {}
    if (!contentType) {
      try { contentType = image.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST).mimeType; } catch (_) {}
    }
    const { E10SUtils } = ChromeUtils.importESModule('resource://gre/modules/E10SUtils.sys.mjs');
    const referrer = Cc['@mozilla.org/referrer-info;1'].createInstance(Ci.nsIReferrerInfo);
    referrer.initWithElement(image);
    return {
      url: image.currentSrc || image.src,
      contentType,
      contentDisposition,
      referrer: E10SUtils.serializeReferrerInfo(referrer),
      cookies: E10SUtils.serializeCookieJarSettings(doc.cookieJarSettings)
    };
  }
}
