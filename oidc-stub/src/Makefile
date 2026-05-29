build-MockOidcProviderFunction:
	npm ci
	npx esbuild MockOidcProviderHandler.ts \
	--bundle \
	--platform=node \
	--target=node22 \
	--format=esm \
	--outfile=$(ARTIFACTS_DIR)/MockOidcProviderHandler.js \
	--banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
	--minify \
	--sourcemap \
	--out-extension:.js=.mjs \
	--loader:.ejs=copy \
cp -r views $(ARTIFACTS_DIR)/
cp package.json $(ARTIFACTS_DIR)/
cp package-lock.json $(ARTIFACTS_DIR)/
cd $(ARTIFACTS_DIR) && npm ci --omit=dev