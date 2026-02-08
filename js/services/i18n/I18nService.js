(function() {
    'use strict';

    const getMessage = (key, placeholders) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
                return chrome.i18n.getMessage(key, placeholders);
            }
        } catch (error) {
            return '';
        }
        return '';
    };

    const t = (key, placeholders) => {
        const message = getMessage(key, placeholders);
        if (message) return message;
        return '';
    };

    const I18nService = { t };

    if (window.NWSModules && typeof window.NWSModules.register === 'function') {
        window.NWSModules.register('I18nService', I18nService);
    }

    window.I18nService = I18nService;
})();
