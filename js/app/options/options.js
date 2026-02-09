const storage = chrome?.storage?.sync;
const getEl = (id) => document.getElementById(id);

const getValue = (id) => {
    const el = getEl(id);
    return el ? el.value : '';
};

const getChecked = (id) => {
    const el = getEl(id);
    return Boolean(el?.checked);
};

const setValue = (id, value) => {
    const el = getEl(id);
    if (el && value !== undefined && value !== null) {
        el.value = value;
    }
};

const setChecked = (id, value) => {
    const el = getEl(id);
    if (el && typeof value === 'boolean') {
        el.checked = value;
    }
};

const setConfig = async (key, value) => {
    if (storage) {
        return await new Promise(resolve => {
            storage.set({ [key]: value }, () => resolve(true));
        });
    }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
};

const getConfig = async (keys) => {
    if (storage) {
        return await new Promise(resolve => storage.get(keys, resolve));
    }
    const result = {};
    keys.forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
            result[key] = JSON.parse(raw);
        }
    });
    return result;
};

const mapTargetLanguageToCode = (targetLanguage) => {
    if (!targetLanguage) return '';
    const normalized = String(targetLanguage).toLowerCase();
    if (normalized.includes('中文') || normalized.includes('chinese') || normalized.includes('zh')) return 'zh';
    if (normalized.includes('english') || normalized.includes('en')) return 'en';
    if (normalized.includes('日本語') || normalized.includes('ja')) return 'ja';
    if (normalized.includes('한국어') || normalized.includes('ko')) return 'ko';
    return '';
};

const showToast = (message, type = 'success') => {
    const toast = getEl('toast');
    const icon = getEl('toast-icon');
    const msg = getEl('toast-message');
    if (!toast || !icon || !msg) return;
    toast.className = `toast show ${type}`;
    icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    msg.textContent = message;
    setTimeout(() => toast.classList.remove('show'), 3000);
};

const setButtonState = (button, state) => {
    if (!button) return;
    if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
    }
    if (state === 'loading') {
        const loadingText = t('options_saving_loading', null, '保存中...');
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        button.style.opacity = '0.7';
        button.style.pointerEvents = 'none';
    } else if (state === 'saved') {
        const savedText = t('options_saving_saved', null, '已保存');
        button.innerHTML = `<i class="fas fa-check"></i> ${savedText}`;
        button.style.opacity = '0.7';
        button.style.pointerEvents = 'none';
    } else if (state === 'restore') {
        button.innerHTML = button.dataset.originalHtml;
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
    }
};

const applyI18n = () => {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key, null, el.textContent);
        if (text) el.textContent = text;
    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = t(key, null, el.placeholder);
        if (text) el.placeholder = text;
    });
};

const handleSave = async (button, saveFn) => {
    if (!button) return;
    setButtonState(button, 'loading');
    try {
        await saveFn();
        setButtonState(button, 'saved');
        showToast('设置已成功保存！');
    } catch (error) {
        showToast('保存失败，请稍后再试', 'error');
    } finally {
        setTimeout(() => setButtonState(button, 'restore'), 2000);
    }
};

let currentBlacklist = [];

const renderBlacklist = () => {
    const list = getEl('blacklist-list');
    if (!list) return;
    list.innerHTML = '';
    currentBlacklist.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'blacklist-item';
        li.innerHTML = `
            <span>${item}</span>
            <i class="fas fa-trash-can remove-btn" data-index="${index}"></i>
        `;
        list.appendChild(li);
    });

    // 绑定删除事件
    list.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            currentBlacklist.splice(index, 1);
            renderBlacklist();
        });
    });
};

const initNavigation = () => {
    const navItems = Array.from(document.getElementsByClassName('nav-item'));
    const panels = Array.from(document.getElementsByClassName('section-panel'));
    if (!navItems.length || !panels.length) return;
    const activate = (target) => {
        navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-target') === target));
        panels.forEach(panel => panel.classList.toggle('active', panel.id === target));
    };
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target) {
                activate(target);
            }
        });
    });
};

