.PHONY: build deploy

build:
	[[ -f .installed ]] || ( npm install --silent && touch .installed )
	tsc --pretty

deploy: build  
	clasp push
