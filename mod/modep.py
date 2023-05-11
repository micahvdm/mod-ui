#!/usr/bin/env python3

import sys

sys.modules['tornado'] = __import__('tornado')

from mod import webserver
webserver.run()
