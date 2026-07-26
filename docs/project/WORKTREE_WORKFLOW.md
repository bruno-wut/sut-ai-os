# Worktree workflow

Use an isolated Git worktree for each implementation task. The Node manager works on Windows, macOS, Linux, and WSL when `node` and `git` are available; it does not use shell-specific path or deletion commands.

## Creation

The canonical JSON task packet must be in `ready` status before a worktree can be created. The manager reads the packet title, creates `task/<task-id>-<slug>`, and places the worktree beside—not inside—the repository:

```text
<repository-parent>/<repository-name>-worktrees/<task-id>
```

It detects the primary branch from a remote HEAD when configured; otherwise it uses an existing local `main`, then `master`, then the current branch as a documented final fallback. Existing task branches or target directories are treated as unexpected and refused. On creation, the manager writes the path, branch, primary branch, timestamp, and actor into the ready task packet.

```text
npm run worktree:doctor
npm run worktree:create -- --task SUT-AIOS-AREA-001
npm run worktree:list
npm run worktree:status -- --task SUT-AIOS-AREA-001
```

## Removal and pruning

Removal is deliberately fail-closed. It refuses a dirty worktree, unresolved conflicts, commits not pushed to its upstream (or commits not present on the recorded primary branch when no upstream exists), and an unmerged task branch. It uses neither `git clean`, `git reset --hard`, forced worktree removal, nor forced branch deletion.

```text
npm run worktree:remove -- --task SUT-AIOS-AREA-001
npm run worktree:prune                 # report stale Git metadata only
npm run worktree:prune -- --apply       # explicit metadata pruning
```

`worktree:prune` is dry-run by default. It does not install dependencies or modify application files.

## Dependencies and outputs

Each worktree has its own mutable checkout. Install dependencies inside that worktree only when its packet requires a build or test and the package manager requires installation. Shared immutable package-manager caches are acceptable; never share `node_modules`, build directories, coverage output, screenshots, traces, or other mutable generated output between worktrees. Keep generated output ignored and record durable verification evidence under `evidence/`.

Run the manager's disposable Git fixture with `node scripts/worktree/worktree-cli.mjs --self-test`. It creates and removes only an exact operating-system temporary directory.
