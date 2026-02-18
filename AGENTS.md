# AGENTS

## Scope

This repository is built and maintained for a human-friendly TUI. Every file should remain
concise, readable, and intentionally organized so future contributors can understand the behavior
without digging through monolithic code blocks.

## Code organization requirements

- Keep files focused on a single responsibility.
- Split logic into small, testable pieces when files grow beyond a single-screen level.
- Prefer short helper functions over long inline logic inside JSX/render trees.
- Move reusable behavior into named helpers instead of duplicating logic in multiple call sites.
- Keep related logic grouped:
  - parsing/config data
  - state transitions
  - layout/rendering
  - interaction handling

## Style expectations

- Use clear names for constants, functions, and state.
- Keep formatting consistent and avoid unnecessary nesting.
- Prefer readability over cleverness.
- Preserve behavior while improving structure.

## Maintainability rule

- If a file reaches a point where the next feature addition requires more than a few extra lines of
  nested conditionals, refactor that file before adding the feature.
- New sections should be self-explanatory with descriptive naming and minimal indirection.

## Practical target

- Favor small, well-organized modules over a single large file.
- If a file grows too large, split it into logical units and wire them through clear imports.
