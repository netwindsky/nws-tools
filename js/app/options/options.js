const storage = chrome?.storage?.sync;
const getEl = (id) => document.getElementById(id);
const i18nService = window.I18nService || window.NWSModules?.get?.('I18nService');
const t = (key, placeholders, fallback = '') => {
    try {
        if (i18nService && typeof i18nService.t === 'function') {
            const value = i18nService.t(key, placeholders);
            if (value) return value;
        }
    } catch (error) {
        return fallback || key;
    }
    return fallback || key;
};

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
const normalizeBlacklist = (list) => {
    const normalized = (Array.isArray(list) ? list : [])
        .map(item => String(item).trim())
        .filter(item => item);
    return Array.from(new Set(normalized));
};

// AI 模型管理
let aiModelList = [];
let currentEditingIndex = -1;

const normalizeAIModels = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter(model => model && typeof model === 'object');
};

const getAIModelFormData = () => ({
    basename: getValue('ai-model-name').trim(),
    baseurl: getValue('ai-model-baseurl').trim(),
    apikey: getValue('ai-model-apikey').trim(),
    modelname: getValue('ai-model-modelname').trim()
});

const setAIModelFormData = (model) => {
    setValue('ai-model-name', model?.basename || '');
    setValue('ai-model-baseurl', model?.baseurl || '');
    setValue('ai-model-apikey', model?.apikey || '');
    setValue('ai-model-modelname', model?.modelname || '');
};

const clearAIModelForm = () => {
    setValue('ai-model-name', '');
    setValue('ai-model-baseurl', '');
    setValue('ai-model-apikey', '');
    setValue('ai-model-modelname', '');
    setValue('ai-model-edit-index', '');
    currentEditingIndex = -1;
};

const validateAIModel = (model) => {
    if (!model.basename) return t('validate_model_name_required', null, '请输入模型名称');
    if (!model.baseurl) return t('validate_api_endpoint_required', null, '请输入 API 节点地址');
    if (!model.apikey) return t('validate_api_key_required', null, '请输入 API 密钥');
    if (!model.modelname) return t('validate_model_identifier_required', null, '请输入模型标识');
    return null;
};

const showAIModelForm = (isEdit = false) => {
    const form = getEl('ai-model-form');
    const addSection = getEl('ai-model-add-section');
    if (form) form.classList.add('show');
    if (addSection) addSection.style.display = 'none';
    if (!isEdit) clearAIModelForm();
};

const hideAIModelForm = () => {
    const form = getEl('ai-model-form');
    const addSection = getEl('ai-model-add-section');
    if (form) form.classList.remove('show');
    if (addSection) addSection.style.display = 'block';
    clearAIModelForm();
};



