/********************************************************************
 *  tiny helpers
 *******************************************************************/
const quot = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const normalize_attr = (v) => (v == null || v === false) ? null
  : v === true ? ''
    : String(v);

const set_or_remove_attr = (that, attr, value) => {
  value = normalize_attr(value);
  value == null
    ? that.removeAttribute(attr)
    : that.setAttribute(attr, value);
}

const PASS = (part) => ({ parts, name, value }) => set_or_remove_attr(parts[part], name, value);

const inputTypeRegistry = new class {
  #types = Object.create(null);

  registerType(name, def) {
    if (!def.render || typeof def.render !== 'function') {
      throw new Error(`Input type '${name}' must have a render function`);
    }
    this.#types[name] = def;
  }
  extendType(parent, name, def) {
    const base = this.getType(parent);
    if (!base) {
      throw new Error(`Cannot extend unknown parent type '${parent}'`);
    }
    const type = this.#types[name] = { ...base };
    for (const key in def) {
      if (Array.isArray(type[key])) {
        type[key].push(...[def[key]].flat(1));
      } else if (typeof (def[key]) === 'object' && typeof (type[key]) === 'object') {
        type[key] = { ...type[key], ...def[key] };
      } else if (typeof (def[key]) === 'object' || typeof (type[key]) === 'object') {
        throw new Error('Cannot mix object and non-object types');
      } else {
        type[key] = def[key];
      };
    }
  }
  getType(name) {
    const type = this.#types[name] ?? this.#types.text;
    if (!type) {
      throw new Error(`Input type '${name}' not found and no 'text' fallback registered`);
    }
    return type;
  }
}();


// Register basic text input type
inputTypeRegistry.registerType('text', {
  normalize: value => String(value ?? ''),
  render: () => `<input part="control" type="text">`,
  mount: ({ parts, value }) => { parts.control.value = value },
  on: [
    ['input', 'control', ({ notify, parts }) => notify(parts.control.value)],
  ],
  onValue: ({ value, parts }) => parts.control.value = value,
  onAttr: {
    'placeholder': PASS('control'),
    'required': PASS('control'),
  }
});

// Email input
inputTypeRegistry.extendType('text', 'email', {
  render: () => `<input part="control" type="email">`,
});

inputTypeRegistry.extendType('text', 'password', {
  render: () => `<input part="control" type="password">`,
});


inputTypeRegistry.extendType('text', 'number', {
  normalize: value => isNaN(+value) ? null : +value,
  render: () => `<input part="control" type="number">`,
  onAttr: {
    'min': PASS('control'),
    'max': PASS('control'),
    'step': PASS('control'),
  }
});

inputTypeRegistry.extendType('number', 'range', {
  normalize: value => isNaN(+value) ? null : +value,
  render: () => `<input part="control" type="range">`,
})

// Textarea
inputTypeRegistry.extendType('text', 'textarea', {
  render: () => `<textarea part="control"></textarea>`,
  onAttr: {
    'rows': PASS('control'),
    'cols': PASS('control'),
  }
});

// Checkbox input - handles true/false/null
inputTypeRegistry.registerType('checkbox', {
  normalize: value => value === null ? null : !!value,
  render: () => `<input part="control" type="checkbox">`,
  mount: ({ parts, value }) => {
    const checkbox = parts.control;
    if (value === null) {
      checkbox.indeterminate = true;
    } else {
      checkbox.checked = !!value;
    }
  },
  on: [
    ['change', 'control', ({ notify, parts }) => notify(parts.control.checked)],
  ],
  onValue: ({ value, parts }) => {
    const checkbox = parts.control;
    if (value === null) {
      checkbox.indeterminate = true;
      checkbox.checked = false;
    } else {
      checkbox.indeterminate = false;
      checkbox.checked = !!value;
    }
  },
  onAttr: {
    'required': PASS('control'),
    'disabled': PASS('control'),
  }
});

/********************************************************************
 * shared helpers for option-bearing types
 *******************************************************************/
