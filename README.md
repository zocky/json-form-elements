# Json Form Elements

A web component library for building dynamic JSON-based forms with support for complex data structures, multiple submission behaviors, and extensible input types.

## Features

- **JSON-First Approach**: Naturally handles complex data structures including arrays and nested objects
- **Multiple Submission Modes**: Choose between modern API integration, HTML replacement, or traditional form navigation
- **Extensible Input System**: Register custom input types with specialized rendering and behavior
- **Framework-agnostic**: Works with any framework or vanilla JavaScript
- **Built on Web Standards**: Custom Elements + ES Modules + Shadow DOM

## Installation

```html
<script type="module" src="./json-form.js"></script>
````

## Basic Usage

```html
<json-form action="/api/users" method="POST">
  <json-input name="username" type="text" label="Username"></json-input>
  <json-input name="email" type="email" label="Email"></json-input>
  <json-input name="age" type="number" label="Age"></json-input>
  <json-submit>Create User</json-submit>
</json-form>
```

## Core Components

### `<json-form>`

Top-level container that manages form submission and data aggregation.

**Attributes:**

* `action` (required): Submission endpoint URL
* `method`: HTTP method (default: `"POST"`)
* `response`: Submission behavior: `event`, `replace`, or `navigate` (default: `"event"`)

### `<json-input>`

Handles scalar values (strings, numbers, emails).

**Attributes:**

* `name`: Field name in the JSON structure
* `type`: Input type (`text`, `email`, `number`, `select`, or custom types)
* `label`: Display label for the field
* `value`: Initial value (as JSON)

### `<json-inputs>`

Creates an array of scalar values with add/remove controls.

**Attributes:** (same as `<json-input>` plus)

* `no-insert`: Hide the add button
* `no-delete`: Hide remove buttons

### `<json-fieldset>`

Groups fields into a nested object structure.

**Attributes:**

* `name`: Object key name
* `label`: Section heading

### `<json-fieldsets>`

Creates an array of objects with repeatable sections.

**Attributes:** (same as `<json-fieldset>` plus)

* `no-insert`: Hide the add button
* `no-delete`: Hide remove buttons

### `<json-submit>`

Submit button that triggers form submission.

**Attributes:**

* `name`: Button identifier in submission events
* `value`: Additional button data

## Complex Data Example

```html
<json-form action="/api/profiles" response="event">
  <json-input name="name" type="text" label="Full Name"></json-input>
  <json-input name="email" type="email" label="Email"></json-input>
  
  <json-inputs name="skills" type="text" label="Skills"></json-inputs>
  
  <json-fieldsets name="addresses" label="Addresses">
    <json-input name="street" type="text" label="Street"></json-input>
    <json-input name="city" type="text" label="City"></json-input>
    <json-input name="country" type="select" label="Country">
      <option value="us">United States</option>
      <option value="ca">Canada</option>
    </json-input>
  </json-fieldsets>
  
  <json-submit>Save Profile</json-submit>
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

* Uses `fetch()` with JSON data
* Expects `application/json` responses
* Fires JavaScript events for handling results

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

* Uses `fetch()` to submit data
* Expects `text/html` responses
* Replaces target element with response HTML
* Ideal for partial page updates

### Navigate Mode

```html
<json-form action="/legacy-endpoint" response="navigate">
```

* Uses native HTML form submission
* Flattens JSON into key/value pairs compatible with URL-encoded forms
* Browser navigates to response
* Traditional full-page refresh behavior

## Extending Input Types

Register custom input types via `registerType`:

```javascript
import { registerType } from './json-form.js';

registerType('color-picker', {
  render: () => `<input type="color">`,
  getValue: (el) => el.value,
  setValue: (el, value) => el.value = value || '#000000',
  defaultValue: '#000000',
  eventType: 'change',

  // Optional custom methods
  custom: {
    showPicker() {
      this.shadowRoot.querySelector('input').click();
    }
  }
});
```

Usage:

```html
<json-input name="themeColor" type="color-picker" label="Theme Color"></json-input>
```

> **Note:** Your `checkboxes` input type returns **an array of strings**, not an object of booleans.

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

* `registerType(name, definition)` (exported): Register custom input type
* `getType(name)`: Retrieve input type definition

**Properties:**

* `value`: Current form data as JSON object
* `action`: Form submission URL
* `method`: HTTP method
* `response`: Submission mode

**Methods:**

* `submit(buttonDetail)`: Programmatically submit form
* `reset()`: Reset form to initial state

### Input Type Definition

```typescript
interface InputTypeDefinition {
  render(): string;                    // Returns HTML for input element
  getValue(element: Element): any;     // Extracts value from element
  setValue(element: Element, value: any): void; // Sets value to element
  defaultValue: any;                   // Default value for empty inputs
  eventType?: string;                  // DOM event to listen for (default: 'input')
  custom?: object;                     // Custom methods to merge into element
}
```

## Browser Support

Requires browsers with support for:

* Custom Elements
* Shadow DOM
* ES Modules
* Fetch API

## License

LGPL 3.0 License

```
