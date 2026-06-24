import sqlite3
import tempfile
import unittest
from pathlib import Path

import server


class PrintTestBatchTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "participants.db"
        server.create_database()
        server.ativarSQLite()
        server.syncPrintPrinters(["PRINTER_1", "PRINTER_2", "PRINTER_3"])

    def tearDown(self):
        server.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def seed_participants(self, orders=(30, 10, 20)):
        with server.get_connection() as conn:
            for index, order in enumerate(orders, 1):
                conn.execute(
                    """
                    INSERT INTO participantes
                      (ordem_inscricao, nome, sobrenome, email, empresa, checkin)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (order, f"Nome {index}", f"Sobrenome {index}", f"user{index}@test.local", f"Empresa {index}", "Não"),
                )

    def test_start_clamps_quantity_and_selects_pending_by_registration_order(self):
        self.seed_participants()

        result = server.startPrintTest(5)

        self.assertTrue(result["ok"])
        self.assertEqual(result["total"], 3)
        status = server.getPrintTestStatus(result["batchId"])
        self.assertEqual(status["aguardando"], 3)
        with server.get_connection() as conn:
            rows = conn.execute(
                """
                SELECT p.ordem_inscricao
                FROM fila_impressao f
                JOIN participantes p ON p.email = f.participante_email
                WHERE f.lote_teste_id = ?
                ORDER BY f.criado_em, f.rowid
                """,
                (result["batchId"],),
            ).fetchall()
        self.assertEqual([row[0] for row in rows], [10, 20, 30])

    def test_start_rejects_when_an_active_queue_exists(self):
        self.seed_participants((10,))
        server.adicionarItemFila(participante_email="existing@test.local", nome_cracha="Existing")

        result = server.startPrintTest(1)

        self.assertFalse(result["ok"])
        self.assertIn("fila", result["error"].lower())
        with server.get_connection() as conn:
            confirmed = conn.execute(
                "SELECT COUNT(*) FROM participantes WHERE confirmado_em IS NOT NULL AND confirmado_em <> ''"
            ).fetchone()[0]
        self.assertEqual(confirmed, 0)

    def test_batch_pauses_only_after_last_job_finishes(self):
        self.seed_participants((10, 20))
        result = server.startPrintTest(2)
        with server.get_connection() as conn:
            job_ids = [
                row[0]
                for row in conn.execute(
                    "SELECT id FROM fila_impressao WHERE lote_teste_id = ? ORDER BY criado_em, rowid",
                    (result["batchId"],),
                ).fetchall()
            ]

        server.finalizarImpressao(job_ids[0])
        with server.get_connection() as conn:
            self.assertTrue(server.is_printing_enabled(conn))

        server.finalizarImpressao(job_ids[1])
        with server.get_connection() as conn:
            self.assertFalse(server.is_printing_enabled(conn))
            self.assertEqual(server.get_config(conn, server.CONFIG_ACTIVE_PRINT_TEST, ""), "")
        status = server.getPrintTestStatus(result["batchId"])
        self.assertTrue(status["completed"])
        self.assertEqual(status["impresso"], 2)

    def test_failed_last_job_also_closes_batch(self):
        self.seed_participants((10,))
        result = server.startPrintTest(1)
        with server.get_connection() as conn:
            job_id = conn.execute(
                "SELECT id FROM fila_impressao WHERE lote_teste_id = ?",
                (result["batchId"],),
            ).fetchone()[0]

        server.registrarErroImpressao(job_id, "printer offline")

        status = server.getPrintTestStatus(result["batchId"])
        self.assertTrue(status["completed"])
        self.assertEqual(status["erro"], 1)
        self.assertFalse(status["printingEnabled"])

    def test_print_test_uses_three_second_delay_by_default(self):
        self.seed_participants((10,))

        result = server.startPrintTest(1)

        self.assertEqual(result["delaySeconds"], 3)
        claimed = server.claimPrintJob("PRINTER_1")["job"]
        self.assertEqual(claimed["simulationDelayMs"], 3000)

    def test_print_test_clamps_delay_to_one_second(self):
        self.seed_participants((10,))

        result = server.startPrintTest(1, delay_seconds=0)

        self.assertEqual(result["delaySeconds"], 1)
        with server.get_connection() as conn:
            delay = conn.execute("SELECT atraso_simulado_ms FROM fila_impressao").fetchone()[0]
        self.assertEqual(delay, 1000)

    def test_print_test_clamps_delay_to_ten_seconds(self):
        self.seed_participants((10,))

        result = server.startPrintTest(1, delay_seconds=99)

        self.assertEqual(result["delaySeconds"], 10)
        with server.get_connection() as conn:
            delay = conn.execute("SELECT atraso_simulado_ms FROM fila_impressao").fetchone()[0]
        self.assertEqual(delay, 10000)

    def test_simulated_vps_worker_is_enabled_by_default(self):
        with server.get_connection() as conn:
            self.assertTrue(server.is_simulated_worker_enabled(conn))

    def test_disabled_simulated_vps_worker_does_not_claim_jobs(self):
        server.setSimulatedWorkerEnabled("false")
        server.adicionarItemFila(participante_email="simulado@test.local", nome_cracha="Simulado")
        server.setPrintingEnabled("true")

        simulated = server.claimPrintJob("DOCKER_BALCAO_1")
        real_pc = server.claimPrintJob("PC_BALCAO_1")

        self.assertTrue(simulated["ok"])
        self.assertIsNone(simulated["job"])
        self.assertFalse(simulated["simulatedWorkerEnabled"])
        self.assertIsNotNone(real_pc["job"])
        self.assertEqual(real_pc["job"]["printer"], "PC_BALCAO_1")

    def test_set_simulated_worker_enabled_updates_version_info(self):
        disabled = server.handle_api_action({"action": "setSimulatedWorkerEnabled", "enabled": "false"})
        info = server.getVersionInfo()

        self.assertTrue(disabled["ok"])
        self.assertFalse(disabled["simulatedWorkerEnabled"])
        self.assertFalse(info["simulatedWorkerEnabled"])


if __name__ == "__main__":
    unittest.main()