const bindSaveHandlers = () => {
    const saveUser = getEl('save-user');
    if (saveUser) {
        saveUser.addEventListener('click', () => handleSave(saveUser, async () => {
            await setConfig('userData', {
                username: getValue('username'),
                email: getValue('email')
            });
        }));
    }

    const saveModel = getEl('save-model');
    if (saveModel) {
        saveModel.addEventListener('click', () => handleSave(saveModel, async () => {
            await setConfig('modelSettings', {
                apiUrl: getValue('model-api-url'),
                apiKey: getValue('model-api-key'),
                model: getValue('model-selection')
            });
        }));
    }

    const saveTranslation = getEl('save-translation');
    if (saveTranslation) {
        saveTranslation.addEventListener('click', () => handleSave(saveTranslation, async () => {
            const defaultLanguage = getValue('default-language');
            const service = getValue('translation-service');
            const translationMode = getValue('translation-mode') || 'bilingual';
            const enableSelectionTranslation = getChecked('enable-selection-translation');
            const enableViewportTranslation = getChecked('enable-viewport-translation');
            await setConfig('translationSettings', {
                defaultLanguage,
                service,
                translationMode,
                enableSelectionTranslation,
                enableViewportTranslation
            });
            const langMap = {
                zh: '中文',
                en: 'English',
                ja: '日本語',
                ko: '한국어'
            };
            const config = await getConfig(['TranslationModule']);
            const existing = config.TranslationModule || {};
            const targetLanguage = langMap[defaultLanguage] || existing.targetLanguage || '中文';
            await setConfig('TranslationModule', {
                ...existing,
                targetLanguage,
                translationMode,
                enableSelectionTranslation,
                enableViewportTranslation
            });
        }));
    }

    const saveShortcuts = getEl('save-shortcuts');
    if (saveShortcuts) {
        saveShortcuts.addEventListener('click', () => handleSave(saveShortcuts, async () => {
            await setConfig('shortcutSettings', {
                main: getValue('shortcut-main'),
                capture: getValue('shortcut-capture')
            });
        }));
    }

    const saveBlacklist = getEl('save-blacklist');
    if (saveBlacklist) {
        saveBlacklist.addEventListener('click', () => handleSave(saveBlacklist, async () => {
            const config = await getConfig(['ChromeSettingsModule']);
            const existing = config.ChromeSettingsModule || {};
            await setConfig('ChromeSettingsModule', {
                ...existing,
                blacklist: currentBlacklist
            });
        }));
    }

    const addBlacklist = getEl('add-blacklist');
    const blacklistInput = getEl('blacklist-input');
    if (addBlacklist && blacklistInput) {
        const addFn = () => {
            const val = blacklistInput.value.trim();
            if (val && !currentBlacklist.includes(val)) {
                currentBlacklist.push(val);
                blacklistInput.value = '';
                renderBlacklist();
            }
        };
        addBlacklist.addEventListener('click', addFn);
        blacklistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addFn();
        });
    }
};

const bindToggleHandlers = () => {
    const autoSave = getEl('auto-save');
    const cloudSync = getEl('cloud-sync');
    if (autoSave || cloudSync) {
        const handler = async () => {
            await setConfig('contentSettings', {
                autoSave: getChecked('auto-save'),
                cloudSync: getChecked('cloud-sync')
            });
        };
        autoSave?.addEventListener('change', handler);
        cloudSync?.addEventListener('change', handler);
    }

    const enableSidebar = getEl('enable-sidebar');
    const enableDarkmode = getEl('enable-darkmode');
    const enableDevtools = getEl('enable-devtools');
    if (enableSidebar || enableDarkmode || enableDevtools) {
        const handler = async () => {
            await setConfig('featureToggles', {
                sidebar: getChecked('enable-sidebar'),
                darkmode: getChecked('enable-darkmode'),
                devtools: getChecked('enable-devtools')
            });
        };
        enableSidebar?.addEventListener('change', handler);
        enableDarkmode?.addEventListener('change', handler);
        enableDevtools?.addEventListener('change', handler);
    }
};

const loadSavedSettings = async () => {
    const config = await getConfig([
        'userData',
        'modelSettings',
        'translationSettings',
        'TranslationModule',
        'contentSettings',
        'shortcutSettings',
        'featureToggles',
        'ChromeSettingsModule'
    ]);

    if (config.ChromeSettingsModule && config.ChromeSettingsModule.blacklist) {
        currentBlacklist = config.ChromeSettingsModule.blacklist;
        renderBlacklist();
    }

    if (config.userData) {
        setValue('username', config.userData.username);
        setValue('email', config.userData.email);
    }
    if (config.modelSettings) {
        setValue('model-api-url', config.modelSettings.apiUrl);
        setValue('model-api-key', config.modelSettings.apiKey);
        setValue('model-selection', config.modelSettings.model);
    }
    if (config.translationSettings || config.TranslationModule) {
        const translationSettings = config.translationSettings || {};
        const translationModule = config.TranslationModule || {};
        const defaultLanguage = translationSettings.defaultLanguage || mapTargetLanguageToCode(translationModule.targetLanguage) || 'zh';
        setValue('default-language', defaultLanguage);
        setValue('translation-service', translationSettings.service);
        setValue('translation-mode', translationSettings.translationMode || translationModule.translationMode || 'bilingual');
        const selectionEnabled = typeof translationSettings.enableSelectionTranslation === 'boolean'
            ? translationSettings.enableSelectionTranslation
            : typeof translationModule.enableSelectionTranslation === 'boolean'
                ? translationModule.enableSelectionTranslation
                : true;
        const viewportEnabled = typeof translationSettings.enableViewportTranslation === 'boolean'
            ? translationSettings.enableViewportTranslation
            : typeof translationModule.enableViewportTranslation === 'boolean'
                ? translationModule.enableViewportTranslation
                : true;
        setChecked('enable-selection-translation', selectionEnabled);
        setChecked('enable-viewport-translation', viewportEnabled);
    }
    if (config.contentSettings) {
        setChecked('auto-save', config.contentSettings.autoSave);
        setChecked('cloud-sync', config.contentSettings.cloudSync);
    }
    if (config.shortcutSettings) {
        setValue('shortcut-main', config.shortcutSettings.main);
        setValue('shortcut-capture', config.shortcutSettings.capture);
    }
    if (config.featureToggles) {
        setChecked('enable-sidebar', config.featureToggles.sidebar);
        setChecked('enable-darkmode', config.featureToggles.darkmode);
        setChecked('enable-devtools', config.featureToggles.devtools);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    bindSaveHandlers();
    bindToggleHandlers();
    await loadSavedSettings();
    applyI18n();
});
