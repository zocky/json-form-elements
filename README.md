# Json Form Elements

A web component library for building dynamic JSON-based forms with support for complex data structures, multiple submission behaviors, and extensible input types.

## Features

- **JSON-First Approach**: Naturally handles complex data structures including arrays and nested objects
- **Multiple Submission Modes**: Choose between modern API integration, HTML replacement, or traditional form navigation
- **Extensible Input System**: Register custom input types with specialized rendering and behavior
- **Framework Agnostic**: Works with any framework or vanilla JavaScript
- **Web Standards**: Built on Custom Elements and ES modules


## Basic Usage

```html
<script type="module" src="./json-form.js">
  
</script>
```
<json-form action="/api/users" method="POST">
  <h2>Create New User</h2>
  <json-input name="username" type="text" label="Username" class="form-field"></json-input>
  <json-input name="email" type="email" label="Email" class="form-field"></json-input>
  <json-input name="age" type="number" label="Age" class="form-field short"></json-input>
  <json-submit>Create User</json-submit>
</json-form>
```

## Core Components

### `<json-form>`
Top-level container that manages form submission and data aggregation.

**Attributes:**
- `action` (required): Submission endpoint URL
- `method`: HTTP method (default: `"POST"`)
- `response`: Submission behavior: `event`, `replace`, or `navigate` (default: `"event"`)

### `<json-input>`
Handles scalar values (strings, numbers, emails).

**Attributes:**
- `name`: Field name in the JSON structure
- `type`: Input type (`text`, `email`, `number`, `select`, or custom types)
- `label`: Display label for the field
- `value`: Initial value (as JSON)

### `<json-inputs>`
Creates an array of scalar values with add/remove controls.

**Attributes:** (same as `<json-input>` plus)
- `no-insert`: Hide the add button
- `no-delete`: Hide remove buttons

### `<json-fieldset>`
Groups fields into a nested object structure.

**Attributes:**
- `name`: Object key name
- `label`: Section heading

### `<json-fieldsets>`
Creates an array of objects with repeatable sections.

**Attributes:** (same as `<json-fieldset>` plus)
- `no-insert`: Hide the add button  
- `no-delete`: Hide remove buttons

### `<json-submit>`
Submit button that triggers form submission.

**Attributes:**
- `name`: Button identifier in submission events
- `value`: Additional button data

## Complex Data Example

```html
<json-form action="/api/profiles" response="event">
  <div class="form-header">
    <h2>User Profile</h2>
    <p>Complete your profile information below.</p>
  </div>
  
  <section class="basic-info">
    <json-input name="name" type="text" label="Full Name"></json-input>
    <json-input name="email" type="email" label="Email"></json-input>
  </section>
  
  <section class="skills-section">
    <json-inputs name="skills" type="text" label="Skills"></json-inputs>
  </section>
  
  <section class="addresses-section">
    <json-fieldsets name="addresses" label="Addresses">
      <div class="address-row">
        <json-input name="street" type="text" label="Street"></json-input>
        <json-input name="city" type="text" label="City"></json-input>
      </div>
      <json-input name="country" type="select" label="Country">
        <option value="us">United States</option>
        <option value="ca">Canada</option>
      </json-input>
    </json-fieldsets>
  </section>
  
  <div class="form-actions">
    <json-submit>Save Profile</json-submit>
  </div>
</json-form>
```

This generates JSON like:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "skills": ["JavaScript", "HTML", "CSS"],
  "addresses": [
    {
      "street": "123 Main St",
      "city": "Anytown", 
      "country": "us"
    }
  ]
}
```

## Submission Behaviors

### Event Mode (Default)
```html
<json-form action="/api/data" response="event">
```
- Uses `fetch()` with JSON data
- Expects `application/json` responses
- Fires JavaScript events for handling results

**Events:**
```javascript
form.addEventListener('success', (e) => {
  console.log('Success:', e.detail.data, e.detail.response);
});

form.addEventListener('error', (e) => {
  console.error('Error:', e.detail.error);
});
```

### Replace Mode
```html
<json-form action="/update-section" response="replace" target="#content-area">
```
- Uses `fetch()` to submit data
- Expects `text/html` responses  
- Replaces target element with response HTML
- Ideal for partial page updates

### Navigate Mode
```html
<json-form action="/legacy-endpoint" response="navigate">
```
- Uses native HTML form submission
- Encodes JSON as URL-encoded data
- Browser navigates to response
- Traditional full-page refresh behavior

## Extending Input Types

Register custom input types for specialized behavior:

```javascript
import { inputTypeRegistry } from './json-form.js';

inputTypeRegistry.registerType('color-picker', {
  normalize: value => value || '#000000',
  render: () => `<input part="control" type="color">`,
  mount: ({ parts, value }) => { 
    parts.control.value = value;
  },
  on: [
    ['change', 'control', ({ notify, parts }) => notify(parts.control.value)],
  ],
  onValue: ({ value, parts }) => {
    parts.control.value = value;
  },
  onAttr: {
    'disabled': ({ parts, name, value }) => {
      value ? parts.control.setAttribute('disabled', '') : parts.control.removeAttribute('disabled');
    }
  }
});
```

Or extend existing types:
```javascript
inputTypeRegistry.extendType('text', 'color-picker', {
  render: () => `<input part="control" type="color">`,
  normalize: value => value || '#000000',
});
```

Usage:
```html
<json-input name="themeColor" type="color-picker" label="Theme Color"></json-input>
```

## Programmatic Control

### Getting/Setting Values
```javascript
const form = document.querySelector('json-form');

// Get current form data
const data = form.value;

// Set form values programmatically
form.value = {
  name: "Alice",
  email: "alice@example.com",
  skills: ["JavaScript", "TypeScript"],
  addresses: [{ street: "123 Main St", city: "Boston" }]
};

// Reset form
form.value = {};
```

### Dynamic Modification
```javascript
// Add new field
const newField = document.createElement('json-input');
newField.name = 'phone';
newField.type = 'text';
newField.label = 'Phone Number';
form.appendChild(newField);

// Listen for changes
form.addEventListener('change', (e) => {
  console.log('Form changed:', form.value);
});
```

## API Reference

### JsonForm Class

**Static Methods:**
- `inputTypeRegistry.registerType(name, definition)`: Register custom input type
- `inputTypeRegistry.extendType(parent, name, definition)`: Extend existing type
- `inputTypeRegistry.getType(name)`: Retrieve input type definition

**Properties:**
- `value`: Current form data as JSON object
- `action`: Form submission URL
- `method`: HTTP method
- `response`: Submission mode

**Methods:**
- `submit(buttonDetail)`: Programmatically submit form
- `reset()`: Reset form to initial state

### Input Type Definition

```typescript
interface InputTypeDefinition {
  normalize?: (value: any) => any;     // Transform/validate input value
  render: (context: object) => string; // Returns HTML template with parts
  mount?: (context: object) => void;   // Setup logic after rendering
  on?: Array<[string, string, function]>; // Event handlers: [event, part, handler]
  onValue?: (context: object) => boolean | void; // Handle value changes
  onAttr?: Record<string, function>;   // Attribute change handlers
}

// Context object contains:
// - parts: DOM elements by part name
// - value: current value
// - attributes: element attributes
// - notify: function to update value
```

## Browser Support

Requires browsers with support for:
- Custom Elements
- Shadow DOM
- ES Modules
- Fetch API

## License

LGPL 3.0 or later