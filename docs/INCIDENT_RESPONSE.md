# Supply-chain incident response

Trigger this procedure when any of the following is true:

- A locked dependency version is confirmed malicious
- An install occurred during a malicious publication window
- An IOC match is found in the lockfile or on a developer machine
- CI behavior suggests credential theft or unexpected outbound access

## Immediate response

1. **Stop** builds, deployments, and package publishing (disable workflows / protect branches).
2. **Preserve** evidence: affected lockfile, CI logs, runner metadata, caches, artifacts, and timestamps.
3. Identify the exact package name, version, and installation window.
4. Quarantine affected developer machines and any self-hosted runners.
5. **Do not** rotate credentials from a potentially compromised machine.
6. Purge affected npm/pnpm caches and any internal registry mirrors.
7. Remove malicious versions; rebuild from a known-good commit in a clean environment.
8. Rotate every credential that could have been available to the affected process:
   - npm tokens
   - GitHub tokens and sessions
   - cloud / deployment credentials
   - SSH keys
   - signing keys
   - wallet or blockchain keys
9. Review GitHub, npm, cloud, deployment, and package-publishing audit logs.
10. Publish an internal incident report; issue a public advisory if users may be affected.

## After containment

- Add the malicious coordinates to `scripts/ci/malware-iocs.txt`
- Confirm CI IOC scan fails closed on a reproducing branch
- Review `onlyBuiltDependencies` and Action SHA pins
- Run a short tabletop exercise when the incident closes

## Contacts

Maintainers: DFArchon team (see README social links). Update this section with a private security contact alias when available.
