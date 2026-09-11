# Dali contributor instructions

## Public repository privacy boundary

- Keep all repository content and publishable history organization-neutral.
- Never commit private organizational information, internal product/customer data, real screenshots, user identities, host paths, credentials, tenant identifiers, production domains, deployment settings, or private operational evidence.
- Operator-specific identity configuration and deployment settings are defined and maintained exclusively in operator-controlled infrastructure outside this repository.
- Public code exposes generic configuration interfaces. Documentation, examples, tests, demos, and screenshots use synthetic data and example domains.
- Apply these rules to planning documents, research caches, generated files, logs, commit messages, and pull requests as well as code.
- Review staged changes and outgoing history before committing or publishing. Ignore rules are defense in depth, not permission to store private material here. Do not force-add private files.
- If private material is discovered in history, stop publication and prepare a reviewed remediation; a later deletion alone does not clean earlier commits.

<!-- GSD:workflow-start source:GSD defaults -->
## Workflow

Use the GSD workflow for project planning and implementation. Read `.planning/PROJECT.md` (scope and constraints), `.planning/REQUIREMENTS.md` (approved acceptance requirements), and `.planning/ROADMAP.md` (approved phase sequence).

- Deliver phases sequentially, one capability at a time.
- Execute automatically within approved plans; pause for blockers or consequential decisions.
- Independent tasks may run in parallel within an approved phase with explicit file ownership.
- Research before planning, check plans before execution, and verify requirements after each phase.
- Use `.planning/config.json` for agent model and reasoning settings.
- Keep PR descriptions to a concise change summary and validation results.
- Verify static errors before commits and complete relevant checks before requesting a PR.
<!-- GSD:workflow-end -->

## Product boundaries

Extend DJAI Open Canvas with applicable upstream notices. Initial release includes mind maps, authenticated board access, durable collaboration validated with 20 concurrent users, facilitation, templates, mockups, technical diagrams, image exports, and a task/date-driven Gantt widget. Roadmaps use ordinary canvas objects. MCP creation and Plane integration are deferred; ClickUp imports are excluded.
