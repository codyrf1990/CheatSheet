const STORAGE_KEY = 'emailTemplates.v1';
const LAST_SELECTED_KEY = 'emailTemplates.lastSelectedId';
const VERSION = 1;
const MAILTO_LIMIT = 1900;

const DEFAULT_TEMPLATES = [
  {
    id: 'maintenance-renewal',
    name: 'Maintenance Renewal Reminder',
    subject: 'SolidCAM Estimate Follow-Up for {{customer_name}}',
    body: [
      'Hi {{customer_name}},',
      '',
      'Thanks again for reviewing the SolidCAM estimate we sent over. I wanted to make sure it stays on your radar.',
      '',
      'A quick reminder:',
      '- Estimate valid through {{estimate_expiration_date}}',
      '- Includes full maintenance coverage and software updates',
      '',
      'Let me know if you have any questions or if you would like to jump on a quick call to review the details.',
      '',
      'Best,',
      'The SolidCAM Team'
    ].join('\n'),
    tags: ['customer name', 'estimate expiration date'],
  },
  {
    id: 'post-demo-followup',
    name: 'Post Demo Follow Up',
    subject: 'Next Steps from Today\'s SolidCAM Demo',
    body: [
      'Hi {{customer_name}},',
      '',
      'Thanks again for joining today\'s SolidCAM walkthrough. I\'ve attached the recap deck and a sample ROI worksheet tailored to your workflow.',
      '',
      'Suggested next steps:',
      '1. Review the attached materials.',
      '2. Share any additional part files you would like us to evaluate.',
      '3. Confirm availability for a follow-up this week.',
      '',
      'Looking forward to keeping things moving.',
      '',
      'Regards,',
      'The SolidCAM Team'
    ].join('\n'),
    tags: ['customer name'],
  },
  {
    id: 'welcome-onboarding',
    name: 'Welcome & Onboarding',
    subject: 'Welcome to SolidCAM, {{customer_name}}!',
    body: [
      'Hi {{customer_name}},',
      '',
      'We\'re thrilled to have you join the SolidCAM family. To kick things off smoothly, here are your onboarding details:',
      '',
      '- Implementation kickoff: next available window',
      '- Primary point of contact: your SolidCAM team',
      '- Getting-started resources: included in the welcome packet',
      '',
      'Please reply with the preferred attendees for the kickoff call. If you need anything in the meantime just let me know.',
      '',
      'Cheers,',
      'The SolidCAM Team'
    ].join('\n'),
    tags: ['customer name'],
  },
];

