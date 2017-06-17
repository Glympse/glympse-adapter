// App entry point
define(function(require, exports, module)
{
    'use strict';

    // import dependencies
	var clientMain = require('src-client/Main');
	var clientViewManager = require('src-client/ViewManager');
	var hostMain = require('src-host/Main');
	var hostViewManager = require('src-host/ViewManager');

	var host = {};
	var client = {};


	$(document).ready(function()
	{
		/**
		 * HOST setup
		 */
		host.cfg = window.cfgHost || {};

		var cfgAdapter = host.cfg.adapter || {};
		var cfgApp = host.cfg.app || {};
		var cfgViewer = host.cfg.viewer || {};

		// Sync debug settings
		var dbg = host.cfg.dbg;
		cfgAdapter.dbg = dbg;
		cfgApp.dbg = dbg;
		cfgViewer.dbg = dbg;

		// Ensure configs are valid
		host.cfg.adapter = cfgAdapter;
		host.cfg.app = cfgApp;
		host.cfg.viewer = cfgViewer;

		// Set up view with main controller
		host.vm = new hostViewManager(cfgApp);
		host.main = new hostMain(host.vm, host.cfg);



		/**
		 * CLIENT setup
		 */
		client.cfg = window.cfgClient || {};

		cfgAdapter = client.cfg.adapter || {};
		cfgApp = client.cfg.app || {};
		cfgViewer = client.cfg.viewer || {};

		// Sync debug settings
		dbg = client.cfg.dbg;
		cfgAdapter.dbg = dbg;
		cfgApp.dbg = dbg;
		cfgViewer.dbg = dbg;

		console.log('*** H-C [CLIENT] --> ' + dbg);

		// Ensure configs are valid
		client.cfg.adapter = cfgAdapter;
		client.cfg.app = cfgApp;
		client.cfg.viewer = cfgViewer;

		// Add custom settings to advertise to connecting host
		client.cfg.published = {
			viewer: {
				customSetting: 'visible_to_host',
				hostCanSeeThis: true,
				hostClientDemoMode: 1
			}
		};

		client.vm = new clientViewManager(cfgApp);
		client.main = new clientMain(client.vm, client.cfg);
	});
});
