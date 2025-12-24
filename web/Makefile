# Damn Nature You Scary - Web Build & Deploy
# Requires: netlify-cli (npm install -g netlify-cli)
# Note: Prefer running `make deploy` from project root for full build

SITE_ID := db7d3d45-fb46-4635-82eb-a8cbca753254

.PHONY: serve build deploy deploy-preview sync-data cards version clean

# Local development server
serve:
	python3 -m http.server 8080

# Full build: cards + sync data + version
build: cards sync-data version
	@echo "Web build complete"

# Deploy to production (full build first)
deploy: build
	PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --prod --dir=. --site=$(SITE_ID)

# Deploy preview (non-production)
deploy-preview: build
	PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --dir=. --site=$(SITE_ID)

# Sync data files from parent data/ folder
sync-data:
	cp ../data/traits.json data/traits.json
	cp ../data/events.json data/events.json
	cp ../data/tiles.json data/tiles.json
	cp ../data/era_decks.json data/era_decks.json
	cp ../data/phylogeny.json data/phylogeny.json
	cp ../data/organisms.json data/organisms.json
	@echo "Data synced from ../data/"

# Generate printable SVG cards (runs from parent dir)
cards:
	cd .. && python3 tools/card_generator.py --sheets
	@echo "Cards generated in ../generated_cards/"

# Update version info in index.html with date-based version
version:
	@TODAY=$$(date +%Y.%m.%d); \
	COMMIT=$$(git rev-parse --short HEAD 2>/dev/null || echo "unknown"); \
	CURRENT=$$(grep -oE 'v[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+' index.html | head -1); \
	if [ -n "$$CURRENT" ]; then \
	  CURRENT_DATE=$$(echo $$CURRENT | sed 's/v\([0-9.]*\)\.[0-9]*$$/\1/'); \
	  CURRENT_BUILD=$$(echo $$CURRENT | sed 's/.*\.//'); \
	  if [ "$$CURRENT_DATE" = "$$TODAY" ]; then \
	    BUILD=$$((CURRENT_BUILD + 1)); \
	  else \
	    BUILD=1; \
	  fi; \
	else \
	  BUILD=1; \
	fi; \
	VERSION="v$$TODAY.$$BUILD"; \
	sed -i '' "s/v[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*/$$VERSION/" index.html; \
	sed -i '' "s/| [a-f0-9]*<\/div>/| $$COMMIT<\/div>/" index.html; \
	echo "Version: $$VERSION | $$COMMIT"

# Clean generated files
clean:
	rm -rf .netlify/cache

