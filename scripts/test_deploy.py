"""Exercise deployment fast-forward, retry and dirty-check behavior without a server."""

from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

DEPLOY_SCRIPT = Path(__file__).with_name("deploy.sh").resolve()


def run(*args: str, cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True, check=True)


class DeployTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="braveactive-deploy-test-")
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.origin = root / "origin"
        self.origin.mkdir()
        run("git", "init", "-b", "main", cwd=self.origin)
        run("git", "config", "user.email", "test@example.invalid", cwd=self.origin)
        run("git", "config", "user.name", "Test", cwd=self.origin)
        (self.origin / "version").write_text("one")
        run("git", "add", "version", cwd=self.origin)
        run("git", "commit", "-m", "initial", cwd=self.origin)
        self.checkout = root / "checkout"
        run("git", "clone", str(self.origin), str(self.checkout), cwd=root)
        (self.checkout / ".env").write_text("RUN_MODE=production\nENVIRONMENT=production\n")
        (self.checkout / ".git" / "info" / "exclude").write_text(".env\nbackend/\n")
        venv = self.checkout / "backend" / ".venv" / "bin"
        venv.mkdir(parents=True)
        self.log = root / "calls"
        commands = root / "bin"
        commands.mkdir()
        self.env = {**os.environ, "PATH": f"{commands}:{os.environ['PATH']}", "FAKE_LOG": str(self.log)}
        for name in ("npm", "sudo", "systemctl", "curl"):
            path = commands / name
            path.write_text(
                "#!/bin/sh\n"
                f"echo {name} >> \"$FAKE_LOG\"\n"
                + ('[ "${FAIL_RESTART:-}" != yes ] || exit 1\n' if name == "sudo" else "")
                + "exit 0\n"
            )
            path.chmod(0o755)
        for name in ("python", "pip"):
            path = venv / name
            path.write_text("#!/bin/sh\necho " + name + " >> \"$FAKE_LOG\"\n")
            path.chmod(0o755)

    def deploy(self, sha: str, **extra_env: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(DEPLOY_SCRIPT), str(self.checkout), sha],
            text=True, capture_output=True, env={**self.env, **extra_env},
        )

    def new_commit(self) -> str:
        (self.origin / "version").write_text("two")
        run("git", "add", "version", cwd=self.origin)
        run("git", "commit", "-m", "update", cwd=self.origin)
        return run("git", "rev-parse", "HEAD", cwd=self.origin).stdout.strip()

    def test_fast_forward_and_retry_after_failed_restart(self) -> None:
        sha = self.new_commit()
        self.assertNotEqual(self.deploy(sha, FAIL_RESTART="yes").returncode, 0)
        self.assertEqual((self.checkout / "version").read_text(), "two")
        retry = self.deploy(sha)
        self.assertEqual(retry.returncode, 0, retry.stderr)
        self.assertIn("Deployment healthy", retry.stdout)
        self.assertEqual(self.log.read_text().splitlines().count("sudo"), 2)

    def test_refuses_local_tracked_changes(self) -> None:
        sha = self.new_commit()
        (self.checkout / "version").write_text("local edits")
        result = self.deploy(sha)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.checkout / "version").read_text(), "local edits")
        self.assertFalse(self.log.exists())

    def test_older_trigger_does_not_replace_newer_checkout(self) -> None:
        old_sha = run("git", "rev-parse", "HEAD", cwd=self.checkout).stdout.strip()
        sha = self.new_commit()
        self.assertEqual(self.deploy(sha).returncode, 0)
        result = self.deploy(old_sha)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("superseded", result.stdout)
        self.assertEqual((self.checkout / "version").read_text(), "two")


if __name__ == "__main__":
    unittest.main()
