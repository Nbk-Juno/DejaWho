# Domain Docs

This repo uses a single-context domain layout.

Agents should read:

- `CONTEXT.md` for project vocabulary and domain terms.
- `docs/adr/` for architecture decision records when that directory exists.
- `PRODUCT.md` for product purpose, users, and design principles; `DESIGN.md` for the design system.

When a task introduces or sharpens a durable domain term, update `CONTEXT.md`. When a durable architecture decision is made, add an ADR under `docs/adr/` rather than relying on chat history.
