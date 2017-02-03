module.exports = {
	client: {
		configFile: 'tests/karma.conf.js',
		customContextFile: 'app/src/test-client/index-client.html',
		browserNoActivityTimeout: 200000,

		proxies: {
			'/src/app.js': '/base/app/src/test-client/src/app.js',
			'/src/Main.js': '/base/app/src/test-client/src/Main.js',
			'/src/ViewManager.js': '/base/app/src/test-client/src/ViewManager.js',
			'/src/Defines.js': '/base/app/src/test-client/src/Defines.js',
			'/css/styles.css': '/base/app/css/styles.css',
			'/lib/': '/base/app/lib/',
			'/requireConfig-client.js': '/base/app/src/test-client/requireConfig-client.js',

			'/src/': '/base/app/src/',
			'/common/': '/base/app/src/common/',

			'/node_modules/': '/base/node_modules/'
		}
	}
};
