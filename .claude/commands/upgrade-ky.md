In our js-utils we have a workaround to make Ky work without ESM modules.

To upgrate it we have to install the latest version of KY as a devDependency (its already tracked)

Finally run

"build:ky": "tsup --config tsup.config.ts && ts-node ./postBuildKy.ts"

from the package.json

If you see any issues, please make sure to fix them.
Finally run the tests to make sure that everything is working in the project
