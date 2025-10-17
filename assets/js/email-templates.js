const STORAGE_KEY = 'emailTemplates.v1';
const LAST_SELECTED_KEY = 'emailTemplates.lastSelectedId';
const VERSION = 2;
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
    toast: card.querySelector('[data-template-toast]'),
    searchInput: card.querySelector('[data-field="search"]'),
    templateList: card.querySelector('[data-template-list]'),
    compose: card.querySelector('[data-compose]'),
    form: card.querySelector('[data-editor-form]'),
    fields: {
      id: card.querySelector('[data-editor-form] [data-field="id"]'),
      name: card.querySelector('[data-field="name"]'),
      subject: card.querySelector('[data-field="subject"]'),
      body: card.querySelector('[data-field="body"]'),
    },
    previewTags: card.querySelector('[data-preview-tags]'),
    saveBtn: card.querySelector('[data-action="save-template"]'),
    launchBtn: card.querySelector('[data-action="launch-outlook"]'),
    previewWarning: card.querySelector('[data-preview-warning]'),
    newTemplateBtn: card.querySelector('[data-action="new-template"]'),
  };

  const editorContainer = card.querySelector('#email-body-editor');
  let quillEditor = null;

  const state = {
    templates: loadTemplates(),
    searchTerm: '',
    filters: [],
    selectedId: loadLastSelectedId(),
    formDirty: false,
  };

  if (editorContainer && window.Quill) {
    // Register custom font sizes
    const Size = Quill.import('formats/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '36px'];
    Quill.register(Size, true);

    // Register custom fonts
    const Font = Quill.import('formats/font');
    Font.whitelist = ['arial', 'times-new-roman', 'courier-new', 'georgia', 'verdana', 'trebuchet', 'comic-sans', 'impact', 'calibri', 'tahoma'];
    Quill.register(Font, true);

    quillEditor = new Quill(editorContainer, {
      theme: 'snow',
      placeholder: 'Format your email here... Bold, colors, lists, etc.',
      modules: {
        toolbar: [
          [{ font: Font.whitelist }, { size: Size.whitelist }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          [{ header: [1, 2, 3, false] }],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['link'],
          ['clean'],
        ],
      },
    });

    quillEditor.on('text-change', () => {
      syncBodyFieldFromEditor();
      state.formDirty = true;
      updateLaunchEnabled();
      updateComposeMeta();
    });
  } else if (editorContainer) {
    console.warn('Quill editor failed to initialize. Email body editing will fall back to raw HTML.');
  }

  ensureTemplateOrder(state.templates);
  if (!state.selectedId || !state.templates.some(t => t.id === state.selectedId)) {
    state.selectedId = state.templates[0]?.id ?? null;
  }

  // Initial render and wiring
  renderTemplateList();
  loadForm(state.selectedId);
  // no tag chips to render
  updateLaunchEnabled();

  // Events
  refs.searchInput?.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderTemplateList();
  });

  refs.templateList?.addEventListener('click', (event) => {
    const del = event.target.closest('[data-action="row-delete"]');
    const dup = event.target.closest('[data-action="row-duplicate"]');
    const moveUp = event.target.closest('[data-action="move-up"]');
    const moveDown = event.target.closest('[data-action="move-down"]');
    if (del || dup || moveUp || moveDown) {
      event.stopPropagation();
      const host = (del || dup || moveUp || moveDown).closest('[data-template-id]');
      const id = host?.dataset.templateId;
      if (!id) return;
      if (del) { handleDeleteTemplate(id); }
      if (dup) { handleCloneTemplate(id); }
      if (moveUp) { moveTemplate(id, 'up'); }
      if (moveDown) { moveTemplate(id, 'down'); }
      return;
    }
    const option = event.target.closest('[data-template-id]');
    if (!option) return;
    if (refs.templateList) {
      refs.templateList.dataset.pendingFocus = 'true';
    }
    selectTemplate(option.dataset.templateId);
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
      refs.templateList.dataset.pendingFocus = 'true';
      selectTemplate(next.dataset.templateId);
    }
  });

  refs.templateList?.addEventListener('focus', event => {
    if (event.target !== refs.templateList) return;
    refs.templateList.dataset.pendingFocus = 'true';
    focusActiveOption({ force: true });
  });

  refs.newTemplateBtn?.addEventListener('click', () => {
    if (state.formDirty && !confirm('Discard your edits?')) return;
    loadForm(null);
  });

  refs.form?.addEventListener('input', () => {
    state.formDirty = true;
    updateLaunchEnabled();
    updateComposeMeta();
  });

  refs.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    persistFromForm();
  });

  refs.saveBtn?.addEventListener('click', () => {
    persistFromForm();
  });

  // Discard removed; Duplicate handled per row

  // Inline small copy buttons near labels
  card.querySelector('[data-action="copy-subject-inline"]')?.addEventListener('click', () => {
    const values = currentFormValues();
    copyToClipboard(values.subject)
      .then(() => showToast('Subject copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy subject. Try selecting and copying manually.', 'error'));
  });
  card.querySelector('[data-action="copy-body-inline"]')?.addEventListener('click', async () => {
    try {
      syncBodyFieldFromEditor();
      const result = await copyRichContent();
      if (result.success) {
        const message = result.method === 'modern'
          ? 'Email body copied with formatting. Paste into Outlook to retain styling.'
          : 'Email body copied as plain text. Formatting will restore after paste.';
        showToast(message, 'success');
      } else {
        showToast('Failed to copy body. Try selecting and copying manually.', 'error');
      }
    } catch (error) {
      showToast('Failed to copy body. Try selecting and copying manually.', 'error');
    }
  });

  refs.launchBtn?.addEventListener('click', async () => {
    syncBodyFieldFromEditor();
    const { subject } = currentFormValues();
    const plainBody = getEditorPlainText();
    const trimmedBody = plainBody.trim();

    if (!subject || !trimmedBody) {
      showToast('Add a subject and email body before sending to Outlook.', 'error');
      return;
    }

    const reminderBody = '[Paste formatted content here - already copied to clipboard]';
    const mailto = buildMailtoUrl(subject, reminderBody);

    try {
      const result = await copyRichContent();
      if (!result.success) {
        showToast('Unable to copy formatted content. Outlook launch cancelled.', 'error');
        return;
      }

      const message = result.method === 'modern'
        ? 'Formatted email copied. Outlook will open - paste with Ctrl+V (Cmd+V on Mac).'
        : 'Plain-text fallback copied. Paste in Outlook to restore formatting.';
      showToast(message, 'success');

      setTimeout(() => {
        window.location.href = mailto;
      }, 800);
    } catch (error) {
      showToast('Unable to copy formatted content. Outlook launch cancelled.', 'error');
    }
  });

  // tag filters removed

  function showToast(message, variant = 'success') {
    if (!refs.toast) return;
    const text = truncate(String(message), 120);
    refs.toast.textContent = text;
    refs.toast.classList.remove('email-template-toast--success', 'email-template-toast--error', 'email-template-toast--warning');
    // All variants now use the same red styling as requested
    refs.toast.classList.add('email-template-toast--success');

    refs.toast.hidden = false;
    // Trigger reflow then animate visible
    void refs.toast.offsetWidth;
    refs.toast.classList.add('is-visible');

    clearTimeout(refs.toast._hideTimeout);
    refs.toast._hideTimeout = setTimeout(() => {
      refs.toast.classList.remove('is-visible');
      const onEnd = () => {
        refs.toast.hidden = true;
        refs.toast.removeEventListener('transitionend', onEnd);
      };
      refs.toast.addEventListener('transitionend', onEnd);
      // Fallback hide in case transitionend doesn't fire
      clearTimeout(refs.toast._fallbackTimeout);
      refs.toast._fallbackTimeout = setTimeout(() => {
        refs.toast.hidden = true;
      }, 400);
    }, 3000);
  }

  // Helpers (inside init)
  function getEditorPlainText() {
    if (quillEditor) {
      return quillEditor.getText();
    }
    return refs.fields.body?.value || '';
  }

  function getEditorHtml() {
    if (quillEditor) {
      const plain = quillEditor.getText().trim();
      if (!plain) {
        return '';
      }
      return quillEditor.getSemanticHTML();
    }
    return refs.fields.body?.value || '';
  }

  function syncBodyFieldFromEditor() {
    if (!refs.fields.body) return;
    refs.fields.body.value = getEditorHtml();
  }

  async function copyRichContent() {
    if (!quillEditor) {
      return { success: false, error: new Error('Editor not initialized') };
    }

    const html = getEditorHtml();
    const plainText = getEditorPlainText();

    if (!plainText.trim()) {
      return { success: false, error: new Error('Nothing to copy') };
    }

    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    const ClipboardItemCtor = (typeof window !== 'undefined' && typeof window.ClipboardItem === 'function')
      ? window.ClipboardItem
      : undefined;

    if (clipboard && clipboard.write && ClipboardItemCtor) {
      try {
        await clipboard.write([
          new ClipboardItemCtor({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          }),
        ]);
        return { success: true, method: 'modern' };
      } catch (err) {
        console.warn('Modern clipboard failed, falling back to legacy:', err);
      }
    }

    try {
      await copyToClipboard(plainText);
      return { success: true, method: 'legacy' };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  function renderTemplateList() {
    if (!refs.templateList) {
      return;
    }
    refs.templateList.innerHTML = '';
    const filtered = getFilteredTemplates(state.templates, state.searchTerm);
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'email-template-alert email-template-alert--warning';
      empty.textContent = 'No templates match your search.';
      refs.templateList.appendChild(empty);
      refs.templateList.removeAttribute('aria-activedescendant');
      delete refs.templateList.dataset.pendingFocus;
      return;
    }
    filtered.forEach((template, index) => {
      const optionId = `email-template-option-${template.id}`;
      const button = document.createElement('div');
      button.className = 'email-template-item';
      button.dataset.templateId = template.id;
      button.setAttribute('role', 'option');
      button.id = optionId;

      if (template.id === state.selectedId) {
        button.classList.add('is-active');
        button.setAttribute('aria-selected', 'true');
        button.tabIndex = 0;
      } else {
        button.tabIndex = -1;
      }
      const isFirst = index === 0;
      const isLast = index === filtered.length - 1;

      const moveControls = document.createElement('div');
      moveControls.className = 'email-template-item__move';
      moveControls.innerHTML = `
        <button class="email-template-move-btn" type="button" data-action="move-up" title="Move up" aria-label="Move template up"${isFirst ? ' disabled' : ''}>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4l6 8H4l6-8z" fill="currentColor"/>
          </svg>
        </button>
        <button class="email-template-move-btn" type="button" data-action="move-down" title="Move down" aria-label="Move template down"${isLast ? ' disabled' : ''}>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 16l-6-8h12l-6 8z" fill="currentColor"/>
          </svg>
        </button>
      `;

      const title = document.createElement('div');
      title.className = 'email-template-item__title';
      title.textContent = template.name;
      const meta = document.createElement('div');
      meta.className = 'email-template-item__meta';
      meta.textContent = template.subject || '';
      const actions = document.createElement('div');
      actions.className = 'email-template-row-actions';
      actions.innerHTML = `
        <button class="email-template-row-btn" type="button" data-action="row-duplicate" title="Duplicate" aria-label="Duplicate">
          <svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\"><path d=\"M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z\" fill=\"currentColor\"/></svg>
        </button>
        <button class=\"email-template-row-btn email-template-row-btn--danger\" type=\"button\" data-action=\"row-delete\" title=\"Delete\" aria-label=\"Delete\">
          <svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\"><path d=\"M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H2V5h4l1-2z\" fill=\"currentColor\"/></svg>
        </button>`;
      button.append(moveControls, title, meta, actions);
      refs.templateList.appendChild(button);
    });

    focusActiveOption();
  }

  function moveTemplate(id, direction) {
    const ordered = [...state.templates].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = ordered.findIndex(t => t.id === id);
    if (currentIndex === -1) return;

    const visible = getFilteredTemplates(state.templates, state.searchTerm);
    const visibleIndex = visible.findIndex(t => t.id === id);
    if (visibleIndex === -1) return;

    const step = direction === 'up' ? -1 : 1;
    const targetVisibleIndex = visibleIndex + step;
    if (targetVisibleIndex < 0 || targetVisibleIndex >= visible.length) return;

    const targetId = visible[targetVisibleIndex].id;
    const [moving] = ordered.splice(currentIndex, 1);
    let targetIndex = ordered.findIndex(t => t.id === targetId);
    if (targetIndex === -1) return;

    if (direction === 'down') {
      targetIndex += 1;
    }

    ordered.splice(targetIndex, 0, moving);
    ordered.forEach((template, orderIndex) => {
      template.sortOrder = orderIndex;
    });

    state.templates = ordered;
    saveTemplates(state.templates);
    if (refs.templateList) {
      refs.templateList.dataset.pendingFocus = 'true';
    }
    renderTemplateList();
    showToast('Template order updated.', 'success');
  }

  function updateComposeMeta() { /* tags removed */ }

  function updateLaunchEnabled() {
    if (!refs.launchBtn) return;
    const subject = refs.fields.subject?.value?.trim() || '';
    const bodyLength = getEditorPlainText().trim().length;
    const has = Boolean(subject && bodyLength);
    refs.launchBtn.disabled = !has;
    if (refs.previewWarning) refs.previewWarning.hidden = true;
  }

  function currentFormId() { return refs.fields.id?.value || null; }
  function currentFormValues() {
    syncBodyFieldFromEditor();
    return {
      id: refs.fields.id?.value || null,
      name: refs.fields.name?.value?.trim() || '',
      subject: refs.fields.subject?.value?.trim() || '',
      body: refs.fields.body?.value || '',
    };
  }

  function loadForm(id) {
    const t = state.templates.find(x => x.id === id) || null;
    refs.fields.id.value = t?.id ?? '';
    refs.fields.name.value = t?.name ?? '';
    refs.fields.subject.value = t?.subject ?? '';
    if (quillEditor) {
      const body = t?.body ?? '';
      if (!body) {
        quillEditor.setText('', 'silent');
      } else if (!body.includes('<')) {
        const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const DeltaCtor = (typeof window !== 'undefined' && window.Quill && typeof window.Quill.import === 'function')
          ? window.Quill.import('delta')
          : null;
        if (DeltaCtor) {
          const lines = normalized.split('\n');
          const delta = lines.reduce((acc, line) => {
            if (line) {
              acc.insert(line);
            }
            acc.insert('\n');
            return acc;
          }, new DeltaCtor());
          quillEditor.setContents(delta, 'silent');
        } else {
          quillEditor.setText(normalized, 'silent');
        }
      } else {
        quillEditor.clipboard.dangerouslyPasteHTML(body, 'silent');
      }
      syncBodyFieldFromEditor();
    } else if (refs.fields.body) {
      refs.fields.body.value = t?.body ?? '';
    }
    // no tags field
    state.formDirty = false;
    state.selectedId = t?.id ?? null;
    if (state.selectedId) localStorage.setItem(LAST_SELECTED_KEY, state.selectedId);
    updateComposeMeta();
    updateLaunchEnabled();
    renderTemplateList();
  }

  function persistFromForm() {
    const { id, name, subject, body } = currentFormValues();
    const hasBody = getEditorPlainText().trim().length > 0;
    if (!name || !subject || !hasBody) {
      showToast('Name, subject, and body are required.', 'error');
      return;
    }
    if (id) {
      const template = state.templates.find(t => t.id === id);
      if (!template) return;
      template.name = name;
      template.subject = subject;
      template.body = body;
      template.tags = template.tags || [];
      template.updatedAt = Date.now();
      saveTemplates(state.templates);
      state.formDirty = false;
      renderTemplateList();
      showToast('Template updated.', 'success');
    } else {
      const template = {
        id: generateTemplateId(name, state.templates),
        name,
        subject,
        body,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sortOrder: state.templates.length ? Math.max(...state.templates.map(t => t.sortOrder)) + 1 : 0,
      };
      state.templates.push(template);
      saveTemplates(state.templates);
      state.formDirty = false;
      if (refs.templateList) {
        refs.templateList.dataset.pendingFocus = 'true';
      }
      loadForm(template.id);
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
    const nextId = state.templates[0]?.id ?? null;
    if (refs.templateList) {
      refs.templateList.dataset.pendingFocus = 'true';
    }
    loadForm(nextId);
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
    if (refs.templateList) {
      refs.templateList.dataset.pendingFocus = 'true';
    }
    loadForm(clone.id);
    showToast('Template cloned.', 'success');
  }

  function selectTemplate(id) { loadForm(id); }

  function focusActiveOption({ force = false } = {}) {
    if (!refs.templateList) return;
    const active = refs.templateList.querySelector('.email-template-item.is-active');
    const shouldFocus = refs.templateList.dataset.pendingFocus === 'true' || force;

    if (active) {
      refs.templateList.setAttribute('aria-activedescendant', active.id);
      if (shouldFocus) {
        active.focus();
      }
    } else {
      refs.templateList.removeAttribute('aria-activedescendant');
    }

    if (shouldFocus) {
      delete refs.templateList.dataset.pendingFocus;
    }

    refs.templateList.querySelectorAll('.email-template-item').forEach(item => {
      item.tabIndex = item.classList.contains('is-active') ? 0 : -1;
    });
  }
}

/* Persistence and helpers (module scope) */
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

function buildMailtoUrl(subject, body) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(normalizeLineBreaks(body));
  return `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
}

function normalizeLineBreaks(text = '') {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
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

function getFilteredTemplates(templates, searchTerm) {
  const ordered = [...templates].sort((a, b) => a.sortOrder - b.sortOrder);
  let out = ordered;
  if (searchTerm) {
    const st = searchTerm.toLowerCase();
    out = out.filter(t => [t.name, t.subject].join(' ').toLowerCase().includes(st));
  }
  return out;
}

function truncate(str, max = 90) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}