/* return every <option> that the slot actually renders */
const getSlotOptions = (slot) =>
  slot.assignedElements?.({ flatten: true })          // shadow-slotted
      .filter(n => n.matches?.('option')) ||
  Array.from(slot.children).filter(n => n.tagName === 'OPTION'); // fallback

/* clone all slot options into a container (select / div / whatever) */
const cloneOptionsInto = (container, slot) => {
  getSlotOptions(slot).forEach(opt =>
    container.appendChild(opt.cloneNode(true))
  );
};

/********************************************************************
 * Select input - clones options from slot
 *******************************************************************/
inputTypeRegistry.registerType('select', {
  normalize: value => String(value ?? ''),
  render: () => `<select part="control"></select>`,
  mount: ({ parts, value, slot }) => {
    cloneOptionsInto(parts.control, slot);
    parts.control.value = value;
  },
  on: [
    ['change', 'control', ({ notify, parts }) => notify(parts.control.value)],
  ],
  onValue: ({ value, parts }) => parts.control.value = value,
  onAttr: {
    'multiple': PASS('control'),
    'size': PASS('control'),
    'required': PASS('control'),
    'disabled': PASS('control'),
  }
});

/********************************************************************
 * Multiple select variant that returns arrays
 *******************************************************************/
inputTypeRegistry.extendType('select', 'multiselect', {
  normalize: value => Array.isArray(value) ? value : (value ? [String(value)] : []),
  mount: ({ parts, value, slot }) => {
    parts.control.setAttribute('multiple', '');
    cloneOptionsInto(parts.control, slot);

    if (Array.isArray(value)) {
      Array.from(parts.control.options).forEach(opt =>
        opt.selected = value.includes(opt.value)
      );
    }
  },
  on: [
    ['change', 'control', ({ notify, parts }) => {
      const selected = Array.from(parts.control.selectedOptions).map(opt => opt.value);
      notify(selected);
    }],
  ],
  onValue: ({ value, parts }) => {
    if (Array.isArray(value)) {
      Array.from(parts.control.options).forEach(opt =>
        opt.selected = value.includes(opt.value)
      );
    }
  }
});

/********************************************************************
 * Radio buttons - single selection from options
 *******************************************************************/
inputTypeRegistry.registerType('radio', {
  normalize: value => String(value ?? ''),
  render: () => `<div part="control" class="radio-group"></div>`,
  mount: ({ parts, value, slot }) => {
    const container = parts.control;
    const name = `radio_${Math.random().toString(36).slice(2, 11)}`;

    getSlotOptions(slot).forEach(opt => {
      const label = document.createElement('label');
      label.className = 'radio-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = opt.value;
      radio.checked = opt.value === value;

      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt.textContent));
      container.appendChild(label);
    });
  },
  on: [
    ['change', 'control', ({ notify, parts }) => {
      const checked = parts.control.querySelector('input:checked');
      notify(checked ? checked.value : '');
    }],
  ],
  onValue: ({ value, parts }) => {
    parts.control.querySelectorAll('input').forEach(radio =>
      radio.checked = radio.value === value
    );
  },
  onAttr: {
    'required': ({ parts, value }) =>
      parts.control.querySelectorAll('input').forEach(radio =>
        value != null ? radio.setAttribute('required', '') : radio.removeAttribute('required')
      ),
    'disabled': ({ parts, value }) =>
      parts.control.querySelectorAll('input').forEach(radio =>
        value != null ? radio.setAttribute('disabled', '') : radio.removeAttribute('disabled')
      ),
  }
});

/********************************************************************
 * Checkboxes - multiple selection from options
 *******************************************************************/
inputTypeRegistry.extendType('radio', 'checkboxes', {
  normalize: value => Array.isArray(value) ? value : (value ? [String(value)] : []),
  mount: ({ parts, value, slot }) => {
    const container = parts.control;

    getSlotOptions(slot).forEach(opt => {
      const label = document.createElement('label');
      label.className = 'checkbox-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = opt.value;
      checkbox.checked = Array.isArray(value) && value.includes(opt.value);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(opt.textContent));
      container.appendChild(label);
    });
  },
  on: [
    ['change', 'control', ({ notify, parts }) => {
      const checked = Array.from(parts.control.querySelectorAll('input:checked')).map(cb => cb.value);
      notify(checked);
    }],
  ],
  onValue: ({ value, parts }) => {
    parts.control.querySelectorAll('input').forEach(checkbox =>
      checkbox.checked = Array.isArray(value) && value.includes(checkbox.value)
    );
  }
});
/********************************************************************
 *  shared styles  (unchanged)
 *******************************************************************/
