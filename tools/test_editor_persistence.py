"""Regression tests: all server writes are redirected to a temporary workspace."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("editor_server", Path(__file__).with_name("serve.py"))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class DraftPersistenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tk-editor-test-")
        self.root = Path(self.temp.name).resolve()
        self.old = {}
        for key in ("_STAGES_DIR", "_MAPS_DIR", "_PUBLISH_BACKUP_DIR", "_DRAFT_STAGES_DIR", "_DRAFT_MAPS_DIR", "_DRAFT_TMP_DIR"):
            self.old[key] = getattr(server, key)
            path = self.root / key
            path.mkdir()
            setattr(server, key, str(path))
        self.write = server._write_text_atomic
        server._write_text_atomic = lambda dest, text, tmp_dir=None: self.write(dest, text, tmp_dir or server._DRAFT_TMP_DIR)
        self.validate = server._validate_data
        server._validate_data = lambda: {"ok": True}

    def tearDown(self):
        server._write_text_atomic = self.write
        server._validate_data = self.validate
        for key, value in self.old.items():
            setattr(server, key, value)
        # Only the exact temporary directory allocated by this test is removed.
        assert self.root == Path(self.temp.name).resolve() and self.root.name.startswith("tk-editor-test-")
        self.temp.cleanup()

    def save(self, name, revision=None):
        return server._draft_save({"stageId": "sample", "stage": json.dumps({"id": "sample", "name": name, "mapId": "map"}), "baseRevision": revision})

    def test_publish_keeps_edit_saved_during_validation(self):
        self.assertEqual(self.save("old")[0], 200)
        def validate():
            self.assertEqual(self.save("new", 1)[0], 200)
            return {"ok": True}
        server._validate_data = validate
        _, result = server._publish_stage({"stage": json.dumps({"id": "sample", "name": "old", "mapId": "map"}), "baseRevision": 1})
        self.assertTrue(result["ok"])
        self.assertFalse(result["draftDeleted"])
        self.assertEqual(json.loads((Path(server._DRAFT_STAGES_DIR) / "sample.json").read_text())["name"], "new")

    def test_delete_checks_revision_and_recreation_never_reuses_revision(self):
        self.save("first")
        self.save("second", 1)
        self.assertEqual(server._draft_delete({"stageId": "sample", "baseRevision": 1})[0], 409)
        self.assertEqual(server._draft_delete({"stageId": "sample"})[0], 400)
        self.assertEqual(server._draft_delete({"stageId": "sample", "baseRevision": 2})[0], 200)
        _, result = self.save("third")
        self.assertEqual(result["revision"], 3)
        self.assertEqual(self.save("stale", 1)[0], 409)

    def test_publish_removes_matching_draft_only(self):
        self.save("first")
        stage = json.dumps({"id": "sample", "name": "first", "mapId": "map"})
        _, old_client = server._publish_stage({"stage": stage})
        self.assertFalse(old_client["draftDeleted"])
        _, current_client = server._publish_stage({"stage": stage, "baseRevision": 1})
        self.assertTrue(current_client["draftDeleted"])

    def test_legacy_draft_deletion_preserves_revision_high_water_mark(self):
        self.save("first")
        (Path(server._DRAFT_STAGES_DIR) / "sample.revision").unlink()
        self.assertEqual(server._draft_delete({"stageId": "sample", "baseRevision": 1})[0], 200)
        self.assertEqual(self.save("new")[1]["revision"], 2)


if __name__ == "__main__":
    unittest.main()
