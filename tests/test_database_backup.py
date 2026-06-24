import sqlite3
import tempfile
import unittest
from pathlib import Path

import server


class DatabaseBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        self.original_backup_dir = server.BACKUP_DIR
        self.base_dir = Path(self.temp_dir.name)
        server.DB_PATH = self.base_dir / "participantes.db"
        server.BACKUP_DIR = self.base_dir / "backups"
        server.create_database()

    def tearDown(self):
        server.DB_PATH = self.original_db_path
        server.BACKUP_DIR = self.original_backup_dir
        self.temp_dir.cleanup()

    def test_backup_database_copies_sqlite_file_with_reason_in_name(self):
        with server.get_connection() as conn:
            conn.execute("INSERT INTO participantes (nome, email) VALUES (?, ?)", ("Ana", "ana@test.local"))

        backup_path = server.backup_database("upload")

        self.assertTrue(backup_path.exists())
        self.assertEqual(backup_path.parent, server.BACKUP_DIR)
        self.assertRegex(backup_path.name, r"participantes-upload-\d{8}-\d{6}-\d{6}\.db")
        with sqlite3.connect(backup_path) as conn:
            row = conn.execute("SELECT nome, email FROM participantes").fetchone()
        self.assertEqual(row, ("Ana", "ana@test.local"))

    def test_backup_database_returns_none_when_database_does_not_exist(self):
        server.DB_PATH.unlink()

        backup_path = server.backup_database("upload")

        self.assertIsNone(backup_path)
        self.assertFalse(server.BACKUP_DIR.exists())


if __name__ == "__main__":
    unittest.main()
