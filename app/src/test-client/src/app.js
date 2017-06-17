// App entry point
define(function(require, exports, module)
{
    'use strict';

    // import dependencies
	var Main = require('src-client/Main');
	var ViewManager = require('src-client/ViewManager');

	var cfg;
	var main;
	var vm;


	$(document).ready(function()
	{
		cfg = window.cfgApp || {};

		var cfgAdapter = cfg.adapter || {};
		var cfgApp = cfg.app || {};
		var cfgViewer = cfg.viewer || {};

		// Sync debug settings
		var dbg = cfg.dbg;
		cfgAdapter.dbg = dbg;
		cfgApp.dbg = dbg;
		cfgViewer.dbg = dbg;

		console.log('*** CLIENT --> ' + dbg);

		// Ensure configs are valid
		cfg.adapter = cfgAdapter;
		cfg.app = cfgApp;
		cfg.viewer = cfgViewer;

		// Add custom settings to advertise to connecting host
		cfg.published = {
			viewer: {
				customSetting: 'visible_to_host',
				hostCanSeeThis: true
			}
		};

		vm = new ViewManager(cfgApp);
		main = new Main(vm, cfg);
	});
});
