# Damn Nature You Scary - Build & Deploy
# Requires: netlify-cli (npm install -g netlify-cli)

SITE_ID := db7d3d45-fb46-4635-82eb-a8cbca753254

.PHONY: serve deploy deploy-preview sync-data cards version clean

# Local development server
serve:
	python3 -m http.server 8080

# Deploy to production
deploy: sync-data version
	PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --prod --dir=. --site=$(SITE_ID)

# Deploy preview (non-production)
deploy-preview: sync-data version
	PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --dir=. --site=$(SITE_ID)

# Sync data files from parent data/ folder
sync-data:
	cp ../data/traits.json data/traits.json
	cp ../data/events.json data/events.json
	cp ../data/tiles.json data/tiles.json
	cp ../data/era_decks.json data/era_decks.json
	cp ../data/phylogeny.json data/phylogeny.json
	cp ../data/organisms.json data/organisms.json

# Generate printable SVG cards (runs from parent dir)
cards:
	cd .. && python3 tools/card_generator.py --sheets

# Update version info in index.html with current git commit
version:
	@COMMIT=$$(git rev-parse --short HEAD 2>/dev/null || echo "unknown"); \
	DATE=$$(date +%Y%m%d); \
	sed -i '' "s/build [0-9]*/build $$DATE/" index.html; \
	sed -i '' "s/| [a-f0-9]\{7\}$$/| $$COMMIT/" index.html; \
	echo "Updated version: build $$DATE | $$COMMIT"

# Clean generated files
clean:
	rm -rf .netlify/cache