const componentStyles = new CSSStyleSheet();
componentStyles.replaceSync(`
  @layer json-form.base;
  @layer json-form.base {
    :host { display:block; margin-bottom:1rem; }
    [part="field"] { display:block; }
    [part="label"] { display:block; margin-bottom:.5rem; font-weight:500; }
    [part="value"] { width:100%; }
    [part="fieldset"] { border:1px solid #ccc; padding:.75rem; }
    [part="legend"] { font-weight:600; padding:0 .25rem; }
  }
`);

/********************************************************************
 *  JsonNode  –  base for every component
 *******************************************************************/

const ATTR_PROPS = Symbol.for('json-form-attr-props');

function WithAttributes(defs, Base = HTMLElement) {
  class Next extends Base {
    static [ATTR_PROPS] = { ...Base[ATTR_PROPS], ...defs };   // merge down the chain
  }
  const attrNames = new Set(Base.observedAttributes);
  // install bare setters/getters
  for (const [prop, {
    get,
    set,
    attr = prop.toLowerCase(),
    normalize = v => v
  }] of Object.entries(defs)) {
    attrNames.add(attr);
    Object.defineProperty(Next.prototype, prop, {
      get: get ?? function get() { return this.getAttribute(attr) ?? ''; },
      set: set ?? function set(v) {
        set_or_remove_attr(this, attr, normalize(v));
      },
      enumerable: true,
      configurable: true
    });
  }
  Next.observedAttributes = [...attrNames];
  return Next;
}

class JsonNode extends WithAttributes({
  label: {
    async onAttr(v) {
      this._labelElement.textContent = v;
    }
  },
  disabled: {
    async onAttr(v) {
      set_or_remove_attr(this._fieldElement, 'inert', v);
    }
  }
}) {

  #mo = null;

  async attributeChangedCallback(n, oldV, newV) {

    const cfg = this.constructor[ATTR_PROPS][n];
    if (!cfg) {
      console.warn(`Unexpected observed attribute ${n} on ${this.constructor.name}`);
      return;
    };
    if (oldV === newV) return;
    await this._shadowReady;
    try {
      await cfg.onAttr?.call(this,newV);
    } catch (e) {
      console.error(`Error in attribute handler for ${n}:`, e);
    }
  }

  // Override in subclasses to handle attributes not in ATTR_PROPS
  onUnhandledAttribute(name, value) { }

  /* ---- public surface ---- */
  get value() { return this.readValue(); }
  set value(v) { return this.writeValue(v); }
  set json(v) { this.value = JSON.parse(v); }
  get json() { return JSON.stringify(this.value); }

  /* ---- lifecycle ---- */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [componentStyles];
    this._shadowReady = new Promise(res => this._resolveShadowReady = res);
  }

  connectedCallback() {
    // setup mutation observer for other attributes
    this.renderShadow();
    this._fieldElement = this.shadowRoot.querySelector('[part="field"]');
    this._labelElement = this.shadowRoot.querySelector('[part="label"]');
    this._valueElement = this.shadowRoot.querySelector('[part="value"]');
    this._slotElement = this.shadowRoot.querySelector('slot');
    console.log('shadow ready', this.constructor.name,this._valueElement.constructor.name);
    this._resolveShadowReady();

    // Observe attributes not in ATTR_PROPS
    this.#mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (!m.attributeName) continue;
        if (this.constructor[ATTR_PROPS]?.[m.attributeName]) continue;

        this.onUnhandledAttribute(m.attributeName, this.getAttribute(m.attributeName));
      }
    });
    this.#mo.observe(this, { attributes: true });

    this.mount();
  }
  disconnectedCallback() {
    this.#mo?.disconnect();
    this.unmount();
  }

  /* ---- hooks for subclasses ---- */
  normalize(v) { return v; }                 // scalar default
  writeValue() { }                             // push value → leaves
  readValue() { }                             // pull leaves → value
  mount() { }                                  // attach listeners
  unmount() { }                                // remove listeners

  // override if needed
  renderShadow() {
    this.shadowRoot.innerHTML = `
      <div part="field">
        <label part="label">${quot(this.label ?? '')}</label>
        <slot hidden></slot>
        <div part="value"></div>
      </div>`;
  }
}


