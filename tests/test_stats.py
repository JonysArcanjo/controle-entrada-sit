import tempfile
import unittest
from pathlib import Path

import server


class StatsCompanyTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "participants.db"
        server.create_database()
        server.ativarSQLite()

    def tearDown(self):
        server.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_companies_aggregate_empresa_on_loaded_participants(self):
        with server.get_connection() as conn:
            rows = [
                ("Ana", "ana@test.local", "Acme"),
                ("Bruno", "bruno@test.local", "Acme"),
                ("Carla", "carla@test.local", "Beta"),
                ("Diego", "diego@test.local", ""),
            ]
            conn.executemany(
                "INSERT INTO participantes (nome, email, empresa) VALUES (?, ?, ?)",
                rows,
            )

        companies = server.getStats()["companies"]

        self.assertEqual(
            companies,
            [
                {"name": "Acme", "count": 2, "rate": 50.0},
                {"name": "Beta", "count": 1, "rate": 25.0},
                {"name": "Sem empresa", "count": 1, "rate": 25.0},
            ],
        )

    def test_companies_include_other_and_no_company_to_cover_all_participants(self):
        with server.get_connection() as conn:
            companies = ["Alpha", "Beta", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "", ""]
            conn.executemany(
                "INSERT INTO participantes (nome, email, empresa) VALUES (?, ?, ?)",
                [
                    (f"Pessoa {index}", f"person{index}@test.local", company)
                    for index, company in enumerate(companies, 1)
                ],
            )

        result = server.getStats()

        self.assertEqual(sum(item["count"] for item in result["companies"]), result["total"])
        self.assertEqual(result["companies"][-2], {"name": "Outras empresas", "count": 2, "rate": 20.0})
        self.assertEqual(result["companies"][-1], {"name": "Sem empresa", "count": 2, "rate": 20.0})


if __name__ == "__main__":
    unittest.main()
