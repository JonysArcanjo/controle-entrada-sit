import base64
import unittest
from email.message import Message

import server


def make_handler(path, authorization=""):
    handler = server.AdminRequestHandler.__new__(server.AdminRequestHandler)
    handler.path = path
    handler.headers = Message()
    if authorization:
        handler.headers["Authorization"] = authorization
    return handler


def basic_auth(username, password):
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


class AdminAuthTests(unittest.TestCase):
    def setUp(self):
        self.original_username = server.ADMIN_USERNAME
        self.original_password = server.ADMIN_PASSWORD
        server.ADMIN_USERNAME = "admin"
        server.ADMIN_PASSWORD = "secret"

    def tearDown(self):
        server.ADMIN_USERNAME = self.original_username
        server.ADMIN_PASSWORD = self.original_password

    def test_admin_html_requires_auth_when_password_is_configured(self):
        handler = make_handler("/admin.html")

        self.assertTrue(handler.request_requires_admin_auth())
        self.assertFalse(handler.is_admin_authorized())

    def test_admin_html_accepts_valid_basic_auth(self):
        handler = make_handler("/admin.html", basic_auth("admin", "secret"))

        self.assertTrue(handler.is_admin_authorized())

    def test_public_pages_do_not_require_admin_auth(self):
        self.assertFalse(make_handler("/index.html").request_requires_admin_auth())
        self.assertFalse(make_handler("/fila.html").request_requires_admin_auth())

    def test_public_api_actions_do_not_require_admin_auth(self):
        self.assertFalse(make_handler("/api?action=lookup&lookup=a@b.com").request_requires_admin_auth())
        self.assertFalse(make_handler("/api?action=confirm&lookup=a@b.com").request_requires_admin_auth())
        self.assertFalse(make_handler("/api?action=printQueue").request_requires_admin_auth())

    def test_admin_api_actions_and_upload_require_auth(self):
        self.assertTrue(make_handler("/admin/upload-participantes").request_requires_admin_auth())
        self.assertTrue(make_handler("/api?action=stats").request_requires_admin_auth())
        self.assertTrue(make_handler("/api?action=setPrintingEnabled&enabled=true").request_requires_admin_auth())
        self.assertTrue(make_handler("/api?action=limparIndicadores").request_requires_admin_auth())

    def test_admin_auth_is_disabled_without_password(self):
        server.ADMIN_PASSWORD = ""

        self.assertFalse(make_handler("/admin.html").request_requires_admin_auth())
        self.assertTrue(make_handler("/admin.html").is_admin_authorized())


if __name__ == "__main__":
    unittest.main()
