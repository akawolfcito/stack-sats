# Contributing to DenVault

Thanks for your interest in contributing.

## Ground rules
- Be respectful and constructive (see CODE_OF_CONDUCT.md).
- Do not submit or request real seed phrases/private keys in issues, PRs, or logs.
- Avoid introducing telemetry/analytics without prior discussion and documentation updates.

## Development workflow
1. Fork the repo and create a feature branch.
2. Keep changes scoped and documented.
3. Add tests where feasible.
4. Open a PR describing:
   - What changed
   - Why it changed
   - Security implications (especially for wallet/extension flows)

## Security-sensitive changes
If your change touches:
- Key management, seed phrase storage, encryption
- Transaction signing flows
- Extension permissions
…please call it out explicitly in the PR description.

## License
By contributing, you agree that your contributions are licensed under the repository’s primary license (Apache-2.0),
unless stated otherwise.
