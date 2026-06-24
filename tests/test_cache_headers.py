import unittest

import server


class CacheHeaderTests(unittest.TestCase):
    def test_html_responses_are_not_cached(self):
        handler = server.AdminRequestHandler.__new__(server.AdminRequestHandler)
        handler.path = "/index.html"

        self.assertTrue(handler.should_disable_cache())

    def test_api_responses_are_not_cached(self):
        handler = server.AdminRequestHandler.__new__(server.AdminRequestHandler)
        handler.path = "/api?action=fonteDados"

        self.assertTrue(handler.should_disable_cache())

    def test_versioned_javascript_keeps_default_static_cache_headers(self):
        handler = server.AdminRequestHandler.__new__(server.AdminRequestHandler)
        handler.path = "/app.js?v=26"

        self.assertFalse(handler.should_disable_cache())


if __name__ == "__main__":
    unittest.main()