/********************************************************************
 *  JsonInput  –  leaf that uses registry
 *******************************************************************/
class JsonInput extends WithAttributes(
  {
    type: {
      onAttr(v) {

        this.inputType = inputTypeRegistry.getType(v);
        this.renderInput();
      }
    }, value: {
      get() { return this.readValue(); },
      set(v) { this.writeValue(v); },
      onAttr(v) {
        // ignore if already dirty
        if (this._dirty) return;
        this.value = v;
      }
    }, json: {
      get() { return JSON.stringify(this.value); },
      set(v) {
        try {
          this.value = JSON.parse(v);
        } catch (e) {
          this.value = null;
          throw e;
        }
      },
      onAttr(v) {
        // ignore if already dirty
        if (this._dirty) return
        this.json = v;
      }
    }
  }, JsonNode) {


  constructor() {
    super();
    this._inputReady = new Promise(res => this._resolveInputReady = res);

  }

  type = 'text';
  inputType = inputTypeRegistry.getType('text');

  // the truth value for this input
  #value = null;


  _dirty = false;
  #mo = null;

  get #attributeMap() {
    const ret = {};
    for (const attr of this.getAttributeNames()) {
      ret[attr] = this.getAttribute(attr);
    }
    return ret;
  }

  getDefaultValue() {

    let val = null;
    if (this.hasAttribute('value')) {
      val = this.getAttribute('value');
    } else if (this.hasAttribute('json')) {
      try {
        val = JSON.parse(this.getAttribute('json'));
      } catch (e) {
        console.error(e.message, this.getAttribute('json'));
      }
    }
    return this.inputType.normalize ? this.inputType.normalize(val) : val;
  }

  reset() {
    this._dirty = false;
    this.value = this.getDefaultValue();
  }

  connectedCallback() {
    super.connectedCallback();
    this.renderInput();
  }
  // observe attributes on json-input, pass them to the input if not handled by observedAttributes
  async onUnhandledAttribute(name, value) {
    await this._inputReady;
    
    const handler = this.inputType?.onAttr?.[name];
    if (handler) {
      try {
        handler({
          parts: this.parts,
          name,
          value
        });
      } catch (e) {
        console.error(`Error in attribute handler for ${name}:`, e);
      }
    }
  }

  disconnectedCallback() {
    this.#unmountInput();
    super.disconnectedCallback();
  }

  renderInput() {
    console.log('renderInput',this.constructor.name)
    this.#unmountInput();
    const t = this.inputType;
    this._valueElement.innerHTML = t.render({ value: this.#value, attributes: this.#attributeMap });
    this.parts = {};
    for (const el of this._valueElement.querySelectorAll(`[part]`)) {
      this.parts[el.getAttribute('part')] = el;
    };
    this.setupEvents();
    this.#mountInput();
    this._resolveInputReady();
    return true;
  }

  #onUnmountInput = null;
  #mountInput() {
    const t = this.inputType;
    try {
      this.#onUnmountInput = t.mount?.({
        element: this._valueElement,
        attributes: this.#attributeMap,
        parts: this.parts,
        value: this.#value,
        slot: this._slotElement
      });
    } catch (e) {
      this.#onUnmountInput = null;
      console.error('Error in input type mount:', e);
    }
  }

  #unmountInput() {
    try {
      this.#onUnmountInput?.();
    } catch (e) {
      
      console.error('Error in input type unmount:', e);
    }
    this.#onUnmountInput = null;
  }

  unmount() {
    this.#unmountInput();
  }

  #setInternalValue = (v) => {
    // coming up from the input, we must not restart the setter cycle
    this.#value = this.normalizeValue(v);
    this._dirty = true;
  }

  normalizeValue(v) {
    const t = this.inputType;
    return t.normalize ? t.normalize(v) : v;
  }

  async writeValue(v) {
    this.#setInternalValue(v);
    await this._inputReady;
    const t = this.inputType;
    if (typeof t.onValue !== 'function') {
      this.renderInput();
      return;
    }

    try {
      const opts = { value: this.#value, parts: this.parts };
      if (await t.onValue(opts)) this.renderInput();
    } catch (e) {
      console.error('Error in onValue handler:', e);
      // Re-render to maintain consistent UI state
      this.renderInput();
    }
  }

  readValue() {
    return this.#value;
  }

  setupEvents() {
    // these listeners will be automatically removed on re-render along with the elements, when __fieldElement.innerHTML is updated
    const t = this.inputType;
    if (!t.on) return;
    for (const [event, part, handler] of t.on) {
      const el = part ? this.parts[part] : this._valueElement;
      if (!el) {
        throw new Error(`Event handler references unknown part '${part}'`);
      }

      el.addEventListener(event, async (e) => {
        try {
          const opts = { event: e, parts: this.parts, attributes: this.#attributeMap, value: this.#value, notify: this.#setInternalValue };
          if (handler === true || await handler(opts)) this.renderInput();
        } catch (err) {
          console.error(`Error in event handler for ${event} on ${part}:`, err);
        }
      });
    }
  }
}

/********************************************************************
 *  JsonFieldset  –  object element
 *******************************************************************/
class JsonFieldset extends JsonNode {
  renderShadow() {
    this.shadowRoot.innerHTML = `
      <div part="field">
        <label part="label">${quot(this.label ?? '')}</label>
        <div part="value"><slot></slot></div>
      </div>`;
  }

  reset() {
    this._dirty = false;
    this.findControls().forEach(c => c.reset());
  }

  normalize(v) {
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }
  findControls() {
    const out = [];
    const walk = (n) => {
      if (n instanceof JsonNode && n !== this) return out.push(n);
      for (const c of n.children) walk(c);
    };
    walk(this);
    return out;
  }
  writeValue(v) {
    const normalized = this.normalize(v);
    for (const kid of this.findControls()) {
      const k = kid.getAttribute('name');
      if (k) kid.value = normalized[k];
    }
  }
  readValue() {
    const obj = {};
    for (const kid of this.findControls()) {
      const k = kid.getAttribute('name');
      if (k) obj[k] = kid.value;
    }
    return obj;
  }
}


/********************************************************************
 *  JsonList  –  array management base class  (TEMPLATE-VERSION)
 *******************************************************************/
class JsonList extends WithAttributes({
  'no-insert': {},
  'no-delete': {}
}, JsonNode) {
  items = [];
  _template = null;               // live template, rebuilt on slotchange

  /* ---------- shadow DOM ---------- */
  renderShadow() {
    this.shadowRoot.innerHTML = `
      <div part="field">
        <label part="label">${quot(this.label ?? '')}</label>
        <div part="value" class="list-container"></div>
        ${this.hasAttribute('no-insert') ? '' :
          `<button type="button" part="add-button">+ Add Item</button>`}
        <slot hidden></slot>
      </div>`;

    if (!this.hasAttribute('no-insert')) {
      this.shadowRoot.querySelector('[part="add-button"]')
        .addEventListener('click', () => this.addItem());
    }
  }

  /* ---------- life-cycle ---------- */
  connectedCallback() {
    super.connectedCallback();
    this._shadowReady.then(() => {
      this._buildTemplate();           // initial template
      this.renderItems();              // first render
      // watch for future light-dom changes
      this.shadowRoot.querySelector('slot')
        .addEventListener('slotchange', () => this._rebuildAll());
    });
  }

  /* ---------- template management ---------- */
  _buildTemplate() {
    this._template = this.createTemplate();
    if (!this._template) {
      throw new Error(`${this.constructor.name}.createTemplate() must return a template element`);
    }
  }

  createTemplate() {                     // subclasses override
    throw new Error('Subclasses must implement createTemplate()');
  }

  _rebuildAll() {
    // rebuild template, then re-create every item from it
    this._buildTemplate();
    const current = this.readValue();
    this.writeValue(current);
  }

  /* ---------- value flow ---------- */
  normalize(v) {
    return Array.isArray(v) ? v : [];
  }

  createItem(v) {
       const item = this._cloneTemplate();
      this.forwardItemAttributes(item);
      item.value = v;
      return item;
  }

  writeValue(v) {
    const norm = this.normalize(v);
    this.items.length = 0;
    norm.forEach(val => {
      const item = this.createItem(val);
      this.items.push(item);
    });
    this.renderItems();
  }

  readValue() {
    return this.items.map(item => item.value);
  }

  /* ---------- item management ---------- */
  addItem(value) {
    const item = this.createItem(value)
    this.items.push(item);
    this.renderItems();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.renderItems();
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /* ---------- cloning ---------- */
  _cloneTemplate() {
    const node = this._template.cloneNode(true);
    // ensure custom elements inside are upgraded
    this.ownerDocument.defaultView.customElements.upgrade(node);
    return node;
  }

  /* ---------- rendering ---------- */
  async renderItems() {
    await this._shadowReady;
    const container = this._valueElement;
    if (!container) return;

    container.innerHTML = '';
    this.items.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.setAttribute('part', 'list-item');
      wrap.appendChild(item);

      item.addEventListener('change', () =>
        this.dispatchEvent(new Event('change', { bubbles: true }))
      );

      if (!this.hasAttribute('no-delete')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '×';
        btn.setAttribute('part', 'delete-button');
        btn.addEventListener('click', () => this.removeItem(idx));
        wrap.appendChild(btn);
      }
      container.appendChild(wrap);
    });
  }

  /* ---------- helpers ---------- */
  forwardItemAttributes(item) {
    // apply *current* host attributes (except list-specific ones)
    const listProps = Object.keys(this.constructor[ATTR_PROPS] || {});
    for (const attr of this.getAttributeNames()) {
      if (!listProps.includes(attr) && attr !== 'name' && attr !== 'label') {
        item.setAttribute(attr, this.getAttribute(attr));
      }
    }
  }
}

