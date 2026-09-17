// A task's branch name, and reading one back. The slug reaches both a git ref
// and a filesystem path, so it is validated rather than trusted: a slug with a
// slash would nest a ref, one with `..` would escape the worktree base, and one
// with a space would need quoting in every command that carries it. Refusing
// early is cheaper than discovering either at `git worktree add`.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BRANCH = /^task\/(t\d+)-(.+)$/u;

export function taskBranchName(id, slug) {
  if (!SLUG.test(slug)) {
    throw new Error(`"${slug}" is not a usable task slug: use lower-case words joined by single hyphens, for example "flow-editor-cleanup". It becomes both a git ref and a directory name.`);
  }
  return `task/${id}-${slug}`;
}

export function parseTaskBranch(branch) {
  const match = BRANCH.exec(branch.trim());
  return match ? { id: match[1], slug: match[2] } : null;
}
