// App entry point
define(function(require, exports, module)
{
    'use strict';

	// Core imports
	var GlympseAdapter = require('glympse-adapter/GlympseAdapter');
	var AdapterDefines = require('glympse-adapter/GlympseAdapterDefines');
	var VersionInfo = require('glympse-adapter/VersionInfo');
	var lib = require('glympse-adapter/lib/utils');

	// Test app-specific
	var Defines = require('src-client/Defines');

	var m = AdapterDefines.MSG;

	console.log(VersionInfo.id + ' v(' + VersionInfo.version + ')');


	function Main(vm, cfgCore)
	{
		// Main config for app setup
		var cfg = (cfgCore && cfgCore.app) || { };
		var dbg = lib.dbg('Client-Main', cfg.dbg);

		var adapter;
		var cards;
		var invitesCard;
		var invitesGlympse;
		var that = this;


		///////////////////////////////////////////////////////////////////////////////
		// PUBLICS
		///////////////////////////////////////////////////////////////////////////////

		this.notify = function(msg, args)
		{
			switch (msg)
			{
				case m.AdapterReady:
				{
					dbg('--> ADAPTER READY', args);
					invitesCard = args.cards;
					invitesGlympse = args.glympses;

					// adapter.core.getETAInfo([
					// 	{
					// 		start: { name: 'Holiday Inn Los Angeles Gateway', lat: 33.8507901, lng: -118.306608 },
					// 		end: { name: 'LAX Terminal #1', lat: 33.9451076, lng: -118.4032515 }
					// 	},
					// 	{
					// 		start: { name: 'LAX Terminal #1', lat: 33.9451076, lng: -118.4032515 },
					// 		end: { name: 'LAX Terminal #3', lat: 33.9438901, lng: -118.4060479 }
					// 	},
					// 	{
					// 		start: { name: 'LAX Terminal #3', lat: 33.9438901, lng: -118.4060479 },
					// 		end: { name: 'Holiday Inn Los Angeles Gateway', lat: 33.8507901, lng: -118.306608 }
					// 	}
					// ]);

					break;
				}

				case m.ViewerReady:
				{
					dbg('----> VIEWER READY');
					vm.cmd(Defines.CMD.InitUi, { invitesCard: invitesCard
												, invitesGlympse: invitesGlympse
												, cards: cards
											   });
					//dbg('MAP = ' + adapter.map.getMap());
					break;
				}

				case m.CardsInitEnd:
				{
					dbg('--> FINISHED CARDS LOAD! ' + cards.length + ' total cards');
					dbg('---> First card: "' + cards[0].getIdCard() + '" (' + cards[0].getId() + '), type=' + cards[0].getTypeId());
					cards = args;
					break;
				}

				default:
				{
					//dbg('[OTHER] StubViewer.notify(): [' + msg + '] -- ' + JSON.stringify(args));
					return vm.cmd(msg, args);
				}
			}

			return null;
		};


		///////////////////////////////////////////////////////////////////////////////
		// UTILITY
		///////////////////////////////////////////////////////////////////////////////

		function adapterInit()
		{
			var cfgAdapter = cfgCore.adapter;

			cfgAdapter.initialize = adapterPostInit;
			cfgAdapter.interfaces = { customMethodExample: doCustomMethod };

			adapter = new GlympseAdapter(that, cfgCore);
			adapter.client($(cfg.elementViewer));
			cfg.adapter = adapter;	// Reference for general app usage
		}

		function adapterPostInit()
		{
			dbg('ADAPTER_POST_INIT');
		}

		function doCustomMethod(args)
		{
			dbg('CALLED CUSTOM_METHOD: ' + JSON.stringify(args));
			return { passed: args, sample: 'badu!' };
		}


		///////////////////////////////////////////////////////////////////////////////
		// CTOR
		///////////////////////////////////////////////////////////////////////////////

		if (!cfgCore || !cfgCore.app || !cfgCore.viewer || !cfgCore.adapter)
		{
			dbg('[ERROR]: Invalid config! Aborting...', cfgCore);
			return;
		}

		if (!vm)
		{
			dbg('[ERROR]: ViewManager not defined! Aborting...');
			return;
		}

		vm.init(this);

		// Add initial init delay to allow viewport to settle down
		setTimeout(adapterInit, 100);
	}


	module.exports = Main;
});
