# Public-release legal review

**Review date:** 2026-09-25

**Status:** Open. This is an evidence-based issue list for maintainers and counsel, not a legal opinion or a finding of infringement.

**Scope:** Repository documents, tracked application code, installed dependency metadata, visible brand assets, and the public terms linked below. The full remote Git history, artwork creation records, employment agreements, and actual Miro account activity were not available for verification.

## Decision to make

The inspected source does not establish that Dali copied Miro code or artwork. Dali identifies DJAI Open Canvas as its code base and retains its MIT notice. The most consequential unresolved issue is **whether a Miro account or service was used to develop this competing product**: Miro's self-service Terms §2.9(c) and enterprise Master Cloud Agreement §2.7(c) restrict that use. Product similarity alone does not answer the contractual question. Rights in the Dalí artwork, the retained DJAI logo, and original contributions also need confirmation.

Do not mark this review “cleared” until the human-owned checks below are documented. The agent can prepare evidence and perform approved repository corrections; it cannot infer licenses, ownership, account history, or counsel's conclusion.

## Findings and actions

### LR-01 — Miro service-use restriction (high; human legal decision)

**Evidence:** [PROJECT.md](.planning/PROJECT.md) (product scope and Miro replacement objective), [FEATURES.md](.planning/research/FEATURES.md) (comparisons citing public Miro help pages), and [STATE.md](.planning/STATE.md) (current product goal) show that Miro is a product reference. [Miro Terms of Service](https://miro.com/legal/terms-of-service/) §2.9 and [Miro Master Cloud Agreement](https://miro.com/legal/master-cloud-agreement/) §2.7 prohibit using the service to develop a similar or competing product; each also restricts copying service elements and reverse engineering. The governing agreement depends on the actual account/order.

**Unresolved fact:** Whether contributors used authenticated Miro boards, templates, exports, screenshots, developer tools, private APIs, or other parts of the service during Dali development, and under which agreement. The public documentation comparisons do not establish that fact. The phrase “replace Miro” establishes intent, not service use.

**Agent tasks:** Inventory repository references to Miro, distinguish public product documentation from service-derived material, and identify any committed screenshots, copied templates, exported boards, or Miro-specific assets. Report file paths and commit identifiers without publishing private board content. Do not delete research merely because it mentions Miro, and do not declare contractual compliance.

**Human gate:** The account holder and counsel determine the applicable agreement and reconstruct actual service use. If service-derived content was used, counsel determines the remedy and whether written permission or independent reimplementation is needed. Record the decision outside this public repository if it contains private account facts.

### LR-02 — Upstream code and copyright notices (lower apparent risk; verify provenance)

**Evidence:** [README.md](README.md) (pinned DJAI Open Canvas source) identifies the upstream project; [LICENSE](LICENSE) (Dali and upstream MIT notices) retains both notices. The [DJAI Open Canvas LICENSE](https://github.com/DJAI-Academy/djai-open-canvas/blob/main/LICENSE) grants reuse, modification, and redistribution subject to notice retention. The [Open Source Initiative MIT text](https://opensource.org/license/mit) explains the same condition.

**Agent tasks:** Compare incorporated files to the pinned upstream revision; identify any source imported from elsewhere or copied from dependency internals. Check that existing upstream notices remain in redistributed source and that the README accurately describes attribution. Produce a provenance table: path, origin/revision, license, notice location, action. Do not replace upstream copyright statements with the Dali copyright line. If provenance is uncertain, flag it instead of assigning MIT by assumption.

**Completion evidence:** A reviewed provenance table and retained applicable notices. Counsel or the rights holder resolves any file without a demonstrated redistribution right.

### LR-03 — Dalí and retained DJAI artwork (medium until rights are established)

**Evidence:** [DESIGN.md](DESIGN.md) (logo-based visual system) and `imgs/` contain the Dalí symbol, wordmark, favicons, and app icon variants. Repository history describes the Dalí logo as supplied; that does not prove its creator or license. [src/assets/djai-design-logo.png](src/assets/djai-design-logo.png) (retained DJAI Design artwork) is tracked. A source-code license does not itself establish trademark rights in a brand asset; the upstream [README](https://github.com/DJAI-Academy/djai-open-canvas#contributing) distinguishes code licensing from DJAI names and logos.

**Agent tasks:** Inventory tracked and untracked image/SVG/font assets and all runtime references. For each asset, record creator/source, written permission or license, whether it is distributed in source or built bundles, and whether it is used. Inspect SVG metadata and raster provenance where available. If the DJAI logo is unused, propose removal from the current tree; check its Git history separately before claiming it is no longer public. Do not remove or relicense artwork on an inferred ownership claim. Confirm the rights for each new Dalí variant before staging it.

**Human gate:** Obtain creator/designer authorization for public source distribution and the intended brand use; resolve any contractual ownership or assignment. Counsel evaluates trademark clearance for “Dalí” and the symbol in intended markets. No trademark search or clearance was completed here. Start with the [USPTO trademark search guidance](https://www.uspto.gov/trademarks/search) where relevant, and use local registries for other markets.

### LR-04 — Third-party package and font notices (medium; agent-correctable after inventory)

**Evidence:** [package.json](package.json) (direct dependency declarations) includes BlockSuite 0.22.4. Installed direct `@blocksuite/*` package metadata reported MIT, while the current [BlockSuite repository](https://github.com/toeverything/blocksuite) states MPL 2.0. These are different artifacts/timepoints; the precise files and licenses in the pinned published packages control. [Inter-LICENSE.txt](assets/fonts/Inter-LICENSE.txt) and [Kalam-LICENSE.txt](assets/fonts/Kalam-LICENSE.txt) contain OFL 1.1 notices. [tokens.css](src/styles/tokens.css) loads a font from `@toeverything/theme`. The lockfile also lists Apache 2.0, MPL 2.0, OFL-related, and other transitive licenses. The root MIT label does not relicense third-party works.

**Agent tasks:** Generate an SBOM/notice inventory from the locked install and the actual production bundle, including fonts and images. Inspect package tarball license files and source headers for the **installed versions**; reconcile the BlockSuite package metadata with any files governed by MPL 2.0. Record runtime-distributed versus development-only material. Add a third-party notices artifact or distribution notice mechanism where required; preserve separate license texts and copyright lines. Check a fresh production build for notice inclusion. Do not assert that every dependency is MIT or that repository-level MIT covers bundled assets.

**Completion evidence:** Version-specific inventory, notice artifact, and build-output check. Sources: [Mozilla MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/), [Open Source Initiative MIT](https://opensource.org/license/mit), and [Open Font License FAQ](https://openfontlicense.org/ofl-faq/).

### LR-05 — Ownership of new work (high if work was created under another party's agreement)

**Evidence:** [LICENSE](LICENSE) (Dali copyright statement) claims licensing authority for original contributions. The repository does not establish the terms of any contributor's employment, contract, commissioning, or design assignment. The [U.S. Copyright Office, Circular 30](https://www.copyright.gov/circs/circ30.pdf) explains one jurisdiction's work-made-for-hire rules; other applicable law and contracts may differ.

**Agent tasks:** Produce a contribution and asset-origin inventory without collecting private contracts in the repository. Identify files introduced by third parties and their stated license/assignment evidence. Flag unknown ownership. Do not change the copyright holder line based on Git author names alone.

**Human gate:** Rights holders and counsel review relevant agreements and obtain any permissions or assignments required for public MIT licensing.

### LR-06 — Public history, private information, and sample content (medium; audit required)

**Evidence:** [AGENTS.md](AGENTS.md) (public repository privacy boundary) bans private organizational information, credentials, real screenshots, production settings, and operational evidence in repository content and publishable history. `.gitignore` excludes common local state and secrets, but ignored status does not remove earlier commits. The initial review inspected current files and a limited recent history, not every object reachable from the remote repository.

**Agent tasks:** Audit all tracked paths and reachable history for secrets, tokens, real user/customer identifiers, internal domains, private screenshots, board exports, and raw operational logs. Review all untracked files before adding them. Record findings in a private evidence location, with only synthetic descriptions in public issues. If a secret is found, route for rotation; if private material is in history, prepare a reviewed remediation plan. Do not rewrite shared history or force-push automatically.

**Completion evidence:** A dated report naming the revision range and scanning method, zero unresolved publish-blocking findings, and verification of the hosted repository after any approved remediation. Use [GitHub's guidance on removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) if history cleanup is required.

### LR-07 — Public positioning and visual similarity (medium; review before promotion)

**Evidence:** The current source search found no Miro-branded application asset. The Dalí eye symbol and logo-based palette are visually distinct in the inspected files. Planning documents use Miro as a functional comparison. No systematic side-by-side screen comparison, design-origin review, or trademark clearance was performed. The [U.S. Copyright Office FAQ](https://www.copyright.gov/help/faq/faq-protect.html) distinguishes protected expression from ideas and methods; application varies by jurisdiction.

**Agent tasks:** Review published README, site copy, screenshots, templates, UI icons, and demo boards for copied wording, distinctive visual elements, or implied Miro affiliation. Replace demonstrably copied nonlicensed content with independently authored equivalents after rights review. Keep factual attribution to licensed upstream code. Avoid presenting “Miro clone” as the public product name or suggesting Miro endorsement.

**Human gate:** Counsel evaluates any disputed similarity and public product claims. An agent's screenshot comparison is evidence, not legal clearance.

## Agent execution rules

1. **Inventory before edits.** Work from the pinned revision and record `git status`, tracked/untracked files, dependency versions, and the published-history range. Preserve unrelated work.
2. **Separate outcomes.** Mark each item `verified`, `correction proposed`, `corrected and tested`, or `human decision required`, with source links and exact artifact paths. Never turn an unknown into a pass.
3. **Make narrow corrections.** The agent may repair notices, attribution links, stale public copy, and objectively unused assets after confirming provenance. It must not decide contract applicability, trademark clearance, ownership, private evidence disposition, or history rewrite.
4. **Verify the result.** Review staged changes for private material, run relevant static/build checks for code or asset changes, inspect bundled notices, and compare the hosted revision after publication. Current local changes to `README.md`, `package.json`, `imgs/`, and `scripts/install.sh` belong to other work until explicitly included in a reviewed correction.
5. **Escalate decisive unknowns.** Require a human answer for Miro account/service use, agreements governing original work, and written logo/brand rights. Keep underlying private evidence outside the public repository.

## Release gate

Public-release risk remains **open** until LR-01 and LR-05 receive a human legal determination, LR-03 has documented asset rights, and LR-02/LR-04/LR-06/LR-07 have evidence-backed dispositions. A green build or license scanner alone does not close these questions. The repository may already be public; this gate applies to continued distribution and new releases as well as future publication.
