# SPDX-License-Identifier: GPL-3.0-only

.PHONY: check lisp-test simulator-zip

check:
	python3 tools/lispbm_static_check.py src/skid-steer.lisp
	node --test tests/lisp-controller.test.mjs

lisp-test:
	node --test tests/lisp-controller.test.mjs

simulator-zip:
	cd simulator && npm run build:skidcopter