export function initializeEmailTemplates() {
  const card = document.querySelector('.email-template-card');
  if (!card) return;

  const refs = {
    card,
    manageToggle: card.querySelector('[data-action="toggle-manage"]'),
    toast: card.querySelector('[data-template-toast]'),
    searchInput: card.querySelector('[data-field="search"]'),
    viewContainer: card.querySelector('.email-template-view'),
    manageContainer: card.querySelector('.email-template-manage'),
    templateList: card.querySelector('[data-template-list]'),
    previewEmpty: card.querySelector('[data-preview-empty]'),
    previewContent: card.querySelector('[data-preview-content]'),
    previewTitle: card.querySelector('[data-preview-title]'),
    previewTags: card.querySelector('[data-preview-tags]'),
    previewSubject: card.querySelector('[data-preview-subject]'),
    previewBody: card.querySelector('[data-preview-body]'),
    placeholderContainer: card.querySelector('[data-placeholder-list]'),
    placeholderNote: card.querySelector('[data-placeholder-note]'),
    personalizePanel: card.querySelector('.email-template-personalize'),
    copySubjectBtn: card.querySelector('[data-action="copy-subject"]'),
    copyBodyBtn: card.querySelector('[data-action="copy-body"]'),
    launchBtn: card.querySelector('[data-action="launch-outlook"]'),
    previewWarning: card.querySelector('[data-preview-warning]'),
    manageList: card.querySelector('[data-manage-list]'),
    manageForm: card.querySelector('[data-template-form]'),
    formFields: {
      id: card.querySelector('[data-template-form] [data-field="id"]'),
      name: card.querySelector('[data-template-form] [data-field="name"]'),
      subject: card.querySelector('[data-template-form] [data-field="subject"]'),
      body: card.querySelector('[data-template-form] [data-field="body"]'),
      tags: card.querySelector('[data-template-form] [data-field="tags"]'),
    },
    newTemplateBtn: card.querySelector('[data-action="new-template"]'),
    discardTemplateBtn: card.querySelector('[data-action="discard-template"]'),
    saveTemplateBtn: card.querySelector('[data-action="save-template"]'),
    resetDefaultsBtn: card.querySelector('[data-action="reset-defaults"]'),
  };

  const state = {
    templates: loadTemplates(),
    searchTerm: '',
    manageMode: false,
    selectedId: loadLastSelectedId(),
    placeholderValuesByTemplate: new Map(),
    formDirty: false,
    placeholderNoteDefault: refs.placeholderNote?.textContent ?? '',
  };

  ensureTemplateOrder(state.templates);

  if (!state.selectedId || !state.templates.some(t => t.id === state.selectedId)) {
    state.selectedId = state.templates[0]?.id ?? null;
  }

  if (state.selectedId) {
    state.placeholderValuesByTemplate.set(state.selectedId, {});
  }

  attachEventHandlers();
  renderView();
  renderManage();
  selectTemplate(state.selectedId, { focusList: false });

  /* Event wiring */
  function attachEventHandlers() {
    refs.manageToggle?.addEventListener('click', () => toggleManageMode());
    refs.searchInput?.addEventListener('input', event => {
      state.searchTerm = event.target.value.trim().toLowerCase();
      renderTemplateList();
    });
    refs.templateList?.addEventListener('click', event => {
      const option = event.target.closest('[data-template-id]');
      if (!option) return;
      selectTemplate(option.dataset.templateId, { focusList: false });
    });
    refs.templateList?.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(refs.templateList.querySelectorAll('[data-template-id]'));
      if (!items.length) return;
      let index = items.findIndex(el => el.dataset.templateId === state.selectedId);
      if (event.key === 'ArrowDown') index = Math.min(items.length - 1, index + 1);
      if (event.key === 'ArrowUp') index = Math.max(0, index - 1);
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = items.length - 1;
      const next = items[index];
      if (next) {
        selectTemplate(next.dataset.templateId, { focusList: true });
      }
    });

    refs.copySubjectBtn?.addEventListener('click', () => {
      const template = getSelectedTemplate();
      if (!template) return;
      const text = getRenderedSubject(template);
      copyToClipboard(text)
        .then(() => showToast('Subject copied to clipboard.', 'success'))
        .catch(() => showToast('Copy failed. Select the text manually.', 'error'));
    });

    refs.copyBodyBtn?.addEventListener('click', () => {
      const template = getSelectedTemplate();
      if (!template) return;
      const text = getRenderedBody(template);
      copyToClipboard(text)
        .then(() => showToast('Body copied to clipboard.', 'success'))
        .catch(() => showToast('Copy failed. Select the text manually.', 'error'));
    });

    refs.launchBtn?.addEventListener('click', () => {
      const template = getSelectedTemplate();
      if (!template) return;
      const unresolved = getMissingPlaceholders(template);
      if (unresolved.length) {
        showToast(`Fill placeholders: ${unresolved.join(', ')}`, 'warning');
        return;
      }
      const subject = getRenderedSubject(template);
      const body = getRenderedBody(template);
      const mailto = buildMailtoUrl(subject, body);
      if (mailto.length > MAILTO_LIMIT) {
        showToast('Email content is too long for Outlook\'s mailto launch. Copy and paste instead.', 'warning');
        return;
      }
      window.location.href = mailto;
    });

    refs.placeholderContainer?.addEventListener('input', event => {
      const field = event.target.closest('[data-placeholder-input]');
      if (!field) return;
      const { placeholderName } = field.dataset;
      const values = getCurrentPlaceholderValues();
      values[placeholderName] = event.target.value;
      state.placeholderValuesByTemplate.set(state.selectedId, values);
      updatePreviewText();
    });

    refs.newTemplateBtn?.addEventListener('click', () => {
      if (state.formDirty && !confirm('Discard your edits?')) return;
      loadFormForTemplate(null);
    });

    refs.discardTemplateBtn?.addEventListener('click', () => {
      if (!state.formDirty) {
        loadFormForTemplate(currentFormId());
        return;
      }
      if (confirm('Discard unsaved edits?')) {
        loadFormForTemplate(currentFormId());
        state.formDirty = false;
      }
    });

    refs.manageForm?.addEventListener('input', () => {
      state.formDirty = true;
    });

    refs.manageForm?.addEventListener('submit', event => {
      event.preventDefault();
      persistTemplateFromForm();
    });

    refs.resetDefaultsBtn?.addEventListener('click', () => {
      const proceed = confirm(
        'Restore the default templates? Local changes will be lost.'
      );
      if (!proceed) return;
      resetToDefaults();
    });

    refs.manageList?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const { action } = button.dataset;
      const id = button.closest('[data-manage-item]')?.dataset.templateId;
      if (!id) return;
      switch (action) {
        case 'manage-edit':
          if (state.formDirty && currentFormId() !== id && !confirm('Discard unsaved edits?')) return;
          loadFormForTemplate(id);
          break;
        case 'manage-delete':
          handleDeleteTemplate(id);
          break;
        case 'manage-clone':
          handleCloneTemplate(id);
          break;
        case 'manage-move-up':
          handleReorder(id, -1);
          break;
        case 'manage-move-down':
          handleReorder(id, 1);
          break;
        default:
          break;
      }
    });
  }

  /* Rendering */
  function renderView() {
    renderTemplateList();
    updatePreviewVisibility();
    updateManageToggleLabel();
  }

  function renderManage() {
    renderManageList();
    if (state.manageMode) {
      loadFormForTemplate(currentFormId());
    }
  }

  function renderTemplateList() {
    if (!refs.templateList) return;
    refs.templateList.innerHTML = '';
    const filtered = getFilteredTemplates();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'email-template-alert email-template-alert--warning';
      empty.textContent = 'No templates match your search.';
      refs.templateList.appendChild(empty);
      return;
    }

    filtered.forEach(template => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'email-template-item';
      button.dataset.templateId = template.id;
      button.setAttribute('role', 'option');
      if (template.id === state.selectedId) {
        button.classList.add('is-active');
        button.setAttribute('aria-selected', 'true');
      }
      const title = document.createElement('div');
      title.className = 'email-template-item__title';
      title.textContent = template.name;
      const meta = document.createElement('div');
      meta.className = 'email-template-item__meta';
      meta.textContent = template.tags.join(', ');
      button.append(title, meta);
      refs.templateList.appendChild(button);
    });
  }

  function updatePreviewVisibility() {
    const template = getSelectedTemplate();
    if (!refs.previewContent || !refs.previewEmpty) return;
    const hasTemplate = Boolean(template);
    refs.previewEmpty.hidden = hasTemplate;
    refs.previewContent.hidden = !hasTemplate;
    refs.launchBtn.disabled = !hasTemplate;
    if (!hasTemplate) {
      setPersonalizeEmpty(true, 'Select a template to personalize.');
      return;
    }
    refs.previewTitle.textContent = template.name;
    refs.previewTags.textContent = template.tags.join(', ');
    createPlaceholderInputs(template);
    updatePreviewText();
  }

  function createPlaceholderInputs(template) {
    if (!refs.placeholderContainer) return;
    refs.placeholderContainer.innerHTML = '';
    const placeholders = Array.from(new Set([
      ...extractPlaceholders(template.subject),
      ...extractPlaceholders(template.body),
    ]));

    if (!placeholders.length) {
      setPersonalizeEmpty(true, 'No personalization needed for this template.');
      return;
    }
    setPersonalizeEmpty(false);

    const values = getCurrentPlaceholderValues();

    placeholders.forEach(name => {
      const wrapper = document.createElement('div');
      wrapper.className = 'email-template-placeholder';
      const label = document.createElement('label');
      label.className = 'email-template-placeholder__label';
      label.setAttribute('for', `placeholder-${name}`);
      label.textContent = `{{${name}}}`;
      const input = document.createElement('input');
      input.id = `placeholder-${name}`;
      input.value = values[name] ?? '';
      input.dataset.placeholderInput = 'true';
      input.dataset.placeholderName = name;
      input.placeholder = `Enter ${name.replace(/[_-]/g, ' ')}`;
      wrapper.append(label, input);
      refs.placeholderContainer.appendChild(wrapper);
    });
  }

  function updatePreviewText() {
    const template = getSelectedTemplate();
    if (!template || !refs.previewSubject || !refs.previewBody) return;
    const subject = getRenderedSubject(template);
    const body = getRenderedBody(template);
    refs.previewSubject.textContent = subject;
    refs.previewBody.textContent = body;
    handleWarnings(template, subject, body);
  }

  function handleWarnings(template, subject, body) {
    if (!refs.previewWarning || !refs.launchBtn) return;
    const unresolved = getMissingPlaceholders(template);
    const mailto = buildMailtoUrl(subject, body);
    let message = '';
    let type = '';
    if (unresolved.length) {
      message = `Complete placeholders: ${unresolved.join(', ')}`;
      type = 'warning';
    } else if (mailto.length > MAILTO_LIMIT) {
      message = 'Subject/body length exceeds Outlook\'s mailto limit.';
      type = 'warning';
    }
    if (message) {
      refs.previewWarning.textContent = message;
      refs.previewWarning.hidden = false;
      refs.launchBtn.disabled = true;
    } else {
      refs.previewWarning.hidden = true;
      refs.launchBtn.disabled = false;
    }
  }

  function renderManageList() {
    if (!refs.manageList) return;
    refs.manageList.innerHTML = '';
    const templates = [...state.templates].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!templates.length) {
      const empty = document.createElement('div');
      empty.className = 'email-template-alert email-template-alert--warning';
      empty.textContent = 'No templates available. Add a new one to get started.';
      refs.manageList.appendChild(empty);
      return;
    }

    templates.forEach((template, index) => {
      const item = document.createElement('div');
      item.className = 'email-template-manage-item';
      item.dataset.manageItem = 'true';
      item.dataset.templateId = template.id;

      const title = document.createElement('div');
      title.className = 'email-template-manage-item__title';
      title.textContent = template.name;

      const meta = document.createElement('div');
      meta.className = 'email-template-manage-item__meta';
      meta.textContent = [
        template.tags.join(', ') || 'No tags',
        `Updated ${formatRelativeTime(template.updatedAt)}`,
      ].join(' • ');

      const actions = document.createElement('div');
      actions.className = 'email-template-manage-item__actions';

      const edit = createManageButton('Edit', 'manage-edit');
      const clone = createManageButton('Clone', 'manage-clone');
      const del = createManageButton('Delete', 'manage-delete');
      const up = createManageButton('Move Up', 'manage-move-up');
      const down = createManageButton('Move Down', 'manage-move-down');

      if (index === 0) up.disabled = true;
      if (index === templates.length - 1) down.disabled = true;

      actions.append(edit, clone, del, up, down);
      item.append(title, meta, actions);
      refs.manageList.appendChild(item);
    });
  }

  function createManageButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'email-template-btn';
    button.dataset.action = action;
    button.textContent = label;
    return button;
  }

  function loadFormForTemplate(id) {
    if (!refs.manageForm) return;
    const template = state.templates.find(t => t.id === id) || null;
    refs.formFields.id.value = template?.id ?? '';
    refs.formFields.name.value = template?.name ?? '';
    refs.formFields.subject.value = template?.subject ?? '';
    refs.formFields.body.value = template?.body ?? '';
    refs.formFields.tags.value = template?.tags.join(', ') ?? '';
    state.formDirty = false;
  }

  function persistTemplateFromForm() {
    const name = refs.formFields.name.value.trim();
    const subject = refs.formFields.subject.value.trim();
    const body = normalizeLineBreaks(refs.formFields.body.value.trim());
    const tags = refs.formFields.tags.value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    if (!name || !subject || !body) {
      showToast('Name, subject, and body are required.', 'error');
      return;
    }

    const existingId = refs.formFields.id.value;
    if (existingId) {
      const template = state.templates.find(t => t.id === existingId);
      if (!template) return;
      template.name = name;
      template.subject = subject;
      template.body = body;
      template.tags = tags;
      template.updatedAt = Date.now();
      state.formDirty = false;
      saveTemplates(state.templates);
      renderTemplateList();
      renderManageList();
      if (state.selectedId === existingId) {
        updatePreviewVisibility();
      }
      showToast('Template updated.', 'success');
    } else {
      const template = {
        id: generateTemplateId(name, state.templates),
        name,
        subject,
        body,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sortOrder: state.templates.length ? Math.max(...state.templates.map(t => t.sortOrder)) + 1 : 0,
      };
      state.templates.push(template);
      state.formDirty = false;
      saveTemplates(state.templates);
      renderTemplateList();
      renderManageList();
      loadFormForTemplate(template.id);
      selectTemplate(template.id);
      showToast('Template added.', 'success');
    }
  }

  function handleDeleteTemplate(id) {
    if (state.templates.length === 1) {
      showToast('Keep at least one template available.', 'warning');
      return;
    }
    const proceed = confirm('Delete this template? This cannot be undone.');
    if (!proceed) return;
    const index = state.templates.findIndex(t => t.id === id);
    if (index === -1) return;
    state.templates.splice(index, 1);
    ensureTemplateOrder(state.templates);
    saveTemplates(state.templates);
    renderTemplateList();
    renderManageList();
    if (state.selectedId === id) {
      state.selectedId = state.templates[0]?.id ?? null;
      selectTemplate(state.selectedId);
    } else {
      updatePreviewVisibility();
    }
    showToast('Template deleted.', 'success');
  }

  function handleCloneTemplate(id) {
    const template = state.templates.find(t => t.id === id);
    if (!template) return;
    const clone = {
      ...template,
      id: generateTemplateId(`${template.name} Copy`, state.templates),
      name: `${template.name} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortOrder: Math.max(...state.templates.map(t => t.sortOrder)) + 1,
    };
    state.templates.push(clone);
    saveTemplates(state.templates);
    renderTemplateList();
    renderManageList();
    selectTemplate(clone.id);
    loadFormForTemplate(clone.id);
    showToast('Template cloned.', 'success');
  }

  function handleReorder(id, delta) {
    const ordered = [...state.templates].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex(t => t.id === id);
    if (index === -1) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, moved);
    ordered.forEach((template, position) => {
      template.sortOrder = position;
    });
    state.templates = ordered;
    saveTemplates(state.templates);
    renderTemplateList();
    renderManageList();
    showToast('Template order updated.', 'success');
  }

  function selectTemplate(id, { focusList = false } = {}) {
    if (!id) {
      state.selectedId = null;
      updatePreviewVisibility();
      return;
    }
    state.selectedId = id;
    localStorage.setItem(LAST_SELECTED_KEY, id);
    if (!state.placeholderValuesByTemplate.has(id)) {
      state.placeholderValuesByTemplate.set(id, {});
    }
    renderTemplateList();
    updatePreviewVisibility();
    if (focusList) {
      const item = refs.templateList?.querySelector(`[data-template-id="${id}"]`);
      item?.focus();
    }
  }

  function toggleManageMode(forceValue) {
    const nextValue = typeof forceValue === 'boolean' ? forceValue : !state.manageMode;
    if (!nextValue && state.formDirty && !confirm('Discard unsaved changes?')) {
      return;
    }
    state.manageMode = nextValue;
    state.formDirty = false;
    if (refs.manageToggle) {
      refs.manageToggle.classList.toggle('email-template-btn--primary', state.manageMode);
    }
    refs.viewContainer.hidden = state.manageMode;
    refs.manageContainer.hidden = !state.manageMode;
    updateManageToggleLabel();
    if (state.manageMode) {
      loadFormForTemplate(state.selectedId);
    }
  }

  function updateManageToggleLabel() {
    if (!refs.manageToggle) return;
    refs.manageToggle.textContent = state.manageMode ? 'Done' : 'Manage';
  }

  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_SELECTED_KEY);
    state.templates = getDefaultTemplates();
    ensureTemplateOrder(state.templates);
    state.selectedId = state.templates[0]?.id ?? null;
    state.placeholderValuesByTemplate.clear();
    selectTemplate(state.selectedId);
    renderTemplateList();
    renderManageList();
    loadFormForTemplate(state.selectedId);
    setPersonalizeEmpty(true);
    showToast('Defaults restored.', 'success');
  }

  function setPersonalizeEmpty(isEmpty, message) {
    if (refs.personalizePanel) {
      refs.personalizePanel.classList.toggle('is-empty', Boolean(isEmpty));
    }
    if (refs.placeholderContainer) {
      if (isEmpty) {
        refs.placeholderContainer.innerHTML = '';
      }
      refs.placeholderContainer.style.display = isEmpty ? 'none' : '';
    }
    if (refs.placeholderNote) {
      if (typeof message === 'string') {
        refs.placeholderNote.textContent = message;
      } else if (!isEmpty) {
        refs.placeholderNote.textContent = state.placeholderNoteDefault;
      } else if (state.placeholderNoteDefault) {
        refs.placeholderNote.textContent = state.placeholderNoteDefault;
      }
    }
  }

  /* Helpers */
  function getSelectedTemplate() {
    return state.templates.find(t => t.id === state.selectedId) || null;
  }

  function getFilteredTemplates() {
    const ordered = [...state.templates].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!state.searchTerm) return ordered;
    return ordered.filter(template => {
      const haystack = [template.name, template.subject, template.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(state.searchTerm);
    });
  }

  function getCurrentPlaceholderValues() {
    if (!state.selectedId) return {};
    return state.placeholderValuesByTemplate.get(state.selectedId) ?? {};
  }

  function getRenderedSubject(template) {
    return injectPlaceholders(template.subject, getCurrentPlaceholderValues());
  }

  function getRenderedBody(template) {
    return injectPlaceholders(template.body, getCurrentPlaceholderValues());
  }

  function getMissingPlaceholders(template) {
    const placeholders = Array.from(new Set([
      ...extractPlaceholders(template.subject),
      ...extractPlaceholders(template.body),
    ]));
    if (!placeholders.length) return [];
    const values = getCurrentPlaceholderValues();
    return placeholders.filter(name => !values[name] || !values[name].trim());
  }

  function currentFormId() {
    return refs.formFields.id.value || null;
  }

  function showToast(message, variant = 'info') {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.classList.remove('email-template-toast--success', 'email-template-toast--error', 'email-template-toast--warning');
    if (variant === 'success') refs.toast.classList.add('email-template-toast--success');
    if (variant === 'error') refs.toast.classList.add('email-template-toast--error');
    if (variant === 'warning') refs.toast.classList.add('email-template-toast--warning');
    refs.toast.hidden = false;
    clearTimeout(refs.toast._hideTimeout);
    refs.toast._hideTimeout = setTimeout(() => {
      refs.toast.hidden = true;
    }, 4000);
  }
}

/* Template persistence */
function loadTemplates() {
  if (typeof window === 'undefined') return getDefaultTemplates();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultTemplates();
    const parsed = JSON.parse(stored);
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.templates)) {
      return getDefaultTemplates();
    }
    return parsed.templates.map(normalizeTemplate);
  } catch (error) {
    console.warn('Failed to load templates, using defaults.', error);
    return getDefaultTemplates();
  }
}

function saveTemplates(templates) {
  if (typeof window === 'undefined') return;
  const payload = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    templates: templates.map(template => ({
      id: template.id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      tags: [...template.tags],
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      sortOrder: template.sortOrder,
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function ensureTemplateOrder(templates) {
  templates
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .forEach((template, index) => {
      template.sortOrder = index;
      if (!template.createdAt) template.createdAt = Date.now();
      if (!template.updatedAt) template.updatedAt = Date.now();
      if (!Array.isArray(template.tags)) template.tags = [];
    });
}

function loadLastSelectedId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SELECTED_KEY);
}

function getDefaultTemplates() {
  const now = Date.now();
  return DEFAULT_TEMPLATES.map((template, index) => ({
    ...template,
    createdAt: now,
    updatedAt: now,
    sortOrder: index,
  }));
}

function normalizeTemplate(template, index = 0) {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    tags: Array.isArray(template.tags) ? template.tags : [],
    createdAt: template.createdAt ?? Date.now(),
    updatedAt: template.updatedAt ?? Date.now(),
    sortOrder: Number.isFinite(template.sortOrder) ? template.sortOrder : index,
  };
}

function extractPlaceholders(text = '') {
  const pattern = /{{\s*([\w.-]+)\s*}}/g;
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function injectPlaceholders(text = '', values = {}) {
  return text.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => {
    const value = values[key];
    return value != null && value !== '' ? value : `{{${key}}}`;
  });
}

function buildMailtoUrl(subject, body) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(normalizeLineBreaks(body));
  return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
}

function normalizeLineBreaks(text = '') {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'just now';
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const result = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!result) {
        reject(new Error('Copy command failed.'));
      } else {
        resolve();
      }
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error);
    }
  });
}

function generateTemplateId(name, templates) {
  const base = slugify(name);
  let candidate = base;
  let counter = 1;
  const existingIds = new Set(templates.map(t => t.id));
  while (existingIds.has(candidate) || !candidate) {
    candidate = `${base || 'template'}-${counter++}`;
  }
  return candidate;
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
