# Damn Nature You Scary - Root Makefile
# Build, test, and deploy workflow

SITE_ID := db7d3d45-fb46-4635-82eb-a8cbca753254

.PHONY: build deploy test serve cards sync-data version clean help

# Build everything: cards + sync web data
build: cards sync-data version
	@echo "Build complete"

# Deploy web game to Netlify (production)
deploy: sync-data version
	cd web && PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --prod --dir=. --site=$(SITE_ID)

# Deploy preview (non-production)
deploy-preview: sync-data version
	cd web && PATH="/opt/homebrew/bin:$$PATH" npx --yes netlify-cli deploy --dir=. --site=$(SITE_ID)

# Run balance simulator (game testing)
test:
	python3 tools/balance_simulator.py 100

# Full balance test (1000 games)
test-full:
	python3 tools/balance_simulator.py 1000

# Trait analysis
test-analyze:
	python3 tools/balance_simulator.py --analyze

# Generate all SVG cards
cards:
	python3 tools/card_generator.py --sheets

# Sync data files to web folder
sync-data:
	cp data/traits.json web/data/
	cp data/events.json web/data/
	cp data/tiles.json web/data/
	cp data/era_decks.json web/data/
	cp data/phylogeny.json web/data/
	cp data/organisms.json web/data/

# Update version info in web/index.html
version:
	@COMMIT=$$(git rev-parse --short HEAD 2>/dev/null || echo "unknown"); \
	DATE=$$(date +%Y%m%d); \
	sed -i '' "s/build [0-9]*/build $$DATE/" web/index.html; \
	sed -i '' "s/| [a-f0-9]\{7\}$$/| $$COMMIT/" web/index.html; \
	echo "Updated version: build $$DATE | $$COMMIT"

# Local development server
serve:
	cd web && python3 -m http.server 8080

# Clean generated files
clean:
	rm -rf web/.netlify/cache

# Show available targets
help:
	@echo "Damn Nature You Scary - Build System"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Build targets:"
	@echo "  build          Build cards + sync web data"
	@echo "  cards          Generate SVG cards for print"
	@echo "  sync-data      Copy data/*.json to web/data/"
	@echo "  version        Update version info in index.html"
	@echo ""
	@echo "Deploy targets:"
	@echo "  deploy         Deploy to Netlify (production)"
	@echo "  deploy-preview Deploy preview (non-production)"
	@echo ""
	@echo "Test targets:"
	@echo "  test           Balance simulation (100 games)"
	@echo "  test-full      Balance simulation (1000 games)"
	@echo "  test-analyze   Trait analysis"
	@echo ""
	@echo "Other:"
	@echo "  serve          Local dev server on :8080"
	@echo "  clean          Remove build cache"
	@echo "  help           Show this help"

