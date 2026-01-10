# Contributing to Charted Roots

Thank you for your interest in contributing to Charted Roots! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Security](#security)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming and inclusive environment:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility for mistakes and learn from them

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Obsidian (latest version recommended)
- Git
- A code editor (VS Code recommended)

### Understanding the Project

Before contributing, familiarize yourself with:

1. **Project Goals**: Read [README.md](README.md) and [docs/canvas-roots-initial-spec.md](docs/canvas-roots-initial-spec.md)
2. **Documentation Style**: Review [docs/assets/templates/documentation-style-guide.md](docs/assets/templates/documentation-style-guide.md)
3. **Security Considerations**: Read [SECURITY.md](SECURITY.md) - this plugin handles sensitive PII
4. **Development Guide**: See [docs/development.md](docs/development.md)

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/obsidian-charted-roots.git
   cd obsidian-charted-roots
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Plugin**
   ```bash
   npm run build
   ```

4. **Set Up Test Vault**
   - Create a test Obsidian vault for development
   - Update the vault path in `deploy.sh` and `dev-deploy.sh`
   - Deploy: `npm run deploy`

5. **Enable in Obsidian**
   - Open Obsidian
   - Go to Settings → Community plugins
   - Enable "Charted Roots"

## Project Structure

```
canvas-roots/
├── src/                    # Source code
│   ├── models/            # Data models
│   ├── canvas/            # Canvas manipulation
│   ├── layout/            # D3 layout algorithms
│   ├── utils/             # Utilities
│   ├── gedcom/            # GEDCOM import/export
│   └── settings.ts        # Plugin settings
├── styles/                # CSS components
├── docs/                  # Documentation
│   ├── assets/           # Documentation assets
│   └── developer/        # Developer docs
├── main.ts               # Plugin entry point
├── manifest.json         # Plugin metadata
└── package.json          # Dependencies and scripts
```

## Development Workflow

### Daily Development

1. **Start watch mode**
   ```bash
   npm run dev
   ```

2. **Watch CSS changes** (in separate terminal)
   ```bash
   npm run build:css:watch
   ```

3. **Make changes** to TypeScript or CSS files

4. **Deploy to test vault**
   ```bash
   npm run deploy
   ```

5. **Reload Obsidian** (Ctrl/Cmd + R)

### Branch Strategy

- `main` - Stable releases only
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

### Commit Messages

Follow these guidelines:

- Use present tense: "Add feature" not "Added feature"
- Use imperative mood: "Fix bug" not "Fixes bug"
- Keep first line under 72 characters
- Reference issues: "Fix #123: Description"
- **Never mention AI tools or assistants** in commit messages

**Format:**
```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes

**Examples:**
```
feat: Add GEDCOM import functionality

Implements basic GEDCOM file parsing and person note creation.
Supports GEDCOM 5.5.1 format.

Closes #42
```

```
fix: Correct node positioning on canvas

Fixes an issue where nodes were positioned incorrectly when
the root person had no parents.

Fixes #57
```

## Coding Standards

### TypeScript

- Follow the ESLint configuration ([.eslintrc.json](.eslintrc.json))
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Avoid `any` types when possible

**Example:**
```typescript
/**
 * Generates a unique identifier for a person node.
 * @returns A UUID v4 string
 */
function generatePersonId(): string {
  return crypto.randomUUID();
}
```

### CSS

- Follow the Stylelint configuration ([.stylelintrc.json](.stylelintrc.json))
- Use BEM naming with `cr-` prefix
- Prefer CSS variables over hard-coded values
- Use Obsidian's CSS variables for theme compatibility
- See [docs/developer/css-system.md](docs/developer/css-system.md) for details

**Example:**
```css
.cr-person-node {
  width: var(--cr-node-width);
  background: var(--background-primary);
  color: var(--text-normal);
}

.cr-person-node__name {
  font-weight: bold;
}

.cr-person-node--highlighted {
  border-color: var(--interactive-accent);
}
```

### Code Style

Run linting before committing:

```bash
# TypeScript linting
npm run lint

# CSS linting
npm run lint:css

# Auto-fix issues
npm run lint:fix
npm run lint:css:fix
```

## Testing

### Manual Testing

1. **Create test data**
   - Create person notes with various relationships
   - Test with different family structures
   - Include edge cases (orphans, adoptions, multiple spouses)

2. **Test scenarios**
   - Generate tree from person note
   - Re-layout existing canvas
   - GEDCOM import/export (when implemented)
   - Settings changes
   - Theme switching (light/dark)
   - Mobile compatibility

3. **Performance testing**
   - Test with large family trees (100+ people)
   - Monitor memory usage
   - Check layout calculation speed

### Automated Testing

(To be implemented)

```bash
npm test
```

## Documentation

### When to Update Documentation

Update documentation when:

- Adding new features
- Changing existing functionality
- Fixing bugs that affect user workflow
- Adding new configuration options
- Changing plugin architecture

### Documentation Standards

Follow the [Documentation Style Guide](docs/assets/templates/documentation-style-guide.md):

- Use kebab-case for file names
- Include table of contents for long documents
- Use descriptive headings
- Add code examples for complex features
- Include screenshots for UI features
- Use second person ("you") when addressing users
- Avoid using "we" or "our"

### Documentation Types

- **User Guides**: How to use features
- **Developer Docs**: Technical implementation details
- **API Reference**: Public API documentation
- **Tutorials**: Step-by-step walkthroughs

## Submitting Changes

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All linters pass (`npm run lint`, `npm run lint:css`)
- [ ] Build succeeds (`npm run build`)
- [ ] Changes tested in Obsidian
- [ ] Documentation updated if needed
- [ ] Commit messages follow guidelines
- [ ] No sensitive data in commits

### Pull Request Process

1. **Create a Pull Request**
   - Use a clear, descriptive title
   - Reference related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - List breaking changes if any

2. **PR Template** (fill this in):
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Related Issues
   Fixes #(issue number)

   ## Testing
   How was this tested?

   ## Screenshots (if applicable)
   Add screenshots here

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Linters pass
   - [ ] Build succeeds
   - [ ] Documentation updated
   - [ ] Tested in Obsidian
   ```

3. **Review Process**
   - Address review comments
   - Keep PR focused and small when possible
   - Be responsive to feedback
   - Update PR description if scope changes

4. **After Merge**
   - Delete your branch
   - Update your fork's main branch

## Security

### Reporting Security Issues

**Do not open public issues for security vulnerabilities.**

See [SECURITY.md](SECURITY.md) for reporting procedures.

### Security Considerations

This plugin handles sensitive PII (personally identifiable information):

- **Never log personal data** to console
- **Be cautious with error messages** - don't expose PII
- **Test privacy implications** of new features
- **Document data handling** in security policy
- **Consider GDPR/CCPA** compliance implications

### Data Privacy Guidelines

- Store data locally only (no external connections)
- Use Obsidian's native file system APIs
- Don't cache sensitive data unnecessarily
- Respect user's vault privacy settings
- Document all data storage locations

## Questions?

- **General questions**: Open a [GitHub Discussion](https://github.com/banisterious/obsidian-charted-roots/discussions)
- **Bug reports**: Open a [GitHub Issue](https://github.com/banisterious/obsidian-charted-roots/issues)
- **Feature requests**: Open a [GitHub Issue](https://github.com/banisterious/obsidian-charted-roots/issues) with "enhancement" label
- **Security issues**: See [SECURITY.md](SECURITY.md)

## License

By contributing to Charted Roots, you agree that your contributions will be licensed under the MIT License.

## Acknowledgments

Thank you for contributing to Charted Roots and helping make family tree visualization in Obsidian better for everyone!
