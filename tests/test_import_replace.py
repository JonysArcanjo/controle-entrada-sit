import tempfile
import unittest
from pathlib import Path

import server


HEADERS = ["Nome", "Sobrenome", "Email", "Nº ingresso", "Estado de pagamento"]


def record(name, surname, email, ticket, payment="Aprovado"):
    return {
        "Nome": name,
        "Sobrenome": surname,
        "Email": email,
        "Nº ingresso": ticket,
        "Estado de pagamento": payment,
    }


class ReplaceImportTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        self.original_backup_dir = server.BACKUP_DIR
        self.base_dir = Path(self.temp_dir.name)
        server.DB_PATH = self.base_dir / "participantes.db"
        server.BACKUP_DIR = self.base_dir / "backups"
        server.create_database()
        server.ativarSQLite()

    def tearDown(self):
        server.DB_PATH = self.original_db_path
        server.BACKUP_DIR = self.original_backup_dir
        self.temp_dir.cleanup()

    def test_import_replaces_existing_participants_and_queue_atomically(self):
        with server.get_connection() as conn:
            conn.execute("INSERT INTO participantes (nome, email) VALUES (?, ?)", ("Antigo", "old@test.local"))
            conn.execute(
                "INSERT INTO fila_impressao (id, participante_email, nome_cracha, status, criado_em) VALUES (?, ?, ?, ?, ?)",
                ("job-old", "old@test.local", "Antigo", server.STATUS_AGUARDANDO, server.now_iso()),
            )
            server.set_config(conn, server.CONFIG_PRINTING_ENABLED, "true")

        summary = server.import_participants([record("Nova", "Pessoa", "new@test.local", "A-1")], HEADERS)

        self.assertTrue(summary["replaced"])
        self.assertEqual(summary["processed"], 1)
        self.assertEqual(summary["inserted"], 1)
        self.assertEqual(summary["updated"], 0)
        self.assertTrue(Path(summary["backup"]).exists())
        with server.get_connection() as conn:
            participants = conn.execute("SELECT nome, email FROM participantes ORDER BY id").fetchall()
            queue_count = conn.execute("SELECT COUNT(*) FROM fila_impressao").fetchone()[0]
            printing_enabled = server.get_config(conn, server.CONFIG_PRINTING_ENABLED, "")
        self.assertEqual(participants, [("Nova", "new@test.local")])
        self.assertEqual(queue_count, 0)
        self.assertEqual(printing_enabled, "false")

    def test_import_rolls_back_without_deleting_existing_data_on_error(self):
        with server.get_connection() as conn:
            conn.execute("INSERT INTO participantes (nome, email) VALUES (?, ?)", ("Antigo", "old@test.local"))

        with self.assertRaises(ValueError):
            server.import_participants([record("", "", "", "")], HEADERS)

        with server.get_connection() as conn:
            participants = conn.execute("SELECT nome, email FROM participantes").fetchall()
        self.assertEqual(participants, [("Antigo", "old@test.local")])


if __name__ == "__main__":
    unittest.main()
