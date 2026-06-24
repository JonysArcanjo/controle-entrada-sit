import tempfile
import unittest
from pathlib import Path

import server


class VersionInfoTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        self.original_backup_dir = server.BACKUP_DIR
        self.original_version = server.APP_VERSION
        self.original_build_time = server.APP_BUILD_TIME
        self.original_password = server.ADMIN_PASSWORD
        self.base_dir = Path(self.temp_dir.name)
        server.DB_PATH = self.base_dir / "participantes.db"
        server.BACKUP_DIR = self.base_dir / "backups"
        server.APP_VERSION = "abc1234"
        server.APP_BUILD_TIME = "2026-06-24T10:00:00-03:00"
        server.ADMIN_PASSWORD = "secret"
        server.create_database()
        server.ativarSQLite()

    def tearDown(self):
        server.DB_PATH = self.original_db_path
        server.BACKUP_DIR = self.original_backup_dir
        server.APP_VERSION = self.original_version
        server.APP_BUILD_TIME = self.original_build_time
        server.ADMIN_PASSWORD = self.original_password
        self.temp_dir.cleanup()

    def test_version_info_reports_deploy_and_runtime_status(self):
        backup_path = server.backup_database("deploy")

        info = server.getVersionInfo()

        self.assertTrue(info["ok"])
        self.assertEqual(info["version"], "abc1234")
        self.assertEqual(info["buildTime"], "2026-06-24T10:00:00-03:00")
        self.assertEqual(info["fonteDadosAtiva"], server.FONTE_SQLITE)
        self.assertTrue(info["adminAuthEnabled"])
        self.assertTrue(info["databaseExists"])
        self.assertEqual(info["backupCount"], 1)
        self.assertEqual(info["lastBackup"]["name"], backup_path.name)
        self.assertGreater(info["lastBackup"]["sizeBytes"], 0)

    def test_version_api_action_is_public_and_local(self):
        self.assertFalse(server.should_proxy_to_google_sheets("version"))

        info = server.handle_api_action({"action": "version"})

        self.assertTrue(info["ok"])
        self.assertEqual(info["version"], "abc1234")


if __name__ == "__main__":
    unittest.main()
