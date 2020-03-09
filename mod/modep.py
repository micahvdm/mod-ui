#!/usr/bin/env python3

import sys

sys.modules['tornado'] = __import__('tornado4')

from mod import webserver
webserver.run()
