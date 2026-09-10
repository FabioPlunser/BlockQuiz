# Bachelor Thesis Project — Claude Code Guidelines

This document provides context for Claude Code when working on this SvelteKit project.

## Project Overview

- **Type**: SvelteKit application with Blockly integration for exercise/course management
- **Framework**: SvelteKit 5 (using runes mode)
- **Branch**: `dev` (main work branch)

## Svelte 5 Standards

All Svelte components in this project use Svelte 5 runes mode. Refer to [.claude/svelte5-reference.md](./.claude/svelte5-reference.md) for best practices on:

- Using `$state` for reactive variables only
- Preferring `$derived` over `$effect` for computed values
- Handling props with `$props` (treating them as potentially changing)
- Using modern event binding syntax (`onclick` instead of `on:click`)
- Avoiding legacy features (slots, implicit reactivity, etc.)

Key reminders:
- Objects/arrays are deeply reactive (use `$state.raw` for large, reassigned-only objects)
- Effects are an escape hatch — use only when necessary
- Use keyed each blocks with stable keys (never index)
- Prefer context over shared module state for SSR safety

## Available Skills

- **svelte-code-writer**: Svelte 5 documentation lookup and code analysis. Automatically invoked for `.svelte` files.
- **frontend-design**: Production-grade UI design and styling assistance.

## Code Style

- Prefer editing existing files over creating new ones
- No comments unless the WHY is non-obvious
- Trust framework guarantees — validate only at system boundaries
- Avoid backwards-compatibility hacks and premature abstractions

## Testing & Development

- Start the dev server and test features in the browser before reporting completion
- Check both golden path and edge cases
- Monitor for regressions in other features
