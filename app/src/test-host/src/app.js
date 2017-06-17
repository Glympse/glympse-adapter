// App entry point
define(function(require, exports, module)
{
    'use strict';

    // import dependencies
	var Main = require('src-host/Main');
	var ViewManager = require('src-host/ViewManager');

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

		// Ensure configs are valid
		cfg.adapter = cfgAdapter;
		cfg.app = cfgApp;
		cfg.viewer = cfgViewer;

		// Set up view with main controller
		vm = new ViewManager(cfgApp);
		main = new Main(vm, cfg);
	});
});
