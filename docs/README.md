# Newton Selector documentation

Newton Selector (**Professor Flow | Newton Selector** in Flow Builder) is a Flow screen choice selector with a point-and-click Custom Property Editor. These docs follow the [Diataxis](https://diataxis.fr) split: pick the section that matches what you need right now.

## Start here

| I want to...                                | Read                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| Understand what this is and whether it fits | [Overview](overview.md)                                     |
| Use a selector on a Flow screen             | [Using a Newton Selector](guide-using-the-selector.md)      |
| Build my first selector                     | [Tutorial: your first selector](tutorial-first-selector.md) |
| Understand how it is built                  | [Architecture](architecture.md)                             |

## User guides

For people using and building with the component.

- [Overview](overview.md): what it does, for everyone.
- [Using a Newton Selector](guide-using-the-selector.md): end-user guide to the screen.

## Tutorial

- [Tutorial: build your first selector](tutorial-first-selector.md)

## How-to guides

Task-focused steps for admins and developers.

- [How to build a SOQL selector](howto-build-a-soql-selector.md)
- [How to use a record collection as the options](howto-use-a-record-collection.md)
- [How to configure multi-select, required answers and an "Other" option](howto-multi-select-and-validation.md)
- [How to style a selector](howto-style-a-selector.md)
- [How to use the selector's outputs in a Flow](howto-use-outputs-in-a-flow.md)
- [How to troubleshoot a Newton Selector](howto-troubleshoot.md)
- [How to develop and test Newton Selector](howto-develop-and-test.md)

## Reference

Complete, factual descriptions.

- [Configuration reference](reference-configuration.md): every editor setting, key, value and default.
- [Flow component reference](reference-flow-component.md): inputs, outputs, validation messages, auto-advance.
- [Apex API reference](reference-apex-api.md): classes, methods, DTOs, limits, messages.
- [WHERE clause reference](reference-where-clause.md): builder operators and the Apex grammar.

## Architectural guides and explanation

Why it works the way it does.

- [Architecture](architecture.md): components, data flow, design-time flow, Apex layer.
- [Design decisions](explanation-design-decisions.md): the reasoning behind the main choices.
- [Security model](explanation-security-model.md): how queries stay safe and permission-aware.
- [Known limitations](known-limitations.md): current gaps with workarounds and fixes.

## Conventions

- Setting names in **bold** are the labels in the editor. Names in `code` are the stored keys.
- "The editor" means the Custom Property Editor opened from **Configure selector** in Flow Builder.
- These docs were written from the source code. Behaviors that were inferred and not observed in an org are called out in [Known limitations](known-limitations.md).
