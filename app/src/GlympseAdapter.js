/**
 * @namespace adapter
 */

// App entry point
define(function(require, exports, module)
{
	'use strict';

	// Polyfills - external
	require('UUID');
	require('kamino');
	require('MessageChannel');

	// imports
	var lib = require('glympse-adapter/lib/utils');
	var Oasis = require('oasis');
	var VersionInfo = require('glympse-adapter/VersionInfo');
	var Client = require('glympse-adapter/adapter/Client');
	var Host = require('glympse-adapter/adapter/Host');
	var ajax = require('glympse-adapter/lib/ajax');


	// Faked AMD module setup -- necessary??
	if (!window.Oasis)
	{
		window.Oasis = Oasis;			// Needed for some Oasis modules
	}


	/**
	 * @class adapter.GlympseAdapter
	 * @memberOf adapter
	 * @param {Object} controller Instance of controller with cmd(msg, args) and notify(msg, args) methods
	 * @param {Object} cfg Adapter configuration
	 * @constructor
	 */
	function GlympseAdapter(controller, cfg)
	{
		var adapterLabel = 'GlympseAdapter';

		var cfgApp = (cfg && cfg.app) || {};
		var cfgAdapter = (cfg && cfg.adapter) || {};
		var cfgViewer = (cfg && cfg.viewer) || {};
		var dbg = lib.dbg(adapterLabel, cfgApp.dbg);

		var client;			// client mode
		var host;			// host mode
		var hostElement;	// host mode
		var oasisLocal;
		var that = this;

		var glympserLoader = null;
		var version = VersionInfo.version;

		if (cfgAdapter.appName && cfgAdapter.appVersion && !cfgViewer.appName && !cfgViewer.appVersion)
		{
			cfgViewer.appName = cfgAdapter.appName;
			cfgViewer.appVersion = cfgAdapter.appVersion;
		}

		cfgAdapter.appName = cfgAdapter.appName || adapterLabel;
		cfgAdapter.appVersion = cfgAdapter.appVersion || version;

		ajax.requestHeaders = {
			'X-GlympseAgent': ('app=' + cfgAdapter.appName
								+ '&ver=' + cfgAdapter.appVersion
								+ '&comp=' + adapterLabel
								+ '&comp_ver=' + version)
		};


		///////////////////////////////////////////////////////////////////////////////
		// API endpoint namespace (updated at runtime)
		///////////////////////////////////////////////////////////////////////////////

		this.app = {};
		this.cards = {};
		this.core = {};
		this.ext = {};
		this.map = {};


		///////////////////////////////////////////////////////////////////////////////
		// PROPERTIES
		///////////////////////////////////////////////////////////////////////////////

		//this.getViewer = function()
		//{
		//	return (client && client.getViewer());
		//};


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		/**
		 * @method
		 * @param {Object} cfgNew Viewer config
		 * @param {HtmlElement} mapHtmlElement Viewer container element
		 */
		this.loadViewer = function(cfgNew, mapHtmlElement)
		{
			if (!glympserLoader)
			{
				dbg('adapter must be initialized in client mode first', null, 3);
				return;
			}
			glympserLoader.done(function()
			{
				client.loadViewer(cfgNew, mapHtmlElement);
			});
		};

		this.host = function(cfgHost)
		{
			if (host || client)
			{
				return hostElement;
			}

			host = new Host(this, oasisLocal, cfg);
			hostElement = host.init(cfgHost);

			return hostElement;
		};

		this.client = function(mapHtmlElement)
		{
			if (host || client)
			{
				return;
			}

			glympserLoader = loadGlympser();
			glympserLoader.done(function()
			{
				client = new Client(that
					, oasisLocal
					, controller
					, cfg
					, (mapHtmlElement && mapHtmlElement[0])
				);

				client.init({
					  id: VersionInfo.id
					, version: VersionInfo.version
				});
			});
		};


		///////////////////////////////////////////////////////////////////////////////
		// INTERNAL
		///////////////////////////////////////////////////////////////////////////////

		function loadGlympser()
		{
			var loader = $.Deferred();
			if ($.fn.glympser)
			{
				dbg('glympser loader is already included in the page - use existing.');
				loader.resolve();
			}
			else
			{
				var loaderUrl = cfgAdapter.loaderPath ||
								[ '//'
								, ((cfgAdapter.loaderEnvironment === 'sandbox' || cfgAdapter.sandbox) ? 's-' : '')
								, 'viewer.content.glympse.com/components/glympse-viewer/'
								, (cfgAdapter.loaderVersion || 'stable')
								, '/jquery.glympser.min.js'
								].join('');

				dbg('loading glympser loader from', loaderUrl);
				$.ajax({ dataType: 'script', cache: true, url: loaderUrl })
					.done(function()
					{
						dbg('.. loaded glympser loader!');
						loader.resolve();
					})
					.fail(function()
					{
						dbg('Failed to load Loader script:', arguments, 3);
						loader.reject();
					});
			}
			return loader;
		}


		///////////////////////////////////////////////////////////////////////////////
		// CTOR
		///////////////////////////////////////////////////////////////////////////////

		oasisLocal = new Oasis();			// Found in minified source
		oasisLocal.autoInitializeSandbox();	// Found in minified source
		oasisLocal.configure('allowSameOrigin', true);
	}


	// Global namespace registration
	(function(w) {
		var g = w.glympse || {};
		/* eslint-disable no-unused-expressions */
		g.GlympseAdapter || (g.GlympseAdapter = GlympseAdapter);
		/* eslint-enable no-unused-expressions */
		w.glympse = g;
	})(window);

	module.exports = GlympseAdapter;
});
