# Coding Standards

## Table of Contents

- [1. Overview](#1-overview)
- [2. TypeScript Standards](#2-typescript-standards)
  - [2.1. Naming Conventions](#21-naming-conventions)
  - [2.2. Code Style](#22-code-style)
  - [2.3. Type Safety](#23-type-safety)
  - [2.4. Variable Declarations](#24-variable-declarations)
  - [2.5. Unused Variables](#25-unused-variables)
- [3. CSS Standards](#3-css-standards)
  - [3.1. Naming Conventions](#31-naming-conventions)
  - [3.2. Custom Properties](#32-custom-properties)
  - [3.3. Code Style](#33-code-style)
  - [3.4. Color Notation](#34-color-notation)
  - [3.5. Obsidian Native CSS Classes](#35-obsidian-native-css-classes)
- [4. Obsidian-Specific Guidelines](#4-obsidian-specific-guidelines)
- [5. Obsidian UI Guidelines](#5-obsidian-ui-guidelines)
  - [5.1. Sentence Case Requirement](#sentence-case-requirement)
  - [5.2. Proper Noun Exceptions](#proper-noun-exceptions)
  - [5.3. Settings Headings](#settings-headings)
  - [5.4. Use .setHeading() for Headings](#use-setheading-for-headings)
- [6. Linting Commands](#6-linting-commands)
- [7. Common Issues and Solutions](#7-common-issues-and-solutions)

---

## 1. Overview

This document defines coding standards for Charted Roots to ensure consistency and maintainability. These standards are enforced by ESLint (TypeScript) and Stylelint (CSS).

**Key Principles:**
- Write code that passes linting before committing
- Follow Obsidian API best practices
- Maintain consistent naming across the codebase
- Prioritize readability and type safety

---

## 2. TypeScript Standards

### 2.1. Naming Conventions

#### Files and Directories
- **Files**: Use kebab-case: `person-note-writer.ts`, `family-graph.ts`
- **Directories**: Use kebab-case: `src/core/`, `src/ui/`

#### Code Identifiers

| Type | Convention | Example |
|------|------------|---------|
| **Interfaces** | PascalCase | `PersonData`, `CanvasRootsSettings` |
| **Classes** | PascalCase | `ControlCenterModal`, `PersonPicker` |
| **Functions** | camelCase | `createPersonNote()`, `generateCrId()` |
| **Variables** | camelCase | `frontmatter`, `spouseValues` |
| **Constants** | SCREAMING_SNAKE_CASE | `DEFAULT_SETTINGS`, `MAX_DEPTH` |
| **Type Parameters** | Single uppercase letter or PascalCase | `T`, `TNode`, `PersonType` |

#### Settings Properties

**IMPORTANT: Use camelCase for all settings properties, NOT Sentence Case.**

```typescript
// ✅ CORRECT
export interface CanvasRootsSettings {
  defaultNodeWidth: number;
  horizontalSpacing: number;
  autoGenerateCrId: boolean;
  peopleFolder: string;
}

// ❌ WRONG - Do NOT use Sentence Case or spaces
export interface CanvasRootsSettings {
  "Default Node Width": number;  // Never do this!
  horizontal_spacing: number;     // Avoid snake_case in TS
}
```

**Settings UI Display:**
- Use `.setName()` for user-facing labels with **sentence case** (per Obsidian style guide)
- Use `.setDesc()` for descriptions in sentence case

```typescript
// ✅ CORRECT - Sentence case for labels
new Setting(containerEl)
  .setName('Default node width')           // Sentence case (lowercase after first word)
  .setDesc('Width of person nodes in pixels')  // Sentence case
  .addText(text => text
    .setValue(String(this.plugin.settings.defaultNodeWidth))  // camelCase property

// ❌ WRONG - Title Case
new Setting(containerEl)
  .setName('Default Node Width')           // Title Case - Don't do this!
  .setDesc('Width of person nodes in pixels')
```

**Reference:** [Obsidian Style Guide - Sentence case](https://docs.obsidian.md/Contributing+to+Obsidian/Style+guide#Sentence+case)

### 2.2. Code Style

#### Indentation and Formatting
- **Indentation**: Use tabs (configured in `.editorconfig`)
- **Line Length**: Aim for 100 characters maximum
- **Quotes**: Prefer single quotes for strings
- **Semicolons**: Always use semicolons

#### Function Declarations
```typescript
// ✅ Prefer arrow functions for callbacks
const handleClick = (event: MouseEvent): void => {
  // ...
};

// ✅ Use async/await syntax
async function createPersonNote(
  app: App,
  person: PersonData
): Promise<TFile> {
  // ...
}

// ✅ Document complex functions with JSDoc
/**
 * Create a person note with YAML frontmatter
 *
 * @param app - Obsidian app instance
 * @param person - Person data
 * @returns The created TFile
 */
export async function createPersonNote(/* ... */) {
  // ...
}
```

#### Import Organization
```typescript
// ✅ Group imports: external → Obsidian → internal
import { App, TFile, normalizePath } from 'obsidian';
import { generateCrId } from './uuid';
import { getLogger } from './logging';
```

### 2.3. Type Safety

#### Avoid `any`
```typescript
// ❌ AVOID
const frontmatter: Record<string, any> = {};

// ✅ PREFER - Be specific
interface Frontmatter {
  cr_id: string;
  name?: string;
  father?: string;
  mother?: string;
  born?: string;
  died?: string;
}
const frontmatter: Frontmatter = { cr_id: crId };

// ✅ ACCEPTABLE - For truly dynamic data, use unknown
const rawData: unknown = JSON.parse(content);
```

**ESLint Rule:** `@typescript-eslint/no-explicit-any: "warn"`

If you MUST use `any`, add a comment explaining why:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynamicData: Record<string, any> = {};  // Needed for YAML serialization
```

#### Type Annotations
```typescript
// ✅ Always annotate function parameters and return types
function calculateAge(birthDate: string): number | null {
  // ...
}

// ✅ Annotate complex object literals
const config: LayoutConfig = {
  width: 200,
  height: 100,
  spacing: { horizontal: 50, vertical: 100 }
};
```

### 2.4. Variable Declarations

#### Use `const` by Default
```typescript
// ✅ CORRECT - Use const for values that don't change
const crId = generateCrId();
const files = app.vault.getMarkdownFiles();

// ✅ CORRECT - Use let only when reassigning
let spouseValues: string[] = [];
spouseValues = extractSpouseValues(frontmatter);

// ❌ WRONG - Never use var
var fileName = 'test.md';  // ESLint error: no-var
```

**ESLint Rules:**
- `prefer-const: "error"` - Use const when variable is never reassigned
- `no-var: "error"` - Never use var

### 2.5. Unused Variables

#### Prefix with Underscore
```typescript
// ✅ CORRECT - Prefix unused params with _
function processNode(
  node: PersonNode,
  _index: number,      // Unused parameter
  _array: PersonNode[]  // Unused parameter
): void {
  console.log(node.name);
}

// ✅ CORRECT - Use destructuring to omit unused values
const { name, birthDate } = person;  // Don't destructure unneeded fields

// ❌ WRONG - Don't declare unused variables
const healthBar = createHealthBar();  // ESLint error if never used
```

**ESLint Rule:**
```json
"@typescript-eslint/no-unused-vars": [
  "error",
  {
    "args": "none",
    "argsIgnorePattern": "^_",
    "varsIgnorePattern": "^_"
  }
]
```

#### Remove Dead Code
```typescript
// ❌ WRONG - Don't leave commented-out code
// const oldValue = person.name;
// console.log(oldValue);

// ✅ CORRECT - Remove or use version control for history
```

---

## 3. CSS Standards

### 3.1. Naming Conventions

#### BEM Methodology
All CSS classes MUST follow BEM (Block__Element--Modifier) with project prefix:

**Pattern:** `(cr|crc|canvas-roots)-[block](__[element])?(--[modifier])?`

```css
/* ✅ CORRECT - Block */
.cr-modal-container { }
.crc-card { }

/* ✅ CORRECT - Block + Element */
.cr-card__header { }
.crc-card__title { }
.cr-nav-item__icon { }

/* ✅ CORRECT - Block + Modifier */
.cr-btn--primary { }
.crc-nav-item--active { }

/* ✅ CORRECT - Block + Element + Modifier */
.cr-nav-item__icon--disabled { }

/* ❌ WRONG - Missing prefix */
.modal-container { }  /* Stylelint error */

/* ❌ WRONG - Camel case */
.crModalContainer { }  /* Stylelint error */

/* ❌ WRONG - Sentence case or spaces */
.cr-modal container { }  /* Stylelint error */
```

**Allowed Prefixes:**
- `cr-` (Charted Roots) - Short prefix
- `crc-` (Charted Roots Component) - Alternate short prefix
- `canvas-roots-` - Long form (use sparingly)

#### Class Naming Examples

| Component | Class Name |
|-----------|------------|
| Modal container | `.cr-modal-container` |
| Card header | `.cr-card__header` |
| Primary button | `.cr-btn--primary` |
| Active nav item | `.cr-nav-item--active` |
| Person picker | `.cr-person-picker` |

### 3.2. Custom Properties

#### Variable Naming
Custom properties (CSS variables) MUST use kebab-case with prefix:

**Pattern:** `(md|cr)-[name]`

```css
/* ✅ CORRECT - Material Design variables */
--md-primary-color: #3498db;
--md-surface-elevation: 2;

/* ✅ CORRECT - Charted Roots variables */
--cr-node-width: 200px;
--cr-spacing-horizontal: 50px;

/* ❌ WRONG - Missing prefix */
--modal-width: 800px;  /* Stylelint error */

/* ❌ WRONG - Camel case */
--crModalWidth: 800px;  /* Stylelint error */

/* ❌ WRONG - Using Obsidian variables directly */
/* These are OK to USE but not to DEFINE in your CSS */
--background-primary: #fff;  /* Only use existing Obsidian vars */
```

**Exception:** You can USE Obsidian's built-in CSS variables:

```css
/* ✅ CORRECT - Using Obsidian variables */
.cr-modal {
  background: var(--background-primary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
}
```

**Overrides for specific files:**
- `styles/variables.css` - Custom property pattern not enforced
- `styles/theme.css` - Selector class pattern not enforced

### 3.3. Code Style

#### General Rules
```css
/* ✅ CORRECT - Lowercase everything */
.cr-button {
  color: #3498db;
  font-family: sans-serif;
}

/* ✅ CORRECT - Double quotes for strings */
.cr-icon::before {
  content: "→";
}

/* ✅ CORRECT - Shorthand hex colors */
color: #fff;  /* Not #ffffff */

/* ✅ CORRECT - Zero values don't need units */
margin: 0;  /* Not 0px */

/* ❌ WRONG - Redundant values in shorthand */
padding: 0 24px 24px 24px;  /* Use: padding: 0 24px 24px; */
```

#### Spacing and Line Breaks
```css
/* ✅ CORRECT - Empty line before declarations */
.cr-card {
  padding: 16px;

  background: var(--background-secondary);
  border-radius: 8px;
}

/* ✅ CORRECT - Empty line before rules */
.cr-card__header {
  font-weight: bold;
}

.cr-card__content {
  padding: 8px;
}
```

#### Nesting Depth
```css
/* ✅ CORRECT - Max 3 levels */
.cr-modal {
  .cr-modal__content {
    .cr-modal__header {
      /* This is the maximum depth */
    }
  }
}

/* ❌ WRONG - Exceeds max depth */
.cr-modal {
  .cr-level1 {
    .cr-level2 {
      .cr-level3 {
        .cr-level4 { /* Stylelint error */ }
      }
    }
  }
}
```

**Stylelint Rule:** `max-nesting-depth: 3`

### 3.4. Color Notation

#### Modern Color Functions
```css
/* ✅ CORRECT - Modern notation with percentages */
background: rgb(0 0 0 / 12%);
box-shadow: 0 1px 3px rgb(0 0 0 / 24%);

/* ❌ WRONG - Legacy notation with decimals */
background: rgba(0, 0, 0, 0.12);  /* Stylelint error */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);  /* Stylelint error */
```

**Stylelint Rules:**
- `color-function-notation: "modern"`
- `alpha-value-notation: "percentage"`

### 3.5. Obsidian Native CSS Classes

#### Prefer Native Classes Over Custom Styling

When Obsidian provides a native CSS class for standard UI elements, prefer using it alone rather than layering custom classes on top:

```typescript
// ✅ CORRECT - Use Obsidian's native dropdown class only
select.className = 'dropdown';

// ❌ AVOID - Custom class layered with native class
select.className = 'cr-source-select dropdown';
```

**Rationale:**
- Ensures consistency with Obsidian's look and feel across themes
- Respects user themes and CSS snippets that target native classes
- Avoids CSS specificity conflicts between custom and native styling
- Reduces maintenance burden when Obsidian updates its styling
- Works correctly across different platforms (Windows, macOS, Linux/GTK)

**When to Use Custom Classes:**
- Container elements that need custom layout (flexbox, grid)
- Elements that don't have an Obsidian equivalent
- Additional styling that doesn't conflict with native behavior

**Common Obsidian Native Classes:**

| Element | Class | Notes |
|---------|-------|-------|
| Select dropdown | `dropdown` | Use alone, don't override `appearance` |
| Text input | `text-input` | Standard text fields |
| Button | `mod-cta` | Call-to-action button modifier |
| Setting row | `setting-item` | Settings panel rows |
| Clickable icon | `clickable-icon` | Icon buttons |

**Example - Dropdown in a Custom Container:**

```typescript
// ✅ CORRECT - Custom class on container, native class on element
const container = containerEl.createDiv({ cls: 'cr-source-picker' });
const select = container.createEl('select', { cls: 'dropdown' });
```

```css
/* Custom layout on container only */
.cr-source-picker {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Don't style the dropdown itself - let Obsidian handle it */
```

---

## 4. Obsidian-Specific Guidelines

This section documents critical requirements from [Obsidian's Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) that must be followed for plugin approval.

### General Best Practices

#### Avoid Global App Instance

**Rule:** Never use the global `app` object. Always use `this.app` from your plugin instance.

```typescript
// ❌ WRONG - Global app instance
const file = app.vault.getAbstractFileByPath(path);

// ✅ CORRECT - Plugin instance reference
export default class MyPlugin extends Plugin {
  async onload() {
    const file = this.app.vault.getAbstractFileByPath(path);
  }
}
```

**Why:** The global `app` object (`window.app`) is for debugging only and may be removed in future versions.

#### Avoid Unnecessary Console Logging

```typescript
// ❌ WRONG - Excessive logging
console.log('Plugin loaded');
console.log('Processing file:', file.name);
console.log('Done');

// ✅ CORRECT - Only log errors or use structured logging
if (error) {
  console.error('Failed to process file:', error);
}

// ✅ BETTER - Use structured logging system
const logger = getLogger('MyComponent');
logger.error('Failed to process file', error);
```

**Rule:** Developer console should only show error messages by default. Avoid debug/info logging in production.

### Security

#### Avoid `innerHTML`, `outerHTML`, `insertAdjacentHTML`

**CRITICAL:** Building DOM from user input using these methods creates XSS vulnerabilities.

```typescript
// ❌ WRONG - Security vulnerability!
function showName(name: string) {
  let container = document.querySelector('.my-container');
  container.innerHTML = `<div><b>Your name is: </b>${name}</div>`;
  // If name = "<script>alert('XSS')</script>", this executes!
}

// ✅ CORRECT - Use DOM API or Obsidian helpers
function showName(name: string) {
  let container = document.querySelector('.my-container');
  let div = container.createDiv();
  div.createEl('b', { text: 'Your name is: ' });
  div.appendText(name);  // Safe - text is escaped
}

// ✅ BETTER - Obsidian createEl helper
containerEl.createDiv({ cls: 'my-container' }, (div) => {
  div.createEl('b', { text: 'Your name is: ' });
  div.appendText(name);
});
```

**To cleanup:** Use `el.empty()` instead of setting `innerHTML = ''`.

### Workspace API

#### Avoid `workspace.activeLeaf`

```typescript
// ❌ WRONG - Direct access to activeLeaf
const leaf = this.app.workspace.activeLeaf;

// ✅ CORRECT - Use getActiveViewOfType()
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) {
  // view is guaranteed to be MarkdownView or null
}

// ✅ CORRECT - For editor access
const editor = this.app.workspace.activeEditor?.editor;
if (editor) {
  // Safe to use editor
}
```

#### Avoid Managing References to Custom Views

```typescript
// ❌ WRONG - Creates memory leaks
export default class MyPlugin extends Plugin {
  private view: MyCustomView;

  onload() {
    this.registerView(MY_VIEW_TYPE, () => this.view = new MyCustomView());
  }
}

// ✅ CORRECT - Let Obsidian manage the reference
export default class MyPlugin extends Plugin {
  onload() {
    this.registerView(MY_VIEW_TYPE, () => new MyCustomView());
  }

  // Access view when needed
  getMyView(): MyCustomView | null {
    const leaves = this.app.workspace.getLeavesOfType(MY_VIEW_TYPE);
    if (leaves.length > 0 && leaves[0].view instanceof MyCustomView) {
      return leaves[0].view;
    }
    return null;
  }
}
```

### Vault API

#### Prefer Editor API over `Vault.modify` for Active Files

```typescript
// ❌ WRONG - Loses cursor position, selection, folded content
const file = this.app.workspace.getActiveFile();
const content = await this.app.vault.read(file);
const newContent = content.replace('old', 'new');
await this.app.vault.modify(file, newContent);

// ✅ CORRECT - Preserves editor state
const editor = this.app.workspace.activeEditor?.editor;
if (editor) {
  const content = editor.getValue();
  const newContent = content.replace('old', 'new');
  editor.setValue(newContent);
}
```

#### Prefer `Vault.process` over `Vault.modify` for Background Edits

```typescript
// ❌ WRONG - Can conflict with other plugins
const content = await this.app.vault.read(file);
const newContent = content.replace('old', 'new');
await this.app.vault.modify(file, newContent);

// ✅ CORRECT - Atomic, conflict-free
await this.app.vault.process(file, (content) => {
  return content.replace('old', 'new');
});
```

**Why:** `process()` is atomic and prevents conflicts when multiple plugins edit the same file.

#### Prefer `FileManager.processFrontMatter` for Frontmatter

```typescript
// ❌ WRONG - Manual YAML parsing
const content = await this.app.vault.read(file);
const match = content.match(/^---\n([\s\S]*?)\n---/);
const yaml = parseYAML(match[1]);
yaml.newField = 'value';
const newContent = content.replace(match[0], `---\n${stringifyYAML(yaml)}\n---`);
await this.app.vault.modify(file, newContent);

// ✅ CORRECT - Atomic, consistent YAML formatting
await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
  frontmatter.newField = 'value';
});
```

**Benefits:**
- Atomic (no conflicts)
- Consistent YAML layout
- Automatic error handling

#### Prefer Vault API over Adapter API

```typescript
// ❌ AVOID - Slower, no safety guarantees
const content = await this.app.vault.adapter.read(path);
await this.app.vault.adapter.write(path, content);

// ✅ PREFER - Cached, safe from race conditions
const file = this.app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  const content = await this.app.vault.read(file);
  await this.app.vault.modify(file, content);
}
```

**Benefits of Vault API:**
- **Performance:** Caching layer speeds up reads
- **Safety:** Serial operations prevent race conditions

#### Avoid Iterating All Files to Find by Path

```typescript
// ❌ WRONG - O(n) performance, slow on large vaults
const file = this.app.vault.getFiles().find(f => f.path === filePath);

// ✅ CORRECT - O(1) lookup
const file = this.app.vault.getFileByPath(filePath);
const folder = this.app.vault.getFolderByPath(folderPath);

// ✅ CORRECT - When you don't know if it's a file or folder
const abstractFile = this.app.vault.getAbstractFileByPath(path);
if (abstractFile instanceof TFile) {
  // It's a file
} else if (abstractFile instanceof TFolder) {
  // It's a folder
}
```

#### Use `normalizePath()` for User-Defined Paths

```typescript
import { normalizePath } from 'obsidian';

// ❌ WRONG - Platform-specific issues, unsafe characters
const path = userInput;  // Could be "//my-folder\file"
const file = this.app.vault.getAbstractFileByPath(path);

// ✅ CORRECT - Clean, safe, cross-platform
const path = normalizePath(userInput);  // Returns "my-folder/file"
const file = this.app.vault.getAbstractFileByPath(path);
```

**What `normalizePath()` does:**
- Cleans forward/backward slashes
- Removes leading/trailing slashes
- Replaces non-breaking spaces with regular spaces
- Normalizes Unicode characters

### Resource Management

#### Clean Up Resources in `onunload()`

```typescript
// ✅ CORRECT - Use register methods for automatic cleanup
export default class MyPlugin extends Plugin {
  onload() {
    // Auto-cleaned when plugin unloads
    this.registerEvent(
      this.app.vault.on('create', this.onCreate)
    );

    this.addCommand({
      id: 'my-command',
      name: 'My command',
      callback: () => { }
    });
  }

  onCreate = (file: TAbstractFile) => {
    // Event handler
  }
}

// ❌ WRONG - Manual cleanup required
export default class MyPlugin extends Plugin {
  private eventRef: EventRef;

  onload() {
    this.eventRef = this.app.vault.on('create', this.onCreate);
  }

  onunload() {
    this.app.vault.offref(this.eventRef);  // Must remember to clean up
  }
}
```

**Exception:** Don't clean up resources that are automatically garbage-collected (like DOM event listeners on elements that will be removed).

#### Don't Detach Leaves in `onunload`

```typescript
// ❌ WRONG - Leaves won't restore to original position on update
onunload() {
  this.app.workspace.detachLeavesOfType(MY_VIEW_TYPE);
}

// ✅ CORRECT - Let Obsidian handle leaf lifecycle
onunload() {
  // Don't detach leaves
}
```

**Why:** When plugin updates, leaves are automatically reinitialized at their original position.

### Commands

#### Avoid Default Hotkeys

```typescript
// ❌ WRONG - Can conflict with user settings or other plugins
this.addCommand({
  id: 'my-command',
  name: 'My command',
  hotkeys: [{ modifiers: ['Mod'], key: 'k' }],  // Don't do this
  callback: () => { }
});

// ✅ CORRECT - Let users assign their own hotkeys
this.addCommand({
  id: 'my-command',
  name: 'My command',
  callback: () => { }
});
```

**Why:**
- Different hotkeys available on different OS
- May conflict with user's existing configuration
- May conflict with other plugins

#### Use Appropriate Callback Types

```typescript
// ✅ Use callback for unconditional commands
this.addCommand({
  id: 'always-runs',
  name: 'Always runs',
  callback: () => {
    // Always executes
  }
});

// ✅ Use checkCallback for conditional commands
this.addCommand({
  id: 'sometimes-runs',
  name: 'Sometimes runs',
  checkCallback: (checking: boolean) => {
    const canRun = someCondition();
    if (checking) {
      return canRun;  // Return whether command should be enabled
    }
    if (canRun) {
      // Execute command
    }
  }
});

// ✅ Use editorCallback when you need the editor
this.addCommand({
  id: 'editor-command',
  name: 'Editor command',
  editorCallback: (editor: Editor, view: MarkdownView) => {
    editor.replaceSelection('Hello');
  }
});

// ✅ Use editorCheckCallback for conditional editor commands
this.addCommand({
  id: 'conditional-editor',
  name: 'Conditional editor command',
  editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
    const hasSelection = editor.somethingSelected();
    if (checking) {
      return hasSelection;
    }
    if (hasSelection) {
      // Process selection
    }
  }
});
```

### Styling

#### No Hardcoded Styling

```typescript
// ❌ WRONG - Impossible to theme, override with CSS
const el = containerEl.createDiv();
el.style.color = 'white';
el.style.backgroundColor = 'red';

// ✅ CORRECT - Use CSS classes
const el = containerEl.createDiv({ cls: 'warning-container' });
```

**In your CSS file:**
```css
.warning-container {
  color: var(--text-normal);
  background-color: var(--background-modifier-error);
}
```

**Why:**
- Allows users to customize with themes/snippets
- Respects user's color preferences
- Consistent with Obsidian styling

**Use Obsidian CSS variables:**
- `--text-normal`, `--text-muted`, `--text-faint`
- `--background-primary`, `--background-secondary`
- `--background-modifier-border`, `--background-modifier-error`
- `--interactive-accent`, `--interactive-accent-hover`

See [[CSS variables]] for complete list.

### TypeScript Best Practices

#### Prefer `const` and `let` over `var`

Already covered in [[#2.4. Variable Declarations]].

#### Prefer async/await over Promises

```typescript
// ❌ WRONG - Harder to read, error-prone
function fetchData(): Promise<string | null> {
  return requestUrl('https://example.com')
    .then(res => res.text)
    .catch(e => {
      console.error(e);
      return null;
    });
}

// ✅ CORRECT - Clearer, easier to debug
async function fetchData(): Promise<string | null> {
  try {
    const res = await requestUrl('https://example.com');
    const text = await res.text;
    return text;
  } catch (e) {
    console.error(e);
    return null;
  }
}
```

**Reference:** [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)

### Settings Tab
```typescript
// ✅ CORRECT - Proper settings tab structure
export class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Use Title Case for headings
    containerEl.createEl('h2', { text: 'Plugin Settings' });
    containerEl.createEl('h3', { text: 'Layout Settings' });

    // Use camelCase properties, Title Case for .setName()
    new Setting(containerEl)
      .setName('Default Node Width')
      .setDesc('Width of person nodes in pixels')
      .addText(text => text
        .setValue(String(this.plugin.settings.defaultNodeWidth))
        .onChange(async (value) => {
          this.plugin.settings.defaultNodeWidth = parseInt(value);
          await this.plugin.saveSettings();
        }));
  }
}
```

---

## 5. Obsidian UI Guidelines

This section documents Obsidian's official UI text guidelines from the [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#UI+text).

### Sentence Case Requirement

**CRITICAL: All UI text must use sentence case, NOT Title Case.**

[Sentence case](https://en.wiktionary.org/wiki/sentence_case) means only the first word and proper nouns are capitalized.

```typescript
// ✅ CORRECT - Sentence case
.setName('Template folder location')
.setName('Create new note')
.setName('Root person')
.setName('Default node width')

// ❌ WRONG - Title Case
.setName('Template Folder Location')
.setName('Create New Note')
.setName('Root Person')             // This is what you found!
.setName('Default Node Width')
```

**Applies to:**
- Setting names (`.setName()`)
- Button text
- Command names
- Modal titles
- Section headings
- Form labels
- Any user-facing text in the UI

### Proper Noun Exceptions

The following proper nouns should **remain capitalized** even in sentence case contexts:

| Category | Examples |
|----------|----------|
| **Plugin name** | Charted Roots |
| **Feature names** | Family Chart, Control Center |
| **Third-party products** | Excalidraw, Obsidian Canvas, Obsidian Bases |
| **Industry standards** | GEDCOM, GEDCOM X |
| **Genealogy software** | Gramps |
| **Numbering systems** | Ahnentafel, d'Aboville, Henry, Modified Register |
| **Acronyms** | UUID, ID, PNG, SVG, CSV, PDF, XML, JSON, CR |
| **Format names** | Chicago, MLA, Turabian, Evidence Explained |

```typescript
// ✅ CORRECT - Proper nouns stay capitalized
.setTitle('Charted Roots: Regenerate canvas')  // Plugin name capitalized
.setName('Export to Excalidraw')              // Third-party product
.setName('GEDCOM import options')             // Industry standard acronym
.setName('Assign Ahnentafel numbers')         // Genealogical system name
.setName('Open in Family Chart')              // Feature name

// ❌ WRONG - Don't lowercase proper nouns
.setTitle('canvas roots: Regenerate canvas')  // Plugin name should be capitalized
.setName('Export to excalidraw')              // Product name should be capitalized
.setName('Gedcom import options')             // Acronym should be all caps
```

### Settings Headings

**Rules for settings headings:**

1. **Only use headings if you have more than one section**
   - Don't add a top-level heading like "General", "Settings", or your plugin name
   - Keep general settings at the top without a heading

2. **Avoid "settings" in heading text**
   - Prefer "Advanced" over "Advanced settings"
   - Prefer "Templates" over "Settings for templates"
   - Everything under the settings tab is already settings—don't be redundant

3. **Use sentence case for headings**
   - Prefer "Layout configuration" over "Layout Configuration"
   - Prefer "Data options" over "Data Options"

```typescript
// ✅ CORRECT - Settings structure
export class MySettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // General settings at top - NO heading
    new Setting(containerEl)
      .setName('Default folder')
      .setDesc('Location for new notes');

    // Section heading - sentence case, no "settings"
    containerEl.createEl('h3', { text: 'Advanced' });

    new Setting(containerEl)
      .setName('Enable debug mode')
      .setDesc('Show additional logging information');
  }
}

// ❌ WRONG - Common mistakes
export class MySettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ❌ Don't add top-level heading
    containerEl.createEl('h2', { text: 'My Plugin Settings' });

    // ❌ Title Case
    containerEl.createEl('h3', { text: 'Advanced Settings' });

    // ❌ Redundant "settings" + Title Case
    new Setting(containerEl)
      .setName('Default Folder Location');  // Should be sentence case
  }
}
```

### Use `.setHeading()` for Headings

Use `.setHeading()` instead of HTML heading elements for consistent styling:

```typescript
// ✅ CORRECT
new Setting(containerEl)
  .setName('Advanced')
  .setHeading();

// ❌ WRONG - Inconsistent styling
containerEl.createEl('h3', { text: 'Advanced' });
```

### Examples from Control Center

Based on the official guidelines, here are corrections for Control Center UI text:

```typescript
// ❌ CURRENT (WRONG) - Title Case
const rootLabel = rootGroup.createEl('label', {
  cls: 'crc-form-label',
  text: 'Root Person'  // Title Case - WRONG
});

// ✅ CORRECTED - Sentence case
const rootLabel = rootGroup.createEl('label', {
  cls: 'crc-form-label',
  text: 'Root person'  // Sentence case - CORRECT
});

// ❌ CURRENT (WRONG) - Title Case
const configTitle = configHeader.createEl('h3', {
  cls: 'crc-card__title',
  text: 'Tree Configuration'  // Title Case - WRONG
});

// ✅ CORRECTED - Sentence case
const configTitle = configHeader.createEl('h3', {
  cls: 'crc-card__title',
  text: 'Tree configuration'  // Sentence case - CORRECT
});
```

**Reference:** [Obsidian Plugin Guidelines - UI text](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#UI+text)

---

## 6. Linting Commands

### TypeScript Linting
```bash
# Check for errors
npm run lint

# Auto-fix errors
npm run lint:fix
```

### CSS Linting
```bash
# Check CSS
npm run lint:css

# Auto-fix CSS
npm run lint:css:fix

# Format CSS with Prettier
npm run format:css
```

### Build Process
```bash
# Full build (includes TypeScript check, esbuild, CSS build)
npm run build

# Build with CSS linting disabled (for development)
npm run build:css -- --no-fail-on-lint
```

---

## 7. Common Issues and Solutions

### TypeScript Issues

#### Issue: `prefer-const` error
```typescript
// ❌ Error: 'value' is never reassigned. Use 'const' instead
let value = 'test';
console.log(value);

// ✅ Fix: Use const
const value = 'test';
console.log(value);
```

#### Issue: `no-unused-vars` error
```typescript
// ❌ Error: 'result' is assigned a value but never used
const result = calculateValue();

// ✅ Fix 1: Remove if truly unused
// (delete the line)

// ✅ Fix 2: Prefix with _ if intentionally unused
const _result = calculateValue();  // Explicitly ignored

// ✅ Fix 3: Use the variable
const result = calculateValue();
console.log(result);
```

#### Issue: `@typescript-eslint/no-explicit-any` warning
```typescript
// ⚠️ Warning: Unexpected any. Specify a different type
const data: any = getValue();

// ✅ Fix 1: Use a proper type
interface DataType {
  name: string;
  value: number;
}
const data: DataType = getValue();

// ✅ Fix 2: Use unknown for truly dynamic data
const data: unknown = getValue();
if (typeof data === 'object') {
  // Type guard to safely use data
}
```

#### Issue: Regex spaces error
```typescript
// ❌ Error: Spaces are hard to count. Use {2}
const pattern = /^  - (.+)$/gm;

// ✅ Fix: Use quantifier
const pattern = /^ {2}- (.+)$/gm;
```

### CSS Issues

#### Issue: Class name pattern error
```css
/* ❌ Error: Expected ".xyz-modal" to match pattern */
.xyz-modal { }

/* ✅ Fix: Use 'cr-' or 'crc-' prefix */
.cr-modal { }
.crc-modal { }

/* ❌ Error: Expected ".modalContainer" to match pattern */
.modalContainer { }

/* ✅ Fix: Use kebab-case with prefix */
.cr-modal-container { }
.crc-modal-container { }
```

#### Issue: Custom property pattern error
```css
/* ❌ Error: Expected "--modal-width" to match pattern */
:root {
  --modal-width: 800px;
}

/* ✅ Fix: Add 'cr-' or 'md-' prefix */
:root {
  --cr-modal-width: 800px;
}
```

#### Issue: Color function notation error
```css
/* ❌ Error: Expected modern color-function notation */
background: rgba(0, 0, 0, 0.12);

/* ✅ Fix: Use modern notation with percentage */
background: rgb(0 0 0 / 12%);
```

#### Issue: Shorthand property redundancy
```css
/* ❌ Error: Expected "0 24px 24px 24px" to be "0 24px 24px" */
padding: 0 24px 24px 24px;

/* ✅ Fix: Remove redundant value */
padding: 0 24px 24px;
```

---

## References

- [.eslintrc.json](../../.eslintrc.json) - ESLint configuration
- [.stylelintrc.json](../../.stylelintrc.json) - Stylelint configuration
- [ESLint Setup Guide](./eslint-setup.md) - ESLint version compatibility
- [Documentation Style Guide](../assets/templates/documentation-style-guide.md) - Documentation standards
- [Obsidian API Documentation](https://docs.obsidian.md/Reference/TypeScript+API)