/********************************************************************
 *  JsonInputs  –  array of inputs
 *******************************************************************/
class JsonInputs extends JsonList {
  createTemplate() {
    // build from current host attributes
    const tpl = document.createElement('json-input');
    for (const attr of this.getAttributeNames()) {
      if (attr !== 'name' && attr !== 'label') {
        tpl.setAttribute(attr, this.getAttribute(attr));
      }
    }
    return tpl;
  }
}

/********************************************************************
 *  JsonFieldsets  –  array of fieldsets
 *******************************************************************/
class JsonFieldsets extends JsonList {
  createTemplate() {
    /* 1.  read the nodes that the **slot** contains right now */
    const slot = this._slotElement;
    const source = slot.assignedElements?.({ flatten: true }).length
      ? slot.assignedElements({ flatten: true })
      : Array.from(this.children);          // fallback before slotchange

    /* 2.  create a detached fieldset */
    const fs = document.createElement('json-fieldset');
    //fs.setAttribute('exportparts', 'field,label,value'); // optional

    /* 3.  clone the nodes, **do not move** the originals */
    source.forEach(n => fs.appendChild(n.cloneNode(true)));

    return fs;
  }
}
/********************************************************************
 *  JsonForm  –  form
 *******************************************************************/
class JsonForm extends WithAttributes(
  {
    action:  { /* required, no default */ },
    method:  { normalize: v => (v || 'POST').toUpperCase() },
    response:{ normalize: v => ['replace','navigate'].includes(v)? v : v||'event' },
    target:  {},                     // id of element to replace (replace mode)
    enctype: { normalize: v => v||'application/json' },
    jsonfield:{ normalize: v => v||'json' }, // urlencoded field name (navigate mode)
    src:     {}                     // URL to fetch initial JSON
  },
  JsonFieldset
) {
  #hydrated = false;
  #ctrl     = new AbortController();

  /* ---- lifecycle ---- */
  connectedCallback() {
    super.connectedCallback();
    this.#hydrate();
  }
  disconnectedCallback() { this.#ctrl.abort(); }

  /* ---- initial data ---- */
  async #hydrate() {
    if (this.#hydrated) return;
    const tpl = this.querySelector(':scope > template[json-value]');
    if (tpl) { this.value = JSON.parse(tpl.innerHTML.trim()); this.#hydrated=true; return; }
    const u = this.getAttribute('src');
    if (u) { await fetch(u,{signal:this.#ctrl.signal}).then(r=>r.json()).then(d=>this.value=d).catch(()=>{}); this.#hydrated=true; return; }
    this.#hydrated = true;
  }

  /* ---- submission ---- */
  async submit(buttonDetail={}) {
    const data = this.value;                       // gathered JSON
    const {action,method,response,target,enctype,jsonfield} = this;

    /* ---------- navigate mode ---------- */
    if (response==='navigate') {
      const form = document.createElement('form');
      form.method = method;
      form.action = action;
      form.style.display='none';
      document.body.appendChild(form);

      const append = (k,v)=>{ const i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; form.appendChild(i); };

      if (enctype==='application/json') {          // send raw JSON
        append(jsonfield, JSON.stringify(data));
      } else {                                     // flatten to foo.bar=baz
        const flat = (obj,prefix='')=>{
          for(const [k,v] of Object.entries(obj)){
            const key = prefix? `${prefix}.${k}` : k;
            if(Object(v)===v && !Array.isArray(v)) flat(v,key);
            else if(Array.isArray(v)) v.forEach((x,i)=>flat(x,`${key}[${i}]`));
            else append(key, v===null?'':String(v));
          }
        };
        flat(data);
      }
      form.submit();
      form.remove();
      return;
    }

    /* ---------- fetch modes (event / replace) ---------- */
    const opts = {
      method,
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...data, ...buttonDetail})
    };
    const res = await fetch(action, opts);
    const payload = res.headers.get('content-type')?.includes('application/json')
                  ? await res.json()
                  : await res.text();

    /* fire events */
    if (res.ok) {
      this.dispatchEvent(new CustomEvent('success',{detail:{data,response:payload},bubbles:true}));
    } else {
      this.dispatchEvent(new CustomEvent('error',{detail:{error:payload},bubbles:true}));
      throw new Error(payload);
    }

    /* replace mode */
    if (response==='replace') {
      const el = this.getRootNode().getElementById?.(target) ?? document.getElementById(target) ?? this;
      el.outerHTML = payload;
    }
    return payload;
  }
}

/*********************************************************************
 *  JsonSubmit  –  button
 *******************************************************************/

class JsonSubmit extends WithAttributes({
  name:{},
  value:{},
  disabled:{ normalize: v => v != null }
}, HTMLElement) {

  constructor(){
    super()
      .attachShadow({mode:'open'})
      .innerHTML = `<button part="button" type="button"><slot></slot></button>`;
    this.btn = this.shadowRoot.querySelector('button');
  }

  findForm(){
    let p = this.parentElement;
    while(p){
      if(p instanceof JsonForm) return p;
      p = p.parentElement;
    }
  }

  connectedCallback(){
    this.btn.addEventListener('click', () =>
      this.findForm()?.submit({ name:this.name, value:this.value })
    );
  }

  attributeChangedCallback(_,__,val){
    this.btn && (this.btn.disabled = this.disabled);
  }
}

/*************************************************************
 *  registration
 */
    customElements.define('json-input', JsonInput);
    customElements.define('json-fieldset', JsonFieldset);
    customElements.define('json-inputs', JsonInputs);
    customElements.define('json-fieldsets', JsonFieldsets);
    customElements.define('json-form', JsonForm);
    customElements.define('json-submit', JsonSubmit);
 