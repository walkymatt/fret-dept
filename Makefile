.PHONY: bundle standalone serve test check clean

## Build bundle.js from ES module sources (required before opening index.html)
bundle:
	bun build js/app.js --outfile=bundle.js --target=browser

## Produce guitar-standalone.html — CSS and JS fully inlined, zero external files
standalone: bundle
	python3 scripts/build-standalone.py

## Run tests against the ES module source files
test:
	bun test

## check = test (alias)
check: test

## Build then serve on port 5050
serve: bundle
	python3 -m http.server 5050

## Remove generated artefacts
clean:
	rm -f bundle.js guitar-standalone.html
