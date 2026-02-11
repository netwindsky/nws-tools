/**
 * UI Internationalization Helper
 * Automatically translates elements with data-i18n attributes
 */
(function() {
    'use strict';

    function localizeHtmlPage() {
        // Localize text content: <span data-i18n="key">Default</span>
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.textContent = message;
            }
        });

        // Localize placeholders: <input data-i18n-placeholder="key">
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.setAttribute('placeholder', message);
            }
        });

        // Localize titles: <div data-i18n-title="key">
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.setAttribute('title', message);
            }
        });
        
        // Localize values: <input type="button" data-i18n-value="key">
        document.querySelectorAll('[data-i18n-value]').forEach(element => {
            const key = element.getAttribute('data-i18n-value');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.value = message;
            }
        });
    }

    // Execute when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', localizeHtmlPage);
    } else {
        localizeHtmlPage();
    }
})();