const renderAIModelList = () => {
    const list = getEl('ai-model-list');
    if (!list) return;

    list.innerHTML = '';

    if (aiModelList.length === 0) {
        list.innerHTML = `
            <li class="ai-model-empty">
                <i class="fas fa-robot"></i>
                <p data-i18n="msg_no_models">暂无配置模型，点击上方按钮添加</p>
            </li>
        `;
        return;
    }

    aiModelList.forEach((model, index) => {
        const li = document.createElement('li');
        li.className = 'ai-model-item';
        li.innerHTML = `
            <div class="ai-model-info">
                <div class="ai-model-name">${escapeHtml(model.basename)}</div>
                <div class="ai-model-details">
                    <span><i class="fas fa-link"></i> ${escapeHtml(truncateUrl(model.baseurl))}</span>
                    <span><i class="fas fa-robot"></i> ${escapeHtml(model.modelname)}</span>
                </div>
            </div>
            <div class="ai-model-actions">
                <button class="action-btn edit" data-index="${index}" title="编辑">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="action-btn delete" data-index="${index}" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(li);
    });

    // 绑定编辑和删除事件
    list.querySelectorAll('.action-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            editAIModel(index);
        });
    });

    list.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            deleteAIModel(index);
        });
    });
};

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

const truncateUrl = (url, maxLength = 30) => {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
};

const editAIModel = (index) => {
    if (index < 0 || index >= aiModelList.length) return;
    const model = aiModelList[index];
    currentEditingIndex = index;
    setAIModelFormData(model);
    setValue('ai-model-edit-index', index);
    showAIModelForm(true);
};

const deleteAIModel = async (index) => {
    if (index < 0 || index >= aiModelList.length) return;

    const modelName = aiModelList[index].basename;
    const confirmMsg = t('msg_confirm_delete_model', modelName, `确定要删除模型 "${modelName}" 吗？`);
    if (!confirm(confirmMsg)) return;

    aiModelList.splice(index, 1);

    await saveAIModelConfig();
    renderAIModelList();
    showToast(t('msg_model_deleted', null, '模型已删除'));

    // 更新默认翻译模型下拉选项，保持当前选中值
    const currentSelected = getValue('default-model');
    updateDefaultModelOptions(currentSelected);
};

const saveAIModel = async () => {
    const model = getAIModelFormData();
    const error = validateAIModel(model);
    if (error) {
        showToast(error, 'error');
        return;
    }

    if (currentEditingIndex >= 0) {
        // 编辑模式
        aiModelList[currentEditingIndex] = model;
        showToast(t('msg_model_updated', null, '模型已更新'));
    } else {
        // 添加模式
        aiModelList.push(model);
        showToast(t('msg_model_added', null, '模型已添加'));
    }

    await saveAIModelConfig();
    hideAIModelForm();
    renderAIModelList();

    // 更新默认翻译模型下拉选项，保持当前选中值
    const currentSelected = getValue('default-model');
    updateDefaultModelOptions(currentSelected);
};

const saveAIModelConfig = async () => {
    await setConfig('aiModelSettings', {
        models: aiModelList
    });
};

// 更新默认翻译模型下拉选项
const updateDefaultModelOptions = (selectedValue = '') => {
    const select = getEl('default-model');
    if (!select) return;

    // 保留第一个默认选项
    const defaultOption = select.options[0];
    const defaultOptionValue = defaultOption.value;
    const defaultOptionText = defaultOption.textContent;

    // 构建新的选项列表
    const options = [];

    // 添加默认选项
    options.push({ value: defaultOptionValue, text: defaultOptionText });

    // 添加 AI 模型列表
    aiModelList.forEach(model => {
        options.push({ value: model.modelname, text: model.basename });
    });

    // 如果已保存的模型不在列表中，添加一个提示选项
    const modelExists = aiModelList.some(m => m.modelname === selectedValue);
    if (selectedValue && !modelExists) {
        const notConfigured = t('msg_model_not_configured', null, '未配置');
        options.push({ value: selectedValue, text: `${selectedValue} (${notConfigured})` });
    }

    // 重新构建 select
    select.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (opt.value === selectedValue && !modelExists && opt.value !== defaultOptionValue) {
            option.style.color = '#ff5252';
        }
        select.appendChild(option);
    });

    // 恢复选中值
    if (selectedValue) {
        select.value = selectedValue;
    }
};

const loadAIModelSettings = async (savedDefaultModel = '') => {
    const config = await getConfig(['aiModelSettings', 'modelSettings']);

    // 加载新格式
    if (config.aiModelSettings) {
        aiModelList = normalizeAIModels(config.aiModelSettings.models);
    }

    // 兼容旧格式 - 迁移数据
    if (config.modelSettings && aiModelList.length === 0) {
        if (config.modelSettings.apiUrl || config.modelSettings.apiKey) {
            const oldModel = {
                basename: t('msg_default_model_name', null, '默认模型'),
                baseurl: config.modelSettings.apiUrl || '',
                apikey: config.modelSettings.apiKey || '',
                modelname: config.modelSettings.model || 'gpt-4o'
            };
            if (oldModel.baseurl && oldModel.apikey) {
                aiModelList.push(oldModel);
                await saveAIModelConfig();
            }
        }
    }

    renderAIModelList();

    // 更新默认翻译模型下拉选项
    updateDefaultModelOptions(savedDefaultModel);
};

const bindAIModelHandlers = () => {
    const addBtn = getEl('ai-model-add-btn');
    const cancelBtn = getEl('ai-model-cancel');
    const saveBtn = getEl('ai-model-save');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            currentEditingIndex = -1;
            clearAIModelForm();
            showAIModelForm();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideAIModelForm);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSave(saveBtn, saveAIModel));
    }
};

const saveBlacklistConfig = async () => {
    currentBlacklist = normalizeBlacklist(currentBlacklist);
    renderBlacklist();
    const config = await getConfig(['ChromeSettingsModule']);
    const existing = config.ChromeSettingsModule || {};
    await setConfig('ChromeSettingsModule', {
        ...existing,
        blacklist: currentBlacklist
    });
};

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
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.target.dataset.index);
            currentBlacklist.splice(index, 1);
            renderBlacklist();
            await saveBlacklistConfig();
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

    const saveTranslation = getEl('save-translation');
    if (saveTranslation) {
        saveTranslation.addEventListener('click', () => handleSave(saveTranslation, async () => {
            const defaultLanguage = getValue('default-language');
            const service = getValue('translation-service');
            const defaultModel = getValue('default-model');
            const translationMode = getValue('translation-mode') || 'bilingual';
            const concurrentLimit = parseInt(getValue('concurrent-limit'), 10) || 1;
            const enableSelectionTranslation = getChecked('enable-selection-translation');
            const enableViewportTranslation = getChecked('enable-viewport-translation');
            await setConfig('translationSettings', {
                defaultLanguage,
                service,
                defaultModel,
                translationMode,
                concurrentLimit,
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
                service,
                defaultModel,
                translationMode,
                concurrentLimit,
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
            await saveBlacklistConfig();
        }));
    }

    const addBlacklist = getEl('add-blacklist');
    const blacklistInput = getEl('blacklist-input');
    if (addBlacklist && blacklistInput) {
        const addFn = async () => {
            const val = blacklistInput.value.trim();
            if (val && !currentBlacklist.includes(val)) {
                currentBlacklist.push(val);
                blacklistInput.value = '';
                renderBlacklist();
                await saveBlacklistConfig();
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
    try {
        const config = await getConfig([
            'userData',
            'modelSettings',
            'aiModelSettings',
            'translationSettings',
            'TranslationModule',
            'contentSettings',
            'shortcutSettings',
            'featureToggles',
            'ChromeSettingsModule'
        ]);

        if (config.ChromeSettingsModule) {
            currentBlacklist = normalizeBlacklist(config.ChromeSettingsModule.blacklist);
        } else {
            currentBlacklist = [];
        }
        renderBlacklist();

        // 准备翻译设置数据
        const translationSettings = config.translationSettings || {};
        const translationModule = config.TranslationModule || {};
        const savedDefaultModel = translationSettings.defaultModel || translationModule.defaultModel || '';

        // 加载 AI 模型设置（传入已保存的默认模型）
        await loadAIModelSettings(savedDefaultModel);

        if (config.userData) {
            setValue('username', config.userData.username);
            setValue('email', config.userData.email);
        }

        // 兼容旧版模型设置（已迁移到 loadAIModelSettings）

        if (config.translationSettings || config.TranslationModule) {
            const defaultLanguage = translationSettings.defaultLanguage || mapTargetLanguageToCode(translationModule.targetLanguage) || 'zh';
            setValue('default-language', defaultLanguage);
            setValue('translation-service', translationSettings.service);
            setValue('translation-mode', translationSettings.translationMode || translationModule.translationMode || 'bilingual');
            setValue('concurrent-limit', translationSettings.concurrentLimit || translationModule.concurrentLimit || 1);
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
    } catch (error) {
        console.error('[Options] 加载配置失败:', error);
        showToast('加载配置失败，请刷新页面重试', 'error');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    bindSaveHandlers();
    bindToggleHandlers();
    bindAIModelHandlers();
    await loadSavedSettings();
    applyI18n();
});
