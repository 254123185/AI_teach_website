from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from solution import render_demo
from tone_curve import shadow_lift


SAMPLES = json.loads(Path(__file__).with_name("samples.json").read_text(encoding="utf-8"))


class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = {}
        self.resources = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "id" in attributes:
            self.tags[attributes["id"]] = (tag, attributes)
        self.resources += [attributes[key] for key in ("src", "href") if key in attributes]


class DemoTest(unittest.TestCase):
    def test_embedded_ui(self):
        html = render_demo(SAMPLES)
        inspector = Inspect()
        inspector.feed(html)
        self.assertEqual(inspector.tags["sample"][0], "select")
        self.assertEqual(inspector.tags["strength"][1]["type"], "range")
        self.assertEqual(inspector.tags["strength"][1]["min"], "0")
        self.assertEqual(inspector.tags["strength"][1]["max"], "100")
        for section in ("before", "after", "summary"):
            self.assertIn(section, inspector.tags)
        for sample in SAMPLES:
            self.assertIn(sample["name"], html)
        self.assertEqual(inspector.resources, [])

    def test_reference_operator_invariants(self):
        self.assertEqual(shadow_lift(18, 0), 18)
        self.assertEqual(shadow_lift(18, 100), 238)
        self.assertEqual(shadow_lift(36, 100), 224)
        self.assertGreater(shadow_lift(18, 100), shadow_lift(36, 100))
        self.assertEqual(shadow_lift(255, 100), 255)
