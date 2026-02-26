.PHONY: serve check clean

## Serve the app locally on port 8080
serve:
	python3 -m http.server 8080

## Basic sanity check — ensure JS files have no syntax errors
check:
	@echo "Checking JS syntax..."
	@node --input-type=module < js/theory.js   && echo "  theory.js   OK"
	@node --input-type=module < js/fretboard.js && echo "  fretboard.js OK"
	@node --input-type=module < js/renderer.js  && echo "  renderer.js  OK"
	@echo "All checks passed."

## Remove any generated artefacts (nothing currently)
clean:
	@echo "Nothing to clean."
